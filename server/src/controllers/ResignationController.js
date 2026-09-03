import mongoose from 'mongoose';
import Resignation from '../models/Resignation.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { createForbiddenError, createNotFoundError, createValidationError } from '../utils/apiError.js';
import { createdResponse, successResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const isHrOrAdmin = (user) => ['admin', 'super_admin'].includes(user?.role) || user?.department === 'HR';

const createSystemNotification = async (recipientId, title, message, type = 'Info') => {
  try {
    if (recipientId) {
      await Notification.create({
        recipient: recipientId,
        title,
        message,
        type,
      });
    }
  } catch (err) {
    // Non-blocking notification
  }
};

export const ResignationController = {
  // 1. Simple Real KPIs
  summary: asyncHandler(async (_req, res) => {
    const resignations = await Resignation.find().lean();

    const pendingResignations = resignations.filter((r) => r.status === 'Submitted').length;
    const underReview = resignations.filter((r) => r.status === 'Under Review').length;
    const approved = resignations.filter((r) => r.status === 'Approved').length;
    const servingNotice = resignations.filter((r) => ['Approved', 'Notice Period', 'Exit Clearance'].includes(r.status)).length;
    const exitCompleted = resignations.filter((r) => r.status === 'Completed').length;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const exitThisMonth = resignations.filter((r) => {
      if (r.status === 'Rejected') return false;
      const targetDate = r.approvedLastWorkingDay ? new Date(r.approvedLastWorkingDay) : new Date(r.proposedLastWorkingDay);
      return targetDate.getMonth() === currentMonth && targetDate.getFullYear() === currentYear;
    }).length;

    res.json(
      successResponse(
        {
          pendingResignations,
          underReview,
          approved,
          servingNotice,
          exitThisMonth,
          exitCompleted,
          total: resignations.length,
        },
        'Resignation summary computed'
      )
    );
  }),

  // 2. List Resignations
  list: asyncHandler(async (req, res) => {
    const filter = {};
    if (!isHrOrAdmin(req.user)) {
      filter.user = req.user.userId;
    } else if (req.query.user) {
      filter.user = req.query.user;
    }

    if (req.query.status && req.query.status !== 'All') {
      filter.status = req.query.status;
    }

    let resignations = await Resignation.find(filter)
      .populate('user', 'firstName lastName email department designation personalInfo jobDetails employmentStatus')
      .populate('reviewedBy', 'firstName lastName email')
      .populate('exitCompletedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    if (req.query.department && req.query.department !== 'All') {
      resignations = resignations.filter((r) => {
        const d = r.user?.jobDetails?.department || r.user?.department;
        return d === req.query.department;
      });
    }

    if (req.query.search) {
      const q = req.query.search.toLowerCase();
      resignations = resignations.filter((r) => {
        const name = (r.user?.personalInfo?.fullName || `${r.user?.firstName || ''} ${r.user?.lastName || ''}`).toLowerCase();
        const email = (r.user?.email || '').toLowerCase();
        const empId = (r.user?.jobDetails?.employeeId || '').toLowerCase();
        return name.includes(q) || email.includes(q) || empId.includes(q);
      });
    }

    res.json(successResponse(resignations, 'Resignation records retrieved'));
  }),

  // 3. Employee Submits Resignation
  create: asyncHandler(async (req, res) => {
    const targetUserId = req.body.userId && isHrOrAdmin(req.user) ? req.body.userId : req.user.userId;
    const { resignationDate, proposedLastWorkingDay, reason, employeeComments } = req.body;

    if (!proposedLastWorkingDay || !reason) {
      throw createValidationError('Proposed last working day and reason are required');
    }

    const regDate = resignationDate ? new Date(resignationDate) : new Date();
    const lwdDate = new Date(proposedLastWorkingDay);

    if (lwdDate < regDate) {
      throw createValidationError('Proposed last working day cannot be earlier than resignation date');
    }

    // Check for existing active resignation
    const existingActive = await Resignation.findOne({
      user: targetUserId,
      status: { $nin: ['Rejected', 'Completed'] },
    });

    if (existingActive) {
      throw createValidationError(
        `An active resignation request (${existingActive.status}) is already submitted.`
      );
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) throw createNotFoundError('Employee not found');

    const diffMs = lwdDate.getTime() - regDate.getTime();
    const noticeDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    const actorName = [targetUser.firstName, targetUser.lastName].filter(Boolean).join(' ') || targetUser.email;

    const resignation = await Resignation.create({
      user: targetUserId,
      resignationDate: regDate,
      proposedLastWorkingDay: lwdDate,
      approvedLastWorkingDay: lwdDate,
      noticePeriodDays: noticeDays,
      reason: reason.trim(),
      employeeComments: employeeComments ? employeeComments.trim() : '',
      status: 'Submitted',
    });

    // Notify HR
    const hrUsers = await User.find({ department: 'HR', role: 'employee' }).select('_id');
    for (const hr of hrUsers) {
      await createSystemNotification(
        hr._id,
        'New Resignation Request',
        `${actorName} has submitted a resignation request.`,
        'Warning'
      );
    }

    const populated = await Resignation.findById(resignation._id).populate(
      'user',
      'firstName lastName email department designation personalInfo jobDetails'
    );

    res.status(201).json(createdResponse(populated, 'Resignation submitted successfully'));
  }),

  // 4. Get Single Resignation
  get: asyncHandler(async (req, res) => {
    const record = await Resignation.findById(req.params.id)
      .populate('user', 'firstName lastName email department designation personalInfo jobDetails employmentStatus createdAt')
      .populate('reviewedBy', 'firstName lastName email department')
      .populate('exitCompletedBy', 'firstName lastName email department');

    if (!record) throw createNotFoundError('Resignation record not found');

    if (!isHrOrAdmin(req.user) && String(record.user._id) !== String(req.user.userId)) {
      throw createForbiddenError('Access denied');
    }

    res.json(successResponse(record, 'Resignation details retrieved'));
  }),

  // 5. HR Review
  review: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const record = await Resignation.findById(req.params.id);
    if (!record) throw createNotFoundError('Resignation record not found');

    if (['Rejected', 'Completed'].includes(record.status)) {
      throw createValidationError(`Cannot review a resignation that is already ${record.status}`);
    }

    const { hrRemarks } = req.body;
    record.status = 'Under Review';
    record.reviewedBy = req.user.userId;
    record.reviewDate = new Date();
    if (hrRemarks) record.hrRemarks = hrRemarks.trim();

    await record.save();
    res.json(successResponse(record, 'Resignation marked as Under Review'));
  }),

  // 6. HR Approve
  approve: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const record = await Resignation.findById(req.params.id);
    if (!record) throw createNotFoundError('Resignation record not found');

    if (record.status === 'Rejected') {
      throw createValidationError('Cannot approve a rejected resignation');
    }

    const { approvedLastWorkingDay, noticePeriodDays, hrRemarks } = req.body;

    if (approvedLastWorkingDay) {
      record.approvedLastWorkingDay = new Date(approvedLastWorkingDay);
    } else if (!record.approvedLastWorkingDay) {
      record.approvedLastWorkingDay = record.proposedLastWorkingDay;
    }

    if (noticePeriodDays !== undefined) {
      record.noticePeriodDays = Number(noticePeriodDays);
    }

    record.status = 'Notice Period';
    record.reviewedBy = req.user.userId;
    record.reviewDate = new Date();
    if (hrRemarks) record.hrRemarks = hrRemarks.trim();

    await record.save();

    // Update User employment status
    await User.findByIdAndUpdate(record.user, { employmentStatus: 'Notice Period' });

    // Notify employee
    await createSystemNotification(
      record.user,
      'Resignation Approved',
      `Your resignation has been approved. Your official Last Working Day is ${new Date(record.approvedLastWorkingDay).toLocaleDateString()}.`,
      'Success'
    );

    res.json(successResponse(record, 'Resignation approved and Notice Period started'));
  }),

  // 7. HR Reject
  reject: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const record = await Resignation.findById(req.params.id);
    if (!record) throw createNotFoundError('Resignation record not found');

    if (record.status === 'Completed') {
      throw createValidationError('Cannot reject an exit that is already completed');
    }

    const { rejectionReason } = req.body;
    if (!rejectionReason) throw createValidationError('Rejection reason is required');

    record.status = 'Rejected';
    record.rejectionReason = rejectionReason.trim();
    record.reviewedBy = req.user.userId;
    record.reviewDate = new Date();

    await record.save();

    // Revert user employment status to Active
    await User.findByIdAndUpdate(record.user, { employmentStatus: 'Active' });

    // Notify employee
    await createSystemNotification(
      record.user,
      'Resignation Request Update',
      `Your resignation request was rejected. Reason: ${rejectionReason.trim()}`,
      'Error'
    );

    res.json(successResponse(record, 'Resignation rejected'));
  }),

  // 8. Update Notice Period / Change LWD
  updateNoticePeriod: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const record = await Resignation.findById(req.params.id);
    if (!record) throw createNotFoundError('Resignation record not found');

    const { approvedLastWorkingDay, noticePeriodDays } = req.body;

    if (approvedLastWorkingDay) record.approvedLastWorkingDay = new Date(approvedLastWorkingDay);
    if (noticePeriodDays !== undefined) record.noticePeriodDays = Number(noticePeriodDays);

    await record.save();
    res.json(successResponse(record, 'Last Working Day updated'));
  }),

  // 9. Update Clearance Item
  updateClearance: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const record = await Resignation.findById(req.params.id);
    if (!record) throw createNotFoundError('Resignation record not found');

    const { departmentKey, status, remarks, settlementAmount, settlementStatus } = req.body;

    if (!['hr', 'manager', 'finance', 'itAssets', 'knowledgeTransfer'].includes(departmentKey)) {
      throw createValidationError('Invalid clearance department key');
    }

    const hrName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || 'HR Team';

    if (!record.clearance[departmentKey]) {
      record.clearance[departmentKey] = { status: 'Pending' };
    }

    record.clearance[departmentKey].status = status || record.clearance[departmentKey].status;
    record.clearance[departmentKey].completedBy = hrName;
    record.clearance[departmentKey].completedDate = status === 'Completed' ? new Date() : null;
    if (remarks !== undefined) record.clearance[departmentKey].remarks = remarks;
    if (settlementAmount !== undefined) record.clearance[departmentKey].settlementAmount = Number(settlementAmount);
    if (settlementStatus !== undefined) record.clearance[departmentKey].settlementStatus = settlementStatus;

    if (record.status === 'Approved' || record.status === 'Notice Period') {
      record.status = 'Exit Clearance';
    }

    await record.save();
    res.json(successResponse(record, `${departmentKey} clearance updated`));
  }),

  // 10. Record Exit Interview
  submitExitInterview: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const record = await Resignation.findById(req.params.id);
    if (!record) throw createNotFoundError('Resignation record not found');

    const { reasonForLeaving, managementFeedback, suggestions, rehireEligibility, hrComments } = req.body;

    record.exitInterview = {
      reasonForLeaving: reasonForLeaving || '',
      managementFeedback: managementFeedback || '',
      suggestions: suggestions || '',
      rehireEligibility: rehireEligibility === 'Not Eligible' ? 'Not Eligible' : 'Eligible',
      hrComments: hrComments || '',
      submittedAt: new Date(),
    };

    await record.save();
    res.json(successResponse(record, 'Exit interview saved'));
  }),

  // 11. Complete Exit
  completeExit: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const record = await Resignation.findById(req.params.id);
    if (!record) throw createNotFoundError('Resignation record not found');

    if (record.status === 'Completed') {
      throw createValidationError('Exit is already completed for this employee');
    }

    record.status = 'Completed';
    record.exitCompletedAt = new Date();
    record.exitCompletedBy = req.user.userId;

    await record.save();

    // Mark Employee in users collection as Exited WITHOUT deleting
    await User.findByIdAndUpdate(record.user, {
      employmentStatus: 'Exited',
      isActive: false,
      exitDate: new Date(),
    });

    // Notify employee
    await createSystemNotification(
      record.user,
      'Exit Formalities Completed',
      'Your exit formalities and final settlement have been successfully finalized. All the best for your future endeavors!',
      'Success'
    );

    res.json(successResponse(record, 'Employee exit completed successfully'));
  }),

  // 12. Terminate Employee
  terminateEmployee: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const { userId, effectiveDate, terminationReason, comments } = req.body;

    if (!userId || !terminationReason) {
      throw createValidationError('Employee selection and termination reason are required');
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) throw createNotFoundError('Employee not found');

    const termDate = effectiveDate ? new Date(effectiveDate) : new Date();

    // Update User record in MongoDB users collection
    targetUser.employmentStatus = 'Terminated';
    targetUser.isActive = false;
    targetUser.exitDate = termDate;
    targetUser.terminationReason = terminationReason.trim();
    targetUser.terminationDate = termDate;
    targetUser.terminationComments = comments ? comments.trim() : '';
    await targetUser.save();

    // Check if there is an active resignation record and update it
    const activeResignation = await Resignation.findOne({
      user: userId,
      status: { $nin: ['Rejected', 'Completed'] },
    });

    if (activeResignation) {
      activeResignation.status = 'Completed';
      activeResignation.exitCompletedAt = termDate;
      activeResignation.exitCompletedBy = req.user.userId;
      activeResignation.hrRemarks = `Employee Terminated: ${terminationReason.trim()}`;
      await activeResignation.save();
    }

    // Notify employee
    await createSystemNotification(
      userId,
      'Employment Status Update',
      `Your employment has been terminated effective ${termDate.toLocaleDateString()}. Reason: ${terminationReason.trim()}`,
      'Warning'
    );

    res.json(successResponse(targetUser, 'Employee terminated successfully. Historical records preserved.'));
  }),
};
