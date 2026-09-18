import mongoose from 'mongoose';

const paymentRequestSchema = new mongoose.Schema(
  {
    requestNumber: {
      type: String,
      required: [true, 'Request number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requesterName: {
      type: String,
      default: '',
      trim: true,
    },
    department: {
      type: String,
      default: 'Finance',
      trim: true,
    },
    paymentType: {
      type: String,
      enum: ['Vendor', 'Employee', 'Client', 'Utility', 'Tax', 'Other'],
      default: 'Vendor',
      index: true,
    },
    payeeName: {
      type: String,
      required: [true, 'Payee name is required'],
      trim: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      default: null,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    reason: {
      type: String,
      required: [true, 'Reason for payment request is required'],
      trim: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    projectName: {
      type: String,
      default: '',
    },
    relatedInvoice: {
      type: String,
      default: '',
    },
    supportingDocumentUrl: {
      type: String,
      default: '',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium',
    },
    requiredDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['Draft', 'Submitted', 'Approved', 'Rejected', 'Paid'],
      default: 'Submitted',
      index: true,
    },
    approvalThreshold: {
      type: Number,
      default: 50000,
    },
    requiresSuperAdmin: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedByName: {
      type: String,
      default: '',
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    paidAt: {
      type: Date,
      default: null,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    bankAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccount',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

paymentRequestSchema.index({ status: 1, createdAt: -1 });

export const PaymentRequest =
  mongoose.models.PaymentRequest || mongoose.model('PaymentRequest', paymentRequestSchema, 'paymentrequests');

export default PaymentRequest;
