import {
  TrainingProgram, TrainingCourse, TrainingTrainer, TrainingSession,
  TrainingAssignment, TrainingAttendance, TrainingAssessment,
  TrainingCertification, TrainingFeedback, TrainingCost
} from '../models/Training.js';

/* ──────────────── PROGRAMS ──────────────── */
const getPrograms = (q = {}) => {
  const filter = { ...q };
  if (filter.search) {
    filter.name = { $regex: filter.search, $options: 'i' };
    delete filter.search;
  }
  return TrainingProgram.find(filter).populate('department').populate('courses').populate('createdBy', 'firstName lastName email').sort({ createdAt: -1 });
};
const getProgramById = (id) => TrainingProgram.findById(id).populate('department').populate('courses').populate('createdBy', 'firstName lastName email');
const createProgram = (data) => TrainingProgram.create(data);
const updateProgram = (id, data) => TrainingProgram.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate('department').populate('courses');
const deleteProgram = (id) => TrainingProgram.findByIdAndDelete(id);

/* ──────────────── COURSES ──────────────── */
const getCourses = (q = {}) => {
  const filter = { ...q };
  if (filter.search) {
    filter.$or = [
      { title: { $regex: filter.search, $options: 'i' } },
      { code: { $regex: filter.search, $options: 'i' } }
    ];
    delete filter.search;
  }
  return TrainingCourse.find(filter).populate('createdBy', 'firstName lastName email').sort({ createdAt: -1 });
};
const getCourseById = (id) => TrainingCourse.findById(id).populate('createdBy', 'firstName lastName email');
const createCourse = (data) => TrainingCourse.create(data);
const updateCourse = (id, data) => TrainingCourse.findByIdAndUpdate(id, data, { new: true, runValidators: true });
const deleteCourse = (id) => TrainingCourse.findByIdAndDelete(id);

/* ──────────────── TRAINERS ──────────────── */
const getTrainers = (q = {}) => {
  const filter = { ...q };
  if (filter.search) {
    filter.name = { $regex: filter.search, $options: 'i' };
    delete filter.search;
  }
  return TrainingTrainer.find(filter).populate('employee', 'firstName lastName email department').sort({ createdAt: -1 });
};
const getTrainerById = (id) => TrainingTrainer.findById(id).populate('employee', 'firstName lastName email department');
const createTrainer = (data) => TrainingTrainer.create(data);
const updateTrainer = (id, data) => TrainingTrainer.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate('employee', 'firstName lastName email department');
const deleteTrainer = (id) => TrainingTrainer.findByIdAndDelete(id);

/* ──────────────── SESSIONS ──────────────── */
const getSessions = (q = {}) => {
  const filter = { ...q };
  if (filter.search) {
    filter.sessionTitle = { $regex: filter.search, $options: 'i' };
    delete filter.search;
  }
  return TrainingSession.find(filter).populate('program').populate('course').populate('trainer').sort({ sessionDate: -1 });
};
const getSessionById = (id) => TrainingSession.findById(id).populate('program').populate('course').populate('trainer');
const createSession = (data) => TrainingSession.create(data);
const updateSession = (id, data) => TrainingSession.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate('program').populate('course').populate('trainer');
const deleteSession = (id) => TrainingSession.findByIdAndDelete(id);

/* ──────────────── ASSIGNMENTS ──────────────── */
const getAssignments = (q = {}) => {
  const filter = { ...q };
  if (filter.search) {
    delete filter.search;
  }
  return TrainingAssignment.find(filter).populate('program').populate('course').populate('employee', 'firstName lastName email department').sort({ createdAt: -1 });
};
const getAssignmentById = (id) => TrainingAssignment.findById(id).populate('program').populate('course').populate('employee', 'firstName lastName email department');
const createAssignment = (data) => TrainingAssignment.create(data);
const bulkCreateAssignments = (arr) => TrainingAssignment.insertMany(arr);
const updateAssignment = (id, data) => TrainingAssignment.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate('program').populate('course').populate('employee', 'firstName lastName email department');
const deleteAssignment = (id) => TrainingAssignment.findByIdAndDelete(id);

const getAttendance = (q = {}) => TrainingAttendance.find(q).populate({ path: 'session', populate: [{ path: 'program' }, { path: 'course' }] }).populate('employee', 'firstName lastName email department personalInfo').sort({ date: -1 });

const createAttendance = async (data) => {
  if (data.session && data.employee) {
    return TrainingAttendance.findOneAndUpdate(
      { session: data.session, employee: data.employee },
      data,
      { upsert: true, new: true, runValidators: true }
    ).populate({ path: 'session', populate: [{ path: 'program' }, { path: 'course' }] }).populate('employee', 'firstName lastName email department');
  }
  return TrainingAttendance.create(data);
};

