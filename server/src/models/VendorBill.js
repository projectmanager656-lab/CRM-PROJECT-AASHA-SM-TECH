import mongoose from 'mongoose';

const vendorBillSchema = new mongoose.Schema(
  {
    billNumber: {
      type: String,
      required: [true, 'Bill number is required'],
      trim: true,
      index: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: [true, 'Vendor is required'],
      index: true,
    },
    vendorName: {
      type: String,
      default: '',
      trim: true,
    },
    billDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    dueDate: {
      type: Date,
      index: true,
    },
    category: {
      type: String,
      default: 'General',
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Base amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    balance: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Partially Paid', 'Paid', 'Rejected'],
      default: 'Pending',
      index: true,
    },
    approvalStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    receiptUrl: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

vendorBillSchema.pre('save', function (next) {
  const base = Number(this.amount) || 0;
  const taxVal = Number(this.tax) || 0;
  this.totalAmount = Math.round((base + taxVal) * 100) / 100;
  const paid = Number(this.paidAmount) || 0;
  this.balance = Math.max(0, Math.round((this.totalAmount - paid) * 100) / 100);

  if (this.balance === 0 && paid > 0) {
    this.status = 'Paid';
  } else if (paid > 0 && this.balance > 0) {
    this.status = 'Partially Paid';
  } else if (this.approvalStatus === 'Approved' && paid === 0) {
    this.status = 'Approved';
  } else if (this.approvalStatus === 'Rejected') {
    this.status = 'Rejected';
  }
  next();
});

export const VendorBill =
  mongoose.models.VendorBill || mongoose.model('VendorBill', vendorBillSchema, 'vendorbills');

export default VendorBill;
