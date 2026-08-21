import mongoose from 'mongoose';

const actionSchema = new mongoose.Schema(
  {
    view: { type: Boolean, default: false },
    read: { type: Boolean, default: false },
    create: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
    export: { type: Boolean, default: false },
    import: { type: Boolean, default: false },
    approve: { type: Boolean, default: false },
    assign: { type: Boolean, default: false },
    manage: { type: Boolean, default: false },
  },
  { _id: false }
);

const resourcePermissionSchema = new mongoose.Schema(
  {
    resourceKey: {
      type: String,
      required: true,
      trim: true,
    },
    resourceName: {
      type: String,
      required: true,
      trim: true,
    },
    resourcePath: {
      type: String,
      default: '',
      trim: true,
    },
    resourcePaths: {
      type: [String],
      default: [],
    },
    actions: {
      type: actionSchema,
      default: () => ({}),
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false }
);

const rolePermissionSchema = new mongoose.Schema(
  {
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
      index: true,
    },
    roleKey: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      immutable: true,
      index: true,
    },
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Module',
      required: true,
      index: true,
    },
    moduleKey: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      immutable: true,
      index: true,
    },
    moduleEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    resourcePermissions: {
      type: [resourcePermissionSchema],
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

rolePermissionSchema.index({ roleId: 1, moduleId: 1 }, { unique: true });
rolePermissionSchema.index({ roleKey: 1, moduleKey: 1 }, { unique: true });

rolePermissionSchema.methods.toJSON = function () {
  const permission = this.toObject();
  return permission;
};

export default mongoose.models.RolePermission ||
  mongoose.model('RolePermission', rolePermissionSchema, 'rolepermissions');

