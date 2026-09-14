import { TrainingService } from '../services/TrainingService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { successResponse, createdResponse } from '../utils/apiResponse.js';
import { createValidationError, createNotFoundError } from '../utils/apiError.js';
import mongoose from 'mongoose';

const toId = (v) => {
  if (!v) return undefined;
  if (mongoose.Types.ObjectId.isValid(v)) return v;
  return undefined;
};

export class TrainingController {
  /* ──────── Overview & Skill Performance ──────── */
  static getOverview = asyncHandler(async (_req, res) => {
    const data = await TrainingService.getOverview();
    res.json(successResponse(data, 'Training overview retrieved'));
  });

  static getSkillPerformance = asyncHandler(async (_req, res) => {
    const data = await TrainingService.getSkillPerformance();
    res.json(successResponse(data, 'Skill performance retrieved'));
  });

  /* ──────── Programs ──────── */
  static getPrograms = asyncHandler(async (req, res) => {
    const query = {};
    if (req.query.status && req.query.status !== 'All') query.status = req.query.status;
    if (req.query.department && req.query.department !== 'All') query.department = req.query.department;
    if (req.query.trainingType && req.query.trainingType !== 'All') query.trainingType = req.query.trainingType;
    if (req.query.category && req.query.category !== 'All') query.category = req.query.category;
    if (req.query.programOwner) query.programOwner = req.query.programOwner;
    if (req.query.search) query.search = req.query.search;
    const data = await TrainingService.getPrograms(query);
    res.json(successResponse(data, 'Programs retrieved'));
  });

  static getProgramById = asyncHandler(async (req, res) => {
    const data = await TrainingService.getProgramById(req.params.id);
    if (!data) throw createNotFoundError('Program not found');
    res.json(successResponse(data, 'Program retrieved'));
  });

