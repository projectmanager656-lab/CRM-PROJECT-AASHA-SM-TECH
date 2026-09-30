import React, { useContext, useEffect, useState, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppContext } from '../../../../context/AppContext';
import apiClient from '../../../../services/apiClient';
import UserLayout from '../users/components/UserLayout';
import ClientFinancialMaster from './ClientFinancialMaster';
import ProposalQuotationMaster from './ProposalQuotationMaster';
import InvoiceMaster from './InvoiceMaster';
import PaymentRecoveryMaster from './PaymentRecoveryMaster';
import IncomeMaster from './IncomeMaster';
import ExpenseMaster from './ExpenseMaster';
import PayrollMaster from './PayrollMaster';
import VendorManagementMaster from './VendorManagementMaster';
import SalaryMaster from './SalaryMaster';
import FinancialReportsMaster from './FinancialReportsMaster';
import ReportsAnalyticsMaster from './ReportsAnalyticsMaster';
import './FinanceDashboard.css';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function FinanceDashboard() {
  const { user } = useContext(AppContext) || {};
  const location = useLocation();
  const navigate = useNavigate();
  const tabsBarRef = useRef(null);

  // RBAC: Verify if current user is Finance Admin / Head or Super Admin
  const isFinanceAdmin = useMemo(() => {
    if (!user) return false;
    const role = String(user.role || '').trim().toLowerCase();
    if (['admin', 'super_admin'].includes(role)) return true;

    const rbacKey = String(user.rbacRoleKey || '').trim().toLowerCase();
    if (['finance_admin', 'finance_head', 'admin', 'super_admin'].includes(rbacKey)) return true;

    const designation = String(user.designation || '').trim().toLowerCase();
    const dept = String(user.department || '').trim().toUpperCase();
    if (dept === 'FINANCE') {
      const adminDesignations = ['head', 'director', 'cfo', 'chief financial officer', 'manager', 'lead'];
      if (adminDesignations.some((d) => designation.includes(d))) return true;
    }

    if (user.customPermissions) {
      if (user.customPermissions['finance.admin'] || user.customPermissions['finance.manage']) {
        return true;
      }
    }
    return false;
  }, [user]);

  const legacyTabMap = {
    'client-expenses': { tab: 'expenses', param: 'expenseTab=clientExpenses', subTab: 'clientExpenses' },
    'office-expenses': { tab: 'expenses', param: 'expenseTab=officeExpenses', subTab: 'officeExpenses' },
    'project-expenses': { tab: 'expenses', param: 'expenseTab=projectExpenses', subTab: 'projectExpenses' },
    'ledger': { tab: 'expenses', param: 'expenseTab=ledger', subTab: 'ledger' },
    'reconciliation': { tab: 'expenses', param: 'expenseTab=reconciliation', subTab: 'reconciliation' },
    'reports': { tab: 'expenses', param: 'expenseTab=reports', subTab: 'reports' },
    'salary': { tab: 'payroll', param: 'payrollTab=salary', subTab: 'salary' },
    'requests': { tab: 'payroll', param: 'payrollTab=requests', subTab: 'requests' },
    'vendor-bills': { tab: 'vendors', param: 'vendorTab=bills', subTab: 'bills' },
  };

  const resolveTabInfo = (rawTab) => {
    if (legacyTabMap[rawTab]) return legacyTabMap[rawTab];
    return { tab: rawTab || 'overview', param: null, subTab: null };
  };

  // Sync tab with URL query parameter ?tab=...
  const queryParams = new URLSearchParams(location.search);
  const rawTabFromUrl = queryParams.get('tab') || 'overview';
  const resolvedTabInfo = resolveTabInfo(rawTabFromUrl);
  const tabFromUrl = resolvedTabInfo.tab;

  const initialExpenseSubTab =
    (rawTabFromUrl.includes('expenses') && legacyTabMap[rawTabFromUrl]?.subTab) ||
    queryParams.get('expenseTab') ||
    queryParams.get('subTab') ||
    'overview';

  const initialPayrollSubTab =
    (rawTabFromUrl === 'salary' ? 'salary' : rawTabFromUrl === 'requests' ? 'requests' : null) ||
    queryParams.get('payrollTab') ||
    queryParams.get('subTab') ||
    'overview';

  const initialVendorSubTab =
    (rawTabFromUrl === 'vendor-bills' ? 'bills' : null) ||
    queryParams.get('vendorTab') ||
    queryParams.get('subTab') ||
    'overview';

  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [period, setPeriod] = useState('month');

  const scrollTabs = (direction) => {
    if (tabsBarRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      tabsBarRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (tabsBarRef.current) {
      const activeEl = tabsBarRef.current.querySelector('.fin-tab-btn.active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activeTab]);

  // Dynamic Fiscal Year (e.g. FY 2026-27 in India starts April 1st)
  const currentFiscalYear = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed, 3 = April
    const startYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    return `FY ${startYear}-${String(startYear + 1).slice(-2)}`;
  }, []);

  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const periodDropdownRef = useRef(null);

  const periodOptions = useMemo(
    () => [
      { key: 'today', label: 'Today' },
      { key: 'week', label: 'This Week' },
      { key: 'month', label: 'This Month' },
      { key: 'quarter', label: 'This Quarter' },
      { key: 'year', label: currentFiscalYear },
    ],
    [currentFiscalYear]
  );

  const selectedPeriodLabel = useMemo(() => {
    const found = periodOptions.find((p) => p.key === period);
    return found ? found.label : 'This Month';
  }, [period, periodOptions]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target)) {
        setIsPeriodDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Dashboard Data State
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [hoveredChartCategory, setHoveredChartCategory] = useState(null);

  // Tab-specific Data
  const [clients, setClients] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [invoiceSummary, setInvoiceSummary] = useState(null);
  const [recoveryInvoices, setRecoveryInvoices] = useState([]);
  const [recoverySummary, setRecoverySummary] = useState(null);
  const [recoveryAging, setRecoveryAging] = useState(null);
  const [recoveryTeam, setRecoveryTeam] = useState([]);
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
  const handleTabChange = (newTab, subTab = null) => {
    if (legacyTabMap[newTab]) {
      const mapped = legacyTabMap[newTab];
      setActiveTab(mapped.tab);
      navigate(`/dashboard/finance?tab=${mapped.tab}&${mapped.param}`, { replace: true });
      return;
    }
    setActiveTab(newTab);
    let subParam = '';
    if (subTab) {
      if (newTab === 'expenses') subParam = `&expenseTab=${subTab}`;
      else if (newTab === 'payroll') subParam = `&payrollTab=${subTab}`;
      else if (newTab === 'vendors') subParam = `&vendorTab=${subTab}`;
      else subParam = `&subTab=${subTab}`;
    }
    navigate(`/dashboard/finance?tab=${newTab}${subParam}`, { replace: true });
    setSearchTerm('');
    setStatusFilter('All');
    setCategoryFilter('All');
  };

  useEffect(() => {
    const rawTab = new URLSearchParams(location.search).get('tab');
    if (rawTab) {
      const resTab = resolveTabInfo(rawTab).tab;
      if (resTab !== activeTab) {
        setActiveTab(resTab);
      }
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
          if (isMounted) {
            const resData = res.data?.data;
            if (resData && Array.isArray(resData.clients)) {
              setClients(resData.clients);
            } else if (Array.isArray(resData)) {
              setClients(resData);
            } else {
              setClients([]);
            }
          }
        } else if (activeTab === 'proposals') {
          const res = await apiClient.get('/finance/proposals');
          if (isMounted) {
            const resData = res.data?.data;
            if (resData && Array.isArray(resData.proposals)) {
              setProposals(resData.proposals);
            } else if (Array.isArray(resData)) {
              setProposals(resData);
            } else {
              setProposals([]);
            }
          }
        } else if (activeTab === 'invoices') {
          const res = await apiClient.get('/finance/invoices');
          if (isMounted) {
            const resData = res.data?.data;
            if (resData && Array.isArray(resData.invoices)) {
              setInvoices(resData.invoices);
              if (resData.summary) setInvoiceSummary(resData.summary);
            } else if (Array.isArray(resData)) {
              setInvoices(resData);
            } else {
              setInvoices([]);
            }
          }
        } else if (activeTab === 'recovery') {
          const res = await apiClient.get('/finance/recovery');
          if (isMounted) {
            const resData = res.data?.data;
            if (resData && Array.isArray(resData.invoices)) {
              setRecoveryInvoices(resData.invoices);
              if (resData.summary) setRecoverySummary(resData.summary);
              if (resData.aging) setRecoveryAging(resData.aging);
              if (resData.teamMembers) setRecoveryTeam(resData.teamMembers);
            } else if (Array.isArray(resData)) {
              setRecoveryInvoices(resData);
            } else {
              setRecoveryInvoices([]);
            }
          }
        } else if (activeTab === 'income') {
          const res = await apiClient.get('/finance/ledger?transactionType=Income');
          if (isMounted) setLedgerEntries(res.data?.data || []);
        } else if (
          activeTab === 'expenses' ||
          activeTab === 'client-expenses' ||
          activeTab === 'office-expenses' ||
          activeTab === 'project-expenses'
        ) {
          const res = await apiClient.get('/finance/expenses');
          if (isMounted) setExpenses(res.data?.data || []);
        } else if (activeTab === 'banking') {
          const res = await apiClient.get('/finance/bank-accounts');
          if (isMounted) setBankAccounts(res.data?.data || []);
        } else if (activeTab === 'vendors' || activeTab === 'vendor-bills') {
          const [vRes, bRes] = await Promise.all([
            apiClient.get('/finance/vendors'),
            apiClient.get('/finance/vendor-bills'),
          ]);
          if (isMounted) {
            setVendors(vRes.data?.data || []);
            setVendorBills(bRes.data?.data || []);
          }
        } else if (activeTab === 'payroll' || activeTab === 'salary' || activeTab === 'requests') {
          const [pRes, sRes, reqRes] = await Promise.all([
            apiClient.get('/finance/payroll'),
            apiClient.get('/finance/fnf'),
            apiClient.get('/finance/payment-requests'),
          ]);
          if (isMounted) {
            setPayrolls(pRes.data?.data || []);
            setSettlements(sRes.data?.data || []);
            setPaymentRequests(reqRes.data?.data || []);
          }
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

  // Navigation tabs metadata (Exactly 20 modules + Audit & Settings)
  const tabs = [
    { id: 'overview', label: 'Finance Dashboard', icon: '📊' },
    { id: 'clients', label: 'Client Financial Master', icon: '👥' },
    { id: 'proposals', label: 'Proposals / Quotations', icon: '📜' },
    { id: 'invoices', label: 'Invoices', icon: '📄', count: summaryData?.kpis?.pendingInvoicesCount },
    { id: 'recovery', label: 'Payment Recovery', icon: '⏳', count: summaryData?.kpis?.overdueInvoicesCount },
    { id: 'income', label: 'Income Management', icon: '💰' },
    { id: 'expenses', label: 'Expense Management', icon: '🧾' },
    { id: 'banking', label: 'Company Bank Accounts', icon: '🏦' },
    { id: 'cashflow', label: 'Cash Flow', icon: '📈' },
    { id: 'vendors', label: 'Vendor Management', icon: '🏢', count: vendorBills?.filter(b => b.status !== 'Paid')?.length || 0 },
    { id: 'payroll', label: 'Payroll', icon: '💼', count: (summaryData?.kpis?.payrollPendingCount || 0) + (paymentRequests?.filter(r => r.status === 'Submitted' || r.status === 'Approved')?.length || summaryData?.kpis?.paymentRequestsPendingCount || 0) },
    { id: 'reports-analytics', label: 'Reports & Analytics', icon: '📊' },
    { id: 'audit', label: 'Audit History', icon: '🛡️' },
    { id: 'settings', label: 'Configuration', icon: '⚙️' },
  ];

  const kpis = summaryData?.kpis || {};
  const trends = summaryData?.monthlyTrends || [];
  const incomeCategories = useMemo(() => summaryData?.incomeCategories || [], [summaryData]);

  const doughnutSegments = useMemo(() => {
    if (!incomeCategories || incomeCategories.length === 0) return [];
    const C = 2 * Math.PI * 55; // ~345.575
    let cumulativeArc = 0;

    return incomeCategories.map((cat) => {
      const share = Math.max(0.001, (cat.percentage || 0) / 100);
      const arcLength = share * C;
      const strokeDasharray =
        incomeCategories.length > 1
          ? `${Math.max(0.5, arcLength - 2.5)} ${C - Math.max(0.5, arcLength - 2.5)}`
          : `${C} 0`;
      const strokeDashoffset = -cumulativeArc;
      cumulativeArc += arcLength;

      return {
        ...cat,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [incomeCategories]);

  const alertActionCount = useMemo(() => {
    return (
      (kpis.overdueInvoicesCount > 0 ? 1 : 0) +
      (kpis.pendingInvoicesCount > 0 ? 1 : 0) +
      (kpis.paymentRequestsPendingCount > 0 ? 1 : 0) +
      (kpis.payrollPendingCount > 0 ? 1 : 0) +
      (kpis.reconciliationPendingCount > 0 ? 1 : 0)
    );
  }, [kpis]);

  return (
    <UserLayout pageTitle="Finance Dashboard" pageSubtitle="Finance Control Center">
      <div className="finance-control-center">
        {/* A. Dashboard Heading */}
        <div className="fin-header-row">
          <div className="fin-title-group">
            <h1 className="fin-page-title">Finance Dashboard</h1>
            <p className="fin-page-subtitle">Manage your complete financial lifecycle</p>
          </div>
        </div>

        {/* B. Controls Area: Search, Action Buttons & Date Dropdown in One Single Row */}
        <div className="fin-controls-row">
          {/* 1. Search Bar */}
          <div className="fin-header-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="fin-search-icon">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Search by client, invoice number, vendor, transaction..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="fin-header-search-input"
              aria-label="Search financial records"
            />
            <div className="fin-search-tune-icon" title="Filter search">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="8" x2="20" y2="8"></line>
                <line x1="4" y1="16" x2="20" y2="16"></line>
                <circle cx="9" cy="8" r="2.5" fill="#ffffff"></circle>
                <circle cx="15" cy="16" r="2.5" fill="#ffffff"></circle>
              </svg>
            </div>
          </div>

          {/* 2 & 3. Action Buttons */}
          <div className="fin-actions-inline-group">
            <button type="button" className="fin-action-btn" onClick={() => openModal('payment')}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Record Payment</span>
            </button>
            <button type="button" className="fin-action-btn" onClick={() => openModal('request')}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="7" y1="17" x2="17" y2="7"></line>
                <polyline points="7 7 17 7 17 17"></polyline>
              </svg>
              <span>New Payment Request</span>
            </button>
          </div>

          {/* 4. Date Filter Dropdown */}
          <div className="fin-period-dropdown-wrap" ref={periodDropdownRef}>
            <button
              type="button"
              className={`fin-period-dropdown-btn ${isPeriodDropdownOpen ? 'open' : ''}`}
              onClick={() => setIsPeriodDropdownOpen((prev) => !prev)}
              aria-haspopup="listbox"
              aria-expanded={isPeriodDropdownOpen}
              id="fin-period-select"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="fin-period-cal-icon">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span className="fin-period-dropdown-label">{selectedPeriodLabel}</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`fin-period-arrow-icon ${isPeriodDropdownOpen ? 'rotated' : ''}`}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            {isPeriodDropdownOpen && (
              <div className="fin-period-menu" role="listbox" aria-labelledby="fin-period-select">
                {periodOptions.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    role="option"
                    aria-selected={period === opt.key}
                    className={`fin-period-menu-item ${period === opt.key ? 'active' : ''}`}
                    onClick={() => {
                      setPeriod(opt.key);
                      setIsPeriodDropdownOpen(false);
                    }}
                  >
                    <span>{opt.label}</span>
                    {period === opt.key && (
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Horizontal Navigation Tabs with Accessible Scroll Controls */}
        <div className="fin-tabs-nav-wrapper">
          <button
            type="button"
            className="fin-tabs-scroll-btn left"
            onClick={() => scrollTabs('left')}
            aria-label="Scroll tabs left"
            title="Scroll tabs left"
          >
            ‹
          </button>
          <div className="fin-tabs-bar" ref={tabsBarRef} role="tablist" aria-label="Finance navigation tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={activeTab === t.id}
                aria-controls={`panel-${t.id}`}
                tabIndex={activeTab === t.id ? 0 : -1}
                className={`fin-tab-btn ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => handleTabChange(t.id)}
              >
                <span className="fin-tab-icon">{t.icon}</span>
                <span>{t.label}</span>
                {t.count > 0 && <span className="fin-tab-badge">{t.count}</span>}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="fin-tabs-scroll-btn right"
            onClick={() => scrollTabs('right')}
            aria-label="Scroll tabs right"
            title="Scroll tabs right"
          >
            ›
          </button>
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
                  {/* Card 1: Circular Doughnut Breakdown */}
                  <div className="fin-card fin-chart-card">
                    <div className="fin-card-header">
                      <h3>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                          <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                          <path d="M22 12A10 10 0 0 0 12 2v10z" />
                        </svg>
                        Income by Category
                      </h3>
                      <span className="fin-card-tag green">{formatCurrency(kpis.totalIncome)}</span>
                    </div>

                    {incomeCategories.length === 0 ? (
                      <div className="fin-chart-empty-state">
                        <div className="fin-chart-empty-icon">
                          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M12 6v6l4 2"></path>
                          </svg>
                        </div>
                        <div className="fin-chart-empty-title">No income recorded in this period</div>
                        <div className="fin-chart-empty-sub">Select another date range above to see category breakdown</div>
                      </div>
                    ) : (
                      <div className="fin-doughnut-layout">
                        <div className="fin-doughnut-svg-wrap">
                          <svg width="120" height="120" viewBox="0 0 150 150" className="fin-doughnut-svg">
                            <circle cx="75" cy="75" r="55" fill="none" stroke="#f1f5f9" strokeWidth="18" />
                            <g transform="rotate(-90 75 75)">
                              {doughnutSegments.map((seg) => {
                                const isHovered = hoveredChartCategory?.category === seg.category;
                                return (
                                  <circle
                                    key={seg.category}
                                    cx="75"
                                    cy="75"
                                    r="55"
                                    fill="none"
                                    stroke={seg.color}
                                    strokeWidth={isHovered ? 22 : 18}
                                    strokeDasharray={seg.strokeDasharray}
                                    strokeDashoffset={seg.strokeDashoffset}
                                    className="fin-doughnut-slice"
                                    onMouseEnter={() => setHoveredChartCategory(seg)}
                                    onMouseLeave={() => setHoveredChartCategory(null)}
                                    style={{
                                      transition: 'stroke-width 150ms ease, opacity 150ms ease',
                                      cursor: 'pointer',
                                      opacity: hoveredChartCategory && !isHovered ? 0.6 : 1,
                                    }}
                                  />
                                );
                              })}
                            </g>
                          </svg>
                          <div className="fin-doughnut-center">
                            <span className="fin-center-label">
                              {hoveredChartCategory ? hoveredChartCategory.category : 'Total Income'}
                            </span>
                            <span className="fin-center-val">
                              {hoveredChartCategory ? formatCurrency(hoveredChartCategory.amount) : formatCurrency(kpis.totalIncome)}
                            </span>
                            <span className="fin-center-sub">
                              {hoveredChartCategory ? `${hoveredChartCategory.percentage}%` : selectedPeriodLabel}
                            </span>
                          </div>
                        </div>

                        <div className="fin-doughnut-legend-list">
                          {incomeCategories.map((cat) => {
                            const isHovered = hoveredChartCategory?.category === cat.category;
                            return (
                              <div
                                key={cat.category}
                                className={`fin-doughnut-legend-item ${isHovered ? 'hovered' : ''}`}
                                onMouseEnter={() => setHoveredChartCategory(cat)}
                                onMouseLeave={() => setHoveredChartCategory(null)}
                              >
                                <div className="fin-doughnut-legend-left">
                                  <span className="fin-doughnut-legend-dot" style={{ backgroundColor: cat.color }} />
                                  <span className="fin-doughnut-legend-name" title={cat.category}>{cat.category}</span>
                                </div>
                                <div className="fin-doughnut-legend-right">
                                  <span className="fin-doughnut-legend-pct">{cat.percentage}%</span>
                                  <span className="fin-doughnut-legend-amt">{formatCurrency(cat.amount)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card 2: Financial Alerts & Pending Actions */}
                  <div className="fin-card fin-alerts-card">
                    <div className="fin-card-header">
                      <h3>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                        </svg>
                        Financial Alerts & Pending Actions
                      </h3>
                      <span className={`fin-card-tag ${alertActionCount > 0 ? 'orange' : 'green'}`}>
                        {alertActionCount > 0 ? `${alertActionCount} Action Items` : 'All Settled'}
                      </span>
                    </div>

                    <div className="fin-alerts-list">
                      {/* 1. Overdue Invoices */}
                      <div className="fin-alert-row" onClick={() => handleTabChange('recovery')} title="View Overdue Invoices in Payment Recovery">
                        <div className="fin-alert-left">
                          <div className={`fin-alert-dot ${kpis.overdueInvoicesCount > 0 ? 'danger' : 'success'}`} />
                          <span className="fin-alert-label">Overdue Invoices</span>
                        </div>
                        <div className="fin-alert-center">
                          <span className={`fin-alert-badge ${kpis.overdueInvoicesCount > 0 ? 'danger' : 'muted'}`}>
                            {kpis.overdueInvoicesCount || 0}
                          </span>
                          {Number(kpis.overdueInvoicesAmount) > 0 && (
                            <span className="fin-alert-amount danger">{formatCurrency(kpis.overdueInvoicesAmount)}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="fin-alert-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTabChange('recovery');
                          }}
                        >
                          View →
                        </button>
                      </div>

                      {/* 2. Pending Invoices */}
                      <div className="fin-alert-row" onClick={() => handleTabChange('invoices')} title="View Pending Invoices">
                        <div className="fin-alert-left">
                          <div className={`fin-alert-dot ${kpis.pendingInvoicesCount > 0 ? 'warning' : 'success'}`} />
                          <span className="fin-alert-label">Pending Invoices</span>
                        </div>
                        <div className="fin-alert-center">
                          <span className={`fin-alert-badge ${kpis.pendingInvoicesCount > 0 ? 'warning' : 'muted'}`}>
                            {kpis.pendingInvoicesCount || 0}
                          </span>
                          {Number(kpis.pendingInvoicesAmount) > 0 && (
                            <span className="fin-alert-amount">{formatCurrency(kpis.pendingInvoicesAmount)}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="fin-alert-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTabChange('invoices');
                          }}
                        >
                          View →
                        </button>
                      </div>

                      {/* 3. Payment Requests */}
                      <div className="fin-alert-row" onClick={() => handleTabChange('payroll', 'requests')} title="View Payment Requests in Payroll">
                        <div className="fin-alert-left">
                          <div className={`fin-alert-dot ${kpis.paymentRequestsPendingCount > 0 ? 'warning' : 'neutral'}`} />
                          <span className="fin-alert-label">Payment Requests Awaiting Approval</span>
                        </div>
                        <div className="fin-alert-center">
                          <span className={`fin-alert-badge ${kpis.paymentRequestsPendingCount > 0 ? 'warning' : 'muted'}`}>
                            {kpis.paymentRequestsPendingCount || 0}
                          </span>
                          {Number(kpis.paymentRequestsPendingAmount) > 0 && (
                            <span className="fin-alert-amount">{formatCurrency(kpis.paymentRequestsPendingAmount)}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="fin-alert-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTabChange('payroll', 'requests');
                          }}
                        >
                          View →
                        </button>
                      </div>

                      {/* 4. Payroll Pending */}
                      <div className="fin-alert-row" onClick={() => handleTabChange('payroll', 'overview')} title="View Payroll Slips in Payroll">
                        <div className="fin-alert-left">
                          <div className={`fin-alert-dot ${kpis.payrollPendingCount > 0 ? 'warning' : 'neutral'}`} />
                          <span className="fin-alert-label">Payroll Pending Disbursal</span>
                        </div>
                        <div className="fin-alert-center">
                          <span className={`fin-alert-badge ${kpis.payrollPendingCount > 0 ? 'warning' : 'muted'}`}>
                            {kpis.payrollPendingCount || 0}
                          </span>
                          {Number(kpis.payrollPendingAmount) > 0 && (
                            <span className="fin-alert-amount">{formatCurrency(kpis.payrollPendingAmount)}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="fin-alert-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTabChange('payroll', 'overview');
                          }}
                        >
                          View →
                        </button>
                      </div>

                      {/* 5. Bank Reconciliation */}
                      <div className="fin-alert-row" onClick={() => handleTabChange('reconciliation')} title="View Bank Reconciliation">
                        <div className="fin-alert-left">
                          <div className={`fin-alert-dot ${kpis.reconciliationPendingCount > 0 ? 'warning' : 'success'}`} />
                          <span className="fin-alert-label">Bank Reconciliation Pending</span>
                        </div>
                        <div className="fin-alert-center">
                          <span className={`fin-alert-badge ${kpis.reconciliationPendingCount > 0 ? 'warning' : 'success'}`}>
                            {kpis.reconciliationPendingCount > 0 ? kpis.reconciliationPendingCount : 'In Sync'}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="fin-alert-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTabChange('reconciliation');
                          }}
                        >
                          View →
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Receivables Aging */}
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

                  {/* Card 4: Payables Aging */}
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
                    <div className="fin-compact-table-wrap">
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
                    <div className="fin-compact-table-wrap">
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
                    <div className="fin-compact-table-wrap">
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
                    <div className="fin-compact-table-wrap">
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
                </div>
              </>
            )}
          </>
        )}

        {/* TAB CONTENT: 2. CLIENT FINANCIAL MASTER */}
        {activeTab === 'clients' && (
          <ClientFinancialMaster
            clients={clients}
            setClients={setClients}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            openModal={openModal}
            user={user}
            refreshTrigger={refreshTrigger}
            setRefreshTrigger={setRefreshTrigger}
          />
        )}

        {/* TAB CONTENT: 3. PROPOSALS / QUOTATIONS */}
        {activeTab === 'proposals' && (
          <ProposalQuotationMaster
            proposals={proposals}
            setProposals={setProposals}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            user={user}
            refreshTrigger={refreshTrigger}
            setRefreshTrigger={setRefreshTrigger}
            openModal={openModal}
          />
        )}

        {/* TAB CONTENT: 4. INVOICES */}
        {activeTab === 'invoices' && (
          <InvoiceMaster
            invoices={invoices}
            setInvoices={setInvoices}
            summary={invoiceSummary}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            user={user}
            onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
            openModal={openModal}
          />
        )}

        {/* TAB CONTENT: 5. PAYMENT RECOVERY */}
        {activeTab === 'recovery' && (
          <PaymentRecoveryMaster
            invoices={recoveryInvoices}
            setInvoices={setRecoveryInvoices}
            summary={recoverySummary}
            aging={recoveryAging}
            teamMembers={recoveryTeam}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            user={user}
            onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
            openModal={openModal}
          />
        )}

        {/* TAB CONTENT: INCOME MANAGEMENT */}
        {activeTab === 'income' && (
          <IncomeMaster
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            user={user}
            onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
            openModal={openModal}
            handleTabChange={handleTabChange}
          />
        )}

        {/* TAB CONTENT: 6. EXPENSES */}
        {activeTab === 'expenses' && (
          <ExpenseMaster
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            user={user}
            onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
            openModal={openModal}
            handleTabChange={handleTabChange}
            initialSubTab={initialExpenseSubTab}
          />
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

        {/* TAB CONTENT: CASH FLOW */}
        {activeTab === 'cashflow' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a', margin: 0 }}>
                📈 Cash Flow Forecast & Liquid Runway
              </h3>
              <button className="fin-btn-secondary fin-btn-sm" onClick={() => handleTabChange('overview')}>
                ← Back to Overview
              </button>
            </div>

            <div className="fin-kpi-grid-6" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.25rem' }}>
              <div className="fin-kpi-card">
                <div className="fin-kpi-top">
                  <span className="fin-kpi-label">Opening Liquid Cash</span>
                  <div className="fin-kpi-icon-wrap bank">🏦</div>
                </div>
                <div className="fin-kpi-value">{formatCurrency(summaryData?.cashFlow?.forecast?.openingCash)}</div>
                <div className="fin-kpi-footer">Current Bank + Vault Balances</div>
              </div>

              <div className="fin-kpi-card">
                <div className="fin-kpi-top">
                  <span className="fin-kpi-label">Expected Inflows</span>
                  <div className="fin-kpi-icon-wrap income">📈</div>
                </div>
                <div className="fin-kpi-value" style={{ color: '#10b981' }}>
                  + {formatCurrency(summaryData?.cashFlow?.forecast?.expectedInflows)}
                </div>
                <div className="fin-kpi-footer">Due Receivables in Period</div>
              </div>

              <div className="fin-kpi-card">
                <div className="fin-kpi-top">
                  <span className="fin-kpi-label">Expected Outflows</span>
                  <div className="fin-kpi-icon-wrap expense">📉</div>
                </div>
                <div className="fin-kpi-value" style={{ color: '#ef4444' }}>
                  - {formatCurrency(summaryData?.cashFlow?.forecast?.expectedOutflows)}
                </div>
                <div className="fin-kpi-footer">Pending Bills & Requests</div>
              </div>

              <div className="fin-kpi-card">
                <div className="fin-kpi-top">
                  <span className="fin-kpi-label">Projected Closing</span>
                  <div className="fin-kpi-icon-wrap cashflow">💼</div>
                </div>
                <div
                  className="fin-kpi-value"
                  style={{ color: (summaryData?.cashFlow?.forecast?.projectedClosingCash || 0) >= 0 ? '#10b981' : '#ef4444' }}
                >
                  {formatCurrency(summaryData?.cashFlow?.forecast?.projectedClosingCash)}
                </div>
                <div className="fin-kpi-footer">Forecasted Net Liquid Balance</div>
              </div>
            </div>

            <div className="fin-table-container">
              <div className="fin-table-toolbar">
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>6-Month Rolling Cash Flow Trends</span>
              </div>
              <div className="fin-table-responsive">
                <table className="fin-data-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th className="text-right">Inflow (Credits)</th>
                      <th className="text-right">Outflow (Debits)</th>
                      <th className="text-right">Net Flow</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trends.map((t) => (
                      <tr key={t.month}>
                        <td><strong>{t.month}</strong></td>
                        <td className="text-right text-success font-semibold">{formatCurrency(t.income)}</td>
                        <td className="text-right text-danger font-semibold">{formatCurrency(t.expense)}</td>
                        <td className="text-right font-bold" style={{ color: t.net >= 0 ? '#10b981' : '#ef4444' }}>
                          {formatCurrency(t.net)}
                        </td>
                        <td>
                          <span className={`fin-badge ${t.net >= 0 ? 'paid' : 'rejected'}`}>
                            {t.net >= 0 ? 'Surplus' : 'Deficit'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: VENDOR MANAGEMENT (CONSOLIDATED) */}
        {(activeTab === 'vendors' || activeTab === 'vendor-bills') && (
          <VendorManagementMaster
            vendors={vendors}
            setVendors={setVendors}
            vendorBills={vendorBills}
            setVendorBills={setVendorBills}
            bankAccounts={bankAccounts}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            user={user}
            isFinanceAdmin={isFinanceAdmin}
            onRefresh={() => setRefreshTrigger((p) => p + 1)}
            initialSubTab={initialVendorSubTab}
          />
        )}

        {/* TAB CONTENT: PAYROLL (CONSOLIDATED) */}
        {(activeTab === 'payroll' || activeTab === 'salary' || activeTab === 'requests') && (
          <PayrollMaster
            payrolls={payrolls}
            setPayrolls={setPayrolls}
            settlements={settlements}
            setSettlements={setSettlements}
            paymentRequests={paymentRequests}
            setPaymentRequests={setPaymentRequests}
            bankAccounts={bankAccounts}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            user={user}
            isFinanceAdmin={isFinanceAdmin}
            onRefresh={() => setRefreshTrigger((p) => p + 1)}
            initialSubTab={initialPayrollSubTab}
          />
        )}

        {/* TAB CONTENT: 15. CLIENT EXPENSES */}
        {activeTab === 'client-expenses' && (
          <div className="fin-table-container">
            <div className="fin-table-toolbar">
              <input
                type="text"
                placeholder="Search Client Expenses..."
                className="fin-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="fin-toolbar-count">
                <strong>{expenses.filter((e) => e.categoryType === 'Client Expenses').length}</strong> client expenses
              </span>
              <button
                className="fin-btn-primary fin-btn-sm"
                onClick={() => {
                  openModal('expense');
                  setModalFormData((prev) => ({ ...prev, categoryType: 'Client Expenses' }));
                }}
              >
                + Add Client Expense
              </button>
            </div>
            <div className="fin-table-responsive">
              <table className="fin-data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Client / Project</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Payee</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.filter((e) => e.categoryType === 'Client Expenses').length === 0 ? (
                    <tr>
                      <td colSpan="8" className="fin-empty-cell">No client expenses recorded</td>
                    </tr>
                  ) : (
                    expenses
                      .filter((e) => e.categoryType === 'Client Expenses')
                      .filter((e) => !searchTerm || e.title?.toLowerCase().includes(searchTerm.toLowerCase()) || e.vendorName?.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((e) => (
                        <tr key={e._id}>
                          <td><strong>{e.title}</strong></td>
                          <td>{e.category}</td>
                          <td>{e.client?.name || e.project?.name || '—'}</td>
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
                                isFinanceAdmin ? (
                                  <button className="fin-action-btn approve" onClick={() => handleApproveExpense(e._id)}>
                                    Approve
                                  </button>
                                ) : (
                                  <span className="fin-cell-sub">Pending Admin</span>
                                )
                              )}
                              {e.paymentStatus === 'Approved' && (
                                isFinanceAdmin ? (
                                  <button
                                    className="fin-action-btn pay"
                                    onClick={() => {
                                      const bankId = summaryData?.bankAccounts?.[0]?._id;
                                      if (window.confirm(`Disburse payment of ${formatCurrency(e.amount)} now?`)) {
                                        apiClient.post(`/finance/expenses/${e._id}/pay`, { bankAccountId: bankId }).then(() => setRefreshTrigger((p) => p + 1));
                                      }
                                    }}
                                  >
                                    Disburse Payment
                                  </button>
                                ) : (
                                  <span className="fin-cell-sub">Approved</span>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB CONTENT: 16. OFFICE EXPENSES */}
        {activeTab === 'office-expenses' && (
          <div className="fin-table-container">
            <div className="fin-table-toolbar">
              <input
                type="text"
                placeholder="Search Office Expenses..."
                className="fin-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="fin-toolbar-count">
                <strong>{expenses.filter((e) => e.categoryType === 'Office Expenses').length}</strong> office expenses
              </span>
              <button
                className="fin-btn-primary fin-btn-sm"
                onClick={() => {
                  openModal('expense');
                  setModalFormData((prev) => ({ ...prev, categoryType: 'Office Expenses' }));
                }}
              >
                + Add Office Expense
              </button>
            </div>
            <div className="fin-table-responsive">
              <table className="fin-data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Vendor / Payee</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.filter((e) => e.categoryType === 'Office Expenses').length === 0 ? (
                    <tr>
                      <td colSpan="7" className="fin-empty-cell">No office expenses recorded</td>
                    </tr>
                  ) : (
                    expenses
                      .filter((e) => e.categoryType === 'Office Expenses')
                      .filter((e) => !searchTerm || e.title?.toLowerCase().includes(searchTerm.toLowerCase()) || e.vendorName?.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((e) => (
                        <tr key={e._id}>
                          <td><strong>{e.title}</strong></td>
                          <td>{e.category}</td>
                          <td>{e.vendorName || e.employeeName || '—'}</td>
                          <td><strong>{formatCurrency(e.amount)}</strong></td>
                          <td>{formatDate(e.expenseDate)}</td>
                          <td>
                            <span className={`fin-badge ${String(e.paymentStatus).toLowerCase()}`}>
                              {e.paymentStatus}
                            </span>
                          </td>
                          <td>
                            <div className="fin-row-actions">
                              {e.paymentStatus === 'Pending' && (
                                isFinanceAdmin ? (
                                  <button className="fin-action-btn approve" onClick={() => handleApproveExpense(e._id)}>
                                    Approve
                                  </button>
                                ) : (
                                  <span className="fin-cell-sub">Pending Admin</span>
                                )
                              )}
                              {e.paymentStatus === 'Approved' && (
                                isFinanceAdmin ? (
                                  <button
                                    className="fin-action-btn pay"
                                    onClick={() => {
                                      const bankId = summaryData?.bankAccounts?.[0]?._id;
                                      if (window.confirm(`Disburse payment of ${formatCurrency(e.amount)} now?`)) {
                                        apiClient.post(`/finance/expenses/${e._id}/pay`, { bankAccountId: bankId }).then(() => setRefreshTrigger((p) => p + 1));
                                      }
                                    }}
                                  >
                                    Disburse Payment
                                  </button>
                                ) : (
                                  <span className="fin-cell-sub">Approved</span>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB CONTENT: 17. PROJECT EXPENSES */}
        {activeTab === 'project-expenses' && (
          <div className="fin-table-container">
            <div className="fin-table-toolbar">
              <input
                type="text"
                placeholder="Search Project Expenses..."
                className="fin-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="fin-toolbar-count">
                <strong>{expenses.filter((e) => e.categoryType === 'Project Expenses').length}</strong> project expenses
              </span>
              <button
                className="fin-btn-primary fin-btn-sm"
                onClick={() => {
                  openModal('expense');
                  setModalFormData((prev) => ({ ...prev, categoryType: 'Project Expenses' }));
                }}
              >
                + Add Project Expense
              </button>
            </div>
            <div className="fin-table-responsive">
              <table className="fin-data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Project</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Vendor / Payee</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.filter((e) => e.categoryType === 'Project Expenses').length === 0 ? (
                    <tr>
                      <td colSpan="8" className="fin-empty-cell">No project expenses recorded</td>
                    </tr>
                  ) : (
                    expenses
                      .filter((e) => e.categoryType === 'Project Expenses')
                      .filter((e) => !searchTerm || e.title?.toLowerCase().includes(searchTerm.toLowerCase()) || e.vendorName?.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((e) => (
                        <tr key={e._id}>
                          <td><strong>{e.title}</strong></td>
                          <td>{e.category}</td>
                          <td>{e.project?.name || '—'}</td>
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
                                isFinanceAdmin ? (
                                  <button className="fin-action-btn approve" onClick={() => handleApproveExpense(e._id)}>
                                    Approve
                                  </button>
                                ) : (
                                  <span className="fin-cell-sub">Pending Admin</span>
                                )
                              )}
                              {e.paymentStatus === 'Approved' && (
                                isFinanceAdmin ? (
                                  <button
                                    className="fin-action-btn pay"
                                    onClick={() => {
                                      const bankId = summaryData?.bankAccounts?.[0]?._id;
                                      if (window.confirm(`Disburse payment of ${formatCurrency(e.amount)} now?`)) {
                                        apiClient.post(`/finance/expenses/${e._id}/pay`, { bankAccountId: bankId }).then(() => setRefreshTrigger((p) => p + 1));
                                      }
                                    }}
                                  >
                                    Disburse Payment
                                  </button>
                                ) : (
                                  <span className="fin-cell-sub">Approved</span>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB CONTENT: 18. GENERAL LEDGER */}
        {activeTab === 'ledger' && (
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
            <div className="fin-table-responsive">
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
          </div>
        )}

        {/* TAB CONTENT: BANK RECONCILIATION */}
        {activeTab === 'reconciliation' && (
          <div className="fin-table-container">
            <div className="fin-table-toolbar">
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Bank Statement Reconciliation Records</span>
                <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '0.75rem' }}>
                  Total Statements: {reconciliations.length}
                </span>
              </div>
            </div>
            <div className="fin-table-responsive">
              <table className="fin-data-table">
                <thead>
                  <tr>
                    <th>Bank Account</th>
                    <th>Statement Date</th>
                    <th className="text-right">Bank Balance</th>
                    <th className="text-right">Book Balance</th>
                    <th className="text-right">Discrepancy</th>
                    <th>Status</th>
                    <th>Reconciled By</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliations.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center text-muted" style={{ padding: '2rem' }}>
                        No reconciliation records found. Bank accounts are currently in sync.
                      </td>
                    </tr>
                  ) : (
                    reconciliations.map((r) => (
                      <tr key={r._id}>
                        <td><strong>{r.bankAccount?.accountName || r.bankAccount?.bankName || 'Main Account'}</strong></td>
                        <td>{formatDate(r.statementDate)}</td>
                        <td className="text-right font-semibold">{formatCurrency(r.statementBalance)}</td>
                        <td className="text-right">{formatCurrency(r.bookBalance)}</td>
                        <td className="text-right font-bold" style={{ color: r.discrepancy !== 0 ? '#ef4444' : '#16a34a' }}>
                          {formatCurrency(r.discrepancy)}
                        </td>
                        <td>
                          <span className={`fin-badge ${r.status?.toLowerCase()}`}>
                            {r.status || 'Reconciled'}
                          </span>
                        </td>
                        <td><small>{r.reconciledBy ? `${r.reconciledBy.firstName} ${r.reconciledBy.lastName || ''}` : 'System'}</small></td>
                        <td><small>{r.notes || '—'}</small></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB CONTENT: REPORTS & ANALYTICS */}
        {(activeTab === 'reports-analytics' || activeTab === 'reports') && (
          <ReportsAnalyticsMaster
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            user={user}
            isFinanceAdmin={isFinanceAdmin}
          />
        )}

        {/* TAB CONTENT: 12. AUDIT HISTORY */}
        {activeTab === 'audit' && (
          <div className="fin-table-container">
            <div className="fin-table-toolbar">
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Financial Immutable Audit Log</span>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Showing {auditLogs.length} audit records</span>
            </div>
            <div className="fin-table-responsive">
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