const bulkCreateAttendance = async (arr) => {
  const results = [];
  for (const doc of arr) {
    if (doc.session && doc.employee) {
      const res = await TrainingAttendance.findOneAndUpdate(
        { session: doc.session, employee: doc.employee },
        doc,
        { upsert: true, new: true, runValidators: true }
      );
      results.push(res);
    } else {
      const res = await TrainingAttendance.create(doc);
      results.push(res);
    }
  }
  return results;
};

const updateAttendance = (id, data) => TrainingAttendance.findByIdAndUpdate(id, data, { new: true, runValidators: true });
const deleteAttendance = (id) => TrainingAttendance.findByIdAndDelete(id);

/* ──────────────── ASSESSMENTS ──────────────── */
const getAssessments = (q = {}) => TrainingAssessment.find(q).populate('program').populate('course').populate('employee', 'firstName lastName email department').sort({ assessmentDate: -1 });
const createAssessment = (data) => {
  // auto-calculate result
  if (data.score !== undefined && data.passingScore !== undefined) {
    data.result = data.score >= data.passingScore ? 'Pass' : 'Fail';
  }
  return TrainingAssessment.create(data);
};
const updateAssessment = (id, data) => {
  if (data.score !== undefined && data.passingScore !== undefined) {
    data.result = data.score >= data.passingScore ? 'Pass' : 'Fail';
  }
  return TrainingAssessment.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate('program').populate('course').populate('employee', 'firstName lastName email department');
};
const deleteAssessment = (id) => TrainingAssessment.findByIdAndDelete(id);

/* ──────────────── CERTIFICATIONS ──────────────── */
const getCertifications = (q = {}) => TrainingCertification.find(q).populate('program').populate('course').populate('employee', 'firstName lastName email department').sort({ issueDate: -1 });
const createCertification = (data) => TrainingCertification.create(data);
const updateCertification = (id, data) => TrainingCertification.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate('program').populate('course').populate('employee', 'firstName lastName email department');
const deleteCertification = (id) => TrainingCertification.findByIdAndDelete(id);

const generateCertification = async ({ employee, course, program, assignment, issuedBy }) => {
  const queryFilter = { employee, course, status: 'Completed' };
  if (assignment) queryFilter._id = assignment;

  const assignmentDoc = await TrainingAssignment.findOne(queryFilter);

  if (!assignmentDoc) {
    throw new Error('Certification cannot be generated because this training has not been completed.');
  }

  const year = new Date().getFullYear();
  const count = await TrainingCertification.countDocuments();
  const certNumber = `CERT-${year}-${String(count + 1).padStart(6, '0')}`;

  const assessment = await TrainingAssessment.findOne({ employee, course }).sort({ assessmentDate: -1 });

  const cert = await TrainingCertification.create({
    employee,
    course,
    program: program || assignmentDoc.program,
    assignment: assignmentDoc._id,
    certificateNumber: certNumber,
    certificateType: 'Completion',
    finalScore: assessment?.score || null,
    completionDate: assignmentDoc.completionDate || assignmentDoc.updatedAt || new Date(),
    issuedBy,
    issueDate: new Date(),
    status: 'Active'
  });

  return TrainingCertification.findById(cert._id)
    .populate('program')
    .populate('course')
    .populate('employee', 'firstName lastName email department');
};

const revokeCertification = async (id) => {
  return TrainingCertification.findByIdAndUpdate(id, { status: 'Revoked' }, { new: true })
    .populate('program')
    .populate('course')
    .populate('employee', 'firstName lastName email department');
};

/* ──────────────── FEEDBACK ──────────────── */
const getFeedback = (q = {}) => TrainingFeedback.find(q).populate('program').populate('course').populate('trainer').populate('employee', 'firstName lastName email department').sort({ submittedAt: -1 });
const createFeedback = (data) => TrainingFeedback.create(data);
const updateFeedback = (id, data) => TrainingFeedback.findByIdAndUpdate(id, data, { new: true, runValidators: true });
const deleteFeedback = (id) => TrainingFeedback.findByIdAndDelete(id);

