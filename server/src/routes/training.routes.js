import { Router } from 'express';
import TrainingController from '../controllers/TrainingController.js';
import { authenticateToken, authorizeHrOrAdmin } from '../middleware/auth.middleware.js';

const router = Router();

// All training routes require authentication + HR/Admin access
router.use(authenticateToken);
router.use(authorizeHrOrAdmin);

// Overview & Skill Performance
router.get('/overview', TrainingController.getOverview);
router.get('/skill-performance', TrainingController.getSkillPerformance);

// Programs
router.get('/programs', TrainingController.getPrograms);
router.get('/programs/:id', TrainingController.getProgramById);
router.post('/programs', TrainingController.createProgram);
router.put('/programs/:id', TrainingController.updateProgram);
router.delete('/programs/:id', TrainingController.deleteProgram);
router.post('/programs/:id/courses', TrainingController.addCourseToProgram);
router.delete('/programs/:id/courses/:courseId', TrainingController.removeCourseFromProgram);
router.post('/programs/:id/batches', TrainingController.addBatchToProgram);
router.put('/programs/:id/batches/:batchId', TrainingController.updateBatch);
router.delete('/programs/:id/batches/:batchId', TrainingController.deleteBatch);

// Courses
router.get('/courses', TrainingController.getCourses);
router.get('/courses/:id', TrainingController.getCourseById);
router.post('/courses', TrainingController.createCourse);
router.put('/courses/:id', TrainingController.updateCourse);
router.delete('/courses/:id', TrainingController.deleteCourse);
router.post('/courses/:id/modules', TrainingController.addModuleToCourse);
router.put('/courses/:id/modules/:moduleId', TrainingController.updateCourseModule);
router.delete('/courses/:id/modules/:moduleId', TrainingController.deleteCourseModule);
router.post('/courses/:id/objectives', TrainingController.addObjectiveToCourse);
router.delete('/courses/:id/objectives/:objectiveId', TrainingController.deleteObjectiveFromCourse);
router.post('/courses/:id/materials', TrainingController.addMaterialToCourse);
router.delete('/courses/:id/materials/:materialId', TrainingController.deleteMaterialFromCourse);
router.post('/courses/:id/programs', TrainingController.linkProgramToCourse);
router.delete('/courses/:id/programs/:programId', TrainingController.unlinkProgramFromCourse);
router.put('/courses/:id/assessment-config', TrainingController.updateCourseAssessmentConfig);
router.put('/courses/:id/certification-config', TrainingController.updateCourseCertificationConfig);

// Trainers
router.get('/trainers', TrainingController.getTrainers);
router.post('/trainers', TrainingController.createTrainer);
router.put('/trainers/:id', TrainingController.updateTrainer);
router.delete('/trainers/:id', TrainingController.deleteTrainer);

// Sessions
router.get('/sessions', TrainingController.getSessions);
router.post('/sessions', TrainingController.createSession);
router.put('/sessions/:id', TrainingController.updateSession);
router.delete('/sessions/:id', TrainingController.deleteSession);

// Assignments
router.get('/assignments', TrainingController.getAssignments);
router.post('/assignments', TrainingController.createAssignment);
router.put('/assignments/:id', TrainingController.updateAssignment);
router.delete('/assignments/:id', TrainingController.deleteAssignment);

// Attendance
router.get('/attendance', TrainingController.getAttendance);
router.post('/attendance', TrainingController.createAttendance);
router.put('/attendance/:id', TrainingController.updateAttendance);
router.delete('/attendance/:id', TrainingController.deleteAttendance);

// Progress (derived)
router.get('/progress', TrainingController.getProgress);

// Assessments
router.get('/assessments', TrainingController.getAssessments);
router.get('/assessments/submissions', TrainingController.getAssessmentSubmissions);
router.get('/assessments/:id', TrainingController.getAssessmentById);
router.post('/assessments', TrainingController.createAssessment);
router.post('/assessments/:id/assign', TrainingController.assignAssessment);
router.post('/assessments/:id/publish', TrainingController.publishAssessment);
router.post('/assessments/:id/evaluate', TrainingController.evaluateSubmission);
router.put('/assessments/:id', TrainingController.updateAssessment);
router.delete('/assessments/:id', TrainingController.deleteAssessment);

// Certifications
router.get('/certifications', TrainingController.getCertifications);
router.post('/certifications', TrainingController.createCertification);
router.post('/certifications/generate', TrainingController.generateCertification);
router.get('/certifications/:id/pdf', TrainingController.downloadCertificatePdf);
router.get('/certifications/:id/download', TrainingController.downloadCertificatePdf);
router.post('/certifications/:id/revoke', TrainingController.revokeCertification);
router.put('/certifications/:id', TrainingController.updateCertification);
router.delete('/certifications/:id', TrainingController.deleteCertification);

// Feedback
router.get('/feedback', TrainingController.getFeedback);
router.post('/feedback', TrainingController.createFeedback);
router.put('/feedback/:id', TrainingController.updateFeedback);
router.delete('/feedback/:id', TrainingController.deleteFeedback);

// Completion (derived)
router.get('/completion', TrainingController.getCompletion);

// Costs
router.get('/costs', TrainingController.getCosts);
router.post('/costs', TrainingController.createCost);
router.put('/costs/:id', TrainingController.updateCost);
router.delete('/costs/:id', TrainingController.deleteCost);

// Cost Reports
router.get('/cost-reports', TrainingController.getCostReports);

export default router;
