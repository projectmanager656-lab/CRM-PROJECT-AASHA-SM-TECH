import mongoose from 'mongoose';
import FullAndFinalSettlement from '../models/FullAndFinalSettlement.js';
import User from '../models/User.js';
import Resignation from '../models/Resignation.js';
import Payment from '../models/Payment.js';
import { createForbiddenError, createNotFoundError, createValidationError } from '../utils/apiError.js';
import { successResponse } from '../utils/apiResponse.js';
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

const isHr = (user) => ['admin', 'super_admin'].includes(user?.role)
  || String(user?.department || user?.jobDetails?.department || '').trim().toUpperCase() === 'HR';

const isFinance = (user) => ['admin', 'super_admin'].includes(user?.role)
  || String(user?.department || user?.jobDetails?.department || '').trim().toUpperCase() === 'FINANCE';

const isAuthorizedSettlementUser = (user) => isHr(user) || isFinance(user);

const cleanNumber = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw createValidationError('Settlement amounts must be non-negative numbers');
  return Math.round(number * 100) / 100;
};

const amountKeys = {
  earnings: [
    'pendingSalary',
    'salaryForWorkedDays',
    'leaveEncashment',
    'bonusIncentives',
    'extraSalaryIncentive',
    'pendingReimbursements',
    'otherEarnings',
    'otherApprovedPayables',
  ],
  deductions: [
    'loansAdvancesRecovery',
    'salaryAdvance',
    'noticePeriodRecovery',
    'assetRecovery',
    'otherDeductions',
    'otherApprovedDeductions',
    'otherAdjustments',
  ],
};

const pickAmounts = (source, type) => {
  if (!source) return undefined;
  const result = {};
  amountKeys[type].forEach((key) => {
    if (source[key] !== undefined && source[key] !== '') {
      result[key] = cleanNumber(source[key]);
    }
  });
  return result;
};

const actor = (req) => ({
  userId: req.user.userId,
  email: req.user.email,
  name: [req.user.firstName, req.user.lastName].filter(Boolean).join(' ').trim() || req.user.name || req.user.email || 'HR Manager',
  role: req.user.role || req.user.department || 'HR Team',
  department: req.user.department || '',
});

const loadRecord = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw createValidationError('Invalid settlement ID');
  const record = await FullAndFinalSettlement.findById(id);
  if (!record) throw createNotFoundError('Settlement record not found');
  return record;
};

const populatedResponse = async (res, record, message) => res.json(successResponse(await getSettlementById(record._id), message));

