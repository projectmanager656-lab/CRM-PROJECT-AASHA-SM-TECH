import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, trim: true, default: '' },
  company: { type: String, trim: true, default: '' },
  address: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['Active', 'Inactive', 'Prospect'], default: 'Active' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

export default mongoose.models.Client || mongoose.model('Client', clientSchema, 'clients');
