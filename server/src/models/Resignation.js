import mongoose from 'mongoose';

const clearanceItemSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['Pending', 'Completed'],
      default: 'Pending',
    },
    completedBy: { type: String, default: '', trim: true },
    completedDate: { type: Date, default: null },
    remarks: { type: String, default: '', trim: true },
    settlementAmount: { type: Number, default: 0 },
    settlementStatus: {
      type: String,
      enum: ['Pending', 'Processing', 'Completed'],
      default: 'Pending',
    },
  },
  { _id: false }
);

const auditEventSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true },
    previousValue: { type: String, default: '', trim: true },
    newValue: { type: String, default: '', trim: true },
    reason: { type: String, default: '', trim: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    performedByName: { type: String, default: '', trim: true },
    date: { type: Date, default: Date.now },
  },
  { _id: true }
);

const accessManagementSchema = new mongoose.Schema(
  {
    crmAccess: {
      type: String,
      enum: ['Active', 'Restricted', 'Revoked'],
      default: 'Active',
    },
    emailAccess: {
      type: String,
      enum: ['Active', 'Suspended', 'Revoked'],
      default: 'Active',
    },
    moduleAccess: {
      hrModule: { type: Boolean, default: false },
      payroll: { type: Boolean, default: true },
      training: { type: Boolean, default: true },
      reports: { type: Boolean, default: false },
      projects: { type: Boolean, default: false },
      crm: { type: Boolean, default: false },
    },
    restrictedModules: { type: [String], default: [] },
    notes: { type: String, default: '', trim: true },
    updatedAt: { type: Date, default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedByName: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const finalSettlementSchema = new mongoose.Schema(
  {
    basicSalary: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    leaveEncashment: { type: Number, default: 0 },
    grossEarnings: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    noticeRecovery: { type: Number, default: 0 },
    assetRecovery: { type: Number, default: 0 },
    netPayable: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Approved', 'Paid', 'Completed'],
      default: 'Pending',
    },
    settlementId: { type: mongoose.Schema.Types.ObjectId, ref: 'FullAndFinalSettlement', default: null },
    calculatedAt: { type: Date, default: null },
    settledAt: { type: Date, default: null },
    remarks: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const exitInterviewSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['Pending', 'Scheduled', 'Completed'],
      default: 'Pending',
    },
    scheduledDate: { type: Date, default: null },
    interviewerName: { type: String, default: '', trim: true },
    reasonForLeaving: { type: String, default: '', trim: true },
    managementFeedback: { type: String, default: '', trim: true },
    suggestions: { type: String, default: '', trim: true },
    rehireEligibility: {
      type: String,
      enum: ['Eligible', 'Not Eligible'],
      default: 'Eligible',
    },
    hrComments: { type: String, default: '', trim: true },
    submittedAt: { type: Date, default: null },
  },
  { _id: false }
);

const offboardingSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['Not Started', 'In Progress', 'Clearance Pending', 'Settlement Pending', 'Completed'],
      default: 'Not Started',
    },
    startedAt: { type: Date, default: null },
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedHr: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedHrName: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const resignationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resignationDate: { type: Date, required: true, default: Date.now },
    proposedLastWorkingDay: { type: Date, required: true },
    approvedLastWorkingDay: { type: Date, default: null },
    noticePeriodDays: { type: Number, default: 30 },
    noticeStatus: {
      type: String,
      enum: ['Not Started', 'Active', 'Completed', 'Early Release', 'Waived'],
      default: 'Active',
    },
    earlyReleaseStatus: {
      type: String,
      enum: ['None', 'Requested', 'Approved', 'Rejected'],
      default: 'None',
    },
    earlyReleaseDate: { type: Date, default: null },
    waiverDays: { type: Number, default: 0 },
    waiverRemarks: { type: String, default: '', trim: true },
    reason: { type: String, required: true, trim: true },
    employeeComments: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: [
        'Submitted',
        'Under Review',
        'Approved',
        'Rejected',
        'Notice Period',
        'Offboarding',
        'Exit Clearance',
        'Completed',
      ],
      default: 'Submitted',
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewDate: { type: Date, default: null },
    hrRemarks: { type: String, default: '', trim: true },
    rejectionReason: { type: String, default: '', trim: true },

    offboarding: {
      type: offboardingSchema,
      default: () => ({ status: 'Not Started' }),
    },

    clearance: {
      hr: { type: clearanceItemSchema, default: () => ({ status: 'Pending' }) },
      manager: { type: clearanceItemSchema, default: () => ({ status: 'Pending' }) },
      finance: { type: clearanceItemSchema, default: () => ({ status: 'Pending' }) },
      itAssets: { type: clearanceItemSchema, default: () => ({ status: 'Pending' }) },
      knowledgeTransfer: { type: clearanceItemSchema, default: () => ({ status: 'Pending' }) },
    },

    accessManagement: {
      type: accessManagementSchema,
      default: () => ({
        crmAccess: 'Active',
        emailAccess: 'Active',
        moduleAccess: {
          hrModule: false,
          payroll: true,
          training: true,
          reports: false,
          projects: false,
          crm: false,
        },
        restrictedModules: [],
        notes: '',
      }),
    },

    finalSettlement: {
      type: finalSettlementSchema,
      default: () => ({ status: 'Pending' }),
    },

    exitInterview: { type: exitInterviewSchema, default: null },

    auditTrail: {
      type: [auditEventSchema],
      default: [],
    },

    exitCompletedAt: { type: Date, default: null },
    exitCompletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export default mongoose.models.Resignation ||
  mongoose.model('Resignation', resignationSchema, 'resignations');
