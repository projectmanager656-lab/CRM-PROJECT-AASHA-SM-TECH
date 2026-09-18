import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: {
      type: String,
      required: [true, 'Payment number is required'],
      trim: true,
      index: true,
    },
    transactionType: {
      type: String,
      enum: ['Income', 'Expense', 'Transfer'],
      default: 'Income',
      index: true,
    },
    entryType: {
      type: String,
      enum: ['Credit', 'Debit'],
      default: 'Credit',
    },
    category: {
      type: String,
      default: 'Client Payment',
      trim: true,
      index: true,
    },
    source: {
      type: String,
      default: 'Client',
      trim: true,
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
      index: true,
    },
    payroll: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payroll',
      default: null,
      index: true,
    },
    settlement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FullAndFinalSettlement',
      default: null,
      index: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
      index: true,
    },
    clientName: {
      type: String,
      default: '',
      trim: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    employeeName: {
      type: String,
      default: '',
      trim: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      default: null,
      index: true,
    },
    vendorName: {
      type: String,
      default: '',
      trim: true,
    },
    vendorBill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VendorBill',
      default: null,
      index: true,
    },
    paymentRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentRequest',
      default: null,
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true,
    },
    expense: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expense',
      default: null,
      index: true,
    },
    bankAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccount',
      default: null,
      index: true,
    },
    bankAccountName: {
      type: String,
      default: '',
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    paymentMethod: {
      type: String,
      default: 'Bank Transfer',
      trim: true,
    },
    transactionReference: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['Completed', 'Pending', 'Processing', 'Failed', 'Cancelled'],
      default: 'Completed',
      index: true,
    },
    isReconciled: {
      type: Boolean,
      default: false,
      index: true,
    },
    reconciledAt: {
      type: Date,
      default: null,
    },
    reconciledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ transactionType: 1, status: 1 });

export const Payment =
  mongoose.models.Payment || mongoose.model('Payment', paymentSchema, 'payments');

export default Payment;
