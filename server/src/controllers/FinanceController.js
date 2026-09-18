import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import Expense from '../models/Expense.js';
import Payroll from '../models/Payroll.js';
import FullAndFinalSettlement from '../models/FullAndFinalSettlement.js';
import Client from '../models/Client.js';
import Project from '../models/Project.js';
import User from '../models/User.js';
import BankAccount from '../models/BankAccount.js';
import Vendor from '../models/Vendor.js';
import VendorBill from '../models/VendorBill.js';
import PaymentRequest from '../models/PaymentRequest.js';
import Proposal from '../models/Proposal.js';
import BankReconciliation from '../models/BankReconciliation.js';
import FinanceAudit from '../models/FinanceAudit.js';
import FinanceSetting from '../models/FinanceSetting.js';
import { createNotFoundError, createValidationError, createForbiddenError } from '../utils/apiError.js';
import { createdResponse, successResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Helper: audit logger
const logAudit = async ({ action, entityType, entityId, reference, performedBy, performedByName, previousValue, newValue, amount, reason }) => {
  try {
    await FinanceAudit.create({
      action,
      entityType,
      entityId,
      reference,
      performedBy,
      performedByName,
      previousValue,
      newValue,
      amount,
      reason,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error('Failed to write finance audit:', err.message);
  }
};

// Helper: resolve user display name
const getUserName = (user) => {
  if (!user) return 'System';
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || 'User';
};

// Helper: get or create default finance settings
const getOrCreateFinanceSettings = async () => {
  let settings = await FinanceSetting.findOne({ key: 'finance_config' });
  if (!settings) {
    settings = await FinanceSetting.create({
      key: 'finance_config',
      approvalThreshold: 50000,
      fiscalYearStartMonth: 4,
      defaultPaymentTerms: 30,
      defaultTaxRate: 18,
      currency: 'INR',
      autoRecoveryReminders: true,
      overdueGraceDays: 3,
    });
  }
  return settings;
};

// Helper: recalculate bank account current balance accurately
const recalculateBankBalance = async (accountId) => {
  if (!accountId || !mongoose.Types.ObjectId.isValid(accountId)) return 0;
  const account = await BankAccount.findById(accountId);
  if (!account) return 0;

  const payments = await Payment.find({
    bankAccount: accountId,
    status: 'Completed',
  });

  let credits = 0;
  let debits = 0;
  payments.forEach((p) => {
    const amt = Number(p.amount) || 0;
    if (p.entryType === 'Credit' || p.transactionType === 'Income') {
      credits += amt;
    } else if (p.entryType === 'Debit' || p.transactionType === 'Expense') {
      debits += amt;
    }
  });

  account.currentBalance = Math.round((account.openingBalance + credits - debits) * 100) / 100;
  await account.save();
  return account.currentBalance;
};

// Helper: ensure at least one primary company bank account exists
const ensureDefaultBankAccount = async () => {
  const count = await BankAccount.countDocuments();
  if (count === 0) {
    await BankAccount.create({
      accountName: 'HDFC Corporate Operating A/C',
      bankName: 'HDFC Bank Ltd',
      accountNumber: '50200084729104',
      ifscCode: 'HDFC0001234',
      branch: 'Main City Corporate Branch',
      accountType: 'Current',
      openingBalance: 1500000,
      currentBalance: 1500000,
      currency: 'INR',
      isActive: true,
      notes: 'Primary Company Operating Current Account for Inflow/Outflow',
    });
  }
};

export const FinanceController = {
  // ==========================================
  // 1. DASHBOARD & CONTROL CENTER
  // ==========================================
  getDashboardSummary: asyncHandler(async (req, res) => {
    await ensureDefaultBankAccount();
    await getOrCreateFinanceSettings();

    const { period = 'month', startDate, endDate } = req.query;
    const now = new Date();
    let dateFilter = {};

    if (startDate && endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { $gte: new Date(startDate), $lte: end };
    } else if (period === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      dateFilter = { $gte: start, $lte: end };
    } else if (period === 'week') {
      const day = now.getDay() || 7;
      const start = new Date(now);
      start.setDate(now.getDate() - day + 1);
      start.setHours(0, 0, 0, 0);
      dateFilter = { $gte: start, $lte: now };
    } else if (period === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { $gte: start, $lte: now };
    } else if (period === 'quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), qMonth, 1);
      dateFilter = { $gte: start, $lte: now };
    } else if (period === 'year') {
      // Fiscal year April 1
      const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const start = new Date(fyStartYear, 3, 1);
      dateFilter = { $gte: start, $lte: now };
    }

    const txDateQuery = Object.keys(dateFilter).length ? { paymentDate: dateFilter } : {};

    // 1. Transactions in period (Income & Expense)
    const periodTransactions = await Payment.find({
      status: 'Completed',
      ...txDateQuery,
    });

    let totalIncome = 0;
    let totalExpense = 0;
    let paymentsReceivedCount = 0;
    let paymentsReceivedAmount = 0;

    periodTransactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.transactionType === 'Income' || tx.entryType === 'Credit') {
        totalIncome += amt;
        paymentsReceivedCount += 1;
        paymentsReceivedAmount += amt;
      } else if (tx.transactionType === 'Expense' || tx.entryType === 'Debit') {
        totalExpense += amt;
      }
    });

    const netCashFlow = Math.round((totalIncome - totalExpense) * 100) / 100;

    // 2. Receivables (Unpaid Invoices)
    const invoices = await Invoice.find({ status: { $ne: 'Cancelled' } });
    let receivables = 0;
    let pendingInvoicesCount = 0;
    let pendingInvoicesAmount = 0;
    let overdueInvoicesCount = 0;
    let overdueInvoicesAmount = 0;

    const agingReceivables = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };

    invoices.forEach((inv) => {
      const total = (Number(inv.amount) || 0) + (Number(inv.cgst) || 0) + (Number(inv.sgst) || 0);
      const paid = Number(inv.paidAmount) || 0;
      const bal = inv.balance !== undefined && inv.balance !== null ? Number(inv.balance) : Math.max(0, total - paid);

      if (bal > 0) {
        receivables += bal;
        pendingInvoicesCount += 1;
        pendingInvoicesAmount += bal;

        const due = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.issueDate || inv.createdAt);
        const diffDays = Math.floor((now - due) / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
          overdueInvoicesCount += 1;
          overdueInvoicesAmount += bal;
        }

        if (diffDays <= 30) agingReceivables['0-30'] += bal;
        else if (diffDays <= 60) agingReceivables['31-60'] += bal;
        else if (diffDays <= 90) agingReceivables['61-90'] += bal;
        else agingReceivables['90+'] += bal;
      }
    });

    receivables = Math.round(receivables * 100) / 100;

    // 3. Payables (Approved Unpaid Vendor Bills + Approved Unpaid Expenses)
    const vendorBills = await VendorBill.find({
      status: { $in: ['Pending', 'Approved', 'Partially Paid'] },
    });

    let payables = 0;
    let vendorOutstanding = 0;
    const agingPayables = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };

    vendorBills.forEach((b) => {
      const bal = Number(b.balance) || 0;
      if (bal > 0) {
        payables += bal;
        vendorOutstanding += bal;
        const due = b.dueDate ? new Date(b.dueDate) : new Date(b.billDate || b.createdAt);
        const diffDays = Math.floor((now - due) / (1000 * 60 * 60 * 24));

        if (diffDays <= 30) agingPayables['0-30'] += bal;
        else if (diffDays <= 60) agingPayables['31-60'] += bal;
        else if (diffDays <= 90) agingPayables['61-90'] += bal;
        else agingPayables['90+'] += bal;
      }
    });

    // Approved unpaid expenses
    const approvedExpenses = await Expense.find({ paymentStatus: 'Approved' });
    approvedExpenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      payables += amt;
    });

    payables = Math.round(payables * 100) / 100;

    // 4. Bank Balances (Calculate from all accounts)
    const bankAccounts = await BankAccount.find({ isActive: true });
    let totalBankBalance = 0;
    const bankSummaries = [];

    for (const acc of bankAccounts) {
      const bal = await recalculateBankBalance(acc._id);
      totalBankBalance += bal;
      bankSummaries.push({
        _id: acc._id,
        accountName: acc.accountName,
        bankName: acc.bankName,
        accountNumber: acc.maskedAccountNumber || acc.accountNumber,
        accountType: acc.accountType,
        currentBalance: bal,
        reconciliationStatus: acc.reconciliationStatus,
      });
    }

    totalBankBalance = Math.round(totalBankBalance * 100) / 100;

    // 5. Payroll Pending from real Payroll collection
    const pendingPayrolls = await Payroll.find({ status: 'Pending' });
    const payrollPendingCount = pendingPayrolls.length;
    const payrollPendingAmount = pendingPayrolls.reduce((sum, p) => sum + (Number(p.net) || 0), 0);

    // 6. Payment Requests Pending
    const pendingPaymentRequests = await PaymentRequest.find({ status: 'Submitted' });
    const paymentRequestsPendingCount = pendingPaymentRequests.length;
    const paymentRequestsPendingAmount = pendingPaymentRequests.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    // 7. Reconciliation Pending
    const pendingReconciliations = await BankReconciliation.countDocuments({ status: { $in: ['Pending', 'Discrepancy'] } });

    // 8. Monthly Trends (Last 6 months)
    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const mLabel = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });

      const mTx = await Payment.find({
        status: 'Completed',
        paymentDate: { $gte: mStart, $lte: mEnd },
      });

      let mIncome = 0;
      let mExpense = 0;
      mTx.forEach((t) => {
        const amt = Number(t.amount) || 0;
        if (t.transactionType === 'Income' || t.entryType === 'Credit') mIncome += amt;
        else if (t.transactionType === 'Expense' || t.entryType === 'Debit') mExpense += amt;
      });

      monthlyTrends.push({
        month: mLabel,
        income: Math.round(mIncome),
        expense: Math.round(mExpense),
        net: Math.round(mIncome - mExpense),
      });
    }

    // 9. Real Financial Alerts
    const alerts = [];
    if (overdueInvoicesCount > 0) {
      alerts.push({
        id: 'alt-overdue',
        type: 'danger',
        title: `${overdueInvoicesCount} Overdue Invoices`,
        message: `Outstanding overdue payments total ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(overdueInvoicesAmount)}. Immediate recovery action required.`,
        actionTab: 'recovery',
      });
    }

    if (paymentRequestsPendingCount > 0) {
      alerts.push({
        id: 'alt-requests',
        type: 'warning',
        title: `${paymentRequestsPendingCount} Payment Requests Awaiting Approval`,
        message: `Totaling ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paymentRequestsPendingAmount)}. Review and approve to proceed with disbursal.`,
        actionTab: 'requests',
      });
    }

    if (payrollPendingCount > 0) {
      alerts.push({
        id: 'alt-payroll',
        type: 'info',
        title: `${payrollPendingCount} Employee Payroll Slips Pending Disbursal`,
        message: `Disbursal total: ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(payrollPendingAmount)}.`,
        actionTab: 'payroll',
      });
    }

    if (totalBankBalance < 200000) {
      alerts.push({
        id: 'alt-low-balance',
        type: 'warning',
        title: 'Low Operating Bank Balance',
        message: `Total liquid bank balance is ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalBankBalance)}. Monitor cash flow closely.`,
        actionTab: 'banking',
      });
    }

    // 10. Cash Flow Breakdown (Actual vs Forecast)
    const expectedInflows = receivables;
    const expectedOutflows = payables + payrollPendingAmount + paymentRequestsPendingAmount;
    const projectedClosingCash = Math.round((totalBankBalance + expectedInflows - expectedOutflows) * 100) / 100;

    // 11. Vendor Summary
    const totalVendors = await Vendor.countDocuments();
    const activeVendors = await Vendor.countDocuments({ status: 'Active' });
    const pendingBillsCount = await VendorBill.countDocuments({ status: { $in: ['Pending', 'Approved', 'Partially Paid'] } });

    if (pendingBillsCount > 0) {
      alerts.push({
        id: 'alt-vendor-bills',
        type: 'warning',
        title: `${pendingBillsCount} Vendor Bills Pending Approval/Disbursal`,
        message: `Total vendor outstanding is ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(vendorOutstanding)}. Review and disburse.`,
        actionTab: 'vendors',
      });
    }

    if (pendingReconciliations > 0) {
      alerts.push({
        id: 'alt-recon-pending',
        type: 'info',
        title: `${pendingReconciliations} Bank Statements Awaiting Reconciliation`,
        message: 'Reconcile bank accounts with general ledger to ensure balance accuracy.',
        actionTab: 'reconciliation',
      });
    }

    // 12. Expense Category Breakdown
    const expenseBreakdown = {
      'Client Expenses': 0,
      'Office Expenses': 0,
      'Project Expenses': 0,
    };
    const recentExpenses = await Expense.find({ paymentStatus: 'Paid' }).sort({ expenseDate: -1 }).limit(100);
    recentExpenses.forEach((e) => {
      const type = e.categoryType || 'Office Expenses';
      expenseBreakdown[type] = (expenseBreakdown[type] || 0) + (Number(e.amount) || 0);
    });

    // 13. Top Pending Invoices for Dashboard Table
    const topPendingInvoices = await Invoice.find({
      status: { $in: ['Pending', 'Sent', 'Partially Paid'] },
    })
      .populate('client', 'name companyName')
      .sort({ dueDate: 1 })
      .limit(5)
      .lean();

    const pendingInvoicesFormatted = topPendingInvoices.map((inv) => ({
      _id: inv._id,
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.client?.name || inv.clientName || 'Client',
      amount: inv.balance !== undefined && inv.balance !== null ? Number(inv.balance) : Number(inv.amount) || 0,
      totalAmount: Number(inv.amount) || 0,
      dueDate: inv.dueDate || inv.issueDate,
      status: inv.status,
    }));

    // 14. Top Payment Recovery Records
    const topRecoveryInvoices = await Invoice.find({
      status: { $ne: 'Cancelled' },
      balance: { $gt: 0 },
    })
      .populate('client', 'name companyName')
      .sort({ dueDate: 1 })
      .limit(5)
      .lean();

    const recoveryFormatted = topRecoveryInvoices.map((inv) => ({
      _id: inv._id,
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.client?.name || inv.clientName || 'Client',
      amountDue: inv.balance !== undefined && inv.balance !== null ? Number(inv.balance) : Number(inv.amount) || 0,
      lastFollowUp: inv.recovery?.lastFollowUpDate || inv.recovery?.lastFollowUp || inv.updatedAt || inv.issueDate,
      status: inv.recovery?.status || (new Date(inv.dueDate) < now ? 'Overdue' : 'Pending'),
      notes: inv.recovery?.notes || '',
    }));

    // 15. Top Pending Payment Requests
    const topPaymentRequests = await PaymentRequest.find({ status: 'Submitted' })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // 16. Reconciliation details
    const unreconciledCount = await Payment.countDocuments({ isReconciled: { $ne: true }, status: 'Completed' });

    res.json(
      successResponse(
        {
          kpis: {
            totalIncome: Math.round(totalIncome * 100) / 100,
            totalExpense: Math.round(totalExpense * 100) / 100,
            netCashFlow,
            receivables,
            payables,
            bankBalance: totalBankBalance,
            pendingInvoicesCount,
            pendingInvoicesAmount: Math.round(pendingInvoicesAmount),
            overdueInvoicesCount,
            overdueInvoicesAmount: Math.round(overdueInvoicesAmount),
            paymentsReceivedCount,
            paymentsReceivedAmount: Math.round(paymentsReceivedAmount),
            paymentsPendingCount: pendingInvoicesCount,
            vendorOutstanding: Math.round(vendorOutstanding),
            payrollPendingCount,
            payrollPendingAmount: Math.round(payrollPendingAmount),
            paymentRequestsPendingCount,
            paymentRequestsPendingAmount: Math.round(paymentRequestsPendingAmount),
            reconciliationPendingCount: pendingReconciliations,
          },
          monthlyTrends,
          aging: {
            receivables: agingReceivables,
            payables: agingPayables,
          },
          cashFlow: {
            actual: {
              inflows: Math.round(totalIncome),
              outflows: Math.round(totalExpense),
              net: netCashFlow,
            },
            forecast: {
              openingCash: totalBankBalance,
              expectedInflows,
              expectedOutflows,
              projectedClosingCash,
            },
          },
          bankAccounts: bankSummaries,
          pendingInvoices: pendingInvoicesFormatted,
          paymentRecovery: recoveryFormatted,
          recentPaymentRequests: topPaymentRequests,
          reconciliationSummary: {
            pendingCount: pendingReconciliations,
            unreconciledTxCount: unreconciledCount,
            status: pendingReconciliations > 0 ? 'Action Required' : 'Up to Date',
          },
          alerts,
          vendorSummary: {
            totalVendors,
            activeVendors,
            pendingBillsCount,
            vendorOutstanding: Math.round(vendorOutstanding),
          },
          expenseSummary: expenseBreakdown,
          payrollSummary: {
            pendingCount: payrollPendingCount,
            pendingAmount: Math.round(payrollPendingAmount),
          },
        },
        'Finance dashboard summary calculated from MongoDB Atlas'
      )
    );
  }),

  // ==========================================
  // 2. CLIENT FINANCIAL MASTER
  // ==========================================
  getClientFinancials: asyncHandler(async (req, res) => {
    const clients = await Client.find().sort({ name: 1 });
    const invoices = await Invoice.find({ status: { $ne: 'Cancelled' } });
    const payments = await Payment.find({ status: 'Completed', transactionType: 'Income' });
    const projects = await Project.find();

    const clientData = clients.map((c) => {
      const cId = String(c._id);
      const cName = String(c.name || '').trim().toLowerCase();

      const clientInvoices = invoices.filter(
        (i) => String(i.client) === cId || String(i.clientName || '').trim().toLowerCase() === cName
      );

      const clientPayments = payments.filter(
        (p) => String(p.client) === cId || String(p.clientName || '').trim().toLowerCase() === cName
      );

      const clientProjects = projects.filter((p) => String(p.clientId) === cId);

      let totalBilled = 0;
      let totalReceived = 0;
      let outstanding = 0;
      let overdue = 0;
      const now = new Date();

      clientInvoices.forEach((inv) => {
        const total = (Number(inv.amount) || 0) + (Number(inv.cgst) || 0) + (Number(inv.sgst) || 0);
        const paid = Number(inv.paidAmount) || 0;
        const bal = inv.balance !== undefined ? Number(inv.balance) : Math.max(0, total - paid);
        totalBilled += total;
        totalReceived += paid;
        outstanding += bal;

        const due = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.issueDate || inv.createdAt);
        if (bal > 0 && due < now) {
          overdue += bal;
        }
      });

      // Last payment
      let lastPayment = null;
      if (clientPayments.length > 0) {
        const sorted = [...clientPayments].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
        lastPayment = {
          amount: sorted[0].amount,
          date: sorted[0].paymentDate,
          method: sorted[0].paymentMethod,
          reference: sorted[0].transactionReference,
        };
      }

      let financialStatus = 'Clear';
      if (overdue > 0) financialStatus = 'Overdue';
      else if (outstanding > 0) financialStatus = 'Pending';

      return {
        _id: c._id,
        name: c.name,
        company: c.company || '',
        email: c.email || '',
        phone: c.phone || '',
        activeProjectsCount: clientProjects.length,
        invoicesCount: clientInvoices.length,
        totalBilled: Math.round(totalBilled * 100) / 100,
        totalReceived: Math.round(totalReceived * 100) / 100,
        outstanding: Math.round(outstanding * 100) / 100,
        overdue: Math.round(overdue * 100) / 100,
        lastPayment,
        financialStatus,
      };
    });

    res.json(successResponse(clientData, 'Client financial master records retrieved'));
  }),

  // ==========================================
  // 3. PROPOSALS / QUOTATIONS
  // ==========================================
  listProposals: asyncHandler(async (req, res) => {
    const proposals = await Proposal.find()
      .populate('client', 'name email company')
      .populate('project', 'name')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json(successResponse(proposals, 'Proposals retrieved'));
  }),

  createProposal: asyncHandler(async (req, res) => {
    const { client, clientName, project, items, tax, discount, validUntil, notes } = req.body;
    if (!clientName || !Array.isArray(items) || items.length === 0) {
      throw createValidationError('Client name and at least one item are required');
    }

    const count = await Proposal.countDocuments();
    const proposalNumber = `PROP-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const newProp = await Proposal.create({
      proposalNumber,
      client: client && mongoose.Types.ObjectId.isValid(client) ? client : null,
      clientName: clientName.trim(),
      project: project && mongoose.Types.ObjectId.isValid(project) ? project : null,
      items,
      tax: Number(tax) || 0,
      discount: Number(discount) || 0,
      validUntil: validUntil ? new Date(validUntil) : null,
      notes: notes || '',
      createdBy: req.user?.userId || null,
      status: 'Sent',
    });

    await logAudit({
      action: 'Proposal Created',
      entityType: 'Invoice',
      entityId: newProp._id,
      reference: newProp.proposalNumber,
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      newValue: newProp.toJSON(),
      amount: newProp.total,
      reason: 'New financial proposal generated',
    });

    res.status(201).json(createdResponse(newProp, 'Proposal created successfully'));
  }),

  convertToInvoice: asyncHandler(async (req, res) => {
    const prop = await Proposal.findById(req.params.id);
    if (!prop) throw createNotFoundError('Proposal not found');

    const invCount = await Invoice.countDocuments();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invCount + 1).padStart(4, '0')}`;

    const newInvoice = await Invoice.create({
      user: req.user?.userId,
      invoiceNumber,
      client: prop.client,
      clientName: prop.clientName,
      project: prop.project,
      proposal: prop._id,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      amount: prop.subtotal,
      cgst: Math.round((prop.tax / 2) * 100) / 100,
      sgst: Math.round((prop.tax / 2) * 100) / 100,
      qty: prop.items.reduce((s, it) => s + (Number(it.qty) || 1), 0),
      items: prop.items,
      status: 'Sent',
      description: `Generated from Proposal ${prop.proposalNumber}`,
    });

    prop.status = 'Converted to Invoice';
    prop.convertedInvoice = newInvoice._id;
    await prop.save();

    await logAudit({
      action: 'Proposal Converted to Invoice',
      entityType: 'Invoice',
      entityId: newInvoice._id,
      reference: newInvoice.invoiceNumber,
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      amount: newInvoice.amount,
      reason: `Converted from Proposal ${prop.proposalNumber}`,
    });

    res.json(successResponse({ proposal: prop, invoice: newInvoice }, 'Proposal successfully converted to invoice'));
  }),

  // ==========================================
  // 4. INVOICES & RECEIVABLES
  // ==========================================
  listInvoices: asyncHandler(async (req, res) => {
    const { search, status, client, startDate, endDate } = req.query;
    const filter = {};

    if (status && status !== 'All') {
      filter.status = status;
    }

    if (client && client !== 'All' && mongoose.Types.ObjectId.isValid(client)) {
      filter.client = client;
    }

    if (startDate || endDate) {
      filter.issueDate = {};
      if (startDate) filter.issueDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.issueDate.$lte = end;
      }
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      filter.$or = [
        { invoiceNumber: { $regex: q, $options: 'i' } },
        { clientName: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
    }

    const invoices = await Invoice.find(filter)
      .populate('client', 'name email company')
      .populate('project', 'name')
      .populate('user', 'firstName lastName email')
      .sort({ issueDate: -1, createdAt: -1 });

    res.json(successResponse(invoices, 'Invoices retrieved successfully'));
  }),

  createInvoice: asyncHandler(async (req, res) => {
    const {
      client,
      clientName,
      project,
      mobileNo,
      gstin,
      address,
      issueDate,
      dueDate,
      amount,
      cgst,
      sgst,
      qty,
      items,
      description,
      status,
    } = req.body;

    if (!clientName || amount === undefined || amount === null) {
      throw createValidationError('Client name and base amount are required');
    }

    const invCount = await Invoice.countDocuments();
    const invoiceNumber = req.body.invoiceNumber || `INV-${new Date().getFullYear()}-${String(invCount + 101).padStart(4, '0')}`;

    const newInvoice = await Invoice.create({
      user: req.user?.userId,
      invoiceNumber,
      client: client && mongoose.Types.ObjectId.isValid(client) ? client : null,
      clientName: clientName.trim(),
      project: project && mongoose.Types.ObjectId.isValid(project) ? project : null,
      mobileNo: mobileNo || '',
      gstin: gstin || '',
      address: address || '',
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      amount: Number(amount) || 0,
      cgst: Number(cgst) || 0,
      sgst: Number(sgst) || 0,
      qty: Number(qty) || 1,
      items: Array.isArray(items) ? items : [],
      description: description || '',
      status: status || 'Sent',
    });

    await logAudit({
      action: 'Invoice Created',
      entityType: 'Invoice',
      entityId: newInvoice._id,
      reference: newInvoice.invoiceNumber,
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      newValue: newInvoice.toJSON(),
      amount: newInvoice.amount + newInvoice.cgst + newInvoice.sgst,
      reason: 'Created new client invoice',
    });

    res.status(201).json(createdResponse(newInvoice, 'Invoice created successfully in Atlas'));
  }),

  recordInvoicePayment: asyncHandler(async (req, res) => {
    const { amount, paymentMethod, transactionReference, paymentDate, bankAccountId, notes } = req.body;
    const inv = await Invoice.findById(req.params.id);
    if (!inv) throw createNotFoundError('Invoice not found');

    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) {
      throw createValidationError('Payment amount must be greater than 0');
    }

    const currentBalance = Number(inv.balance) || 0;
    if (payAmount > currentBalance + 0.01) {
      throw createValidationError(`Payment amount cannot exceed outstanding balance of ${currentBalance}`);
    }

    let bankAccount = null;
    if (bankAccountId && mongoose.Types.ObjectId.isValid(bankAccountId)) {
      bankAccount = await BankAccount.findById(bankAccountId);
      if (!bankAccount) throw createNotFoundError('Selected Bank Account not found');
      if (!bankAccount.isActive) throw createValidationError('Selected Bank Account is inactive');
    } else {
      bankAccount = await BankAccount.findOne({ isActive: true });
    }

    const payCount = await Payment.countDocuments();
    const paymentNumber = `PAY-${Date.now().toString().slice(-6)}-${String(payCount + 1).padStart(3, '0')}`;

    // 1. Create Transaction in Payment collection
    const payment = await Payment.create({
      paymentNumber,
      transactionType: 'Income',
      entryType: 'Credit',
      category: 'Client Payment',
      source: 'Client',
      invoice: inv._id,
      client: inv.client,
      clientName: inv.clientName,
      project: inv.project,
      bankAccount: bankAccount?._id || null,
      bankAccountName: bankAccount ? `${bankAccount.bankName} - ${bankAccount.accountName}` : '',
      amount: payAmount,
      currency: inv.currency || 'INR',
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      paymentMethod: paymentMethod || 'Bank Transfer',
      transactionReference: transactionReference || `UTR-${Date.now()}`,
      status: 'Completed',
      notes: notes || `Payment received for Invoice ${inv.invoiceNumber}`,
      recordedBy: req.user?.userId || null,
    });

    // 2. Update Invoice
    inv.paidAmount = Math.round(((Number(inv.paidAmount) || 0) + payAmount) * 100) / 100;
    inv.paymentHistory.push({
      payment: payment._id,
      paymentNumber: payment.paymentNumber,
      amount: payAmount,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      transactionReference: payment.transactionReference,
      bankAccount: bankAccount?._id || null,
      recordedBy: req.user?.userId || null,
    });

    await inv.save();

    // 3. Recalculate Bank Balance
    if (bankAccount) {
      await recalculateBankBalance(bankAccount._id);
    }

    // 4. Audit Log
    await logAudit({
      action: 'Payment Recorded',
      entityType: 'Invoice',
      entityId: inv._id,
      reference: inv.invoiceNumber,
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      amount: payAmount,
      reason: `Client payment of ${payAmount} recorded via ${payment.paymentMethod}`,
    });

    res.json(
      successResponse(
        { invoice: inv, payment, updatedBankBalance: bankAccount?.currentBalance },
        'Payment recorded successfully. Bank balance and invoice updated.'
      )
    );
  }),

  // ==========================================
  // 5. PAYMENT RECOVERY
  // ==========================================
  listRecovery: asyncHandler(async (req, res) => {
    const invoices = await Invoice.find({
      status: { $in: ['Sent', 'Partially Paid', 'Overdue'] },
      balance: { $gt: 0 },
    })
      .populate('client', 'name email phone company')
      .populate('recovery.owner', 'firstName lastName email')
      .sort({ dueDate: 1 });

    res.json(successResponse(invoices, 'Payment recovery cases retrieved'));
  }),

  addRecoveryFollowUp: asyncHandler(async (req, res) => {
    const { status, nextFollowUp, promiseToPayDate, note, owner } = req.body;
    const inv = await Invoice.findById(req.params.id);
    if (!inv) throw createNotFoundError('Invoice not found');

    if (!note || !String(note).trim()) {
      throw createValidationError('Follow-up note is required');
    }

    if (!inv.recovery) {
      inv.recovery = { notes: [] };
    }

    if (status) inv.recovery.status = status;
    if (nextFollowUp) inv.recovery.nextFollowUp = new Date(nextFollowUp);
    if (promiseToPayDate) inv.recovery.promiseToPayDate = new Date(promiseToPayDate);
    inv.recovery.lastFollowUp = new Date();

    if (owner && mongoose.Types.ObjectId.isValid(owner)) {
      inv.recovery.owner = owner;
      const u = await User.findById(owner);
      if (u) inv.recovery.ownerName = getUserName(u);
    }

    inv.recovery.notes.push({
      date: new Date(),
      note: note.trim(),
      followUpBy: getUserName(req.user),
    });

    await inv.save();

    await logAudit({
      action: 'Recovery Follow-up Logged',
      entityType: 'Invoice',
      entityId: inv._id,
      reference: inv.invoiceNumber,
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      reason: `Recovery status updated to ${inv.recovery.status}: ${note}`,
    });

    res.json(successResponse(inv, 'Recovery follow-up logged successfully'));
  }),

  // ==========================================
  // 6. EXPENSES (Client, Office, Project)
  // ==========================================
  listExpenses: asyncHandler(async (req, res) => {
    const { categoryType, status, paymentStatus, search } = req.query;
    const filter = {};

    if (categoryType && categoryType !== 'All') {
      filter.categoryType = categoryType;
    }

    const st = status || paymentStatus;
    if (st && st !== 'All') {
      filter.paymentStatus = st;
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { vendorName: { $regex: q, $options: 'i' } },
        { employeeName: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
    }

    const expenses = await Expense.find(filter)
      .populate('employee', 'firstName lastName email department')
      .populate('recordedBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email')
      .populate('client', 'name company')
      .populate('project', 'name')
      .populate('bankAccount', 'accountName bankName')
      .sort({ expenseDate: -1, createdAt: -1 });

    res.json(successResponse(expenses, 'Expenses retrieved successfully'));
  }),

  createExpense: asyncHandler(async (req, res) => {
    const {
      title,
      category,
      categoryType,
      department,
      amount,
      expenseDate,
      paymentMethod,
      vendorName,
      client,
      clientName,
      project,
      projectName,
      description,
      receiptNumber,
      receiptUrl,
    } = req.body;

    if (!title || !category || amount === undefined || amount === null) {
      throw createValidationError('Title, category, and valid amount are required');
    }

    const newExp = await Expense.create({
      title: title.trim(),
      category: category.trim(),
      categoryType: categoryType || 'Office Expenses',
      department: department || 'Finance',
      amount: Number(amount) || 0,
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      paymentMethod: paymentMethod || 'Bank Transfer',
      paymentStatus: 'Pending',
      vendorName: vendorName ? vendorName.trim() : '',
      client: client && mongoose.Types.ObjectId.isValid(client) ? client : null,
      clientName: clientName || '',
      project: project && mongoose.Types.ObjectId.isValid(project) ? project : null,
      projectName: projectName || '',
      receiptNumber: receiptNumber || `REC-${Date.now().toString().slice(-6)}`,
      receiptUrl: receiptUrl || '',
      description: description || '',
      recordedBy: req.user?.userId || null,
      employee: req.user?.userId || null,
      employeeName: getUserName(req.user),
    });

    await logAudit({
      action: 'Expense Created',
      entityType: 'Expense',
      entityId: newExp._id,
      reference: newExp.title,
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      amount: newExp.amount,
      reason: `New expense submitted for ${newExp.categoryType}`,
    });

    res.status(201).json(createdResponse(newExp, 'Expense created successfully'));
  }),

  approveExpense: asyncHandler(async (req, res) => {
    const exp = await Expense.findById(req.params.id);
    if (!exp) throw createNotFoundError('Expense not found');

    exp.paymentStatus = 'Approved';
    exp.approvedBy = req.user?.userId || null;
    await exp.save();

    await logAudit({
      action: 'Expense Approved',
      entityType: 'Expense',
      entityId: exp._id,
      reference: exp.title,
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      amount: exp.amount,
      reason: 'Expense approved for disbursal (funds not moved yet)',
    });

    res.json(successResponse(exp, 'Expense approved successfully. Awaiting payment disbursal.'));
  }),

  rejectExpense: asyncHandler(async (req, res) => {
    const exp = await Expense.findById(req.params.id);
    if (!exp) throw createNotFoundError('Expense not found');

    exp.paymentStatus = 'Rejected';
    if (req.body.reason) {
      exp.description = exp.description ? `${exp.description} [Rejected: ${req.body.reason}]` : `Rejected: ${req.body.reason}`;
    }
    await exp.save();

    await logAudit({
      action: 'Expense Rejected',
      entityType: 'Expense',
      entityId: exp._id,
      reference: exp.title,
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      amount: exp.amount,
      reason: req.body.reason || 'Expense rejected by Finance',
    });

    res.json(successResponse(exp, 'Expense rejected'));
  }),

  payExpense: asyncHandler(async (req, res) => {
    const { bankAccountId, paymentMethod, transactionReference } = req.body;
    const exp = await Expense.findById(req.params.id);
    if (!exp) throw createNotFoundError('Expense not found');

    if (exp.paymentStatus === 'Paid') {
      throw createValidationError('This expense has already been paid');
    }

    let bankAccount = null;
    if (bankAccountId && mongoose.Types.ObjectId.isValid(bankAccountId)) {
      bankAccount = await BankAccount.findById(bankAccountId);
      if (!bankAccount) throw createNotFoundError('Selected Bank Account not found');
      if (!bankAccount.isActive) throw createValidationError('Selected Bank Account is inactive');
    } else {
      bankAccount = await BankAccount.findOne({ isActive: true });
    }

    const payCount = await Payment.countDocuments();
    const paymentNumber = `PAY-EXP-${Date.now().toString().slice(-6)}-${String(payCount + 1).padStart(3, '0')}`;

    // 1. Financial Transaction (Debit)
    const payment = await Payment.create({
      paymentNumber,
      transactionType: 'Expense',
      entryType: 'Debit',
      category: exp.categoryType || 'Office Expense',
      source: 'Company',
      expense: exp._id,
      bankAccount: bankAccount?._id || null,
      bankAccountName: bankAccount ? `${bankAccount.bankName} - ${bankAccount.accountName}` : '',
      amount: exp.amount,
      currency: exp.currency || 'INR',
      paymentDate: new Date(),
      paymentMethod: paymentMethod || exp.paymentMethod || 'Bank Transfer',
      transactionReference: transactionReference || `UTR-EXP-${Date.now()}`,
      status: 'Completed',
      notes: `Disbursed payment for expense: ${exp.title}`,
      recordedBy: req.user?.userId || null,
    });

    // 2. Mark Expense Paid
    exp.paymentStatus = 'Paid';
    exp.bankAccount = bankAccount?._id || null;
    exp.payment = payment._id;
    exp.paidAt = new Date();
    await exp.save();

    // 3. Update Bank Balance
    if (bankAccount) {
      await recalculateBankBalance(bankAccount._id);
    }

    // 4. Audit
    await logAudit({
      action: 'Expense Paid',
      entityType: 'Expense',
      entityId: exp._id,
      reference: exp.title,
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      amount: exp.amount,
      reason: `Disbursed actual payment of ${exp.amount} from ${bankAccount?.accountName}`,
    });

    res.json(successResponse({ expense: exp, payment }, 'Expense paid successfully and bank account deducted'));
  }),

  // ==========================================
  // 7. BANK ACCOUNTS & BANK TRANSACTIONS
  // ==========================================
  listBankAccounts: asyncHandler(async (req, res) => {
    await ensureDefaultBankAccount();
    const accounts = await BankAccount.find().sort({ createdAt: -1 });

    // Recalculate each live
    const enriched = [];
    for (const acc of accounts) {
      const liveBal = await recalculateBankBalance(acc._id);
      enriched.push({
        ...acc.toObject(),
        currentBalance: liveBal,
      });
    }

    res.json(successResponse(enriched, 'Bank accounts retrieved'));
  }),

  createBankAccount: asyncHandler(async (req, res) => {
    const { accountName, bankName, accountNumber, ifscCode, branch, accountType, openingBalance, currency, notes } = req.body;
    if (!accountName || !bankName || !accountNumber) {
      throw createValidationError('Account name, bank name, and account number are required');
    }

    const openBal = Number(openingBalance) || 0;
    const account = await BankAccount.create({
      accountName: accountName.trim(),
      bankName: bankName.trim(),
      accountNumber: accountNumber.trim(),
      ifscCode: ifscCode || '',
      branch: branch || '',
      accountType: accountType || 'Current',
      openingBalance: openBal,
      currentBalance: openBal,
      currency: currency || 'INR',
      notes: notes || '',
      isActive: true,
    });

    await logAudit({
      action: 'Bank Account Created',
      entityType: 'BankAccount',
      entityId: account._id,
      reference: account.accountName,
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      amount: openBal,
      reason: `New bank account created with opening balance of ${openBal}`,
    });

    res.status(201).json(createdResponse(account, 'Bank account created successfully'));
  }),

  getAccountTransactions: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const transactions = await Payment.find({ bankAccount: id, status: 'Completed' })
      .sort({ paymentDate: -1 })
      .limit(200);

    res.json(successResponse(transactions, 'Bank account transactions retrieved'));
  }),

  // ==========================================
  // 8. VENDORS & VENDOR BILLS
  // ==========================================
  listVendors: asyncHandler(async (req, res) => {
    const vendors = await Vendor.find().sort({ companyName: 1 });
    const bills = await VendorBill.find();

    const vendorSummaries = vendors.map((v) => {
      const vId = String(v._id);
      const vBills = bills.filter((b) => String(b.vendor) === vId);
      const totalBilled = vBills.reduce((s, b) => s + (Number(b.totalAmount) || 0), 0);
      const totalPaid = vBills.reduce((s, b) => s + (Number(b.paidAmount) || 0), 0);
      const outstanding = Math.max(0, Math.round((totalBilled - totalPaid) * 100) / 100);

      return {
        ...v.toObject(),
        totalBilled: Math.round(totalBilled * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        outstanding,
        billsCount: vBills.length,
      };
    });

    res.json(successResponse(vendorSummaries, 'Vendors retrieved'));
  }),

  createVendor: asyncHandler(async (req, res) => {
    const { name, companyName, email, phone, category, gstin, pan, address, bankDetails, notes } = req.body;
    if (!name || !companyName) {
      throw createValidationError('Contact person name and company name are required');
    }

    const vendor = await Vendor.create({
      name: name.trim(),
      companyName: companyName.trim(),
      email: email || '',
      phone: phone || '',
      category: category || 'Software & IT',
      gstin: gstin || '',
      pan: pan || '',
      address: address || '',
      bankDetails: bankDetails || {},
      notes: notes || '',
      status: 'Active',
    });

    await logAudit({
      action: 'Vendor Created',
      entityType: 'Vendor',
      entityId: vendor._id,
      reference: vendor.companyName,
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      reason: 'New vendor registered in Vendor Master',
    });

    res.status(201).json(createdResponse(vendor, 'Vendor registered successfully'));
  }),

  listVendorBills: asyncHandler(async (req, res) => {
    const bills = await VendorBill.find()
      .populate('vendor', 'companyName name email')
      .populate('approvedBy', 'firstName lastName email')
      .sort({ billDate: -1, createdAt: -1 });

    res.json(successResponse(bills, 'Vendor bills retrieved'));
  }),

  createVendorBill: asyncHandler(async (req, res) => {
    const { vendor, billNumber, billDate, dueDate, category, amount, tax, description, receiptUrl } = req.body;
    if (!vendor || amount === undefined || amount === null) {
      throw createValidationError('Vendor and amount are required');
    }

    const vDoc = await Vendor.findById(vendor);
    if (!vDoc) throw createNotFoundError('Vendor not found');

    const generatedNumber = billNumber || `BILL-${Date.now().toString().slice(-6)}`;

    const newBill = await VendorBill.create({
      billNumber: generatedNumber,
      vendor: vDoc._id,
      vendorName: vDoc.companyName || vDoc.name,
      billDate: billDate ? new Date(billDate) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      category: category || 'Software & IT',
      amount: Number(amount) || 0,
      tax: Number(tax) || 0,
      description: description || '',
      receiptUrl: receiptUrl || '',
      approvalStatus: 'Pending',
      status: 'Pending',
    });

    await logAudit({
      action: 'Vendor Bill Created',
      entityType: 'VendorBill',
      entityId: newBill._id,
      reference: newBill.billNumber,
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      amount: newBill.totalAmount,
      reason: `Vendor bill created for ${vDoc.companyName}`,
    });

    res.status(201).json(createdResponse(newBill, 'Vendor bill created successfully'));
  }),

  approveVendorBill: asyncHandler(async (req, res) => {
    const bill = await VendorBill.findById(req.params.id);
    if (!bill) throw createNotFoundError('Vendor bill not found');

    bill.approvalStatus = 'Approved';
    bill.approvedBy = req.user?.userId || null;
    bill.approvedAt = new Date();
    await bill.save();

    await logAudit({
      action: 'Vendor Bill Approved',
      entityType: 'VendorBill',
      entityId: bill._id,
      reference: bill.billNumber,
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      amount: bill.totalAmount,
      reason: 'Vendor bill approved for payment (funds not moved yet)',
    });

    res.json(successResponse(bill, 'Vendor bill approved. Payable is now ready for payment.'));
  }),

  payVendorBill: asyncHandler(async (req, res) => {
    const { amount, bankAccountId, paymentMethod, transactionReference } = req.body;
    const bill = await VendorBill.findById(req.params.id);
    if (!bill) throw createNotFoundError('Vendor bill not found');

    if (bill.approvalStatus !== 'Approved') {
      throw createValidationError('Cannot pay an unapproved vendor bill');
    }

    const payAmount = Number(amount) || Number(bill.balance);
    if (payAmount <= 0) throw createValidationError('Payment amount must be greater than 0');
    if (payAmount > Number(bill.balance) + 0.01) {
      throw createValidationError(`Amount exceeds bill balance of ${bill.balance}`);
    }

    let bankAccount = null;
    if (bankAccountId && mongoose.Types.ObjectId.isValid(bankAccountId)) {
      bankAccount = await BankAccount.findById(bankAccountId);
      if (!bankAccount) throw createNotFoundError('Selected Bank Account not found');
      if (!bankAccount.isActive) throw createValidationError('Selected Bank Account is inactive');
    } else {
      bankAccount = await BankAccount.findOne({ isActive: true });
    }

    const payCount = await Payment.countDocuments();
    const paymentNumber = `PAY-VEND-${Date.now().toString().slice(-6)}-${String(payCount + 1).padStart(3, '0')}`;

    // 1. Transaction Debit
    const payment = await Payment.create({
      paymentNumber,
      transactionType: 'Expense',
      entryType: 'Debit',
      category: 'Vendor Bill Payment',
      source: 'Company',
      vendor: bill.vendor,
      vendorName: bill.vendorName,
      vendorBill: bill._id,
      bankAccount: bankAccount?._id || null,
      bankAccountName: bankAccount ? `${bankAccount.bankName} - ${bankAccount.accountName}` : '',
      amount: payAmount,
      currency: 'INR',
      paymentDate: new Date(),
      paymentMethod: paymentMethod || 'Bank Transfer',
      transactionReference: transactionReference || `UTR-VEND-${Date.now()}`,
      status: 'Completed',
      notes: `Disbursal for Vendor Bill ${bill.billNumber}`,
      recordedBy: req.user?.userId || null,
    });

    // 2. Update Bill
    bill.paidAmount = Math.round(((Number(bill.paidAmount) || 0) + payAmount) * 100) / 100;
    await bill.save();

    // 3. Update Bank Balance
    if (bankAccount) {
      await recalculateBankBalance(bankAccount._id);
    }

    // 4. Audit
    await logAudit({
      action: 'Vendor Bill Paid',
      entityType: 'VendorBill',
      entityId: bill._id,
      reference: bill.billNumber,
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      amount: payAmount,
      reason: `Disbursed ${payAmount} for vendor bill ${bill.billNumber}`,
    });

    res.json(successResponse({ bill, payment }, 'Vendor payment recorded successfully'));
  }),

  // ==========================================
  // 9. PAYMENT REQUESTS
  // ==========================================
  listPaymentRequests: asyncHandler(async (req, res) => {
    const requests = await PaymentRequest.find()
      .populate('requester', 'firstName lastName email department')
      .populate('vendor', 'companyName')
      .populate('employee', 'firstName lastName')
      .populate('client', 'name')
      .populate('project', 'name')
      .populate('approvedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json(successResponse(requests, 'Payment requests retrieved'));
  }),

  createPaymentRequest: asyncHandler(async (req, res) => {
    const { paymentType, payeeName, amount, reason, priority, requiredDate, project, vendor, employee, client, supportingDocumentUrl } = req.body;
    if (!payeeName || !amount || !reason) {
      throw createValidationError('Payee name, amount, and reason are required');
    }

    const settings = await getOrCreateFinanceSettings();
    const reqAmount = Number(amount);
    const requiresSuperAdmin = reqAmount > Number(settings.approvalThreshold);

    const reqCount = await PaymentRequest.countDocuments();
    const requestNumber = `REQ-${new Date().getFullYear()}-${String(reqCount + 1).padStart(4, '0')}`;

    const newReq = await PaymentRequest.create({
      requestNumber,
      requester: req.user?.userId,
      requesterName: getUserName(req.user),
      department: req.user?.department || 'Finance',
      paymentType: paymentType || 'Vendor',
      payeeName: payeeName.trim(),
      amount: reqAmount,
      reason: reason.trim(),
      priority: priority || 'Medium',
      requiredDate: requiredDate ? new Date(requiredDate) : null,
      project: project && mongoose.Types.ObjectId.isValid(project) ? project : null,
      vendor: vendor && mongoose.Types.ObjectId.isValid(vendor) ? vendor : null,
      employee: employee && mongoose.Types.ObjectId.isValid(employee) ? employee : null,
      client: client && mongoose.Types.ObjectId.isValid(client) ? client : null,
      supportingDocumentUrl: supportingDocumentUrl || '',
      approvalThreshold: settings.approvalThreshold,
      requiresSuperAdmin,
      status: 'Submitted',
    });

    await logAudit({
      action: 'Payment Request Created',
      entityType: 'PaymentRequest',
      entityId: newReq._id,
      reference: newReq.requestNumber,
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      amount: newReq.amount,
      reason: `Payment request submitted for ${newReq.payeeName} (Requires SuperAdmin: ${requiresSuperAdmin})`,
    });

    res.status(201).json(createdResponse(newReq, 'Payment request submitted successfully'));
  }),

  approvePaymentRequest: asyncHandler(async (req, res) => {
    const request = await PaymentRequest.findById(req.params.id);
    if (!request) throw createNotFoundError('Payment request not found');

    if (request.requiresSuperAdmin && req.user?.role !== 'super_admin') {
      throw createForbiddenError(`Amounts above ${request.approvalThreshold} require SuperAdmin approval`);
    }

    request.status = 'Approved';
    request.approvedBy = req.user?.userId || null;
    request.approvedByName = getUserName(req.user);
    request.approvedAt = new Date();
    await request.save();

    await logAudit({
      action: 'Payment Request Approved',
      entityType: 'PaymentRequest',
      entityId: request._id,
      reference: request.requestNumber,
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      amount: request.amount,
      reason: 'Payment request approved for disbursal',
    });

    res.json(successResponse(request, 'Payment request approved'));
  }),

  rejectPaymentRequest: asyncHandler(async (req, res) => {
    const request = await PaymentRequest.findById(req.params.id);
    if (!request) throw createNotFoundError('Payment request not found');

    request.status = 'Rejected';
    request.rejectionReason = req.body.reason || 'Rejected by Finance/Management';
    await request.save();

    await logAudit({
      action: 'Payment Request Rejected',
      entityType: 'PaymentRequest',
      entityId: request._id,
      reference: request.requestNumber,
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      amount: request.amount,
      reason: request.rejectionReason,
    });

    res.json(successResponse(request, 'Payment request rejected'));
  }),

  payPaymentRequest: asyncHandler(async (req, res) => {
    const { bankAccountId, paymentMethod, transactionReference } = req.body;
    const request = await PaymentRequest.findById(req.params.id);
    if (!request) throw createNotFoundError('Payment request not found');

    if (request.status !== 'Approved') {
      throw createValidationError('Cannot pay a request that is not Approved');
    }

    let bankAccount = null;
    if (bankAccountId && mongoose.Types.ObjectId.isValid(bankAccountId)) {
      bankAccount = await BankAccount.findById(bankAccountId);
      if (!bankAccount) throw createNotFoundError('Bank account not found');
    } else {
      bankAccount = await BankAccount.findOne({ isActive: true });
    }

    const payCount = await Payment.countDocuments();
    const paymentNumber = `PAY-REQ-${Date.now().toString().slice(-6)}-${String(payCount + 1).padStart(3, '0')}`;

    // 1. Transaction
    const payment = await Payment.create({
      paymentNumber,
      transactionType: 'Expense',
      entryType: 'Debit',
      category: 'Payment Request Disbursal',
      source: 'Company',
      paymentRequest: request._id,
      bankAccount: bankAccount?._id || null,
      bankAccountName: bankAccount ? `${bankAccount.bankName} - ${bankAccount.accountName}` : '',
      amount: request.amount,
      currency: 'INR',
      paymentDate: new Date(),
      paymentMethod: paymentMethod || 'Bank Transfer',
      transactionReference: transactionReference || `UTR-REQ-${Date.now()}`,
      status: 'Completed',
      notes: `Payment for Request ${request.requestNumber} to ${request.payeeName}`,
      recordedBy: req.user?.userId || null,
    });

    // 2. Mark Request Paid
    request.status = 'Paid';
    request.paidAt = new Date();
    request.payment = payment._id;
    request.bankAccount = bankAccount?._id || null;
    await request.save();

    // 3. Bank balance recalculate
    if (bankAccount) {
      await recalculateBankBalance(bankAccount._id);
    }

    // 4. Audit
    await logAudit({
      action: 'Payment Request Disbursed',
      entityType: 'PaymentRequest',
      entityId: request._id,
      reference: request.requestNumber,
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      amount: request.amount,
      reason: `Disbursed ${request.amount} to ${request.payeeName}`,
    });

    res.json(successResponse({ request, payment }, 'Payment request disbursed successfully'));
  }),

  // ==========================================
  // 10. PAYROLL & F&F SETTLEMENT INTEGRATION
  // ==========================================
  listPayroll: asyncHandler(async (req, res) => {
    const payrolls = await Payroll.find()
      .populate('user', 'firstName lastName email department designation')
      .sort({ payPeriod: -1, createdAt: -1 });

    res.json(successResponse(payrolls, 'Payroll records retrieved from HR Payroll'));
  }),

  disburseSalary: asyncHandler(async (req, res) => {
    const { bankAccountId, paymentMethod, transactionReference } = req.body;
    const payr = await Payroll.findById(req.params.id).populate('user', 'firstName lastName email');
    if (!payr) throw createNotFoundError('Payroll slip not found');

    if (payr.status === 'Paid') {
      throw createValidationError('This payroll slip has already been disbursed/paid');
    }

    let bankAccount = null;
    if (bankAccountId && mongoose.Types.ObjectId.isValid(bankAccountId)) {
      bankAccount = await BankAccount.findById(bankAccountId);
      if (!bankAccount) throw createNotFoundError('Bank account not found');
    } else {
      bankAccount = await BankAccount.findOne({ isActive: true });
    }

    const payCount = await Payment.countDocuments();
    const empName = payr.user ? `${payr.user.firstName || ''} ${payr.user.lastName || ''}`.trim() : 'Employee';
    const paymentNumber = `PAY-SAL-${Date.now().toString().slice(-6)}-${String(payCount + 1).padStart(3, '0')}`;

    // 1. Transaction
    const payment = await Payment.create({
      paymentNumber,
      transactionType: 'Expense',
      entryType: 'Debit',
      category: 'Salary Disbursal',
      source: 'Company',
      payroll: payr._id,
      employee: payr.user?._id || null,
      employeeName: empName,
      bankAccount: bankAccount?._id || null,
      bankAccountName: bankAccount ? `${bankAccount.bankName} - ${bankAccount.accountName}` : '',
      amount: payr.net,
      currency: payr.currency || 'INR',
      paymentDate: new Date(),
      paymentMethod: paymentMethod || 'Bank Transfer',
      transactionReference: transactionReference || `SAL-UTR-${Date.now()}`,
      status: 'Completed',
      notes: `Salary disbursal for ${empName} (${payr.payPeriod})`,
      recordedBy: req.user?.userId || null,
    });

    // 2. Update Payroll
    payr.status = 'Paid';
    payr.paymentDate = new Date();
    payr.paidBy = req.user?.userId || null;
    payr.paidAt = new Date();
    payr.paymentMethod = paymentMethod || 'Bank Transfer';
    payr.paymentReference = payment.transactionReference;
    await payr.save();

    // 3. Update Bank
    if (bankAccount) {
      await recalculateBankBalance(bankAccount._id);
    }

    // 4. Audit
    await logAudit({
      action: 'Salary Disbursed',
      entityType: 'Payroll',
      entityId: payr._id,
      reference: `${empName} - ${payr.payPeriod}`,
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      amount: payr.net,
      reason: `Salary disbursed for ${payr.payPeriod}`,
    });

    res.json(successResponse({ payroll: payr, payment }, 'Salary disbursed successfully'));
  }),

  listFnfSettlements: asyncHandler(async (req, res) => {
    const settlements = await FullAndFinalSettlement.find()
      .populate('user', 'firstName lastName email department designation')
      .sort({ createdAt: -1 });

    res.json(successResponse(settlements, 'Full & Final settlements retrieved'));
  }),

  disburseFnfSettlement: asyncHandler(async (req, res) => {
    const { bankAccountId, paymentMethod, transactionReference } = req.body;
    const fnf = await FullAndFinalSettlement.findById(req.params.id).populate('user', 'firstName lastName email');
    if (!fnf) throw createNotFoundError('Full & Final settlement not found');

    if (fnf.payment?.paymentStatus === 'Paid') {
      throw createValidationError('This Full & Final settlement has already been paid');
    }

    let bankAccount = null;
    if (bankAccountId && mongoose.Types.ObjectId.isValid(bankAccountId)) {
      bankAccount = await BankAccount.findById(bankAccountId);
      if (!bankAccount) throw createNotFoundError('Bank account not found');
    } else {
      bankAccount = await BankAccount.findOne({ isActive: true });
    }

    const payCount = await Payment.countDocuments();
    const empName = fnf.employeeSnapshot?.name || (fnf.user ? `${fnf.user.firstName || ''} ${fnf.user.lastName || ''}`.trim() : 'Employee');
    const paymentNumber = `PAY-FNF-${Date.now().toString().slice(-6)}-${String(payCount + 1).padStart(3, '0')}`;

    // 1. Transaction
    const payment = await Payment.create({
      paymentNumber,
      transactionType: 'Expense',
      entryType: 'Debit',
      category: 'F&F Settlement',
      source: 'Company',
      settlement: fnf._id,
      employee: fnf.user?._id || null,
      employeeName: empName,
      bankAccount: bankAccount?._id || null,
      bankAccountName: bankAccount ? `${bankAccount.bankName} - ${bankAccount.accountName}` : '',
      amount: fnf.netPayable,
      currency: 'INR',
      paymentDate: new Date(),
      paymentMethod: paymentMethod || 'Bank Transfer',
      transactionReference: transactionReference || `FNF-UTR-${Date.now()}`,
      status: 'Completed',
      notes: `Full & Final Settlement payout for ${empName}`,
      recordedBy: req.user?.userId || null,
    });

    // 2. Update Settlement
    fnf.payment = {
      ...(fnf.payment || {}),
      paymentStatus: 'Paid',
      paidAt: new Date(),
      paidBy: req.user?.userId || null,
      paidByName: getUserName(req.user),
      paymentMethod: paymentMethod || 'Bank Transfer',
      paymentReference: payment.transactionReference,
    };

    if (fnf.clearance?.finance) {
      fnf.clearance.finance.status = 'Completed';
      fnf.clearance.finance.completedBy = getUserName(req.user);
      fnf.clearance.finance.completedDate = new Date();
    }

    fnf.history.push({
      action: 'Settlement Paid',
      previousStatus: fnf.status,
      newStatus: 'Settled',
      note: `Finance disbursed settlement payment of ${fnf.netPayable}`,
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      at: new Date(),
    });

    fnf.status = 'Settled';
    await fnf.save();

    // 3. Bank balance recalculate
    if (bankAccount) {
      await recalculateBankBalance(bankAccount._id);
    }

    // 4. Audit
    await logAudit({
      action: 'F&F Settlement Disbursed',
      entityType: 'Settlement',
      entityId: fnf._id,
      reference: empName,
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      amount: fnf.netPayable,
      reason: `Full and Final settlement paid for ${empName}`,
    });

    res.json(successResponse({ settlement: fnf, payment }, 'Full & Final Settlement disbursed successfully'));
  }),

  // ==========================================
  // 11. GENERAL LEDGER
  // ==========================================
  getLedger: asyncHandler(async (req, res) => {
    const { accountId, transactionType, category, startDate, endDate } = req.query;
    const filter = { status: 'Completed' };

    if (accountId && mongoose.Types.ObjectId.isValid(accountId)) {
      filter.bankAccount = accountId;
    }

    if (transactionType && transactionType !== 'All') {
      filter.transactionType = transactionType;
    }

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) filter.paymentDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.paymentDate.$lte = end;
      }
    }

    const transactions = await Payment.find(filter)
      .populate('bankAccount', 'accountName bankName')
      .populate('client', 'name company')
      .populate('vendor', 'companyName')
      .populate('employee', 'firstName lastName')
      .populate('recordedBy', 'firstName lastName')
      .sort({ paymentDate: 1, createdAt: 1 });

    // Calculate running balance
    let runningBalance = 0;
    const ledgerEntries = transactions.map((t) => {
      const isCredit = t.transactionType === 'Income' || t.entryType === 'Credit';
      const debitAmt = isCredit ? 0 : Number(t.amount) || 0;
      const creditAmt = isCredit ? Number(t.amount) || 0 : 0;
      runningBalance = runningBalance + creditAmt - debitAmt;

      const party =
        t.clientName ||
        t.vendorName ||
        t.employeeName ||
        (t.client ? t.client.name : '') ||
        (t.vendor ? t.vendor.companyName : '') ||
        '—';

      return {
        _id: t._id,
        date: t.paymentDate,
        paymentNumber: t.paymentNumber,
        category: t.category,
        transactionType: t.transactionType,
        accountName: t.bankAccount ? `${t.bankAccount.bankName} - ${t.bankAccount.accountName}` : t.bankAccountName || 'General',
        party,
        reference: t.transactionReference,
        debit: debitAmt,
        credit: creditAmt,
        runningBalance: Math.round(runningBalance * 100) / 100,
        notes: t.notes,
      };
    });

    res.json(successResponse(ledgerEntries.reverse(), 'General ledger records retrieved'));
  }),

  // ==========================================
  // 12. BANK RECONCILIATION
  // ==========================================
  listReconciliations: asyncHandler(async (req, res) => {
    const records = await BankReconciliation.find()
      .populate('bankAccount', 'accountName bankName accountNumber')
      .populate('reconciledBy', 'firstName lastName email')
      .sort({ statementDate: -1 });

    res.json(successResponse(records, 'Bank reconciliations retrieved'));
  }),

  createReconciliation: asyncHandler(async (req, res) => {
    const { bankAccountId, statementDate, statementBalance, unmatchedTransactions, notes } = req.body;
    if (!bankAccountId || statementBalance === undefined || !statementDate) {
      throw createValidationError('Bank account, statement date, and statement balance are required');
    }

    const account = await BankAccount.findById(bankAccountId);
    if (!account) throw createNotFoundError('Bank account not found');

    const sDate = new Date(statementDate);
    sDate.setHours(23, 59, 59, 999);

    // Compute ledger balance up to statement date
    const tx = await Payment.find({
      bankAccount: bankAccountId,
      status: 'Completed',
      paymentDate: { $lte: sDate },
    });

    let credits = 0;
    let debits = 0;
    const matchedIds = [];
    tx.forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (t.transactionType === 'Income' || t.entryType === 'Credit') credits += amt;
      else debits += amt;
      matchedIds.push(t._id);
    });

    const ledgerBalance = Math.round((account.openingBalance + credits - debits) * 100) / 100;
    const stmtBal = Number(statementBalance) || 0;

    const recon = await BankReconciliation.create({
      bankAccount: account._id,
      statementDate: new Date(statementDate),
      statementBalance: stmtBal,
      ledgerBalance,
      difference: Math.round((stmtBal - ledgerBalance) * 100) / 100,
      matchedTransactions: matchedIds,
      unmatchedTransactions: Array.isArray(unmatchedTransactions) ? unmatchedTransactions : [],
      notes: notes || '',
      reconciledBy: req.user?.userId || null,
      reconciledByName: getUserName(req.user),
      reconciledAt: new Date(),
    });

    account.lastReconciledDate = new Date();
    account.reconciliationStatus = recon.status;
    await account.save();

    await logAudit({
      action: 'Bank Reconciliation Created',
      entityType: 'Reconciliation',
      entityId: recon._id,
      reference: account.accountName,
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      amount: stmtBal,
      reason: `Reconciliation completed with status ${recon.status} (Difference: ${recon.difference})`,
    });

    res.status(201).json(createdResponse(recon, 'Reconciliation recorded successfully'));
  }),

  // ==========================================
  // 13. AUDIT HISTORY
  // ==========================================
  listAuditHistory: asyncHandler(async (req, res) => {
    const { entityType, action, search } = req.query;
    const filter = {};

    if (entityType && entityType !== 'All') {
      filter.entityType = entityType;
    }

    if (action && action !== 'All') {
      filter.action = action;
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      filter.$or = [
        { reference: { $regex: q, $options: 'i' } },
        { performedByName: { $regex: q, $options: 'i' } },
        { reason: { $regex: q, $options: 'i' } },
      ];
    }

    const audits = await FinanceAudit.find(filter)
      .sort({ timestamp: -1 })
      .limit(300);

    res.json(successResponse(audits, 'Finance audit history retrieved'));
  }),

  // ==========================================
  // 14. FINANCE CONFIGURATION
  // ==========================================
  getSettings: asyncHandler(async (req, res) => {
    const settings = await getOrCreateFinanceSettings();
    res.json(successResponse(settings, 'Finance configuration retrieved'));
  }),

  updateSettings: asyncHandler(async (req, res) => {
    const settings = await getOrCreateFinanceSettings();
    const allowed = [
      'approvalThreshold',
      'fiscalYearStartMonth',
      'defaultPaymentTerms',
      'defaultTaxRate',
      'currency',
      'autoRecoveryReminders',
      'overdueGraceDays',
    ];

    const prev = settings.toJSON();
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) settings[k] = req.body[k];
    });

    settings.updatedBy = req.user?.userId || null;
    await settings.save();

    await logAudit({
      action: 'Configuration Updated',
      entityType: 'Configuration',
      entityId: settings._id,
      reference: 'finance_config',
      performedBy: req.user?.userId,
      performedByName: getUserName(req.user),
      previousValue: prev,
      newValue: settings.toJSON(),
      reason: 'Finance settings and approval thresholds updated',
    });

    res.json(successResponse(settings, 'Finance configuration updated successfully'));
  }),
};

export default FinanceController;
