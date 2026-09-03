import mongoose from 'mongoose';

export const DOCUMENT_CATEGORIES = [
  'Identity Proof',
  'Address Proof',
  'PAN Card',
  'Aadhaar / Government ID',
  'Passport',
  'Education Certificate',
  'Experience Letter',
  'Offer Letter',
  'Appointment Letter',
  'Employment Contract',
  'Joining Documents',
  'Bank Documents',
  'Salary / Payroll Documents',
  'Performance Documents',
  'Leave Documents',
  'Company Documents',
  'Other',
];

const documentSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Document owner is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Document name is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: DOCUMENT_CATEGORIES,
      default: 'Other',
      index: true,
    },
    documentNumber: {
      type: String,
      trim: true,
      default: '',
    },
    issueDate: {
      type: Date,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
      index: true,
    },
    storedName: {
      type: String,
      required: [true, 'Stored filename is required'],
    },
    mimeType: {
      type: String,
      required: [true, 'Mime type is required'],
    },
    size: {
      type: Number,
      required: [true, 'File size is required'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['Pending', 'Verified', 'Rejected'],
      default: 'Pending',
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    uploadedByName: {
      type: String,
      trim: true,
      default: '',
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verifiedByName: {
      type: String,
      trim: true,
      default: '',
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectedByName: {
      type: String,
      trim: true,
      default: '',
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    replacedDocument: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      default: null,
    },
    replacedAt: {
      type: Date,
      default: null,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const Document = mongoose.models.Document || mongoose.model('Document', documentSchema, 'documents');
export default Document;
