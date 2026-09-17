import mongoose from 'mongoose';

const checklistItemSchema = new mongoose.Schema(
  {
    task: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['Documentation', 'Finance', 'IT Setup', 'HR & Orientation'],
      default: 'Documentation',
    },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Completed', 'Not Applicable'],
      default: 'Pending',
    },
    owner: { type: String, default: 'HR Operations', trim: true },
    dueDate: { type: Date, default: null },
    completionDate: { type: Date, default: null },
    remarks: { type: String, default: '', trim: true },
  },
  { _id: true }
);

const auditEventSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true },
    previousStatus: { type: String, default: '', trim: true },
    newStatus: { type: String, default: '', trim: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    performedByName: { type: String, default: 'HR Manager', trim: true },
    remarks: { type: String, default: '', trim: true },
    date: { type: Date, default: Date.now },
  },
  { _id: true }
);

const onboardingSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
      default: null,
    },
    employeeId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    designation: {
      type: String,
      required: true,
      trim: true,
    },
    joiningDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    employmentType: {
      type: String,
      enum: ['Full Time', 'Part Time', 'Contract', 'Intern'],
      default: 'Full Time',
    },
    reportingManager: {
      type: String,
      default: '',
      trim: true,
    },
    workLocation: {
      type: String,
      default: 'Headquarters / Main Office',
      trim: true,
    },
    contactInformation: {
      phone: { type: String, default: '', trim: true },
      email: { type: String, default: '', trim: true },
      address: { type: String, default: '', trim: true },
    },
    emergencyContact: {
      name: { type: String, default: '', trim: true },
      relationship: { type: String, default: '', trim: true },
      phone: { type: String, default: '', trim: true },
    },
    assignedHr: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Completed'],
      default: 'Pending',
      index: true,
    },
    remarks: {
      type: String,
      default: '',
      trim: true,
    },
    completionDate: {
      type: Date,
      default: null,
    },
    checklist: {
      type: [checklistItemSchema],
      default: [],
    },
    auditTrail: {
      type: [auditEventSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// Standard 17-item Onboarding checklist factory
export const getDefaultChecklist = (joiningDate = new Date()) => {
  const d = new Date(joiningDate);
  const addDays = (days) => new Date(d.getTime() + days * 86400000);

  return [
    { task: 'Personal Information Form', category: 'Documentation', status: 'Pending', owner: 'Employee / HR', dueDate: addDays(1), remarks: '' },
    { task: 'ID Proof (Aadhaar / Passport / Voter ID)', category: 'Documentation', status: 'Pending', owner: 'HR Operations', dueDate: addDays(2), remarks: '' },
    { task: 'Address Proof Verification', category: 'Documentation', status: 'Pending', owner: 'HR Operations', dueDate: addDays(2), remarks: '' },
    { task: 'Educational Certificates & Marksheets', category: 'Documentation', status: 'Pending', owner: 'HR Operations', dueDate: addDays(3), remarks: '' },
    { task: 'Previous Employment & Relieving Letters', category: 'Documentation', status: 'Pending', owner: 'HR Operations', dueDate: addDays(3), remarks: '' },
    { task: 'Signed Offer & Appointment Letter', category: 'Documentation', status: 'Pending', owner: 'HR Operations', dueDate: addDays(1), remarks: '' },
    { task: 'Bank Account & Cancelled Cheque Details', category: 'Finance', status: 'Pending', owner: 'Finance & Payroll', dueDate: addDays(4), remarks: '' },
    { task: 'Tax Declarations & PAN Submission', category: 'Finance', status: 'Pending', owner: 'Finance & Payroll', dueDate: addDays(5), remarks: '' },
    { task: 'Emergency Contact Information', category: 'HR & Orientation', status: 'Pending', owner: 'HR Operations', dueDate: addDays(1), remarks: '' },
    { task: 'Company Policy & Code of Conduct Sign-off', category: 'HR & Orientation', status: 'Pending', owner: 'HR Operations', dueDate: addDays(2), remarks: '' },
    { task: 'Workstation & IT Network Setup', category: 'IT Setup', status: 'Pending', owner: 'IT Support', dueDate: addDays(0), remarks: '' },
    { task: 'Official Email Account Creation', category: 'IT Setup', status: 'Pending', owner: 'IT Support', dueDate: addDays(0), remarks: '' },
    { task: 'Company CRM & System Access Credentials', category: 'IT Setup', status: 'Pending', owner: 'IT Support', dueDate: addDays(1), remarks: '' },
    { task: 'Laptop & Hardware Asset Allocation', category: 'IT Setup', status: 'Pending', owner: 'IT Support', dueDate: addDays(0), remarks: '' },
    { task: 'HR Induction & Culture Orientation', category: 'HR & Orientation', status: 'Pending', owner: 'HR Manager', dueDate: addDays(1), remarks: '' },
    { task: 'Department Training & Project Assignment', category: 'HR & Orientation', status: 'Pending', owner: 'Department Head', dueDate: addDays(7), remarks: '' },
    { task: 'Reporting Manager & Team Introduction', category: 'HR & Orientation', status: 'Pending', owner: 'Reporting Manager', dueDate: addDays(1), remarks: '' },
  ];
};

export default mongoose.models.Onboarding || mongoose.model('Onboarding', onboardingSchema, 'onboardings');
