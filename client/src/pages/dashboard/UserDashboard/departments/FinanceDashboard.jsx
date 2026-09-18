import React, { useContext, useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppContext } from '../../../../context/AppContext';
import apiClient from '../../../../services/apiClient';
import UserLayout from '../users/components/UserLayout';
import './FinanceDashboard.css';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function FinanceDashboard() {
  const { user } = useContext(AppContext) || {};
  const location = useLocation();
  const navigate = useNavigate();

  // Sync tab with URL query parameter ?tab=...
  const queryParams = new URLSearchParams(location.search);
  const tabFromUrl = queryParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [period, setPeriod] = useState('month');

  // Dashboard Data State
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Tab-specific Data
  const [clients, setClients] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [recoveryInvoices, setRecoveryInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorBills, setVendorBills] = useState([]);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [settings, setSettings] = useState(null);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'payment' | 'invoice' | 'expense' | 'request' | 'vendor' | 'bill' | 'bank' | 'recovery' | 'disburseSalary' | 'disburseFnf' | 'reconcile'
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [modalFormData, setModalFormData] = useState({});
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Change tab and sync with URL
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    navigate(`/dashboard/finance?tab=${newTab}`, { replace: true });
    setSearchTerm('');
    setStatusFilter('All');
    setCategoryFilter('All');
  };

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [location.search]);

  // Load Dashboard Summary
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    apiClient
      .get(`/finance/dashboard?period=${period}`)
      .then((res) => {
        if (isMounted && res.data?.data) {
          setSummaryData(res.data.data);
        }
      })
      .catch((err) => {
        console.error('Failed to load finance summary:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [period, refreshTrigger]);

  // Load Tab Data On Demand
  useEffect(() => {
    let isMounted = true;
    const fetchTabData = async () => {
      try {
        if (activeTab === 'clients') {
          const res = await apiClient.get('/finance/clients');
          if (isMounted) setClients(res.data?.data || []);
        } else if (activeTab === 'proposals') {
          const res = await apiClient.get('/finance/proposals');
          if (isMounted) setProposals(res.data?.data || []);
        } else if (activeTab === 'invoices') {
          const res = await apiClient.get('/finance/invoices');
          if (isMounted) setInvoices(res.data?.data || []);
        } else if (activeTab === 'recovery') {
          const res = await apiClient.get('/finance/recovery');
          if (isMounted) setRecoveryInvoices(res.data?.data || []);
        } else if (activeTab === 'income') {
          const res = await apiClient.get('/finance/ledger?transactionType=Income');
          if (isMounted) setLedgerEntries(res.data?.data || []);
        } else if (activeTab === 'expenses') {
          const res = await apiClient.get('/finance/expenses');
          if (isMounted) setExpenses(res.data?.data || []);
        } else if (activeTab === 'banking') {
          const res = await apiClient.get('/finance/bank-accounts');
          if (isMounted) setBankAccounts(res.data?.data || []);
        } else if (activeTab === 'vendors') {
          const [vRes, bRes] = await Promise.all([
            apiClient.get('/finance/vendors'),
            apiClient.get('/finance/vendor-bills'),
          ]);
          if (isMounted) {
            setVendors(vRes.data?.data || []);
            setVendorBills(bRes.data?.data || []);
          }
        } else if (activeTab === 'payroll') {
          const [pRes, sRes] = await Promise.all([
            apiClient.get('/finance/payroll'),
            apiClient.get('/finance/fnf'),
          ]);
          if (isMounted) {
            setPayrolls(pRes.data?.data || []);
            setSettlements(sRes.data?.data || []);
          }
        } else if (activeTab === 'requests') {
          const res = await apiClient.get('/finance/payment-requests');
          if (isMounted) setPaymentRequests(res.data?.data || []);
        } else if (activeTab === 'ledger') {
          const res = await apiClient.get('/finance/ledger');
          if (isMounted) setLedgerEntries(res.data?.data || []);
        } else if (activeTab === 'reconciliation') {
          const res = await apiClient.get('/finance/reconciliation');
          if (isMounted) setReconciliations(res.data?.data || []);
        } else if (activeTab === 'audit') {
          const res = await apiClient.get('/finance/audit');
          if (isMounted) setAuditLogs(res.data?.data || []);
        } else if (activeTab === 'settings') {
          const res = await apiClient.get('/finance/settings');
          if (isMounted) setSettings(res.data?.data || null);
        }
      } catch (err) {
        console.error(`Error loading tab data for ${activeTab}:`, err);
      }
    };

    fetchTabData();
    return () => {
      isMounted = false;
    };
  }, [activeTab, refreshTrigger]);

  // Modal Handlers
  const openModal = (type, record = null) => {
    setActiveModal(type);
    setSelectedRecord(record);
    setModalError('');
    setModalLoading(false);

    if (type === 'payment') {
      setModalFormData({
        invoiceId: record?._id || '',
        amount: record ? record.balance || record.amount : '',
        paymentMethod: 'Bank Transfer',
        transactionReference: '',
        paymentDate: new Date().toISOString().slice(0, 10),
        bankAccountId: summaryData?.bankAccounts?.[0]?._id || '',
        notes: record ? `Payment for Invoice ${record.invoiceNumber}` : '',
      });
    } else if (type === 'invoice') {
      setModalFormData({
        clientName: '',
        amount: '',
        cgst: '',
        sgst: '',
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        description: '',
      });
    } else if (type === 'expense') {
      setModalFormData({
        title: '',
        category: 'Office Operations',
        categoryType: 'Office Expenses',
        department: 'Finance',
        amount: '',
        vendorName: '',
        paymentMethod: 'Bank Transfer',
        description: '',
        expenseDate: new Date().toISOString().slice(0, 10),
      });
    } else if (type === 'request') {
      setModalFormData({
        payeeName: '',
        paymentType: 'Vendor',
        amount: '',
        reason: '',
        priority: 'Medium',
        requiredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      });
    } else if (type === 'vendor') {
      setModalFormData({
        name: '',
        companyName: '',
        email: '',
        phone: '',
        category: 'Software & IT',
        gstin: '',
        pan: '',
        address: '',
      });
    } else if (type === 'bill') {
      setModalFormData({
        vendor: record?._id || '',
        billNumber: '',
        amount: '',
        tax: '',
        category: 'Software & IT',
        billDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        description: '',
      });
    } else if (type === 'recovery') {
      setModalFormData({
        status: record?.recovery?.status || 'In Progress',
        nextFollowUp: record?.recovery?.nextFollowUp ? record.recovery.nextFollowUp.slice(0, 10) : '',
        promiseToPayDate: record?.recovery?.promiseToPayDate ? record.recovery.promiseToPayDate.slice(0, 10) : '',
        note: '',
      });
    } else if (type === 'disburseSalary') {
      setModalFormData({
        payrollId: record?._id,
        amount: record?.net,
        paymentMethod: 'Bank Transfer',
        transactionReference: `SAL-${Date.now().toString().slice(-6)}`,
        bankAccountId: summaryData?.bankAccounts?.[0]?._id || '',
      });
    } else if (type === 'disburseFnf') {
      setModalFormData({
        settlementId: record?._id,
        amount: record?.netPayable,
        paymentMethod: 'Bank Transfer',
        transactionReference: `FNF-${Date.now().toString().slice(-6)}`,
        bankAccountId: summaryData?.bankAccounts?.[0]?._id || '',
      });
    } else if (type === 'bank') {
      setModalFormData({
        accountName: '',
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        branch: '',
        accountType: 'Current',
        openingBalance: '',
      });
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedRecord(null);
    setModalFormData({});
    setModalError('');
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');

    try {
      if (activeModal === 'payment') {
        await apiClient.post(`/finance/invoices/${selectedRecord._id}/payment`, modalFormData);
      } else if (activeModal === 'invoice') {
        await apiClient.post('/finance/invoices', modalFormData);
      } else if (activeModal === 'expense') {
        await apiClient.post('/finance/expenses', modalFormData);
      } else if (activeModal === 'request') {
        await apiClient.post('/finance/payment-requests', modalFormData);
      } else if (activeModal === 'vendor') {
        await apiClient.post('/finance/vendors', modalFormData);
      } else if (activeModal === 'bill') {
        await apiClient.post('/finance/vendor-bills', modalFormData);
      } else if (activeModal === 'recovery') {
        await apiClient.post(`/finance/recovery/${selectedRecord._id}/followup`, modalFormData);
      } else if (activeModal === 'disburseSalary') {
        await apiClient.post(`/finance/payroll/${selectedRecord._id}/pay`, modalFormData);
      } else if (activeModal === 'disburseFnf') {
        await apiClient.post(`/finance/fnf/${selectedRecord._id}/pay`, modalFormData);
      } else if (activeModal === 'bank') {
        await apiClient.post('/finance/bank-accounts', modalFormData);
      }

      closeModal();
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Action failed');
    } finally {
      setModalLoading(false);
    }
  };

  // Convert proposal action
  const handleConvertProposal = async (propId) => {
    if (!window.confirm('Convert this Proposal into an official Invoice?')) return;
    try {
      await apiClient.post(`/finance/proposals/${propId}/convert-to-invoice`);
      setRefreshTrigger((p) => p + 1);
      alert('Proposal successfully converted to Invoice!');
    } catch (err) {
      alert(err.response?.data?.message || 'Conversion failed');
    }
  };

  // Expense Actions
  const handleApproveExpense = async (id) => {
    try {
      await apiClient.post(`/finance/expenses/${id}/approve`);
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      alert(err.response?.data?.message || 'Approval failed');
    }
  };

  // Vendor Bill Actions
  const handleApproveBill = async (id) => {
    try {
      await apiClient.post(`/finance/vendor-bills/${id}/approve`);
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      alert(err.response?.data?.message || 'Bill approval failed');
    }
  };

  // Payment Request Actions
  const handleApproveRequest = async (id) => {
    try {
      await apiClient.post(`/finance/payment-requests/${id}/approve`);
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      alert(err.response?.data?.message || 'Approval failed');
    }
  };

  const handlePayRequest = async (id) => {
    const bankId = summaryData?.bankAccounts?.[0]?._id;
    if (!window.confirm('Disburse payment for this approved request now?')) return;
    try {
      await apiClient.post(`/finance/payment-requests/${id}/pay`, { bankAccountId: bankId });
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      alert(err.response?.data?.message || 'Payment failed');
    }
  };

  // Navigation tabs metadata
  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'clients', label: 'Client Financial Master', icon: '👥' },
    { id: 'proposals', label: 'Proposals / Quotations', icon: '📜' },
    { id: 'invoices', label: 'Invoices', icon: '📄', count: summaryData?.kpis?.pendingInvoicesCount },
    { id: 'recovery', label: 'Payment Recovery', icon: '⏳', count: summaryData?.kpis?.overdueInvoicesCount },
    { id: 'income', label: 'Income Management', icon: '💰' },
    { id: 'expenses', label: 'Expense Management', icon: '🧾' },
    { id: 'banking', label: 'Bank Accounts & Transactions', icon: '🏦' },
    { id: 'cashflow', label: 'Cash Flow', icon: '📈' },
    { id: 'vendors', label: 'Vendor Management', icon: '🏢' },
    { id: 'payroll', label: 'Payroll & F&F Integration', icon: '💼', count: summaryData?.kpis?.payrollPendingCount },
    { id: 'requests', label: 'Payment Requests', icon: '✍️', count: summaryData?.kpis?.paymentRequestsPendingCount },
    { id: 'ledger', label: 'General Ledger', icon: '📖' },
    { id: 'reconciliation', label: 'Bank Reconciliation', icon: '⚖️', count: summaryData?.kpis?.reconciliationPendingCount },
    { id: 'reports', label: 'Financial Reports', icon: '📑' },
    { id: 'audit', label: 'Audit History', icon: '🛡️' },
    { id: 'settings', label: 'Finance Configuration', icon: '⚙️' },
  ];

  const kpis = summaryData?.kpis || {};
  const trends = summaryData?.monthlyTrends || [];

  return (
    <UserLayout pageTitle="Finance Dashboard" pageSubtitle="Finance Control Center">
      <div className="finance-control-center">
        {/* Top Header Row */}
        <div className="fin-header-row">
          <div className="fin-title-group">
            <h2 className="fin-page-title">Finance Dashboard</h2>
            <div className="fin-page-subtitle">
              <span className="fin-subtitle-badge">Finance Control Center</span>
              <span className="fin-subtitle-text">Manage your complete financial lifecycle</span>
            </div>
          </div>

          <div className="fin-actions-group">
            {/* Search */}
            <div className="fin-header-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="fin-search-icon">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                placeholder="Search Finance records..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="fin-header-search-input"
              />
            </div>

            {/* Period selector */}
            <div className="fin-period-group">
              {[
                { key: 'today', label: 'Today' },
                { key: 'week', label: 'This Week' },
                { key: 'month', label: 'This Month' },
                { key: 'quarter', label: 'Quarter' },
                { key: 'year', label: 'FY 2026-27' },
              ].map((p) => (
                <button
                  key={p.key}
                  className={`fin-period-btn ${period === p.key ? 'active' : ''}`}
                  onClick={() => setPeriod(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* 4 Action Buttons */}
            <button className="fin-btn-secondary fin-action-btn" onClick={() => openModal('payment')}>
              + Record Payment
            </button>
            <button className="fin-btn-secondary fin-action-btn" onClick={() => openModal('expense')}>
              + Add Expense
            </button>
            <button className="fin-btn-secondary fin-action-btn" onClick={() => openModal('request')}>
              + New Payment Request
            </button>
            <button className="fin-btn-primary fin-action-btn" onClick={() => openModal('invoice')}>
              + Create Invoice
            </button>
          </div>
        </div>

        {/* Horizontal Navigation Tabs */}
        <div className="fin-tabs-bar">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`fin-tab-btn ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => handleTabChange(t.id)}
            >
              <span className="fin-tab-icon">{t.icon}</span>
              <span>{t.label}</span>
              {t.count > 0 && <span className="fin-tab-badge">{t.count}</span>}
            </button>
          ))}
        </div>

        {/* TAB CONTENT: 1. OVERVIEW (DASHBOARD) */}
        {activeTab === 'overview' && (
          <>
            {loading ? (
              <div className="fin-loading-box">Loading live financial calculations from MongoDB Atlas...</div>
            ) : (
              <>
                {/* 6 Primary KPI Cards */}
                <div className="fin-kpi-grid-6">
                  <div className="fin-kpi-card">
                    <div className="fin-kpi-top">
                      <span className="fin-kpi-label">Total Income</span>
                      <div className="fin-kpi-icon-wrap income">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                      </div>
                    </div>
                    <div className="fin-kpi-value">{formatCurrency(kpis.totalIncome)}</div>
                    <div className="fin-kpi-footer">Posted credits in period</div>
                  </div>

                  <div className="fin-kpi-card">
                    <div className="fin-kpi-top">
                      <span className="fin-kpi-label">Total Expense</span>
                      <div className="fin-kpi-icon-wrap expense">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                      </div>
                    </div>
                    <div className="fin-kpi-value">{formatCurrency(kpis.totalExpense)}</div>
                    <div className="fin-kpi-footer">Actual disbursed outflows</div>
                  </div>

                  <div className="fin-kpi-card">
                    <div className="fin-kpi-top">
                      <span className="fin-kpi-label">Net Cash Flow</span>
                      <div className="fin-kpi-icon-wrap cashflow">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                      </div>
                    </div>
                    <div
                      className="fin-kpi-value"
                      style={{ color: kpis.netCashFlow >= 0 ? '#10b981' : '#ef4444' }}
                    >
                      {formatCurrency(kpis.netCashFlow)}
                    </div>
                    <div className="fin-kpi-footer">Income minus Outflows</div>
                  </div>

                  <div className="fin-kpi-card">
                    <div className="fin-kpi-top">
                      <span className="fin-kpi-label">Receivables</span>
                      <div className="fin-kpi-icon-wrap receivable">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      </div>
                    </div>
                    <div className="fin-kpi-value">{formatCurrency(kpis.receivables)}</div>
                    <div className="fin-kpi-footer">{kpis.pendingInvoicesCount || 0} pending invoices</div>
                  </div>

                  <div className="fin-kpi-card">
                    <div className="fin-kpi-top">
                      <span className="fin-kpi-label">Payables</span>
                      <div className="fin-kpi-icon-wrap payable">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                      </div>
                    </div>
                    <div className="fin-kpi-value">{formatCurrency(kpis.payables)}</div>
                    <div className="fin-kpi-footer">Approved bills & expenses</div>
                  </div>

                  <div className="fin-kpi-card">
                    <div className="fin-kpi-top">
                      <span className="fin-kpi-label">Bank Balance</span>
                      <div className="fin-kpi-icon-wrap bank">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><line x1="3" y1="21" x2="21" y2="21"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="5 10 5 21"/><polyline points="19 10 19 21"/><polyline points="10 10 10 21"/><polyline points="14 10 14 21"/><polygon points="12 2 2 7 22 7 12 2"/></svg>
                      </div>
                    </div>
                    <div className="fin-kpi-value">{formatCurrency(kpis.bankBalance)}</div>
                    <div className="fin-kpi-footer">Opening + Credits - Debits</div>
                  </div>
                </div>

                {/* 8 Secondary Operational Metrics Strip */}
                <div className="fin-secondary-metrics">
                  <div className="fin-sec-card">
                    <span className="fin-sec-label">Pending Invoices</span>
                    <span className="fin-sec-val warning">{kpis.pendingInvoicesCount || 0}</span>
                  </div>
                  <div className="fin-sec-card">
                    <span className="fin-sec-label">Overdue Invoices</span>
                    <span className="fin-sec-val danger">{kpis.overdueInvoicesCount || 0}</span>
                  </div>
                  <div className="fin-sec-card">
                    <span className="fin-sec-label">Payments Received</span>
                    <span className="fin-sec-val success">{kpis.paymentsReceivedCount || 0}</span>
                  </div>
                  <div className="fin-sec-card">
                    <span className="fin-sec-label">Payments Pending</span>
                    <span className="fin-sec-val warning">{kpis.paymentsPendingCount || kpis.pendingInvoicesCount || 0}</span>
                  </div>
                  <div className="fin-sec-card">
                    <span className="fin-sec-label">Vendor Outstanding</span>
                    <span className="fin-sec-val">{formatCurrency(kpis.vendorOutstanding)}</span>
                  </div>
                  <div className="fin-sec-card">
                    <span className="fin-sec-label">Payroll Pending</span>
                    <span className="fin-sec-val warning">{kpis.payrollPendingCount || 0}</span>
                  </div>
                  <div className="fin-sec-card">
                    <span className="fin-sec-label">Payment Requests</span>
                    <span className="fin-sec-val">{kpis.paymentRequestsPendingCount || 0}</span>
                  </div>
                  <div className="fin-sec-card">
                    <span className="fin-sec-label">Reconciliation Pending</span>
                    <span className="fin-sec-val">{kpis.reconciliationPendingCount || 0}</span>
                  </div>
                </div>

                {/* Analytics Section: Left Chart, Right Receivables & Payables Aging */}
                <div className="fin-analytics-row">
                  {/* Left Chart Card */}
                  <div className="fin-chart-card">
                    <div className="fin-card-header">
                      <h3>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
                        Income vs Expense vs Net Cash Flow (Last 6 Months)
                      </h3>
                      <div className="fin-chart-legend">
                        <span><div className="fin-legend-dot income" /> Inflow (Income)</span>
                        <span><div className="fin-legend-dot expense" /> Outflow (Expense)</span>
                        <span><div className="fin-legend-dot net" /> Net Cash Flow</span>
                      </div>
                    </div>

                    <div className="fin-svg-chart-container">
                      <svg width="100%" height="100%" viewBox="0 0 900 220" preserveAspectRatio="none">
                        <line x1="40" y1="180" x2="880" y2="180" stroke="#e2e8f0" strokeWidth="1" />
                        <line x1="40" y1="110" x2="880" y2="110" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                        <line x1="40" y1="40" x2="880" y2="40" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />

                        {trends.map((t, idx) => {
                          const x = 90 + idx * 140;
                          const maxVal = Math.max(...trends.map((x) => Math.max(x.income, x.expense, 100000)));
                          const incH = Math.min(140, Math.max(6, (t.income / maxVal) * 140));
                          const expH = Math.min(140, Math.max(6, (t.expense / maxVal) * 140));
                          const netY = 180 - Math.min(140, Math.max(0, ((t.net + maxVal / 2) / (maxVal * 1.5)) * 140));

                          return (
                            <g key={t.month}>
                              {/* Inflow bar */}
                              <rect
                                x={x - 24}
                                y={180 - incH}
                                width="20"
                                height={incH}
                                fill="#10b981"
                                rx="3"
                                opacity="0.85"
                              />
                              {/* Outflow bar */}
                              <rect
                                x={x + 4}
                                y={180 - expH}
                                width="20"
                                height={expH}
                                fill="#ef4444"
                                rx="3"
                                opacity="0.85"
                              />
                              {/* Net Indicator Point */}
                              <circle cx={x} cy={netY} r="4" fill="#0284c7" stroke="#ffffff" strokeWidth="1.5" />
                              {/* Month label */}
                              <text
                                x={x}
                                y="205"
                                fill="#64748b"
                                fontSize="11"
                                textAnchor="middle"
                                fontWeight="600"
                              >
                                {t.month}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>

                  {/* Right Aging Column: Receivables Aging & Payables Aging */}
                  <div className="fin-aging-col">
                    {/* Receivables Aging */}
                    <div className="fin-card fin-aging-card">
                      <div className="fin-card-header">
                        <h3>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          Receivables Aging
                        </h3>
                        <span className="fin-card-tag orange">{formatCurrency(kpis.receivables)}</span>
                      </div>
                      <div className="fin-aging-list">
                        {Object.entries(summaryData?.aging?.receivables || {}).map(([bucket, val]) => {
                          const total = summaryData?.kpis?.receivables || 1;
                          const pct = Math.min(100, Math.round((val / total) * 100));
                          return (
                            <div key={bucket} className="fin-aging-row">
                              <div className="fin-aging-header">
                                <span>{bucket} Days</span>
                                <strong>{formatCurrency(val)} ({pct}%)</strong>
                              </div>
                              <div className="fin-progress-bar-bg">
                                <div className="fin-progress-bar-fill rec" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Payables Aging */}
                    <div className="fin-card fin-aging-card">
                      <div className="fin-card-header">
                        <h3>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                          Payables Aging
                        </h3>
                        <span className="fin-card-tag red">{formatCurrency(kpis.payables)}</span>
                      </div>
                      <div className="fin-aging-list">
                        {Object.entries(summaryData?.aging?.payables || {}).map(([bucket, val]) => {
                          const total = summaryData?.kpis?.payables || 1;
                          const pct = Math.min(100, Math.round((val / total) * 100));
                          return (
                            <div key={bucket} className="fin-aging-row">
                              <div className="fin-aging-header">
                                <span>{bucket} Days</span>
                                <strong>{formatCurrency(val)} ({pct}%)</strong>
                              </div>
                              <div className="fin-progress-bar-bg">
                                <div className="fin-progress-bar-fill exp" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lower Dashboard Grid Tier 1: 4 Cards (Cash Flow, Bank Accounts, Pending Invoices, Payment Recovery) */}
                <div className="fin-lower-grid-4col">
                  {/* 1. Cash Flow */}
                  <div className="fin-card">
                    <div className="fin-card-header">
                      <h3>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        Cash Flow
                      </h3>
                      <button className="fin-btn-secondary fin-btn-sm" onClick={() => handleTabChange('cashflow')}>
                        Details
                      </button>
                    </div>
                    <table className="fin-compact-table">
                      <tbody>
                        <tr>
                          <td>Opening Liquid Cash</td>
                          <td className="text-right font-medium">
                            {formatCurrency(summaryData?.cashFlow?.forecast?.openingCash)}
                          </td>
                        </tr>
                        <tr>
                          <td>Expected Inflows</td>
                          <td className="text-right font-medium text-success">
                            + {formatCurrency(summaryData?.cashFlow?.forecast?.expectedInflows)}
                          </td>
                        </tr>
                        <tr>
                          <td>Expected Outflows</td>
                          <td className="text-right font-medium text-danger">
                            - {formatCurrency(summaryData?.cashFlow?.forecast?.expectedOutflows)}
                          </td>
                        </tr>
                        <tr className="bg-highlight">
                          <td><strong>Projected Closing</strong></td>
                          <td className="text-right font-bold">
                            {formatCurrency(summaryData?.cashFlow?.forecast?.projectedClosingCash)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 2. Bank Accounts */}
                  <div className="fin-card">
                    <div className="fin-card-header">
                      <h3>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><line x1="3" y1="21" x2="21" y2="21"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="5 10 5 21"/><polyline points="19 10 19 21"/><polyline points="10 10 10 21"/><polyline points="14 10 14 21"/><polygon points="12 2 2 7 22 7 12 2"/></svg>
                        Bank Accounts
                      </h3>
                      <button className="fin-btn-secondary fin-btn-sm" onClick={() => handleTabChange('banking')}>
                        View All
                      </button>
                    </div>
                    <table className="fin-compact-table">
                      <thead>
                        <tr>
                          <th>Account</th>
                          <th>Bank</th>
                          <th className="text-right">Balance</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(summaryData?.bankAccounts || []).slice(0, 4).map((acc) => (
                          <tr key={acc._id}>
                            <td className="font-medium">{acc.accountName}</td>
                            <td className="text-muted">{acc.bankName}</td>
                            <td className="text-right font-bold">{formatCurrency(acc.currentBalance)}</td>
                            <td>
                              <span className={`fin-badge ${String(acc.reconciliationStatus).toLowerCase()}`}>
                                {acc.reconciliationStatus || 'Active'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 3. Pending Invoices */}
                  <div className="fin-card">
                    <div className="fin-card-header">
                      <h3>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                        Pending Invoices
                      </h3>
                      <button className="fin-btn-secondary fin-btn-sm" onClick={() => handleTabChange('invoices')}>
                        View All
                      </button>
                    </div>
                    <table className="fin-compact-table">
                      <thead>
                        <tr>
                          <th>Invoice No.</th>
                          <th>Client</th>
                          <th className="text-right">Amount</th>
                          <th>Due Date</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(summaryData?.pendingInvoices || []).length === 0 ? (
                          <tr><td colSpan="5" className="text-center text-muted">No pending invoices</td></tr>
                        ) : (
                          summaryData.pendingInvoices.slice(0, 4).map((inv) => (
                            <tr key={inv._id}>
                              <td className="font-mono text-primary font-semibold">{inv.invoiceNumber}</td>
                              <td>{inv.clientName}</td>
                              <td className="text-right font-semibold">{formatCurrency(inv.amount)}</td>
                              <td className="text-muted">{formatDate(inv.dueDate)}</td>
                              <td>
                                <span className={`fin-badge ${String(inv.status).toLowerCase().replace(/\s+/g, '-')}`}>
                                  {inv.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 4. Payment Recovery */}
                  <div className="fin-card">
                    <div className="fin-card-header">
                      <h3>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Payment Recovery
                      </h3>
                      <button className="fin-btn-secondary fin-btn-sm" onClick={() => handleTabChange('recovery')}>
                        Manage
                      </button>
                    </div>
                    <table className="fin-compact-table">
                      <thead>
                        <tr>
                          <th>Client</th>
                          <th className="text-right">Amount Due</th>
                          <th>Last Follow-up</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(summaryData?.paymentRecovery || []).length === 0 ? (
                          <tr><td colSpan="4" className="text-center text-muted">No recovery items pending</td></tr>
                        ) : (
                          summaryData.paymentRecovery.slice(0, 4).map((rec) => (
                            <tr key={rec._id}>
                              <td className="font-medium">{rec.clientName}</td>
                              <td className="text-right font-bold text-danger">{formatCurrency(rec.amountDue)}</td>
                              <td className="text-muted">{formatDate(rec.lastFollowUp)}</td>
                              <td>
                                <span className={`fin-badge ${String(rec.status).toLowerCase().replace(/\s+/g, '-')}`}>
                                  {rec.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Lower Dashboard Grid Tier 2: 5 Summary Tiles */}
                <div className="fin-lower-grid-5col">
                  {/* Payment Requests */}
                  <div className="fin-card fin-summary-tile">
                    <div className="fin-card-header">
                      <h4>Payment Requests</h4>
                      <button className="fin-link-btn" onClick={() => handleTabChange('requests')}>Open →</button>
                    </div>
                    <div className="fin-tile-metric">
                      <span className="fin-tile-count">{summaryData?.kpis?.paymentRequestsPendingCount || 0}</span>
                      <span className="fin-tile-sub">Pending Approval</span>
                    </div>
                    <div className="fin-tile-amount">
                      {formatCurrency(summaryData?.kpis?.paymentRequestsPendingAmount || 0)}
                    </div>
                  </div>

                  {/* Payroll Summary */}
                  <div className="fin-card fin-summary-tile">
                    <div className="fin-card-header">
                      <h4>Payroll Summary</h4>
                      <button className="fin-link-btn" onClick={() => handleTabChange('payroll')}>Open →</button>
                    </div>
                    <div className="fin-tile-metric">
                      <span className="fin-tile-count warning">{summaryData?.kpis?.payrollPendingCount || 0}</span>
                      <span className="fin-tile-sub">Pending Disbursal</span>
                    </div>
                    <div className="fin-tile-amount">
                      {formatCurrency(summaryData?.kpis?.payrollPendingAmount || 0)}
                    </div>
                  </div>

                  {/* Vendor Summary */}
                  <div className="fin-card fin-summary-tile">
                    <div className="fin-card-header">
                      <h4>Vendor Summary</h4>
                      <button className="fin-link-btn" onClick={() => handleTabChange('vendors')}>Open →</button>
                    </div>
                    <div className="fin-tile-metric">
                      <span className="fin-tile-count">{summaryData?.vendorSummary?.totalVendors || 0}</span>
                      <span className="fin-tile-sub">{summaryData?.vendorSummary?.activeVendors || 0} Active</span>
                    </div>
                    <div className="fin-tile-amount">
                      Due: {formatCurrency(summaryData?.vendorSummary?.vendorOutstanding || 0)}
                    </div>
                  </div>

                  {/* Expense Summary */}
                  <div className="fin-card fin-summary-tile">
                    <div className="fin-card-header">
                      <h4>Expense Summary</h4>
                      <button className="fin-link-btn" onClick={() => handleTabChange('expenses')}>Open →</button>
                    </div>
                    <div className="fin-expense-breakdown-mini">
                      <div className="fin-exp-line">
                        <span>Office</span>
                        <strong>{formatCurrency(summaryData?.expenseSummary?.['Office Expenses'] || 0)}</strong>
                      </div>
                      <div className="fin-exp-line">
                        <span>Client</span>
                        <strong>{formatCurrency(summaryData?.expenseSummary?.['Client Expenses'] || 0)}</strong>
                      </div>
                      <div className="fin-exp-line">
                        <span>Project</span>
                        <strong>{formatCurrency(summaryData?.expenseSummary?.['Project Expenses'] || 0)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Reconciliation Summary */}
                  <div className="fin-card fin-summary-tile">
                    <div className="fin-card-header">
                      <h4>Reconciliation</h4>
                      <button className="fin-link-btn" onClick={() => handleTabChange('reconciliation')}>Open →</button>
                    </div>
                    <div className="fin-tile-metric">
                      <span className="fin-tile-count">{summaryData?.reconciliationSummary?.pendingCount || 0}</span>
                      <span className="fin-tile-sub">Statements Pending</span>
                    </div>
                    <div className="fin-tile-badge-wrap">
                      <span className={`fin-badge ${summaryData?.reconciliationSummary?.pendingCount > 0 ? 'warning' : 'completed'}`}>
                        {summaryData?.reconciliationSummary?.status || 'Up to Date'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lower Dashboard Grid Tier 3: Critical Alerts */}
                <div className="fin-card fin-critical-alerts-card">
                  <div className="fin-card-header">
                    <h3>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                      Critical Financial Alerts
                    </h3>
                    <span className="fin-alert-counter">{(summaryData?.alerts || []).length} Alerts</span>
                  </div>
                  <div className="fin-alerts-grid">
                    {(summaryData?.alerts || []).length === 0 ? (
                      <div className="fin-alerts-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        <span>All systems healthy. No critical financial alerts or pending discrepancies.</span>
                      </div>
                    ) : (
                      summaryData.alerts.map((alt) => (
                        <div key={alt.id} className={`fin-alert-card ${alt.type}`}>
                          <div className="fin-alert-body">
                            <div className="fin-alert-title-row">
                              <span className={`fin-alert-indicator ${alt.type}`} />
                              <strong>{alt.title}</strong>
                            </div>
                            <p className="fin-alert-msg">{alt.message}</p>
                          </div>
                          {alt.actionTab && (
                            <button
                              className="fin-btn-secondary fin-btn-sm fin-alert-action-btn"
                              onClick={() => handleTabChange(alt.actionTab)}
                            >
                              Resolve →
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* TAB CONTENT: 2. CLIENT FINANCIAL MASTER */}
        {activeTab === 'clients' && (
          <div className="fin-table-container">
            <div className="fin-table-toolbar">
              <input
                type="text"
                placeholder="Search Client or Company..."
                className="fin-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Showing {clients.length} registered clients
              </span>
            </div>
            <table className="fin-data-table">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Company</th>
                  <th>Contact</th>
                  <th>Projects</th>
                  <th>Total Billed</th>
                  <th>Total Received</th>
                  <th>Outstanding</th>
                  <th>Last Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {clients
                  .filter(
                    (c) =>
                      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      c.company?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((c) => (
                    <tr key={c._id}>
                      <td><strong>{c.name}</strong></td>
                      <td>{c.company || '—'}</td>
                      <td>
                        <small>{c.phone || c.email || '—'}</small>
                      </td>
                      <td>{c.activeProjectsCount} Active</td>
                      <td>{formatCurrency(c.totalBilled)}</td>
                      <td style={{ color: '#16a34a' }}>{formatCurrency(c.totalReceived)}</td>
                      <td style={{ color: c.outstanding > 0 ? '#ea580c' : '#475569', fontWeight: 600 }}>
                        {formatCurrency(c.outstanding)}
                      </td>
                      <td>
                        {c.lastPayment ? (
                          <small>
                            {formatCurrency(c.lastPayment.amount)} on {formatDate(c.lastPayment.date)}
                          </small>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <span className={`fin-badge ${c.financialStatus.toLowerCase()}`}>
                          {c.financialStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB CONTENT: 3. PROPOSALS / QUOTATIONS */}
        {activeTab === 'proposals' && (
          <div className="fin-table-container">
            <div className="fin-table-toolbar">
              <input
                type="text"
                placeholder="Search Proposals..."
                className="fin-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button className="fin-btn-primary fin-btn-sm" onClick={() => openModal('invoice')}>
                + New Proposal / Quotation
              </button>
            </div>
            <table className="fin-data-table">
              <thead>
                <tr>
                  <th>Proposal #</th>
                  <th>Client</th>
                  <th>Items</th>
                  <th>Subtotal</th>
                  <th>Tax</th>
                  <th>Total</th>
                  <th>Valid Until</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {proposals.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      No proposals found in database.
                    </td>
                  </tr>
                ) : (
                  proposals.map((p) => (
                    <tr key={p._id}>
                      <td><strong>{p.proposalNumber}</strong></td>
                      <td>{p.clientName}</td>
                      <td>{p.items?.length || 0} line items</td>
                      <td>{formatCurrency(p.subtotal)}</td>
                      <td>{formatCurrency(p.tax)}</td>
                      <td><strong>{formatCurrency(p.total)}</strong></td>
                      <td>{formatDate(p.validUntil)}</td>
                      <td>
                        <span className={`fin-badge ${String(p.status).toLowerCase().replace(/\s+/g, '-')}`}>
                          {p.status}
                        </span>
                      </td>
                      <td>
                        {p.status !== 'Converted to Invoice' && (
                          <button
                            className="fin-action-btn pay"
                            onClick={() => handleConvertProposal(p._id)}
                          >
                            Convert to Invoice
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB CONTENT: 4. INVOICES */}
        {activeTab === 'invoices' && (
          <div className="fin-table-container">
            <div className="fin-table-toolbar">
              <input
                type="text"
                placeholder="Search Invoice #, Client..."
                className="fin-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className="fin-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
              </select>
              <button className="fin-btn-primary fin-btn-sm" onClick={() => openModal('invoice')}>
                + Create Invoice
              </button>
            </div>
            <table className="fin-data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Total Amount</th>
                  <th>Paid</th>
                  <th>Balance Due</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices
                  .filter((inv) => {
                    const matchSearch =
                      inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      inv.clientName?.toLowerCase().includes(searchTerm.toLowerCase());
                    const matchStatus = statusFilter === 'All' || inv.status === statusFilter;
                    return matchSearch && matchStatus;
                  })
                  .map((inv) => {
                    const total = (Number(inv.amount) || 0) + (Number(inv.cgst) || 0) + (Number(inv.sgst) || 0);
                    const bal = inv.balance !== undefined ? inv.balance : Math.max(0, total - (inv.paidAmount || 0));

                    return (
                      <tr key={inv._id}>
                        <td><strong>{inv.invoiceNumber}</strong></td>
                        <td>{inv.clientName}</td>
                        <td>{formatDate(inv.issueDate)}</td>
                        <td>{formatDate(inv.dueDate)}</td>
                        <td>{formatCurrency(total)}</td>
                        <td style={{ color: '#16a34a' }}>{formatCurrency(inv.paidAmount)}</td>
                        <td style={{ color: bal > 0 ? '#ea580c' : '#475569', fontWeight: 600 }}>
                          {formatCurrency(bal)}
                        </td>
                        <td>
                          <span className={`fin-badge ${String(inv.status).toLowerCase().replace(/\s+/g, '-')}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td>
                          <div className="fin-row-actions">
                            {bal > 0 && (
                              <button
                                className="fin-action-btn pay"
                                onClick={() => openModal('payment', inv)}
                              >
                                Record Payment
                              </button>
                            )}
                            <button
                              className="fin-action-btn"
                              onClick={() => openModal('recovery', inv)}
                            >
                              Follow-up
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB CONTENT: 5. PAYMENT RECOVERY */}
        {activeTab === 'recovery' && (
          <div className="fin-table-container">
            <div className="fin-table-toolbar">
              <input
                type="text"
                placeholder="Search Recovery Cases..."
                className="fin-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span style={{ fontSize: '0.8rem', color: '#ea580c', fontWeight: 600 }}>
                {recoveryInvoices.length} Unpaid / Overdue Invoices Requiring Follow-up
              </span>
            </div>
            <table className="fin-data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Amount Due</th>
                  <th>Due Date</th>
                  <th>Recovery Status</th>
                  <th>Last Follow-up</th>
                  <th>Next Follow-up</th>
                  <th>Promise to Pay</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recoveryInvoices.map((inv) => (
                  <tr key={inv._id}>
                    <td><strong>{inv.invoiceNumber}</strong></td>
                    <td>{inv.clientName}</td>
                    <td style={{ color: '#dc2626', fontWeight: 700 }}>
                      {formatCurrency(inv.balance)}
                    </td>
                    <td>{formatDate(inv.dueDate)}</td>
                    <td>
                      <span className={`fin-badge ${String(inv.recovery?.status || 'Not Started').toLowerCase().replace(/\s+/g, '-')}`}>
                        {inv.recovery?.status || 'Not Started'}
                      </span>
                    </td>
                    <td>{formatDate(inv.recovery?.lastFollowUp)}</td>
                    <td>{formatDate(inv.recovery?.nextFollowUp)}</td>
                    <td>{formatDate(inv.recovery?.promiseToPayDate)}</td>
                    <td>
                      <button className="fin-action-btn pay" onClick={() => openModal('recovery', inv)}>
                        Log Follow-up
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB CONTENT: 6. EXPENSES */}
        {activeTab === 'expenses' && (
          <div className="fin-table-container">
            <div className="fin-table-toolbar">
              <input
                type="text"
                placeholder="Search Expenses..."
                className="fin-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className="fin-filter-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="All">All Categories</option>
                <option value="Office Expenses">Office Expenses</option>
                <option value="Project Expenses">Project Expenses</option>
                <option value="Client Expenses">Client Expenses</option>
              </select>
              <button className="fin-btn-primary fin-btn-sm" onClick={() => openModal('expense')}>
                + Add Expense
              </button>
            </div>
            <table className="fin-data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Vendor / Payee</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses
                  .filter((e) => categoryFilter === 'All' || e.categoryType === categoryFilter)
                  .map((e) => (
                    <tr key={e._id}>
                      <td><strong>{e.title}</strong></td>
                      <td>{e.category}</td>
                      <td><small>{e.categoryType || 'Office Expenses'}</small></td>
                      <td><strong>{formatCurrency(e.amount)}</strong></td>
                      <td>{formatDate(e.expenseDate)}</td>
                      <td>{e.vendorName || e.employeeName || '—'}</td>
                      <td>
                        <span className={`fin-badge ${String(e.paymentStatus).toLowerCase()}`}>
                          {e.paymentStatus}
                        </span>
                      </td>
                      <td>
                        <div className="fin-row-actions">
                          {e.paymentStatus === 'Pending' && (
                            <button
                              className="fin-action-btn approve"
                              onClick={() => handleApproveExpense(e._id)}
                            >
                              Approve
                            </button>
                          )}
                          {e.paymentStatus === 'Approved' && (
                            <button
                              className="fin-action-btn pay"
                              onClick={() => {
                                const bankId = summaryData?.bankAccounts?.[0]?._id;
                                if (window.confirm(`Disburse payment of ${formatCurrency(e.amount)} now?`)) {
                                  apiClient.post(`/finance/expenses/${e._id}/pay`, { bankAccountId: bankId }).then(() => setRefreshTrigger(p => p + 1));
                                }
                              }}
                            >
                              Disburse Payment
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB CONTENT: 7. BANK ACCOUNTS & TRANSACTIONS */}
        {activeTab === 'banking' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3>Company Bank Accounts & Vaults</h3>
              <button className="fin-btn-primary fin-btn-sm" onClick={() => openModal('bank')}>
                + Add Bank Account
              </button>
            </div>

            <div className="fin-kpi-grid-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {bankAccounts.map((acc) => (
                <div key={acc._id} className="fin-kpi-card">
                  <div className="fin-kpi-top">
                    <span className="fin-kpi-label">{acc.accountType} Account</span>
                    <div className="fin-kpi-icon-wrap bank">🏦</div>
                  </div>
                  <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>
                    {acc.bankName} - {acc.accountName}
                  </strong>
                  <small style={{ color: '#64748b', margin: '0.25rem 0' }}>
                    A/C: {acc.maskedAccountNumber || acc.accountNumber} | IFSC: {acc.ifscCode}
                  </small>
                  <div className="fin-kpi-value" style={{ marginTop: '0.5rem' }}>
                    {formatCurrency(acc.currentBalance)}
                  </div>
                  <div className="fin-kpi-footer" style={{ justifyContent: 'space-between' }}>
                    <span>Opening: {formatCurrency(acc.openingBalance)}</span>
                    <span className={`fin-badge ${String(acc.reconciliationStatus).toLowerCase()}`}>
                      {acc.reconciliationStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB CONTENT: 8. VENDORS & BILLS */}
        {activeTab === 'vendors' && (
          <div>
            <div className="fin-table-container" style={{ marginBottom: '2rem' }}>
              <div className="fin-table-toolbar">
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Vendor Bills & Payables</span>
                <button className="fin-btn-primary fin-btn-sm" onClick={() => openModal('bill')}>
                  + Add Vendor Bill
                </button>
              </div>
              <table className="fin-data-table">
                <thead>
                  <tr>
                    <th>Bill #</th>
                    <th>Vendor</th>
                    <th>Date</th>
                    <th>Due Date</th>
                    <th>Total Bill</th>
                    <th>Paid</th>
                    <th>Outstanding</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorBills.map((b) => (
                    <tr key={b._id}>
                      <td><strong>{b.billNumber}</strong></td>
                      <td>{b.vendorName}</td>
                      <td>{formatDate(b.billDate)}</td>
                      <td>{formatDate(b.dueDate)}</td>
                      <td>{formatCurrency(b.totalAmount)}</td>
                      <td style={{ color: '#16a34a' }}>{formatCurrency(b.paidAmount)}</td>
                      <td style={{ color: b.balance > 0 ? '#dc2626' : '#475569', fontWeight: 600 }}>
                        {formatCurrency(b.balance)}
                      </td>
                      <td>
                        <span className={`fin-badge ${String(b.status).toLowerCase().replace(/\s+/g, '-')}`}>
                          {b.status}
                        </span>
                      </td>
                      <td>
                        <div className="fin-row-actions">
                          {b.approvalStatus === 'Pending' && (
                            <button
                              className="fin-action-btn approve"
                              onClick={() => handleApproveBill(b._id)}
                            >
                              Approve Bill
                            </button>
                          )}
                          {b.approvalStatus === 'Approved' && b.balance > 0 && (
                            <button
                              className="fin-action-btn pay"
                              onClick={() => {
                                const bankId = summaryData?.bankAccounts?.[0]?._id;
                                if (window.confirm(`Disburse payment of ${formatCurrency(b.balance)} for bill ${b.billNumber}?`)) {
                                  apiClient.post(`/finance/vendor-bills/${b._id}/pay`, { bankAccountId: bankId }).then(() => setRefreshTrigger(p => p + 1));
                                }
                              }}
                            >
                              Pay Bill
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="fin-table-container">
              <div className="fin-table-toolbar">
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Vendor Master Directory</span>
                <button className="fin-btn-secondary fin-btn-sm" onClick={() => openModal('vendor')}>
                  + Register Vendor
                </button>
              </div>
              <table className="fin-data-table">
                <thead>
                  <tr>
                    <th>Company Name</th>
                    <th>Contact Person</th>
                    <th>Category</th>
                    <th>GSTIN / PAN</th>
                    <th>Total Billed</th>
                    <th>Total Paid</th>
                    <th>Outstanding</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => (
                    <tr key={v._id}>
                      <td><strong>{v.companyName}</strong></td>
                      <td>{v.name} ({v.phone || v.email || '—'})</td>
                      <td>{v.category}</td>
                      <td><small>{v.gstin || v.pan || '—'}</small></td>
                      <td>{formatCurrency(v.totalBilled)}</td>
                      <td style={{ color: '#16a34a' }}>{formatCurrency(v.totalPaid)}</td>
                      <td style={{ color: v.outstanding > 0 ? '#ea580c' : '#475569', fontWeight: 600 }}>
                        {formatCurrency(v.outstanding)}
                      </td>
                      <td>
                        <span className={`fin-badge ${String(v.status).toLowerCase()}`}>{v.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB CONTENT: 9. PAYROLL & F&F INTEGRATION */}
        {activeTab === 'payroll' && (
          <div>
            <div className="fin-table-container" style={{ marginBottom: '2rem' }}>
              <div className="fin-table-toolbar">
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>HR Employee Payroll Slips (Live Disbursal)</span>
              </div>
              <table className="fin-data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Period</th>
                    <th>Gross Salary</th>
                    <th>Deductions</th>
                    <th>Net Payable</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payrolls.map((p) => {
                    const emp = p.user ? `${p.user.firstName || ''} ${p.user.lastName || ''}`.trim() : 'Employee';
                    return (
                      <tr key={p._id}>
                        <td><strong>{emp}</strong></td>
                        <td>{p.payPeriod}</td>
                        <td>{formatCurrency(p.gross)}</td>
                        <td style={{ color: '#dc2626' }}>{formatCurrency(p.totalDeduction)}</td>
                        <td><strong style={{ color: '#0f172a' }}>{formatCurrency(p.net)}</strong></td>
                        <td>
                          <span className={`fin-badge ${String(p.status).toLowerCase()}`}>{p.status}</span>
                        </td>
                        <td>
                          {p.status !== 'Paid' ? (
                            <button
                              className="fin-action-btn pay"
                              onClick={() => openModal('disburseSalary', p)}
                            >
                              Disburse Salary
                            </button>
                          ) : (
                            <small style={{ color: '#16a34a' }}>✓ Disbursed on {formatDate(p.paymentDate)}</small>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="fin-table-container">
              <div className="fin-table-toolbar">
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Full & Final Settlement Disbursals</span>
              </div>
              <table className="fin-data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Gross Earnings</th>
                    <th>Total Deductions</th>
                    <th>Net Settlement</th>
                    <th>Payment Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((s) => {
                    const emp = s.employeeSnapshot?.name || (s.user ? `${s.user.firstName || ''} ${s.user.lastName || ''}` : 'Employee');
                    const isPaid = s.payment?.paymentStatus === 'Paid';
                    return (
                      <tr key={s._id}>
                        <td><strong>{emp}</strong></td>
                        <td>{formatCurrency(s.grossEarnings)}</td>
                        <td style={{ color: '#dc2626' }}>{formatCurrency(s.totalDeductions)}</td>
                        <td><strong>{formatCurrency(s.netPayable)}</strong></td>
                        <td>
                          <span className={`fin-badge ${isPaid ? 'paid' : 'pending'}`}>
                            {s.payment?.paymentStatus || 'Pending'}
                          </span>
                        </td>
                        <td>
                          {!isPaid ? (
                            <button
                              className="fin-action-btn pay"
                              onClick={() => openModal('disburseFnf', s)}
                            >
                              Disburse Settlement
                            </button>
                          ) : (
                            <small style={{ color: '#16a34a' }}>✓ Settled</small>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB CONTENT: 10. PAYMENT REQUESTS */}
        {activeTab === 'requests' && (
          <div className="fin-table-container">
            <div className="fin-table-toolbar">
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Payment Requests & Approvals</span>
              <button className="fin-btn-primary fin-btn-sm" onClick={() => openModal('request')}>
                + New Payment Request
              </button>
            </div>
            <table className="fin-data-table">
              <thead>
                <tr>
                  <th>Request #</th>
                  <th>Payee</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Priority</th>
                  <th>Required Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paymentRequests.map((r) => (
                  <tr key={r._id}>
                    <td><strong>{r.requestNumber}</strong></td>
                    <td>{r.payeeName}</td>
                    <td>{r.paymentType}</td>
                    <td><strong>{formatCurrency(r.amount)}</strong></td>
                    <td>
                      <span className={`fin-badge ${r.priority.toLowerCase()}`}>{r.priority}</span>
                    </td>
                    <td>{formatDate(r.requiredDate)}</td>
                    <td>
                      <span className={`fin-badge ${r.status.toLowerCase()}`}>{r.status}</span>
                    </td>
                    <td>
                      <div className="fin-row-actions">
                        {r.status === 'Submitted' && (
                          <button className="fin-action-btn approve" onClick={() => handleApproveRequest(r._id)}>
                            Approve
                          </button>
                        )}
                        {r.status === 'Approved' && (
                          <button className="fin-action-btn pay" onClick={() => handlePayRequest(r._id)}>
                            Disburse
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB CONTENT: 11. GENERAL LEDGER */}
        {(activeTab === 'ledger' || activeTab === 'income') && (
          <div className="fin-table-container">
            <div className="fin-table-toolbar">
              <input
                type="text"
                placeholder="Search Ledger Transactions..."
                className="fin-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Total Transactions: {ledgerEntries.length}
              </span>
            </div>
            <table className="fin-data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Tx #</th>
                  <th>Account</th>
                  <th>Category</th>
                  <th>Party</th>
                  <th>Reference</th>
                  <th>Debit (Dr)</th>
                  <th>Credit (Cr)</th>
                  <th>Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.map((t) => (
                  <tr key={t._id}>
                    <td>{formatDate(t.date)}</td>
                    <td><strong>{t.paymentNumber}</strong></td>
                    <td><small>{t.accountName}</small></td>
                    <td>{t.category}</td>
                    <td>{t.party}</td>
                    <td><small>{t.reference || '—'}</small></td>
                    <td style={{ color: t.debit > 0 ? '#dc2626' : '#64748b' }}>
                      {t.debit > 0 ? formatCurrency(t.debit) : '—'}
                    </td>
                    <td style={{ color: t.credit > 0 ? '#16a34a' : '#64748b', fontWeight: 600 }}>
                      {t.credit > 0 ? formatCurrency(t.credit) : '—'}
                    </td>
                    <td><strong>{formatCurrency(t.runningBalance)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB CONTENT: 12. AUDIT HISTORY */}
        {activeTab === 'audit' && (
          <div className="fin-table-container">
            <div className="fin-table-toolbar">
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Financial Immutable Audit Log</span>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Showing {auditLogs.length} audit records</span>
            </div>
            <table className="fin-data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Performed By</th>
                  <th>Reason / Notes</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((a) => (
                  <tr key={a._id}>
                    <td><small>{new Date(a.timestamp).toLocaleString('en-IN')}</small></td>
                    <td><strong>{a.action}</strong></td>
                    <td><span className="fin-badge">{a.entityType}</span></td>
                    <td>{a.reference || '—'}</td>
                    <td>{a.amount ? formatCurrency(a.amount) : '—'}</td>
                    <td>{a.performedByName}</td>
                    <td><small>{a.reason || '—'}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB CONTENT: 13. CONFIGURATION */}
        {activeTab === 'settings' && settings && (
          <div className="fin-card" style={{ maxWidth: '600px' }}>
            <div className="fin-card-header">
              <h3>
                <span>⚙️</span> Finance Rules & Approval Thresholds
              </h3>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await apiClient.put('/finance/settings', settings);
                  alert('Finance settings successfully updated in MongoDB Atlas!');
                } catch (err) {
                  alert('Failed to update settings');
                }
              }}
            >
              <div className="fin-form-group">
                <label>Single Payment Approval Threshold (₹)</label>
                <input
                  type="number"
                  value={settings.approvalThreshold}
                  onChange={(e) => setSettings({ ...settings, approvalThreshold: Number(e.target.value) })}
                />
                <small style={{ color: '#64748b' }}>Amounts above this require SuperAdmin approval.</small>
              </div>

              <div className="fin-form-group">
                <label>Default Payment Terms (Days)</label>
                <input
                  type="number"
                  value={settings.defaultPaymentTerms}
                  onChange={(e) => setSettings({ ...settings, defaultPaymentTerms: Number(e.target.value) })}
                />
              </div>

              <div className="fin-form-group">
                <label>Default GST / Tax Rate (%)</label>
                <input
                  type="number"
                  value={settings.defaultTaxRate}
                  onChange={(e) => setSettings({ ...settings, defaultTaxRate: Number(e.target.value) })}
                />
              </div>

              <button type="submit" className="fin-btn-primary" style={{ marginTop: '1rem' }}>
                Save Configuration
              </button>
            </form>
          </div>
        )}

        {/* MODAL DIALOGS */}
        {activeModal && (
          <div className="fin-modal-overlay">
            <div className="fin-modal-box">
              <div className="fin-modal-header">
                <h3>
                  {activeModal === 'payment' && 'Record Client Payment'}
                  {activeModal === 'invoice' && 'Create Official Client Invoice'}
                  {activeModal === 'expense' && 'Record Company Expense'}
                  {activeModal === 'request' && 'Submit Payment Request'}
                  {activeModal === 'vendor' && 'Register New Vendor'}
                  {activeModal === 'bill' && 'Create Vendor Bill'}
                  {activeModal === 'recovery' && 'Log Payment Recovery Follow-up'}
                  {activeModal === 'disburseSalary' && 'Disburse Employee Salary'}
                  {activeModal === 'disburseFnf' && 'Disburse Full & Final Settlement'}
                  {activeModal === 'bank' && 'Add Company Bank Account'}
                </h3>
                <button className="fin-modal-close-btn" onClick={closeModal}>
                  ✕
                </button>
              </div>

              <form onSubmit={handleModalSubmit}>
                <div className="fin-modal-body">
                  {modalError && (
                    <div className="fin-alert-item danger" style={{ marginBottom: '1rem' }}>
                      {modalError}
                    </div>
                  )}

                  {/* 1. Record Payment Modal */}
                  {activeModal === 'payment' && (
                    <div className="fin-form-grid-2">
                      <div className="fin-form-group col-span-2">
                        <label>Amount Received (₹)*</label>
                        <input
                          type="number"
                          required
                          value={modalFormData.amount}
                          onChange={(e) => setModalFormData({ ...modalFormData, amount: e.target.value })}
                        />
                      </div>
                      <div className="fin-form-group">
                        <label>Payment Method*</label>
                        <select
                          value={modalFormData.paymentMethod}
                          onChange={(e) => setModalFormData({ ...modalFormData, paymentMethod: e.target.value })}
                        >
                          <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                          <option value="UPI">UPI / QR Code</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Cash">Cash</option>
                        </select>
                      </div>
                      <div className="fin-form-group">
                        <label>Transaction Reference / UTR</label>
                        <input
                          type="text"
                          value={modalFormData.transactionReference}
                          placeholder="e.g. UTR-98247192"
                          onChange={(e) => setModalFormData({ ...modalFormData, transactionReference: e.target.value })}
                        />
                      </div>
                      <div className="fin-form-group">
                        <label>Credit to Bank Account*</label>
                        <select
                          value={modalFormData.bankAccountId}
                          onChange={(e) => setModalFormData({ ...modalFormData, bankAccountId: e.target.value })}
                        >
                          {(summaryData?.bankAccounts || []).map((acc) => (
                            <option key={acc._id} value={acc._id}>
                              {acc.bankName} - {acc.accountName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="fin-form-group">
                        <label>Date Received*</label>
                        <input
                          type="date"
                          value={modalFormData.paymentDate}
                          onChange={(e) => setModalFormData({ ...modalFormData, paymentDate: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* 2. Create Invoice Modal */}
                  {activeModal === 'invoice' && (
                    <div className="fin-form-grid-2">
                      <div className="fin-form-group col-span-2">
                        <label>Client Name*</label>
                        <input
                          type="text"
                          required
                          placeholder="Enter client or company name"
                          value={modalFormData.clientName}
                          onChange={(e) => setModalFormData({ ...modalFormData, clientName: e.target.value })}
                        />
                      </div>
                      <div className="fin-form-group">
                        <label>Base Amount (₹)*</label>
                        <input
                          type="number"
                          required
                          value={modalFormData.amount}
                          onChange={(e) => setModalFormData({ ...modalFormData, amount: e.target.value })}
                        />
                      </div>
                      <div className="fin-form-group">
                        <label>CGST (₹)</label>
                        <input
                          type="number"
                          value={modalFormData.cgst}
                          onChange={(e) => setModalFormData({ ...modalFormData, cgst: e.target.value })}
                        />
                      </div>
                      <div className="fin-form-group">
                        <label>SGST (₹)</label>
                        <input
                          type="number"
                          value={modalFormData.sgst}
                          onChange={(e) => setModalFormData({ ...modalFormData, sgst: e.target.value })}
                        />
                      </div>
                      <div className="fin-form-group">
                        <label>Due Date*</label>
                        <input
                          type="date"
                          required
                          value={modalFormData.dueDate}
                          onChange={(e) => setModalFormData({ ...modalFormData, dueDate: e.target.value })}
                        />
                      </div>
                      <div className="fin-form-group col-span-2">
                        <label>Description</label>
                        <textarea
                          rows="2"
                          value={modalFormData.description}
                          placeholder="Services provided..."
                          onChange={(e) => setModalFormData({ ...modalFormData, description: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* 3. Add Expense Modal */}
                  {activeModal === 'expense' && (
                    <div className="fin-form-grid-2">
                      <div className="fin-form-group col-span-2">
                        <label>Expense Title*</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. AWS Production Cloud Hosting"
                          value={modalFormData.title}
                          onChange={(e) => setModalFormData({ ...modalFormData, title: e.target.value })}
                        />
                      </div>
                      <div className="fin-form-group">
                        <label>Expense Type*</label>
                        <select
                          value={modalFormData.categoryType}
                          onChange={(e) => setModalFormData({ ...modalFormData, categoryType: e.target.value })}
                        >
                          <option value="Office Expenses">Office Expenses</option>
                          <option value="Project Expenses">Project Expenses</option>
                          <option value="Client Expenses">Client Expenses</option>
                        </select>
                      </div>
                      <div className="fin-form-group">
                        <label>Category*</label>
                        <input
                          type="text"
                          required
                          value={modalFormData.category}
                          onChange={(e) => setModalFormData({ ...modalFormData, category: e.target.value })}
                        />
                      </div>
                      <div className="fin-form-group">
                        <label>Amount (₹)*</label>
                        <input
                          type="number"
                          required
                          value={modalFormData.amount}
                          onChange={(e) => setModalFormData({ ...modalFormData, amount: e.target.value })}
                        />
                      </div>
                      <div className="fin-form-group">
                        <label>Vendor / Payee Name</label>
                        <input
                          type="text"
                          value={modalFormData.vendorName}
                          onChange={(e) => setModalFormData({ ...modalFormData, vendorName: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* 4. Payment Request Modal */}
                  {activeModal === 'request' && (
                    <div className="fin-form-grid-2">
                      <div className="fin-form-group col-span-2">
                        <label>Payee / Beneficiary Name*</label>
                        <input
                          type="text"
                          required
                          value={modalFormData.payeeName}
                          onChange={(e) => setModalFormData({ ...modalFormData, payeeName: e.target.value })}
                        />
                      </div>
                      <div className="fin-form-group">
                        <label>Payment Type</label>
                        <select
                          value={modalFormData.paymentType}
                          onChange={(e) => setModalFormData({ ...modalFormData, paymentType: e.target.value })}
                        >
                          <option value="Vendor">Vendor</option>
                          <option value="Employee">Employee</option>
                          <option value="Utility">Utility</option>
                          <option value="Tax">Tax / Statutory</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="fin-form-group">
                        <label>Amount (₹)*</label>
                        <input
                          type="number"
                          required
                          value={modalFormData.amount}
                          onChange={(e) => setModalFormData({ ...modalFormData, amount: e.target.value })}
                        />
                      </div>
                      <div className="fin-form-group col-span-2">
                        <label>Reason / Business Purpose*</label>
                        <textarea
                          rows="2"
                          required
                          value={modalFormData.reason}
                          onChange={(e) => setModalFormData({ ...modalFormData, reason: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* 5. Follow-up Modal */}
                  {activeModal === 'recovery' && (
                    <div className="fin-form-grid-2">
                      <div className="fin-form-group">
                        <label>Recovery Status</label>
                        <select
                          value={modalFormData.status}
                          onChange={(e) => setModalFormData({ ...modalFormData, status: e.target.value })}
                        >
                          <option value="In Progress">In Progress</option>
                          <option value="Promised">Promised to Pay</option>
                          <option value="Escalated">Escalated</option>
                          <option value="Recovered">Recovered</option>
                        </select>
                      </div>
                      <div className="fin-form-group">
                        <label>Promise to Pay Date</label>
                        <input
                          type="date"
                          value={modalFormData.promiseToPayDate}
                          onChange={(e) => setModalFormData({ ...modalFormData, promiseToPayDate: e.target.value })}
                        />
                      </div>
                      <div className="fin-form-group col-span-2">
                        <label>Follow-up Note*</label>
                        <textarea
                          rows="3"
                          required
                          placeholder="Client promised RTGS transfer by Friday..."
                          value={modalFormData.note}
                          onChange={(e) => setModalFormData({ ...modalFormData, note: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* 6. Disburse Salary Modal */}
                  {activeModal === 'disburseSalary' && (
                    <div className="fin-form-grid-2">
                      <div className="fin-form-group col-span-2">
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>
                          Disbursing Net Salary of <strong>{formatCurrency(modalFormData.amount)}</strong> to employee.
                        </p>
                      </div>
                      <div className="fin-form-group">
                        <label>Debit from Bank Account*</label>
                        <select
                          value={modalFormData.bankAccountId}
                          onChange={(e) => setModalFormData({ ...modalFormData, bankAccountId: e.target.value })}
                        >
                          {(summaryData?.bankAccounts || []).map((acc) => (
                            <option key={acc._id} value={acc._id}>
                              {acc.bankName} - {acc.accountName} (Bal: {formatCurrency(acc.currentBalance)})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="fin-form-group">
                        <label>UTR / Transaction Reference</label>
                        <input
                          type="text"
                          value={modalFormData.transactionReference}
                          onChange={(e) => setModalFormData({ ...modalFormData, transactionReference: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* 7. Disburse F&F Modal */}
                  {activeModal === 'disburseFnf' && (
                    <div className="fin-form-grid-2">
                      <div className="fin-form-group col-span-2">
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>
                          Disbursing Net Settlement of <strong>{formatCurrency(modalFormData.amount)}</strong>.
                        </p>
                      </div>
                      <div className="fin-form-group">
                        <label>Debit from Bank Account*</label>
                        <select
                          value={modalFormData.bankAccountId}
                          onChange={(e) => setModalFormData({ ...modalFormData, bankAccountId: e.target.value })}
                        >
                          {(summaryData?.bankAccounts || []).map((acc) => (
                            <option key={acc._id} value={acc._id}>
                              {acc.bankName} - {acc.accountName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="fin-form-group">
                        <label>UTR Reference</label>
                        <input
                          type="text"
                          value={modalFormData.transactionReference}
                          onChange={(e) => setModalFormData({ ...modalFormData, transactionReference: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* 8. Add Bank Account Modal */}
                  {activeModal === 'bank' && (
                    <div className="fin-form-grid-2">
                      <div className="fin-form-group">
                        <label>Account Display Name*</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Operating Current A/C"
                          value={modalFormData.accountName}
                          onChange={(e) => setModalFormData({ ...modalFormData, accountName: e.target.value })}
                        />
                      </div>
                      <div className="fin-form-group">
                        <label>Bank Name*</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. ICICI Bank"
                          value={modalFormData.bankName}
                          onChange={(e) => setModalFormData({ ...modalFormData, bankName: e.target.value })}
                        />
                      </div>
                      <div className="fin-form-group">
                        <label>Account Number*</label>
                        <input
                          type="text"
                          required
                          value={modalFormData.accountNumber}
                          onChange={(e) => setModalFormData({ ...modalFormData, accountNumber: e.target.value })}
                        />
                      </div>
                      <div className="fin-form-group">
                        <label>Opening Balance (₹)*</label>
                        <input
                          type="number"
                          required
                          value={modalFormData.openingBalance}
                          onChange={(e) => setModalFormData({ ...modalFormData, openingBalance: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="fin-modal-footer">
                  <button type="button" className="fin-btn-secondary" onClick={closeModal} disabled={modalLoading}>
                    Cancel
                  </button>
                  <button type="submit" className="fin-btn-primary" disabled={modalLoading}>
                    {modalLoading ? 'Processing...' : 'Confirm & Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
}
