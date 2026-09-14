import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: {
      type: String,
      required: [true, 'Payment number is required'],
      trim: true,
      index: true,
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
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
    },
    employeeName: {
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

export const Payment =
  mongoose.models.Payment || mongoose.model('Payment', paymentSchema, 'payments');

export default Payment;
