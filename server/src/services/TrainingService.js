import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import {
  TrainingProgram, TrainingCourse, TrainingTrainer, TrainingSession,
  TrainingAssignment, TrainingAttendance, TrainingAssessment,
  TrainingCertification, TrainingFeedback, TrainingCost
} from '../models/Training.js';
import PerformanceReview from '../models/PerformanceReview.js';

/* ──────────────── PROGRAMS ──────────────── */
const getPrograms = (q = {}) => {
  const filter = { ...q };
  if (filter.search) {
    filter.$or = [
      { name: { $regex: filter.search, $options: 'i' } },
      { programCode: { $regex: filter.search, $options: 'i' } },
      { description: { $regex: filter.search, $options: 'i' } }
    ];
    delete filter.search;
  }
  return TrainingProgram.find(filter)
    .populate('department')
    .populate('courses')
    .populate('createdBy', 'firstName lastName email')
    .populate('programOwner', 'firstName lastName email department')
    .populate('trainer')
    .sort({ createdAt: -1 });
};

const getProgramById = async (id) => {
  const program = await TrainingProgram.findById(id)
    .populate('department')
    .populate('courses')
    .populate('createdBy', 'firstName lastName email')
    .populate('programOwner', 'firstName lastName email department')
    .populate('trainer');

  if (!program) return null;

  const [participantCount, sessionCount, certCount] = await Promise.all([
    TrainingAssignment.countDocuments({ program: id }),
    TrainingSession.countDocuments({ program: id }),
    TrainingCertification.countDocuments({ program: id })
  ]);

  return {
    ...program.toObject(),
    stats: {
      totalCourses: program.courses?.length || 0,
      participantCount,
      sessionCount,
      certCount,
      batchCount: program.batches?.length || 0
    }
  };
};

const createProgram = async (data) => {
  if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
    throw new Error('End date cannot be earlier than start date');
  }
  if (data.budget !== undefined && Number(data.budget) < 0) {
    throw new Error('Budget cannot be negative');
  }
  if (data.capacity !== undefined && Number(data.capacity) < 0) {
    throw new Error('Capacity cannot be negative');
  }

  // Auto-generate programCode if not provided
  if (!data.programCode || !data.programCode.trim()) {
    const year = new Date().getFullYear();
    const count = await TrainingProgram.countDocuments();
    let candidateCode = `TRN-${year}-${String(count + 1).padStart(3, '0')}`;
    let exists = await TrainingProgram.findOne({ programCode: candidateCode });
    let offset = 1;
    while (exists) {
      candidateCode = `TRN-${year}-${String(count + 1 + offset).padStart(3, '0')}`;
      exists = await TrainingProgram.findOne({ programCode: candidateCode });
      offset++;
    }
    data.programCode = candidateCode;
  } else {
    const exists = await TrainingProgram.findOne({ programCode: data.programCode.trim() });
    if (exists) {
      throw new Error(`Program code '${data.programCode.trim()}' is already in use`);
    }
  }

  const program = await TrainingProgram.create(data);

  // If courses were specified upon creation, sync course.program
  if (Array.isArray(data.courses) && data.courses.length > 0) {
    await TrainingCourse.updateMany(
      { _id: { $in: data.courses } },
      { $set: { program: program._id } }
    );
  }

  return TrainingProgram.findById(program._id)
    .populate('department')
    .populate('courses')
    .populate('createdBy', 'firstName lastName email')
    .populate('programOwner', 'firstName lastName email department')
    .populate('trainer');
};

const updateProgram = async (id, data) => {
  if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
    throw new Error('End date cannot be earlier than start date');
  }
  if (data.budget !== undefined && Number(data.budget) < 0) {
    throw new Error('Budget cannot be negative');
  }
  if (data.capacity !== undefined && Number(data.capacity) < 0) {
    throw new Error('Capacity cannot be negative');
  }

  if (data.programCode) {
    const exists = await TrainingProgram.findOne({
      programCode: data.programCode.trim(),
      _id: { $ne: id }
    });
    if (exists) {
      throw new Error(`Program code '${data.programCode.trim()}' is already in use`);
    }
  }

  const updated = await TrainingProgram.findByIdAndUpdate(id, data, { new: true, runValidators: true })
    .populate('department')
    .populate('courses')
    .populate('createdBy', 'firstName lastName email')
    .populate('programOwner', 'firstName lastName email department')
    .populate('trainer');

  return updated;
};

