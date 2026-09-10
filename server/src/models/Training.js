import mongoose from 'mongoose';

const { Schema } = mongoose;

// 1. Training Program
const trainingProgramSchema = new Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  trainingType: { type: String, enum: ['Internal', 'External', 'Online', 'Workshop', 'On-the-Job'], default: 'Internal' },
  department: { type: Schema.Types.ObjectId, ref: 'Department' },
  startDate: { type: Date },
  endDate: { type: Date },
  status: { type: String, enum: ['Draft', 'Scheduled', 'Active', 'Completed', 'Cancelled', 'On Hold'], default: 'Draft' },
  budget: { type: Number, default: 0 },
  courses: [{ type: Schema.Types.ObjectId, ref: 'TrainingCourse' }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// 2. Training Course
const trainingCourseSchema = new Schema({
  title: { type: String, required: true, trim: true },
  code: { type: String, trim: true },
  description: { type: String, trim: true },
  category: { type: String, default: 'General' },
  skillTopic: { type: String },
  durationHours: { type: Number, default: 0 },
  difficulty: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Beginner' },
  assessmentRequired: { type: Boolean, default: false },
  certificationRequired: { type: Boolean, default: false },
  status: { type: String, enum: ['Active', 'Inactive', 'Archived'], default: 'Active' },
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

// 7. Training Assessment
const trainingAssessmentSchema = new Schema({
  program: { type: Schema.Types.ObjectId, ref: 'TrainingProgram' },
  course: { type: Schema.Types.ObjectId, ref: 'TrainingCourse', required: true },
  employee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, default: 'Course Final Assessment' },
  passingScore: { type: Number, default: 70 },
  score: { type: Number, required: true },
  maxScore: { type: Number, default: 100 },
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
