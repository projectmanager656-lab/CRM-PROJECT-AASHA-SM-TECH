import mongoose from 'mongoose';
import { createAccountSchema } from './accountSchema.js';
export default mongoose.models.SuperAdmin || mongoose.model('SuperAdmin', createAccountSchema('super_admin'), 'superadmins');
