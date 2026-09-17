import mongoose from 'mongoose';

export const DOCUMENT_CATEGORIES = [
  'Identity Proof',
  'Education Certificate',
  'Employment',
  'Payroll / Financial',
  'Other HR',
  // Legacy / Direct Category Support
  'Address Proof',
  'PAN Card',
  'Aadhaar / Government ID',
  'Passport',
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

export const DOCUMENT_TYPES = {
  'Identity Proof': ['Aadhaar Card', 'PAN Card', 'Passport', 'Driving Licence', 'Voter ID', 'Other ID Proof'],
  'Education Certificate': ['10th Certificate', '12th Certificate', 'Degree Certificate', 'Diploma', 'Marksheet', 'Professional Certification'],
  'Employment': ['Offer Letter', 'Appointment Letter', 'Employment Agreement', 'Joining Letter', 'Promotion Letter', 'Transfer Letter', 'Salary Revision Letter', 'Experience Letter', 'Relieving Letter'],
  'Payroll / Financial': ['Payslip', 'Salary Documents', 'Tax Documents', 'Investment Declaration', 'Bank Proof'],
  'Other HR': ['Medical Certificate', 'Insurance Document', 'Emergency Contact Form', 'Employee Form', 'Other'],
};

const documentSchema = new mongoose.Schema(
  {
    documentId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
    },
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
      default: 'Other HR',
      index: true,
    },
    documentType: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    department: {
      type: String,
      trim: true,
      default: '',
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
      enum: ['Pending', 'Pending Verification', 'Under Review', 'Verified', 'Rejected', 'Re-upload Required'],
      default: 'Pending Verification',
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    rootDocument: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      default: null,
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
      index: true,
    },
    history: [
      {
        action: { type: String, required: true },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        performedByName: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
        details: { type: String, default: '' },
        rejectionReason: { type: String, default: '' },
        version: { type: Number, default: 1 },
      },
    ],
  },
  {
    timestamps: true,
  }
);

documentSchema.pre('save', function (next) {
  if (!this.documentId) {
    const year = new Date().getFullYear();
    const random = Math.floor(100000 + Math.random() * 900000);
    this.documentId = `DOC-${year}-${random}`;
  }
  if (!this.rootDocument) {
    this.rootDocument = this._id;
  }
  next();
});

export const Document = mongoose.models.Document || mongoose.model('Document', documentSchema, 'documents');
export default Document;
