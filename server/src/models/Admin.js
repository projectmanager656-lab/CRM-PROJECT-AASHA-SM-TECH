import mongoose from 'mongoose';
import { createAccountSchema } from './accountSchema.js';
export default mongoose.models.Admin || mongoose.model('Admin', createAccountSchema('admin'), 'admins');
