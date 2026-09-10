import mongoose from 'mongoose';

const offerHistorySchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    performedByName: { type: String, default: '', trim: true },
    note: { type: String, default: '', trim: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const offerLetterSchema = new mongoose.Schema(
  {
    offerNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
      required: [true, 'Candidate reference is required'],
      index: true,
    },
    convertedEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    offeredDesignation: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true, index: true },
    employmentType: {
      type: String,
      enum: ['Full Time', 'Part Time', 'Contract', 'Intern'],
      default: 'Full Time',
      index: true,
    },
    salary: { type: String, default: 'Competitive', trim: true },
    probationPeriod: { type: String, default: '6 Months', trim: true },
    workLocation: { type: String, default: '', trim: true },
    reportingManager: { type: String, default: '', trim: true },
    workingHours: { type: String, default: '9:00 AM - 6:00 PM (Mon-Sat)', trim: true },
    noticePeriod: { type: String, default: '30 Days', trim: true },
    termsAndConditions: { type: String, default: '', trim: true },
    additionalNotes: { type: String, default: '', trim: true },
    offerDate: { type: Date, default: Date.now, index: true },
    joiningDate: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    withdrawnAt: { type: Date, default: null },
    convertedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Withdrawn'],
      default: 'Draft',
      index: true,
    },
    history: { type: [offerHistorySchema], default: [] },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

offerLetterSchema.index({ candidate: 1, isDeleted: 1 });
offerLetterSchema.index({ status: 1, isDeleted: 1 });
offerLetterSchema.index({ offerDate: -1 });

export default mongoose.models.OfferLetter ||
  mongoose.model('OfferLetter', offerLetterSchema, 'offerletters');
