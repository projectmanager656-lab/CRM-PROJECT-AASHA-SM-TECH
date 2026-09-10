import mongoose from 'mongoose';
import Attendance from '../models/Attendance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import CompanySetting from '../models/CompanySetting.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { createForbiddenError, createNotFoundError, createValidationError } from '../utils/apiError.js';
import { createdResponse, successResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const isHrOrAdmin = (user) => ['admin', 'super_admin'].includes(user?.role) || String(user?.department || '').trim().toUpperCase() === 'HR';
const employeeScope = (user, field = 'user') => isHrOrAdmin(user) ? {} : { [field]: user.userId };
const owned = async (Model, id, user) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw createValidationError('Invalid record id');
  const record = await Model.findById(id);
  if (!record) throw createNotFoundError('Record not found');
  if (!isHrOrAdmin(user) && user.role === 'employee' && String(record.user) !== String(user.userId)) {
    throw createForbiddenError('Access denied');
  }
  return record;
};
const requestIp = (req) => String(req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || '').split(',')[0].trim().replace('::ffff:', '');
const distanceMeters = (a, b, c, d) => { const r = 6371000, p = Math.PI / 180, x = (c - a) * p, y = (d - b) * p; const q = Math.sin(x / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin(y / 2) ** 2; return 2 * r * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q)); };
const attendanceReferenceFields = ['user', 'employee', 'employeeId', 'userId', 'staffId'];
const referenceValue = (value) => {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return typeof value === 'string' || value instanceof mongoose.Types.ObjectId ? String(value) : '';
};
const validatePunch = async (req) => { const config = await CompanySetting.findOne({ key: 'company' }); const ip = requestIp(req); const latitude = Number(req.body.latitude), longitude = Number(req.body.longitude); if (config?.enableIpValidation && !config.allowedIpAddresses.includes(ip)) throw createForbiddenError('Attendance is only available from an allowed company network'); let location = { status: 'Not checked', timestamp: new Date() }; if (config?.enableGpsValidation) { if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw createValidationError('Location permission is required to punch attendance'); if (config.officeLatitude === null || config.officeLongitude === null) throw createValidationError('Office location has not been configured'); const metres = distanceMeters(latitude, longitude, config.officeLatitude, config.officeLongitude); if (metres > config.allowedGpsRadius) throw createForbiddenError(`You are outside the allowed office radius (${Math.round(metres)}m away)`); location = { latitude, longitude, status: 'Within allowed radius', timestamp: new Date() }; } else if (Number.isFinite(latitude) && Number.isFinite(longitude)) location = { latitude, longitude, status: 'Captured', timestamp: new Date() }; return { config, ip, location }; };

