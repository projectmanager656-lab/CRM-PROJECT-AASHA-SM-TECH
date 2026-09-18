import mongoose from 'mongoose';

const bankReconciliationSchema = new mongoose.Schema(
  {
    bankAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccount',
      required: true,
      index: true,
    },
    statementDate: {
      type: Date,
      required: true,
      index: true,
    },
    statementBalance: {
      type: Number,
      required: true,
    },
    ledgerBalance: {
      type: Number,
      required: true,
    },
    difference: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Pending', 'Reconciled', 'Discrepancy'],
      default: 'Pending',
      index: true,
    },
    matchedTransactions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment',
      },
    ],
    unmatchedTransactions: [
      {
        date: { type: Date, default: Date.now },
        description: { type: String, default: '' },
        amount: { type: Number, default: 0 },
        type: { type: String, enum: ['Credit', 'Debit'], default: 'Credit' },
        reference: { type: String, default: '' },
        status: { type: String, enum: ['Unresolved', 'Explained', 'CreatedEntry'], default: 'Unresolved' },
        resolutionNote: { type: String, default: '' },
      },
    ],
    notes: {
      type: String,
      default: '',
    },
    reconciledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reconciledByName: {
      type: String,
      default: '',
    },
    reconciledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

bankReconciliationSchema.pre('save', function (next) {
  this.difference = Math.round((this.statementBalance - this.ledgerBalance) * 100) / 100;
  if (Math.abs(this.difference) < 0.01 && this.unmatchedTransactions.every(u => u.status !== 'Unresolved')) {
    this.status = 'Reconciled';
  } else {
    this.status = this.difference !== 0 ? 'Discrepancy' : 'Pending';
  }
  next();
});

export const BankReconciliation =
  mongoose.models.BankReconciliation ||
  mongoose.model('BankReconciliation', bankReconciliationSchema, 'bankreconciliations');

export default BankReconciliation;
