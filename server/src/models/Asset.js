import mongoose from 'mongoose';

const assetHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'Created',
        'Assigned',
        'Returned',
        'Transferred',
        'Maintenance Started',
        'Maintenance Completed',
        'Marked Lost',
        'Marked Damaged',
        'Retired',
        'Disposed',
        'Updated',
      ],
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    performedByName: {
      type: String,
      trim: true,
      default: '',
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    employeeName: {
      type: String,
      trim: true,
      default: '',
    },
    date: {
      type: Date,
      default: Date.now,
    },
    previousStatus: {
      type: String,
      trim: true,
      default: '',
    },
    newStatus: {
      type: String,
      trim: true,
      default: '',
    },
    condition: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: true, timestamps: false }
);

const assetSchema = new mongoose.Schema(
  {
    assetName: {
      type: String,
      required: [true, 'Asset name is required'],
      trim: true,
      maxlength: 120,
    },
    assetCode: {
      type: String,
      required: [true, 'Asset code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Asset category is required'],
      enum: [
        'Laptop',
        'Desktop',
        'Monitor',
        'Mobile Device',
        'Networking',
        'Peripheral / Accessory',
        'Furniture',
        'Audio / Visual',
        'Other',
      ],
      default: 'Laptop',
    },
    brand: {
      type: String,
      trim: true,
      default: '',
    },
    model: {
      type: String,
      trim: true,
      default: '',
    },
    serialNumber: {
      type: String,
      trim: true,
      default: '',
    },
    purchaseDate: {
      type: Date,
      default: null,
    },
    purchaseCost: {
      type: Number,
      default: 0,
      min: [0, 'Purchase cost cannot be negative'],
    },
    vendor: {
      type: String,
      trim: true,
      default: '',
    },
    warrantyStart: {
      type: Date,
      default: null,
    },
    warrantyExpiry: {
      type: Date,
      default: null,
    },
    condition: {
      type: String,
      enum: ['New', 'Good', 'Fair', 'Damaged', 'Needs Repair'],
      default: 'Good',
    },
    status: {
      type: String,
      enum: [
        'Available',
        'Allocated',
        'Under Repair',
        'Returned',
        'Lost',
        'Damaged',
        'Retired',
        'Disposed',
      ],
      default: 'Available',
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedDate: {
      type: Date,
      default: null,
    },
    department: {
      type: String,
      trim: true,
      default: '',
    },
    location: {
      type: String,
      trim: true,
      default: 'Headquarters / Main Office',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdByName: {
      type: String,
      trim: true,
      default: '',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedByName: {
      type: String,
      trim: true,
      default: '',
    },
    history: [assetHistorySchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
assetSchema.index({ assignedTo: 1, status: 1 });
assetSchema.index({ category: 1, status: 1 });
assetSchema.index({ createdAt: -1 });

export default mongoose.models.Asset || mongoose.model('Asset', assetSchema);
