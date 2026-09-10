import mongoose from 'mongoose';

const historySchema = new mongoose.Schema({
  action: { type: String, required: true, trim: true },
  note: { type: String, default: '', trim: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  performedByName: { type: String, default: '', trim: true },
  at: { type: Date, default: Date.now },
}, { _id: true });

const moneySchema = new mongoose.Schema({
  pendingSalary: { type: Number, default: 0, min: 0 },
  salaryForWorkedDays: { type: Number, default: 0, min: 0 },
  leaveEncashment: { type: Number, default: 0, min: 0 },
  bonusIncentives: { type: Number, default: 0, min: 0 },
  pendingReimbursements: { type: Number, default: 0, min: 0 },
  otherEarnings: { type: Number, default: 0, min: 0 },
  loansAdvancesRecovery: { type: Number, default: 0, min: 0 },
  noticePeriodRecovery: { type: Number, default: 0, min: 0 },
  assetRecovery: { type: Number, default: 0, min: 0 },
  otherDeductions: { type: Number, default: 0, min: 0 },
  otherAdjustments: { type: Number, default: 0, min: 0 },
}, { _id: false });

const employeeSnapshotSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  employeeId: { type: String, default: '' },
  department: { type: String, default: '' },
  designation: { type: String, default: '' },
  joiningDate: { type: String, default: '' },
  exitDate: { type: Date, default: null },
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
    enum: ['Pending', 'In Progress', 'Clearance Pending', 'Calculation Pending', 'Approval Pending', 'Approved', 'Rejected', 'On Hold', 'Payment Processing', 'Paid', 'Completed'],
    default: 'In Progress',
    index: true,
  },
  earnings: { type: moneySchema, default: () => ({}) },
  deductions: { type: moneySchema, default: () => ({}) },
  grossEarnings: { type: Number, default: 0, min: 0 },
  totalDeductions: { type: Number, default: 0, min: 0 },
  netPayable: { type: Number, default: 0, min: 0 },
  calculationSources: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  approval: {
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
  },
  payment: {
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    processedAt: { type: Date, default: null },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    paidAt: { type: Date, default: null },
    paymentDate: { type: Date, default: null },
    paymentMethod: { type: String, default: '' },
    paymentReference: { type: String, default: '' },
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
