import { Router } from 'express';
import UserController from '../controllers/UserController.js';
import { authenticateToken, authorizeHrOrAdmin } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateToken);
router.use(authorizeHrOrAdmin);

router.get('/', UserController.getUsers);
router.get('/:id', UserController.getUserById);
router.post('/', UserController.createUser);
router.put('/:id', UserController.updateUser);
router.patch('/:id', UserController.updateUser);
router.post('/:id/transfer', UserController.transferEmployee);
router.patch('/:id/status', UserController.updateStatus);
router.get('/:id/history', UserController.getEmployeeHistory);
router.delete('/:id', UserController.deactivateUser);

export default router;
