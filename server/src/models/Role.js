import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      immutable: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    type: {
      type: String,
      enum: ['system', 'custom'],
      default: 'system',
      index: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Archived'],
      default: 'Active',
      index: true,
    },
    isProtected: {
      type: Boolean,
      default: false,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    parentRoleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      default: null,
    },
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

roleSchema.index({ key: 1 }, { unique: true });
roleSchema.index({ status: 1, sortOrder: 1 });

roleSchema.methods.toJSON = function () {
  const role = this.toObject();
  return role;
};

export default mongoose.models.Role || mongoose.model('Role', roleSchema, 'roles');

