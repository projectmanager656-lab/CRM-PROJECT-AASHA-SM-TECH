import mongoose from 'mongoose';

const interviewFeedbackSchema = new mongoose.Schema(
  {
    technicalSkills: { type: Number, min: 1, max: 5, default: 4 },
    communication: { type: Number, min: 1, max: 5, default: 4 },
    problemSolving: { type: Number, min: 1, max: 5, default: 4 },
    teamwork: { type: Number, min: 1, max: 5, default: 4 },
    overallRating: { type: Number, min: 1, max: 5, default: 4 },
    strengths: { type: String, default: '', trim: true },
    weaknesses: { type: String, default: '', trim: true },
    comments: { type: String, default: '', trim: true },
    recommendation: {
      type: String,
      enum: ['Strong Hire', 'Hire', 'Hold', 'Reject', ''],
      default: '',
    },
    submittedAt: { type: Date, default: null },
  },
  { _id: false }
);

const interviewSchema = new mongoose.Schema(
  {
    round: { type: String, default: 'Technical Round 1', trim: true },
    interviewer: { type: String, default: 'Engineering Lead / HR', trim: true },
    interviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    date: { type: Date, required: true },
    time: { type: String, default: '11:00 AM', trim: true },
    type: {
      type: String,
      enum: ['Online Video', 'In-Person', 'Telephonic'],
      default: 'Online Video',
    },
    meetingLink: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['Scheduled', 'Completed', 'Rescheduled', 'Cancelled'],
      default: 'Scheduled',
    },
    feedback: { type: interviewFeedbackSchema, default: null },
  },
  { timestamps: true }
);

const offerSchema = new mongoose.Schema(
  {
    offeredDesignation: { type: String, default: '', trim: true },
    department: { type: String, default: '', trim: true },
    salary: { type: String, default: '', trim: true },
    joiningDate: { type: Date, default: null },
    offerDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'],
      default: 'Draft',
    },
    notes: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const candidateSchema = new mongoose.Schema(
  {
    candidateId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    location: { type: String, default: '', trim: true },
    appliedJob: { type: mongoose.Schema.Types.ObjectId, ref: 'JobRequisition', default: null },
    appliedPosition: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    experience: { type: String, default: '0 Years', trim: true },
    skills: { type: [String], default: [] },
    education: { type: String, default: 'Bachelor\'s Degree', trim: true },
    currentCompany: { type: String, default: '', trim: true },
    noticePeriod: { type: String, default: 'Immediate / 30 Days', trim: true },
    resumeUrl: { type: String, default: '', trim: true },
    source: { type: String, default: 'Direct Application', trim: true },
    stage: {
      type: String,
      enum: [
        'Applied',
        'Screening',
        'Shortlisted',
        'Interview',
        'Technical Round',
        'HR Round',
        'Selected',
        'Rejected',
        'Hired',
      ],
      default: 'Applied',
    },
    status: {
      type: String,
      enum: ['New', 'In Review', 'Shortlisted', 'Interviewing', 'Offered', 'Hired', 'Rejected'],
      default: 'New',
    },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    notes: { type: String, default: '', trim: true },
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    interviews: [interviewSchema],
    offer: { type: offerSchema, default: null },
    convertedEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    history: [
      {
        stage: String,
        updatedAt: { type: Date, default: Date.now },
        notes: String,
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.models.Candidate ||
  mongoose.model('Candidate', candidateSchema, 'candidates');
