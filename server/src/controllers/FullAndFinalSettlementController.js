import mongoose from 'mongoose';
import FullAndFinalSettlement from '../models/FullAndFinalSettlement.js';
import User from '../models/User.js';
import Resignation from '../models/Resignation.js';
import Payment from '../models/Payment.js';
import { createForbiddenError, createNotFoundError, createValidationError } from '../utils/apiError.js';
import { createdResponse, successResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  SETTLEMENT_STATUSES,
  appendHistory,
  calculateEmployeeFigures,
  employeeName,
  getEligibleEmployees,
  getSettlementById,
  toEmployeeSnapshot,
} from '../services/FullAndFinalSettlementService.js';

const isHrOrAdmin = (user) => ['admin', 'super_admin'].includes(user?.role)
  || String(user?.department || user?.jobDetails?.department || '').trim().toUpperCase() === 'HR';

const cleanNumber = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw createValidationError('Settlement amounts must be non-negative numbers');
  return Math.round(number * 100) / 100;
};

const amountKeys = {
  earnings: ['pendingSalary', 'salaryForWorkedDays', 'leaveEncashment', 'bonusIncentives', 'pendingReimbursements', 'otherEarnings'],
  deductions: ['loansAdvancesRecovery', 'noticePeriodRecovery', 'assetRecovery', 'otherDeductions', 'otherAdjustments'],
};

const pickAmounts = (source, type) => {
  if (!source) return undefined;
  const result = {};
  amountKeys[type].forEach((key) => {
    if (source[key] !== undefined) result[key] = cleanNumber(source[key]);
  });
  return result;
};

const actor = (req) => ({ userId: req.user.userId, email: req.user.email, name: req.user.name });

const loadRecord = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw createValidationError('Invalid settlement ID');
  const record = await FullAndFinalSettlement.findById(id);
  if (!record) throw createNotFoundError('Settlement record not found');
  return record;
};

const populatedResponse = async (res, record, message) => res.json(successResponse(await getSettlementById(record._id), message));

