import { Router } from 'express';
import { DashboardController, DepartmentController } from '../controllers/AdminController.js';
import { authenticateToken, authorizeRole, authorizeHrOrAdmin, requirePermission } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authenticateToken);
router.get('/dashboard', authorizeRole('admin', 'super_admin'), requirePermission('core', 'dashboard', 'view'), DashboardController.summary);
router.route('/departments')
  .get(authorizeHrOrAdmin, DepartmentController.list)
  .post(authorizeHrOrAdmin, DepartmentController.create);
router.route('/departments/:id')
  .put(authorizeHrOrAdmin, DepartmentController.update)
  .patch(authorizeHrOrAdmin, DepartmentController.update)
  .delete(authorizeHrOrAdmin, DepartmentController.remove);
export default router;
