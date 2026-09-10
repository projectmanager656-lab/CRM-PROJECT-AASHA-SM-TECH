import mongoose from 'mongoose';
import FullAndFinalSettlement from '../models/FullAndFinalSettlement.js';
import User from '../models/User.js';
import Payroll from '../models/Payroll.js';
import Attendance from '../models/Attendance.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Resignation from '../models/Resignation.js';
import Asset from '../models/Asset.js';

export const SETTLEMENT_STATUSES = [
  'Pending', 'In Progress', 'Clearance Pending', 'Calculation Pending', 'Approval Pending',
  'Approved', 'Rejected', 'On Hold', 'Payment Processing', 'Paid', 'Completed',
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
});

const getEmployeeResignation = async (userId) => Resignation.findOne({
  user: userId,
  status: { $in: ['Approved', 'Notice Period', 'Exit Clearance', 'Completed'] },
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

export const calculateEmployeeFigures = async (user, lastWorkingDay, overrides = {}) => {
  const payroll = await getLatestPayroll(user._id);
  const resignation = await getEmployeeResignation(user._id);
  const workedDays = await getWorkedDays(user._id, lastWorkingDay);
  const approvedLeaveDays = await getApprovedLeaveDays(user._id, lastWorkingDay);
  const assetRecovery = await getAssetRecovery(user._id);

  const monthlySalary = round2((payroll?.basicSalary || user.salaryDetails?.basicSalary || 0)
    + (payroll?.allowances || user.salaryDetails?.allowances || 0));
  const dailySalary = round2(monthlySalary / 30);
  const workedSalary = round2(dailySalary * workedDays);
  const unpaidPayrollNet = payroll && payroll.status !== 'Paid'
    ? round2(Math.max(0, (payroll.net || 0) - workedSalary)) : 0;
  const noticeDays = Math.max(0, Number(resignation?.noticePeriodDays) || 0);
  const servedDays = resignation?.resignationDate ? daysInclusive(resignation.resignationDate, lastWorkingDay) : noticeDays;
  const noticeRecovery = round2(Math.max(0, noticeDays - servedDays) * dailySalary);

  const derivedEarnings = {
    pendingSalary: unpaidPayrollNet,
    salaryForWorkedDays: workedSalary,
    leaveEncashment: 0,
    bonusIncentives: round2((payroll?.bonus || 0) + (payroll?.incentive || 0) + (payroll?.overtime || 0)),
    pendingReimbursements: 0,
    otherEarnings: 0,
  };
  const derivedDeductions = {
    loansAdvancesRecovery: round2(payroll?.salaryAdvance || 0),
    noticePeriodRecovery: noticeRecovery,
    assetRecovery: assetRecovery.amount,
    otherDeductions: round2((payroll?.deductions || 0) + (payroll?.lopDeductions || 0)),
    otherAdjustments: 0,
  };
  const earnings = { ...derivedEarnings, ...(overrides.earnings || {}) };
  const deductions = { ...derivedDeductions, ...(overrides.deductions || {}) };
  Object.keys(earnings).forEach((key) => { earnings[key] = round2(Math.max(0, earnings[key])); });
  Object.keys(deductions).forEach((key) => { deductions[key] = round2(Math.max(0, deductions[key])); });

  const grossEarnings = round2(Object.values(earnings).reduce((total, value) => total + value, 0));
  const totalDeductions = round2(Object.values(deductions).reduce((total, value) => total + value, 0));
  return {
    earnings,
    deductions,
    grossEarnings,
    totalDeductions,
    netPayable: round2(Math.max(0, grossEarnings - totalDeductions)),
    calculationSources: {
      payrollId: payroll?._id || null,
      resignationId: resignation?._id || null,
      workedDays,
      approvedLeaveDays,
      assetCount: assetRecovery.count,
      note: 'Leave encashment and reimbursements are zero because no source fields/records exist in the current system.',
    },
  };
};

export const getEligibleEmployees = async () => {
  const resignationRows = await Resignation.find({
    status: { $in: ['Submitted', 'Under Review', 'Approved', 'Notice Period', 'Exit Clearance', 'Completed'] },
  }).select('user proposedLastWorkingDay approvedLastWorkingDay resignationDate status').lean();
  const resignedUserIds = resignationRows.map((row) => row.user).filter(Boolean);

  let users = await User.find({
    role: 'employee',
    $or: [
      { employmentStatus: { $in: ['Notice Period', 'Exited', 'Terminated', 'Resigned'] } },
      { exitDate: { $ne: null } },
      { terminationDate: { $ne: null } },
      { _id: { $in: resignedUserIds } },
    ],
  }).select('firstName lastName email department designation jobDetails employmentStatus exitDate personalInfo').sort({ firstName: 1, lastName: 1 }).lean();

  if (users.length === 0) {
    users = await User.find({ role: 'employee' })
      .select('firstName lastName email department designation jobDetails employmentStatus exitDate personalInfo')
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
    return {
      ...toEmployeeSnapshot(user, user.exitDate || resignation?.approvedLastWorkingDay || null, resignation?.approvedLastWorkingDay || resignation?.proposedLastWorkingDay || user.exitDate || null),
      userId: user._id,
      email: user.email,
      employmentStatus: user.employmentStatus || 'Active',
      resignationId: resignation?._id || null,
      resignationStatus: resignation?.status || null,
    };
  });
};

export const getSettlementById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return FullAndFinalSettlement.findById(id)
    .populate('user', 'firstName lastName email department designation jobDetails personalInfo employmentStatus exitDate salaryDetails')
    .populate('resignation')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email')
    .populate('approval.approvedBy', 'firstName lastName email')
    .populate('approval.rejectedBy', 'firstName lastName email')
    .populate('payment.paidBy', 'firstName lastName email')
    .lean();
};

export const appendHistory = (record, action, user, note = '') => {
  record.history = record.history || [];
  record.history.push({ action, note, performedBy: user?.userId || null, performedByName: user?.name || user?.email || '', at: new Date() });
};

export default {
  SETTLEMENT_STATUSES,
  calculateEmployeeFigures,
  getEligibleEmployees,
  getSettlementById,
  appendHistory,
  employeeName,
  toEmployeeSnapshot,
};
