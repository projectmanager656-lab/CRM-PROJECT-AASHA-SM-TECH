// Main API routes
import { Router } from 'express';
import { successResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import taskRoutes from './task.routes.js';
import { ownedResourceRouters } from './ownedResource.routes.js';
import { attendanceRouter, leaveRouter } from './employeeRecords.routes.js';
import documentRoutes from './document.routes.js';
import notificationRoutes from './notification.routes.js';
import { invoiceRouter, payrollRouter, profileRouter, settingsRouter } from './employeeAccount.routes.js';
import messageRoutes from './message.routes.js';
import adminRoutes from './admin.routes.js';
import { DepartmentController } from '../controllers/AdminController.js';
import calendarRoutes from './calendar.routes.js';
import announcementRoutes from './announcement.routes.js';
import rbacRoutes from './rbac.routes.js';
import { summary as superAdminSummary } from '../controllers/SuperAdminController.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware.js';
import { CompanySettingController } from '../controllers/CompanySettingController.js';

import performanceRoutes from './performance.routes.js';
import recruitmentRoutes from './recruitment.routes.js';
import resignationRoutes from './resignation.routes.js';
import assetRoutes from './asset.routes.js';
import hrReportRoutes from './hrReport.routes.js';
import trainingRoutes from './training.routes.js';
import fullAndFinalSettlementRoutes from './fullAndFinalSettlement.routes.js';
import accessManagementRoutes from './accessManagement.routes.js';
import expenseRoutes from './expense.routes.js';

const router = Router();

// Health check endpoint
router.get('/health', asyncHandler((req, res) => {
  const healthStatus = {
    status: 'operational',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  };

  res.json(successResponse(healthStatus, 'API is running'));
}));

// Authentication routes
router.use('/auth', authRoutes);
router.get('/departments', DepartmentController.publicList);
router.use('/users', userRoutes);
router.use('/performance', performanceRoutes);
router.use('/recruitment', recruitmentRoutes);
router.use('/resignation', resignationRoutes);
router.use('/assets', assetRoutes);
router.use('/reports/hr', hrReportRoutes);
router.use('/training', trainingRoutes);
router.use('/full-and-final-settlements', fullAndFinalSettlementRoutes);
router.use('/access-management', accessManagementRoutes);
router.use('/tasks', taskRoutes);
router.use('/projects', ownedResourceRouters.projects);
router.use('/leads', ownedResourceRouters.leads);
router.use('/clients', ownedResourceRouters.clients);
router.use('/attendance', attendanceRouter);
router.use('/leave-requests', leaveRouter);
router.use('/documents', documentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/messages', messageRoutes);
router.use('/payroll', payrollRouter);
router.use('/expenses', expenseRoutes);
router.use('/invoices', invoiceRouter);
router.use('/settings', settingsRouter);
router.route('/company-settings').get(authenticateToken, CompanySettingController.get).put(authenticateToken, CompanySettingController.update).patch(authenticateToken, CompanySettingController.update);
router.use('/profile', profileRouter);
router.use('/admin', adminRoutes);
router.use('/calendar', calendarRoutes);
router.use('/announcements', announcementRoutes);
router.use('/rbac', rbacRoutes);
router.get('/super-admin/summary', authenticateToken, authorizeRole('super_admin'), superAdminSummary);

export default router;
