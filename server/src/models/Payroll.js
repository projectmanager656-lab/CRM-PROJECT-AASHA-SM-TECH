import mongoose from 'mongoose';

const payrollSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    month: {
      type: String,
      required: true,
    },
    payPeriod: {
      type: String,
      required: true,
    },
    effectiveDate: {
      type: Date,
      required: true,
    },
    basicSalary: {
      type: Number,
      required: true,
      min: 0,
    },
    allowances: {
      type: Number,
      default: 0,
      min: 0,
    },
    bonus: {
      type: Number,
      default: 0,
      min: 0,
    },
    incentive: {
      type: Number,
      default: 0,
      min: 0,
    },
    overtime: {
      type: Number,
      default: 0,
      min: 0,
    },
    salaryAdvance: {
      type: Number,
      default: 0,
      min: 0,
    },
    lopDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    lopDeductions: {
      type: Number,
      default: 0,
      min: 0,
    },
    gross: {
      type: Number,
      required: true,
      min: 0,
    },
    deductions: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalDeduction: {
      type: Number,
      default: 0,
      min: 0,
    },
    net: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['Pending', 'Processing', 'Processed', 'Paid', 'Draft'],
      default: 'Pending',
    },
    notes: {
      type: String,
      default: '',
    },
    paymentDate: {
      type: Date,
      default: null,
    },
    paymentMethod: {
      type: String,
      enum: ['Bank Transfer', 'UPI', 'Cheque', 'Cash', 'Direct Deposit', 'Other', ''],
      default: 'Bank Transfer',
    },
    paymentReference: {
      type: String,
      default: '',
      trim: true,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

payrollSchema.index({ user: 1, payPeriod: 1 }, { unique: true });

export const Payroll = mongoose.models.Payroll || mongoose.model('Payroll', payrollSchema, 'payroll');
export default Payroll;