export const AttendanceController = {
  mark: asyncHandler(async (req, res) => {
    const canManual = isHrOrAdmin(req.user);
    if (canManual && req.body.manual) {
      const { user, employeeId, date, checkIn, checkOut, status, totalWorkingMinutes, notes } = req.body;
      const targetUser = user || employeeId;
      if (!targetUser || !date || !checkIn || !status) throw createValidationError('Missing fields for manual entry');
      if (!mongoose.Types.ObjectId.isValid(targetUser) || !await User.exists({ _id: targetUser })) throw createValidationError('Select a valid employee from the employee directory.');
      if (await Attendance.exists({ $or: [{ user: targetUser }, { employee: targetUser }], date })) throw createValidationError('Attendance already exists for this employee on this date.');
      if (checkIn && checkOut && new Date(checkOut) < new Date(checkIn)) throw createValidationError('Check-out cannot be earlier than check-in');
      const record = await Attendance.create({ user: targetUser, date, checkIn, checkOut, status, totalWorkingMinutes: totalWorkingMinutes || 0, requiredWorkingMinutes: 480, notes: notes || '' });
      const populatedRecord = await Attendance.findById(record._id).populate('user', 'firstName lastName email department personalInfo jobDetails');
      return res.status(201).json(createdResponse(populatedRecord, 'Manual attendance created'));
    }
    const date = new Date().toISOString().slice(0, 10);
    if (await Attendance.exists({ user: req.user.userId, date })) throw createValidationError('Attendance already marked for today');
    const { config, ip, location } = await validatePunch(req);
    const record = await Attendance.create({ user: req.user.userId, date, checkIn: new Date(), notes: req.body.notes || '', checkInIp: ip, checkInLocation: location, checkInPhoto: config?.enableAttendancePhoto ? String(req.body.photo || '') : '', requiredWorkingMinutes: Math.round((config?.requiredWorkingHours || 8) * 60) });
    res.status(201).json(createdResponse(record, 'Punched in successfully'));
  }),
  list: asyncHandler(async (req, res) => {
    const filter = employeeScope(req.user);
    if (req.query.date) filter.date = req.query.date;
    if (req.query.month) filter.date = { $regex: `^${String(req.query.month).replace(/[^0-9-]/g, '')}` };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.user) {
      filter.$or = [{ user: req.query.user }, { employee: req.query.user }, { employeeId: req.query.user }, { userId: req.query.user }, { staffId: req.query.user }];
    }

    // `user` is the current schema relationship. The other fields are read-only
    // compatibility paths for attendance documents written before it was standardized.
    const rawRecords = await Attendance.find(filter).setOptions({ strict: false, strictQuery: false }).lean().sort({ date: -1 });
    const referenceIds = new Set();
    const employeeCodes = new Set();

    rawRecords.forEach((record) => {
      attendanceReferenceFields.forEach((field) => {
        const value = referenceValue(record[field]);
        if (!value) return;
        if (mongoose.Types.ObjectId.isValid(value)) referenceIds.add(value);
        else employeeCodes.add(value);
      });
    });

    const userQuery = [];
    if (referenceIds.size) userQuery.push({ _id: { $in: Array.from(referenceIds) } });
    if (employeeCodes.size) userQuery.push({ 'jobDetails.employeeId': { $in: Array.from(employeeCodes) } });
    const usersList = userQuery.length ? await User.find({ $or: userQuery }).lean() : [];
    const profilesByReference = new Map();
    const buildProfile = (user) => {
      const fullName = user.personalInfo?.fullName || '';
      const firstName = user.firstName || fullName.split(' ')[0] || '';
      const lastName = user.lastName || fullName.split(' ').slice(1).join(' ') || '';
      const name = `${firstName} ${lastName}`.trim() || fullName || user.email?.split('@')[0] || 'Employee';
      return { _id: user._id, id: user._id, firstName, lastName, name, email: user.email || user.personalInfo?.email || '', department: user.department || user.jobDetails?.department || '', role: user.role || 'employee', profilePhoto: user.personalInfo?.profilePhoto || '' };
    };

    usersList.forEach((user) => {
      const profile = buildProfile(user);
      profilesByReference.set(String(user._id), profile);
      if (user.jobDetails?.employeeId) profilesByReference.set(String(user.jobDetails.employeeId), profile);
    });

    const processedRecords = rawRecords.map((record) => {
      const references = attendanceReferenceFields.map((field) => ({ field, raw: record[field], value: referenceValue(record[field]) })).filter(({ value }) => value);
      let employee = references.map(({ value }) => profilesByReference.get(value)).find(Boolean) || null;

      // Preserve an embedded historical profile only when no MongoDB User reference resolves.
      if (!employee) {
        const embedded = references.map(({ raw }) => raw).find((value) => value && typeof value === 'object' && (value.firstName || value.name || value.email || value.personalInfo?.fullName));
        if (embedded) employee = buildProfile(embedded);
      }

      const reference = references[0]?.value || '';
      if (!employee && reference) console.warn(`[Attendance Warning] Attendance record ${record._id} has no matching User for references: ${references.map(({ value }) => value).join(', ')}`);
      return {
        ...record,
        user: employee,
        employee,
        employeeId: employee?._id || reference,
        employeeName: employee?.name || 'Unknown Employee',
        isOrphaned: !employee && references.length > 0,
      };
    });

    res.json(successResponse(processedRecords, 'Attendance history retrieved'));
  }),
  get: asyncHandler(async (req, res) => res.json(successResponse(await owned(Attendance, req.params.id, req.user), 'Attendance retrieved'))),
  checkout: asyncHandler(async (req, res) => {
    const record = await owned(Attendance, req.params.id, req.user);
    if (record.checkOut) throw createValidationError('Attendance already checked out');
    const { config, ip, location } = await validatePunch(req);
    record.checkOut = new Date();
    record.checkOutIp = ip;
    record.checkOutLocation = location;
    record.checkOutPhoto = config?.enableAttendancePhoto ? String(req.body.photo || '') : '';
    record.totalWorkingMinutes = Math.max(0, Math.round((record.checkOut - record.checkIn) / 60000));
    record.requiredWorkingMinutes = Math.round((config?.requiredWorkingHours || 8) * 60);
    record.status = record.totalWorkingMinutes >= record.requiredWorkingMinutes ? 'Present' : record.totalWorkingMinutes >= record.requiredWorkingMinutes / 2 ? 'Half Day' : 'Absent';
    await record.save();
    res.json(successResponse(record, 'Punched out successfully'));
  }),
  update: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Only HR and administrators can edit attendance records');
    const record = await Attendance.findById(req.params.id);
    if (!record) throw createNotFoundError('Attendance record not found');
    const { checkIn, checkOut, status, notes } = req.body;
    if (checkIn && checkOut && new Date(checkOut) < new Date(checkIn)) throw createValidationError('Check-out cannot be earlier than check-in');
    if (checkIn) record.checkIn = checkIn;
    if (checkOut !== undefined) record.checkOut = checkOut;
    if (status) record.status = status;
    if (notes !== undefined) record.notes = notes;
    if (record.checkIn && record.checkOut) record.totalWorkingMinutes = Math.max(0, Math.round((new Date(record.checkOut) - new Date(record.checkIn)) / 60000));
    await record.save();
    res.json(successResponse(record, 'Attendance updated successfully'));
  }),
  delete: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Only HR and administrators can delete attendance records');
    const record = await Attendance.findByIdAndDelete(req.params.id);
    if (!record) throw createNotFoundError('Attendance record not found');
    res.json(successResponse(null, 'Attendance deleted successfully'));
  }),
};