/* ──────────────── COSTS ──────────────── */
const getCosts = (q = {}) => TrainingCost.find(q).populate('program').populate('course').populate('session').sort({ dateIncurred: -1 });
const createCost = (data) => {
  const sum = (data.courseFee || 0) + (data.trainerFee || 0) + (data.venueCost || 0) + (data.materialsCost || 0) + (data.travelCost || 0) + (data.otherCost || 0);
  data.totalCost = sum > 0 ? sum : (Number(data.totalCost || data.amount) || 0);
  return TrainingCost.create(data);
};
const updateCost = (id, data) => {
  const sum = (data.courseFee || 0) + (data.trainerFee || 0) + (data.venueCost || 0) + (data.materialsCost || 0) + (data.travelCost || 0) + (data.otherCost || 0);
  if (sum > 0) {
    data.totalCost = sum;
  } else if (data.totalCost || data.amount) {
    data.totalCost = Number(data.totalCost || data.amount) || 0;
  }
  return TrainingCost.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate('program').populate('course').populate('session');
};
const deleteCost = (id) => TrainingCost.findByIdAndDelete(id);

/* ──────────────── OVERVIEW / STATS ──────────────── */
const getOverview = async () => {
  const [programs, courses, trainers, sessions, assignments, attendance, assessments, certifications, feedback, costs] = await Promise.all([
    TrainingProgram.countDocuments(),
    TrainingCourse.countDocuments(),
    TrainingTrainer.countDocuments(),
    TrainingSession.countDocuments(),
    TrainingAssignment.countDocuments(),
    TrainingAttendance.countDocuments(),
    TrainingAssessment.countDocuments(),
    TrainingCertification.countDocuments(),
    TrainingFeedback.countDocuments(),
    TrainingCost.aggregate([{ $group: { _id: null, total: { $sum: '$totalCost' } } }])
  ]);

  const activePrograms = await TrainingProgram.countDocuments({ status: 'Active' });
  const upcomingSessionsCount = await TrainingSession.countDocuments({ status: 'Scheduled', sessionDate: { $gte: new Date() } });
  const completedAssignments = await TrainingAssignment.countDocuments({ status: 'Completed' });
  const inProgressAssignments = await TrainingAssignment.countDocuments({ status: 'In Progress' });
  const assignedAssignments = await TrainingAssignment.countDocuments({ status: 'Assigned' });
  const avgScore = await TrainingAssessment.aggregate([{ $group: { _id: null, avg: { $avg: '$score' } } }]);
  const avgFeedbackRating = await TrainingFeedback.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' } } }]);

  const completionRate = assignments > 0 ? Math.round((completedAssignments / assignments) * 100) : 0;
  const inProgressPct = assignments > 0 ? Math.round((inProgressAssignments / assignments) * 100) : 0;
  const notStartedPct = assignments > 0 ? Math.max(0, 100 - completionRate - inProgressPct) : 0;

  // 1. Upcoming Sessions Widget Data
  const upcomingSessionsRaw = await TrainingSession.find({ sessionDate: { $gte: new Date() } })
    .populate('program', 'name')
    .populate('course', 'title')
    .populate('trainer')
    .sort({ sessionDate: 1 })
    .limit(5);

  const upcomingSessionsList = await Promise.all(upcomingSessionsRaw.map(async (s) => {
    const enrolled = await TrainingAssignment.countDocuments({ program: s.program?._id, course: s.course?._id });
    return {
      ...s.toObject(),
      enrolledCount: enrolled
    };
  }));

  // 2. Training Progress Widget Data
  const trainingProgress = {
    totalEnrollments: assignments,
    completedCount: completedAssignments,
    inProgressCount: inProgressAssignments,
    notStartedCount: assignedAssignments,
    completedPct: completionRate,
    inProgressPct,
    notStartedPct
  };

  // 3. Recent Activity Widget Data
  const recentActivity = await TrainingAssignment.find()
    .populate('employee', 'firstName lastName email department')
    .populate('program', 'name')
    .populate('course', 'title')
    .sort({ updatedAt: -1 })
    .limit(6);

  // 4. Top Performing Programs Widget Data
  const topProgramsRaw = await TrainingAssignment.aggregate([
    {
      $group: {
        _id: '$program',
        totalAssigned: { $sum: 1 },
        completedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
        }
      }
    },
    { $sort: { completedCount: -1, totalAssigned: -1 } },
    { $limit: 5 }
  ]);

  const topPrograms = await Promise.all(topProgramsRaw.map(async (item) => {
    if (!item._id) return null;
    const prog = await TrainingProgram.findById(item._id).select('name trainingType status');
    if (!prog) return null;
    const compRate = item.totalAssigned > 0 ? Math.round((item.completedCount / item.totalAssigned) * 100) : 0;
    return {
      _id: prog._id,
      name: prog.name,
      trainingType: prog.trainingType,
      status: prog.status,
      participants: item.totalAssigned,
      completedCount: item.completedCount,
      completionRate: compRate
    };
  }));

  return {
    kpis: {
      totalPrograms: programs,
      activePrograms,
      totalCourses: courses,
      totalTrainers: trainers,
      totalSessions: sessions,
      upcomingSessions: upcomingSessionsCount,
      totalAssignments: assignments,
      completedAssignments,
      completionRate,
      totalAttendance: attendance,
      totalAssessments: assessments,
      averageScore: avgScore[0]?.avg ? Math.round(avgScore[0].avg * 10) / 10 : 0,
      totalCertifications: certifications,
      totalFeedback: feedback,
      averageRating: avgFeedbackRating[0]?.avg ? Math.round(avgFeedbackRating[0].avg * 10) / 10 : 0,
      totalInvestment: costs[0]?.total || 0
    },
    upcomingSessions: upcomingSessionsList,
    trainingProgress,
    recentActivity,
    topPrograms: topPrograms.filter(Boolean)
  };
};

