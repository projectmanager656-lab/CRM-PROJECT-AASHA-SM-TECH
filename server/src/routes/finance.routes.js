import { Router } from 'express';
import { FinanceController } from '../controllers/FinanceController.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { createForbiddenError } from '../utils/apiError.js';

const router = Router();

// Middleware: ensure user is authenticated and is Finance or Admin
const requireFinanceOrAdmin = (req, res, next) => {
  const role = String(req.user?.role || '').trim().toLowerCase();
  const dept = String(req.user?.department || '').trim().toUpperCase();

  if (['admin', 'super_admin'].includes(role) || dept === 'FINANCE') {
    return next();
  }
  return next(createForbiddenError('Access denied: Finance department or Admin role required'));
};

router.use(authenticateToken);
router.use(requireFinanceOrAdmin);

// 1. Dashboard & Analytics
router.get('/dashboard', FinanceController.getDashboardSummary);

// 2. Client Financial Master
router.get('/clients', FinanceController.getClientFinancials);

// 3. Proposals / Quotations
router.get('/proposals', FinanceController.listProposals);
router.post('/proposals', FinanceController.createProposal);
router.post('/proposals/:id/convert-to-invoice', FinanceController.convertToInvoice);

// 4. Invoices & Payments
router.get('/invoices', FinanceController.listInvoices);
router.post('/invoices', FinanceController.createInvoice);
router.post('/invoices/:id/payment', FinanceController.recordInvoicePayment);

// 5. Payment Recovery
router.get('/recovery', FinanceController.listRecovery);
router.post('/recovery/:id/followup', FinanceController.addRecoveryFollowUp);

// 6. Expenses
router.get('/expenses', FinanceController.listExpenses);
router.post('/expenses', FinanceController.createExpense);
router.post('/expenses/:id/approve', FinanceController.approveExpense);
router.post('/expenses/:id/reject', FinanceController.rejectExpense);
router.post('/expenses/:id/pay', FinanceController.payExpense);

// 7. Bank Accounts
router.get('/bank-accounts', FinanceController.listBankAccounts);
router.post('/bank-accounts', FinanceController.createBankAccount);
router.get('/bank-accounts/:id/transactions', FinanceController.getAccountTransactions);

// 8. Vendors & Vendor Bills
router.get('/vendors', FinanceController.listVendors);
router.post('/vendors', FinanceController.createVendor);
router.get('/vendor-bills', FinanceController.listVendorBills);
router.post('/vendor-bills', FinanceController.createVendorBill);
router.post('/vendor-bills/:id/approve', FinanceController.approveVendorBill);
router.post('/vendor-bills/:id/pay', FinanceController.payVendorBill);

// 9. Payment Requests
router.get('/payment-requests', FinanceController.listPaymentRequests);
router.post('/payment-requests', FinanceController.createPaymentRequest);
router.post('/payment-requests/:id/approve', FinanceController.approvePaymentRequest);
router.post('/payment-requests/:id/reject', FinanceController.rejectPaymentRequest);
router.post('/payment-requests/:id/pay', FinanceController.payPaymentRequest);

// 10. Payroll & F&F Integration
router.get('/payroll', FinanceController.listPayroll);
router.post('/payroll/:id/pay', FinanceController.disburseSalary);
router.get('/fnf', FinanceController.listFnfSettlements);
router.post('/fnf/:id/pay', FinanceController.disburseFnfSettlement);

// 11. General Ledger
router.get('/ledger', FinanceController.getLedger);

// 12. Bank Reconciliation
router.get('/reconciliation', FinanceController.listReconciliations);
router.post('/reconciliation', FinanceController.createReconciliation);

// 13. Audit History
router.get('/audit', FinanceController.listAuditHistory);

// 14. Finance Settings
router.get('/settings', FinanceController.getSettings);
router.put('/settings', FinanceController.updateSettings);

export default router;
