import mongoose from 'mongoose';
import ExperienceLetter from '../models/ExperienceLetter.js';
import User from '../models/User.js';
import Resignation from '../models/Resignation.js';
import CompanySetting from '../models/CompanySetting.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createdResponse, successResponse } from '../utils/apiResponse.js';
import { createForbiddenError, createNotFoundError, createValidationError } from '../utils/apiError.js';
import { logger } from '../utils/logger.js';

const isHrOrAdmin = (user) =>
  ['admin', 'super_admin'].includes(user?.role) || user?.department === 'HR';

const generateLetterNumber = () => `EXP-${Math.floor(10000 + Math.random() * 90000)}`;

const performerName = (user) => {
  if (!user) return 'System';
  if (user.firstName || user.lastName) return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return user.email || 'HR';
};

const computeDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return '';
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '';

  let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (e.getDate() < s.getDate()) {
    months -= 1;
  }
  if (months < 0) months = 0;

  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  const parts = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'Year' : 'Years'}`);
  if (remMonths > 0 || years === 0) parts.push(`${remMonths} ${remMonths === 1 ? 'Month' : 'Months'}`);
  return parts.join(', ');
};

export const ExperienceLetterController = {
  // GET /recruitment/experience-letters/summary
  summary: asyncHandler(async (_req, res) => {
    const [total, issued, draft, revoked] = await Promise.all([
      ExperienceLetter.countDocuments({ isDeleted: false }),
      ExperienceLetter.countDocuments({ isDeleted: false, status: 'Issued' }),
      ExperienceLetter.countDocuments({ isDeleted: false, status: 'Draft' }),
      ExperienceLetter.countDocuments({ isDeleted: false, status: 'Revoked' }),
    ]);

    res.json(
      successResponse(
        { total, issued, draft, revoked },
        'Experience letter summary retrieved successfully'
      )
    );
  }),

  // GET /recruitment/experience-letters
  listLetters: asyncHandler(async (req, res) => {
    const filter = { isDeleted: false };
    if (req.query.status && req.query.status !== 'All') {
      filter.status = req.query.status;
    }
    if (req.query.department && req.query.department !== 'All') {
      filter.department = req.query.department;
    }
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { letterNumber: regex },
        { employeeName: regex },
        { employeeId: regex },
        { designation: regex },
        { department: regex },
      ];
    }

    const sort = req.query.sort === 'oldest' ? { letterDate: 1 } : { letterDate: -1 };

    const letters = await ExperienceLetter.find(filter)
      .populate('employee', 'firstName lastName email department designation jobDetails employmentStatus exitDate')
      .populate('createdBy', 'firstName lastName email')
      .sort(sort)
      .lean();

    res.json(successResponse(letters, 'Experience letters retrieved successfully'));
  }),

  // GET /recruitment/experience-letters/employees
  // Real employee data from MongoDB Atlas with relieving/exit info
  getEmployees: asyncHandler(async (_req, res) => {
    const employees = await User.find({ role: 'employee' })
      .select('firstName lastName email department designation location employmentStatus exitDate jobDetails')
      .sort({ firstName: 1 })
      .lean();

    // Check for any resignations in database to auto-suggest approved exit dates
    const resignations = await Resignation.find({
      status: { $in: ['Approved', 'Notice Period', 'Exit Clearance', 'Completed'] },
    })
      .select('user approvedLastWorkingDay proposedLastWorkingDay reason')
      .lean();

    const resignationMap = new Map();
    resignations.forEach((r) => {
      if (r.user) {
        resignationMap.set(String(r.user), r);
      }
    });

    const enriched = employees.map((emp) => {
      const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email;
      const empCode = emp.jobDetails?.employeeId || '';
      const dept = emp.department || emp.jobDetails?.department || 'Tech';
      const desig = emp.designation || emp.jobDetails?.designation || 'Software Engineer';
      const joinDate = emp.jobDetails?.joiningDate || '';

      const resignation = resignationMap.get(String(emp._id));
      let relievingDate = emp.exitDate ? emp.exitDate.toISOString().slice(0, 10) : '';
      if (!relievingDate && resignation) {
        const lastDay = resignation.approvedLastWorkingDay || resignation.proposedLastWorkingDay;
        if (lastDay) relievingDate = new Date(lastDay).toISOString().slice(0, 10);
      }

      return {
        _id: emp._id,
        name: fullName,
        email: emp.email,
        employeeId: empCode,
        department: dept,
        designation: desig,
        joiningDate: joinDate,
        relievingDate,
        employmentStatus: emp.employmentStatus || 'Active',
        location: emp.location || '',
      };
    });

    res.json(successResponse(enriched, 'Employees retrieved successfully for experience letters'));
  }),

  // GET /recruitment/experience-letters/:id
  getLetter: asyncHandler(async (req, res) => {
    const letter = await ExperienceLetter.findOne({ _id: req.params.id, isDeleted: false })
      .populate('employee', 'firstName lastName email department designation jobDetails employmentStatus exitDate')
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .lean();

    if (!letter) throw createNotFoundError('Experience letter not found');
    res.json(successResponse(letter, 'Experience letter retrieved successfully'));
  }),

  // POST /recruitment/experience-letters
  createLetter: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const {
      employeeId,
      designation,
      department,
      joiningDate,
      relievingDate,
      employmentDuration,
      letterDate,
      workLocation,
      conduct,
      reasonForLeaving,
      authorizedSignatory,
      authorizedSignatoryTitle,
      notes,
      status,
    } = req.body;

    if (!employeeId) throw createValidationError('Employee selection is required');
    if (!designation) throw createValidationError('Designation is required');
    if (!department) throw createValidationError('Department is required');
    if (!joiningDate) throw createValidationError('Joining date is required');
    if (!relievingDate) throw createValidationError('Relieving date is required');

    const employee = await User.findById(employeeId);
    if (!employee) throw createNotFoundError('Employee not found in database');

    const empFullName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email;
    const empCode = employee.jobDetails?.employeeId || (req.body.empCode ? req.body.empCode.trim() : '');

    let uniqueLetterNumber = generateLetterNumber();
    while (await ExperienceLetter.exists({ letterNumber: uniqueLetterNumber })) {
      uniqueLetterNumber = generateLetterNumber();
    }

    const calculatedDuration = employmentDuration?.trim() || computeDuration(joiningDate, relievingDate);

    const letter = await ExperienceLetter.create({
      letterNumber: uniqueLetterNumber,
      employee: employee._id,
      employeeName: empFullName,
      employeeId: empCode,
      designation: designation.trim(),
      department: department.trim(),
      joiningDate: new Date(joiningDate),
      relievingDate: new Date(relievingDate),
      employmentDuration: calculatedDuration,
      letterDate: letterDate ? new Date(letterDate) : new Date(),
      workLocation: workLocation?.trim() || 'Head Office, Mumbai',
      conduct: conduct?.trim() || 'Exemplary',
      reasonForLeaving: reasonForLeaving?.trim() || 'Resignation / Personal Aspirations',
      authorizedSignatory: authorizedSignatory?.trim() || 'Human Resources Manager',
      authorizedSignatoryTitle: authorizedSignatoryTitle?.trim() || 'Head of Human Resources',
      notes: notes?.trim() || '',
      status: status || 'Issued',
      createdBy: req.user?.userId || null,
      history: [
        {
          action: 'Experience Letter Created',
          performedBy: req.user?.userId || null,
          performedByName: performerName(req.user),
          note: `Experience letter ${uniqueLetterNumber} issued for ${empFullName} (${designation.trim()})`,
          timestamp: new Date(),
        },
      ],
    });

    const populated = await ExperienceLetter.findById(letter._id)
      .populate('employee', 'firstName lastName email department designation jobDetails employmentStatus exitDate')
      .populate('createdBy', 'firstName lastName email')
      .lean();

    res.status(201).json(createdResponse(populated, 'Experience letter generated and saved successfully'));
  }),

  // PUT /recruitment/experience-letters/:id
  updateLetter: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const letter = await ExperienceLetter.findOne({ _id: req.params.id, isDeleted: false });
    if (!letter) throw createNotFoundError('Experience letter not found');

    const allowed = [
      'designation',
      'department',
      'joiningDate',
      'relievingDate',
      'employmentDuration',
      'letterDate',
      'workLocation',
      'conduct',
      'reasonForLeaving',
      'authorizedSignatory',
      'authorizedSignatoryTitle',
      'notes',
      'status',
    ];

    allowed.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (['joiningDate', 'relievingDate', 'letterDate'].includes(field)) {
          letter[field] = req.body[field] ? new Date(req.body[field]) : letter[field];
        } else {
          letter[field] = req.body[field];
        }
      }
    });

    if (req.body.joiningDate || req.body.relievingDate) {
      letter.employmentDuration = req.body.employmentDuration?.trim() ||
        computeDuration(letter.joiningDate, letter.relievingDate);
    }

    letter.updatedBy = req.user?.userId || null;
    letter.history.push({
      action: 'Experience Letter Updated',
      performedBy: req.user?.userId || null,
      performedByName: performerName(req.user),
      note: 'Letter details updated by HR',
      timestamp: new Date(),
    });

    await letter.save();

    const populated = await ExperienceLetter.findById(letter._id)
      .populate('employee', 'firstName lastName email department designation jobDetails employmentStatus exitDate')
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .lean();

    res.json(successResponse(populated, 'Experience letter updated successfully'));
  }),

  // DELETE /recruitment/experience-letters/:id
  deleteLetter: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Access denied');

    const letter = await ExperienceLetter.findOne({ _id: req.params.id, isDeleted: false });
    if (!letter) throw createNotFoundError('Experience letter not found');

    letter.isDeleted = true;
    letter.history.push({
      action: 'Experience Letter Deleted',
      performedBy: req.user?.userId || null,
      performedByName: performerName(req.user),
      note: 'Experience letter soft-deleted by HR',
      timestamp: new Date(),
    });
    await letter.save();

    res.json(successResponse({ id: req.params.id }, 'Experience letter deleted successfully'));
  }),
};

export default ExperienceLetterController;
