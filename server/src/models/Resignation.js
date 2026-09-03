import mongoose from 'mongoose';

const clearanceItemSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['Pending', 'Completed'],
      default: 'Pending',
    },
    completedBy: { type: String, default: '', trim: true },
    completedDate: { type: Date, default: null },
    remarks: { type: String, default: '', trim: true },
    settlementAmount: { type: Number, default: 45000 },
    settlementStatus: {
      type: String,
      enum: ['Pending', 'Processing', 'Completed'],
      default: 'Pending',
    },
  },
  { _id: false }
);

const exitInterviewSchema = new mongoose.Schema(
  {
    reasonForLeaving: { type: String, default: '', trim: true },
    managementFeedback: { type: String, default: '', trim: true },
    suggestions: { type: String, default: '', trim: true },
    rehireEligibility: {
      type: String,
      enum: ['Eligible', 'Not Eligible'],
      default: 'Eligible',
    },
    hrComments: { type: String, default: '', trim: true },
    submittedAt: { type: Date, default: null },
  },
  { _id: false }
);

const resignationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resignationDate: { type: Date, required: true, default: Date.now },
    proposedLastWorkingDay: { type: Date, required: true },
    approvedLastWorkingDay: { type: Date, default: null },
    noticePeriodDays: { type: Number, default: 30 },
    reason: { type: String, required: true, trim: true },
    employeeComments: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: [
        'Submitted',
        'Under Review',
        'Approved',
        'Rejected',
        'Notice Period',
        'Exit Clearance',
        'Completed',
      ],
      default: 'Submitted',
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewDate: { type: Date, default: null },
    hrRemarks: { type: String, default: '', trim: true },
    rejectionReason: { type: String, default: '', trim: true },

    clearance: {
      hr: { type: clearanceItemSchema, default: () => ({ status: 'Pending' }) },
      manager: { type: clearanceItemSchema, default: () => ({ status: 'Pending' }) },
      finance: { type: clearanceItemSchema, default: () => ({ status: 'Pending' }) },
      itAssets: { type: clearanceItemSchema, default: () => ({ status: 'Pending' }) },
      knowledgeTransfer: { type: clearanceItemSchema, default: () => ({ status: 'Pending' }) },
    },

    exitInterview: { type: exitInterviewSchema, default: null },

    exitCompletedAt: { type: Date, default: null },
    exitCompletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export default mongoose.models.Resignation ||
  mongoose.model('Resignation', resignationSchema, 'resignations');
