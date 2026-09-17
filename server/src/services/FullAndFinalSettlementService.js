import mongoose from 'mongoose';
import FullAndFinalSettlement from '../models/FullAndFinalSettlement.js';
import User from '../models/User.js';
import Payroll from '../models/Payroll.js';
import Attendance from '../models/Attendance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Resignation from '../models/Resignation.js';
import Asset from '../models/Asset.js';
import Expense from '../models/Expense.js';

export const SETTLEMENT_STATUSES = [
  'Draft',
  'Calculation Pending',
  'Clearance Pending',
  'HR Review',
  'Finance Review',
  'Approval Pending',
  'Approved',
  'Payment Pending',
  'Paid',
  'Completed',
  'On Hold',
  'Pending',
  'In Progress',
  'Payment Processing',
  'Rejected',
];

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const asDate = (value) => (value ? new Date(value) : null);
const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());
const dateKey = (value) => (isValidDate(asDate(value)) ? asDate(value).toISOString().slice(0, 10) : '');
const daysInclusive = (start, end) => {
  if (!start || !end) return 0;
  const ms = asDate(end).getTime() - asDate(start).getTime();
  return ms >= 0 ? Math.floor(ms / 86400000) + 1 : 0;
};

export const employeeName = (user) => {
  if (!user) return '';
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
    || user.personalInfo?.fullName || user.email || '';
};

export const employeeId = (user) => user?.jobDetails?.employeeId || String(user?._id || '');
export const employeeDepartment = (user) => user?.department || user?.jobDetails?.department || '';
export const employeeDesignation = (user) => user?.designation || user?.jobDetails?.designation || '';

export const toEmployeeSnapshot = (user, exitDate = null, lastWorkingDay = null) => ({
  name: employeeName(user),
  employeeId: employeeId(user),
  department: employeeDepartment(user),
  designation: employeeDesignation(user),
  joiningDate: user?.jobDetails?.joiningDate || '',
  exitDate: exitDate || user?.exitDate || null,
  lastWorkingDay: lastWorkingDay || null,
  noticePeriodDays: user?.jobDetails?.noticePeriodDays || 30,
});

export const toClearanceSnapshot = (resignation) => {
  const normStatus = (s) => (s === 'Completed' ? 'Cleared' : (s || 'Pending'));
  return {
    department: {
      status: normStatus(resignation?.clearance?.manager?.status),
      completedBy: resignation?.clearance?.manager?.completedBy || '',
      completedDate: resignation?.clearance?.manager?.completedDate || null,
      remarks: resignation?.clearance?.manager?.remarks || '',
    },
    it: {
      status: normStatus(resignation?.clearance?.itAssets?.status),
      completedBy: resignation?.clearance?.itAssets?.completedBy || '',
      completedDate: resignation?.clearance?.itAssets?.completedDate || null,
      remarks: resignation?.clearance?.itAssets?.remarks || '',
    },
    administration: {
      status: normStatus(resignation?.clearance?.knowledgeTransfer?.status),
      completedBy: resignation?.clearance?.knowledgeTransfer?.completedBy || '',
      completedDate: resignation?.clearance?.knowledgeTransfer?.completedDate || null,
      remarks: resignation?.clearance?.knowledgeTransfer?.remarks || '',
    },
    finance: {
      status: normStatus(resignation?.clearance?.finance?.status),
      completedBy: resignation?.clearance?.finance?.completedBy || '',
      completedDate: resignation?.clearance?.finance?.completedDate || null,
      remarks: resignation?.clearance?.finance?.remarks || '',
    },
  };
};

const getEmployeeResignation = async (userId) => Resignation.findOne({
  user: userId,
  status: { $in: ['Approved', 'Notice Period', 'Offboarding', 'Exit Clearance', 'Completed'] },
}).sort({ approvedLastWorkingDay: -1, proposedLastWorkingDay: -1, updatedAt: -1 }).lean();

const getLatestPayroll = async (userId) => Payroll.findOne({ user: userId })
  .sort({ effectiveDate: -1, createdAt: -1 }).lean();

const getWorkedDays = async (userId, lastWorkingDay) => {
  const end = dateKey(lastWorkingDay);
  if (!end) return 0;
  const startDate = new Date(lastWorkingDay);
  startDate.setDate(1);
  const start = dateKey(startDate);
  const attendance = await Attendance.find({
    user: userId,
    date: { $gte: start, $lte: end },
    status: { $in: ['Present', 'Late', 'Half Day'] },
  }).select('date status').lean();
  return attendance.reduce((total, row) => total + (row.status === 'Half Day' ? 0.5 : 1), 0);
};