  static createProgram = asyncHandler(async (req, res) => {
    const { name, trainingType, department, startDate, endDate } = req.body;
    if (!name || !name.trim()) throw createValidationError('Program name is required');
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      throw createValidationError('End date cannot be earlier than start date');
    }
    const data = await TrainingService.createProgram({ ...req.body, createdBy: req.user.userId });
    res.status(201).json(createdResponse(data, 'Program created successfully'));
  });

  static updateProgram = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.body;
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      throw createValidationError('End date cannot be earlier than start date');
    }
    const data = await TrainingService.updateProgram(req.params.id, req.body);
    if (!data) throw createNotFoundError('Program not found');
    res.json(successResponse(data, 'Program updated successfully'));
  });

  static deleteProgram = asyncHandler(async (req, res) => {
    const force = req.query.force === 'true';
    const result = await TrainingService.deleteProgram(req.params.id, force);
    if (!result || (!result.deleted && !result.archived)) throw createNotFoundError('Program not found');
    res.json(successResponse(result, result.message));
  });

  static addCourseToProgram = asyncHandler(async (req, res) => {
    const { courseId } = req.body;
    if (!courseId) throw createValidationError('Course ID is required');
    const data = await TrainingService.addCourseToProgram(req.params.id, courseId);
    res.json(successResponse(data, 'Course added to program successfully'));
  });

  static removeCourseFromProgram = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const data = await TrainingService.removeCourseFromProgram(req.params.id, courseId);
    res.json(successResponse(data, 'Course removed from program successfully'));
  });

  static addBatchToProgram = asyncHandler(async (req, res) => {
    const { batchName } = req.body;
    if (!batchName || !batchName.trim()) throw createValidationError('Batch name is required');
    const data = await TrainingService.addBatchToProgram(req.params.id, req.body);
    res.status(201).json(createdResponse(data, 'Batch added successfully'));
  });

  static updateBatch = asyncHandler(async (req, res) => {
    const data = await TrainingService.updateBatch(req.params.id, req.params.batchId, req.body);
    res.json(successResponse(data, 'Batch updated successfully'));
  });

  static deleteBatch = asyncHandler(async (req, res) => {
    const data = await TrainingService.deleteBatch(req.params.id, req.params.batchId);
    res.json(successResponse(data, 'Batch deleted successfully'));
  });

  /* ──────── Courses ──────── */
  static getCourses = asyncHandler(async (req, res) => {
    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.difficulty) query.difficulty = req.query.difficulty;
    if (req.query.level) query.level = req.query.level;
    if (req.query.category) query.category = req.query.category;
    if (req.query.department) query.department = req.query.department;
    if (req.query.trainer) query.trainer = req.query.trainer;
    if (req.query.search) query.search = req.query.search;
    if (req.query.program) query.program = req.query.program;
    const data = await TrainingService.getCourses(query);
    res.json(successResponse(data, 'Courses retrieved'));
  });

  static getCourseById = asyncHandler(async (req, res) => {
    const data = await TrainingService.getCourseById(req.params.id);
    if (!data) throw createNotFoundError('Course not found');
    res.json(successResponse(data, 'Course retrieved'));
  });

  static createCourse = asyncHandler(async (req, res) => {
    const { title } = req.body;
    if (!title || !title.trim()) throw createValidationError('Course title is required');
    const data = await TrainingService.createCourse({ ...req.body, createdBy: req.user.userId });
    res.status(201).json(createdResponse(data, 'Course created successfully'));
  });

  static updateCourse = asyncHandler(async (req, res) => {
    const data = await TrainingService.updateCourse(req.params.id, req.body);
    if (!data) throw createNotFoundError('Course not found');
    res.json(successResponse(data, 'Course updated successfully'));
  });

  static deleteCourse = asyncHandler(async (req, res) => {
    const force = req.query.force === 'true';
    const result = await TrainingService.deleteCourse(req.params.id, force);
    if (!result || (!result.deleted && !result.archived)) throw createNotFoundError('Course not found');
    res.json(successResponse(result, result.message));
  });

  static addModuleToCourse = asyncHandler(async (req, res) => {
    const { moduleName } = req.body;
    if (!moduleName || !moduleName.trim()) throw createValidationError('Module name is required');
    const data = await TrainingService.addModuleToCourse(req.params.id, req.body);
    res.status(201).json(createdResponse(data, 'Module added to course'));
  });

  static updateCourseModule = asyncHandler(async (req, res) => {
    const data = await TrainingService.updateCourseModule(req.params.id, req.params.moduleId, req.body);
    res.json(successResponse(data, 'Module updated'));
  });

  static deleteCourseModule = asyncHandler(async (req, res) => {
    const data = await TrainingService.deleteCourseModule(req.params.id, req.params.moduleId);
    res.json(successResponse(data, 'Module deleted'));
  });

  static addObjectiveToCourse = asyncHandler(async (req, res) => {
    const { objective } = req.body;
    if (!objective || !objective.trim()) throw createValidationError('Objective is required');
    const data = await TrainingService.addObjectiveToCourse(req.params.id, req.body);
    res.status(201).json(createdResponse(data, 'Learning objective added'));
  });

  static deleteObjectiveFromCourse = asyncHandler(async (req, res) => {
    const data = await TrainingService.deleteObjectiveFromCourse(req.params.id, req.params.objectiveId);
    res.json(successResponse(data, 'Learning objective deleted'));
  });

  static addMaterialToCourse = asyncHandler(async (req, res) => {
    const { title } = req.body;
    if (!title || !title.trim()) throw createValidationError('Material title is required');
    const data = await TrainingService.addMaterialToCourse(req.params.id, req.body);
    res.status(201).json(createdResponse(data, 'Material added'));
  });

  static deleteMaterialFromCourse = asyncHandler(async (req, res) => {
    const data = await TrainingService.deleteMaterialFromCourse(req.params.id, req.params.materialId);
    res.json(successResponse(data, 'Material deleted'));
  });

  static linkProgramToCourse = asyncHandler(async (req, res) => {
    const { programId } = req.body;
    if (!programId) throw createValidationError('Program ID is required');
    const data = await TrainingService.linkProgramToCourse(req.params.id, programId);
    res.json(successResponse(data, 'Program linked to course'));
  });

  static unlinkProgramFromCourse = asyncHandler(async (req, res) => {
    const data = await TrainingService.unlinkProgramFromCourse(req.params.id, req.params.programId);
    res.json(successResponse(data, 'Program unlinked from course'));
  });

  static updateCourseAssessmentConfig = asyncHandler(async (req, res) => {
    const data = await TrainingService.updateCourseAssessmentConfig(req.params.id, req.body);
    res.json(successResponse(data, 'Assessment configuration updated'));
  });

  static updateCourseCertificationConfig = asyncHandler(async (req, res) => {
    const data = await TrainingService.updateCourseCertificationConfig(req.params.id, req.body);
    res.json(successResponse(data, 'Certification configuration updated'));
  });

  /* ──────── Trainers ──────── */
  static getTrainers = asyncHandler(async (req, res) => {
    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.trainerType) query.trainerType = req.query.trainerType;
    if (req.query.search) query.search = req.query.search;
    const data = await TrainingService.getTrainers(query);
    res.json(successResponse(data, 'Trainers retrieved'));
  });

  static createTrainer = asyncHandler(async (req, res) => {
    const { trainerType, name, employee } = req.body;
    if (trainerType === 'External' && !name) throw createValidationError('Name is required for external trainers');
    if (trainerType === 'Internal' && !employee) throw createValidationError('Employee is required for internal trainers');
    const data = await TrainingService.createTrainer(req.body);
    res.status(201).json(createdResponse(data, 'Trainer created'));
  });

  static updateTrainer = asyncHandler(async (req, res) => {
    const data = await TrainingService.updateTrainer(req.params.id, req.body);
    if (!data) throw createNotFoundError('Trainer not found');
    res.json(successResponse(data, 'Trainer updated'));
  });

  static deleteTrainer = asyncHandler(async (req, res) => {
    const data = await TrainingService.deleteTrainer(req.params.id);
    if (!data) throw createNotFoundError('Trainer not found');
    res.json(successResponse(data, 'Trainer deleted'));
  });

  /* ──────── Sessions ──────── */
  static getSessions = asyncHandler(async (req, res) => {
    const query = {};
    if (req.query.program) query.program = req.query.program;
    if (req.query.course) query.course = req.query.course;
    if (req.query.status) query.status = req.query.status;
    if (req.query.search) query.search = req.query.search;
    const data = await TrainingService.getSessions(query);
    res.json(successResponse(data, 'Sessions retrieved'));
  });

  static createSession = asyncHandler(async (req, res) => {
    const { program, course, sessionTitle, sessionDate } = req.body;
    if (!program || !course || !sessionTitle || !sessionDate) throw createValidationError('Program, course, title, and date are required');
    const data = await TrainingService.createSession(req.body);
    res.status(201).json(createdResponse(data, 'Session created'));
  });

  static updateSession = asyncHandler(async (req, res) => {
    const data = await TrainingService.updateSession(req.params.id, req.body);
    if (!data) throw createNotFoundError('Session not found');
    res.json(successResponse(data, 'Session updated'));
  });

  static deleteSession = asyncHandler(async (req, res) => {
    const data = await TrainingService.deleteSession(req.params.id);
    if (!data) throw createNotFoundError('Session not found');
    res.json(successResponse(data, 'Session deleted'));
  });

  /* ──────── Assignments ──────── */
  static getAssignments = asyncHandler(async (req, res) => {
    const query = {};
    if (req.query.program) query.program = req.query.program;
    if (req.query.course) query.course = req.query.course;
    if (req.query.employee) query.employee = req.query.employee;
    if (req.query.status) query.status = req.query.status;
    const data = await TrainingService.getAssignments(query);
    res.json(successResponse(data, 'Assignments retrieved'));
  });

  static createAssignment = asyncHandler(async (req, res) => {
    const { program, course, employees } = req.body;
    if (!program || !course) throw createValidationError('Program and course are required');

    // Support bulk assignment via `employees` array
    if (Array.isArray(employees) && employees.length > 0) {
      const docs = employees.map((empId) => ({
        program,
        course,
        employee: empId,
        startDate: req.body.startDate,
        dueDate: req.body.dueDate,
        isMandatory: req.body.isMandatory !== undefined ? req.body.isMandatory : true,
        status: 'Assigned'
      }));
      const data = await TrainingService.bulkCreateAssignments(docs);
      return res.status(201).json(createdResponse(data, `${data.length} assignments created`));
    }

    // Single assignment
    if (!req.body.employee) throw createValidationError('Employee is required');
    const data = await TrainingService.createAssignment(req.body);
    res.status(201).json(createdResponse(data, 'Assignment created'));
  });

  static updateAssignment = asyncHandler(async (req, res) => {
    // If marking as Completed, set completionDate
    if (req.body.status === 'Completed' && !req.body.completionDate) {
      req.body.completionDate = new Date();
    }
    const data = await TrainingService.updateAssignment(req.params.id, req.body);
    if (!data) throw createNotFoundError('Assignment not found');
    res.json(successResponse(data, 'Assignment updated'));
  });

  static deleteAssignment = asyncHandler(async (req, res) => {
    const data = await TrainingService.deleteAssignment(req.params.id);
    if (!data) throw createNotFoundError('Assignment not found');
    res.json(successResponse(data, 'Assignment deleted'));
  });

  /* ──────── Attendance ──────── */
  static getAttendance = asyncHandler(async (req, res) => {
    const query = {};
    if (req.query.session) query.session = req.query.session;
    if (req.query.employee) query.employee = req.query.employee;
    if (req.query.status) query.status = req.query.status;
    const data = await TrainingService.getAttendance(query);
    res.json(successResponse(data, 'Attendance retrieved'));
  });

  static createAttendance = asyncHandler(async (req, res) => {
    const { session, records } = req.body;
    // Bulk mark attendance for a session
    if (session && Array.isArray(records) && records.length > 0) {
      const docs = records.map((r) => ({
        session,
        employee: r.employee,
        date: r.date || new Date(),
        status: r.status || 'Present',
        checkIn: r.checkIn || '',
        checkOut: r.checkOut || '',
        remarks: r.remarks || ''
      }));
      const data = await TrainingService.bulkCreateAttendance(docs);
      return res.status(201).json(createdResponse(data, `${data.length} attendance records created`));
    }
    // Single record
    if (!req.body.session || !req.body.employee) throw createValidationError('Session and employee are required');
    const data = await TrainingService.createAttendance(req.body);
    res.status(201).json(createdResponse(data, 'Attendance recorded'));
  });

  static updateAttendance = asyncHandler(async (req, res) => {
    const data = await TrainingService.updateAttendance(req.params.id, req.body);
    if (!data) throw createNotFoundError('Attendance not found');
    res.json(successResponse(data, 'Attendance updated'));
  });

  static deleteAttendance = asyncHandler(async (req, res) => {
    const data = await TrainingService.deleteAttendance(req.params.id);
    if (!data) throw createNotFoundError('Attendance not found');
    res.json(successResponse(data, 'Attendance deleted'));
  });

  /* ──────── Assessments ──────── */
  static getAssessments = asyncHandler(async (req, res) => {
    const query = {};
    if (req.query.course) query.course = req.query.course;
    if (req.query.employee) query.employee = req.query.employee;
    if (req.query.result) query.result = req.query.result;
    const data = await TrainingService.getAssessments(query);
    res.json(successResponse(data, 'Assessments retrieved'));
  });

  static createAssessment = asyncHandler(async (req, res) => {
    const { course, employee, score } = req.body;
    if (!course || !employee || score === undefined) throw createValidationError('Course, employee, and score are required');
    const data = await TrainingService.createAssessment(req.body);
    res.status(201).json(createdResponse(data, 'Assessment recorded'));
  });

  static updateAssessment = asyncHandler(async (req, res) => {
    const data = await TrainingService.updateAssessment(req.params.id, req.body);
    if (!data) throw createNotFoundError('Assessment not found');
    res.json(successResponse(data, 'Assessment updated'));
  });

  static deleteAssessment = asyncHandler(async (req, res) => {
    const data = await TrainingService.deleteAssessment(req.params.id);
    if (!data) throw createNotFoundError('Assessment not found');
    res.json(successResponse(data, 'Assessment deleted'));
  });

  /* ──────── Certifications ──────── */
  static getCertifications = asyncHandler(async (req, res) => {
    const query = {};
    if (req.query.employee) query.employee = req.query.employee;
    if (req.query.status) query.status = req.query.status;
    const data = await TrainingService.getCertifications(query);
    res.json(successResponse(data, 'Certifications retrieved'));
  });

  static createCertification = asyncHandler(async (req, res) => {
    const { employee, course, certificateNumber } = req.body;
    if (!employee || !course || !certificateNumber) throw createValidationError('Employee, course, and certificate number are required');
    const data = await TrainingService.createCertification(req.body);
    res.status(201).json(createdResponse(data, 'Certification issued'));
  });

  static updateCertification = asyncHandler(async (req, res) => {
    const data = await TrainingService.updateCertification(req.params.id, req.body);
    if (!data) throw createNotFoundError('Certification not found');
    res.json(successResponse(data, 'Certification updated'));
  });

  static deleteCertification = asyncHandler(async (req, res) => {
    const data = await TrainingService.deleteCertification(req.params.id);
    if (!data) throw createNotFoundError('Certification not found');
    res.json(successResponse(data, 'Certification deleted'));
  });

  static generateCertification = asyncHandler(async (req, res) => {
    const { employee, course, program, assignment } = req.body;
    if (!employee || !course) throw createValidationError('Employee and course are required');
    const data = await TrainingService.generateCertification({
      employee,
      course,
      program,
      assignment,
      issuedBy: req.user.userId
    });
    res.status(201).json(createdResponse(data, 'Certification generated successfully'));
  });

  static revokeCertification = asyncHandler(async (req, res) => {
    const data = await TrainingService.revokeCertification(req.params.id);
    if (!data) throw createNotFoundError('Certification not found');
    res.json(successResponse(data, 'Certification revoked successfully'));
  });

  static downloadCertificatePdf = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const cert = await TrainingService.getCertificationById(id);
    if (!cert) throw createNotFoundError('Certification not found');

    const empName = [cert.employee?.firstName, cert.employee?.lastName].filter(Boolean).join(' ') || cert.employee?.name || cert.employee?.email || 'Employee';
    const courseTitle = cert.course?.title || 'Training';
    const programName = cert.program?.name || '';
    const certNumber = cert.certificateNumber || 'CERT';
    const issueDate = cert.issueDate ? new Date(cert.issueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const completionDate = cert.completionDate ? new Date(cert.completionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : issueDate;

    const doc = TrainingService.generateCertificatePdfDoc({
      employeeName: empName,
      courseName: courseTitle,
      programName,
      certificateNumber: certNumber,
      issueDate,
      completionDate
    });

    const sanitizedEmp = empName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const sanitizedCourse = courseTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Certificate_${sanitizedEmp}_${sanitizedCourse}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);
    doc.end();
  });

  /* ──────── Feedback ──────── */
  static getFeedback = asyncHandler(async (req, res) => {
    const query = {};
    if (req.query.course) query.course = req.query.course;
    if (req.query.employee) query.employee = req.query.employee;
    if (req.query.trainer) query.trainer = req.query.trainer;
    const data = await TrainingService.getFeedback(query);
    res.json(successResponse(data, 'Feedback retrieved'));
  });

  static createFeedback = asyncHandler(async (req, res) => {
    const { employee, course, rating } = req.body;
    if (!employee || !course || !rating) throw createValidationError('Employee, course, and rating are required');
    const data = await TrainingService.createFeedback(req.body);
    res.status(201).json(createdResponse(data, 'Feedback submitted'));
  });

  static updateFeedback = asyncHandler(async (req, res) => {
    const data = await TrainingService.updateFeedback(req.params.id, req.body);
    if (!data) throw createNotFoundError('Feedback not found');
    res.json(successResponse(data, 'Feedback updated'));
  });

  static deleteFeedback = asyncHandler(async (req, res) => {
    const data = await TrainingService.deleteFeedback(req.params.id);
    if (!data) throw createNotFoundError('Feedback not found');
    res.json(successResponse(data, 'Feedback deleted'));
  });

  /* ──────── Costs ──────── */
  static getCosts = asyncHandler(async (req, res) => {
    const query = {};
    if (req.query.program) query.program = req.query.program;
    if (req.query.course) query.course = req.query.course;
    const data = await TrainingService.getCosts(query);
    res.json(successResponse(data, 'Costs retrieved'));
  });

  static createCost = asyncHandler(async (req, res) => {
    const { title } = req.body;
    if (!title) throw createValidationError('Title is required');
    const data = await TrainingService.createCost(req.body);
    res.status(201).json(createdResponse(data, 'Cost recorded'));
  });

  static updateCost = asyncHandler(async (req, res) => {
    const data = await TrainingService.updateCost(req.params.id, req.body);
    if (!data) throw createNotFoundError('Cost not found');
    res.json(successResponse(data, 'Cost updated'));
  });

  static deleteCost = asyncHandler(async (req, res) => {
    const data = await TrainingService.deleteCost(req.params.id);
    if (!data) throw createNotFoundError('Cost not found');
    res.json(successResponse(data, 'Cost deleted'));
  });

  /* ──────── Cost Reports ──────── */
  static getCostReports = asyncHandler(async (req, res) => {
    const filters = {};
    if (req.query.program) filters.program = toId(req.query.program);
    if (req.query.course) filters.course = toId(req.query.course);
    const data = await TrainingService.getCostReports(filters);
    res.json(successResponse(data, 'Cost reports retrieved'));
  });

  /* ──────── Progress (derived) ──────── */
  static getProgress = asyncHandler(async (req, res) => {
    const query = {};
    if (req.query.program) query.program = req.query.program;
    if (req.query.employee) query.employee = req.query.employee;

    // Get assignments first
    const assignments = await TrainingService.getAssignments(query);

    // For each assignment compute progress from sessions/attendance
    const progress = await Promise.all(assignments.map(async (a) => {
      const totalSessions = await (await import('../models/Training.js')).TrainingSession.countDocuments({ program: a.program?._id || a.program, course: a.course?._id || a.course });
      const attendedSessions = await (await import('../models/Training.js')).TrainingAttendance.countDocuments({
        employee: a.employee?._id || a.employee,
        session: { $in: (await (await import('../models/Training.js')).TrainingSession.find({ program: a.program?._id || a.program, course: a.course?._id || a.course }).select('_id')).map(s => s._id) },
        status: { $in: ['Present', 'Late'] }
      });
      const assessment = await (await import('../models/Training.js')).TrainingAssessment.findOne({ employee: a.employee?._id || a.employee, course: a.course?._id || a.course }).sort({ assessmentDate: -1 });

      const progressPct = totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : 0;

      return {
        _id: a._id,
        employee: a.employee,
        program: a.program,
        course: a.course,
        assignmentStatus: a.status,
        totalSessions,
        attendedSessions,
        progressPercent: progressPct,
        assessmentResult: assessment?.result || 'N/A',
        assessmentScore: assessment?.score || null,
        dueDate: a.dueDate,
        startDate: a.startDate
      };
    }));

    res.json(successResponse(progress, 'Progress retrieved'));
  });

  /* ──────── Completion (derived) ──────── */
  static getCompletion = asyncHandler(async (req, res) => {
    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.employee) query.employee = req.query.employee;
    // Completion is essentially assignments view filtered by terminal statuses
    if (!req.query.status) {
      query.status = { $in: ['Completed', 'Failed', 'Overdue'] };
    }
    const data = await TrainingService.getAssignments(query);
    res.json(successResponse(data, 'Completion data retrieved'));
  });
}

export default TrainingController;
