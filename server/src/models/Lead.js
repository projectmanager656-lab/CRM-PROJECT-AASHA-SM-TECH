import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, trim: true, default: '' },
  company: { type: String, trim: true, default: '' },
  source: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'], default: 'New' },
  notes: { type: String, trim: true, default: '' },
  decisionMaker: { type: String, trim: true, default: '' },
  location: { type: String, trim: true, default: '' },
  category: { type: String, trim: true, default: '' },
  websiteStatus: { type: String, enum: ['Not Checked', 'Active', 'Inactive', 'Not Available'], default: 'Not Checked' },
  instagramStatus: { type: String, enum: ['Not Checked', 'Active', 'Inactive', 'Not Available'], default: 'Not Checked' },
  gmbStatus: { type: String, enum: ['Not Checked', 'Active', 'Inactive', 'Not Available'], default: 'Not Checked' },
  requirement: { type: String, trim: true, default: '' },
  lastContact: { type: Date, default: null },
  nextFollowUp: { type: Date, default: null },
  proposalValue: { type: Number, min: 0, default: null },
  result: { type: String, trim: true, default: '' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

export default mongoose.models.Lead || mongoose.model('Lead', leadSchema, 'leads');
