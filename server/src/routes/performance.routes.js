import { Router } from 'express';
import { PerformanceController } from '../controllers/PerformanceController.js';
import { authenticateToken, authorizeHrOrAdmin } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateToken);

router.get('/summary', PerformanceController.summary);
router.route('/')
  .get(PerformanceController.list)
  .post(authorizeHrOrAdmin, PerformanceController.create);

router.post('/goals', authorizeHrOrAdmin, PerformanceController.addGoal);
router.patch('/:reviewId/goals/:goalId', PerformanceController.updateGoal);

router.route('/:id')
  .get(PerformanceController.get)
  .put(authorizeHrOrAdmin, PerformanceController.update)
  .delete(authorizeHrOrAdmin, PerformanceController.delete);

export default router;