const deleteProgram = async (id, force = false) => {
  const [assignments, sessions, certs] = await Promise.all([
    TrainingAssignment.countDocuments({ program: id }),
    TrainingSession.countDocuments({ program: id }),
    TrainingCertification.countDocuments({ program: id })
  ]);

  const hasRelatedRecords = assignments > 0 || sessions > 0 || certs > 0;

  if (hasRelatedRecords && !force) {
    // Safely archive instead of hard delete
    const archived = await TrainingProgram.findByIdAndUpdate(
      id,
      { isArchived: true, status: 'Archived' },
      { new: true }
    );
    return {
      archived: true,
      message: 'Program has linked assignments/sessions/certifications and has been archived safely.',
      program: archived
    };
  }

  const deleted = await TrainingProgram.findByIdAndDelete(id);
  // Unlink course.program references
  await TrainingCourse.updateMany({ program: id }, { $unset: { program: 1 } });

  return {
    deleted: true,
    message: 'Program deleted successfully.',
    program: deleted
  };
};

const addCourseToProgram = async (programId, courseId) => {
  const program = await TrainingProgram.findByIdAndUpdate(
    programId,
    { $addToSet: { courses: courseId } },
    { new: true }
  ).populate('department').populate('courses').populate('programOwner').populate('trainer');

  await TrainingCourse.findByIdAndUpdate(courseId, { program: programId });
  return program;
};

const removeCourseFromProgram = async (programId, courseId) => {
  const program = await TrainingProgram.findByIdAndUpdate(
    programId,
    { $pull: { courses: courseId } },
    { new: true }
  ).populate('department').populate('courses').populate('programOwner').populate('trainer');

  await TrainingCourse.updateOne({ _id: courseId, program: programId }, { $unset: { program: 1 } });
  return program;
};

const addBatchToProgram = async (programId, batchData) => {
  if (!batchData.batchName || !batchData.batchName.trim()) {
    throw new Error('Batch name is required');
  }
  if (batchData.startDate && batchData.endDate && new Date(batchData.endDate) < new Date(batchData.startDate)) {
    throw new Error('Batch end date cannot be earlier than start date');
  }

  const program = await TrainingProgram.findByIdAndUpdate(
    programId,
    { $push: { batches: batchData } },
    { new: true, runValidators: true }
  ).populate('department').populate('courses').populate('programOwner').populate('trainer');

  return program;
};

const updateBatch = async (programId, batchId, batchData) => {
  const program = await TrainingProgram.findById(programId);
  if (!program) throw new Error('Program not found');

  const batch = program.batches.id(batchId);
  if (!batch) throw new Error('Batch not found');

  if (batchData.batchName) batch.batchName = batchData.batchName.trim();
  if (batchData.startDate) batch.startDate = batchData.startDate;
  if (batchData.endDate) batch.endDate = batchData.endDate;
  if (batchData.capacity !== undefined) batch.capacity = Number(batchData.capacity);
  if (batchData.status) batch.status = batchData.status;

  await program.save();
  return TrainingProgram.findById(programId)
    .populate('department').populate('courses').populate('programOwner').populate('trainer');
};

const deleteBatch = async (programId, batchId) => {
  const program = await TrainingProgram.findByIdAndUpdate(
    programId,
    { $pull: { batches: { _id: batchId } } },
    { new: true }
  ).populate('department').populate('courses').populate('programOwner').populate('trainer');

  return program;
};

