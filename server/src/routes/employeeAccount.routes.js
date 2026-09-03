import { Router } from 'express';
import PayrollController from '../controllers/PayrollController.js';
import { InvoiceController, ProfileController, SettingsController } from '../controllers/EmployeeAccountController.js';
import { authenticateToken, requirePermission } from '../middleware/auth.middleware.js';

export const payrollRouter = Router();
payrollRouter.use(authenticateToken);

// Summary & Aggregates
payrollRouter.get('/summary', requirePermission('finance', 'payroll', 'view'), PayrollController.summary);

// Batch Generation
payrollRouter.post('/generate', requirePermission('finance', 'payroll', 'create'), PayrollController.generate);

// Employee Salary Structure Config
payrollRouter.put('/employee-salary/:userId', requirePermission('finance', 'payroll', 'edit'), PayrollController.updateEmployeeSalary);

// Status Actions
payrollRouter.patch('/:id/process', requirePermission('finance', 'payroll', 'edit'), PayrollController.process);
payrollRouter.patch('/:id/pay', requirePermission('finance', 'payroll', 'edit'), PayrollController.pay);

// Payslip
payrollRouter.get('/:id/payslip', requirePermission('finance', 'payroll', 'view'), PayrollController.payslip);

// Standard Collection Routes
payrollRouter
  .route('/')
  .get(requirePermission('finance', 'payroll', 'view'), PayrollController.list)
  .post(requirePermission('finance', 'payroll', 'create'), PayrollController.create);

payrollRouter
  .route('/:id')
  .get(requirePermission('finance', 'payroll', 'view'), PayrollController.get)
  .put(requirePermission('finance', 'payroll', 'edit'), PayrollController.update)
  .patch(requirePermission('finance', 'payroll', 'edit'), PayrollController.update)
  .delete(requirePermission('finance', 'payroll', 'delete'), PayrollController.remove);

// Invoices
export const invoiceRouter = Router();
invoiceRouter.use(authenticateToken);
invoiceRouter
  .route('/')
  .get(requirePermission('finance', 'invoices', 'view'), InvoiceController.list)
  .post(requirePermission('finance', 'invoices', 'create'), InvoiceController.create);
invoiceRouter
  .route('/:id')
  .get(requirePermission('finance', 'invoices', 'view'), InvoiceController.get)
  .put(requirePermission('finance', 'invoices', 'edit'), InvoiceController.update)
  .patch(requirePermission('finance', 'invoices', 'edit'), InvoiceController.update)
  .delete(requirePermission('finance', 'invoices', 'delete'), InvoiceController.remove);

// Settings
export const settingsRouter = Router();
settingsRouter.use(authenticateToken);
settingsRouter.route('/').get(SettingsController.get).put(SettingsController.update).patch(SettingsController.update);

// Profile
export const profileRouter = Router();
profileRouter.use(authenticateToken);
profileRouter.patch('/', ProfileController.update);
