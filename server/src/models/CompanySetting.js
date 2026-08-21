import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'company' },
  companyName: { type: String, default: '' }, companyContact: { type: String, default: '' }, officeAddress: { type: String, default: '' },
  requiredWorkingHours: { type: Number, min: 0, default: 8 },
  allowedIpAddresses: { type: [String], default: [] }, enableIpValidation: { type: Boolean, default: false },
  officeLatitude: { type: Number, default: null }, officeLongitude: { type: Number, default: null },
  allowedGpsRadius: { type: Number, min: 0, default: 100 }, enableGpsValidation: { type: Boolean, default: false },
  enableAttendancePhoto: { type: Boolean, default: false },
}, { timestamps: true });
export default mongoose.models.CompanySetting || mongoose.model('CompanySetting', schema, 'companysettings');