/* ──────────────── COURSES ──────────────── */
const generateCourseCode = async () => {
  const currentYear = new Date().getFullYear();
  const prefix = `CRS-${currentYear}-`;

  const existingCourses = await TrainingCourse.find({
    code: { $regex: `^CRS-${currentYear}-\\d+$` }
  }).select('code');

  let maxNum = 0;
  for (const c of existingCourses) {
    if (c.code) {
      const parts = c.code.split('-');
      const num = parseInt(parts[2], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `${prefix}${String(nextNum).padStart(3, '0')}`;
};

const getCourses = async (q = {}) => {
  const filter = { ...q };

  // Text search across title, code, category, skillTopic, and description
  if (filter.search) {
    const s = filter.search.trim();
    filter.$or = [
      { title: { $regex: s, $options: 'i' } },
      { code: { $regex: s, $options: 'i' } },
      { category: { $regex: s, $options: 'i' } },
      { skillTopic: { $regex: s, $options: 'i' } },
      { description: { $regex: s, $options: 'i' } }
    ];
    delete filter.search;
  }

  // Difficulty / Level
  if (filter.difficulty && filter.difficulty !== 'All') {
    filter.difficulty = filter.difficulty;
  } else {
    delete filter.difficulty;
  }
  if (filter.level && filter.level !== 'All') {
    filter.difficulty = filter.level;
    delete filter.level;
  }

  // Category
  if (filter.category && filter.category !== 'All') {
    filter.category = filter.category;
  } else {
    delete filter.category;
  }

  // Department
  if (filter.department && filter.department !== 'All') {
    filter.department = filter.department;
  } else {
    delete filter.department;
  }

  // Trainer
  if (filter.trainer && filter.trainer !== 'All') {
    filter.trainer = filter.trainer;
  } else {
    delete filter.trainer;
  }

  // Status
  if (filter.status && filter.status !== 'All') {
    filter.status = filter.status;
  } else {
    delete filter.status;
  }

  // Program association filter
  if (filter.program && filter.program !== 'All') {
    const programId = filter.program;
    delete filter.program;

    const matchConditions = [
      { program: programId },
      { programs: programId }
    ];

    try {
      const programDoc = await TrainingProgram.findById(programId);
      if (programDoc) {
        const courseIds = (programDoc.courses || []).map(c => c._id || c);
        if (courseIds.length > 0) {
          matchConditions.push({ _id: { $in: courseIds } });
        }
        if (programDoc.name) {
          matchConditions.push({ title: { $regex: `^${programDoc.name.trim()}$`, $options: 'i' } });
        }
      }
    } catch (e) {
      console.warn('Program lookup notice in getCourses:', e.message);
    }

    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: matchConditions }];
      delete filter.$or;
    } else {
      filter.$or = matchConditions;
    }
  }

  return TrainingCourse.find(filter)
    .populate('department')
    .populate({
      path: 'trainer',
      populate: { path: 'employee', select: 'firstName lastName email' }
    })
    .populate('programs', 'name programCode trainingType category status')
    .populate('program', 'name programCode')
    .populate('createdBy', 'firstName lastName email')
    .sort({ createdAt: -1 });
};

const getCourseById = async (id) => {
  const course = await TrainingCourse.findById(id)
    .populate('department')
    .populate({
      path: 'trainer',
      populate: { path: 'employee', select: 'firstName lastName email' }
    })
    .populate('programs', 'name programCode trainingType category status startDate endDate')
    .populate('program', 'name programCode')
    .populate('createdBy', 'firstName lastName email');

  if (!course) return null;

  // Retrieve associated entities in parallel
  const [linkedPrograms, sessions, assignments, assessments, certifications] = await Promise.all([
    TrainingProgram.find({
      $or: [
        { _id: { $in: course.programs || [] } },
        { _id: course.program },
        { courses: id }
      ]
    }).select('name programCode trainingType category status startDate endDate capacity'),
    TrainingSession.find({ course: id })
      .populate('trainer')
      .populate('program', 'name programCode')
      .sort({ sessionDate: -1 }),
    TrainingAssignment.find({ course: id })
      .populate('employee', 'firstName lastName email department')
      .populate('program', 'name programCode')
      .sort({ createdAt: -1 }),
    TrainingAssessment.find({ course: id })
      .populate('program', 'name programCode')
      .sort({ createdAt: -1 }),
    TrainingCertification.find({ course: id })
      .populate('employee', 'firstName lastName email')
      .populate('program', 'name programCode')
      .sort({ issueDate: -1 })
  ]);

  const totalParticipants = assignments.length;
  const completedCount = assignments.filter(a => a.status === 'Completed').length;
  const inProgressCount = assignments.filter(a => a.status === 'In Progress').length;
  const completionRate = totalParticipants > 0 ? Math.round((completedCount / totalParticipants) * 100) : 0;

  const validScores = assignments.filter(a => typeof a.assessmentScore === 'number' && a.assessmentScore >= 0);
  const avgScore = validScores.length > 0
    ? Math.round(validScores.reduce((acc, a) => acc + a.assessmentScore, 0) / validScores.length)
    : 0;

  return {
    course,
    programs: linkedPrograms,
    sessions,
    participants: assignments,
    assessments,
    certifications,
    stats: {
      totalPrograms: linkedPrograms.length,
      totalSessions: sessions.length,
      totalParticipants,
      completedCount,
      inProgressCount,
      completionRate,
      avgScore,
      totalModules: course.modules?.length || 0,
      totalObjectives: course.learningObjectives?.length || 0,
      totalMaterials: course.materials?.length || 0,
      totalCertifications: certifications.length
    }
  };
};

