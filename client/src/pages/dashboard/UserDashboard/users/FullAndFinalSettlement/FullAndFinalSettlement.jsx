import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import apiClient from '../../../../../services/apiClient';
import { AppContext } from '../../../../../context/AppContext';
import UserLayout from '../components/UserLayout';
import './FullAndFinalSettlement.css';

const WORKFLOW_STATUSES = [
  'All',
  'Draft',
  'Calculation Pending',
  'Clearance Pending',
  'HR Review',
  'Finance Review',
  'Approval Pending',
  'Approved',
  'Payment Pending',
  'Paid',
  'Completed',
  'On Hold',
];

const EARNING_FIELDS = [
  ['pendingSalary', 'Pending Salary'],
  ['salaryForWorkedDays', 'Salary for Worked Days'],
  ['leaveEncashment', 'Leave Encashment'],
  ['extraSalaryIncentive', 'Extra Salary / Incentive'],
  ['pendingReimbursements', 'Approved Reimbursements'],
  ['otherApprovedPayables', 'Other Approved Payables'],
];

const DEDUCTION_FIELDS = [
  ['salaryAdvance', 'Salary Advance'],
  ['noticePeriodRecovery', 'Notice Period Recovery'],
  ['assetRecovery', 'Asset Recovery'],
  ['otherApprovedDeductions', 'Other Approved Deductions'],
  ['otherAdjustments', 'Other Adjustments'],
];

const emptyForm = {
  userId: '',
  lastWorkingDay: '',
  earnings: {},
  deductions: {},
};

const responseData = (response) => response?.data?.data ?? response?.data ?? null;

const money = (value) => {
  const num = Number(value || 0);
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;
};

