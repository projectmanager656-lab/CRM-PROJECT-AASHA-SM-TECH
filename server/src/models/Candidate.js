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

const screeningSchema = new mongoose.Schema(
  {
    screeningDate: { type: Date, default: Date.now },
    recruiter: { type: mongoose.Schema.Types.Mixed, default: null },
    recruiterName: { type: String, default: '', trim: true },
    skillsMatch: { type: Number, min: 1, max: 5, default: 3 },
    experienceMatch: { type: Number, min: 1, max: 5, default: 3 },
    communicationAssessment: { type: Number, min: 1, max: 5, default: 3 },
    notes: { type: String, default: '', trim: true },
    decision: {
      type: String,
      enum: ['Pass', 'Hold', 'Fail', ''],
      default: '',
    },
    submittedAt: { type: Date, default: Date.now },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false }
);

const rejectionSchema = new mongoose.Schema(
  {
    reason: { type: String, default: 'Skills mismatch', trim: true },
    notes: { type: String, default: '', trim: true },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectedByName: { type: String, default: '', trim: true },
    rejectedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const withdrawalSchema = new mongoose.Schema(
  {
    reason: { type: String, default: 'Candidate withdrawn', trim: true },
    notes: { type: String, default: '', trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    recordedByName: { type: String, default: '', trim: true },
    withdrawnAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const assessmentSchema = new mongoose.Schema(
  {
    name: { type: String, default: 'Technical Assessment', trim: true },
    assignedDate: { type: Date, default: Date.now },
    dueDate: { type: Date, default: null },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 100 },
    result: {
      type: String,
      enum: ['Passed', 'Failed', 'Pending', 'In Review', ''],
      default: 'Pending',
    },
    evaluator: { type: String, default: '', trim: true },
    feedback: { type: String, default: '', trim: true },
    submittedAt: { type: Date, default: null },
  },
  { _id: false }
);

const stageHistorySchema = new mongoose.Schema(
  {
    fromStage: { type: String, default: '', trim: true },
    toStage: { type: String, default: '', trim: true },
    stage: { type: String, default: '', trim: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    changedByName: { type: String, default: '', trim: true },
    reason: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true }
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
    currentCTC: { type: String, default: '', trim: true },
    expectedCTC: { type: String, default: '', trim: true },
    noticePeriod: { type: String, default: 'Immediate / 30 Days', trim: true },
    resumeUrl: { type: String, default: '', trim: true },
    source: { type: String, default: 'Direct Application', trim: true },
    atsScore: { type: Number, min: 0, max: 100, default: 0 },
    stage: {
      type: String,
      enum: [
        'Applied',
        'Screening',
        'Shortlisted',
        'Assessment',
        'Interview',
        'Technical Round',
        'HR Round',
        'Final / HR Round',
        'Selected',
        'Offer',
        'Hired',
        'Rejected',
        'Withdrawn',
        'On Hold',
      ],
      default: 'Applied',
    },
    status: {
      type: String,
      enum: ['New', 'In Review', 'Shortlisted', 'Interviewing', 'Offered', 'Hired', 'Rejected', 'Withdrawn', 'On Hold'],
      default: 'New',
    },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    notes: { type: String, default: '', trim: true },
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    interviews: [interviewSchema],
    screening: { type: screeningSchema, default: null },
    assessment: { type: assessmentSchema, default: null },
    rejection: { type: rejectionSchema, default: null },
    withdrawal: { type: withdrawalSchema, default: null },
    offer: { type: offerSchema, default: null },
    convertedEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    history: { type: [stageHistorySchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.Candidate ||
  mongoose.model('Candidate', candidateSchema, 'candidates');
