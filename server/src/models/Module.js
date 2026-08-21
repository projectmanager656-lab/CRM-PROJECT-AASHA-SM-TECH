import mongoose from 'mongoose';

const resourceSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    path: {
      type: String,
      default: '',
      trim: true,
    },
    paths: {
      type: [String],
      default: [],
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    actions: {
      type: [String],
      default: [],
    },
    sidebarVisible: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false }
);

const moduleSchema = new mongoose.Schema(
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
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      immutable: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    icon: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      default: 'core',
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
      index: true,
    },
    sidebarVisible: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    dependencies: {
      type: [String],
      default: [],
    },
    features: {
      type: [String],
      default: [],
    },
    resources: {
      type: [resourceSchema],
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

moduleSchema.index({ key: 1 }, { unique: true });
moduleSchema.index({ slug: 1 }, { unique: true });
moduleSchema.index({ status: 1, displayOrder: 1 });

moduleSchema.methods.toJSON = function () {
  const module = this.toObject();
  return module;
};

export default mongoose.models.Module || mongoose.model('Module', moduleSchema, 'modules');

