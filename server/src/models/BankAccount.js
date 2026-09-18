import mongoose from 'mongoose';

const bankAccountSchema = new mongoose.Schema(
  {
    accountName: {
      type: String,
      required: [true, 'Account name is required'],
      trim: true,
    },
    bankName: {
      type: String,
      required: [true, 'Bank name is required'],
      trim: true,
    },
    accountNumber: {
      type: String,
      required: [true, 'Account number is required'],
      trim: true,
    },
    maskedAccountNumber: {
      type: String,
      default: '',
      trim: true,
    },
    ifscCode: {
      type: String,
      default: '',
      trim: true,
    },
    branch: {
      type: String,
      default: '',
      trim: true,
    },
    accountType: {
      type: String,
      enum: ['Current', 'Savings', 'Overdraft', 'Cash'],
      default: 'Current',
      index: true,
    },
    openingBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentBalance: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    reconciliationStatus: {
      type: String,
      enum: ['Reconciled', 'Pending', 'Discrepancy'],
      default: 'Reconciled',
    },
    lastReconciledDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

bankAccountSchema.pre('save', function (next) {
  if (this.accountNumber && this.accountNumber.length > 4) {
    const last4 = this.accountNumber.slice(-4);
    this.maskedAccountNumber = `••••••••${last4}`;
  } else {
    this.maskedAccountNumber = this.accountNumber || '';
  }
  next();
});

export const BankAccount =
  mongoose.models.BankAccount || mongoose.model('BankAccount', bankAccountSchema, 'bankaccounts');

export default BankAccount;
