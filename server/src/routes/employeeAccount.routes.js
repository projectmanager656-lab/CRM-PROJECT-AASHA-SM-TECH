import { Router } from 'express';
import { InvoiceController, PayrollController, ProfileController, SettingsController } from '../controllers/EmployeeAccountController.js';
import { authenticateToken, requirePermission } from '../middleware/auth.middleware.js';

export const payrollRouter = Router();
payrollRouter.use(authenticateToken);
payrollRouter.route('/').get(requirePermission('finance', 'payroll', 'view'), PayrollController.list).post(requirePermission('finance', 'payroll', 'create'), PayrollController.create);
payrollRouter.route('/:id').get(requirePermission('finance', 'payroll', 'view'), PayrollController.get).put(requirePermission('finance', 'payroll', 'edit'), PayrollController.update).patch(requirePermission('finance', 'payroll', 'edit'), PayrollController.update).delete(requirePermission('finance', 'payroll', 'delete'), PayrollController.remove);
payrollRouter.get('/:id/payslip', requirePermission('finance', 'payroll', 'view'), PayrollController.payslip);

// Invoices use the same established controller and endpoints; only the missing
// authorization layer is added here.
export const invoiceRouter = Router();
invoiceRouter.use(authenticateToken);
invoiceRouter.route('/').get(requirePermission('finance', 'invoices', 'view'), InvoiceController.list).post(requirePermission('finance', 'invoices', 'create'), InvoiceController.create);
invoiceRouter.route('/:id').get(requirePermission('finance', 'invoices', 'view'), InvoiceController.get).put(requirePermission('finance', 'invoices', 'edit'), InvoiceController.update).patch(requirePermission('finance', 'invoices', 'edit'), InvoiceController.update).delete(requirePermission('finance', 'invoices', 'delete'), InvoiceController.remove);

export const settingsRouter = Router();
settingsRouter.use(authenticateToken);
settingsRouter.route('/').get(SettingsController.get).put(SettingsController.update).patch(SettingsController.update);
export const profileRouter = Router();
profileRouter.use(authenticateToken);
profileRouter.patch('/', ProfileController.update);
