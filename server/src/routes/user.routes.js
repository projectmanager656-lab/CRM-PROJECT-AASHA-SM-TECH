import { Router } from 'express';
import UserController from '../controllers/UserController.js';
import { authenticateToken, authorizeRole, requirePermission } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateToken);
router.use(authorizeRole('admin', 'super_admin'));

router.get('/', requirePermission('administration', 'employees', 'view'), UserController.getUsers);
router.get('/:id', requirePermission('administration', 'employees', 'view'), UserController.getUserById);
router.post('/', requirePermission('administration', 'employees', 'create'), UserController.createUser);
router.put('/:id', requirePermission('administration', 'employees', 'edit'), UserController.updateUser);
router.patch('/:id', requirePermission('administration', 'employees', 'edit'), UserController.updateUser);
router.delete('/:id', requirePermission('administration', 'employees', 'delete'), UserController.deactivateUser);

export default router;
