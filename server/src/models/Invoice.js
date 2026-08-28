import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  invoiceNumber: { type: String, required: true, unique: true },
  clientName: { type: String, required: true, trim: true },
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
  status: { type: String, enum: ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'], default: 'Sent' },
  description: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.models.Invoice || mongoose.model('Invoice', schema, 'invoices');
