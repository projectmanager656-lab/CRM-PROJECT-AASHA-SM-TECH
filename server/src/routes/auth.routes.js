import { Router } from 'express';
import AuthController from '../controllers/AuthController.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

// Public routes
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/admin/register', AuthController.adminRegister);
router.post('/admin/login', AuthController.adminLogin);
router.post('/super-admin/login', AuthController.superAdminLogin);

// Protected routes
router.get('/me', authenticateToken, AuthController.getMe);
router.get('/me/permissions', authenticateToken, AuthController.getMyPermissions);

export default router;
