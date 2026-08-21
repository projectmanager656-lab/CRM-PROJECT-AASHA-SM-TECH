import { Router } from 'express';
import { RbacController } from '../controllers/RbacController.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authenticateToken, authorizeRole('super_admin'));
router.get('/accounts', RbacController.listAccounts);
router.get('/modules', RbacController.listModules);
router.route('/roles').get(RbacController.listRoles).post(RbacController.createRole);
router.route('/roles/:id').get(RbacController.getRole).patch(RbacController.updateRole);
router.put('/roles/:id/permissions', RbacController.updatePermissions);
router.patch('/accounts/:accountType/:accountId/role', RbacController.assignRole);
export default router;
