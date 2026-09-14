import mongoose from 'mongoose';

const letterHistorySchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    performedByName: { type: String, default: '', trim: true },
    note: { type: String, default: '', trim: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const experienceLetterSchema = new mongoose.Schema(
  {
    letterNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Employee reference is required'],
      index: true,
    },
    employeeName: {
      type: String,
      required: [true, 'Employee name is required'],
      trim: true,
    },
    employeeId: {
      type: String,
      default: '',
      trim: true,
    },
    designation: {
      type: String,
      required: [true, 'Designation is required'],
      trim: true,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
      index: true,
    },
    joiningDate: {
      type: Date,
      required: [true, 'Joining date is required'],
    },
    relievingDate: {
      type: Date,
      required: [true, 'Relieving date is required'],
    },
    employmentDuration: {
      type: String,
      default: '',
      trim: true,
    },
    letterDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    workLocation: {
      type: String,
      default: 'Head Office, Mumbai',
      trim: true,
    },
    conduct: {
      type: String,
      default: 'Exemplary',
      trim: true,
    },
    reasonForLeaving: {
      type: String,
      default: 'Resignation / Personal Aspirations',
      trim: true,
    },
    authorizedSignatory: {
      type: String,
      default: 'Human Resources Manager',
      trim: true,
    },
    authorizedSignatoryTitle: {
      type: String,
      default: 'Head of Human Resources',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['Issued', 'Draft', 'Revoked'],
      default: 'Issued',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    history: {
      type: [letterHistorySchema],
      default: [],
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

experienceLetterSchema.index({ employee: 1, isDeleted: 1 });
experienceLetterSchema.index({ status: 1, isDeleted: 1 });
experienceLetterSchema.index({ letterDate: -1 });

export default mongoose.models.ExperienceLetter ||
  mongoose.model('ExperienceLetter', experienceLetterSchema, 'experienceletters');
