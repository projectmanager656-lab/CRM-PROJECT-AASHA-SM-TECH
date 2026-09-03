import { Router } from 'express';
import { ResignationController } from '../controllers/ResignationController.js';
import { authenticateToken, authorizeHrOrAdmin } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateToken);

// 1. KPI Summary
router.get('/summary', ResignationController.summary);

// 2. Main List & Submit
router.route('/')
  .get(ResignationController.list)
  .post(ResignationController.create);

router.post('/terminate-employee', authorizeHrOrAdmin, ResignationController.terminateEmployee);

// 3. Single record & HR actions
router.route('/:id')
  .get(ResignationController.get);

router.patch('/:id/review', authorizeHrOrAdmin, ResignationController.review);
router.patch('/:id/approve', authorizeHrOrAdmin, ResignationController.approve);
router.patch('/:id/reject', authorizeHrOrAdmin, ResignationController.reject);
router.patch('/:id/notice-period', authorizeHrOrAdmin, ResignationController.updateNoticePeriod);
router.patch('/:id/clearance', authorizeHrOrAdmin, ResignationController.updateClearance);
router.post('/:id/exit-interview', authorizeHrOrAdmin, ResignationController.submitExitInterview);
router.post('/:id/complete-exit', authorizeHrOrAdmin, ResignationController.completeExit);

export default router;