const assertTransition = (record, allowed, action) => {
  if (!allowed.includes(record.status)) throw createValidationError(`Cannot ${action} a settlement in ${record.status} status`);
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

export const FullAndFinalSettlementController = {
  summary: asyncHandler(async (_req, res) => {
    const [rows, totalEmployees] = await Promise.all([
      FullAndFinalSettlement.find().select('status netPayable').lean(),
      User.countDocuments({ role: 'employee' }),
    ]);
    const counts = Object.fromEntries(SETTLEMENT_STATUSES.map((status) => [status, 0]));
    let totalNetPayable = 0;
    rows.forEach((row) => {
      counts[row.status] = (counts[row.status] || 0) + 1;
      totalNetPayable += Number(row.netPayable) || 0;
    });
    res.json(successResponse({
      pendingSettlements: counts.Pending || 0,
      inProgress: (counts['In Progress'] || 0) + (counts['Calculation Pending'] || 0) + (counts['Clearance Pending'] || 0),
      approvalPending: counts['Approval Pending'] || 0,
      completed: counts.Completed || 0,
      totalNetPayable: Math.round(totalNetPayable * 100) / 100,
      totalSettlements: rows.length,
      totalEmployees,
      byStatus: counts,
    }, 'Full and final settlement summary retrieved'));
  }),

  eligibleEmployees: asyncHandler(async (_req, res) => {
    res.json(successResponse(await getEligibleEmployees(), 'Eligible employees retrieved'));
  }),

  list: asyncHandler(async (req, res) => {
    const { search, department, status, dateFrom, dateTo, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (!isHrOrAdmin(req.user)) filter.user = req.user.userId;
    if (status && status !== 'All') filter.status = status;
    if (dateFrom || dateTo) {
      filter.lastWorkingDay = {};
      if (dateFrom) filter.lastWorkingDay.$gte = new Date(dateFrom);
      if (dateTo) filter.lastWorkingDay.$lte = new Date(dateTo);
    }

    if ((search && search.trim()) || (department && department !== 'All')) {
      const userFilter = { role: 'employee', $and: [] };
      if (department && department !== 'All') {
        userFilter.$and.push({ $or: [{ department }, { 'jobDetails.department': department }] });
      }
      if (search && search.trim()) {
        const expression = { $regex: search.trim(), $options: 'i' };
        userFilter.$and.push({ $or: [
          { firstName: expression }, { lastName: expression }, { email: expression },
          { 'personalInfo.fullName': expression }, { 'jobDetails.employeeId': expression },
        ] });
      }
      const matchingUsers = await User.find(userFilter).select('_id').lean();
      filter.user = { $in: matchingUsers.map((user) => user._id) };
    }

    const pageNumber = Math.max(1, Number(page));
    const limitNumber = Math.min(100, Math.max(1, Number(limit)));
    const [total, settlements] = await Promise.all([
      FullAndFinalSettlement.countDocuments(filter),
      FullAndFinalSettlement.find(filter)
        .populate('user', 'firstName lastName email department designation jobDetails personalInfo employmentStatus exitDate')
        .populate('resignation', 'status resignationDate proposedLastWorkingDay approvedLastWorkingDay noticePeriodDays')
        .sort({ lastWorkingDay: -1, createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .lean(),
    ]);
    res.json(successResponse({ settlements, pagination: { total, page: pageNumber, limit: limitNumber, totalPages: Math.ceil(total / limitNumber) || 1 } }, 'Settlement records retrieved'));
  }),

  get: asyncHandler(async (req, res) => {
    const record = await getSettlementById(req.params.id);
    if (!record) throw createNotFoundError('Settlement record not found');
    if (!isHrOrAdmin(req.user) && String(record.user?._id) !== String(req.user.userId)) throw createForbiddenError('Access denied');
    res.json(successResponse(record, 'Settlement record retrieved'));
  }),

  create: asyncHandler(async (req, res) => {
    const { userId, lastWorkingDay, earnings, deductions } = req.body;
    if (!mongoose.Types.ObjectId.isValid(userId)) throw createValidationError('A valid exited employee is required');
    const user = await User.findOne({ _id: userId, role: 'employee' });
    if (!user) throw createNotFoundError('Employee not found');
    const resignation = await Resignation.findOne({
      user: user._id,
      status: { $in: ['Approved', 'Notice Period', 'Exit Clearance', 'Completed'] },
    }).sort({ updatedAt: -1 });
    const workingDay = lastWorkingDay ? new Date(lastWorkingDay) : (resignation?.approvedLastWorkingDay || resignation?.proposedLastWorkingDay || user.exitDate || new Date());
    if (!workingDay || Number.isNaN(workingDay.getTime())) throw createValidationError('Last working day is required');
    const active = await FullAndFinalSettlement.findOne({ user: user._id, status: { $nin: ['Completed', 'Rejected'] } });
    if (active) throw createValidationError(`An active settlement (${active.status}) already exists for this employee`);
    const figures = await calculateEmployeeFigures(user, workingDay, { earnings: pickAmounts(earnings, 'earnings'), deductions: pickAmounts(deductions, 'deductions') });
    const record = new FullAndFinalSettlement({
      user: user._id,
      resignation: resignation?._id || null,
      employeeSnapshot: toEmployeeSnapshot(user, user.exitDate || resignation?.approvedLastWorkingDay || null, workingDay),
      lastWorkingDay: workingDay,
      exitDate: user.exitDate || resignation?.approvedLastWorkingDay || null,
      status: 'In Progress',
      ...figures,
      createdBy: req.user.userId,
      updatedBy: req.user.userId,
    });
    appendHistory(record, 'Created', actor(req), 'Settlement initiated');
    await record.save();
    await populatedResponse(res, record, 'Settlement initiated successfully');
  }),

  update: asyncHandler(async (req, res) => {
    const record = await loadRecord(req.params.id);
    assertTransition(record, ['Pending', 'In Progress', 'Calculation Pending', 'On Hold', 'Rejected'], 'update');
    const workingDay = req.body.lastWorkingDay ? new Date(req.body.lastWorkingDay) : record.lastWorkingDay;
    if (Number.isNaN(workingDay.getTime())) throw createValidationError('Invalid last working day');
    const user = await User.findById(record.user);
    if (!user) throw createNotFoundError('Settlement employee no longer exists');
    const figures = await calculateEmployeeFigures(user, workingDay, {
      earnings: pickAmounts(req.body.earnings, 'earnings') || record.earnings.toObject(),
      deductions: pickAmounts(req.body.deductions, 'deductions') || record.deductions.toObject(),
    });
    record.lastWorkingDay = workingDay;
    Object.assign(record, figures, { updatedBy: req.user.userId });
    appendHistory(record, 'Updated', actor(req), 'Settlement values updated');
    await record.save();
    await populatedResponse(res, record, 'Settlement updated successfully');
  }),

  calculate: asyncHandler(async (req, res) => {
    const record = await loadRecord(req.params.id);
    assertTransition(record, ['Pending', 'In Progress', 'Calculation Pending', 'On Hold', 'Rejected'], 'calculate');
    const user = await User.findById(record.user);
    if (!user) throw createNotFoundError('Settlement employee no longer exists');
    const figures = await calculateEmployeeFigures(user, record.lastWorkingDay);
    Object.assign(record, figures, { status: 'Calculation Pending', calculatedAt: new Date(), updatedBy: req.user.userId });
    appendHistory(record, 'Calculated', actor(req), 'Settlement recalculated from current HR records');
    await record.save();
    await populatedResponse(res, record, 'Settlement recalculated successfully');
  }),

  submit: asyncHandler(async (req, res) => {
    const record = await loadRecord(req.params.id);
    assertTransition(record, ['In Progress', 'Calculation Pending', 'On Hold', 'Rejected'], 'submit for approval');
    record.status = 'Approval Pending'; record.submittedAt = new Date(); record.updatedBy = req.user.userId;
    appendHistory(record, 'Submitted', actor(req), 'Submitted for approval');
    await record.save();
    await populatedResponse(res, record, 'Settlement submitted for approval');
  }),

  approve: asyncHandler(async (req, res) => {
    const record = await loadRecord(req.params.id);
    assertTransition(record, ['Approval Pending'], 'approve');
    record.status = 'Approved'; record.approval.approvedBy = req.user.userId; record.approval.approvedAt = new Date(); record.updatedBy = req.user.userId;
    appendHistory(record, 'Approved', actor(req), req.body.note || 'Settlement approved');
    await record.save();
    await populatedResponse(res, record, 'Settlement approved');
  }),

  reject: asyncHandler(async (req, res) => {
    const record = await loadRecord(req.params.id);
    assertTransition(record, ['Approval Pending'], 'reject');
    const reason = String(req.body.reason || '').trim();
    if (!reason) throw createValidationError('A rejection reason is required');
    record.status = 'Rejected'; record.approval.rejectedBy = req.user.userId; record.approval.rejectedAt = new Date(); record.approval.rejectionReason = reason; record.updatedBy = req.user.userId;
    appendHistory(record, 'Rejected', actor(req), reason);
    await record.save();
    await populatedResponse(res, record, 'Settlement rejected');
  }),

  hold: asyncHandler(async (req, res) => {
    const record = await loadRecord(req.params.id);
    assertTransition(record, ['Pending', 'In Progress', 'Clearance Pending', 'Calculation Pending', 'Approval Pending', 'Approved'], 'put on hold');
    record.status = 'On Hold'; record.updatedBy = req.user.userId;
    appendHistory(record, 'Put On Hold', actor(req), req.body.note || 'Settlement placed on hold');
    await record.save();
    await populatedResponse(res, record, 'Settlement placed on hold');
  }),

  processPayment: asyncHandler(async (req, res) => {
    const record = await loadRecord(req.params.id);
    assertTransition(record, ['Approved'], 'process payment');
    record.status = 'Payment Processing'; record.payment.processedBy = req.user.userId; record.payment.processedAt = new Date(); record.payment.paymentMethod = String(req.body.paymentMethod || record.payment.paymentMethod || ''); record.updatedBy = req.user.userId;
    appendHistory(record, 'Payment updated', actor(req), 'Payment processing started');
    await record.save();
    await populatedResponse(res, record, 'Payment processing started');
  }),

  markPaid: asyncHandler(async (req, res) => {
    const record = await loadRecord(req.params.id);
    assertTransition(record, ['Payment Processing'], 'mark as paid');
    record.status = 'Paid'; record.payment.paidBy = req.user.userId; record.payment.paidAt = new Date(); record.payment.paymentDate = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date(); record.payment.paymentReference = String(req.body.paymentReference || ''); record.updatedBy = req.user.userId;
    appendHistory(record, 'Payment updated', actor(req), 'Payment marked as paid');
    await record.save();

    // Persist Payment transaction in payments collection (with duplicate prevention)
    try {
      const existingPayment = await Payment.findOne({ settlement: record._id });
      if (!existingPayment) {
        const paymentNum = `PAY-${Date.now().toString().slice(-8)}`;
        const empName = employeeName(record.user) || record.employeeSnapshot?.name || '';
        await Payment.create({
          paymentNumber: paymentNum,
          settlement: record._id,
          employee: record.user?._id || record.user,
          employeeName: empName,
          amount: record.netPayable,
          currency: 'INR',
          paymentDate: record.payment.paymentDate,
          paymentMethod: record.payment.paymentMethod || 'Bank Transfer',
          transactionReference: record.payment.paymentReference || '',
          status: 'Completed',
          notes: `Full & Final settlement disbursement for ${empName}`,
          recordedBy: req.user.userId || null,
        });
      }
    } catch (payErr) {
      console.error('Error creating payment transaction for settlement:', payErr);
    }
    await populatedResponse(res, record, 'Settlement marked as paid');
  }),

  complete: asyncHandler(async (req, res) => {
    const record = await loadRecord(req.params.id);
    assertTransition(record, ['Paid'], 'complete');
    record.status = 'Completed'; record.settlementDate = new Date(); record.updatedBy = req.user.userId;
    appendHistory(record, 'Completed', actor(req), 'Settlement completed');
    await record.save();
    await populatedResponse(res, record, 'Settlement completed');
  }),

  statement: asyncHandler(async (req, res) => {
    const record = await getSettlementById(req.params.id);
    if (!record) throw createNotFoundError('Settlement record not found');
    if (!isHrOrAdmin(req.user) && String(record.user?._id) !== String(req.user.userId)) throw createForbiddenError('Access denied');
    const name = employeeName(record.user) || record.employeeSnapshot?.name || 'Employee';
    const line = (label, value) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`;
    const rows = [
      line('Employee', name), line('Employee ID', record.employeeSnapshot?.employeeId || record.user?.jobDetails?.employeeId || ''),
      line('Department', record.employeeSnapshot?.department || record.user?.department || ''), line('Designation', record.employeeSnapshot?.designation || record.user?.designation || ''),
      line('Last Working Day', record.lastWorkingDay ? new Date(record.lastWorkingDay).toISOString().slice(0, 10) : ''), line('Settlement Status', record.status),
      ...Object.entries(record.earnings || {}).map(([key, value]) => line(key, `₹${Number(value || 0).toLocaleString('en-IN')}`)),
      ...Object.entries(record.deductions || {}).map(([key, value]) => line(key, `₹${Number(value || 0).toLocaleString('en-IN')}`)),
      line('Gross Earnings', `₹${Number(record.grossEarnings || 0).toLocaleString('en-IN')}`), line('Total Deductions', `₹${Number(record.totalDeductions || 0).toLocaleString('en-IN')}`), line('Net Payable', `₹${Number(record.netPayable || 0).toLocaleString('en-IN')}`),
      line('Settlement Date', record.settlementDate ? new Date(record.settlementDate).toISOString().slice(0, 10) : ''),
    ];
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>F&amp;F Statement - ${escapeHtml(name)}</title><style>body{font-family:Arial,sans-serif;margin:36px;color:#172033}h1{margin-bottom:4px}p{color:#64748b}table{border-collapse:collapse;width:100%;max-width:820px;margin-top:24px}td{border:1px solid #dbe2ea;padding:10px}td:first-child{font-weight:700;width:42%;background:#f8fafc}@media print{.print{display:none}}</style></head><body><button class="print" onclick="window.print()">Print / Save as PDF</button><h1>Full &amp; Final Settlement Statement</h1><p>${escapeHtml(name)}</p><table>${rows.join('')}</table></body></html>`);
  }),
};

export default FullAndFinalSettlementController;