const getApprovedLeaveDays = async (userId, lastWorkingDay) => {
  const leave = await LeaveRequest.find({
    user: userId,
    status: 'Approved',
    startDate: { $lte: lastWorkingDay },
    endDate: { $gte: new Date(new Date(lastWorkingDay).getFullYear(), new Date(lastWorkingDay).getMonth(), 1) },
  }).select('startDate endDate').lean();
  const monthStart = new Date(new Date(lastWorkingDay).getFullYear(), new Date(lastWorkingDay).getMonth(), 1);
  const finalDay = new Date(lastWorkingDay);
  return leave.reduce((total, row) => {
    const start = new Date(Math.max(new Date(row.startDate).getTime(), monthStart.getTime()));
    const end = new Date(Math.min(new Date(row.endDate).getTime(), finalDay.getTime()));
    return total + daysInclusive(start, end);
  }, 0);
};

const getAssetRecovery = async (userId) => {
  const assets = await Asset.find({
    assignedTo: userId,
    status: { $in: ['Allocated', 'Lost', 'Damaged', 'Under Repair'] },
  }).select('purchaseCost assetName assetCode status').lean();
  return { amount: round2(assets.reduce((total, asset) => total + (Number(asset.purchaseCost) || 0), 0)), count: assets.length };
};

const getApprovedReimbursements = async (userId) => {
  try {
    const expenses = await Expense.find({
      $or: [{ employee: userId }, { recordedBy: userId }],
      paymentStatus: { $in: ['Approved', 'Pending'] },
    }).select('amount title category paymentStatus').lean();
    return round2(expenses.reduce((total, exp) => total + (Number(exp.amount) || 0), 0));
  } catch {
    return 0;
  }
};

const getLeaveEncashment = async (userId, dailySalary) => {
  try {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const leavesTaken = await LeaveRequest.find({
      user: userId,
      type: { $in: ['Annual', 'Casual'] },
      status: 'Approved',
      startDate: { $gte: yearStart },
    }).lean();
    const daysTaken = leavesTaken.reduce((acc, l) => acc + daysInclusive(l.startDate, l.endDate), 0);
    const encashableDays = Math.max(0, 18 - daysTaken);
    return round2(encashableDays * dailySalary);
  } catch {
    return 0;
  }
};

export const calculateEmployeeFigures = async (user, lastWorkingDay, overrides = {}) => {
  const payroll = await getLatestPayroll(user._id);
  const resignation = await getEmployeeResignation(user._id);
  const workedDays = await getWorkedDays(user._id, lastWorkingDay);
  const approvedLeaveDays = await getApprovedLeaveDays(user._id, lastWorkingDay);
  const assetRecovery = await getAssetRecovery(user._id);
  const reimbursements = await getApprovedReimbursements(user._id);

  const monthlySalary = round2((payroll?.basicSalary || user.salaryDetails?.basicSalary || 0)
    + (payroll?.allowances || user.salaryDetails?.allowances || 0));
  const dailySalary = round2(monthlySalary / 30);
  const workedSalary = round2(dailySalary * workedDays);
  const unpaidPayrollNet = payroll && payroll.status !== 'Paid'
    ? round2(Math.max(0, (payroll.net || 0) - workedSalary)) : 0;
  const noticeDays = Math.max(0, Number(resignation?.noticePeriodDays) || 0);
  const servedDays = resignation?.resignationDate ? daysInclusive(resignation.resignationDate, lastWorkingDay) : noticeDays;
  const noticeRecovery = round2(Math.max(0, noticeDays - servedDays) * dailySalary);
  const leaveEncashment = await getLeaveEncashment(user._id, dailySalary);

  const derivedEarnings = {
    pendingSalary: unpaidPayrollNet,
    salaryForWorkedDays: workedSalary,
    leaveEncashment: leaveEncashment,
    bonusIncentives: round2((payroll?.bonus || 0) + (payroll?.incentive || 0) + (payroll?.overtime || 0)),
    extraSalaryIncentive: round2((payroll?.bonus || 0) + (payroll?.incentive || 0) + (payroll?.overtime || 0)),
    pendingReimbursements: reimbursements,
    otherEarnings: 0,
    otherApprovedPayables: 0,
  };

  const derivedDeductions = {
    loansAdvancesRecovery: round2(payroll?.salaryAdvance || 0),
    salaryAdvance: round2(payroll?.salaryAdvance || 0),
    noticePeriodRecovery: noticeRecovery,
    assetRecovery: assetRecovery.amount,
    otherDeductions: round2((payroll?.deductions || 0) + (payroll?.lopDeductions || 0)),
    otherApprovedDeductions: round2((payroll?.deductions || 0) + (payroll?.lopDeductions || 0)),
    otherAdjustments: 0,
  };

  const earnings = { ...derivedEarnings, ...(overrides.earnings || {}) };
  const deductions = { ...derivedDeductions, ...(overrides.deductions || {}) };
  Object.keys(earnings).forEach((key) => { earnings[key] = round2(Math.max(0, earnings[key])); });
  Object.keys(deductions).forEach((key) => { deductions[key] = round2(Math.max(0, deductions[key])); });

  const grossEarnings = round2(
    (earnings.pendingSalary || 0) +
    (earnings.salaryForWorkedDays || 0) +
    (earnings.leaveEncashment || 0) +
    (earnings.bonusIncentives || earnings.extraSalaryIncentive || 0) +
    (earnings.pendingReimbursements || 0) +
    (earnings.otherEarnings || earnings.otherApprovedPayables || 0)
  );

  const totalDeductions = round2(
    (deductions.salaryAdvance || deductions.loansAdvancesRecovery || 0) +
    (deductions.noticePeriodRecovery || 0) +
    (deductions.assetRecovery || 0) +
    (deductions.otherApprovedDeductions || deductions.otherDeductions || 0) +
    (deductions.otherAdjustments || 0)
  );

  const netPayable = round2(Math.max(0, grossEarnings - totalDeductions));

  return {
    earnings,
    deductions,
    grossEarnings,
    totalDeductions,
    netPayable,
    clearance: toClearanceSnapshot(resignation),
    calculationSources: {
      payrollId: payroll?._id || null,
      resignationId: resignation?._id || null,
      monthlySalary,
      dailySalary,
      workedDays,
      approvedLeaveDays,
      assetCount: assetRecovery.count,
      reimbursements,
      calculatedAt: new Date(),
    },
  };
};

