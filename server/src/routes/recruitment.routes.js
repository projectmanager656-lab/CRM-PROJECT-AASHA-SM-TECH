import { Router } from 'express';
import { RecruitmentController } from '../controllers/RecruitmentController.js';
import { authenticateToken, authorizeHrOrAdmin } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateToken);

// 1. Recruitment KPI Summary
router.get('/summary', RecruitmentController.summary);

// 2. Job Requisition Routes
router.route('/jobs')
  .get(RecruitmentController.listJobs)
  .post(authorizeHrOrAdmin, RecruitmentController.createJob);

router.route('/jobs/:id')
  .get(RecruitmentController.getJob)
  .put(authorizeHrOrAdmin, RecruitmentController.updateJob)
  .delete(authorizeHrOrAdmin, RecruitmentController.deleteJob);

// 3. Candidate & Pipeline Routes
router.route('/candidates')
  .get(RecruitmentController.listCandidates)
  .post(authorizeHrOrAdmin, RecruitmentController.createCandidate);

router.route('/candidates/:id')
  .get(RecruitmentController.getCandidate)
  .put(authorizeHrOrAdmin, RecruitmentController.updateCandidate)
  .delete(authorizeHrOrAdmin, RecruitmentController.deleteCandidate);

router.patch('/candidates/:id/stage', authorizeHrOrAdmin, RecruitmentController.updateStage);
router.patch('/candidates/:id/shortlist', authorizeHrOrAdmin, RecruitmentController.shortlistCandidate);
router.patch('/candidates/:id/reject', authorizeHrOrAdmin, RecruitmentController.rejectCandidate);

// 4. Interviews & Offers & Conversion
router.post('/candidates/:id/interviews', authorizeHrOrAdmin, RecruitmentController.scheduleInterview);
router.patch('/candidates/:candidateId/interviews/:interviewId', authorizeHrOrAdmin, RecruitmentController.updateInterview);
router.post('/candidates/:id/offer', authorizeHrOrAdmin, RecruitmentController.createOffer);
router.post('/candidates/:id/convert-employee', authorizeHrOrAdmin, RecruitmentController.convertEmployee);

export default router;
