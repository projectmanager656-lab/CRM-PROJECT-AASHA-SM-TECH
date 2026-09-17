import { Router } from 'express';
import { OnboardingController } from '../controllers/OnboardingController.js';
import { authenticateToken, authorizeHrOrAdmin } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateToken);

// 1. Dynamic KPIs
router.get('/summary', OnboardingController.summary);

// 2. Eligible employees / candidates for starting onboarding
router.get('/eligible-employees', authorizeHrOrAdmin, OnboardingController.eligibleEmployees);

// 3. Main CRUD
router.route('/')
  .get(OnboardingController.list)
  .post(authorizeHrOrAdmin, OnboardingController.create);

router.route('/:id')
  .get(OnboardingController.get)
  .patch(authorizeHrOrAdmin, OnboardingController.update);

// 4. Checklist Item Update
router.patch('/:id/checklist', authorizeHrOrAdmin, OnboardingController.updateChecklist);

// 5. Complete Onboarding
router.post('/:id/complete', authorizeHrOrAdmin, OnboardingController.complete);

export default router;