const createCourse = async (data) => {
  const payload = { ...data };

  // Auto-generate unique course code if omitted
  if (!payload.code || !payload.code.trim()) {
    payload.code = await generateCourseCode();
  } else {
    payload.code = payload.code.trim().toUpperCase();
    const existing = await TrainingCourse.findOne({ code: payload.code });
    if (existing) {
      throw new Error(`Course code '${payload.code}' is already in use.`);
    }
  }

  // Calculate durationHours if duration and unit provided
  if (payload.duration !== undefined) {
    const dur = Number(payload.duration) || 0;
    if (payload.durationUnit === 'Days') payload.durationHours = dur * 8;
    else if (payload.durationUnit === 'Weeks') payload.durationHours = dur * 40;
    else payload.durationHours = dur;
  }

  // Ensure programs is an array
  if (payload.program && (!payload.programs || payload.programs.length === 0)) {
    payload.programs = [payload.program];
  }

  const course = await TrainingCourse.create(payload);

  // Bidirectional sync with TrainingProgram.courses
  const programIdsToSync = [];
  if (payload.program) programIdsToSync.push(payload.program);
  if (Array.isArray(payload.programs)) {
    payload.programs.forEach(pid => {
      if (pid && !programIdsToSync.includes(String(pid))) programIdsToSync.push(String(pid));
    });
  }

  if (programIdsToSync.length > 0) {
    await TrainingProgram.updateMany(
      { _id: { $in: programIdsToSync } },
      { $addToSet: { courses: course._id } }
    );
  }

  return TrainingCourse.findById(course._id)
    .populate('department')
    .populate('trainer')
    .populate('programs')
    .populate('createdBy', 'firstName lastName email');
};

const updateCourse = async (id, data) => {
  const payload = { ...data };

  if (payload.code) {
    payload.code = payload.code.trim().toUpperCase();
    const existing = await TrainingCourse.findOne({ code: payload.code, _id: { $ne: id } });
    if (existing) {
      throw new Error(`Course code '${payload.code}' is already in use.`);
    }
  }

  // Calculate durationHours
  if (payload.duration !== undefined) {
    const dur = Number(payload.duration) || 0;
    if (payload.durationUnit === 'Days') payload.durationHours = dur * 8;
    else if (payload.durationUnit === 'Weeks') payload.durationHours = dur * 40;
    else payload.durationHours = dur;
  }

  const updatedCourse = await TrainingCourse.findByIdAndUpdate(id, payload, { new: true, runValidators: true })
    .populate('department')
    .populate('trainer')
    .populate('programs')
    .populate('createdBy', 'firstName lastName email');

  // Sync programs bidirectionally if programs updated
  if (Array.isArray(payload.programs)) {
    await TrainingProgram.updateMany(
      { courses: id, _id: { $nin: payload.programs } },
      { $pull: { courses: id } }
    );
    await TrainingProgram.updateMany(
      { _id: { $in: payload.programs } },
      { $addToSet: { courses: id } }
    );
  }

  return updatedCourse;
};

const deleteCourse = async (id, force = false) => {
  const [assignments, sessions, certs, programsWithCourse] = await Promise.all([
    TrainingAssignment.countDocuments({ course: id }),
    TrainingSession.countDocuments({ course: id }),
    TrainingCertification.countDocuments({ course: id }),
    TrainingProgram.countDocuments({ courses: id })
  ]);

  const hasRelatedRecords = assignments > 0 || sessions > 0 || certs > 0 || programsWithCourse > 0;

  if (hasRelatedRecords && !force) {
    const archived = await TrainingCourse.findByIdAndUpdate(
      id,
      { isArchived: true, status: 'Archived' },
      { new: true }
    );
    return {
      archived: true,
      message: 'Course has associated assignments, sessions, certifications, or programs and has been archived safely.',
      course: archived
    };
  }

  const deleted = await TrainingCourse.findByIdAndDelete(id);
  // Unlink course from programs
  await TrainingProgram.updateMany({ courses: id }, { $pull: { courses: id } });

  return {
    deleted: true,
    message: 'Course deleted successfully.',
    course: deleted
  };
};

/* ── Course Sub-entity Operations ── */
const addModuleToCourse = async (courseId, moduleData) => {
  if (!moduleData.moduleName || !moduleData.moduleName.trim()) {
    throw new Error('Module name is required');
  }

  const course = await TrainingCourse.findById(courseId);
  if (!course) throw new Error('Course not found');

  const order = moduleData.order || (course.modules?.length || 0) + 1;
  const newModule = {
    moduleName: moduleData.moduleName.trim(),
    description: moduleData.description || '',
    duration: moduleData.duration || '',
    order
  };

  course.modules.push(newModule);
  await course.save();
  return course;
};

