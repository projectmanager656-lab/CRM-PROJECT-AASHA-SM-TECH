import mongoose from 'mongoose';

const employeeHistorySchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    employeeName: {
      type: String,
      required: true,
      trim: true,
    },
    employeeId: {
      type: String,
      default: '',
      trim: true,
    },
    changeType: {
      type: String,
      enum: [
        'Joining',
        'Transfer',
        'Promotion',
        'Designation Change',
        'Status Change',
        'Manager Change',
        'Location Change',
        'Other',
      ],
      default: 'Other',
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    previousDepartment: { type: String, default: '', trim: true },
    newDepartment: { type: String, default: '', trim: true },
    previousDesignation: { type: String, default: '', trim: true },
    newDesignation: { type: String, default: '', trim: true },
    previousManager: { type: String, default: '', trim: true },
    newManager: { type: String, default: '', trim: true },
    previousStatus: { type: String, default: '', trim: true },
    newStatus: { type: String, default: '', trim: true },
    previousLocation: { type: String, default: '', trim: true },
    newLocation: { type: String, default: '', trim: true },
    effectiveDate: { type: Date, default: Date.now },
    reason: { type: String, default: '', trim: true },
    remarks: { type: String, default: '', trim: true },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    performedByName: {
      type: String,
      default: 'HR Manager',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const EmployeeHistory =
  mongoose.models.EmployeeHistory ||
  mongoose.model('EmployeeHistory', employeeHistorySchema, 'employeehistories');

export default EmployeeHistory;