const assertTransition = (record, allowed, action) => {
  if (!allowed.includes(record.status)) {
    throw createValidationError(`Cannot ${action} a settlement currently in '${record.status}' status. Allowed statuses: ${allowed.join(', ')}`);
  }
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

export const FullAndFinalSettlementController = {
  // 1. KPI Summary - Strictly MongoDB Atlas Driven
  summary: asyncHandler(async (_req, res) => {
    const [rows, totalEmployees] = await Promise.all([
      FullAndFinalSettlement.find().select('status netPayable payment clearance').lean(),
      User.countDocuments({ role: 'employee' }),
    ]);

    const counts = Object.fromEntries(SETTLEMENT_STATUSES.map((status) => [status, 0]));
    let totalNetPayable = 0;
    let clearancePendingCount = 0;

    rows.forEach((row) => {
      counts[row.status] = (counts[row.status] || 0) + 1;
      totalNetPayable += Number(row.netPayable) || 0;

      // Check if clearance is pending
      const clr = row.clearance || {};
      const isClrPending = ['department', 'it', 'administration', 'finance'].some(
        (k) => !['Cleared', 'Completed'].includes(clr[k]?.status)
      );
      if (isClrPending && !['Completed', 'Paid', 'Rejected'].includes(row.status)) {
        clearancePendingCount += 1;
      }
    });

    const calculationPending = (counts['Calculation Pending'] || 0) + (counts['Draft'] || 0) + (counts['Pending'] || 0) + (counts['In Progress'] || 0);
    const clearancePending = counts['Clearance Pending'] || clearancePendingCount;
    const hrReview = counts['HR Review'] || 0;
    const financeReview = counts['Finance Review'] || 0;
    const approvalPending = counts['Approval Pending'] || 0;
    const paymentPending = (counts['Payment Pending'] || 0) + (counts['Payment Processing'] || 0) + (counts['Approved'] || 0);
    const completed = counts['Completed'] || 0;

    res.json(successResponse({
      totalSettlements: rows.length,
      calculationPending,
      clearancePending,
      hrReview,
      financeReview,
      approvalPending,
      paymentPending,
      completed,
      paidCount: counts['Paid'] || 0,
      onHoldCount: counts['On Hold'] || 0,
      totalNetPayable: Math.round(totalNetPayable * 100) / 100,
      totalEmployees,
      byStatus: counts,
    }, 'Full and final settlement summary retrieved'));
  }),

  // 2. Eligible Exiting Employees
  eligibleEmployees: asyncHandler(async (_req, res) => {
    res.json(successResponse(await getEligibleEmployees(), 'Eligible employees retrieved'));
  }),

  // 3. Main List with Functional Filters & Search
  list: asyncHandler(async (req, res) => {
    const {
      search,
      department,
      status,
      clearanceStatus,
      paymentStatus,
      dateFrom,
      dateTo,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};
    if (!isAuthorizedSettlementUser(req.user)) filter.user = req.user.userId;

    if (status && status !== 'All') {
      if (status === 'Calculation Pending') {
        filter.status = { $in: ['Calculation Pending', 'Draft', 'Pending', 'In Progress'] };
      } else if (status === 'Payment Pending') {
        filter.status = { $in: ['Payment Pending', 'Payment Processing', 'Approved'] };
      } else {
        filter.status = status;
      }
    }

    if (paymentStatus && paymentStatus !== 'All') {
      if (paymentStatus === 'Paid') {
        filter.$or = [{ status: 'Paid' }, { 'payment.paymentStatus': 'Paid' }];
      } else if (paymentStatus === 'Payment Pending') {
        filter.$or = [{ status: { $in: ['Payment Pending', 'Payment Processing', 'Approved'] } }, { 'payment.paymentStatus': 'Payment Pending' }];
      } else if (paymentStatus === 'Unpaid') {
        filter['payment.paymentStatus'] = { $ne: 'Paid' };
      }
    }

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
        userFilter.$and.push({
          $or: [
            { firstName: expression },
            { lastName: expression },
            { email: expression },
            { 'personalInfo.fullName': expression },
            { 'jobDetails.employeeId': expression },
          ],
        });
      }
      const matchingUsers = await User.find(userFilter).select('_id').lean();
      const matchingUserIds = matchingUsers.map((u) => u._id);

      if (search && search.trim() && mongoose.Types.ObjectId.isValid(search.trim())) {
        filter.$or = [
          { user: { $in: matchingUserIds } },
          { _id: new mongoose.Types.ObjectId(search.trim()) },
        ];
      } else {
        filter.user = { $in: matchingUserIds };
      }
    }

    const pageNumber = Math.max(1, Number(page));
    const limitNumber = Math.min(100, Math.max(1, Number(limit)));

    let [total, settlements] = await Promise.all([
      FullAndFinalSettlement.countDocuments(filter),
      FullAndFinalSettlement.find(filter)
        .populate('user', 'firstName lastName email department designation jobDetails personalInfo employmentStatus exitDate salaryDetails bankDetails')
        .populate('resignation', 'status resignationDate proposedLastWorkingDay approvedLastWorkingDay noticePeriodDays clearance')
        .populate('approval.approvedBy', 'firstName lastName email')
        .populate('payment.paidBy', 'firstName lastName email')
        .sort({ lastWorkingDay: -1, createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .lean(),
    ]);

    // Client clearance filter if requested
    if (clearanceStatus && clearanceStatus !== 'All') {
      settlements = settlements.filter((s) => {
        const clr = s.clearance || {};
        const isAllCleared = ['department', 'it', 'administration', 'finance'].every(
          (k) => ['Cleared', 'Completed'].includes(clr[k]?.status)
        );
        return clearanceStatus === 'Cleared' ? isAllCleared : !isAllCleared;
      });
      total = settlements.length;
    }

    res.json(successResponse({
      settlements,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber) || 1,
      },
    }, 'Settlement records retrieved'));
  }),

  // 4. Get Single Record with Full Population
  get: asyncHandler(async (req, res) => {
    const record = await getSettlementById(req.params.id);
    if (!record) throw createNotFoundError('Settlement record not found');
    if (!isAuthorizedSettlementUser(req.user) && String(record.user?._id) !== String(req.user.userId)) {
      throw createForbiddenError('Access denied');
    }
    res.json(successResponse(record, 'Settlement record retrieved'));
  }),

  // 5. Create Settlement (Automatic System Figures Derived)
  create: asyncHandler(async (req, res) => {
    if (!isHr(req.user)) throw createForbiddenError('Access denied. HR authorization required to initiate settlements.');

    const { userId, lastWorkingDay, earnings, deductions } = req.body;
    if (!mongoose.Types.ObjectId.isValid(userId)) throw createValidationError('A valid exited employee is required');

    const user = await User.findOne({ _id: userId, role: 'employee' });
    if (!user) throw createNotFoundError('Employee not found');

    const resignation = await Resignation.findOne({
      user: user._id,
      status: { $in: ['Approved', 'Notice Period', 'Offboarding', 'Exit Clearance', 'Completed'] },
    }).sort({ updatedAt: -1 });

    const workingDay = lastWorkingDay ? new Date(lastWorkingDay) : (resignation?.approvedLastWorkingDay || resignation?.proposedLastWorkingDay || user.exitDate || new Date());
    if (!workingDay || Number.isNaN(workingDay.getTime())) throw createValidationError('Last working day is required');

    const active = await FullAndFinalSettlement.findOne({ user: user._id, status: { $nin: ['Completed', 'Rejected'] } });
    if (active) throw createValidationError(`An active settlement (${active.status}) already exists for this employee`);

    const figures = await calculateEmployeeFigures(user, workingDay, {
      earnings: pickAmounts(earnings, 'earnings'),
      deductions: pickAmounts(deductions, 'deductions'),
    });

    // Determine initial workflow status based on clearance
    const clr = figures.clearance || {};
    const allCleared = ['department', 'it', 'administration', 'finance'].every(
      (k) => ['Cleared', 'Completed'].includes(clr[k]?.status)
    );
    const initialStatus = allCleared ? 'Calculation Pending' : 'Clearance Pending';

    const record = new FullAndFinalSettlement({
      user: user._id,
      resignation: resignation?._id || null,
      employeeSnapshot: toEmployeeSnapshot(user, user.exitDate || workingDay, workingDay),
      lastWorkingDay: workingDay,
      exitDate: user.exitDate || workingDay,
      status: initialStatus,
      ...figures,
      createdBy: req.user.userId,
      updatedBy: req.user.userId,
    });

    appendHistory(record, 'Created', actor(req), 'Settlement initiated from employee records', '', initialStatus);
    await record.save();
    await populatedResponse(res, record, 'Settlement initiated successfully');
  }),

  // 6. Update Permitted Financial Inputs (SYSTEM CALCULATED netPayable)
  update: asyncHandler(async (req, res) => {
    if (!isAuthorizedSettlementUser(req.user)) throw createForbiddenError('Access denied');

    const record = await loadRecord(req.params.id);
    assertTransition(record, ['Draft', 'Pending', 'In Progress', 'Calculation Pending', 'Clearance Pending', 'HR Review', 'On Hold', 'Rejected'], 'update');

    const workingDay = req.body.lastWorkingDay ? new Date(req.body.lastWorkingDay) : record.lastWorkingDay;
    if (Number.isNaN(workingDay.getTime())) throw createValidationError('Invalid last working day');

    const user = await User.findById(record.user);
    if (!user) throw createNotFoundError('Settlement employee no longer exists');

    const existingEarnings = record.earnings ? record.earnings.toObject() : {};
    const existingDeductions = record.deductions ? record.deductions.toObject() : {};

    const figures = await calculateEmployeeFigures(user, workingDay, {
      earnings: { ...existingEarnings, ...(pickAmounts(req.body.earnings, 'earnings') || {}) },
      deductions: { ...existingDeductions, ...(pickAmounts(req.body.deductions, 'deductions') || {}) },
    });

    record.lastWorkingDay = workingDay;
    record.earnings = figures.earnings;
    record.deductions = figures.deductions;
    record.grossEarnings = figures.grossEarnings;
    record.totalDeductions = figures.totalDeductions;
    record.netPayable = figures.netPayable; // STRICTLY DERIVED, NO OVERWRITE
    record.updatedBy = req.user.userId;

    appendHistory(record, 'Updated', actor(req), 'Financial input values updated', record.status, record.status);
    await record.save();
    await populatedResponse(res, record, 'Settlement updated successfully');
  }),

  // 7. Update Clearance Department Item & Sync to Resignation
  updateClearance: asyncHandler(async (req, res) => {
    if (!isAuthorizedSettlementUser(req.user)) throw createForbiddenError('Access denied');

    const record = await loadRecord(req.params.id);
    const { departmentKey, status, remarks } = req.body;

    if (!['department', 'it', 'administration', 'finance'].includes(departmentKey)) {
      throw createValidationError('Invalid clearance department key');
    }

    const approverName = actor(req).name || 'HR Team';
    if (!record.clearance) record.clearance = {};
    if (!record.clearance[departmentKey]) record.clearance[departmentKey] = { status: 'Pending' };

    const oldClearanceStatus = record.clearance[departmentKey].status;
    record.clearance[departmentKey].status = status || 'Cleared';
    record.clearance[departmentKey].completedBy = approverName;
    record.clearance[departmentKey].completedDate = new Date();
    if (remarks !== undefined) record.clearance[departmentKey].remarks = remarks;

    // Synchronize to Resignation clearance if linked
    if (record.resignation) {
      const resKeyMap = {
        department: 'manager',
        it: 'itAssets',
        administration: 'knowledgeTransfer',
        finance: 'finance',
      };
      const targetKey = resKeyMap[departmentKey];
      if (targetKey) {
        await Resignation.findByIdAndUpdate(record.resignation, {
          [`clearance.${targetKey}.status`]: status === 'Cleared' ? 'Completed' : status,
          [`clearance.${targetKey}.completedBy`]: approverName,
          [`clearance.${targetKey}.completedDate`]: new Date(),
          [`clearance.${targetKey}.remarks`]: remarks || '',
        });
      }
    }

    const clr = record.clearance;
    const allCleared = ['department', 'it', 'administration', 'finance'].every(
      (k) => ['Cleared', 'Completed'].includes(clr[k]?.status)
    );
    const oldStatus = record.status;
    if (allCleared && record.status === 'Clearance Pending') {
      record.status = 'Calculation Pending';
    }

    appendHistory(
      record,
      'Clearance Updated',
      actor(req),
      `${departmentKey.toUpperCase()} clearance set to ${status || 'Cleared'} (Was: ${oldClearanceStatus})`,
      oldStatus,
      record.status
    );

    record.updatedBy = req.user.userId;
    await record.save();
    await populatedResponse(res, record, 'Clearance status updated');
  }),

  // 8. Automatic Recalculation from Source Collections
  calculate: asyncHandler(async (req, res) => {
    const record = await loadRecord(req.params.id);
    assertTransition(record, ['Draft', 'Pending', 'In Progress', 'Calculation Pending', 'Clearance Pending', 'HR Review', 'On Hold', 'Rejected'], 'calculate');

    const user = await User.findById(record.user);
    if (!user) throw createNotFoundError('Settlement employee no longer exists');

    const figures = await calculateEmployeeFigures(user, record.lastWorkingDay);
    Object.assign(record, figures, {
      calculatedAt: new Date(),
      updatedBy: req.user.userId,
    });

    appendHistory(record, 'Calculated', actor(req), 'Settlement figures recalculated from current HR records', record.status, record.status);
    await record.save();
    await populatedResponse(res, record, 'Settlement recalculated successfully');
  }),

  // 9. HR Review Workflow
  hrReview: asyncHandler(async (req, res) => {
    if (!isHr(req.user)) throw createForbiddenError('Access denied. HR authorization required.');

    const record = await loadRecord(req.params.id);
    assertTransition(record, ['Draft', 'Pending', 'In Progress', 'Clearance Pending', 'Calculation Pending', 'HR Review'], 'perform HR review on');

    const { remarks = '', sendToFinance = true, putOnHold = false, holdReason = '' } = req.body;
    const oldStatus = record.status;

    if (putOnHold) {
      if (!holdReason?.trim()) throw createValidationError('Hold reason is mandatory');
      record.status = 'On Hold';
      record.hold = {
        heldBy: req.user.userId,
        heldByName: actor(req).name,
        heldAt: new Date(),
        holdReason: holdReason.trim(),
        previousStatus: oldStatus,
      };
      appendHistory(record, 'Put On Hold', actor(req), holdReason.trim(), oldStatus, 'On Hold');
    } else {
      record.hrReview = {
        reviewedBy: req.user.userId,
        reviewedByName: actor(req).name,
        reviewedAt: new Date(),
        remarks: remarks.trim(),
        status: 'Completed',
      };
      record.status = sendToFinance ? 'Finance Review' : 'HR Review';
      appendHistory(record, 'HR Reviewed', actor(req), remarks.trim() || 'HR review completed and forwarded to Finance', oldStatus, record.status);
    }

    record.updatedBy = req.user.userId;
    await record.save();
    await populatedResponse(res, record, 'HR review completed successfully');
  }),

  // 10. Finance Review Workflow
  financeReview: asyncHandler(async (req, res) => {
    if (!isFinance(req.user)) throw createForbiddenError('Access denied. Finance authorization required.');

    const record = await loadRecord(req.params.id);
    assertTransition(record, ['Finance Review', 'HR Review'], 'perform Finance review on');

    const { remarks = '', requestRevision = false } = req.body;
    const oldStatus = record.status;

    record.financeReview = {
      verifiedBy: req.user.userId,
      verifiedByName: actor(req).name,
      verifiedAt: new Date(),
      remarks: remarks.trim(),
      status: requestRevision ? 'Revision Requested' : 'Verified',
    };

    if (requestRevision) {
      record.status = 'HR Review';
      appendHistory(record, 'Revision Requested', actor(req), remarks.trim() || 'Finance requested revision', oldStatus, 'HR Review');
    } else {
      record.status = 'Approval Pending';
      appendHistory(record, 'Finance Verified', actor(req), remarks.trim() || 'Financial figures verified. Moved to Approval Pending.', oldStatus, 'Approval Pending');
    }

    record.updatedBy = req.user.userId;
    await record.save();
    await populatedResponse(res, record, 'Finance review completed successfully');
  }),

  // 11. Final Approval
  approve: asyncHandler(async (req, res) => {
    if (!isAuthorizedSettlementUser(req.user)) throw createForbiddenError('Access denied');

    const record = await loadRecord(req.params.id);
    assertTransition(record, ['Approval Pending', 'Finance Review', 'HR Review'], 'approve');

    const oldStatus = record.status;
    record.status = 'Payment Pending';
    record.approval = {
      approvedBy: req.user.userId,
      approvedByName: actor(req).name,
      approvedAt: new Date(),
      remarks: req.body.remarks || req.body.note || 'Settlement approved for disbursement',
    };
    record.payment.paymentStatus = 'Payment Pending';
    record.updatedBy = req.user.userId;

    appendHistory(record, 'Approved', actor(req), record.approval.remarks, oldStatus, 'Payment Pending');
    await record.save();
    await populatedResponse(res, record, 'Settlement approved successfully');
  }),

  // 12. Reject Request
  reject: asyncHandler(async (req, res) => {
    if (!isAuthorizedSettlementUser(req.user)) throw createForbiddenError('Access denied');

    const record = await loadRecord(req.params.id);
    assertTransition(record, ['Approval Pending', 'Finance Review', 'HR Review', 'Calculation Pending'], 'reject');

    const reason = String(req.body.reason || '').trim();
    if (!reason) throw createValidationError('A rejection reason is required');

    const oldStatus = record.status;
    record.status = 'Rejected';
    record.approval.rejectedBy = req.user.userId;
    record.approval.rejectedByName = actor(req).name;
    record.approval.rejectedAt = new Date();
    record.approval.rejectionReason = reason;
    record.updatedBy = req.user.userId;

    appendHistory(record, 'Rejected', actor(req), reason, oldStatus, 'Rejected');
    await record.save();
    await populatedResponse(res, record, 'Settlement rejected');
  }),

  // 13. Put On Hold (Mandatory Reason)
  hold: asyncHandler(async (req, res) => {
    if (!isAuthorizedSettlementUser(req.user)) throw createForbiddenError('Access denied');

    const record = await loadRecord(req.params.id);
    assertTransition(record, [
      'Draft',
      'Pending',
      'In Progress',
      'Clearance Pending',
      'Calculation Pending',
      'HR Review',
      'Finance Review',
      'Approval Pending',
      'Approved',
      'Payment Pending',
    ], 'put on hold');

    const reason = String(req.body.reason || req.body.holdReason || req.body.note || '').trim();
    if (!reason) throw createValidationError('Hold reason is mandatory');

    const oldStatus = record.status;
    record.status = 'On Hold';
    record.hold = {
      heldBy: req.user.userId,
      heldByName: actor(req).name,
      heldAt: new Date(),
      holdReason: reason,
      previousStatus: oldStatus,
    };

    appendHistory(record, 'Put On Hold', actor(req), reason, oldStatus, 'On Hold');
    record.updatedBy = req.user.userId;
    await record.save();
    await populatedResponse(res, record, 'Settlement placed on hold');
  }),

  // 14. Resume From Hold
  resume: asyncHandler(async (req, res) => {
    if (!isAuthorizedSettlementUser(req.user)) throw createForbiddenError('Access denied');

    const record = await loadRecord(req.params.id);
    assertTransition(record, ['On Hold'], 'resume');

    const oldStatus = record.status;
    const resumeTo = record.hold?.previousStatus || 'Calculation Pending';
    record.status = resumeTo;
    if (!record.hold) record.hold = {};
    record.hold.resumedBy = req.user.userId;
    record.hold.resumedByName = actor(req).name;
    record.hold.resumedAt = new Date();

    appendHistory(record, 'Resumed', actor(req), `Resumed back to ${resumeTo}`, oldStatus, resumeTo);
    record.updatedBy = req.user.userId;
    await record.save();
    await populatedResponse(res, record, `Settlement resumed to ${resumeTo}`);
  }),

  // 15. Initiate Payment Processing
  processPayment: asyncHandler(async (req, res) => {
    if (!isFinance(req.user) && !isHr(req.user)) throw createForbiddenError('Access denied');

    const record = await loadRecord(req.params.id);
    assertTransition(record, ['Payment Pending', 'Approved'], 'process payment');

    const oldStatus = record.status;
    record.status = 'Payment Processing';
    record.payment.processedBy = req.user.userId;
    record.payment.processedByName = actor(req).name;
    record.payment.processedAt = new Date();
    record.payment.paymentMethod = String(req.body.paymentMethod || record.payment.paymentMethod || 'Bank Transfer');
    record.updatedBy = req.user.userId;

    appendHistory(record, 'Payment Processing', actor(req), 'Payment disbursement processing initiated', oldStatus, 'Payment Processing');
    await record.save();
    await populatedResponse(res, record, 'Payment processing started');
  }),

  // 16. Mark as Paid (Reuses Payments collection without duplicates)
  markPaid: asyncHandler(async (req, res) => {
    if (!isFinance(req.user) && !isHr(req.user)) throw createForbiddenError('Access denied');

    const record = await loadRecord(req.params.id);
    assertTransition(record, ['Payment Pending', 'Payment Processing', 'Approved'], 'mark as paid');

    const oldStatus = record.status;
    const payDate = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date();
    const payMethod = String(req.body.paymentMethod || record.payment.paymentMethod || 'Bank Transfer');
    const payRef = String(req.body.paymentReference || '');
    const payRemarks = String(req.body.remarks || 'Full & Final settlement disbursement');

    record.status = 'Paid';
    record.payment.paidBy = req.user.userId;
    record.payment.paidByName = actor(req).name;
    record.payment.paidAt = new Date();
    record.payment.paymentDate = payDate;
    record.payment.paymentMethod = payMethod;
    record.payment.paymentReference = payRef;
    record.payment.paymentStatus = 'Paid';
    record.payment.remarks = payRemarks;
    record.updatedBy = req.user.userId;

    appendHistory(record, 'Payment Processed', actor(req), `Payment disbursed via ${payMethod}. Ref: ${payRef || 'N/A'}`, oldStatus, 'Paid');
    await record.save();

    // Persist Payment transaction in payments collection (with duplicate prevention)
    try {
      const existingPayment = await Payment.findOne({ settlement: record._id });
      const empName = employeeName(record.user) || record.employeeSnapshot?.name || 'Employee';
      if (!existingPayment) {
        const paymentNum = `PAY-FNF-${Date.now().toString().slice(-8)}`;
        await Payment.create({
          paymentNumber: paymentNum,
          settlement: record._id,
          employee: record.user?._id || record.user,
          employeeName: empName,
          amount: record.netPayable,
          currency: 'INR',
          paymentDate: payDate,
          paymentMethod: payMethod,
          transactionReference: payRef,
          status: 'Completed',
          notes: `Full & Final settlement disbursement for ${empName}`,
          recordedBy: req.user.userId || null,
        });
      } else {
        existingPayment.amount = record.netPayable;
        existingPayment.paymentDate = payDate;
        existingPayment.paymentMethod = payMethod;
        existingPayment.transactionReference = payRef;
        existingPayment.status = 'Completed';
        await existingPayment.save();
      }
    } catch (payErr) {
      console.error('Error recording payment transaction for settlement:', payErr);
    }

    await populatedResponse(res, record, 'Settlement marked as paid');
  }),

  // 17. Final Completion Check (Read-Only Lock)
  complete: asyncHandler(async (req, res) => {
    if (!isAuthorizedSettlementUser(req.user)) throw createForbiddenError('Access denied');

    const record = await loadRecord(req.params.id);
    assertTransition(record, ['Paid'], 'complete');

    const oldStatus = record.status;
    record.status = 'Completed';
    record.settlementDate = new Date();
    record.completion = {
      completedBy: req.user.userId,
      completedByName: actor(req).name,
      completedAt: new Date(),
      finalRemarks: req.body.remarks || 'Full and final settlement formalities completed.',
    };
    record.updatedBy = req.user.userId;

    appendHistory(record, 'Completed', actor(req), record.completion.finalRemarks, oldStatus, 'Completed');
    await record.save();
    await populatedResponse(res, record, 'Settlement completed and locked as read-only');
  }),

  // 18. F&F Statement
  statement: asyncHandler(async (req, res) => {
    const record = await getSettlementById(req.params.id);
    if (!record) throw createNotFoundError('Settlement record not found');
    if (!isAuthorizedSettlementUser(req.user) && String(record.user?._id) !== String(req.user.userId)) {
      throw createForbiddenError('Access denied');
    }

    const name = employeeName(record.user) || record.employeeSnapshot?.name || 'Employee';
    const line = (label, value) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`;
    const rows = [
      line('Employee', name),
      line('Employee ID', record.employeeSnapshot?.employeeId || record.user?.jobDetails?.employeeId || ''),
      line('Department', record.employeeSnapshot?.department || record.user?.department || ''),
      line('Designation', record.employeeSnapshot?.designation || record.user?.designation || ''),
      line('Last Working Day', record.lastWorkingDay ? new Date(record.lastWorkingDay).toISOString().slice(0, 10) : ''),
      line('Settlement Status', record.status),
      line('Payment Status', record.payment?.paymentStatus || 'Unpaid'),
      line('Payment Reference / Txn ID', record.payment?.paymentReference || 'N/A'),
      ...Object.entries(record.earnings || {}).map(([key, value]) => line(`Earning: ${key}`, `₹${Number(value || 0).toLocaleString('en-IN')}`)),
      ...Object.entries(record.deductions || {}).map(([key, value]) => line(`Deduction: ${key}`, `₹${Number(value || 0).toLocaleString('en-IN')}`)),
      line('Gross Payable', `₹${Number(record.grossEarnings || 0).toLocaleString('en-IN')}`),
      line('Total Deductions', `₹${Number(record.totalDeductions || 0).toLocaleString('en-IN')}`),
      line('Final Settlement Amount (SYSTEM CALCULATED)', `₹${Number(record.netPayable || 0).toLocaleString('en-IN')}`),
      line('Settlement Date', record.settlementDate ? new Date(record.settlementDate).toISOString().slice(0, 10) : ''),
    ];

    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>F&amp;F Statement - ${escapeHtml(name)}</title><style>body{font-family:Arial,sans-serif;margin:36px;color:#172033}h1{margin-bottom:4px}p{color:#64748b}table{border-collapse:collapse;width:100%;max-width:820px;margin-top:24px}td{border:1px solid #dbe2ea;padding:10px}td:first-child{font-weight:700;width:42%;background:#f8fafc}@media print{.print{display:none}}</style></head><body><button class="print" onclick="window.print()">Print / Save as PDF</button><h1>Full &amp; Final Settlement Statement</h1><p>${escapeHtml(name)}</p><table>${rows.join('')}</table></body></html>`);
  }),
};

export default FullAndFinalSettlementController;
