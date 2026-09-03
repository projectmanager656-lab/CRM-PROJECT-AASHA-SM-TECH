import { Router } from 'express';
import AuthController from '../controllers/AuthController.js';
import ForgotPasswordController from '../controllers/ForgotPasswordController.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

// Public routes
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/admin/register', AuthController.adminRegister);
router.post('/admin/login', AuthController.adminLogin);
router.post('/super-admin/login', AuthController.superAdminLogin);

// Password-reset OTP flow (public — no auth required)
router.post('/forgot-password/request-otp', ForgotPasswordController.requestOtp);
router.post('/forgot-password/verify-otp',  ForgotPasswordController.verifyOtp);
router.post('/forgot-password/reset-password', ForgotPasswordController.resetPassword);

// Protected routes
router.get('/me', authenticateToken, AuthController.getMe);
router.get('/me/permissions', authenticateToken, AuthController.getMyPermissions);

export default router;
