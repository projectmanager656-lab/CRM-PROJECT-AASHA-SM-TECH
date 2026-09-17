import mongoose from 'mongoose';

const accessAuditSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    employeeName: { type: String, required: true, trim: true },
    employeeId: { type: String, default: '', trim: true },
    department: { type: String, default: '', trim: true },
    designation: { type: String, default: '', trim: true },
    role: { type: String, default: 'employee', trim: true },
    moduleKey: { type: String, default: '', trim: true },
    moduleName: { type: String, default: '', trim: true },
    permission: { type: String, default: '', trim: true },
    previousStatus: {
      type: String,
      default: 'Active',
    },
    newStatus: {
      type: String,
      default: 'Active',
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    sensitiveCategory: { type: String, default: '', trim: true },
    result: {
      type: String,
      enum: ['SUCCESS', 'DENIED', 'FAILED'],
      default: 'SUCCESS',
    },
    ipAddress: { type: String, default: '', trim: true },
    userAgent: { type: String, default: '', trim: true },
    reason: { type: String, default: '', trim: true },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    performedByName: { type: String, default: 'System Admin', trim: true },
    date: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export default mongoose.models.AccessAudit || mongoose.model('AccessAudit', accessAuditSchema, 'accessaudits');
