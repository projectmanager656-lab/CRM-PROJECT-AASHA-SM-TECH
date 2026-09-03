import { Router } from 'express';
import { HRReportController } from '../controllers/HRReportController.js';
import { authenticateToken, authorizeHrOrAdmin } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateToken);
router.use(authorizeHrOrAdmin);

// 1. Executive Overview Analytics
router.get('/overview', HRReportController.overview);

// 2. Department Analytics Deep-Dive
router.get('/department-analytics', HRReportController.departmentAnalytics);

// 3. Employee 360° Dossier
router.get('/employee-360/:userId', HRReportController.employee360);

export default router;