const updateCourseModule = async (courseId, moduleId, moduleData) => {
  const course = await TrainingCourse.findById(courseId);
  if (!course) throw new Error('Course not found');

  const mod = course.modules.id(moduleId);
  if (!mod) throw new Error('Module not found');

  if (moduleData.moduleName) mod.moduleName = moduleData.moduleName.trim();
  if (moduleData.description !== undefined) mod.description = moduleData.description;
  if (moduleData.duration !== undefined) mod.duration = moduleData.duration;
  if (moduleData.order !== undefined) mod.order = Number(moduleData.order);

  await course.save();
  return course;
};

const deleteCourseModule = async (courseId, moduleId) => {
  const course = await TrainingCourse.findById(courseId);
  if (!course) throw new Error('Course not found');

  course.modules.pull({ _id: moduleId });
  await course.save();
  return course;
};

const addObjectiveToCourse = async (courseId, objectiveData) => {
  if (!objectiveData.objective || !objectiveData.objective.trim()) {
    throw new Error('Learning objective is required');
  }

  const course = await TrainingCourse.findById(courseId);
  if (!course) throw new Error('Course not found');

  const order = objectiveData.order || (course.learningObjectives?.length || 0) + 1;
  course.learningObjectives.push({
    objective: objectiveData.objective.trim(),
    order
  });

  await course.save();
  return course;
};

const deleteObjectiveFromCourse = async (courseId, objectiveId) => {
  const course = await TrainingCourse.findById(courseId);
  if (!course) throw new Error('Course not found');

  course.learningObjectives.pull({ _id: objectiveId });
  await course.save();
  return course;
};

const addMaterialToCourse = async (courseId, materialData) => {
  if (!materialData.title || !materialData.title.trim()) {
    throw new Error('Material title is required');
  }

  const course = await TrainingCourse.findById(courseId);
  if (!course) throw new Error('Course not found');

  course.materials.push({
    title: materialData.title.trim(),
    materialType: materialData.materialType || 'Document',
    url: materialData.url || '',
    fileName: materialData.fileName || '',
    fileSize: materialData.fileSize || '',
    notes: materialData.notes || '',
    uploadedAt: new Date()
  });

  await course.save();
  return course;
};

const deleteMaterialFromCourse = async (courseId, materialId) => {
  const course = await TrainingCourse.findById(courseId);
  if (!course) throw new Error('Course not found');

  course.materials.pull({ _id: materialId });
  await course.save();
  return course;
};

const linkProgramToCourse = async (courseId, programId) => {
  const course = await TrainingCourse.findByIdAndUpdate(
    courseId,
    { $addToSet: { programs: programId } },
    { new: true }
  ).populate('programs');

  await TrainingProgram.findByIdAndUpdate(
    programId,
    { $addToSet: { courses: courseId } }
  );

  return course;
};

const unlinkProgramFromCourse = async (courseId, programId) => {
  const course = await TrainingCourse.findByIdAndUpdate(
    courseId,
    { $pull: { programs: programId } },
    { new: true }
  ).populate('programs');

  await TrainingProgram.findByIdAndUpdate(
    programId,
    { $pull: { courses: courseId } }
  );

  return course;
};

const updateCourseAssessmentConfig = async (courseId, config) => {
  const course = await TrainingCourse.findByIdAndUpdate(
    courseId,
    {
      $set: {
        assessmentConfig: {
          required: Boolean(config.required),
          passingScore: Number(config.passingScore) || 60,
          maxAttempts: Number(config.maxAttempts) || 3
        },
        assessmentRequired: Boolean(config.required)
      }
    },
    { new: true }
  );
  return course;
};

const updateCourseCertificationConfig = async (courseId, config) => {
  const course = await TrainingCourse.findByIdAndUpdate(
    courseId,
    {
      $set: {
        certificationConfig: {
          eligible: Boolean(config.eligible),
          minAttendancePct: Number(config.minAttendancePct) || 80,
          minAssessmentScore: Number(config.minAssessmentScore) || 60,
          requireCourseCompletion: config.requireCourseCompletion !== false
        },
        certificationRequired: Boolean(config.eligible)
      }
    },
    { new: true }
  );
  return course;
};

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
const getCertificationById = (id) => TrainingCertification.findById(id).populate('program').populate('course').populate('employee', 'firstName lastName email department').populate('issuedBy', 'firstName lastName email');
const createCertification = (data) => TrainingCertification.create(data);
const updateCertification = (id, data) => TrainingCertification.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate('program').populate('course').populate('employee', 'firstName lastName email department');
const deleteCertification = (id) => TrainingCertification.findByIdAndDelete(id);

