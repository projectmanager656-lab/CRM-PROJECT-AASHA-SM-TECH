import mongoose from 'mongoose';

export const HR_SUPPORT_CATEGORIES = [
  'Salary Issue',
  'Leave Issue',
  'Attendance Issue',
  'Workplace Issue',
  'Manager Concern',
  'Colleague Concern',
  'Policy Clarification',
  'Workplace Behaviour',
  'Payroll Issue',
  'Onboarding / Joining',
  'Employee Documents',
  'Benefits & Allowances',
  'Performance / Appraisal',
  'Training & Development',
  'Work Location / Transfer',
  'Employment / HR Policy',
  'Grievance / Complaint',
  'Exit / Resignation Support',
  'Workplace Facilities / Resources',
  'General HR Support',
  'Other',
];

export const SENSITIVE_CATEGORIES = [
  'Salary Issue',
  'Payroll Issue',
  'Grievance / Complaint',
  'Manager Concern',
  'Colleague Concern',
  'Workplace Behaviour',
];

export const HR_SUPPORT_DEPARTMENTS = [
  'Business Development',
  'Finance',
  'IT',
  'Graphics',
  'Video',
  'Social Media',
];

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    path: { type: String, default: '', trim: true },
    size: { type: Number, default: 0 },
    mimeType: { type: String, default: '', trim: true },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    uploadedByName: { type: String, default: '', trim: true },
  },
  { _id: true }
);

const reminderSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    date: { type: Date, default: null },
    time: { type: String, default: '', trim: true },
    note: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['Scheduled', 'Due', 'Completed', 'Cancelled', 'Overdue'],
      default: 'Scheduled',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, default: '', trim: true },
    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderName: { type: String, required: true, trim: true },
    senderRole: {
      type: String,
      enum: ['employee', 'hr', 'admin', 'super_admin'],
      default: 'employee',
    },
    message: { type: String, required: true, trim: true },
    attachments: { type: [attachmentSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const internalNoteSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true, trim: true },
    authorRole: { type: String, default: 'hr', trim: true },
    note: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const historyEventSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true },
    details: { type: String, default: '', trim: true },
    previousValue: { type: String, default: '', trim: true },
    newValue: { type: String, default: '', trim: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    performedByName: { type: String, default: '', trim: true },
    performedByRole: { type: String, default: '', trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const reassignmentEventSchema = new mongoose.Schema(
  {
    previousAssignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    previousAssigneeName: { type: String, default: '', trim: true },
    newAssignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    newAssigneeName: { type: String, default: '', trim: true },
    reassignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reassignedByName: { type: String, default: '', trim: true },
    reassignedAt: { type: Date, default: Date.now },
    reason: { type: String, default: '', trim: true },
  },
  { _id: true }
);

const hrSupportRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    employeeName: { type: String, required: true, trim: true },
    employeeId: { type: String, default: '', trim: true },
    department: { type: String, default: '', trim: true, index: true },
    designation: { type: String, default: '', trim: true },
    category: {
      type: String,
      required: true,
      enum: HR_SUPPORT_CATEGORIES,
      index: true,
    },
    otherCategory: { type: String, default: '', trim: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium',
      index: true,
    },
    status: {
      type: String,
      enum: [
        'New',
        'Assigned',
        'In Progress',
        'Pending Employee',
        'Pending Internal',
        'Resolved',
        'Closed',
        'Reopened',
      ],
      default: 'New',
      index: true,
    },
    attachments: { type: [attachmentSchema], default: [] },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedToName: { type: String, default: '', trim: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedByName: { type: String, default: '', trim: true },
    assignedAt: { type: Date, default: null },
    reassignmentHistory: { type: [reassignmentEventSchema], default: [] },
    dueDate: { type: Date, default: null, index: true },
    reminder: {
      type: reminderSchema,
      default: () => ({ enabled: false, status: 'Scheduled' }),
    },
    conversation: { type: [messageSchema], default: [] },
    internalNotes: { type: [internalNoteSchema], default: [] },
    resolution: {
      details: { type: String, default: '', trim: true },
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      resolvedByName: { type: String, default: '', trim: true },
      resolvedAt: { type: Date, default: null },
    },
    closure: {
      details: { type: String, default: '', trim: true },
      closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      closedByName: { type: String, default: '', trim: true },
      closedAt: { type: Date, default: null },
    },
    reopen: {
      reason: { type: String, default: '', trim: true },
      reopenedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      reopenedByName: { type: String, default: '', trim: true },
      reopenedAt: { type: Date, default: null },
    },
    history: { type: [historyEventSchema], default: [] },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdByName: { type: String, default: '', trim: true },
  },
  {
    timestamps: true,
  }
);

// Helpful Compound and Text Indexes
hrSupportRequestSchema.index({ createdAt: -1 });
hrSupportRequestSchema.index({ employee: 1, createdAt: -1 });
hrSupportRequestSchema.index({ status: 1, priority: 1 });
hrSupportRequestSchema.index({ assignedTo: 1, status: 1 });

export default mongoose.models.HRSupportRequest ||
  mongoose.model('HRSupportRequest', hrSupportRequestSchema, 'hrsupportrequests');
