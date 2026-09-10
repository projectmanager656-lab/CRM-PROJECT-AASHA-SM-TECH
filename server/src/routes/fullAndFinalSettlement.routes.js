import { Router } from 'express';
import { FullAndFinalSettlementController } from '../controllers/FullAndFinalSettlementController.js';
import { authenticateToken, authorizeHrOrAdmin } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateToken, authorizeHrOrAdmin);

router.get('/summary', FullAndFinalSettlementController.summary);
router.get('/eligible-employees', FullAndFinalSettlementController.eligibleEmployees);
router.get('/', FullAndFinalSettlementController.list);
router.post('/', FullAndFinalSettlementController.create);
router.get('/:id/statement', FullAndFinalSettlementController.statement);
router.get('/:id', FullAndFinalSettlementController.get);
router.patch('/:id', FullAndFinalSettlementController.update);
router.post('/:id/calculate', FullAndFinalSettlementController.calculate);
router.post('/:id/submit', FullAndFinalSettlementController.submit);
router.post('/:id/approve', FullAndFinalSettlementController.approve);
router.post('/:id/reject', FullAndFinalSettlementController.reject);
router.post('/:id/hold', FullAndFinalSettlementController.hold);
router.post('/:id/process-payment', FullAndFinalSettlementController.processPayment);
router.post('/:id/mark-paid', FullAndFinalSettlementController.markPaid);
router.post('/:id/complete', FullAndFinalSettlementController.complete);

export default router;