export const getEligibleEmployees = async () => {
  const resignationRows = await Resignation.find({
    status: { $in: ['Submitted', 'Under Review', 'Approved', 'Notice Period', 'Offboarding', 'Exit Clearance', 'Completed'] },
  }).select('user proposedLastWorkingDay approvedLastWorkingDay resignationDate status noticePeriodDays clearance').lean();
  const resignedUserIds = resignationRows.map((row) => row.user).filter(Boolean);

  let users = await User.find({
    role: 'employee',
    $or: [
      { employmentStatus: { $in: ['Notice Period', 'Exited', 'Terminated', 'Resigned'] } },
      { exitDate: { $ne: null } },
      { terminationDate: { $ne: null } },
      { _id: { $in: resignedUserIds } },
    ],
  }).select('firstName lastName email department designation jobDetails employmentStatus exitDate personalInfo salaryDetails').sort({ firstName: 1, lastName: 1 }).lean();

  if (users.length === 0) {
    users = await User.find({ role: 'employee' })
      .select('firstName lastName email department designation jobDetails employmentStatus exitDate personalInfo salaryDetails')
      .sort({ firstName: 1, lastName: 1 })
      .lean();
  }

  const activeSettlements = await FullAndFinalSettlement.find({
    user: { $in: users.map((user) => user._id) },
    status: { $nin: ['Completed', 'Rejected'] },
  }).select('user').lean();
  const activeIds = new Set(activeSettlements.map((row) => String(row.user)));

  return users.filter((user) => !activeIds.has(String(user._id))).map((user) => {
    const resignation = resignationRows.find((row) => String(row.user) === String(user._id));
    const lwd = resignation?.approvedLastWorkingDay || resignation?.proposedLastWorkingDay || user.exitDate || null;
    return {
      ...toEmployeeSnapshot(user, user.exitDate || lwd, lwd),
      userId: user._id,
      email: user.email,
      employmentStatus: user.employmentStatus || 'Active',
      resignationId: resignation?._id || null,
      resignationStatus: resignation?.status || null,
      noticePeriodDays: resignation?.noticePeriodDays || user.jobDetails?.noticePeriodDays || 30,
      clearance: toClearanceSnapshot(resignation),
    };
  });
};

export const getSettlementById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return FullAndFinalSettlement.findById(id)
    .populate('user', 'firstName lastName email department designation jobDetails personalInfo employmentStatus exitDate salaryDetails bankDetails')
    .populate('resignation')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email')
    .populate('hrReview.reviewedBy', 'firstName lastName email department')
    .populate('financeReview.verifiedBy', 'firstName lastName email department')
    .populate('approval.approvedBy', 'firstName lastName email department')
    .populate('approval.rejectedBy', 'firstName lastName email department')
    .populate('payment.processedBy', 'firstName lastName email department')
    .populate('payment.paidBy', 'firstName lastName email department')
    .populate('completion.completedBy', 'firstName lastName email department')
    .populate('hold.heldBy', 'firstName lastName email department')
    .populate('hold.resumedBy', 'firstName lastName email department')
    .lean();
};

export const appendHistory = (record, action, user, note = '', previousStatus = '', newStatus = '') => {
  record.history = record.history || [];
  record.history.push({
    action,
    previousStatus: previousStatus || record.status || '',
    newStatus: newStatus || record.status || '',
    note: note || '',
    remarks: note || '',
    performedBy: user?.userId || user?._id || null,
    performedByName: user?.name || user?.email || '',
    role: user?.role || user?.department || 'HR Team',
    at: new Date(),
  });
};

export default {
  SETTLEMENT_STATUSES,
  calculateEmployeeFigures,
  getEligibleEmployees,
  getSettlementById,
  appendHistory,
  employeeName,
  toEmployeeSnapshot,
  toClearanceSnapshot,
};