const dateValue = (value) => {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

const dateInputValue = (value) => {
  if (!value) return '';
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

const personName = (user, snapshot) => {
  const combined = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return combined || user?.personalInfo?.fullName || snapshot?.name || user?.email || 'Unknown employee';
};

const personId = (user, snapshot) => user?.jobDetails?.employeeId || snapshot?.employeeId || '—';
const personDepartment = (user, snapshot) => user?.department || user?.jobDetails?.department || snapshot?.department || '—';
const personDesignation = (user, snapshot) => user?.designation || user?.jobDetails?.designation || snapshot?.designation || '—';

const getInitials = (name) => {
  if (!name) return 'EM';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getAvatarColor = (name) => {
  const colors = [
    '#EA580C', '#2563eb', '#7c3aed', '#059669', '#d97706',
    '#dc2626', '#0891b2', '#4f46e5', '#ca8a04', '#0d9488'
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function FullAndFinalSettlement() {
  const { user: authUser } = useContext(AppContext);

  // 7 Internal Tabs: 'Overview', 'Settlements', 'Clearance', 'Calculations', 'Approvals', 'Payments', 'History'
  const [activeTab, setActiveTab] = useState('Settlements');

  // Core Data State
  const [settlements, setSettlements] = useState([]);
  const [summary, setSummary] = useState({});
  const [eligibleEmployees, setEligibleEmployees] = useState([]);

  // Search & Filter State
  const [filters, setFilters] = useState({
    search: '',
    department: 'All',
    status: 'All',
    clearanceStatus: 'All',
    paymentStatus: 'All',
    dateFrom: '',
    dateTo: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Modals & Drawers
  const [editor, setEditor] = useState(null); // 'create' | 'edit'
  const [selected, setSelected] = useState(null); // Full Detail Drawer
  const [actionMenuOpenId, setActionMenuOpenId] = useState(null);

  const [clearanceModal, setClearanceModal] = useState(null); // { row, departmentKey, status, remarks }
  const [reviewModal, setReviewModal] = useState(null); // { row, type: 'hr'|'finance', remarks, sendToFinance, requestRevision }
  const [holdModal, setHoldModal] = useState(null); // { row, reason }
  const [rejectModal, setRejectModal] = useState(null); // { row, reason }
  const [paymentModal, setPaymentModal] = useState(null); // { row, paymentMethod, paymentReference, paymentDate, remarks }

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = () => setActionMenuOpenId(null);
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Fetch Data from MongoDB Atlas
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value && value !== 'All')
      );
      const [listResponse, summaryResponse] = await Promise.all([
        apiClient.get('/full-and-final-settlements', { params: query }),
        apiClient.get('/full-and-final-settlements/summary'),
      ]);
      const list = responseData(listResponse);
      setSettlements(Array.isArray(list) ? list : (list?.settlements || []));
      setSummary(responseData(summaryResponse) || {});
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data || err.message || 'Unable to load settlement records from database.';
      setError(typeof errMsg === 'string' ? errMsg : 'Unable to load settlement records.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived Unique Departments
  const departments = useMemo(() => {
    return [...new Set(settlements.map((row) => personDepartment(row.user, row.employeeSnapshot)).filter((v) => v && v !== '—'))].sort();
  }, [settlements]);

  // Open Create Settlement Form
  const openCreate = async () => {
    setError('');
    setLoadingEligible(true);
    try {
      const response = await apiClient.get('/full-and-final-settlements/eligible-employees');
      const employees = responseData(response) || [];
      setEligibleEmployees(employees);
      setEditor({ mode: 'create', form: { ...emptyForm } });
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data || err.message || 'Unable to load eligible employees.';
      setError(typeof errMsg === 'string' ? errMsg : 'Unable to load eligible employees.');
    } finally {
      setLoadingEligible(false);
    }
  };

  // Open Edit Form (Restricted to permitted fields)
  const openEdit = (row) => {
    setActionMenuOpenId(null);
    setEditor({
      mode: 'edit',
      record: row,
      form: {
        userId: row.user?._id || row.user,
        lastWorkingDay: dateInputValue(row.lastWorkingDay),
        earnings: {
          pendingSalary: row.earnings?.pendingSalary ?? 0,
          salaryForWorkedDays: row.earnings?.salaryForWorkedDays ?? 0,
          leaveEncashment: row.earnings?.leaveEncashment ?? 0,
          extraSalaryIncentive: row.earnings?.extraSalaryIncentive ?? row.earnings?.bonusIncentives ?? 0,
          pendingReimbursements: row.earnings?.pendingReimbursements ?? 0,
          otherApprovedPayables: row.earnings?.otherApprovedPayables ?? row.earnings?.otherEarnings ?? 0,
        },
        deductions: {
          salaryAdvance: row.deductions?.salaryAdvance ?? row.deductions?.loansAdvancesRecovery ?? 0,
          noticePeriodRecovery: row.deductions?.noticePeriodRecovery ?? 0,
          assetRecovery: row.deductions?.assetRecovery ?? 0,
          otherApprovedDeductions: row.deductions?.otherApprovedDeductions ?? row.deductions?.otherDeductions ?? 0,
          otherAdjustments: row.deductions?.otherAdjustments ?? 0,
        },
      },
    });
  };

  const updateAmount = (section, key, value) => {
    setEditor((current) => ({
      ...current,
      form: {
        ...current.form,
        [section]: {
          ...current.form[section],
          [key]: value === '' ? '' : Math.max(0, Number(value)),
        },
      },
    }));
  };

  // Live Automatic Form Totals (SYSTEM CALCULATED)
  const calculateFormTotals = useMemo(() => {
    if (!editor) return { gross: 0, deductions: 0, net: 0 };
    const gross = Object.values(editor.form.earnings || {}).reduce((acc, v) => acc + (Number(v) || 0), 0);
    const deductions = Object.values(editor.form.deductions || {}).reduce((acc, v) => acc + (Number(v) || 0), 0);
    const net = Math.max(0, gross - deductions);
    return { gross, deductions, net };
  }, [editor]);

  // Save Settlement Create / Edit
  const saveEditor = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (editor.mode === 'create') {
        await apiClient.post('/full-and-final-settlements', editor.form);
        setNotice('Full & Final Settlement initiated successfully in MongoDB Atlas.');
      } else {
        await apiClient.patch(`/full-and-final-settlements/${editor.record._id}`, editor.form);
        setNotice('Settlement values updated successfully.');
      }
      setEditor(null);
      await loadData();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data || err.message || 'Unable to save settlement.';
      setError(typeof errMsg === 'string' ? errMsg : 'Unable to save settlement.');
    } finally {
      setSaving(false);
    }
  };

  // Run Backend Action Endpoint
  const runAction = async (row, action, body = {}) => {
    setActionMenuOpenId(null);
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await apiClient.post(`/full-and-final-settlements/${row._id}/${action}`, body);
      setNotice(`Settlement status updated: ${action.replace(/-/g, ' ')} successfully.`);
      await loadData();
      if (selected?._id === row._id) {
        const refreshed = await apiClient.get(`/full-and-final-settlements/${row._id}`);
        setSelected(responseData(refreshed));
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data || err.message || `Unable to ${action.replace(/-/g, ' ')} settlement.`;
      setError(typeof errMsg === 'string' ? errMsg : `Unable to ${action.replace(/-/g, ' ')} settlement.`);
    } finally {
      setSaving(false);
    }
  };

  // Clearance Status Update
  const handleConfirmClearance = async (e) => {
    e.preventDefault();
    if (!clearanceModal) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await apiClient.patch(`/full-and-final-settlements/${clearanceModal.row._id}/clearance`, {
        departmentKey: clearanceModal.departmentKey,
        status: clearanceModal.status || 'Cleared',
        remarks: clearanceModal.remarks || '',
      });
      setNotice(`${clearanceModal.departmentKey.toUpperCase()} clearance updated.`);
      setClearanceModal(null);
      await loadData();
      if (selected?._id === clearanceModal.row._id) {
        const refreshed = await apiClient.get(`/full-and-final-settlements/${clearanceModal.row._id}`);
        setSelected(responseData(refreshed));
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data || err.message || 'Unable to update clearance.';
      setError(typeof errMsg === 'string' ? errMsg : 'Unable to update clearance.');
    } finally {
      setSaving(false);
    }
  };

  // HR Review Submission
  const handleConfirmReview = async (e) => {
    e.preventDefault();
    if (!reviewModal) return;
    const endpoint = reviewModal.type === 'finance' ? 'finance-review' : 'hr-review';
    await runAction(reviewModal.row, endpoint, {
      remarks: reviewModal.remarks || '',
      sendToFinance: reviewModal.sendToFinance ?? true,
      requestRevision: reviewModal.requestRevision ?? false,
    });
    setReviewModal(null);
  };

  // Hold Submission (Mandatory Reason)
  const handleConfirmHold = async (e) => {
    e.preventDefault();
    if (!holdModal?.reason?.trim()) return;
    await runAction(holdModal.row, 'hold', { reason: holdModal.reason.trim() });
    setHoldModal(null);
  };

  // Reject Submission
  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectModal?.reason?.trim()) return;
    await runAction(rejectModal.row, 'reject', { reason: rejectModal.reason.trim() });
    setRejectModal(null);
  };

  // Payment Processing Submission (Reuses Payments Collection)
  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!paymentModal) return;
    await runAction(paymentModal.row, 'mark-paid', {
      paymentMethod: paymentModal.paymentMethod || 'Bank Transfer',
      paymentReference: paymentModal.paymentReference || '',
      paymentDate: paymentModal.paymentDate || new Date().toISOString(),
      remarks: paymentModal.remarks || 'Full and final settlement disbursement',
    });
    setPaymentModal(null);
  };

  // Print F&F Statement
  const openStatement = async (row) => {
    setActionMenuOpenId(null);
    try {
      const response = await apiClient.get(`/full-and-final-settlements/${row._id}/statement`, { responseType: 'text' });
      const statementWindow = window.open('', '_blank', 'noopener,noreferrer');
      if (statementWindow) {
        statementWindow.document.write(response.data);
        statementWindow.document.close();
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data || err.message || 'Unable to generate statement.';
      setError(typeof errMsg === 'string' ? errMsg : 'Unable to generate statement.');
    }
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      department: 'All',
      status: 'All',
      clearanceStatus: 'All',
      paymentStatus: 'All',
      dateFrom: '',
      dateTo: '',
    });
  };

  // Check user permissions
  const isHrOrAdmin = ['admin', 'super_admin'].includes(authUser?.role) ||
    String(authUser?.department || authUser?.jobDetails?.department || '').trim().toUpperCase() === 'HR';
  const isFinanceOrAdmin = ['admin', 'super_admin'].includes(authUser?.role) ||
    String(authUser?.department || authUser?.jobDetails?.department || '').trim().toUpperCase() === 'FINANCE';

  return (
    <UserLayout pageTitle="Full & Final Settlement">
      <div className="fnf-page-container">
        
        {/* 4. PAGE HEADER */}
        <div className="fnf-header">
          <div className="fnf-header-title-area">
            <h2>Full &amp; Final Settlement</h2>
            <p>Manage employee final financial settlements after resignation and offboarding.</p>
          </div>
          <div className="fnf-header-actions">
            <button className="fnf-btn-primary" onClick={openCreate} disabled={loadingEligible}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>{loadingEligible ? 'Checking Eligibility...' : '+ Create F&F Settlement'}</span>
            </button>
          </div>
        </div>

        {/* Global Feedback Notifications */}
        {notice && (
          <div className="fnf-alert success">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <span>{notice}</span>
            <button className="fnf-alert-close" onClick={() => setNotice('')}>×</button>
          </div>
        )}
        {error && (
          <div className="fnf-alert error">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span>{error}</span>
            <button className="fnf-alert-close" onClick={() => setError('')}>×</button>
          </div>
        )}

        {/* 5. KPI SECTION — 6 Balanced Stat Cards matching HR Dashboard proportions */}
        <div className="fnf-kpi-grid">
          
          {/* 1. Total Settlements */}
          <div className="fnf-kpi-card blue" onClick={() => { setActiveTab('Settlements'); setFilters(f => ({ ...f, status: 'All' })); }}>
            <div className="fnf-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            </div>
            <div className="fnf-kpi-body">
              <span className="fnf-kpi-title">Total Settlements</span>
              <span className="fnf-kpi-value">{summary.totalSettlements || 0}</span>
              <span className="fnf-kpi-meta muted">Database Total</span>
            </div>
          </div>

          {/* 2. Pending Calculation */}
          <div className="fnf-kpi-card amber" onClick={() => { setActiveTab('Settlements'); setFilters(f => ({ ...f, status: 'Calculation Pending' })); }}>
            <div className="fnf-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <div className="fnf-kpi-body">
              <span className="fnf-kpi-title">Pending Calculation</span>
              <span className="fnf-kpi-value">{summary.calculationPending || 0}</span>
              <span className="fnf-kpi-meta amber">Awaiting Computation</span>
            </div>
          </div>

          {/* 3. Pending Clearance */}
          <div className="fnf-kpi-card indigo" onClick={() => { setActiveTab('Clearance'); }}>
            <div className="fnf-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </div>
            <div className="fnf-kpi-body">
              <span className="fnf-kpi-title">Pending Clearance</span>
              <span className="fnf-kpi-value">{summary.clearancePending || 0}</span>
              <span className="fnf-kpi-meta indigo">Dept / IT / Admin / Fin</span>
            </div>
          </div>

          {/* 4. Pending Approval */}
          <div className="fnf-kpi-card purple" onClick={() => { setActiveTab('Approvals'); }}>
            <div className="fnf-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>
            </div>
            <div className="fnf-kpi-body">
              <span className="fnf-kpi-title">Pending Approval</span>
              <span className="fnf-kpi-value">{(summary.approvalPending || 0) + (summary.hrReview || 0) + (summary.financeReview || 0)}</span>
              <span className="fnf-kpi-meta purple">HR / Finance / Final</span>
            </div>
          </div>

          {/* 5. Payment Pending */}
          <div className="fnf-kpi-card rose" onClick={() => { setActiveTab('Payments'); }}>
            <div className="fnf-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
            </div>
            <div className="fnf-kpi-body">
              <span className="fnf-kpi-title">Payment Pending</span>
              <span className="fnf-kpi-value">{summary.paymentPending || 0}</span>
              <span className="fnf-kpi-meta rose">Disbursement Due</span>
            </div>
          </div>

          {/* 6. Completed */}
          <div className="fnf-kpi-card green" onClick={() => { setActiveTab('Settlements'); setFilters(f => ({ ...f, status: 'Completed' })); }}>
            <div className="fnf-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
            <div className="fnf-kpi-body">
              <span className="fnf-kpi-title">Completed</span>
              <span className="fnf-kpi-value">{(summary.completed || 0) + (summary.paidCount || 0)}</span>
              <span className="fnf-kpi-meta success">Settled &amp; Archived</span>
            </div>
          </div>

        </div>

        {/* 6. INTERNAL PAGE TABS (Kept INSIDE Full & Final Settlement) */}
        <div className="fnf-tabs-nav">
          {['Overview', 'Settlements', 'Clearance', 'Calculations', 'Approvals', 'Payments', 'History'].map((tab) => (
            <button
              key={tab}
              className={`fnf-tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {tab === 'Settlements' && <span className="fnf-tab-count">{settlements.length}</span>}
              {tab === 'Approvals' && summary.approvalPending > 0 && <span className="fnf-tab-badge amber">{summary.approvalPending}</span>}
              {tab === 'Payments' && summary.paymentPending > 0 && <span className="fnf-tab-badge rose">{summary.paymentPending}</span>}
            </button>
          ))}
        </div>

        {/* 7. SEARCH & FILTERS BAR */}
        <div className="fnf-filter-toolbar">
          <div className="fnf-search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input
              type="text"
              placeholder="Search by Employee Name, ID, or Settlement ID..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          <select className="fnf-select" value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })}>
            <option value="All">All Departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <select className="fnf-select" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            {WORKFLOW_STATUSES.map((s) => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
          </select>

          <select className="fnf-select" value={filters.clearanceStatus} onChange={(e) => setFilters({ ...filters, clearanceStatus: e.target.value })}>
            <option value="All">All Clearance</option>
            <option value="Cleared">All Cleared</option>
            <option value="Pending">Clearance Pending</option>
          </select>

          <select className="fnf-select" value={filters.paymentStatus} onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}>
            <option value="All">All Payment Status</option>
            <option value="Paid">Paid</option>
            <option value="Payment Pending">Payment Pending</option>
            <option value="Unpaid">Unpaid</option>
          </select>

          <div className="fnf-date-range">
            <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className="fnf-date-input" title="LWD From" />
            <span>–</span>
            <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className="fnf-date-input" title="LWD To" />
          </div>

          <div className="fnf-filter-actions">
            {(filters.search || filters.department !== 'All' || filters.status !== 'All' || filters.clearanceStatus !== 'All' || filters.paymentStatus !== 'All' || filters.dateFrom || filters.dateTo) && (
              <button className="fnf-btn-clear" onClick={clearFilters}>Clear</button>
            )}
            <button className="fnf-btn-icon" onClick={loadData} title="Refresh Live Atlas Data">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
            </button>
          </div>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'Overview' && (
          <div className="fnf-tab-pane">
            <div className="fnf-overview-grid">
              
              {/* Left Column: Settlement Pipeline Status */}
              <div className="fnf-card">
                <div className="fnf-card-header">
                  <h3>Settlement Workflow Pipeline</h3>
                  <span className="fnf-badge-neutral">{settlements.length} Active Records</span>
                </div>
                <div className="fnf-pipeline-list">
                  {[
                    { label: 'Clearance & Calculation', count: (summary.calculationPending || 0) + (summary.clearancePending || 0), color: '#d97706' },
                    { label: 'HR & Finance Review', count: (summary.hrReview || 0) + (summary.financeReview || 0), color: '#7c3aed' },
                    { label: 'Approval Pending', count: summary.approvalPending || 0, color: '#ea580c' },
                    { label: 'Payment Pending', count: summary.paymentPending || 0, color: '#e11d48' },
                    { label: 'Paid & Completed', count: (summary.completed || 0) + (summary.paidCount || 0), color: '#059669' },
                  ].map((stage, idx) => (
                    <div key={idx} className="fnf-pipeline-item">
                      <div className="fnf-pipeline-info">
                        <strong>{stage.label}</strong>
                        <span>{stage.count} settlements</span>
                      </div>
                      <div className="fnf-pipeline-bar-track">
                        <div
                          className="fnf-pipeline-bar-fill"
                          style={{
                            width: `${settlements.length > 0 ? (stage.count / settlements.length) * 100 : 0}%`,
                            backgroundColor: stage.color,
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Financial Payout Ledger */}
              <div className="fnf-card">
                <div className="fnf-card-header">
                  <h3>Financial Overview</h3>
                  <span className="fnf-badge-neutral">MongoDB Atlas</span>
                </div>
                <div className="fnf-financial-stat-box">
                  <div className="fnf-fin-metric">
                    <span>Total Net Settlements</span>
                    <strong className="text-orange">{money(summary.totalNetPayable)}</strong>
                  </div>
                  <div className="fnf-fin-split-grid">
                    <div>
                      <label>Disbursed (Paid)</label>
                      <span className="text-success">{summary.paidCount || 0} records</span>
                    </div>
                    <div>
                      <label>Pending Payout</label>
                      <span className="text-danger">{summary.paymentPending || 0} records</span>
                    </div>
                    <div>
                      <label>On Hold</label>
                      <span className="text-amber">{summary.onHoldCount || 0} records</span>
                    </div>
                    <div>
                      <label>Archived Completed</label>
                      <span className="text-muted">{summary.completed || 0} records</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: SETTLEMENTS (MAIN SETTLEMENT TABLE) */}
        {activeTab === 'Settlements' && (
          <div className="fnf-tab-pane">
            <div className="fnf-table-card">
              <div className="fnf-table-responsive">
                <table className="fnf-table">
                  <thead>
                    <tr>
                      <th style={{ width: '22%' }}>Employee</th>
                      <th style={{ width: '11%' }}>Employee ID</th>
                      <th style={{ width: '12%' }}>Department</th>
                      <th style={{ width: '12%' }}>Last Working Date</th>
                      <th style={{ width: '13%', textAlign: 'right' }}>Settlement Amount</th>
                      <th style={{ width: '11%' }}>Status</th>
                      <th style={{ width: '10%' }}>Payment Status</th>
                      <th style={{ width: '11%' }}>Updated Date</th>
                      <th style={{ width: '18%', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan="9" className="fnf-empty-cell">
                          <div className="fnf-spinner"></div>
                          <p>Loading settlements from database...</p>
                        </td>
                      </tr>
                    )}

                    {!loading && settlements.length === 0 && (
                      <tr>
                        <td colSpan="9" className="fnf-empty-cell">
                          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                          <h4>No Settlement Records Found</h4>
                          <p>Click "+ Create F&amp;F Settlement" to initiate settlement for an exiting employee.</p>
                          <button className="fnf-btn-primary" onClick={openCreate} disabled={loadingEligible}>
                            + Create F&amp;F Settlement
                          </button>
                        </td>
                      </tr>
                    )}

                    {!loading && settlements.map((row) => {
                      const empName = personName(row.user, row.employeeSnapshot);
                      const empCode = personId(row.user, row.employeeSnapshot);
                      const empDept = personDepartment(row.user, row.employeeSnapshot);

                      const statusSlug = String(row.status || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                      const payStatus = row.payment?.paymentStatus || (row.status === 'Paid' ? 'Paid' : (row.status === 'Payment Pending' ? 'Payment Pending' : 'Unpaid'));

                      return (
                        <tr key={row._id} className="fnf-table-row" onClick={() => setSelected(row)}>
                          <td>
                            <div className="fnf-emp-cell">
                              <div className="fnf-avatar" style={{ backgroundColor: getAvatarColor(empName) }}>
                                {getInitials(empName)}
                              </div>
                              <div className="fnf-emp-meta">
                                <strong>{empName}</strong>
                                <span>{row.user?.email || ''}</span>
                              </div>
                            </div>
                          </td>
                          <td><span className="fnf-code-tag">{empCode}</span></td>
                          <td><span className="fnf-text-dim">{empDept}</span></td>
                          <td><span className="fnf-text-dim">{dateValue(row.lastWorkingDay)}</span></td>
                          <td style={{ textAlign: 'right' }}>
                            <strong className="fnf-amount-text">{money(row.netPayable)}</strong>
                          </td>
                          <td>
                            <span className={`fnf-status-pill st-${statusSlug}`}>
                              {row.status}
                            </span>
                          </td>
                          <td>
                            <span className={`fnf-pay-pill ${payStatus.toLowerCase().replace(/[^a-z0-9]/g, '')}`}>
                              {payStatus}
                            </span>
                          </td>
                          <td><span className="fnf-text-dim">{dateValue(row.updatedAt || row.createdAt)}</span></td>
                          <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                            <div className="fnf-actions-inline">
                              <button className="fnf-btn-row-action view" onClick={() => setSelected(row)} title="View Complete 360° Details">
                                View
                              </button>
                              {isHrOrAdmin && (
                                <button className="fnf-btn-row-action edit" onClick={() => openEdit(row)} title="Edit Settlement Inputs">
                                  Edit
                                </button>
                              )}
                              <button className="fnf-btn-row-action history" onClick={() => { setActiveTab('History'); setFilters(f => ({ ...f, search: empName })); }} title="View Settlement History">
                                History
                              </button>

                              {/* Contextual Action Button based on Workflow */}
                              {row.status === 'Clearance Pending' && (
                                <button className="fnf-btn-row-action primary" onClick={() => { setSelected(row); setActiveTab('Clearance'); }}>
                                  Clearance
                                </button>
                              )}
                              {['Calculation Pending', 'Draft', 'Pending', 'In Progress'].includes(row.status) && isHrOrAdmin && (
                                <button className="fnf-btn-row-action primary" onClick={() => setReviewModal({ row, type: 'hr', remarks: '', sendToFinance: true })}>
                                  Review
                                </button>
                              )}
                              {row.status === 'HR Review' && isHrOrAdmin && (
                                <button className="fnf-btn-row-action purple" onClick={() => setReviewModal({ row, type: 'hr', remarks: '', sendToFinance: true })}>
                                  To Finance
                                </button>
                              )}
                              {row.status === 'Finance Review' && isFinanceOrAdmin && (
                                <button className="fnf-btn-row-action cyan" onClick={() => setReviewModal({ row, type: 'finance', remarks: '', requestRevision: false })}>
                                  Verify
                                </button>
                              )}
                              {row.status === 'Approval Pending' && (isHrOrAdmin || isFinanceOrAdmin) && (
                                <button className="fnf-btn-row-action success" onClick={() => runAction(row, 'approve')}>
                                  Approve
                                </button>
                              )}
                              {row.status === 'Payment Pending' && isFinanceOrAdmin && (
                                <button className="fnf-btn-row-action rose" onClick={() => setPaymentModal({ row, paymentMethod: 'Bank Transfer', paymentReference: '', paymentDate: new Date().toISOString().slice(0, 10), remarks: '' })}>
                                  Pay
                                </button>
                              )}
                              {row.status === 'Paid' && isHrOrAdmin && (
                                <button className="fnf-btn-row-action success" onClick={() => runAction(row, 'complete')}>
                                  Complete
                                </button>
                              )}
                              {row.status === 'On Hold' && (isHrOrAdmin || isFinanceOrAdmin) && (
                                <button className="fnf-btn-row-action amber" onClick={() => runAction(row, 'resume')}>
                                  Resume
                                </button>
                              )}

                              {/* More Dropdown */}
                              <div className="fnf-more-wrap">
                                <button
                                  className="fnf-btn-more-dots"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActionMenuOpenId(actionMenuOpenId === row._id ? null : row._id);
                                  }}
                                >
                                  •••
                                </button>
                                {actionMenuOpenId === row._id && (
                                  <div className="fnf-more-menu">
                                    <button onClick={() => { setActionMenuOpenId(null); setSelected(row); }}>
                                      View Details
                                    </button>
                                    {['Draft', 'Calculation Pending', 'Clearance Pending', 'Pending', 'In Progress'].includes(row.status) && isHrOrAdmin && (
                                      <button onClick={() => openEdit(row)}>
                                        Edit Inputs
                                      </button>
                                    )}
                                    {['Draft', 'Calculation Pending', 'Clearance Pending', 'Pending', 'In Progress', 'HR Review'].includes(row.status) && (
                                      <button onClick={() => runAction(row, 'calculate')}>
                                        Recalculate Data
                                      </button>
                                    )}
                                    {!['Completed', 'Paid', 'On Hold', 'Rejected'].includes(row.status) && (
                                      <button onClick={() => { setActionMenuOpenId(null); setHoldModal({ row, reason: '' }); }}>
                                        Put On Hold
                                      </button>
                                    )}
                                    {['Approval Pending', 'HR Review', 'Finance Review'].includes(row.status) && (
                                      <button className="text-danger" onClick={() => { setActionMenuOpenId(null); setRejectModal({ row, reason: '' }); }}>
                                        Reject Settlement
                                      </button>
                                    )}
                                    <div className="fnf-menu-divider"></div>
                                    <button onClick={() => openStatement(row)}>
                                      Print F&amp;F Statement
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CLEARANCE */}
        {activeTab === 'Clearance' && (
          <div className="fnf-tab-pane">
            <div className="fnf-card">
              <div className="fnf-card-header">
                <div>
                  <h3>4-Pillar Clearance Management</h3>
                  <p className="fnf-text-dim">Department, IT, Administration, and Finance clearance status synchronization.</p>
                </div>
              </div>

              <div className="fnf-clearance-grid">
                {settlements.map((row) => {
                  const empName = personName(row.user, row.employeeSnapshot);
                  const clr = row.clearance || {};
                  return (
                    <div key={row._id} className="fnf-clearance-card">
                      <div className="fnf-clearance-card-head">
                        <div className="fnf-emp-cell">
                          <div className="fnf-avatar sm" style={{ backgroundColor: getAvatarColor(empName) }}>
                            {getInitials(empName)}
                          </div>
                          <div>
                            <strong>{empName}</strong>
                            <span className="fnf-text-dim">{personId(row.user, row.employeeSnapshot)} · {personDepartment(row.user, row.employeeSnapshot)}</span>
                          </div>
                        </div>
                        <span className={`fnf-status-pill st-${String(row.status || '').toLowerCase().replace(/[^a-z0-9]/g, '')}`}>{row.status}</span>
                      </div>

                      <div className="fnf-clearance-pillars">
                        {[
                          { key: 'department', label: 'Department Clearance' },
                          { key: 'it', label: 'IT Assets Clearance' },
                          { key: 'administration', label: 'Admin / KT Clearance' },
                          { key: 'finance', label: 'Finance Clearance' },
                        ].map(({ key, label }) => {
                          const item = clr[key] || { status: 'Pending' };
                          const isCleared = ['Cleared', 'Completed'].includes(item.status);
                          return (
                            <div key={key} className={`fnf-pillar-box ${isCleared ? 'cleared' : 'pending'}`}>
                              <div className="fnf-pillar-head">
                                <span className="fnf-pillar-name">{label}</span>
                                <span className={`fnf-pillar-badge ${isCleared ? 'cleared' : 'pending'}`}>{item.status || 'Pending'}</span>
                              </div>
                              <div className="fnf-pillar-body">
                                <div><label>Completed By:</label><span>{item.completedBy || '—'}</span></div>
                                <div><label>Date:</label><span>{dateValue(item.completedDate)}</span></div>
                                {item.remarks && <p className="fnf-pillar-remarks">"{item.remarks}"</p>}
                              </div>
                              {row.status !== 'Completed' && (
                                <button
                                  className="fnf-pillar-btn"
                                  onClick={() => setClearanceModal({ row, departmentKey: key, status: isCleared ? 'Pending' : 'Cleared', remarks: item.remarks || '' })}
                                >
                                  {isCleared ? 'Edit Clearance' : 'Mark Cleared'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CALCULATIONS */}
        {activeTab === 'Calculations' && (
          <div className="fnf-tab-pane">
            <div className="fnf-card">
              <div className="fnf-card-header">
                <div>
                  <h3>System Calculated Financial Ledgers</h3>
                  <p className="fnf-text-dim">Earnings, statutory recoveries, and final derived settlement amounts.</p>
                </div>
              </div>

              <div className="fnf-calculations-grid">
                {settlements.map((row) => {
                  const empName = personName(row.user, row.employeeSnapshot);
                  return (
                    <div key={row._id} className="fnf-calc-card">
                      <div className="fnf-calc-card-head">
                        <div>
                          <h4>{empName}</h4>
                          <span className="fnf-text-dim">{personId(row.user, row.employeeSnapshot)} · LWD: {dateValue(row.lastWorkingDay)}</span>
                        </div>
                        <div className="fnf-calc-total-pill">
                          <span>SYSTEM CALCULATED</span>
                          <strong>{money(row.netPayable)}</strong>
                        </div>
                      </div>

                      <div className="fnf-ledger-split">
                        {/* Earnings */}
                        <div className="fnf-ledger-col">
                          <h5>Earnings / Payables (+)</h5>
                          {EARNING_FIELDS.map(([k, lbl]) => (
                            <div key={k} className="fnf-ledger-row">
                              <span>{lbl}</span>
                              <strong>{money(row.earnings?.[k])}</strong>
                            </div>
                          ))}
                          <div className="fnf-ledger-subtotal text-success">
                            <span>Gross Earnings</span>
                            <strong>{money(row.grossEarnings)}</strong>
                          </div>
                        </div>

                        {/* Deductions */}
                        <div className="fnf-ledger-col">
                          <h5>Deductions / Recoveries (−)</h5>
                          {DEDUCTION_FIELDS.map(([k, lbl]) => (
                            <div key={k} className="fnf-ledger-row">
                              <span>{lbl}</span>
                              <strong>{money(row.deductions?.[k])}</strong>
                            </div>
                          ))}
                          <div className="fnf-ledger-subtotal text-danger">
                            <span>Total Deductions</span>
                            <strong>{money(row.totalDeductions)}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="fnf-calc-footer">
                        <span>Derived Net Payable: <strong>{money(row.netPayable)}</strong></span>
                        <div className="fnf-calc-actions">
                          {['Draft', 'Calculation Pending', 'Pending', 'In Progress'].includes(row.status) && (
                            <button className="fnf-btn-row-action" onClick={() => runAction(row, 'calculate')}>Recalculate</button>
                          )}
                          <button className="fnf-btn-row-action" onClick={() => openStatement(row)}>Statement</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: APPROVALS */}
        {activeTab === 'Approvals' && (
          <div className="fnf-tab-pane">
            <div className="fnf-card">
              <div className="fnf-card-header">
                <div>
                  <h3>Review &amp; Approval Queue</h3>
                  <p className="fnf-text-dim">HR Review, Finance Verification, and Final Management Sign-off.</p>
                </div>
              </div>

              <div className="fnf-approvals-list">
                {settlements
                  .filter((row) => ['HR Review', 'Finance Review', 'Approval Pending'].includes(row.status))
                  .map((row) => {
                    const empName = personName(row.user, row.employeeSnapshot);
                    return (
                      <div key={row._id} className="fnf-approval-item">
                        <div className="fnf-approval-left">
                          <div className="fnf-avatar md" style={{ backgroundColor: getAvatarColor(empName) }}>
                            {getInitials(empName)}
                          </div>
                          <div>
                            <h4>{empName}</h4>
                            <span className="fnf-text-dim">{personId(row.user, row.employeeSnapshot)} · {personDepartment(row.user, row.employeeSnapshot)} · LWD: {dateValue(row.lastWorkingDay)}</span>
                            <div className="fnf-approval-status-tag">
                              <span className={`fnf-status-pill st-${String(row.status || '').toLowerCase().replace(/[^a-z0-9]/g, '')}`}>{row.status}</span>
                              <span className="fnf-amount-highlight">Net: {money(row.netPayable)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="fnf-approval-actions">
                          {row.status === 'HR Review' && isHrOrAdmin && (
                            <>
                              <button className="fnf-btn-primary" onClick={() => setReviewModal({ row, type: 'hr', remarks: '', sendToFinance: true })}>
                                Forward to Finance
                              </button>
                              <button className="fnf-btn-amber" onClick={() => setHoldModal({ row, reason: '' })}>
                                Put On Hold
                              </button>
                            </>
                          )}

                          {row.status === 'Finance Review' && isFinanceOrAdmin && (
                            <>
                              <button className="fnf-btn-primary" onClick={() => setReviewModal({ row, type: 'finance', remarks: '', requestRevision: false })}>
                                Verify &amp; Sign-off
                              </button>
                              <button className="fnf-btn-outline" onClick={() => setReviewModal({ row, type: 'finance', remarks: '', requestRevision: true })}>
                                Request Revision
                              </button>
                            </>
                          )}

                          {row.status === 'Approval Pending' && (isHrOrAdmin || isFinanceOrAdmin) && (
                            <>
                              <button className="fnf-btn-success" onClick={() => runAction(row, 'approve')}>
                                Final Approve
                              </button>
                              <button className="fnf-btn-danger" onClick={() => setRejectModal({ row, reason: '' })}>
                                Reject
                              </button>
                            </>
                          )}

                          <button className="fnf-btn-outline" onClick={() => setSelected(row)}>
                            Review Details
                          </button>
                        </div>
                      </div>
                    );
                  })}

                {settlements.filter((r) => ['HR Review', 'Finance Review', 'Approval Pending'].includes(r.status)).length === 0 && (
                  <div className="fnf-empty-state">
                    <p>No settlements currently pending HR Review, Finance Verification, or Management Approval.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: PAYMENTS */}
        {activeTab === 'Payments' && (
          <div className="fnf-tab-pane">
            <div className="fnf-card">
              <div className="fnf-card-header">
                <div>
                  <h3>Disbursement &amp; Payment Processing</h3>
                  <p className="fnf-text-dim">Reuses the existing Payments system to record bank transfers and transaction references.</p>
                </div>
              </div>

              <div className="fnf-payments-table-wrap">
                <table className="fnf-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Settlement Amount</th>
                      <th>Status</th>
                      <th>Payment Method</th>
                      <th>Txn / UTR Reference</th>
                      <th>Payment Date</th>
                      <th style={{ textAlign: 'right' }}>Disbursement Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements
                      .filter((row) => ['Payment Pending', 'Payment Processing', 'Paid', 'Approved'].includes(row.status))
                      .map((row) => {
                        const empName = personName(row.user, row.employeeSnapshot);
                        const isPaid = row.status === 'Paid' || row.payment?.paymentStatus === 'Paid';
                        return (
                          <tr key={row._id}>
                            <td>
                              <div className="fnf-emp-cell">
                                <div className="fnf-avatar sm" style={{ backgroundColor: getAvatarColor(empName) }}>{getInitials(empName)}</div>
                                <div>
                                  <strong>{empName}</strong>
                                  <span className="fnf-text-dim">{personId(row.user, row.employeeSnapshot)}</span>
                                </div>
                              </div>
                            </td>
                            <td><strong className="text-orange">{money(row.netPayable)}</strong></td>
                            <td>
                              <span className={`fnf-status-pill st-${String(row.status || '').toLowerCase().replace(/[^a-z0-9]/g, '')}`}>{row.status}</span>
                            </td>
                            <td>{row.payment?.paymentMethod || 'Bank Transfer'}</td>
                            <td><span className="fnf-code-tag">{row.payment?.paymentReference || 'Pending'}</span></td>
                            <td>{dateValue(row.payment?.paymentDate)}</td>
                            <td style={{ textAlign: 'right' }}>
                              {!isPaid ? (
                                <button
                                  className="fnf-btn-primary"
                                  onClick={() => setPaymentModal({ row, paymentMethod: 'Bank Transfer', paymentReference: '', paymentDate: new Date().toISOString().slice(0, 10), remarks: '' })}
                                >
                                  Process Disbursement
                                </button>
                              ) : (
                                <button className="fnf-btn-outline" onClick={() => openStatement(row)}>
                                  View Statement
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: HISTORY */}
        {activeTab === 'History' && (
          <div className="fnf-tab-pane">
            <div className="fnf-card">
              <div className="fnf-card-header">
                <div>
                  <h3>Full Audit Trail &amp; Lifecycle Events</h3>
                  <p className="fnf-text-dim">Timestamped audit logs persisted in MongoDB Atlas for complete compliance.</p>
                </div>
              </div>

              <div className="fnf-history-feed">
                {settlements.flatMap((row) => (row.history || []).map((h, i) => ({ ...h, settlement: row, key: `${row._id}-${i}` })))
                  .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
                  .slice(0, 40)
                  .map((item) => (
                    <div key={item.key} className="fnf-feed-item">
                      <div className="fnf-feed-dot"></div>
                      <div className="fnf-feed-content">
                        <div className="fnf-feed-head">
                          <strong>{item.action}</strong>
                          <span className="fnf-text-dim">
                            for {personName(item.settlement?.user, item.settlement?.employeeSnapshot)} ({personId(item.settlement?.user, item.settlement?.employeeSnapshot)})
                          </span>
                          <time>{item.at ? new Date(item.at).toLocaleString('en-GB') : ''}</time>
                        </div>
                        {item.remarks && <p className="fnf-feed-note">{item.remarks}</p>}
                        <div className="fnf-feed-meta">
                          {item.previousStatus && item.newStatus && (
                            <span className="fnf-feed-trans">{item.previousStatus} → {item.newStatus}</span>
                          )}
                          <span className="fnf-feed-actor">By {item.performedByName || 'System'} ({item.role || 'HR'})</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL: CREATE / EDIT SETTLEMENT ================= */}
        {editor && createPortal(
          <div className="fnf-overlay" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && setEditor(null)}>
            <div className="fnf-form-modal animate-modal-scale">
              <div className="fnf-modal-header">
                <div>
                  <h2>{editor.mode === 'create' ? 'Create Full & Final Settlement' : 'Edit Settlement Inputs'}</h2>
                  <p className="fnf-modal-subtitle">{editor.mode === 'create' ? 'Select an existing employee to auto-derive calculations' : 'Financial input corrections'}</p>
                </div>
                <button className="fnf-btn-close" onClick={() => setEditor(null)} aria-label="Close modal">×</button>
              </div>

              <form onSubmit={saveEditor} className="fnf-form-inner">
                <div className="fnf-modal-form-content">
                  {/* 7. EMPLOYEE + DATE SECTION (Balanced Two Columns) */}
                  <div className="fnf-emp-date-grid">
                    {editor.mode === 'create' ? (
                      <div className="fnf-form-group">
                        <label className="required">Exited / Resigned Employee</label>
                        <select
                          required
                          className="fnf-input"
                          value={editor.form.userId}
                          onChange={(e) => {
                            const val = e.target.value;
                            const emp = eligibleEmployees.find((item) => String(item.userId || item._id) === String(val));
                            const lwd = emp?.lastWorkingDay || emp?.exitDate || new Date().toISOString().slice(0, 10);
                            setEditor({
                              ...editor,
                              form: {
                                ...editor.form,
                                userId: val,
                                lastWorkingDay: dateInputValue(lwd),
                              },
                            });
                          }}
                        >
                          <option value="">-- Select Exiting Employee --</option>
                          {eligibleEmployees.map((emp) => {
                            const empKey = String(emp.userId || emp._id);
                            const nameStr = emp.name || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.email;
                            const codeStr = emp.employeeId || 'No ID';
                            const deptStr = emp.department || 'General';
                            return (
                              <option key={empKey} value={empKey}>
                                {nameStr} ({codeStr}) — {deptStr} [{emp.employmentStatus || 'Notice'}]
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    ) : (
                      <div className="fnf-form-group">
                        <label>Employee</label>
                        <div className="fnf-readonly-field">
                          <strong>{personName(editor.record?.user, editor.record?.employeeSnapshot)}</strong>
                          <span className="fnf-text-dim">({personId(editor.record?.user, editor.record?.employeeSnapshot)})</span>
                        </div>
                      </div>
                    )}

                    <div className="fnf-form-group">
                      <label className="required">Last Working Date (Cutoff)</label>
                      <input
                        required
                        type="date"
                        className="fnf-input"
                        value={editor.form.lastWorkingDay}
                        onChange={(e) => setEditor({ ...editor, form: { ...editor.form, lastWorkingDay: e.target.value } })}
                      />
                    </div>
                  </div>

                  {/* 9. EMPLOYEE INFORMATION (Compact Summary Card/Grid) */}
                  {editor.form.userId && (() => {
                    const emp = eligibleEmployees.find((item) => String(item.userId || item._id) === String(editor.form.userId)) || editor.record?.employeeSnapshot || editor.record?.user;
                    if (!emp) return null;
                    const empName = emp.name || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.email;
                    const empCode = emp.employeeId || personId(editor.record?.user, editor.record?.employeeSnapshot) || '—';
                    const empDept = emp.department || personDepartment(editor.record?.user, editor.record?.employeeSnapshot) || '—';
                    const empPos = emp.designation || emp.position || personDesignation(editor.record?.user, editor.record?.employeeSnapshot) || '—';
                    const empJoin = emp.joiningDate || editor.record?.user?.jobDetails?.joiningDate || null;
                    const empLwd = editor.form.lastWorkingDay || emp.exitDate || emp.lastWorkingDay || null;
                    const noticeDays = emp.noticePeriodDays || 30;

                    return (
                      <div className="fnf-emp-compact-summary">
                        <div className="fnf-summary-item">
                          <span className="fnf-summary-label">Employee:</span>
                          <strong className="fnf-summary-val">{empName}</strong>
                        </div>
                        <div className="fnf-summary-item">
                          <span className="fnf-summary-label">Employee ID:</span>
                          <strong className="fnf-summary-val">{empCode}</strong>
                        </div>
                        <div className="fnf-summary-item">
                          <span className="fnf-summary-label">Department:</span>
                          <strong className="fnf-summary-val">{empDept}</strong>
                        </div>
                        <div className="fnf-summary-item">
                          <span className="fnf-summary-label">Position:</span>
                          <strong className="fnf-summary-val">{empPos}</strong>
                        </div>
                        <div className="fnf-summary-item">
                          <span className="fnf-summary-label">Joining Date:</span>
                          <strong className="fnf-summary-val">{dateValue(empJoin)}</strong>
                        </div>
                        <div className="fnf-summary-item">
                          <span className="fnf-summary-label">Last Working Date:</span>
                          <strong className="fnf-summary-val">{dateValue(empLwd)}</strong>
                        </div>
                        <div className="fnf-summary-item">
                          <span className="fnf-summary-label">Notice Period:</span>
                          <strong className="fnf-summary-val">{noticeDays} Days</strong>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 8. EARNINGS / PAYABLES (+) AND DEDUCTIONS / RECOVERIES (−) (TWO EQUAL COLUMNS) */}
                  <div className="fnf-calc-two-columns">
                    {/* LEFT: Earnings / Payables (+) */}
                    <div className="fnf-calc-box earnings">
                      <div className="fnf-calc-box-header text-success">
                        <h4>Earnings / Payables (+)</h4>
                        <span className="fnf-box-subtotal">{money(calculateFormTotals.gross)}</span>
                      </div>
                      <div className="fnf-calc-fields-list">
                        {EARNING_FIELDS.map(([k, lbl]) => (
                          <div key={k} className="fnf-calc-row">
                            <span className="fnf-calc-row-label">{lbl}</span>
                            <div className="fnf-calc-input-wrap">
                              <span className="fnf-calc-curr">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editor.form.earnings[k] ?? ''}
                                onChange={(e) => updateAmount('earnings', k, e.target.value)}
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* RIGHT: Deductions / Recoveries (−) */}
                    <div className="fnf-calc-box deductions">
                      <div className="fnf-calc-box-header text-danger">
                        <h4>Deductions / Recoveries (−)</h4>
                        <span className="fnf-box-subtotal">{money(calculateFormTotals.deductions)}</span>
                      </div>
                      <div className="fnf-calc-fields-list">
                        {DEDUCTION_FIELDS.map(([k, lbl]) => (
                          <div key={k} className="fnf-calc-row">
                            <span className="fnf-calc-row-label">{lbl}</span>
                            <div className="fnf-calc-input-wrap">
                              <span className="fnf-calc-curr">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editor.form.deductions[k] ?? ''}
                                onChange={(e) => updateAmount('deductions', k, e.target.value)}
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 10. CALCULATION SUMMARY (At the bottom of calculation section) */}
                  <div className="fnf-calc-summary-card">
                    <div className="fnf-calc-summary-rows">
                      <div className="fnf-calc-summary-line">
                        <span>Gross Earnings</span>
                        <strong>{money(calculateFormTotals.gross)}</strong>
                      </div>
                      <div className="fnf-calc-summary-line text-danger">
                        <span>Total Deductions</span>
                        <strong>{money(calculateFormTotals.deductions)}</strong>
                      </div>
                    </div>
                    <div className="fnf-calc-summary-divider"></div>
                    <div className="fnf-calc-summary-final">
                      <div className="fnf-final-label-group">
                        <span className="fnf-final-tag">SYSTEM CALCULATED FINAL AMOUNT</span>
                        <small className="fnf-final-subtext">Read-only &bull; Derived from earnings and deductions</small>
                      </div>
                      <strong className="fnf-final-amount">{money(calculateFormTotals.net)}</strong>
                    </div>
                  </div>
                </div>

                <div className="fnf-modal-footer">
                  <button type="button" className="fnf-btn-outline" onClick={() => setEditor(null)} disabled={saving}>
                    Cancel
                  </button>
                  <button type="submit" className="fnf-btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : (editor.mode === 'create' ? 'Create Settlement' : 'Save Changes')}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* ================= MODAL: VIEW 360° DETAILS ================= */}
        {selected && createPortal(
          <div className="fnf-overlay" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}>
            <div className="fnf-detail-modal animate-modal-scale">
              <div className="fnf-modal-header">
                <div className="fnf-emp-cell">
                  <div className="fnf-avatar md" style={{ backgroundColor: getAvatarColor(personName(selected.user, selected.employeeSnapshot)) }}>
                    {getInitials(personName(selected.user, selected.employeeSnapshot))}
                  </div>
                  <div>
                    <h2>{personName(selected.user, selected.employeeSnapshot)}</h2>
                    <span className="fnf-text-dim">
                      {personId(selected.user, selected.employeeSnapshot)} &bull; {personDepartment(selected.user, selected.employeeSnapshot)} &bull; {personDesignation(selected.user, selected.employeeSnapshot)}
                    </span>
                  </div>
                </div>
                <div className="fnf-drawer-header-actions">
                  <span className={`fnf-status-pill st-${String(selected.status || '').toLowerCase().replace(/[^a-z0-9]/g, '')}`}>
                    {selected.status}
                  </span>
                  <button className="fnf-btn-close" onClick={() => setSelected(null)}>×</button>
                </div>
              </div>

              <div className="fnf-modal-scroll-body">
                {/* 3 Metric Cards */}
                <div className="fnf-metrics-row">
                  <div className="fnf-metric-box">
                    <span>Gross Earnings</span>
                    <strong className="text-success">{money(selected.grossEarnings)}</strong>
                  </div>
                  <div className="fnf-metric-box">
                    <span>Total Deductions</span>
                    <strong className="text-danger">{money(selected.totalDeductions)}</strong>
                  </div>
                  <div className="fnf-metric-box primary">
                    <span>SYSTEM CALCULATED FINAL AMOUNT</span>
                    <strong className="text-orange">{money(selected.netPayable)}</strong>
                  </div>
                </div>

                {/* Metadata Row */}
                <div className="fnf-meta-bar">
                  <div><label>Last Working Date:</label><span>{dateValue(selected.lastWorkingDay)}</span></div>
                  <div><label>Settlement Date:</label><span>{dateValue(selected.settlementDate)}</span></div>
                  <div><label>Payment Status:</label><span>{selected.payment?.paymentStatus || 'Unpaid'}</span></div>
                  <div><label>Payment Reference:</label><span>{selected.payment?.paymentReference || 'N/A'}</span></div>
                </div>

                {/* Clearance Status Block */}
                <div className="fnf-detail-section">
                  <div className="fnf-section-head">
                    <h3>Clearance Status</h3>
                  </div>
                  <div className="fnf-clearance-mini-grid">
                    {[
                      { k: 'department', lbl: 'Department Clearance' },
                      { k: 'it', lbl: 'IT Clearance' },
                      { k: 'administration', lbl: 'Administration Clearance' },
                      { k: 'finance', lbl: 'Finance Clearance' },
                    ].map(({ k, lbl }) => {
                      const item = selected.clearance?.[k] || { status: 'Pending' };
                      const isClr = ['Cleared', 'Completed'].includes(item.status);
                      return (
                        <div key={k} className="fnf-mini-clr-box">
                          <div className="fnf-mini-clr-head">
                            <span>{lbl}</span>
                            <span className={`fnf-pillar-badge ${isClr ? 'cleared' : 'pending'}`}>{item.status}</span>
                          </div>
                          <small>By: {item.completedBy || '—'} &bull; {dateValue(item.completedDate)}</small>
                          {item.remarks && <p className="fnf-mini-remarks">"{item.remarks}"</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Financial Ledger Breakdown */}
                <div className="fnf-detail-section">
                  <div className="fnf-section-head">
                    <h3>Calculation Breakdown</h3>
                  </div>
                  <div className="fnf-ledger-split">
                    <div className="fnf-ledger-col">
                      <h5>Earnings (+)</h5>
                      {EARNING_FIELDS.map(([k, lbl]) => (
                        <div key={k} className="fnf-ledger-row">
                          <span>{lbl}</span>
                          <strong>{money(selected.earnings?.[k])}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="fnf-ledger-col">
                      <h5>Deductions (−)</h5>
                      {DEDUCTION_FIELDS.map(([k, lbl]) => (
                        <div key={k} className="fnf-ledger-row">
                          <span>{lbl}</span>
                          <strong>{money(selected.deductions?.[k])}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Audit Timeline */}
                <div className="fnf-detail-section">
                  <div className="fnf-section-head">
                    <h3>History &amp; Audit Trail</h3>
                  </div>
                  <div className="fnf-history-feed compact">
                    {(selected.history || []).slice().reverse().map((h, idx) => (
                      <div key={idx} className="fnf-feed-item">
                        <div className="fnf-feed-dot"></div>
                        <div className="fnf-feed-content">
                          <div className="fnf-feed-head">
                            <strong>{h.action}</strong>
                            <time>{h.at ? new Date(h.at).toLocaleString('en-GB') : ''}</time>
                          </div>
                          {h.remarks && <p className="fnf-feed-note">{h.remarks}</p>}
                          <div className="fnf-feed-meta">
                            {h.previousStatus && h.newStatus && <span>{h.previousStatus} → {h.newStatus}</span>}
                            <span>By {h.performedByName}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="fnf-modal-footer">
                <button className="fnf-btn-outline" onClick={() => openStatement(selected)}>
                  Print / Save F&amp;F Statement
                </button>
                <button className="fnf-btn-outline" onClick={() => setSelected(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ================= MODAL: UPDATE CLEARANCE ================= */}
        {clearanceModal && createPortal(
          <div className="fnf-overlay" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && setClearanceModal(null)}>
            <div className="fnf-modal">
              <div className="fnf-modal-head">
                <h3>Update {clearanceModal.departmentKey?.toUpperCase()} Clearance</h3>
                <button className="fnf-btn-close" onClick={() => setClearanceModal(null)}>×</button>
              </div>
              <form onSubmit={handleConfirmClearance} className="fnf-modal-body">
                <div className="fnf-form-group">
                  <label>Clearance Status</label>
                  <select
                    className="fnf-input"
                    value={clearanceModal.status}
                    onChange={(e) => setClearanceModal({ ...clearanceModal, status: e.target.value })}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Cleared">Cleared</option>
                    <option value="Rejected">Rejected</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </div>
                <div className="fnf-form-group">
                  <label>Remarks / Notes</label>
                  <textarea
                    rows="3"
                    className="fnf-input"
                    placeholder="Enter clearance notes or item verification remarks..."
                    value={clearanceModal.remarks}
                    onChange={(e) => setClearanceModal({ ...clearanceModal, remarks: e.target.value })}
                  ></textarea>
                </div>
                <div className="fnf-modal-foot">
                  <button type="button" className="fnf-btn-outline" onClick={() => setClearanceModal(null)}>Cancel</button>
                  <button type="submit" className="fnf-btn-primary" disabled={saving}>Save Clearance</button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* ================= MODAL: HR / FINANCE REVIEW ================= */}
        {reviewModal && createPortal(
          <div className="fnf-overlay" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && setReviewModal(null)}>
            <div className="fnf-modal">
              <div className="fnf-modal-head">
                <h3>{reviewModal.type === 'finance' ? 'Finance Verification Review' : 'HR Settlement Review'}</h3>
                <button className="fnf-btn-close" onClick={() => setReviewModal(null)}>×</button>
              </div>
              <form onSubmit={handleConfirmReview} className="fnf-modal-body">
                <div className="fnf-form-group">
                  <label>Review Remarks</label>
                  <textarea
                    required
                    rows="3"
                    className="fnf-input"
                    placeholder="Add verification notes, source document checks, or required comments..."
                    value={reviewModal.remarks}
                    onChange={(e) => setReviewModal({ ...reviewModal, remarks: e.target.value })}
                  ></textarea>
                </div>
                <div className="fnf-modal-foot">
                  <button type="button" className="fnf-btn-outline" onClick={() => setReviewModal(null)}>Cancel</button>
                  <button type="submit" className="fnf-btn-primary" disabled={saving}>
                    {reviewModal.type === 'finance' ? (reviewModal.requestRevision ? 'Request Revision' : 'Verify & Send for Final Approval') : 'Forward to Finance'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* ================= MODAL: HOLD (MANDATORY REASON) ================= */}
        {holdModal && createPortal(
          <div className="fnf-overlay" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && setHoldModal(null)}>
            <div className="fnf-modal">
              <div className="fnf-modal-head">
                <h3>Place Settlement On Hold</h3>
                <button className="fnf-btn-close" onClick={() => setHoldModal(null)}>×</button>
              </div>
              <form onSubmit={handleConfirmHold} className="fnf-modal-body">
                <div className="fnf-form-group">
                  <label className="required">Mandatory Reason for Hold</label>
                  <textarea
                    required
                    rows="3"
                    className="fnf-input"
                    placeholder="Specify why this settlement is being put on hold (e.g. pending asset return, audit dispute)..."
                    value={holdModal.reason}
                    onChange={(e) => setHoldModal({ ...holdModal, reason: e.target.value })}
                  ></textarea>
                </div>
                <div className="fnf-modal-foot">
                  <button type="button" className="fnf-btn-outline" onClick={() => setHoldModal(null)}>Cancel</button>
                  <button type="submit" className="fnf-btn-amber" disabled={saving || !holdModal.reason?.trim()}>
                    Confirm Hold
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* ================= MODAL: REJECT ================= */}
        {rejectModal && createPortal(
          <div className="fnf-overlay" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && setRejectModal(null)}>
            <div className="fnf-modal">
              <div className="fnf-modal-head">
                <h3>Reject Settlement Request</h3>
                <button className="fnf-btn-close" onClick={() => setRejectModal(null)}>×</button>
              </div>
              <form onSubmit={handleConfirmReject} className="fnf-modal-body">
                <div className="fnf-form-group">
                  <label className="required">Reason for Rejection</label>
                  <textarea
                    required
                    rows="3"
                    className="fnf-input"
                    placeholder="Provide a detailed reason..."
                    value={rejectModal.reason}
                    onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                  ></textarea>
                </div>
                <div className="fnf-modal-foot">
                  <button type="button" className="fnf-btn-outline" onClick={() => setRejectModal(null)}>Cancel</button>
                  <button type="submit" className="fnf-btn-danger" disabled={saving || !rejectModal.reason?.trim()}>
                    Confirm Rejection
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* ================= MODAL: PAYMENT DISBURSEMENT ================= */}
        {paymentModal && createPortal(
          <div className="fnf-overlay" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && setPaymentModal(null)}>
            <div className="fnf-modal">
              <div className="fnf-modal-head">
                <h3>Process Settlement Payment</h3>
                <button className="fnf-btn-close" onClick={() => setPaymentModal(null)}>×</button>
              </div>
              <form onSubmit={handleConfirmPayment} className="fnf-modal-body">
                <div className="fnf-payment-summary-callout">
                  <span>Disbursement Payout:</span>
                  <strong>{money(paymentModal.row?.netPayable)}</strong>
                </div>

                <div className="fnf-form-group">
                  <label>Payment Method</label>
                  <select
                    className="fnf-input"
                    value={paymentModal.paymentMethod}
                    onChange={(e) => setPaymentModal({ ...paymentModal, paymentMethod: e.target.value })}
                  >
                    <option value="Bank Transfer">Bank Transfer (NEFT / RTGS)</option>
                    <option value="Company Cheque">Company Cheque</option>
                    <option value="Corporate UPI">Corporate UPI</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>

                <div className="fnf-form-group">
                  <label>Payment Reference / Txn UTR ID</label>
                  <input
                    type="text"
                    className="fnf-input"
                    placeholder="e.g. UTR-982347102"
                    value={paymentModal.paymentReference}
                    onChange={(e) => setPaymentModal({ ...paymentModal, paymentReference: e.target.value })}
                  />
                </div>

                <div className="fnf-form-group">
                  <label>Payment Date</label>
                  <input
                    type="date"
                    className="fnf-input"
                    value={paymentModal.paymentDate}
                    onChange={(e) => setPaymentModal({ ...paymentModal, paymentDate: e.target.value })}
                  />
                </div>

                <div className="fnf-form-group">
                  <label>Disbursement Remarks</label>
                  <input
                    type="text"
                    className="fnf-input"
                    placeholder="e.g. Disbursed via salary bank account"
                    value={paymentModal.remarks}
                    onChange={(e) => setPaymentModal({ ...paymentModal, remarks: e.target.value })}
                  />
                </div>

                <div className="fnf-modal-foot">
                  <button type="button" className="fnf-btn-outline" onClick={() => setPaymentModal(null)}>Cancel</button>
                  <button type="submit" className="fnf-btn-success" disabled={saving}>
                    Mark as Paid
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      </div>
    </UserLayout>
  );
}