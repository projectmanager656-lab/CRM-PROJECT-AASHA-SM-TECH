import mongoose from 'mongoose';
import OfferLetter from '../models/OfferLetter.js';
import Candidate from '../models/Candidate.js';
import User from '../models/User.js';
import CompanySetting from '../models/CompanySetting.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createdResponse, successResponse } from '../utils/apiResponse.js';
import { createForbiddenError, createNotFoundError, createValidationError } from '../utils/apiError.js';
import { sendOfferEmail } from '../utils/emailService.js';
import { logger } from '../utils/logger.js';

const isHrOrAdmin = (user) =>
  ['admin', 'super_admin'].includes(user?.role) || user?.department === 'HR';

const generateOfferNumber = () => `OFR-${Math.floor(10000 + Math.random() * 90000)}`;

const generateEmployeeId = async () => {
  let empId = `EMP-${Math.floor(10000 + Math.random() * 90000)}`;
  while (await User.exists({ 'jobDetails.employeeId': empId })) {
    empId = `EMP-${Math.floor(10000 + Math.random() * 90000)}`;
  }
  return empId;
};

const performerName = (user) => {
  if (!user) return 'System';
  if (user.firstName || user.lastName) return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return user.email || 'HR';
};

export const OfferLetterController = {

  // GET /recruitment/offer-letters/summary
  offerSummary: asyncHandler(async (_req, res) => {
    const [total, draft, sent, accepted, rejected, expired, withdrawn] = await Promise.all([
      OfferLetter.countDocuments({ isDeleted: false }),
      OfferLetter.countDocuments({ isDeleted: false, status: 'Draft' }),
      OfferLetter.countDocuments({ isDeleted: false, status: 'Sent' }),
      OfferLetter.countDocuments({ isDeleted: false, status: 'Accepted' }),
      OfferLetter.countDocuments({ isDeleted: false, status: 'Rejected' }),
      OfferLetter.countDocuments({ isDeleted: false, status: 'Expired' }),
      OfferLetter.countDocuments({ isDeleted: false, status: 'Withdrawn' }),
    ]);
    const pendingConversion = await OfferLetter.countDocuments({
      isDeleted: false,
      status: 'Accepted',
      convertedEmployee: null,
    });
    res.json(successResponse(
      { total, draft, sent, accepted, rejected, expired, withdrawn, pendingConversion },
      'Offer letter summary retrieved'
    ));
  }),

  // GET /recruitment/offer-letters
  listOffers: asyncHandler(async (req, res) => {
    const filter = { isDeleted: false };
    if (req.query.status && req.query.status !== 'All') filter.status = req.query.status;
    if (req.query.department && req.query.department !== 'All') filter.department = req.query.department;
    if (req.query.employmentType && req.query.employmentType !== 'All') filter.employmentType = req.query.employmentType;
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { offerNumber: regex },
        { offeredDesignation: regex },
        { department: regex },
      ];
    }

    const sort = req.query.sort === 'oldest' ? { offerDate: 1 } : { offerDate: -1 };

    const offers = await OfferLetter.find(filter)
      .populate('candidate', 'candidateId name email phone appliedPosition department location')
      .populate('convertedEmployee', 'firstName lastName email jobDetails.employeeId')
      .sort(sort)
      .lean();

    res.json(successResponse(offers, 'Offer letters retrieved'));
  }),

  // POST /recruitment/offer-letters
  createOffer: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const {
      candidateId,
      offeredDesignation,
      department,
      employmentType,
      salary,
      joiningDate,
      offerDate,
      expiresAt,
      probationPeriod,
      workLocation,
      reportingManager,
      workingHours,
      noticePeriod,
      termsAndConditions,
      additionalNotes,
    } = req.body;

    if (!candidateId) throw createValidationError('Candidate is required');
    if (!offeredDesignation) throw createValidationError('Offered designation is required');
    if (!department) throw createValidationError('Department is required');

    const candidate = await Candidate.findById(candidateId);
    if (!candidate) throw createNotFoundError('Candidate not found');

    let uniqueOfferNumber = generateOfferNumber();
    while (await OfferLetter.exists({ offerNumber: uniqueOfferNumber })) {
      uniqueOfferNumber = generateOfferNumber();
    }

    const offer = await OfferLetter.create({
      offerNumber: uniqueOfferNumber,
      candidate: candidateId,
      offeredDesignation: offeredDesignation.trim(),
      department: department.trim(),
      employmentType: employmentType || 'Full Time',
      salary: salary || 'Competitive',
      joiningDate: joiningDate ? new Date(joiningDate) : null,
      offerDate: offerDate ? new Date(offerDate) : new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      probationPeriod: probationPeriod || '6 Months',
      workLocation: workLocation || '',
      reportingManager: reportingManager || '',
      workingHours: workingHours || '9:00 AM - 6:00 PM (Mon-Sat)',
      noticePeriod: noticePeriod || '30 Days',
      termsAndConditions: termsAndConditions || '',
      additionalNotes: additionalNotes || '',
      status: 'Draft',
      createdBy: req.user?.userId || null,
      history: [{
        action: 'Offer Created',
        performedBy: req.user?.userId || null,
        performedByName: performerName(req.user),
        note: `Offer letter created for ${candidate.name} as ${offeredDesignation}`,
        timestamp: new Date(),
      }],
    });

    // Sync Candidate.offer for backward compatibility
    candidate.offer = {
      offeredDesignation: offer.offeredDesignation,
      department: offer.department,
      salary: offer.salary,
      joiningDate: offer.joiningDate,
      offerDate: offer.offerDate,
      status: 'Draft',
      notes: additionalNotes || '',
    };
    candidate.status = 'Offered';
    if (!['Selected', 'Hired'].includes(candidate.stage)) candidate.stage = 'Selected';
    candidate.history.push({
      stage: 'Selected',
      updatedAt: new Date(),
      notes: `Offer letter ${uniqueOfferNumber} created`,
    });
    await candidate.save();

    const populated = await OfferLetter.findById(offer._id)
      .populate('candidate', 'candidateId name email phone appliedPosition department location')
      .lean();

    res.status(201).json(createdResponse(populated, 'Offer letter created successfully'));
  }),

  // GET /recruitment/offer-letters/:id
  getOffer: asyncHandler(async (req, res) => {
    const offer = await OfferLetter.findOne({ _id: req.params.id, isDeleted: false })
      .populate('candidate', 'candidateId name email phone appliedPosition department location noticePeriod experience')
      .populate('convertedEmployee', 'firstName lastName email department designation jobDetails')
      .lean();
    if (!offer) throw createNotFoundError('Offer letter not found');
    res.json(successResponse(offer, 'Offer letter retrieved'));
  }),

  // PUT /recruitment/offer-letters/:id
  updateOffer: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const offer = await OfferLetter.findOne({ _id: req.params.id, isDeleted: false });
    if (!offer) throw createNotFoundError('Offer letter not found');

    if (['Accepted', 'Withdrawn'].includes(offer.status)) {
      throw createValidationError('Accepted or withdrawn offers cannot be edited');
    }

    const allowed = [
      'offeredDesignation', 'department', 'employmentType', 'salary',
      'joiningDate', 'offerDate', 'expiresAt', 'probationPeriod',
      'workLocation', 'reportingManager', 'workingHours', 'noticePeriod',
      'termsAndConditions', 'additionalNotes',
    ];

    allowed.forEach((key) => {
      if (req.body[key] !== undefined) {
        if (['joiningDate', 'offerDate', 'expiresAt'].includes(key)) {
          offer[key] = req.body[key] ? new Date(req.body[key]) : null;
        } else {
          offer[key] = req.body[key];
        }
      }
    });

    offer.updatedBy = req.user?.userId || null;
    offer.history.push({
      action: 'Offer Updated',
      performedBy: req.user?.userId || null,
      performedByName: performerName(req.user),
      note: 'Offer details updated by HR',
      timestamp: new Date(),
    });

    await offer.save();

    // Sync candidate.offer
    const candidate = await Candidate.findById(offer.candidate);
    if (candidate) {
      candidate.offer = {
        offeredDesignation: offer.offeredDesignation,
        department: offer.department,
        salary: offer.salary,
        joiningDate: offer.joiningDate,
        offerDate: offer.offerDate,
        status: offer.status,
        notes: offer.additionalNotes || '',
      };
      await candidate.save();
    }

    const populated = await OfferLetter.findById(offer._id)
      .populate('candidate', 'candidateId name email phone appliedPosition department location')
      .lean();

    res.json(successResponse(populated, 'Offer letter updated'));
  }),

  // DELETE /recruitment/offer-letters/:id  (soft delete)
  deleteOffer: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const offer = await OfferLetter.findOne({ _id: req.params.id, isDeleted: false });
    if (!offer) throw createNotFoundError('Offer letter not found');

    const deletable = ['Draft', 'Rejected', 'Withdrawn', 'Expired'];
    if (!deletable.includes(offer.status)) {
      throw createValidationError(`Cannot delete an offer with status "${offer.status}". Only Draft, Rejected, Withdrawn, or Expired offers may be deleted.`);
    }

    offer.isDeleted = true;
    offer.history.push({
      action: 'Offer Deleted',
      performedBy: req.user?.userId || null,
      performedByName: performerName(req.user),
      note: 'Offer letter soft-deleted by HR',
      timestamp: new Date(),
    });
    await offer.save();

    res.json(successResponse({ id: req.params.id }, 'Offer letter deleted'));
  }),

  // POST /recruitment/offer-letters/:id/send
  sendOffer: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const offer = await OfferLetter.findOne({ _id: req.params.id, isDeleted: false })
      .populate('candidate', 'name email phone appliedPosition department');
    if (!offer) throw createNotFoundError('Offer letter not found');

    if (offer.status === 'Accepted') {
      throw createValidationError('Cannot send an offer that has already been accepted');
    }

    const candidate = offer.candidate;
    if (!candidate?.email) {
      throw createValidationError('Candidate email is not available. Cannot send offer.');
    }

    // Fetch company info dynamically
    let companyName = 'Aasha SM Technologies';
    let companyAddress = '';
    try {
      const settings = await CompanySetting.findOne({}).lean();
      if (settings?.companyName) companyName = settings.companyName;
      if (settings?.officeAddress) companyAddress = settings.officeAddress;
    } catch (_e) { /* use defaults */ }

    // Attempt real email send
    let emailSent = false;
    let emailWarning = null;
    try {
      await sendOfferEmail(candidate.email, offer, candidate.name, companyName, companyAddress);
      emailSent = true;
    } catch (err) {
      logger.error('Offer email delivery failed', { offerId: offer._id, error: err.message });
      emailWarning = `Email delivery failed: ${err.message}. SMTP may not be configured. Offer status was NOT changed to Sent.`;
    }

    if (!emailSent) {
      return res.status(422).json({
        success: false,
        message: emailWarning,
        data: null,
      });
    }

    // Only update status if email succeeded
    offer.status = 'Sent';
    offer.sentAt = new Date();
    offer.updatedBy = req.user?.userId || null;
    offer.history.push({
      action: 'Offer Sent',
      performedBy: req.user?.userId || null,
      performedByName: performerName(req.user),
      note: `Offer letter emailed to ${candidate.email}`,
      timestamp: new Date(),
    });
    await offer.save();

    // Sync candidate
    const cand = await Candidate.findById(offer.candidate._id || offer.candidate);
    if (cand) {
      if (cand.offer) cand.offer.status = 'Sent';
      await cand.save();
    }

    res.json(successResponse(offer, `Offer letter successfully sent to ${candidate.email}`));
  }),

  // POST /recruitment/offer-letters/:id/resend
  resendOffer: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const offer = await OfferLetter.findOne({ _id: req.params.id, isDeleted: false })
      .populate('candidate', 'name email');
    if (!offer) throw createNotFoundError('Offer letter not found');
    if (!['Sent', 'Draft'].includes(offer.status)) {
      throw createValidationError('Can only resend Sent or Draft offers');
    }
    const candidate = offer.candidate;
    if (!candidate?.email) throw createValidationError('Candidate email not available');

    let companyName = 'Aasha SM Technologies';
    try {
      const settings = await CompanySetting.findOne({}).lean();
      if (settings?.companyName) companyName = settings.companyName;
    } catch (_e) { /* use defaults */ }

    let emailSent = false;
    let emailWarning = null;
    try {
      await sendOfferEmail(candidate.email, offer, candidate.name, companyName, '');
      emailSent = true;
    } catch (err) {
      logger.error('Offer resend email failed', { offerId: offer._id, error: err.message });
      emailWarning = `Email delivery failed: ${err.message}. SMTP may not be configured.`;
    }

    if (!emailSent) {
      return res.status(422).json({ success: false, message: emailWarning, data: null });
    }

    offer.status = 'Sent';
    offer.sentAt = offer.sentAt || new Date();
    offer.history.push({
      action: 'Offer Resent',
      performedBy: req.user?.userId || null,
      performedByName: performerName(req.user),
      note: `Offer letter resent to ${candidate.email}`,
      timestamp: new Date(),
    });
    await offer.save();

    res.json(successResponse(offer, `Offer resent to ${candidate.email}`));
  }),

  // POST /recruitment/offer-letters/:id/accept
  markAccepted: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const offer = await OfferLetter.findOne({ _id: req.params.id, isDeleted: false });
    if (!offer) throw createNotFoundError('Offer letter not found');
    if (!['Sent', 'Draft'].includes(offer.status)) {
      throw createValidationError(`Cannot accept an offer with status "${offer.status}"`);
    }

    offer.status = 'Accepted';
    offer.acceptedAt = new Date();
    offer.updatedBy = req.user?.userId || null;
    offer.history.push({
      action: 'Offer Accepted',
      performedBy: req.user?.userId || null,
      performedByName: performerName(req.user),
      note: req.body.note || 'Candidate accepted the offer',
      timestamp: new Date(),
    });
    await offer.save();

    const cand = await Candidate.findById(offer.candidate);
    if (cand) {
      if (cand.offer) cand.offer.status = 'Accepted';
      cand.status = 'Offered';
      await cand.save();
    }

    res.json(successResponse(offer, 'Offer marked as Accepted'));
  }),

  // POST /recruitment/offer-letters/:id/reject
  markRejected: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const offer = await OfferLetter.findOne({ _id: req.params.id, isDeleted: false });
    if (!offer) throw createNotFoundError('Offer letter not found');
    if (['Accepted', 'Withdrawn'].includes(offer.status)) {
      throw createValidationError(`Cannot reject an offer with status "${offer.status}"`);
    }

    offer.status = 'Rejected';
    offer.rejectedAt = new Date();
    offer.updatedBy = req.user?.userId || null;
    offer.history.push({
      action: 'Offer Rejected',
      performedBy: req.user?.userId || null,
      performedByName: performerName(req.user),
      note: req.body.reason || 'Candidate declined the offer',
      timestamp: new Date(),
    });
    await offer.save();

    const cand = await Candidate.findById(offer.candidate);
    if (cand) {
      if (cand.offer) cand.offer.status = 'Rejected';
      await cand.save();
    }

    res.json(successResponse(offer, 'Offer marked as Rejected'));
  }),

  // POST /recruitment/offer-letters/:id/withdraw
  withdrawOffer: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const offer = await OfferLetter.findOne({ _id: req.params.id, isDeleted: false });
    if (!offer) throw createNotFoundError('Offer letter not found');
    if (['Accepted', 'Withdrawn'].includes(offer.status)) {
      throw createValidationError(`Cannot withdraw an offer with status "${offer.status}"`);
    }

    offer.status = 'Withdrawn';
    offer.withdrawnAt = new Date();
    offer.updatedBy = req.user?.userId || null;
    offer.history.push({
      action: 'Offer Withdrawn',
      performedBy: req.user?.userId || null,
      performedByName: performerName(req.user),
      note: req.body.reason || 'Offer withdrawn by HR',
      timestamp: new Date(),
    });
    await offer.save();

    const cand = await Candidate.findById(offer.candidate);
    if (cand) {
      if (cand.offer) cand.offer.status = 'Rejected';
      await cand.save();
    }

    res.json(successResponse(offer, 'Offer withdrawn'));
  }),

  // POST /recruitment/offer-letters/:id/convert-employee
  convertToEmployee: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const offer = await OfferLetter.findOne({ _id: req.params.id, isDeleted: false })
      .populate('candidate');
    if (!offer) throw createNotFoundError('Offer letter not found');

    if (offer.status !== 'Accepted') {
      throw createValidationError('Only Accepted offers can be converted to employee. Please mark the offer as Accepted first.');
    }
    if (offer.convertedEmployee) {
      throw createValidationError('Candidate has already been converted to an employee from this offer letter.');
    }

    const candidate = offer.candidate;
    if (!candidate) throw createNotFoundError('Candidate associated with this offer not found');

    if (candidate.convertedEmployeeId) {
      throw createValidationError('Candidate has already been converted to an employee.');
    }

    // Check if a user with this email already exists
    const existingUser = await User.findOne({ email: candidate.email });
    if (existingUser) {
      offer.convertedEmployee = existingUser._id;
      offer.convertedAt = new Date();
      offer.history.push({
        action: 'Converted to Employee',
        performedBy: req.user?.userId || null,
        performedByName: performerName(req.user),
        note: `Linked to existing user: ${existingUser.email}`,
        timestamp: new Date(),
      });
      await offer.save();

      candidate.convertedEmployeeId = existingUser._id;
      candidate.status = 'Hired';
      candidate.stage = 'Hired';
      candidate.history.push({ stage: 'Hired', updatedAt: new Date(), notes: 'Linked to existing employee via offer conversion' });
      await candidate.save();

      return res.json(successResponse({ offer, user: existingUser }, 'Candidate linked to existing employee record'));
    }

    const nameParts = candidate.name.split(' ');
    const firstName = nameParts[0] || 'Employee';
    const rawDept = offer.department || candidate.department || 'Tech';
    const validDepts = ['HR', 'Finance', 'Business Development', 'Digital Marketing', 'Video Editor', 'Tech'];
    let department = 'Tech';
    if (validDepts.includes(rawDept)) {
      department = rawDept;
    } else {
      const lower = rawDept.toLowerCase();
      if (lower.includes('tech') || lower.includes('eng') || lower.includes('dev') || lower.includes('software')) department = 'Tech';
      else if (lower.includes('hr') || lower.includes('people') || lower.includes('talent')) department = 'HR';
      else if (lower.includes('fin') || lower.includes('acc')) department = 'Finance';
      else if (lower.includes('market') || lower.includes('seo')) department = 'Digital Marketing';
      else if (lower.includes('video') || lower.includes('media')) department = 'Video Editor';
      else if (lower.includes('sales') || lower.includes('biz') || lower.includes('business')) department = 'Business Development';
    }
    const designation = offer.offeredDesignation || candidate.appliedPosition || 'Associate';
    const joiningDate = offer.joiningDate ? offer.joiningDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const employeeId = await generateEmployeeId();

    const tempPassword = `Pass@${Math.floor(1000 + Math.random() * 9000)}`;

    const newUser = await User.create({
      firstName,
      lastName,
      email: candidate.email,
      password: tempPassword,
      phone: candidate.phone || '',
      department,
      designation,
      location: candidate.location || offer.workLocation || '',
      role: 'employee',
      isActive: true,
      employmentStatus: 'Probation',
      personalInfo: {
        fullName: candidate.name,
        email: candidate.email,
        phoneNumber: candidate.phone || '',
        address: candidate.location || '',
      },
      jobDetails: {
        employeeId,
        department,
        designation,
        joiningDate,
        employmentType: offer.employmentType || 'Full Time',
        reportingManager: offer.reportingManager || '',
      },
    });

    offer.convertedEmployee = newUser._id;
    offer.convertedAt = new Date();
    offer.history.push({
      action: 'Converted to Employee',
      performedBy: req.user?.userId || null,
      performedByName: performerName(req.user),
      note: `Employee created: ${employeeId} (${designation})`,
      timestamp: new Date(),
    });
    await offer.save();

    candidate.convertedEmployeeId = newUser._id;
    candidate.status = 'Hired';
    candidate.stage = 'Hired';
    candidate.history.push({
      stage: 'Hired',
      updatedAt: new Date(),
      notes: `Converted to Employee: ${employeeId} (${designation}) via offer ${offer.offerNumber}`,
    });
    await candidate.save();

    res.status(201).json(createdResponse(
      { offer, user: newUser },
      `Candidate successfully onboarded as employee (${employeeId})`
    ));
  }),
};

export default OfferLetterController;
