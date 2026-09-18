import mongoose from 'mongoose';

const financeAuditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      enum: [
        'Invoice',
        'Payment',
        'Expense',
        'Vendor',
        'VendorBill',
        'PaymentRequest',
        'BankAccount',
        'Payroll',
        'Settlement',
        'Reconciliation',
        'Configuration',
      ],
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    reference: {
      type: String,
      default: '',
      trim: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    performedByName: {
      type: String,
      default: 'System / User',
      trim: true,
    },
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    amount: {
      type: Number,
      default: null,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

financeAuditSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });

export const FinanceAudit =
  mongoose.models.FinanceAudit ||
  mongoose.model('FinanceAudit', financeAuditSchema, 'financeaudits');

export default FinanceAudit;
