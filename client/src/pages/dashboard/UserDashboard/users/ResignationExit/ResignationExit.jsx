import React, { useState, useEffect, useMemo, useContext } from 'react';
import apiClient from '../../../../../services/apiClient';
import { AppContext } from '../../../../../context/AppContext';
import UserLayout from '../components/UserLayout';
import './ResignationExit.css';
import '../Employees/HREmployees.css';

const formatDate = (val) => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return String(val);
  }
};

const OFFICIAL_DEPARTMENTS = ['HR', 'Finance', 'Business Development', 'Digital Marketing', 'Video Editor', 'Tech'];

export default function ResignationExit() {
  const { user } = useContext(AppContext);
  const isHrOrAdmin = ['admin', 'super_admin'].includes(user?.role) || user?.department === 'HR';

  const [resignations, setResignations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState({
    pendingResignations: 0,
    underReview: 0,
    servingNotice: 0,
    exitThisMonth: 0,
    approved: 0,
    exitCompleted: 0,
    total: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'notice' | 'clearance' | 'settlement'

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Modals
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCompleteExitModal, setShowCompleteExitModal] = useState(false);
  const [showEmployeeSubmitModal, setShowEmployeeSubmitModal] = useState(false);
  const [showAddResignationModal, setShowAddResignationModal] = useState(false);
  const [showTerminateModal, setShowTerminateModal] = useState(false);

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [approveForm, setApproveForm] = useState({
    approvedLastWorkingDay: '',
    noticePeriodDays: 30,
    hrRemarks: '',
  });

  const [rejectForm, setRejectForm] = useState({
    rejectionReason: '',
  });

  // Add Resignation form
  const [resignationForm, setResignationForm] = useState({
    userId: '',
    resignationDate: new Date().toISOString().slice(0, 10),
    proposedLastWorkingDay: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    reason: '',
    employeeComments: '',
  });

  // Terminate Employee form
  const [terminateForm, setTerminateForm] = useState({
    userId: '',
    effectiveDate: new Date().toISOString().slice(0, 10),
    terminationReason: 'Performance Issues',
    comments: '',
  });

  // Load live data from MongoDB Atlas
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [resRes, sumRes, empRes] = await Promise.all([
        apiClient.get('/resignation'),
        apiClient.get('/resignation/summary').catch(() => ({ data: { data: null } })),
        apiClient.get('/users').catch(() => ({ data: { data: [] } })),
      ]);

      const records = resRes.data?.data || [];
      setResignations(records);

      const allEmps = (empRes.data?.data || []).filter((u) => u.role === 'employee' && u.isActive !== false);
      setEmployees(allEmps);

      if (sumRes.data?.data) {
        setSummary(sumRes.data.data);
      } else {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        setSummary({
          pendingResignations: records.filter((r) => r.status === 'Submitted').length,
          underReview: records.filter((r) => r.status === 'Under Review').length,
          servingNotice: records.filter((r) => ['Approved', 'Notice Period', 'Exit Clearance'].includes(r.status)).length,
          exitThisMonth: records.filter((r) => {
            if (r.status === 'Rejected') return false;
            const target = r.approvedLastWorkingDay ? new Date(r.approvedLastWorkingDay) : new Date(r.proposedLastWorkingDay);
            return target.getMonth() === currentMonth && target.getFullYear() === currentYear;
          }).length,
          approved: records.filter((r) => r.status === 'Approved').length,
          exitCompleted: records.filter((r) => r.status === 'Completed').length,
          total: records.length,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load resignation records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered resignations
  const filteredResignations = useMemo(() => {
    return resignations.filter((r) => {
      const name = (r.user?.personalInfo?.fullName || `${r.user?.firstName || ''} ${r.user?.lastName || ''}`).toLowerCase();
      const email = (r.user?.email || '').toLowerCase();
      const empId = (r.user?.jobDetails?.employeeId || '').toLowerCase();
      const q = search.toLowerCase();
      const matchesSearch = name.includes(q) || email.includes(q) || empId.includes(q);

      const dept = r.user?.jobDetails?.department || r.user?.department || '';
      const matchesDept = selectedDept === 'All' || dept === selectedDept;
      const matchesStatus = selectedStatus === 'All' || r.status === selectedStatus;

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [resignations, search, selectedDept, selectedStatus]);

  // Notice period active records
  const noticePeriodRecords = useMemo(() => {
    return resignations.filter((r) => ['Approved', 'Notice Period', 'Exit Clearance'].includes(r.status));
  }, [resignations]);

  // Handlers
  const handleOpenDetail = (record) => {
    setSelectedRecord(record);
    setShowDetailModal(true);
  };

  const handleOpenAddResignation = () => {
    setError('');
    setSuccess('');
    setResignationForm({
      userId: employees[0]?._id || '',
      resignationDate: new Date().toISOString().slice(0, 10),
      proposedLastWorkingDay: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      reason: 'Career Growth / Transition Opportunity',
      employeeComments: '',
    });
    setShowAddResignationModal(true);
  };

  const handleOpenTerminate = () => {
    setError('');
    setSuccess('');
    setTerminateForm({
      userId: employees[0]?._id || '',
      effectiveDate: new Date().toISOString().slice(0, 10),
      terminationReason: 'Performance Issues',
      comments: '',
    });
    setShowTerminateModal(true);
  };

  const handleOpenApprove = (record) => {
    setSelectedRecord(record);
    const targetLwd = record.approvedLastWorkingDay
      ? new Date(record.approvedLastWorkingDay).toISOString().slice(0, 10)
      : new Date(record.proposedLastWorkingDay).toISOString().slice(0, 10);
    setApproveForm({
      approvedLastWorkingDay: targetLwd,
      noticePeriodDays: record.noticePeriodDays || 30,
      hrRemarks: record.hrRemarks || '',
    });
    setShowApproveModal(true);
  };

  const handleSaveApprove = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setSubmitting(true);
    setError('');
    try {
      await apiClient.patch(`/resignation/${selectedRecord._id}/approve`, approveForm);
      setShowApproveModal(false);
      setSuccess('Resignation approved and notice period commenced.');
      await loadData();
      if (showDetailModal) {
        const updated = await apiClient.get(`/resignation/${selectedRecord._id}`);
        setSelectedRecord(updated.data?.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve resignation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenReject = (record) => {
    setSelectedRecord(record);
    setRejectForm({ rejectionReason: '' });
    setShowRejectModal(true);
  };

  const handleSaveReject = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;
    if (!rejectForm.rejectionReason.trim()) {
      setError('Rejection reason is mandatory.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiClient.patch(`/resignation/${selectedRecord._id}/reject`, rejectForm);
      setShowRejectModal(false);
      setSuccess('Resignation request rejected.');
      await loadData();
      if (showDetailModal) {
        const updated = await apiClient.get(`/resignation/${selectedRecord._id}`);
        setSelectedRecord(updated.data?.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject resignation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkReview = async (record) => {
    try {
      await apiClient.patch(`/resignation/${record._id}/review`, { hrRemarks: 'Under review by HR' });
      setSuccess('Resignation marked as Under Review.');
      await loadData();
      if (showDetailModal && selectedRecord?._id === record._id) {
        const updated = await apiClient.get(`/resignation/${record._id}`);
        setSelectedRecord(updated.data?.data);
      }
    } catch (err) {
      setError('Failed to mark as Under Review.');
    }
  };

  const handleUpdateClearance = async (recordId, departmentKey, newStatus) => {
    try {
      await apiClient.patch(`/resignation/${recordId}/clearance`, {
        departmentKey,
        status: newStatus,
      });
      setSuccess(`Clearance status updated to ${newStatus}.`);
      await loadData();
      if (selectedRecord && selectedRecord._id === recordId) {
        const updated = await apiClient.get(`/resignation/${recordId}`);
        setSelectedRecord(updated.data?.data);
      }
    } catch (err) {
      setError('Failed to update clearance status.');
    }
  };

  const handleCompleteExit = async () => {
    if (!selectedRecord) return;
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post(`/resignation/${selectedRecord._id}/complete-exit`);
      setShowCompleteExitModal(false);
      if (showDetailModal) setShowDetailModal(false);
      setSuccess('Employee exit completed successfully! Status updated to Exited in workforce records.');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete exit.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Add Resignation Submission
  const handleSaveResignation = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post('/resignation', resignationForm);
      setShowAddResignationModal(false);
      setShowEmployeeSubmitModal(false);
      setSuccess('Resignation request saved successfully to MongoDB Atlas.');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit resignation.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Terminate Employee
  const handleConfirmTermination = async (e) => {
    e.preventDefault();
    if (!terminateForm.userId || !terminateForm.terminationReason.trim()) {
      setError('Employee and termination reason are required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post('/resignation/terminate-employee', terminateForm);
      setShowTerminateModal(false);
      setSuccess('Employee terminated successfully. Historical records preserved in MongoDB Atlas.');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to terminate employee.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <UserLayout pageTitle="Resignation & Exit">
      <div className="exit-container">
        {/* Header with Add Resignation & Terminate Employee Actions */}
        <div className="exit-header">
          <div className="exit-title-area">
            <h2>Resignation & Exit</h2>
            <p>Manage employee resignations, notice periods, exit clearance and employee offboarding.</p>
          </div>
          <div className="exit-header-actions">
            {isHrOrAdmin ? (
              <>
                <button type="button" className="exit-secondary-btn" onClick={handleOpenTerminate} style={{ color: '#DC2626', borderColor: '#FECACA' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '15px', height: '15px' }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  Terminate Employee
                </button>
                <button type="button" className="exit-primary-btn" onClick={handleOpenAddResignation}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '15px', height: '15px' }}>
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <line x1="12" y1="11" x2="12" y2="17" />
                    <line x1="9" y1="14" x2="15" y2="14" />
                  </svg>
                  Add Resignation
                </button>
              </>
            ) : (
              <button type="button" className="exit-primary-btn" onClick={() => setShowEmployeeSubmitModal(true)}>
                Submit My Resignation
              </button>
            )}
          </div>
        </div>

        {/* Real-time 4 Main KPI Cards */}
        <div className="exit-kpi-grid">
          <div className="exit-kpi-card accent">
            <span className="exit-kpi-label">Pending</span>
            <strong className="exit-kpi-value">{summary.pendingResignations}</strong>
          </div>
          <div className="exit-kpi-card">
            <span className="exit-kpi-label">Under Review</span>
            <strong className="exit-kpi-value">{summary.underReview}</strong>
          </div>
          <div className="exit-kpi-card">
            <span className="exit-kpi-label">Notice Period</span>
            <strong className="exit-kpi-value">{summary.servingNotice}</strong>
          </div>
          <div className="exit-kpi-card">
            <span className="exit-kpi-label">Exits This Month</span>
            <strong className="exit-kpi-value">{summary.exitThisMonth}</strong>
          </div>
        </div>

        {/* Alerts */}
        {error && <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
        {success && <div style={{ background: '#DCFCE7', color: '#15803D', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>{success}</div>}

        {/* Workspace Tabs */}
        <div className="exit-nav-tabs-wrap">
          <div className="exit-nav-tabs">
            <button
              type="button"
              className={`exit-tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => setActiveTab('requests')}
            >
              Resignation Requests ({resignations.length})
            </button>
            <button
              type="button"
              className={`exit-tab-btn ${activeTab === 'notice' ? 'active' : ''}`}
              onClick={() => setActiveTab('notice')}
            >
              Notice Period ({noticePeriodRecords.length})
            </button>
            <button
              type="button"
              className={`exit-tab-btn ${activeTab === 'clearance' ? 'active' : ''}`}
              onClick={() => setActiveTab('clearance')}
            >
              Exit Clearance
            </button>
            <button
              type="button"
              className={`exit-tab-btn ${activeTab === 'settlement' ? 'active' : ''}`}
              onClick={() => setActiveTab('settlement')}
            >
              Final Settlement
            </button>
          </div>
        </div>

        {/* ─── TAB 1: RESIGNATION REQUESTS (MAIN SECTION) ─── */}
        {activeTab === 'requests' && (
          <div>
            <div className="exit-toolbar">
              <div className="exit-search-wrap">
                <svg className="exit-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by employee name, email, or ID..."
                  className="exit-search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select className="exit-filter-select" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
                <option value="All">All Departments</option>
                {OFFICIAL_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select className="exit-filter-select" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                <option value="All">All Statuses</option>
                <option value="Submitted">Submitted</option>
                <option value="Under Review">Under Review</option>
                <option value="Approved">Approved</option>
                <option value="Notice Period">Notice Period</option>
                <option value="Exit Clearance">Exit Clearance</option>
                <option value="Completed">Completed</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div className="exit-table-card">
              {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading resignation requests...</div>
              ) : filteredResignations.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  No resignation requests found.
                </div>
              ) : (
                <div className="exit-table-wrap">
                  <table className="exit-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Department</th>
                        <th>Resignation Date</th>
                        <th>Last Working Day</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResignations.map((r) => {
                        const name = r.user?.personalInfo?.fullName || [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') || r.user?.email || 'Employee';
                        const dept = r.user?.jobDetails?.department || r.user?.department || 'General';
                        const lwd = r.approvedLastWorkingDay || r.proposedLastWorkingDay;

                        return (
                          <tr key={r._id}>
                            <td>
                              <strong>{name}</strong>
                              <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>{r.user?.email}</span>
                            </td>
                            <td><span className="hr-emp-dept-pill">{dept}</span></td>
                            <td>{formatDate(r.resignationDate)}</td>
                            <td><strong>{formatDate(lwd)}</strong></td>
                            <td style={{ maxWidth: '240px' }}>
                              <span style={{ display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {r.reason}
                              </span>
                            </td>
                            <td>
                              <span className={`exit-badge ${r.status.toLowerCase().replace(' ', '_')}`}>
                                {r.status}
                              </span>
                            </td>
                            <td>
                              <div className="exit-actions-wrap">
                                <button type="button" className="exit-btn-sm view" onClick={() => handleOpenDetail(r)}>
                                  View
                                </button>
                                {isHrOrAdmin && r.status === 'Submitted' && (
                                  <>
                                    <button type="button" className="exit-btn-sm review" onClick={() => handleMarkReview(r)}>
                                      Review
                                    </button>
                                    <button type="button" className="exit-btn-sm approve" onClick={() => handleOpenApprove(r)}>
                                      Approve
                                    </button>
                                    <button type="button" className="exit-btn-sm reject" onClick={() => handleOpenReject(r)}>
                                      Reject
                                    </button>
                                  </>
                                )}
                                {isHrOrAdmin && r.status === 'Under Review' && (
                                  <>
                                    <button type="button" className="exit-btn-sm approve" onClick={() => handleOpenApprove(r)}>
                                      Approve
                                    </button>
                                    <button type="button" className="exit-btn-sm reject" onClick={() => handleOpenReject(r)}>
                                      Reject
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 2: NOTICE PERIOD ─── */}
        {activeTab === 'notice' && (
          <div className="exit-table-card">
            {noticePeriodRecords.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                No employees are currently serving notice.
              </div>
            ) : (
              <div className="exit-table-wrap">
                <table className="exit-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Resignation Date</th>
                      <th>Last Working Day</th>
                      <th>Days Remaining</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noticePeriodRecords.map((r) => {
                      const name = r.user?.personalInfo?.fullName || [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') || r.user?.email;
                      const lwd = r.approvedLastWorkingDay || r.proposedLastWorkingDay;
                      const diffMs = new Date(lwd).getTime() - Date.now();
                      const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

                      return (
                        <tr key={r._id}>
                          <td><strong>{name}</strong></td>
                          <td><span className="hr-emp-dept-pill">{r.user?.department || 'General'}</span></td>
                          <td>{formatDate(r.resignationDate)}</td>
                          <td><strong>{formatDate(lwd)}</strong></td>
                          <td>
                            <strong style={{ color: daysLeft <= 7 ? '#DC2626' : '#EA580C' }}>
                              {daysLeft} days
                            </strong>
                          </td>
                          <td>
                            <span className={`exit-badge ${r.status.toLowerCase().replace(' ', '_')}`}>
                              {r.status}
                            </span>
                          </td>
                          <td>
                            {isHrOrAdmin && (
                              <button type="button" className="exit-btn-sm view" onClick={() => handleOpenApprove(r)}>
                                Change LWD
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 3: EXIT CLEARANCE ─── */}
        {activeTab === 'clearance' && (
          <div className="exit-table-card">
            {noticePeriodRecords.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                No active offboarding employees requiring exit clearance.
              </div>
            ) : (
              <div className="exit-table-wrap">
                <table className="exit-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>HR Clearance</th>
                      <th>Manager Clearance</th>
                      <th>Finance Clearance</th>
                      <th>IT / Assets</th>
                      <th>Knowledge Transfer</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noticePeriodRecords.map((r) => {
                      const name = r.user?.personalInfo?.fullName || [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') || r.user?.email;
                      return (
                        <tr key={r._id}>
                          <td><strong>{name}</strong></td>
                          <td>
                            <button
                              type="button"
                              className={`exit-btn-sm ${r.clearance?.hr?.status === 'Completed' ? 'approve' : 'view'}`}
                              onClick={() => isHrOrAdmin && handleUpdateClearance(r._id, 'hr', r.clearance?.hr?.status === 'Completed' ? 'Pending' : 'Completed')}
                            >
                              {r.clearance?.hr?.status === 'Completed' ? 'Completed' : 'Pending'}
                            </button>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`exit-btn-sm ${r.clearance?.manager?.status === 'Completed' ? 'approve' : 'view'}`}
                              onClick={() => isHrOrAdmin && handleUpdateClearance(r._id, 'manager', r.clearance?.manager?.status === 'Completed' ? 'Pending' : 'Completed')}
                            >
                              {r.clearance?.manager?.status === 'Completed' ? 'Completed' : 'Pending'}
                            </button>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`exit-btn-sm ${r.clearance?.finance?.status === 'Completed' ? 'approve' : 'view'}`}
                              onClick={() => isHrOrAdmin && handleUpdateClearance(r._id, 'finance', r.clearance?.finance?.status === 'Completed' ? 'Pending' : 'Completed')}
                            >
                              {r.clearance?.finance?.status === 'Completed' ? 'Completed' : 'Pending'}
                            </button>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`exit-btn-sm ${r.clearance?.itAssets?.status === 'Completed' ? 'approve' : 'view'}`}
                              onClick={() => isHrOrAdmin && handleUpdateClearance(r._id, 'itAssets', r.clearance?.itAssets?.status === 'Completed' ? 'Pending' : 'Completed')}
                            >
                              {r.clearance?.itAssets?.status === 'Completed' ? 'Completed' : 'Pending'}
                            </button>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`exit-btn-sm ${r.clearance?.knowledgeTransfer?.status === 'Completed' ? 'approve' : 'view'}`}
                              onClick={() => isHrOrAdmin && handleUpdateClearance(r._id, 'knowledgeTransfer', r.clearance?.knowledgeTransfer?.status === 'Completed' ? 'Pending' : 'Completed')}
                            >
                              {r.clearance?.knowledgeTransfer?.status === 'Completed' ? 'Completed' : 'Pending'}
                            </button>
                          </td>
                          <td>
                            {isHrOrAdmin && (
                              <button
                                type="button"
                                className="exit-btn-sm complete"
                                onClick={() => {
                                  setSelectedRecord(r);
                                  setShowCompleteExitModal(true);
                                }}
                              >
                                Complete Exit
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 4: FINAL SETTLEMENT ─── */}
        {activeTab === 'settlement' && (
          <div className="exit-table-card">
            {noticePeriodRecords.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                No employees pending final settlement.
              </div>
            ) : (
              <div className="exit-table-wrap">
                <table className="exit-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Last Working Day</th>
                      <th>Settlement Amount</th>
                      <th>Settlement Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noticePeriodRecords.map((r) => {
                      const name = r.user?.personalInfo?.fullName || [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') || r.user?.email;
                      const fin = r.clearance?.finance || {};
                      return (
                        <tr key={r._id}>
                          <td><strong>{name}</strong></td>
                          <td>{formatDate(r.approvedLastWorkingDay || r.proposedLastWorkingDay)}</td>
                          <td><strong>₹{(fin.settlementAmount || 45000).toLocaleString('en-IN')}</strong></td>
                          <td>
                            <span className={`exit-badge ${fin.settlementStatus === 'Completed' ? 'approved' : 'submitted'}`}>
                              {fin.settlementStatus || 'Pending'}
                            </span>
                          </td>
                          <td>
                            {isHrOrAdmin && fin.settlementStatus !== 'Completed' && (
                              <button
                                type="button"
                                className="exit-btn-sm approve"
                                onClick={async () => {
                                  await apiClient.patch(`/resignation/${r._id}/clearance`, {
                                    departmentKey: 'finance',
                                    status: 'Completed',
                                    settlementStatus: 'Completed',
                                    settlementAmount: fin.settlementAmount || 45000,
                                  });
                                  setSuccess('Final settlement processed and marked Completed.');
                                  loadData();
                                }}
                              >
                                Finalize Settlement
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── RESIGNATION DETAILS MODAL ─── */}
        {showDetailModal && selectedRecord && (
          <div className="hr-modal-overlay" onClick={() => setShowDetailModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
              <div className="hr-modal-header">
                <h3>Resignation Details</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowDetailModal(false)}>&times;</button>
              </div>

              <div className="hr-modal-body">
                {/* Employee Information */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <h5 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', fontWeight: '700' }}>Employee Information</h5>
                  <div className="hr-profile-details-grid">
                    <div className="hr-profile-item">
                      <span>Name</span>
                      <strong>{selectedRecord.user?.personalInfo?.fullName || [selectedRecord.user?.firstName, selectedRecord.user?.lastName].filter(Boolean).join(' ') || selectedRecord.user?.email}</strong>
                    </div>
                    <div className="hr-profile-item">
                      <span>Employee ID</span>
                      <strong>{selectedRecord.user?.jobDetails?.employeeId || `EMP-${selectedRecord.user?._id?.slice(-5).toUpperCase()}`}</strong>
                    </div>
                    <div className="hr-profile-item">
                      <span>Department</span>
                      <strong>{selectedRecord.user?.jobDetails?.department || selectedRecord.user?.department || 'General'}</strong>
                    </div>
                    <div className="hr-profile-item">
                      <span>Designation</span>
                      <strong>{selectedRecord.user?.jobDetails?.designation || selectedRecord.user?.designation || 'Staff'}</strong>
                    </div>
                    <div className="hr-profile-item full-width">
                      <span>Email</span>
                      <strong>{selectedRecord.user?.email}</strong>
                    </div>
                  </div>
                </div>

                {/* Resignation Information */}
                <div>
                  <h5 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', fontWeight: '700' }}>Resignation Information</h5>
                  <div className="hr-profile-details-grid">
                    <div className="hr-profile-item">
                      <span>Resignation Date</span>
                      <strong>{formatDate(selectedRecord.resignationDate)}</strong>
                    </div>
                    <div className="hr-profile-item">
                      <span>Last Working Day</span>
                      <strong>{formatDate(selectedRecord.approvedLastWorkingDay || selectedRecord.proposedLastWorkingDay)}</strong>
                    </div>
                    <div className="hr-profile-item full-width">
                      <span>Reason</span>
                      <strong>{selectedRecord.reason}</strong>
                    </div>
                    {selectedRecord.employeeComments && (
                      <div className="hr-profile-item full-width">
                        <span>Employee Comments</span>
                        <strong>{selectedRecord.employeeComments}</strong>
                      </div>
                    )}
                    <div className="hr-profile-item">
                      <span>Status</span>
                      <span className={`exit-badge ${selectedRecord.status.toLowerCase().replace(' ', '_')}`}>
                        {selectedRecord.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hr-modal-footer">
                <button type="button" className="hr-btn-secondary" onClick={() => setShowDetailModal(false)}>Close</button>
                {isHrOrAdmin && (
                  <>
                    <button type="button" className="exit-btn-sm view" onClick={() => handleOpenApprove(selectedRecord)}>
                      Change Last Working Day
                    </button>
                    {selectedRecord.status === 'Submitted' && (
                      <>
                        <button type="button" className="exit-btn-sm approve" onClick={() => handleOpenApprove(selectedRecord)}>
                          Approve
                        </button>
                        <button type="button" className="exit-btn-sm reject" onClick={() => handleOpenReject(selectedRecord)}>
                          Reject
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── APPROVE / CHANGE LWD MODAL ─── */}
        {showApproveModal && selectedRecord && (
          <div className="hr-modal-overlay" onClick={() => setShowApproveModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="hr-modal-header">
                <h3>{selectedRecord.status === 'Submitted' ? 'Approve Resignation' : 'Update Last Working Day'}</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowApproveModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleSaveApprove}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid">
                    <div className="hr-form-group full-width">
                      <label>Approved Last Working Day *</label>
                      <input
                        type="date"
                        required
                        value={approveForm.approvedLastWorkingDay}
                        onChange={(e) => setApproveForm({ ...approveForm, approvedLastWorkingDay: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group full-width">
                      <label>HR Remarks</label>
                      <textarea
                        rows={2}
                        placeholder="Optional remarks..."
                        value={approveForm.hrRemarks}
                        onChange={(e) => setApproveForm({ ...approveForm, hrRemarks: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowApproveModal(false)}>Cancel</button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save & Confirm'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── REJECT MODAL ─── */}
        {showRejectModal && selectedRecord && (
          <div className="hr-modal-overlay" onClick={() => setShowRejectModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
              <div className="hr-modal-header">
                <h3>Reject Resignation</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowRejectModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleSaveReject}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid">
                    <div className="hr-form-group full-width">
                      <label>Rejection Reason *</label>
                      <textarea
                        rows={3}
                        required
                        placeholder="Reason for rejecting this resignation..."
                        value={rejectForm.rejectionReason}
                        onChange={(e) => setRejectForm({ ...rejectForm, rejectionReason: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
                  <button type="submit" className="exit-btn-sm reject" style={{ padding: '0.6rem 1.25rem' }} disabled={submitting}>
                    {submitting ? 'Rejecting...' : 'Reject Resignation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── COMPLETE EXIT CONFIRMATION MODAL ─── */}
        {showCompleteExitModal && selectedRecord && (
          <div className="hr-modal-overlay" onClick={() => setShowCompleteExitModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
              <div className="hr-modal-header">
                <h3>Complete Exit</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowCompleteExitModal(false)}>&times;</button>
              </div>

              <div className="hr-modal-body">
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👋</div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>
                    Are you sure you want to complete this employee's exit?
                  </h4>
                  <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: '1.5' }}>
                    This will mark <strong>{selectedRecord.user?.personalInfo?.fullName || selectedRecord.user?.email}</strong> as <strong>Exited</strong>. The employee record and all historical records (attendance, leaves, payroll) will remain safely preserved in MongoDB.
                  </p>
                </div>
              </div>

              <div className="hr-modal-footer">
                <button type="button" className="hr-btn-secondary" onClick={() => setShowCompleteExitModal(false)}>Cancel</button>
                <button
                  type="button"
                  className="exit-btn-sm complete"
                  style={{ padding: '0.65rem 1.25rem' }}
                  disabled={submitting}
                  onClick={handleCompleteExit}
                >
                  {submitting ? 'Completing...' : 'Confirm & Complete Exit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── ADD RESIGNATION MODAL (MODIFIED FROM RECORD RESIGNATION) ─── */}
        {(showAddResignationModal || showEmployeeSubmitModal) && (
          <div className="hr-modal-overlay" onClick={() => { setShowAddResignationModal(false); setShowEmployeeSubmitModal(false); }}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
              <div className="hr-modal-header">
                <h3>{isHrOrAdmin ? 'Add Resignation' : 'Submit Resignation'}</h3>
                <button type="button" className="hr-modal-close" onClick={() => { setShowAddResignationModal(false); setShowEmployeeSubmitModal(false); }}>&times;</button>
              </div>

              <form onSubmit={handleSaveResignation}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid">
                    {isHrOrAdmin && (
                      <div className="hr-form-group full-width">
                        <label>Select Employee *</label>
                        <select
                          required
                          value={resignationForm.userId}
                          onChange={(e) => setResignationForm({ ...resignationForm, userId: e.target.value })}
                        >
                          <option value="">Select Employee</option>
                          {employees.map((emp) => {
                            const name = emp.personalInfo?.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.email;
                            return (
                              <option key={emp._id} value={emp._id}>
                                {name} ({emp.department || 'General'})
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}

                    <div className="hr-form-group">
                      <label>Resignation Date *</label>
                      <input
                        type="date"
                        required
                        value={resignationForm.resignationDate}
                        onChange={(e) => setResignationForm({ ...resignationForm, resignationDate: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Proposed Last Working Day *</label>
                      <input
                        type="date"
                        required
                        value={resignationForm.proposedLastWorkingDay}
                        onChange={(e) => setResignationForm({ ...resignationForm, proposedLastWorkingDay: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Reason for Resignation *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Higher Studies / Relocation / Career Opportunity"
                        value={resignationForm.reason}
                        onChange={(e) => setResignationForm({ ...resignationForm, reason: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Comments / Transition Notes</label>
                      <textarea
                        rows={3}
                        placeholder="Additional details regarding transition handover..."
                        value={resignationForm.employeeComments}
                        onChange={(e) => setResignationForm({ ...resignationForm, employeeComments: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => { setShowAddResignationModal(false); setShowEmployeeSubmitModal(false); }}>Cancel</button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save & Submit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── TERMINATE EMPLOYEE MODAL ─── */}
        {showTerminateModal && (
          <div className="hr-modal-overlay" onClick={() => setShowTerminateModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
              <div className="hr-modal-header">
                <h3 style={{ color: '#DC2626' }}>Terminate Employee</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowTerminateModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleConfirmTermination}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid">
                    <div className="hr-form-group full-width">
                      <label>Select Employee *</label>
                      <select
                        required
                        value={terminateForm.userId}
                        onChange={(e) => setTerminateForm({ ...terminateForm, userId: e.target.value })}
                      >
                        <option value="">Select Employee</option>
                        {employees.map((emp) => {
                          const name = emp.personalInfo?.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.email;
                          return (
                            <option key={emp._id} value={emp._id}>
                              {name} ({emp.department || 'General'})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Effective Date *</label>
                      <input
                        type="date"
                        required
                        value={terminateForm.effectiveDate}
                        onChange={(e) => setTerminateForm({ ...terminateForm, effectiveDate: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Termination Reason *</label>
                      <select
                        required
                        value={terminateForm.terminationReason}
                        onChange={(e) => setTerminateForm({ ...terminateForm, terminationReason: e.target.value })}
                      >
                        <option value="Performance Issues">Performance Issues</option>
                        <option value="Gross Misconduct">Gross Misconduct</option>
                        <option value="Policy Violation">Policy Violation</option>
                        <option value="Contract Termination">Contract Termination</option>
                        <option value="Absence Without Leave (AWOL)">Absence Without Leave (AWOL)</option>
                        <option value="Mutual Agreement">Mutual Agreement</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Comments / Official Notes</label>
                      <textarea
                        rows={3}
                        placeholder="Document official reason and notes regarding this termination..."
                        value={terminateForm.comments}
                        onChange={(e) => setTerminateForm({ ...terminateForm, comments: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowTerminateModal(false)}>Cancel</button>
                  <button
                    type="submit"
                    className="exit-btn-sm reject"
                    style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem' }}
                    disabled={submitting}
                  >
                    {submitting ? 'Processing...' : 'Confirm Termination'}
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
