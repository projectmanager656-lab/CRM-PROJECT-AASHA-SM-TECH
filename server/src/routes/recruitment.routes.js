import { Router } from 'express';
import { RecruitmentController } from '../controllers/RecruitmentController.js';
import { OfferLetterController } from '../controllers/OfferLetterController.js';
import { ExperienceLetterController } from '../controllers/ExperienceLetterController.js';
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
router.patch('/candidates/:id/withdraw', authorizeHrOrAdmin, RecruitmentController.recordWithdrawal);
router.post('/candidates/:id/screening', authorizeHrOrAdmin, RecruitmentController.recordScreening);
router.post('/candidates/:id/assessment', authorizeHrOrAdmin, RecruitmentController.recordAssessment);
router.get('/candidates/:id/timeline', RecruitmentController.getTimeline);

// 4. Interviews & Offers & Conversion
router.get('/interviews/summary', RecruitmentController.interviewSummary);
router.get('/interviews', RecruitmentController.listInterviews);
router.post('/candidates/:id/interviews', authorizeHrOrAdmin, RecruitmentController.scheduleInterview);
router.patch('/candidates/:candidateId/interviews/:interviewId', authorizeHrOrAdmin, RecruitmentController.updateInterview);
router.post('/candidates/:id/offer', authorizeHrOrAdmin, RecruitmentController.createOffer);
router.post('/candidates/:id/convert-employee', authorizeHrOrAdmin, RecruitmentController.convertEmployee);

// 5. Offer Letter Routes (standalone OfferLetter collection)
router.get('/offer-letters/summary', OfferLetterController.offerSummary);
router.route('/offer-letters')
  .get(OfferLetterController.listOffers)
  .post(authorizeHrOrAdmin, OfferLetterController.createOffer);

router.route('/offer-letters/:id')
  .get(OfferLetterController.getOffer)
  .put(authorizeHrOrAdmin, OfferLetterController.updateOffer)
  .delete(authorizeHrOrAdmin, OfferLetterController.deleteOffer);

router.post('/offer-letters/:id/send', authorizeHrOrAdmin, OfferLetterController.sendOffer);
router.post('/offer-letters/:id/resend', authorizeHrOrAdmin, OfferLetterController.resendOffer);
router.post('/offer-letters/:id/accept', authorizeHrOrAdmin, OfferLetterController.markAccepted);
router.post('/offer-letters/:id/reject', authorizeHrOrAdmin, OfferLetterController.markRejected);
router.post('/offer-letters/:id/withdraw', authorizeHrOrAdmin, OfferLetterController.withdrawOffer);
router.post('/offer-letters/:id/convert-employee', authorizeHrOrAdmin, OfferLetterController.convertToEmployee);

// 6. Experience Letter Routes (standalone ExperienceLetter collection)
router.get('/experience-letters/summary', ExperienceLetterController.summary);
router.get('/experience-letters/employees', ExperienceLetterController.getEmployees);
router.route('/experience-letters')
  .get(ExperienceLetterController.listLetters)
  .post(authorizeHrOrAdmin, ExperienceLetterController.createLetter);

router.route('/experience-letters/:id')
  .get(ExperienceLetterController.getLetter)
  .put(authorizeHrOrAdmin, ExperienceLetterController.updateLetter)
  .delete(authorizeHrOrAdmin, ExperienceLetterController.deleteLetter);

export default router;

