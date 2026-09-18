import mongoose from 'mongoose';

const proposalItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    qty: { type: Number, default: 1, min: 1 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const proposalSchema = new mongoose.Schema(
  {
    proposalNumber: {
      type: String,
      required: [true, 'Proposal number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
      index: true,
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    items: [proposalItemSchema],
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      default: 0,
      min: 0,
    },
    validUntil: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['Draft', 'Sent', 'Accepted', 'Declined', 'Converted to Invoice'],
      default: 'Sent',
      index: true,
    },
    convertedInvoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

proposalSchema.pre('save', function (next) {
  const sub = this.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  this.subtotal = Math.round(sub * 100) / 100;
  const taxAmount = Number(this.tax) || 0;
  const discountAmount = Number(this.discount) || 0;
  this.total = Math.max(0, Math.round((this.subtotal + taxAmount - discountAmount) * 100) / 100);
  next();
});

export const Proposal =
  mongoose.models.Proposal || mongoose.model('Proposal', proposalSchema, 'proposals');

export default Proposal;
