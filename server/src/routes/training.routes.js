import { Router } from 'express';
import TrainingController from '../controllers/TrainingController.js';
import { authenticateToken, authorizeHrOrAdmin } from '../middleware/auth.middleware.js';

const router = Router();

// All training routes require authentication + HR/Admin access
router.use(authenticateToken);
router.use(authorizeHrOrAdmin);

// Overview
router.get('/overview', TrainingController.getOverview);

// Programs
router.get('/programs', TrainingController.getPrograms);
router.post('/programs', TrainingController.createProgram);
router.put('/programs/:id', TrainingController.updateProgram);
router.delete('/programs/:id', TrainingController.deleteProgram);

// Courses
router.get('/courses', TrainingController.getCourses);
router.post('/courses', TrainingController.createCourse);
router.put('/courses/:id', TrainingController.updateCourse);
router.delete('/courses/:id', TrainingController.deleteCourse);

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
router.post('/assessments', TrainingController.createAssessment);
router.put('/assessments/:id', TrainingController.updateAssessment);
router.delete('/assessments/:id', TrainingController.deleteAssessment);

// Certifications
router.get('/certifications', TrainingController.getCertifications);
router.post('/certifications', TrainingController.createCertification);
router.post('/certifications/generate', TrainingController.generateCertification);
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
