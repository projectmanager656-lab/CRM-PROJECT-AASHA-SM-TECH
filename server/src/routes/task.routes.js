import { Router } from 'express';
import TaskController from '../controllers/TaskController.js';
import { authenticateToken, authorizeRole, requirePermission } from '../middleware/auth.middleware.js';

const router = Router();

// All task routes require authentication
router.use(authenticateToken);

// Create task - any authenticated user
router.post('/', requirePermission('projects', 'tasks', 'create'), TaskController.createTask);

// Get tasks - any authenticated user
router.get('/', requirePermission('projects', 'tasks', 'view'), TaskController.getTasks);

// Get single task
router.get('/:id', requirePermission('projects', 'tasks', 'view'), TaskController.getTaskById);

// Update task - creator, assignee, admin, super_admin allowed (service enforces)
router.put('/:id', requirePermission('projects', 'tasks', 'edit'), TaskController.updateTask);
router.patch('/:id', requirePermission('projects', 'tasks', 'edit'), TaskController.updateTask);

// Delete task - creator or admin/super_admin (service enforces)
router.delete('/:id', requirePermission('projects', 'tasks', 'delete'), TaskController.deleteTask);

// Assign task - only admin or super_admin
router.patch('/:id/assign', requirePermission('projects', 'tasks', 'assign'), authorizeRole('admin', 'super_admin'), TaskController.assignTask);

// Update status - allowed by creator, assignee, admin, super_admin (service enforces)
router.patch('/:id/status', requirePermission('projects', 'tasks', 'edit'), TaskController.updateStatus);

export default router;
