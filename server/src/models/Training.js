import mongoose from 'mongoose';

const { Schema } = mongoose;

// 1. Training Program Batch
const trainingProgramBatchSchema = new Schema({
  batchName: { type: String, required: true, trim: true },
  startDate: { type: Date },
  endDate: { type: Date },
  capacity: { type: Number, default: 0 },
  status: { type: String, enum: ['Upcoming', 'Scheduled', 'Active', 'In Progress', 'Completed', 'Cancelled', 'On Hold'], default: 'Scheduled' }
}, { timestamps: true });

// 1. Training Program
const trainingProgramSchema = new Schema({
  name: { type: String, required: true, trim: true },
  programCode: { type: String, trim: true, unique: true, sparse: true },
  description: { type: String, trim: true },
  trainingType: {
    type: String,
    enum: ['Internal', 'External', 'Online', 'Workshop', 'On-the-Job', 'Skill Development', 'Certification', 'Compliance', 'Other'],
    default: 'Internal'
  },
  category: {
    type: String,
    enum: ['Technical', 'Soft Skills', 'Leadership', 'Management', 'Communication', 'IT Skills', 'Other', 'General'],
    default: 'Technical'
  },
  department: { type: Schema.Types.ObjectId, ref: 'Department' },
  programOwner: { type: Schema.Types.ObjectId, ref: 'User' },
  trainer: { type: Schema.Types.ObjectId, ref: 'TrainingTrainer' },
  startDate: { type: Date },
  endDate: { type: Date },
  totalHours: { type: Number, default: 0 },
  capacity: { type: Number, default: 0 },
  budget: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' },
  status: {
    type: String,
    enum: ['Draft', 'Planned', 'Scheduled', 'Active', 'Completed', 'Cancelled', 'On Hold', 'Archived'],
    default: 'Draft'
  },
  isArchived: { type: Boolean, default: false },
  courses: [{ type: Schema.Types.ObjectId, ref: 'TrainingCourse' }],
  batches: [trainingProgramBatchSchema],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// 2. Training Course Sub-Schemas
const courseModuleSchema = new Schema({
  moduleName: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  duration: { type: String, default: '' },
  order: { type: Number, default: 1 }
}, { timestamps: true });

const courseObjectiveSchema = new Schema({
  objective: { type: String, required: true, trim: true },
  order: { type: Number, default: 1 }
}, { timestamps: true });

const courseMaterialSchema = new Schema({
  title: { type: String, required: true, trim: true },
  materialType: {
    type: String,
    enum: ['PDF', 'PPT', 'Document', 'Video', 'URL', 'Assignment', 'Other'],
    default: 'Document'
  },
  url: { type: String, trim: true },
  fileName: { type: String, trim: true },
  fileSize: { type: String, trim: true },
  notes: { type: String, trim: true },
  uploadedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// 2. Training Course Master Entity
const trainingCourseSchema = new Schema({
  title: { type: String, required: true, trim: true },
  code: { type: String, trim: true, unique: true, sparse: true },
  description: { type: String, trim: true },
  category: { type: String, default: 'Technical' },
  skillTopic: { type: String, trim: true },
  difficulty: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Beginner' },
  department: { type: Schema.Types.ObjectId, ref: 'Department' },
  trainer: { type: Schema.Types.ObjectId, ref: 'TrainingTrainer' },
  trainingProvider: { type: String, trim: true, default: 'Internal HR' },
  duration: { type: Number, default: 0 },
  durationUnit: { type: String, enum: ['Hours', 'Days', 'Weeks'], default: 'Hours' },
  durationHours: { type: Number, default: 0 },
  prerequisites: { type: Schema.Types.Mixed },
  requiredSkills: { type: Schema.Types.Mixed },
  programs: [{ type: Schema.Types.ObjectId, ref: 'TrainingProgram' }],
  program: { type: Schema.Types.ObjectId, ref: 'TrainingProgram' }, // Preserved for backwards compatibility
  modules: [courseModuleSchema],
  learningObjectives: [courseObjectiveSchema],
  materials: [courseMaterialSchema],
  assessmentConfig: {
    required: { type: Boolean, default: false },
    passingScore: { type: Number, default: 60 },
    maxAttempts: { type: Number, default: 3 }
  },
  certificationConfig: {
    eligible: { type: Boolean, default: false },
    minAttendancePct: { type: Number, default: 80 },
    minAssessmentScore: { type: Number, default: 60 },
    requireCourseCompletion: { type: Boolean, default: true }
  },
  assessmentRequired: { type: Boolean, default: false },
  certificationRequired: { type: Boolean, default: false },
  status: { type: String, enum: ['Draft', 'Active', 'Inactive', 'Archived'], default: 'Draft' },
  isArchived: { type: Boolean, default: false },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// 3. Training Trainer
const trainingTrainerSchema = new Schema({
  trainerType: { type: String, enum: ['Internal', 'External'], default: 'Internal' },
  employee: { type: Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, trim: true },
  email: { type: String, trim: true },
  phone: { type: String, trim: true },
  organization: { type: String, trim: true },
  expertise: [{ type: String }],
  bio: { type: String },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, { timestamps: true });

// 4. Training Session
const trainingSessionSchema = new Schema({
  program: { type: Schema.Types.ObjectId, ref: 'TrainingProgram', required: true },
  course: { type: Schema.Types.ObjectId, ref: 'TrainingCourse', required: true },
  trainer: { type: Schema.Types.ObjectId, ref: 'TrainingTrainer' },
  sessionTitle: { type: String, required: true },
  sessionDate: { type: Date, required: true },
  startTime: { type: String },
  endTime: { type: String },
  location: { type: String, default: 'Online' },
  meetingLink: { type: String },
  notes: { type: String },
  status: { type: String, enum: ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled'], default: 'Scheduled' }
}, { timestamps: true });

// 5. Training Assignment
const trainingAssignmentSchema = new Schema({
  program: { type: Schema.Types.ObjectId, ref: 'TrainingProgram', required: true },
  course: { type: Schema.Types.ObjectId, ref: 'TrainingCourse', required: true },
  employee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  startDate: { type: Date },
  dueDate: { type: Date },
  isMandatory: { type: Boolean, default: true },
  status: { type: String, enum: ['Assigned', 'In Progress', 'Completed', 'Failed', 'Overdue', 'Cancelled'], default: 'Assigned' },
  completionDate: { type: Date }
}, { timestamps: true });

// 6. Training Attendance
const trainingAttendanceSchema = new Schema({
  session: { type: Schema.Types.ObjectId, ref: 'TrainingSession', required: true },
  employee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['Present', 'Absent', 'Late', 'Half Day', 'Leave', 'Excused'], default: 'Present' },
  checkIn: { type: String },
  checkOut: { type: String },
  remarks: { type: String }
}, { timestamps: true });

// 7. Training Assessment Question Sub-Schema
const assessmentQuestionSchema = new Schema({
  questionText: { type: String, required: true, trim: true },
  questionType: {
    type: String,
    enum: ['Multiple Choice', 'True/False', 'Short Answer', 'Task/Practical'],
    default: 'Multiple Choice'
  },
  options: [{ type: String, trim: true }],
  correctAnswer: { type: String, trim: true },
  marks: { type: Number, default: 10 },
  order: { type: Number, default: 1 }
}, { timestamps: true });

// Assessment Assignment Sub-Schema
const assessmentAssignmentSchema = new Schema({
  employee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  assignedDate: { type: Date, default: Date.now },
  assignedAt: { type: Date, default: Date.now },
  dueDate: { type: Date },
  status: {
    type: String,
    enum: ['Assigned', 'In Progress', 'Submitted', 'Evaluated', 'Completed'],
    default: 'Assigned'
  },
  assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, default: '' }
}, { timestamps: true });

// Assessment Submission Sub-Schema
const assessmentSubmissionSchema = new Schema({
  employee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  submittedAt: { type: Date, default: Date.now },
  submissionDate: { type: Date, default: Date.now },
  completionDate: { type: Date },
  answers: [{
    questionId: { type: Schema.Types.ObjectId },
    questionText: { type: String },
    answer: { type: String },
    marksAwarded: { type: Number, default: 0 }
  }],
  totalMarks: { type: Number, default: 100 },
  obtainedMarks: { type: Number, default: 0 },
  marksObtained: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  passFail: { type: String, enum: ['Pass', 'Fail', 'Pending'], default: 'Pending' },
  result: { type: String, enum: ['Pass', 'Fail', 'Pending'], default: 'Pending' },
  grade: { type: String, default: 'N/A' },
  evaluator: { type: Schema.Types.ObjectId, ref: 'User' },
  evaluatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  evaluatedAt: { type: Date },
  evaluationStatus: {
    type: String,
    enum: ['Pending', 'Evaluated', 'Needs Review', 'Pending Submission'],
    default: 'Pending'
  },
  remarks: { type: String, default: '' },
  attemptNumber: { type: Number, default: 1 },
  attempts: { type: Number, default: 1 }
}, { timestamps: true });

// 7. Training Assessment Master Entity
const trainingAssessmentSchema = new Schema({
  program: { type: Schema.Types.ObjectId, ref: 'TrainingProgram' },
  course: { type: Schema.Types.ObjectId, ref: 'TrainingCourse', required: true },
  title: { type: String, trim: true, default: 'Course Final Assessment' },
  name: { type: String, trim: true },
  description: { type: String, trim: true, default: '' },
  instructions: { type: String, trim: true, default: '' },
  assessmentType: {
    type: String,
    enum: ['Quiz', 'Exam', 'Assignment', 'Practical', 'Project', 'Certification', 'Other'],
    default: 'Quiz'
  },
  duration: { type: Number, default: 60 },
  totalMarks: { type: Number, default: 100 },
  passingMarks: { type: Number, default: 70 },
  passingScore: { type: Number, default: 70 },
  maxScore: { type: Number, default: 100 },
  startDate: { type: Date },
  endDate: { type: Date },
  status: {
    type: String,
    enum: ['Draft', 'Published', 'Active', 'Closed', 'Archived'],
    default: 'Draft'
  },
  questions: [assessmentQuestionSchema],
  assignedEmployees: [assessmentAssignmentSchema],
  submissions: [assessmentSubmissionSchema],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },

  // Preserved fields for existing records and direct evaluation compatibility:
  employee: { type: Schema.Types.ObjectId, ref: 'User' },
  score: { type: Number },
  result: { type: String, enum: ['Pass', 'Fail', 'Pending'], default: 'Pending' },
  attemptNumber: { type: Number, default: 1 },
  assessmentDate: { type: Date, default: Date.now },
  remarks: { type: String }
}, { timestamps: true });

// 8. Training Certification
const trainingCertificationSchema = new Schema({
  employee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  program: { type: Schema.Types.ObjectId, ref: 'TrainingProgram' },
  course: { type: Schema.Types.ObjectId, ref: 'TrainingCourse', required: true },
  assignment: { type: Schema.Types.ObjectId, ref: 'TrainingAssignment' },
  certificateNumber: { type: String, required: true, unique: true },
  certificateType: { type: String, default: 'Completion' },
  issueDate: { type: Date, default: Date.now },
  expiryDate: { type: Date },
  status: { type: String, enum: ['Active', 'Expiring Soon', 'Expired', 'Revoked'], default: 'Active' },
  finalScore: { type: Number },
  completionDate: { type: Date },
  issuedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  documentUrl: { type: String }
}, { timestamps: true });

// 9. Training Feedback
const trainingFeedbackSchema = new Schema({
  employee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  program: { type: Schema.Types.ObjectId, ref: 'TrainingProgram' },
  course: { type: Schema.Types.ObjectId, ref: 'TrainingCourse', required: true },
  trainer: { type: Schema.Types.ObjectId, ref: 'TrainingTrainer' },
  rating: { type: Number, min: 1, max: 5, required: true },
  comments: { type: String },
  submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// 10. Training Cost
const trainingCostSchema = new Schema({
  program: { type: Schema.Types.ObjectId, ref: 'TrainingProgram' },
  course: { type: Schema.Types.ObjectId, ref: 'TrainingCourse' },
  session: { type: Schema.Types.ObjectId, ref: 'TrainingSession' },
  title: { type: String, required: true },
  courseFee: { type: Number, default: 0 },
  trainerFee: { type: Number, default: 0 },
  venueCost: { type: Number, default: 0 },
  materialsCost: { type: Number, default: 0 },
  travelCost: { type: Number, default: 0 },
  otherCost: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' },
  dateIncurred: { type: Date, default: Date.now },
  notes: { type: String }
}, { timestamps: true });

export const TrainingProgram = mongoose.model('TrainingProgram', trainingProgramSchema);
export const TrainingCourse = mongoose.model('TrainingCourse', trainingCourseSchema);
export const TrainingTrainer = mongoose.model('TrainingTrainer', trainingTrainerSchema);
export const TrainingSession = mongoose.model('TrainingSession', trainingSessionSchema);
export const TrainingAssignment = mongoose.model('TrainingAssignment', trainingAssignmentSchema);
export const TrainingAttendance = mongoose.model('TrainingAttendance', trainingAttendanceSchema);
export const TrainingAssessment = mongoose.model('TrainingAssessment', trainingAssessmentSchema);
export const TrainingCertification = mongoose.model('TrainingCertification', trainingCertificationSchema);
export const TrainingFeedback = mongoose.model('TrainingFeedback', trainingFeedbackSchema);
export const TrainingCost = mongoose.model('TrainingCost', trainingCostSchema);