/* ──────────────── COST REPORTS ──────────────── */
const getCostReports = async (filters = {}) => {
  const matchStage = {};
  if (filters.program) matchStage.program = filters.program;
  if (filters.course) matchStage.course = filters.course;

  const pipeline = [
    ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
    {
      $group: {
        _id: null,
        totalCost: { $sum: '$totalCost' },
        totalCourseFee: { $sum: '$courseFee' },
        totalTrainerFee: { $sum: '$trainerFee' },
        totalVenueCost: { $sum: '$venueCost' },
        totalMaterialsCost: { $sum: '$materialsCost' },
        totalTravelCost: { $sum: '$travelCost' },
        totalOtherCost: { $sum: '$otherCost' },
        count: { $sum: 1 }
      }
    }
  ];

  const byProgram = await TrainingCost.aggregate([
    ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
    { $group: { _id: '$program', totalCost: { $sum: '$totalCost' }, count: { $sum: 1 } } },
    { $lookup: { from: 'trainingprograms', localField: '_id', foreignField: '_id', as: 'programInfo' } },
    { $unwind: { path: '$programInfo', preserveNullAndEmptyArrays: true } },
    { $project: { programName: '$programInfo.name', totalCost: 1, count: 1 } },
    { $sort: { totalCost: -1 } }
  ]);

  const byCourse = await TrainingCost.aggregate([
    ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
    { $group: { _id: '$course', totalCost: { $sum: '$totalCost' }, count: { $sum: 1 } } },
    { $lookup: { from: 'trainingcourses', localField: '_id', foreignField: '_id', as: 'courseInfo' } },
    { $unwind: { path: '$courseInfo', preserveNullAndEmptyArrays: true } },
    { $project: { courseTitle: '$courseInfo.title', totalCost: 1, count: 1 } },
    { $sort: { totalCost: -1 } }
  ]);

  const totals = await TrainingCost.aggregate(pipeline);

  // Get employee training count for cost-per-employee
  const employeesTrained = await TrainingAssignment.distinct('employee');
  const completedEmployees = await TrainingAssignment.distinct('employee', { status: 'Completed' });

  const totalCostVal = totals[0]?.totalCost || 0;
  return {
    summary: totals[0] || { totalCost: 0, count: 0 },
    byProgram,
    byCourse,
    employeesTrained: employeesTrained.length,
    completedEmployees: completedEmployees.length,
    costPerEmployee: employeesTrained.length > 0 ? Math.round(totalCostVal / employeesTrained.length) : 0,
    costPerCompletedEmployee: completedEmployees.length > 0 ? Math.round(totalCostVal / completedEmployees.length) : 0
  };
};

export const TrainingService = {
  getPrograms, getProgramById, createProgram, updateProgram, deleteProgram,
  getCourses, getCourseById, createCourse, updateCourse, deleteCourse,
  getTrainers, getTrainerById, createTrainer, updateTrainer, deleteTrainer,
  getSessions, getSessionById, createSession, updateSession, deleteSession,
  getAssignments, getAssignmentById, createAssignment, bulkCreateAssignments, updateAssignment, deleteAssignment,
  getAttendance, createAttendance, bulkCreateAttendance, updateAttendance, deleteAttendance,
  getAssessments, createAssessment, updateAssessment, deleteAssessment,
  getCertifications, createCertification, updateCertification, deleteCertification, generateCertification, revokeCertification,
  getFeedback, createFeedback, updateFeedback, deleteFeedback,
  getCosts, createCost, updateCost, deleteCost,
  getOverview, getCostReports
};

export default TrainingService;
