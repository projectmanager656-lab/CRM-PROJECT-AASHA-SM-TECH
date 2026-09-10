import { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../../../../../services/apiClient';
import UserLayout from '../components/UserLayout';
import './FullAndFinalSettlement.css';

const STATUSES = [
  'All',
  'Pending',
  'In Progress',
  'Clearance Pending',
  'Calculation Pending',
  'Approval Pending',
  'Approved',
  'Rejected',
  'On Hold',
  'Payment Processing',
  'Paid',
  'Completed',
];

const EARNING_FIELDS = [
  ['pendingSalary', 'Pending Salary'],
  ['salaryForWorkedDays', 'Salary for Worked Days'],
  ['leaveEncashment', 'Leave Encashment'],
  ['bonusIncentives', 'Bonus / Incentives'],
  ['pendingReimbursements', 'Pending Reimbursements'],
  ['otherEarnings', 'Other Earnings'],
];

const DEDUCTION_FIELDS = [
  ['loansAdvancesRecovery', 'Loans / Advances Recovery'],
  ['noticePeriodRecovery', 'Notice Period Recovery'],
  ['assetRecovery', 'Asset Recovery'],
  ['otherDeductions', 'Other Deductions'],
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
  const [settlements, setSettlements] = useState([]);
  const [summary, setSummary] = useState({});
  const [eligibleEmployees, setEligibleEmployees] = useState([]);
  const [filters, setFilters] = useState({ search: '', department: 'All', status: 'All', dateFrom: '', dateTo: '' });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  
  // UI State
  const [editor, setEditor] = useState(null); // mode: 'create' | 'edit'
  const [selected, setSelected] = useState(null); // Detail view
  const [actionMenuOpenId, setActionMenuOpenId] = useState(null);
  
  const [rejectModal, setRejectModal] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);

  useEffect(() => {
    const handleOutsideClick = () => setActionMenuOpenId(null);
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = Object.fromEntries(Object.entries(filters).filter(([, value]) => value && value !== 'All'));
      const [listResponse, summaryResponse] = await Promise.all([
        apiClient.get('/full-and-final-settlements', { params: query }),
        apiClient.get('/full-and-final-settlements/summary'),
      ]);
      const list = responseData(listResponse);
      setSettlements(Array.isArray(list) ? list : (list?.settlements || []));
      setSummary(responseData(summaryResponse) || {});
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data || err.message || 'Unable to load settlement records.';
      setError(typeof errMsg === 'string' ? errMsg : 'Unable to load settlement records.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadData(); }, [loadData]);

  const departments = useMemo(() => {
    return [...new Set(settlements.map((row) => personDepartment(row.user, row.employeeSnapshot)).filter((value) => value !== '—'))].sort();
  }, [settlements]);

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
      setError(typeof errMsg === 'string' ? errMsg : 'Unable to load eligible employees. Ensure backend service is reachable.');
    } finally {
      setLoadingEligible(false);
    }
  };

  const openEdit = (row) => {
    setActionMenuOpenId(null);
    setEditor({
      mode: 'edit',
      record: row,
      form: {
        userId: row.user?._id || row.user,
        lastWorkingDay: dateInputValue(row.lastWorkingDay),
        earnings: { ...(row.earnings || {}) },
        deductions: { ...(row.deductions || {}) },
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

  const calculateFormTotals = useMemo(() => {
    if (!editor) return { gross: 0, deductions: 0, net: 0 };
    const gross = Object.values(editor.form.earnings || {}).reduce((acc, v) => acc + (Number(v) || 0), 0);
    const deductions = Object.values(editor.form.deductions || {}).reduce((acc, v) => acc + (Number(v) || 0), 0);
    const net = Math.max(0, gross - deductions);
    return { gross, deductions, net };
  }, [editor]);

  const saveEditor = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (editor.mode === 'create') {
        await apiClient.post('/full-and-final-settlements', editor.form);
        setNotice('Full & Final Settlement initiated successfully.');
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

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectModal?.reason?.trim()) return;
    await runAction(rejectModal.row, 'reject', { reason: rejectModal.reason.trim() });
    setRejectModal(null);
  };

  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!paymentModal) return;
    await runAction(paymentModal.row, 'mark-paid', {
      paymentReference: paymentModal.paymentReference || '',
      paymentDate: paymentModal.paymentDate || new Date().toISOString(),
    });
    setPaymentModal(null);
  };

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

  const clearFilters = () => setFilters({ search: '', department: 'All', status: 'All', dateFrom: '', dateTo: '' });

  return (
    <UserLayout pageTitle="Full & Final Settlement">
      <div className="fnf2-page-wrapper">
        
        {/* TOP: Header Area */}
        <div className="fnf2-header">
          <div className="fnf2-header-text">
            <h1>Full &amp; Final Settlement</h1>
            <p>Manage exit clearances, final payouts, recoveries, and statements for departing employees.</p>
          </div>
          <div className="fnf2-header-actions">
            <button className="fnf2-btn-primary" onClick={openCreate} disabled={loadingEligible}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>{loadingEligible ? 'Checking...' : 'Initiate Settlement'}</span>
            </button>
          </div>
        </div>

        {/* Global Alerts */}
        {notice && (
          <div className="fnf2-alert success">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <span>{notice}</span>
            <button className="fnf2-alert-close" onClick={() => setNotice('')}>×</button>
          </div>
        )}
        {error && (
          <div className="fnf2-alert error">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span>{error}</span>
            <button className="fnf2-alert-close" onClick={() => setError('')}>×</button>
          </div>
        )}

        {/* COMPACT KPI STRIP */}
        <div className="fnf2-kpi-strip">
          <div className="fnf2-kpi-item">
            <div className="fnf2-kpi-icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div>
            <div className="fnf2-kpi-data">
              <span className="fnf2-kpi-val">{summary.pendingSettlements || 0}</span>
              <span className="fnf2-kpi-label">Pending</span>
            </div>
          </div>
          <div className="fnf2-kpi-item">
            <div className="fnf2-kpi-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></div>
            <div className="fnf2-kpi-data">
              <span className="fnf2-kpi-val">{summary.inProgress || 0}</span>
              <span className="fnf2-kpi-label">In Progress</span>
            </div>
          </div>
          <div className="fnf2-kpi-item">
            <div className="fnf2-kpi-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg></div>
            <div className="fnf2-kpi-data">
              <span className="fnf2-kpi-val">{summary.approvalPending || 0}</span>
              <span className="fnf2-kpi-label">Approval Pending</span>
            </div>
          </div>
          <div className="fnf2-kpi-item">
            <div className="fnf2-kpi-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div>
            <div className="fnf2-kpi-data">
              <span className="fnf2-kpi-val">{summary.completed || 0}</span>
              <span className="fnf2-kpi-label">Completed</span>
            </div>
          </div>
          <div className="fnf2-kpi-divider"></div>
          <div className="fnf2-kpi-item total">
            <div className="fnf2-kpi-data right-align">
              <span className="fnf2-kpi-label">Total Net Payable</span>
              <span className="fnf2-kpi-val money">{money(summary.totalNetPayable)}</span>
            </div>
          </div>
        </div>

        {/* SETTLEMENT MANAGEMENT WORKSPACE CONSOLE */}
        <div className="fnf2-console">
          
          <div className="fnf2-toolbar">
            <div className="fnf2-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" placeholder="Search employee, name, or ID..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
            </div>
            
            <select className="fnf2-select" value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })}>
              <option value="All">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            
            <select className="fnf2-select" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              {STATUSES.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
            </select>

            <div className="fnf2-date-filter">
              <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} className="fnf2-select" title="LWD From" />
              <span>to</span>
              <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} className="fnf2-select" title="LWD To" />
            </div>

            <div className="fnf2-toolbar-actions">
              {(filters.search || filters.department !== 'All' || filters.status !== 'All' || filters.dateFrom || filters.dateTo) && (
                <button className="fnf2-btn-clear" onClick={clearFilters}>Clear</button>
              )}
              <button className="fnf2-btn-icon" onClick={loadData} title="Refresh Data">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
              </button>
            </div>
          </div>

          <div className="fnf2-grid-wrap">
            <table className="fnf2-grid">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Employee</th>
                  <th style={{ width: '12%' }}>Employee ID</th>
                  <th style={{ width: '13%' }}>Department</th>
                  <th style={{ width: '13%' }}>Last Working Day</th>
                  <th style={{ width: '14%' }}>Status</th>
                  <th style={{ width: '14%', textAlign: 'right' }}>Net Payable</th>
                  <th style={{ width: '9%', textAlign: 'right', paddingRight: '1rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan="7" className="fnf2-empty-state">
                      <div className="fnf2-spinner"></div>
                      <p>Loading settlement records...</p>
                    </td>
                  </tr>
                )}
                
                {!loading && settlements.length === 0 && (
                  <tr>
                    <td colSpan="7" className="fnf2-empty-state">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                      <h3>No F&amp;F settlements yet</h3>
                      <p>Initiate a settlement for an eligible exiting employee to get started.</p>
                      <button className="fnf2-btn-outline" onClick={openCreate} disabled={loadingEligible}>+ Initiate Settlement</button>
                    </td>
                  </tr>
                )}

                {!loading && settlements.map(row => {
                  const empName = personName(row.user, row.employeeSnapshot);
                  const isApprovalPending = row.status === 'Approval Pending';
                  const isApproved = row.status === 'Approved';
                  const isPaymentProcessing = row.status === 'Payment Processing';
                  const isPaid = row.status === 'Paid';
                  const isPending = ['Pending', 'In Progress', 'Calculation Pending'].includes(row.status);
                  
                  return (
                    <tr key={row._id} className="fnf2-row" onClick={() => setSelected(row)}>
                      <td>
                        <div className="fnf2-emp-profile">
                          <div className="fnf2-avatar" style={{ backgroundColor: getAvatarColor(empName) }}>{getInitials(empName)}</div>
                          <div className="fnf2-emp-names">
                            <strong>{empName}</strong>
                            <span>{row.user?.email || ''}</span>
                          </div>
                        </div>
                      </td>
                      <td><span className="fnf2-tag monospace">{personId(row.user, row.employeeSnapshot)}</span></td>
                      <td><span className="fnf2-text-subtle">{personDepartment(row.user, row.employeeSnapshot)}</span></td>
                      <td><span className="fnf2-text-subtle">{dateValue(row.lastWorkingDay)}</span></td>
                      <td>
                        <span className={`fnf2-status-pill st-${String(row.status || '').toLowerCase().replace(/[^a-z0-9]/g, '')}`}>
                          {row.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <strong className="fnf2-money-cell">{money(row.netPayable)}</strong>
                      </td>
                      <td style={{ textAlign: 'right', paddingRight: '1rem' }} onClick={e => e.stopPropagation()}>
                        <div className="fnf2-actions-cell">
                          {isPending && <button className="fnf2-btn-row-primary" onClick={() => runAction(row, 'submit')}>Submit</button>}
                          {isApprovalPending && <button className="fnf2-btn-row-success" onClick={() => runAction(row, 'approve')}>Approve</button>}
                          {isApproved && <button className="fnf2-btn-row-primary" onClick={() => runAction(row, 'process-payment', { paymentMethod: 'Bank Transfer' })}>Pay</button>}
                          {isPaymentProcessing && <button className="fnf2-btn-row-success" onClick={() => setPaymentModal({ row, paymentMethod: 'Bank Transfer', paymentReference: '', paymentDate: new Date().toISOString().slice(0, 10) })}>Mark Paid</button>}
                          {isPaid && <button className="fnf2-btn-row-success" onClick={() => runAction(row, 'complete')}>Complete</button>}
                          {(!isPending && !isApprovalPending && !isApproved && !isPaymentProcessing && !isPaid) && (
                            <button className="fnf2-btn-row-outline" onClick={() => setSelected(row)}>Review</button>
                          )}
                          
                          <div className="fnf2-dropdown-wrap">
                            <button className="fnf2-btn-row-icon" onClick={(e) => { e.stopPropagation(); setActionMenuOpenId(actionMenuOpenId === row._id ? null : row._id); }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                            </button>
                            {actionMenuOpenId === row._id && (
                              <div className="fnf2-dropdown-menu">
                                <button onClick={() => { setActionMenuOpenId(null); setSelected(row); }}>View Details</button>
                                {['Pending', 'In Progress', 'Calculation Pending', 'On Hold', 'Rejected'].includes(row.status) && (
                                  <button onClick={() => openEdit(row)}>Edit Financials</button>
                                )}
                                {['Pending', 'In Progress', 'Calculation Pending', 'On Hold', 'Rejected'].includes(row.status) && (
                                  <button onClick={() => runAction(row, 'calculate')}>Recalculate System Data</button>
                                )}
                                {row.status === 'Approval Pending' && (
                                  <button className="text-danger" onClick={() => { setActionMenuOpenId(null); setRejectModal({ row, reason: '' }); }}>Reject Request</button>
                                )}
                                {!['Completed', 'Paid'].includes(row.status) && row.status !== 'Payment Processing' && (
                                  <button onClick={() => runAction(row, 'hold')}>Place On Hold</button>
                                )}
                                <div className="fnf2-divider"></div>
                                <button onClick={() => openStatement(row)}>Print F&amp;F Statement</button>
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

        {/* INITIATE SETTLEMENT — LARGE SPLIT-VIEW DRAWER/WORKSPACE */}
        {editor && (
          <div className="fnf2-overlay" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && setEditor(null)}>
            <div className="fnf2-workspace-drawer animate-slide-in">
              <div className="fnf2-drawer-header">
                <div className="fnf2-drawer-title">
                  <h2>{editor.mode === 'create' ? 'Initiate Settlement' : 'Edit Settlement Financials'}</h2>
                  <span className="fnf2-badge-outline">{editor.mode === 'create' ? 'New Request' : editor.record?.status}</span>
                </div>
                <button className="fnf2-btn-close" onClick={() => setEditor(null)}>×</button>
              </div>

              <form onSubmit={saveEditor} className="fnf2-workspace-body">
                <div className="fnf2-workspace-split">
                  
                  {/* LEFT PANEL: Employee Context */}
                  <div className="fnf2-panel-left">
                    <h3 className="fnf2-section-title">Employee Context</h3>
                    
                    {editor.mode === 'create' && (
                      <div className="fnf2-field">
                        <label className="required">Select Exited / Resigned Employee</label>
                        <select 
                          required 
                          className="fnf2-input" 
                          value={editor.form.userId} 
                          onChange={(e) => {
                            const val = e.target.value;
                            const emp = eligibleEmployees.find(item => String(item.userId || item._id || item.user?._id || item.user) === String(val));
                            const lwd = emp?.lastWorkingDay || emp?.exitDate || new Date().toISOString().slice(0, 10);
                            setEditor({
                              ...editor,
                              form: {
                                ...editor.form,
                                userId: val,
                                lastWorkingDay: dateInputValue(lwd),
                              }
                            });
                          }}
                        >
                          <option value="">-- Search &amp; select employee --</option>
                          {eligibleEmployees.map(emp => {
                            const empKey = String(emp.userId || emp._id || emp.user?._id || emp.user);
                            const nameStr = emp.name || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.personalInfo?.fullName || emp.email || 'Employee';
                            const codeStr = emp.employeeId || emp.jobDetails?.employeeId || 'No ID';
                            const deptStr = emp.department || emp.jobDetails?.department || 'General';
                            return (
                              <option key={empKey} value={empKey}>
                                {nameStr} ({codeStr}) — {deptStr}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}

                    {editor.form.userId && (() => {
                      const emp = eligibleEmployees.find(item => String(item.userId || item._id || item.user?._id || item.user) === String(editor.form.userId)) || editor.record?.employeeSnapshot || editor.record?.user;
                      if (!emp) return null;
                      const empName = emp.name || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.personalInfo?.fullName || emp.email || 'Employee';
                      const empCode = emp.employeeId || emp.jobDetails?.employeeId || 'No ID';
                      const empDept = emp.department || emp.jobDetails?.department || '—';
                      const empDesig = emp.designation || emp.jobDetails?.designation || '—';
                      const empJoining = emp.joiningDate || emp.jobDetails?.joiningDate || null;
                      const empExit = emp.exitDate || emp.approvedLastWorkingDay || emp.proposedLastWorkingDay || null;

                      return (
                        <div className="fnf2-emp-context-card">
                          <div className="fnf2-emp-profile mb-md">
                            <div className="fnf2-avatar lg" style={{ backgroundColor: getAvatarColor(empName) }}>{getInitials(empName)}</div>
                            <div className="fnf2-emp-names">
                              <strong>{empName}</strong>
                              <span>{empCode}</span>
                            </div>
                          </div>
                          <div className="fnf2-context-grid">
                            <div><label>Department</label><span>{empDept}</span></div>
                            <div><label>Designation</label><span>{empDesig}</span></div>
                            <div><label>Joining Date</label><span>{dateValue(empJoining)}</span></div>
                            <div><label>Exit/Resign Date</label><span>{dateValue(empExit)}</span></div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="fnf2-field">
                      <label className="required">Last Working Day</label>
                      <input 
                        required 
                        type="date" 
                        className="fnf2-input" 
                        value={editor.form.lastWorkingDay} 
                        onChange={(e) => setEditor({ ...editor, form: { ...editor.form, lastWorkingDay: e.target.value } })} 
                      />
                      <p className="fnf2-hint">Defines the payroll cut-off date and attendance calculation range.</p>
                    </div>
                  </div>

                  {/* RIGHT PANEL: Financial Engine */}
                  <div className="fnf2-panel-right bg-slate-50">
                    <div className="fnf2-financial-grid">
                      
                      {/* Earnings */}
                      <div className="fnf2-fin-section">
                        <div className="fnf2-fin-header">
                          <h3 className="fnf2-section-title">Earnings</h3>
                          <span className="fnf2-fin-sum text-success">{money(calculateFormTotals.gross)}</span>
                        </div>
                        <div className="fnf2-fin-list">
                          {EARNING_FIELDS.map(([key, label]) => (
                            <div key={key} className="fnf2-fin-row">
                              <label>{label}</label>
                              <div className="fnf2-input-currency">
                                <span>₹</span>
                                <input type="number" min="0" step="0.01" placeholder="0.00" value={editor.form.earnings[key] ?? ''} onChange={(e) => updateAmount('earnings', key, e.target.value)} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Deductions */}
                      <div className="fnf2-fin-section">
                        <div className="fnf2-fin-header">
                          <h3 className="fnf2-section-title">Deductions / Recoveries</h3>
                          <span className="fnf2-fin-sum text-danger">{money(calculateFormTotals.deductions)}</span>
                        </div>
                        <div className="fnf2-fin-list">
                          {DEDUCTION_FIELDS.map(([key, label]) => (
                            <div key={key} className="fnf2-fin-row">
                              <label>{label}</label>
                              <div className="fnf2-input-currency">
                                <span>₹</span>
                                <input type="number" min="0" step="0.01" placeholder="0.00" value={editor.form.deductions[key] ?? ''} onChange={(e) => updateAmount('deductions', key, e.target.value)} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

                {/* STICKY FOOTER SUMMARY */}
                <div className="fnf2-drawer-footer sticky">
                  <div className="fnf2-summary-bar">
                    <div className="fnf2-summary-item">
                      <span>Gross Earnings</span>
                      <strong>{money(calculateFormTotals.gross)}</strong>
                    </div>
                    <div className="fnf2-summary-op">−</div>
                    <div className="fnf2-summary-item text-danger">
                      <span>Total Deductions</span>
                      <strong>{money(calculateFormTotals.deductions)}</strong>
                    </div>
                    <div className="fnf2-summary-op">=</div>
                    <div className="fnf2-summary-item highlight">
                      <span>NET PAYABLE</span>
                      <strong>{money(calculateFormTotals.net)}</strong>
                    </div>
                  </div>
                  <div className="fnf2-drawer-actions">
                    <button type="button" className="fnf2-btn-outline" onClick={() => setEditor(null)} disabled={saving}>Cancel</button>
                    {editor.mode === 'edit' && <button type="button" className="fnf2-btn-outline" onClick={() => { saveEditor(event); runAction(editor.record, 'calculate'); }} disabled={saving}>Recalculate</button>}
                    <button type="submit" className="fnf2-btn-primary" disabled={saving}>{saving ? 'Saving...' : (editor.mode === 'create' ? 'Initiate Settlement' : 'Save Settlement')}</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SETTLEMENT DETAILS — LARGE SLIDE-OVER DRAWER */}
        {selected && (
          <div className="fnf2-overlay" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}>
            <div className="fnf2-workspace-drawer right-align animate-slide-left">
              <div className="fnf2-drawer-header space-between">
                <div className="fnf2-emp-profile">
                  <div className="fnf2-avatar md" style={{ backgroundColor: getAvatarColor(personName(selected.user, selected.employeeSnapshot)) }}>{getInitials(personName(selected.user, selected.employeeSnapshot))}</div>
                  <div className="fnf2-emp-names">
                    <div className="fnf2-name-row">
                      <h2>{personName(selected.user, selected.employeeSnapshot)}</h2>
                      <span className={`fnf2-status-pill st-${String(selected.status || '').toLowerCase().replace(/[^a-z0-9]/g, '')}`}>{selected.status}</span>
                    </div>
                    <span>{personId(selected.user, selected.employeeSnapshot)} · {personDepartment(selected.user, selected.employeeSnapshot)} · {personDesignation(selected.user, selected.employeeSnapshot)}</span>
                  </div>
                </div>
                <button className="fnf2-btn-close" onClick={() => setSelected(null)}>×</button>
              </div>

              <div className="fnf2-detail-body">
                {/* 3 Summary Cards */}
                <div className="fnf2-detail-metrics">
                  <div className="fnf2-metric">
                    <span>Gross Earnings</span>
                    <strong className="text-success">{money(selected.grossEarnings)}</strong>
                  </div>
                  <div className="fnf2-metric">
                    <span>Total Deductions</span>
                    <strong className="text-danger">{money(selected.totalDeductions)}</strong>
                  </div>
                  <div className="fnf2-metric primary">
                    <span>Net Payable</span>
                    <strong>{money(selected.netPayable)}</strong>
                  </div>
                </div>

                <div className="fnf2-meta-strip">
                  <div><label>Last Working Day</label><span>{dateValue(selected.lastWorkingDay)}</span></div>
                  <div><label>Settlement Date</label><span>{dateValue(selected.settlementDate)}</span></div>
                  <div><label>Payment Method</label><span>{selected.payment?.paymentMethod || '—'}</span></div>
                  <div><label>Payment Reference</label><span>{selected.payment?.paymentReference || '—'}</span></div>
                </div>

                {/* Ledger Style Calculations */}
                <h3 className="fnf2-section-title mt-lg">Calculation Summary</h3>
                <div className="fnf2-ledger">
                  <div className="fnf2-ledger-col">
                    <div className="fnf2-ledger-header"><h4>Earnings</h4></div>
                    <div className="fnf2-ledger-body">
                      {EARNING_FIELDS.map(([key, label]) => (
                        <div key={key} className="fnf2-ledger-row">
                          <span>{label}</span>
                          <strong>{money(selected.earnings?.[key])}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="fnf2-ledger-footer">
                      <span>Total Earnings</span>
                      <strong className="text-success">{money(selected.grossEarnings)}</strong>
                    </div>
                  </div>
                  <div className="fnf2-ledger-col">
                    <div className="fnf2-ledger-header"><h4>Deductions &amp; Recoveries</h4></div>
                    <div className="fnf2-ledger-body">
                      {DEDUCTION_FIELDS.map(([key, label]) => (
                        <div key={key} className="fnf2-ledger-row">
                          <span>{label}</span>
                          <strong>{money(selected.deductions?.[key])}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="fnf2-ledger-footer">
                      <span>Total Deductions</span>
                      <strong className="text-danger">{money(selected.totalDeductions)}</strong>
                    </div>
                  </div>
                </div>

                {/* Audit Timeline */}
                <h3 className="fnf2-section-title mt-lg">Settlement Timeline</h3>
                <div className="fnf2-timeline">
                  {selected.history && selected.history.length > 0 ? (
                    selected.history.slice().reverse().map((entry, idx) => (
                      <div key={idx} className="fnf2-timeline-item">
                        <div className="fnf2-timeline-dot"></div>
                        <div className="fnf2-timeline-content">
                          <div className="fnf2-timeline-header">
                            <strong>{entry.action}</strong>
                            <time>{entry.at ? new Date(entry.at).toLocaleString('en-GB') : ''}</time>
                          </div>
                          {entry.note && <p>{entry.note}</p>}
                          {entry.performedByName && <span className="fnf2-timeline-actor">By {entry.performedByName}</span>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="fnf2-text-subtle">No history recorded.</p>
                  )}
                </div>
              </div>

              <div className="fnf2-drawer-footer sticky space-between">
                <button className="fnf2-btn-outline" onClick={() => openStatement(selected)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                  <span>F&amp;F Statement</span>
                </button>
                <div className="fnf2-drawer-actions">
                  {selected.status === 'Approval Pending' && (
                    <>
                      <button className="fnf2-btn-danger" onClick={() => { setSelected(null); setRejectModal({ row: selected, reason: '' }); }}>Reject</button>
                      <button className="fnf2-btn-success" onClick={() => runAction(selected, 'approve')}>Approve</button>
                    </>
                  )}
                  {selected.status === 'Approved' && (
                    <button className="fnf2-btn-primary" onClick={() => runAction(selected, 'process-payment', { paymentMethod: 'Bank Transfer' })}>Process Payment</button>
                  )}
                  {selected.status === 'Payment Processing' && (
                    <button className="fnf2-btn-success" onClick={() => { setSelected(null); setPaymentModal({ row: selected, paymentMethod: 'Bank Transfer', paymentReference: '', paymentDate: new Date().toISOString().slice(0, 10) }); }}>Mark Paid</button>
                  )}
                  <button className="fnf2-btn-outline" onClick={() => setSelected(null)}>Close</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* IN-APP MODALS */}
        {rejectModal && (
          <div className="fnf2-overlay" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && setRejectModal(null)}>
            <div className="fnf2-modal-dialog">
              <div className="fnf2-modal-header border-bottom">
                <h3>Reject Settlement Request</h3>
                <button className="fnf2-btn-close" onClick={() => setRejectModal(null)}>×</button>
              </div>
              <form onSubmit={handleConfirmReject} className="fnf2-modal-body">
                <div className="fnf2-field">
                  <label className="required">Reason for Rejection</label>
                  <textarea required className="fnf2-textarea" rows="3" placeholder="Provide a detailed reason..." value={rejectModal.reason} onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}></textarea>
                </div>
                <div className="fnf2-modal-footer">
                  <button type="button" className="fnf2-btn-outline" onClick={() => setRejectModal(null)}>Cancel</button>
                  <button type="submit" className="fnf2-btn-danger" disabled={saving || !rejectModal.reason.trim()}>{saving ? 'Rejecting...' : 'Confirm Rejection'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {paymentModal && (
          <div className="fnf2-overlay" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && setPaymentModal(null)}>
            <div className="fnf2-modal-dialog">
              <div className="fnf2-modal-header border-bottom">
                <h3>Mark Payment Disbursed</h3>
                <button className="fnf2-btn-close" onClick={() => setPaymentModal(null)}>×</button>
              </div>
              <form onSubmit={handleConfirmPayment} className="fnf2-modal-body">
                <div className="fnf2-field">
                  <label>Payment Method</label>
                  <select className="fnf2-input" value={paymentModal.paymentMethod} onChange={(e) => setPaymentModal({ ...paymentModal, paymentMethod: e.target.value })}>
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="Cheque">Company Cheque</option>
                    <option value="UPI">Corporate UPI</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
                <div className="fnf2-field">
                  <label>Payment Reference / Txn ID</label>
                  <input type="text" className="fnf2-input" placeholder="e.g. UTR-123456" value={paymentModal.paymentReference} onChange={(e) => setPaymentModal({ ...paymentModal, paymentReference: e.target.value })} />
                </div>
                <div className="fnf2-field">
                  <label>Disbursement Date</label>
                  <input type="date" className="fnf2-input" value={paymentModal.paymentDate} onChange={(e) => setPaymentModal({ ...paymentModal, paymentDate: e.target.value })} />
                </div>
                <div className="fnf2-modal-footer">
                  <button type="button" className="fnf2-btn-outline" onClick={() => setPaymentModal(null)}>Cancel</button>
                  <button type="submit" className="fnf2-btn-success" disabled={saving}>{saving ? 'Processing...' : 'Mark as Paid'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </UserLayout>
  );
}