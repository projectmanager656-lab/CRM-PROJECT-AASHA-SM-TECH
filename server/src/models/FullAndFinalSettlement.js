import mongoose from 'mongoose';

const historySchema = new mongoose.Schema({
  action: { type: String, required: true, trim: true },
  previousStatus: { type: String, default: '', trim: true },
  newStatus: { type: String, default: '', trim: true },
  note: { type: String, default: '', trim: true },
  remarks: { type: String, default: '', trim: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  performedByName: { type: String, default: '', trim: true },
  role: { type: String, default: '', trim: true },
  at: { type: Date, default: Date.now },
}, { _id: true });

const clearanceItemSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['Pending', 'Cleared', 'Rejected', 'On Hold', 'Completed'],
    default: 'Pending',
  },
  completedBy: { type: String, default: '', trim: true },
  completedDate: { type: Date, default: null },
  remarks: { type: String, default: '', trim: true },
}, { _id: false });

const clearanceSchema = new mongoose.Schema({
  department: { type: clearanceItemSchema, default: () => ({ status: 'Pending' }) },
  it: { type: clearanceItemSchema, default: () => ({ status: 'Pending' }) },
  administration: { type: clearanceItemSchema, default: () => ({ status: 'Pending' }) },
  finance: { type: clearanceItemSchema, default: () => ({ status: 'Pending' }) },
}, { _id: false });

const moneySchema = new mongoose.Schema({
  pendingSalary: { type: Number, default: 0, min: 0 },
  salaryForWorkedDays: { type: Number, default: 0, min: 0 },
  leaveEncashment: { type: Number, default: 0, min: 0 },
  bonusIncentives: { type: Number, default: 0, min: 0 },
  extraSalaryIncentive: { type: Number, default: 0, min: 0 },
  pendingReimbursements: { type: Number, default: 0, min: 0 },
  otherEarnings: { type: Number, default: 0, min: 0 },
  otherApprovedPayables: { type: Number, default: 0, min: 0 },
  loansAdvancesRecovery: { type: Number, default: 0, min: 0 },
  salaryAdvance: { type: Number, default: 0, min: 0 },
  noticePeriodRecovery: { type: Number, default: 0, min: 0 },
  assetRecovery: { type: Number, default: 0, min: 0 },
  otherDeductions: { type: Number, default: 0, min: 0 },
  otherApprovedDeductions: { type: Number, default: 0, min: 0 },
  otherAdjustments: { type: Number, default: 0, min: 0 },
}, { _id: false });

const employeeSnapshotSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  employeeId: { type: String, default: '' },
  department: { type: String, default: '' },
  designation: { type: String, default: '' },
  joiningDate: { type: String, default: '' },
  exitDate: { type: Date, default: null },
  noticePeriodDays: { type: Number, default: 0 },
}, { _id: false });

const settlementSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  resignation: { type: mongoose.Schema.Types.ObjectId, ref: 'Resignation', default: null, index: true },
  employeeSnapshot: { type: employeeSnapshotSchema, default: () => ({}) },
  lastWorkingDay: { type: Date, required: true, index: true },
  exitDate: { type: Date, default: null },
  settlementDate: { type: Date, default: null },
  status: {
    type: String,
    enum: [
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
      'Payment Processing',
      'Paid',
      'Completed',
      'On Hold',
      'Rejected',
    ],
    default: 'Calculation Pending',
    index: true,
  },
  clearance: { type: clearanceSchema, default: () => ({}) },
  earnings: { type: moneySchema, default: () => ({}) },
  deductions: { type: moneySchema, default: () => ({}) },
  grossEarnings: { type: Number, default: 0, min: 0 },
  totalDeductions: { type: Number, default: 0, min: 0 },
  netPayable: { type: Number, default: 0, min: 0 },
  calculationSources: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  hrReview: {
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedByName: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
    remarks: { type: String, default: '' },
    status: { type: String, default: 'Pending' },
  },
  financeReview: {
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedByName: { type: String, default: '' },
    verifiedAt: { type: Date, default: null },
    remarks: { type: String, default: '' },
    status: { type: String, default: 'Pending' },
  },
  approval: {
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedByName: { type: String, default: '' },
    approvedAt: { type: Date, default: null },
    remarks: { type: String, default: '' },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectedByName: { type: String, default: '' },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
  },
  payment: {
    paymentStatus: {
      type: String,
      enum: ['Unpaid', 'Payment Pending', 'Paid'],
      default: 'Unpaid',
    },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    processedByName: { type: String, default: '' },
    processedAt: { type: Date, default: null },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    paidByName: { type: String, default: '' },
    paidAt: { type: Date, default: null },
    paymentDate: { type: Date, default: null },
    paymentMethod: { type: String, default: 'Bank Transfer' },
    paymentReference: { type: String, default: '' },
    remarks: { type: String, default: '' },
  },
  completion: {
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    completedByName: { type: String, default: '' },
    completedAt: { type: Date, default: null },
    finalRemarks: { type: String, default: '' },
  },
  hold: {
    heldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    heldByName: { type: String, default: '' },
    heldAt: { type: Date, default: null },
    holdReason: { type: String, default: '' },
    previousStatus: { type: String, default: '' },
    resumedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resumedByName: { type: String, default: '' },
    resumedAt: { type: Date, default: null },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  calculatedAt: { type: Date, default: null },
  submittedAt: { type: Date, default: null },
  history: { type: [historySchema], default: [] },
}, { timestamps: true });

settlementSchema.index({ user: 1, status: 1 });
settlementSchema.index({ createdAt: -1 });

export default mongoose.models.FullAndFinalSettlement || mongoose.model('FullAndFinalSettlement', settlementSchema, 'fullandfinalsettlements');
