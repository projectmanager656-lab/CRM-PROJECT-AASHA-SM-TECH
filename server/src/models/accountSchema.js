import bcryptjs from 'bcryptjs';
import mongoose from 'mongoose';

export const createAccountSchema = (role) => {
  const schema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    role: { type: String, enum: [role], default: role, immutable: true },
    rbacRoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null, index: true },
    rbacRoleKey: { type: String, default: '', lowercase: true, trim: true, index: true },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
  }, { timestamps: true });
  schema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try { this.password = await bcryptjs.hash(this.password, 10); next(); } catch (error) { next(error); }
  });
  schema.methods.comparePassword = function (password) { return bcryptjs.compare(password, this.password); };
  schema.methods.toJSON = function () { const account = this.toObject(); delete account.password; return account; };
  return schema;
};