const generateCertification = async ({ employee, course, program, assignment, issuedBy }) => {
  // Validate course exists
  const courseDoc = await TrainingCourse.findById(course);
  if (!courseDoc) {
    throw new Error('Course not found');
  }

  // Check for duplicate active certification
  const existingCert = await TrainingCertification.findOne({
    employee,
    course,
    status: 'Active'
  });
  if (existingCert) {
    throw new Error(`An active certification (${existingCert.certificateNumber}) already exists for this employee and course.`);
  }

  // Ensure an assignment / completion record exists for tracking
  const queryFilter = { employee, course };
  if (assignment) queryFilter._id = assignment;

  let assignmentDoc = await TrainingAssignment.findOne({ ...queryFilter, status: 'Completed' });

  if (!assignmentDoc) {
    const existingAsgn = await TrainingAssignment.findOne(queryFilter);
    if (existingAsgn) {
      existingAsgn.status = 'Completed';
      existingAsgn.completionDate = existingAsgn.completionDate || new Date();
      if (program && !existingAsgn.program) existingAsgn.program = program;
      await existingAsgn.save();
      assignmentDoc = existingAsgn;
    } else {
      assignmentDoc = await TrainingAssignment.create({
        program: program || courseDoc.program || null,
        course,
        employee,
        startDate: new Date(),
        dueDate: new Date(),
        status: 'Completed',
        completionDate: new Date()
      });
    }
  }

  const year = new Date().getFullYear();
  const count = await TrainingCertification.countDocuments();
  const certNumber = `CERT-${year}-${String(count + 1).padStart(6, '0')}`;

  const assessment = await TrainingAssessment.findOne({ employee, course }).sort({ assessmentDate: -1 });

  const cert = await TrainingCertification.create({
    employee,
    course,
    program: program || assignmentDoc?.program || courseDoc.program,
    assignment: assignmentDoc?._id,
    certificateNumber: certNumber,
    certificateType: 'Completion',
    finalScore: assessment?.score || null,
    completionDate: assignmentDoc?.completionDate || assignmentDoc?.updatedAt || new Date(),
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

const generateCertificatePdfDoc = (data) => {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 0,
    info: {
      Title: `Certificate - ${data.employeeName} - ${data.courseName}`,
      Author: 'ASHA SM TECHNOLOGIES',
      Subject: 'Training Certificate of Completion',
    }
  });

  const pageWidth = 841.89;
  const pageHeight = 595.28;

  // Background
  doc.rect(0, 0, pageWidth, pageHeight).fill('#fafafa');

  // Outer Border
  doc.rect(20, 20, pageWidth - 40, pageHeight - 40)
     .lineWidth(3)
     .stroke('#1e3a8a');

  // Inner Decorative Border
  doc.rect(26, 26, pageWidth - 52, pageHeight - 52)
     .lineWidth(1)
     .stroke('#b45309');

  // Corner decorative marks
  const cornerSize = 15;
  const drawCorner = (x, y, dx, dy) => {
    doc.save();
    doc.strokeColor('#b45309').lineWidth(2);
    doc.moveTo(x, y + dy * cornerSize).lineTo(x, y).lineTo(x + dx * cornerSize, y).stroke();
    doc.restore();
  };
  drawCorner(32, 32, 1, 1);
  drawCorner(pageWidth - 32, 32, -1, 1);
  drawCorner(32, pageHeight - 32, 1, -1);
  drawCorner(pageWidth - 32, pageHeight - 32, -1, -1);

  // Logo loading
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const candidateLogoPaths = [
    path.resolve(__dirname, '../../../client/public/aasha-logo-new.jpg'),
    path.resolve(process.cwd(), '../client/public/aasha-logo-new.jpg'),
    path.resolve(process.cwd(), 'client/public/aasha-logo-new.jpg'),
    'd:/CRM PROJECT AASHA SM/client/public/aasha-logo-new.jpg'
  ];
  const foundLogo = candidateLogoPaths.find(p => fs.existsSync(p));

  if (foundLogo) {
    try {
      doc.image(foundLogo, (pageWidth - 140) / 2, 42, { width: 140 });
    } catch (e) {
      console.warn('Logo load error:', e.message);
    }
  }

  // Company Name
  doc.fontSize(12)
     .font('Helvetica-Bold')
     .fillColor('#1e3a8a')
     .text('ASHA SM TECHNOLOGIES', 0, 105, { align: 'center', characterSpacing: 2 });

  // Certificate Title
  doc.fontSize(22)
     .font('Helvetica-Bold')
     .fillColor('#0f172a')
     .text('CERTIFICATE OF COMPLETION', 0, 130, { align: 'center', characterSpacing: 3 });

  // Gold accent bar
  const barWidth = 180;
  doc.rect((pageWidth - barWidth) / 2, 160, barWidth, 2).fill('#d97706');

  // Subtitle
  doc.fontSize(12)
     .font('Helvetica-Oblique')
     .fillColor('#64748b')
     .text('This certificate is proudly presented to', 0, 175, { align: 'center' });

  // Employee Name
  doc.fontSize(26)
     .font('Helvetica-Bold')
     .fillColor('#1e3a8a')
     .text(data.employeeName || 'Employee', 0, 205, { align: 'center' });

  // Underline for name
  const nameWidth = Math.min(450, Math.max(250, (data.employeeName || 'Employee').length * 15));
  doc.rect((pageWidth - nameWidth) / 2, 240, nameWidth, 1).fill('#cbd5e1');

  // Completion statement
  doc.fontSize(11)
     .font('Helvetica')
     .fillColor('#334155')
     .text('for successfully completing the corporate training course', 0, 255, { align: 'center' });

  // Course Title
  doc.fontSize(18)
     .font('Helvetica-Bold')
     .fillColor('#0f172a')
     .text(data.courseName || 'Professional Course', 0, 278, { align: 'center' });

  // Program info
  if (data.programName) {
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor('#475569')
       .text(`under the training program: "${data.programName}"`, 0, 308, { align: 'center' });
  }

  // Verification text
  doc.fontSize(9.5)
     .font('Helvetica')
     .fillColor('#64748b')
     .text('Having demonstrated mastery of the curriculum, required hands-on modules, and assessments.', 0, 332, { align: 'center' });

  // Meta box / Details Grid
  const boxY = 368;
  const colWidth = 170;
  const startX = (pageWidth - (colWidth * 3 + 40)) / 2;

  // Box 1: Certificate #
  doc.roundedRect(startX, boxY, colWidth, 48, 4).fillAndStroke('#f1f5f9', '#e2e8f0');
  doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text('CERTIFICATE NUMBER', startX, boxY + 8, { width: colWidth, align: 'center' });
  doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a').text(data.certificateNumber || 'N/A', startX, boxY + 24, { width: colWidth, align: 'center' });

  // Box 2: Issue Date
  const col2X = startX + colWidth + 20;
  doc.roundedRect(col2X, boxY, colWidth, 48, 4).fillAndStroke('#f1f5f9', '#e2e8f0');
  doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text('ISSUE DATE', col2X, boxY + 8, { width: colWidth, align: 'center' });
  doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a').text(data.issueDate || '—', col2X, boxY + 24, { width: colWidth, align: 'center' });

  // Box 3: Completion Date
  const col3X = col2X + colWidth + 20;
  doc.roundedRect(col3X, boxY, colWidth, 48, 4).fillAndStroke('#f1f5f9', '#e2e8f0');
  doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text('COMPLETION DATE', col3X, boxY + 8, { width: colWidth, align: 'center' });
  doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a').text(data.completionDate || '—', col3X, boxY + 24, { width: colWidth, align: 'center' });

  // Signatures Area
  const sigY = 440;

  // Left signature: Head of HR
  const leftSigX = 80;
  doc.moveTo(leftSigX, sigY + 45).lineTo(leftSigX + 180, sigY + 45).stroke('#94a3b8');
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text('Head of Human Resources', leftSigX, sigY + 50, { width: 180, align: 'center' });
  doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('ASHA SM TECHNOLOGIES', leftSigX, sigY + 65, { width: 180, align: 'center' });

  // Center Seal
  const sealX = (pageWidth - 80) / 2;
  doc.circle(sealX + 40, sigY + 35, 30).lineWidth(2).stroke('#b45309');
  doc.circle(sealX + 40, sigY + 35, 27).lineWidth(1).stroke('#d97706');
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#b45309').text('OFFICIAL', sealX, sigY + 24, { width: 80, align: 'center' });
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e3a8a').text('VERIFIED', sealX, sigY + 34, { width: 80, align: 'center' });
  doc.fontSize(6.5).font('Helvetica').fillColor('#b45309').text('CERTIFICATE', sealX, sigY + 45, { width: 80, align: 'center' });

  // Right signature: Director of Training
  const rightSigX = pageWidth - 260;
  doc.moveTo(rightSigX, sigY + 45).lineTo(rightSigX + 180, sigY + 45).stroke('#94a3b8');
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text('Corporate Training Director', rightSigX, sigY + 50, { width: 180, align: 'center' });
  doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('Authorized Signatory', rightSigX, sigY + 65, { width: 180, align: 'center' });

  // Footer note
  doc.fontSize(7.5)
     .font('Helvetica')
     .fillColor('#94a3b8')
     .text('This document is electronically verified and issued by ASHA SM TECHNOLOGIES CRM System.', 0, pageHeight - 34, { align: 'center' });

  return doc;
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

/* ──────────────── SKILL PERFORMANCE ──────────────── */
const getSkillPerformance = async () => {
  const assessments = await TrainingAssessment.find()
    .populate({
      path: 'course',
      select: 'title category skillTopic'
    })
    .populate({
      path: 'program',
      select: 'name category'
    })
    .lean();

  const reviews = await PerformanceReview.find({
    status: { $in: ['Completed', 'In Review', 'Pending'] }
  }).lean();

  const skillScores = new Map();

  const recordScore = (skillName, percentage) => {
    if (!skillName || typeof percentage !== 'number' || isNaN(percentage)) return;
    const cleanSkill = skillName.trim();
    if (!cleanSkill) return;
    if (!skillScores.has(cleanSkill)) {
      skillScores.set(cleanSkill, { total: 0, count: 0 });
    }
    const entry = skillScores.get(cleanSkill);
    entry.total += Math.min(100, Math.max(0, percentage));
    entry.count += 1;
  };

  assessments.forEach((item) => {
    if (typeof item.score !== 'number') return;
    const maxScore = Number(item.maxScore) > 0 ? Number(item.maxScore) : 100;
    const pct = (item.score / maxScore) * 100;

    const skillName = item.course?.skillTopic
      || (item.course?.category && item.course.category !== 'General' ? item.course.category : null)
      || item.course?.title
      || (item.program?.category && item.program.category !== 'General' ? item.program.category : null)
      || item.program?.name
      || 'Technical Skills';

    recordScore(skillName, pct);
  });

  reviews.forEach((rev) => {
    const ratings = rev.ratings;
    if (!ratings) return;

    if (typeof ratings.communication === 'number') {
      recordScore('Communication', (ratings.communication / 5) * 100);
    }
    if (typeof ratings.teamwork === 'number') {
      recordScore('Teamwork', (ratings.teamwork / 5) * 100);
    }
    if (typeof ratings.problemSolving === 'number') {
      recordScore('Problem Solving', (ratings.problemSolving / 5) * 100);
    }
    if (typeof ratings.qualityOfWork === 'number') {
      recordScore('Quality of Work', (ratings.qualityOfWork / 5) * 100);
    }
    if (typeof ratings.productivity === 'number') {
      recordScore('Productivity', (ratings.productivity / 5) * 100);
    }
  });

  const result = [];
  skillScores.forEach((val, skill) => {
    if (val.count > 0) {
      result.push({
        skill,
        performance: Math.round(val.total / val.count),
        totalAssessments: val.count
      });
    }
  });

  result.sort((a, b) => b.performance - a.performance);
  return result;
};

export const TrainingService = {
  getPrograms, getProgramById, createProgram, updateProgram, deleteProgram,
  addCourseToProgram, removeCourseFromProgram,
  addBatchToProgram, updateBatch, deleteBatch,
  getCourses, getCourseById, createCourse, updateCourse, deleteCourse,
  addModuleToCourse, updateCourseModule, deleteCourseModule,
  addObjectiveToCourse, deleteObjectiveFromCourse,
  addMaterialToCourse, deleteMaterialFromCourse,
  linkProgramToCourse, unlinkProgramFromCourse,
  updateCourseAssessmentConfig, updateCourseCertificationConfig,
  getTrainers, getTrainerById, createTrainer, updateTrainer, deleteTrainer,
  getSessions, getSessionById, createSession, updateSession, deleteSession,
  getAssignments, getAssignmentById, createAssignment, bulkCreateAssignments, updateAssignment, deleteAssignment,
  getAttendance, createAttendance, bulkCreateAttendance, updateAttendance, deleteAttendance,
  getAssessments, createAssessment, updateAssessment, deleteAssessment,
  getCertifications, getCertificationById, createCertification, updateCertification, deleteCertification, generateCertification, revokeCertification, generateCertificatePdfDoc,
  getFeedback, createFeedback, updateFeedback, deleteFeedback,
  getCosts, createCost, updateCost, deleteCost,
  getOverview, getCostReports, getSkillPerformance
};

export default TrainingService;
