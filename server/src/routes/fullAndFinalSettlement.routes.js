import { Router } from 'express';
import { FullAndFinalSettlementController } from '../controllers/FullAndFinalSettlementController.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { createForbiddenError, createUnauthorizedError } from '../utils/apiError.js';

const router = Router();

const authorizeSettlementAccess = (req, _res, next) => {
  if (!req.user) return next(createUnauthorizedError('Authentication required'));
  const dept = String(req.user.department || req.user.jobDetails?.department || '').trim().toUpperCase();
  if (['admin', 'super_admin'].includes(req.user.role) || ['HR', 'FINANCE'].includes(dept)) {
    return next();
  }
  return next(createForbiddenError('Access denied. HR, Finance, or Administrator access required.'));
};

router.use(authenticateToken, authorizeSettlementAccess);

router.get('/summary', FullAndFinalSettlementController.summary);
router.get('/eligible-employees', FullAndFinalSettlementController.eligibleEmployees);
router.get('/', FullAndFinalSettlementController.list);
router.post('/', FullAndFinalSettlementController.create);
router.get('/:id/statement', FullAndFinalSettlementController.statement);
router.get('/:id', FullAndFinalSettlementController.get);
router.patch('/:id', FullAndFinalSettlementController.update);
router.patch('/:id/clearance', FullAndFinalSettlementController.updateClearance);
router.post('/:id/calculate', FullAndFinalSettlementController.calculate);
router.post('/:id/hr-review', FullAndFinalSettlementController.hrReview);
router.post('/:id/finance-review', FullAndFinalSettlementController.financeReview);
router.post('/:id/approve', FullAndFinalSettlementController.approve);
router.post('/:id/reject', FullAndFinalSettlementController.reject);
router.post('/:id/hold', FullAndFinalSettlementController.hold);
router.post('/:id/resume', FullAndFinalSettlementController.resume);
router.post('/:id/process-payment', FullAndFinalSettlementController.processPayment);
router.post('/:id/mark-paid', FullAndFinalSettlementController.markPaid);
router.post('/:id/complete', FullAndFinalSettlementController.complete);

export default router;
