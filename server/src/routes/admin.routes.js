import { Router } from 'express';
import { DashboardController, DepartmentController } from '../controllers/AdminController.js';
import { authenticateToken, authorizeRole, requirePermission } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authenticateToken, authorizeRole('admin', 'super_admin'));
router.get('/dashboard', requirePermission('core', 'dashboard', 'view'), DashboardController.summary);
router.route('/departments')
  .get(requirePermission('administration', 'departments', 'view'), DepartmentController.list)
  .post(requirePermission('administration', 'departments', 'create'), DepartmentController.create);
router.route('/departments/:id')
  .put(requirePermission('administration', 'departments', 'edit'), DepartmentController.update)
  .patch(requirePermission('administration', 'departments', 'edit'), DepartmentController.update)
  .delete(requirePermission('administration', 'departments', 'delete'), DepartmentController.remove);
export default router;
