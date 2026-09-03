import mongoose from 'mongoose';

const jobRequisitionSchema = new mongoose.Schema(
  {
    jobId: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    openings: { type: Number, required: true, min: 1, default: 1 },
    employmentType: {
      type: String,
      enum: ['Full Time', 'Part Time', 'Intern', 'Contract'],
      default: 'Full Time',
    },
    location: { type: String, default: 'In-Office / Hybrid', trim: true },
    experience: { type: String, default: '1-3 Years', trim: true },
    salaryRange: { type: String, default: 'Competitive', trim: true },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Urgent'],
      default: 'Medium',
    },
    openingDate: { type: Date, default: Date.now },
    closingDate: { type: Date, default: null },
    description: { type: String, default: '', trim: true },
    responsibilities: { type: String, default: '', trim: true },
    requirements: { type: String, default: '', trim: true },
    qualifications: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['Draft', 'Open', 'On Hold', 'Closed'],
      default: 'Open',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export default mongoose.models.JobRequisition ||
  mongoose.model('JobRequisition', jobRequisitionSchema, 'jobrequisitions');
