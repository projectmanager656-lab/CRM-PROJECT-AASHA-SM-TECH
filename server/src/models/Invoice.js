import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  invoiceNumber: { type: String, required: true, unique: true },
  clientName: { type: String, required: true, trim: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null, index: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
  proposal: { type: mongoose.Schema.Types.ObjectId, ref: 'Proposal', default: null },
  mobileNo: { type: String, default: '' },
  gstin: { type: String, default: '' },
  address: { type: String, default: '' },
  issueDate: { type: Date, required: true },
  dueDate: { type: Date },
  amount: { type: Number, required: true, min: 0 },
  cgst: { type: Number, default: 0, min: 0 },
  sgst: { type: Number, default: 0, min: 0 },
  qty: { type: Number, default: 1, min: 1 },
  currency: { type: String, default: 'INR' },
  status: { 
    type: String, 
    enum: ['Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'], 
    default: 'Sent',
    index: true
  },
  paidAmount: { type: Number, default: 0, min: 0 },
  balance: { type: Number, default: 0, min: 0 },
  description: { type: String, default: '' },
  items: [
    {
      description: { type: String, default: '' },
      qty: { type: Number, default: 1 },
      rate: { type: Number, default: 0 },
      amount: { type: Number, default: 0 }
    }
  ],
  paymentHistory: [
    {
      payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
      paymentNumber: { type: String, default: '' },
      amount: { type: Number, default: 0 },
      paymentDate: { type: Date, default: Date.now },
      paymentMethod: { type: String, default: 'Bank Transfer' },
      transactionReference: { type: String, default: '' },
      bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount', default: null },
      recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
    }
  ],
  recovery: {
    status: {
      type: String,
      enum: ['Not Started', 'In Progress', 'Promised', 'Escalated', 'Recovered'],
      default: 'Not Started',
      index: true
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    ownerName: { type: String, default: '' },
    lastFollowUp: { type: Date, default: null },
    nextFollowUp: { type: Date, default: null },
    promiseToPayDate: { type: Date, default: null },
    notes: [
      {
        date: { type: Date, default: Date.now },
        note: { type: String, required: true },
        followUpBy: { type: String, default: '' }
      }
    ]
  }
}, { timestamps: true });

schema.pre('save', function (next) {
  const totalInvoice = (Number(this.amount) || 0) + (Number(this.cgst) || 0) + (Number(this.sgst) || 0);
  const paid = Number(this.paidAmount) || 0;
  this.balance = Math.max(0, Math.round((totalInvoice - paid) * 100) / 100);
  if (this.balance === 0 && paid > 0 && this.status !== 'Cancelled') {
    this.status = 'Paid';
  } else if (paid > 0 && this.balance > 0 && this.status !== 'Cancelled') {
    this.status = 'Partially Paid';
  }
  next();
});

export default mongoose.models.Invoice || mongoose.model('Invoice', schema, 'invoices');
