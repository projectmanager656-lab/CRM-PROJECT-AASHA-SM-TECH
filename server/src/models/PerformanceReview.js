import mongoose from 'mongoose';

const goalSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    target: { type: String, default: '', trim: true },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    deadline: { type: Date, default: null },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    status: { type: String, enum: ['Not Started', 'In Progress', 'Completed'], default: 'In Progress' },
  },
  { timestamps: true }
);

const performanceReviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewerName: { type: String, default: 'HR Manager', trim: true },
    reviewCycle: { type: String, default: 'Q1 2026', trim: true },
    reviewPeriod: { type: String, default: 'Jan 2026 - Mar 2026', trim: true },
    ratings: {
      productivity: { type: Number, min: 1, max: 5, default: 4 },
      qualityOfWork: { type: Number, min: 1, max: 5, default: 4 },
      communication: { type: Number, min: 1, max: 5, default: 4 },
      teamwork: { type: Number, min: 1, max: 5, default: 4 },
      problemSolving: { type: Number, min: 1, max: 5, default: 4 },
      punctuality: { type: Number, min: 1, max: 5, default: 4 },
    },
    overallRating: { type: Number, min: 1, max: 5, default: 4.0 },
    strengths: { type: String, default: '', trim: true },
    areasForImprovement: { type: String, default: '', trim: true },
    hrComments: { type: String, default: '', trim: true },
    managerFeedback: { type: String, default: '', trim: true },
    status: { type: String, enum: ['Draft', 'Pending', 'In Review', 'Completed'], default: 'Completed' },
    reviewDate: { type: Date, default: Date.now },
    goals: [goalSchema],
  },
  { timestamps: true }
);

export default mongoose.models.PerformanceReview ||
  mongoose.model('PerformanceReview', performanceReviewSchema, 'performancereviews');