export const LeaveController = {
  create: asyncHandler(async (req, res) => {
    const canAssignOthers = isHrOrAdmin(req.user);
    const { type, startDate, endDate, reason, status, reviewNote } = req.body;
    const targetUser = (canAssignOthers && req.body.user) ? req.body.user : req.user.userId;
    if (!type || !startDate || !endDate || !reason) throw createValidationError('Type, dates, and reason are required');
    if (new Date(endDate) < new Date(startDate)) throw createValidationError('End date must be on or after start date');
    const initialStatus = canAssignOthers && status ? status : 'Pending';
    const record = await LeaveRequest.create({
      user: targetUser,
      type,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason: String(reason).trim(),
      status: initialStatus,
      reviewNote: canAssignOthers && reviewNote ? String(reviewNote).trim() : '',
      reviewedBy: canAssignOthers && initialStatus !== 'Pending' ? req.user.userId : null,
      reviewedAt: canAssignOthers && initialStatus !== 'Pending' ? new Date() : null,
    });
    const populated = await LeaveRequest.findById(record._id)
      .populate('user', 'firstName lastName email department designation jobDetails personalInfo')
      .populate('reviewedBy', 'firstName lastName email');
    res.status(201).json(createdResponse(populated, 'Leave request submitted'));
  }),
  list: asyncHandler(async (req, res) => {
    const filter = employeeScope(req.user);
    if (req.query.user) filter.user = req.query.user;
    if (req.query.status && req.query.status !== 'All') filter.status = req.query.status;
    if (req.query.type && req.query.type !== 'All') filter.type = req.query.type;
    const records = await LeaveRequest.find(filter)
      .populate('user', 'firstName lastName email department designation jobDetails personalInfo')
      .populate('reviewedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });
    res.json(successResponse(records, 'Leave requests retrieved'));
  }),
  get: asyncHandler(async (req, res) =>
    res.json(
      successResponse(
        await owned(LeaveRequest, req.params.id, req.user),
        'Leave request retrieved'
      )
    )
  ),
  review: asyncHandler(async (req, res) => {
    if (!isHrOrAdmin(req.user)) throw createForbiddenError('Only HR and administrators can review leave requests');
    if (!['Approved', 'Rejected', 'Pending'].includes(req.body.status)) throw createValidationError('Invalid leave status');
    const record = await LeaveRequest.findById(req.params.id);
    if (!record) throw createNotFoundError('Leave request not found');

    record.status = req.body.status;
    record.reviewedBy = req.user.userId;
    record.reviewedAt = new Date();

    if (req.body.status === 'Rejected') {
      const reason = req.body.rejectionReason || req.body.reviewNote || '';
      if (!reason.trim()) throw createValidationError('Rejection reason is required');
      record.rejectionReason = reason.trim();
      record.reviewNote = reason.trim();
    } else if (req.body.status === 'Approved') {
      record.reviewNote = (req.body.reviewNote || req.body.approvalNote || '').trim();
      record.rejectionReason = '';
    } else {
      record.reviewNote = (req.body.reviewNote || '').trim();
    }

    await record.save();

    if (['Approved', 'Rejected'].includes(record.status)) {
      const from = record.startDate.toISOString().slice(0, 10), to = record.endDate.toISOString().slice(0, 10);
      const notePart = record.reviewNote ? ` Reason/Note: ${record.reviewNote}` : '';
      await Notification.create({
        recipient: record.user,
        title: `Leave request ${record.status.toLowerCase()}`,
        message: `Your ${record.type} leave request from ${from} to ${to} has been ${record.status.toLowerCase()}.${notePart}`,
        type: record.status === 'Approved' ? 'Success' : 'Warning'
      });
    }

    const populated = await LeaveRequest.findById(record._id)
      .populate('user', 'firstName lastName email department designation jobDetails personalInfo')
      .populate('reviewedBy', 'firstName lastName email');
    res.json(successResponse(populated, `Leave request ${record.status.toLowerCase()} successfully`));
  }),
  update: asyncHandler(async (req, res) => {
    const record = await LeaveRequest.findById(req.params.id);
    if (!record) throw createNotFoundError('Leave request not found');

    const canEditOthers = isHrOrAdmin(req.user);
    if (!canEditOthers && String(record.user) !== String(req.user.userId)) {
      throw createForbiddenError('You can only edit your own leave requests');
    }

    const { type, startDate, endDate, reason } = req.body;
    if (type) record.type = type;
    if (startDate) record.startDate = new Date(startDate);
    if (endDate) record.endDate = new Date(endDate);
    if (reason) record.reason = String(reason).trim();

    if (new Date(record.endDate) < new Date(record.startDate)) {
      throw createValidationError('End date must be on or after start date');
    }

    await record.save();

    const populated = await LeaveRequest.findById(record._id)
      .populate('user', 'firstName lastName email department designation jobDetails personalInfo')
      .populate('reviewedBy', 'firstName lastName email');

    res.json(successResponse(populated, 'Leave request updated successfully'));
  }),
};
