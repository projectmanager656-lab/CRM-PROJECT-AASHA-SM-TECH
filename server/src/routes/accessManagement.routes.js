import { Router } from 'express';
import { AccessManagementController } from '../controllers/AccessManagementController.js';
import { authenticateToken, authorizeHrOrAdmin } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateToken, authorizeHrOrAdmin);

// Dynamic system metadata (departments, designations, roles, modules)
router.get('/metadata', AccessManagementController.getMetadata);

// Summary metrics
router.get('/summary', AccessManagementController.getSummary);

// Employees access list
router.get('/employees', AccessManagementController.listEmployees);

// Single employee access details
router.get('/employees/:id', AccessManagementController.getEmployeeAccess);

// Access actions
router.post('/employees/:id/grant', AccessManagementController.grantAccess);
router.post('/employees/:id/restrict', AccessManagementController.restrictAccess);
router.post('/employees/:id/revoke', AccessManagementController.revokeAccess);
router.post('/employees/:id/revoke-all', AccessManagementController.revokeAllAccess);
router.post('/employees/:id/restore', AccessManagementController.restoreAccess);

// Audit trail
router.get('/audit', AccessManagementController.getAuditTrail);

export default router;
