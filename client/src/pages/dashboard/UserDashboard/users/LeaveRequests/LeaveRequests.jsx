import React, { useContext, useEffect, useMemo, useState } from 'react';
import apiClient from '../../../../../services/apiClient';
import { AppContext } from '../../../../../context/AppContext';
import UserLayout from '../components/UserLayout';
import './LeaveRequests.css';
import '../Employees/HREmployees.css';

/* ─── Helpers ─── */
const formatDate = (val) => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return String(val);
  }
};

const calculateDays = (start, end) => {
  if (!start || !end) return 1;
  const s = new Date(start);
  const e = new Date(end);
  const diffTime = Math.abs(e - s);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return isNaN(diffDays) ? 1 : Math.max(1, diffDays);
};

const getInitials = (firstName, lastName, email) => {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return 'EM';
};

const getEmployeeName = (u) => {
  if (!u) return 'Employee';
  if (u.personalInfo?.fullName) return u.personalInfo.fullName;
  const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return full || u.email || 'Employee';
};

const getEmployeeDepartment = (u) => {
  if (!u) return '—';
  return u.department || u.jobDetails?.department || '—';
};

const getEmployeeDesignation = (u) => {
  if (!u) return 'Staff';
  return u.designation || u.jobDetails?.designation || 'Staff';
};

const getEmployeeId = (u) => {
  if (!u) return '—';
  return u.jobDetails?.employeeId || (u._id ? `EMP-${String(u._id).slice(-5).toUpperCase()}` : '—');
};

const STANDARD_POLICY = {
  Casual: 12,
  Sick: 10,
  Annual: 15,
  Unpaid: 0,
};

const OFFICIAL_DEPARTMENTS = ['Tech', 'Finance', 'Business Development', 'Digital Marketing', 'Video Editor', 'HR'];

export default function LeaveRequests() {
  const { user } = useContext(AppContext);

  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Active Workspace Tab
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'calendar' | 'balances' | 'departments' | 'policy'

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('All');

  // Modals
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [approvalNote, setApprovalNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [applyForm, setApplyForm] = useState({
    type: 'Casual',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    reason: '',
  });

  const [editForm, setEditForm] = useState({
    type: 'Casual',
    startDate: '',
    endDate: '',
    reason: '',
  });

  // Calendar State
  const [calCurrentDate, setCalCurrentDate] = useState(new Date());

  // Selected Employee for Balance Tab
  const [selectedBalanceEmpId, setSelectedBalanceEmpId] = useState('');
  const [balancePeriod, setBalancePeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [leaveAttSummary, setLeaveAttSummary] = useState(null);
  const [leaveAttLoading, setLeaveAttLoading] = useState(false);

  // Today Date string for comparisons (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Fetch real database records from MongoDB Atlas
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [leaveRes, userRes] = await Promise.all([
        apiClient.get('/leave-requests'),
        apiClient.get('/users').catch(() => ({ data: { data: [] } })),
      ]);

      const leaveData = leaveRes.data?.data || [];
      setRequests(leaveData);

      const allUsers = (userRes.data?.data || []).filter(
        (u) => u.role === 'employee' && u.isActive !== false && u.employmentStatus !== 'Exited' && u.employmentStatus !== 'Terminated'
      );
      setEmployees(allUsers);
      if (allUsers.length > 0 && !selectedBalanceEmpId) {
        setSelectedBalanceEmpId(allUsers[0]._id);
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to load leave records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch attendance summary for the selected employee in the Balances tab
  useEffect(() => {
    if (!selectedBalanceEmpId || !balancePeriod) {
      setLeaveAttSummary(null);
      return;
    }
    setLeaveAttLoading(true);
    apiClient
      .get('/payroll/attendance-summary', { params: { userId: selectedBalanceEmpId, payPeriod: balancePeriod } })
      .then((r) => setLeaveAttSummary(r.data?.data || null))
      .catch(() => setLeaveAttSummary(null))
      .finally(() => setLeaveAttLoading(false));
  }, [selectedBalanceEmpId, balancePeriod]);

  // 1. Dynamic KPI Counts directly from real database records
  const kpiStats = useMemo(() => {
    const pendingCount = requests.filter((r) => r.status === 'Pending').length;
    const approvedCount = requests.filter((r) => r.status === 'Approved').length;
    const rejectedCount = requests.filter((r) => r.status === 'Rejected').length;
    const totalCount = requests.length;

    return {
      pendingCount,
      approvedCount,
      rejectedCount,
      totalCount,
    };
  }, [requests]);

  // 2. Filtered Leave Requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const name = getEmployeeName(r.user).toLowerCase();
      const email = (r.user?.email || '').toLowerCase();
      const empId = getEmployeeId(r.user).toLowerCase();
      const q = search.toLowerCase();
      const matchesSearch = !q || name.includes(q) || email.includes(q) || empId.includes(q);

      const dept = getEmployeeDepartment(r.user);
      const matchesDept = selectedDept === 'All' || dept === selectedDept;
      const matchesType = selectedType === 'All' || r.type === selectedType;
      const matchesStatus = selectedStatus === 'All' || r.status === selectedStatus;

      const leaveMonth = r.startDate ? String(r.startDate).slice(0, 7) : '';
      const matchesMonth = selectedMonth === 'All' || leaveMonth === selectedMonth;

      return matchesSearch && matchesDept && matchesType && matchesStatus && matchesMonth;
    });
  }, [requests, search, selectedDept, selectedType, selectedStatus, selectedMonth]);

  // Available Months for filter
  const availableMonths = useMemo(() => {
    const set = new Set();
    requests.forEach((r) => {
      if (r.startDate) set.add(String(r.startDate).slice(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [requests]);

  // Modal Handlers
  const handleOpenDetail = (req) => {
    setSelectedRequest(req);
    setShowDetailModal(true);
  };

  const handleOpenEdit = (req) => {
    const target = req || selectedRequest;
    if (!target) return;
    setSelectedRequest(target);
    setEditForm({
      type: target.type || 'Casual',
      startDate: target.startDate ? String(target.startDate).slice(0, 10) : '',
      endDate: target.endDate ? String(target.endDate).slice(0, 10) : '',
      reason: target.reason || '',
    });
    setShowDetailModal(false);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    if (!editForm.reason.trim()) {
      setError('Reason is required.');
      return;
    }
    if (new Date(editForm.endDate) < new Date(editForm.startDate)) {
      setError('End date cannot be earlier than start date.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await apiClient.put(`/leave-requests/${selectedRequest._id}`, {
        type: editForm.type,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        reason: editForm.reason.trim(),
      });
      const updated = res.data?.data || { ...selectedRequest, ...editForm };
      setShowEditModal(false);
      setSelectedRequest(updated);
      setShowDetailModal(true);
      setSuccess('Leave request updated successfully.');
      await loadData();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenApprove = (req) => {
    const target = req || selectedRequest;
    if (!target) return;
    setSelectedRequest(target);
    setApprovalNote(target.reviewNote && target.status === 'Approved' ? target.reviewNote : '');
    setShowApproveModal(true);
  };

  const handleSaveApprove = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await apiClient.patch(`/leave-requests/${selectedRequest._id}/status`, {
        status: 'Approved',
        approvalNote: approvalNote.trim(),
      });
      const updated = res.data?.data || { ...selectedRequest, status: 'Approved', reviewNote: approvalNote.trim() };
      setShowApproveModal(false);
      setSelectedRequest(updated);
      setSuccess(`Leave request for ${getEmployeeName(selectedRequest.user)} has been Approved.`);
      await loadData();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to approve leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenReject = (req) => {
    const target = req || selectedRequest;
    if (!target) return;
    setSelectedRequest(target);
    setRejectionReason(target.rejectionReason || (target.status === 'Rejected' ? target.reviewNote : ''));
    setShowRejectModal(true);
  };

  const handleSaveReject = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    if (!rejectionReason.trim()) {
      setError('Rejection reason is mandatory.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await apiClient.patch(`/leave-requests/${selectedRequest._id}/status`, {
        status: 'Rejected',
        rejectionReason: rejectionReason.trim(),
      });
      const updated = res.data?.data || { ...selectedRequest, status: 'Rejected', rejectionReason: rejectionReason.trim(), reviewNote: rejectionReason.trim() };
      setShowRejectModal(false);
      setSelectedRequest(updated);
      setSuccess(`Leave request for ${getEmployeeName(selectedRequest.user)} has been Rejected.`);
      await loadData();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to reject leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenApply = () => {
    setError('');
    setSuccess('');
    setApplyForm({
      type: 'Casual',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      reason: '',
    });
    setShowApplyModal(true);
  };

  const handleSaveApply = async (e) => {
    e.preventDefault();
    if (!applyForm.reason.trim()) {
      setError('Please provide a reason for the leave request.');
      return;
    }
    if (new Date(applyForm.endDate) < new Date(applyForm.startDate)) {
      setError('End date cannot be earlier than start date.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await apiClient.post('/leave-requests', {
        ...applyForm,
        user: user?.userId,
        status: 'Pending',
      });
      setShowApplyModal(false);
      setSuccess('Leave request submitted successfully as Pending.');
      await loadData();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setSelectedDept('All');
    setSelectedType('All');
    setSelectedStatus('All');
    setSelectedMonth('All');
  };

  // 3. Employee Real Leave Balance Calculation
  const employeeBalances = useMemo(() => {
    if (!selectedBalanceEmpId) return null;
    const emp = employees.find((e) => e._id === selectedBalanceEmpId);
    if (!emp) return null;

    const empRequests = requests.filter((r) => {
      const uId = r.user?._id || r.user;
      return String(uId) === String(selectedBalanceEmpId);
    });

    const calculateUsage = (type) => {
      const approved = empRequests
        .filter((r) => r.type === type && r.status === 'Approved')
        .reduce((sum, r) => sum + calculateDays(r.startDate, r.endDate), 0);

      const pending = empRequests
        .filter((r) => r.type === type && r.status === 'Pending')
        .reduce((sum, r) => sum + calculateDays(r.startDate, r.endDate), 0);

      const allowed = STANDARD_POLICY[type] || 0;
      const remaining = Math.max(0, allowed - approved);

      return { allowed, approved, pending, remaining };
    };

    return {
      employee: emp,
      casual: calculateUsage('Casual'),
      sick: calculateUsage('Sick'),
      annual: calculateUsage('Annual'),
      unpaid: calculateUsage('Unpaid'),
      history: empRequests,
    };
  }, [selectedBalanceEmpId, employees, requests]);

  // 4. Meaningful Real Department Overview
  const departmentSummaries = useMemo(() => {
    const map = {};
    OFFICIAL_DEPARTMENTS.forEach((dept) => {
      map[dept] = {
        name: dept,
        totalEmployees: 0,
        pendingRequests: 0,
        approvedLeaves: 0,
        rejectedLeaves: 0,
        onLeaveToday: 0,
      };
    });

    employees.forEach((emp) => {
      const d = getEmployeeDepartment(emp);
      if (map[d]) {
        map[d].totalEmployees += 1;
      }
    });

    requests.forEach((r) => {
      const d = getEmployeeDepartment(r.user);
      if (!map[d]) return;

      if (r.status === 'Pending') {
        map[d].pendingRequests += 1;
      } else if (r.status === 'Approved') {
        map[d].approvedLeaves += 1;
        const start = r.startDate ? String(r.startDate).slice(0, 10) : '';
        const end = r.endDate ? String(r.endDate).slice(0, 10) : '';
        if (start <= todayStr && todayStr <= end) {
          map[d].onLeaveToday += 1;
        }
      } else if (r.status === 'Rejected') {
        map[d].rejectedLeaves += 1;
      }
    });

    return Object.values(map);
  }, [employees, requests, todayStr]);

  // 5. Calendar Computation
  const calendarDays = useMemo(() => {
    const year = calCurrentDate.getFullYear();
    const month = calCurrentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const d = new Date(year, month - 1, dayNum);
      days.push({
        dateStr: d.toISOString().slice(0, 10),
        dayNum,
        isCurrentMonth: false,
        events: [],
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dayEvents = requests.filter((r) => {
        if (r.status !== 'Approved') return false;
        const start = r.startDate ? String(r.startDate).slice(0, 10) : '';
        const end = r.endDate ? String(r.endDate).slice(0, 10) : '';
        return start <= dStr && dStr <= end;
      });

      days.push({
        dateStr: dStr,
        dayNum,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        events: dayEvents,
      });
    }

    // Next month padding
    const remainingSlots = 42 - days.length;
    if (remainingSlots < 7) {
      for (let dayNum = 1; dayNum <= remainingSlots; dayNum++) {
        const d = new Date(year, month + 1, dayNum);
        days.push({
          dateStr: d.toISOString().slice(0, 10),
          dayNum,
          isCurrentMonth: false,
          events: [],
        });
      }
    }

    return days;
  }, [calCurrentDate, requests, todayStr]);

  const calMonthTitle = calCurrentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <UserLayout pageTitle="Leave Management">
      <div className="leave-container">
        {/* Header */}
        <div className="leave-header">
          <div className="leave-title-area">
            <h2>Leave Management</h2>
            <p>Centrally monitor, review, approve/reject and track incoming employee leave requests across all departments.</p>
          </div>
          <div className="leave-header-actions">
            <button type="button" className="leave-primary-btn" onClick={handleOpenApply}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '15px', height: '15px' }}>
                <path d="M12 5v14M5 12h14" />
              </svg>
              Apply For Leave
            </button>
          </div>
        </div>

        {/* 4 Dynamic Real KPI Statistics Cards */}
        <div className="leave-kpi-grid">
          <div className="leave-kpi-card amber">
            <div className="leave-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="leave-kpi-body">
              <span className="leave-kpi-label">Pending Requests</span>
              <strong className="leave-kpi-value">{kpiStats.pendingCount}</strong>
            </div>
          </div>

          <div className="leave-kpi-card green">
            <div className="leave-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="leave-kpi-body">
              <span className="leave-kpi-label">Approved Leaves</span>
              <strong className="leave-kpi-value">{kpiStats.approvedCount}</strong>
            </div>
          </div>

          <div className="leave-kpi-card red">
            <div className="leave-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div className="leave-kpi-body">
              <span className="leave-kpi-label">Rejected Leaves</span>
              <strong className="leave-kpi-value">{kpiStats.rejectedCount}</strong>
            </div>
          </div>

          <div className="leave-kpi-card blue">
            <div className="leave-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div className="leave-kpi-body">
              <span className="leave-kpi-label">Total Applications</span>
              <strong className="leave-kpi-value">{kpiStats.totalCount}</strong>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
        {success && <div style={{ background: '#DCFCE7', color: '#15803D', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>{success}</div>}

        {/* Workspace Navigation Tabs */}
        <div className="leave-nav-tabs-wrap">
          <div className="leave-nav-tabs">
            <button
              type="button"
              className={`leave-tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => setActiveTab('requests')}
            >
              Leave Requests <span className="leave-tab-badge">{requests.length}</span>
            </button>
            <button
              type="button"
              className={`leave-tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
              onClick={() => setActiveTab('calendar')}
            >
              Leave Calendar
            </button>
            <button
              type="button"
              className={`leave-tab-btn ${activeTab === 'balances' ? 'active' : ''}`}
              onClick={() => setActiveTab('balances')}
            >
              Leave Balances
            </button>
            <button
              type="button"
              className={`leave-tab-btn ${activeTab === 'departments' ? 'active' : ''}`}
              onClick={() => setActiveTab('departments')}
            >
              Department Overview
            </button>
            <button
              type="button"
              className={`leave-tab-btn ${activeTab === 'policy' ? 'active' : ''}`}
              onClick={() => setActiveTab('policy')}
            >
              Leave Policy
            </button>
          </div>
        </div>

        {/* ─── TAB 1: LEAVE REQUESTS TABLE ─── */}
        {activeTab === 'requests' && (
          <div>
            {/* Filter Toolbar */}
            <div className="leave-toolbar">
              <div className="leave-search-wrap">
                <svg className="leave-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by employee name, email or ID..."
                  className="leave-search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select className="leave-filter-select" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
                <option value="All">All Departments</option>
                {OFFICIAL_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select className="leave-filter-select" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>

              <select className="leave-filter-select" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
                <option value="All">All Leave Types</option>
                <option value="Casual">Casual Leave</option>
                <option value="Sick">Sick Leave</option>
                <option value="Annual">Annual Leave</option>
                <option value="Unpaid">Unpaid Leave</option>
                <option value="Other">Other</option>
              </select>

              {availableMonths.length > 0 && (
                <select className="leave-filter-select" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                  <option value="All">All Months</option>
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}

              {(search || selectedDept !== 'All' || selectedType !== 'All' || selectedStatus !== 'All' || selectedMonth !== 'All') && (
                <button type="button" className="leave-secondary-btn" onClick={handleClearFilters} style={{ padding: '0.55rem 0.8rem' }}>
                  Clear Filters
                </button>
              )}
            </div>

            {/* Leave Requests Table */}
            <div className="leave-table-card">
              {loading ? (
                <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>Loading leave requests...</div>
              ) : filteredRequests.length === 0 ? (
                <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏖️</div>
                  <strong>No leave requests found.</strong>
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>
                    No employee leave applications match your current filters.
                  </p>
                </div>
              ) : (
                <div className="leave-table-wrap">
                  <table className="leave-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Department</th>
                        <th>Leave Type</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Total Days</th>
                        <th>Reason</th>
                        <th>Applied Date</th>
                        <th>Status</th>
                        <th style={{ minWidth: '190px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.map((r) => {
                        const name = getEmployeeName(r.user);
                        const initials = getInitials(r.user?.firstName, r.user?.lastName, r.user?.email);
                        const dept = getEmployeeDepartment(r.user);
                        const days = calculateDays(r.startDate, r.endDate);

                        return (
                          <tr key={r._id}>
                            <td>
                              <div className="leave-emp-cell">
                                <div className="leave-emp-avatar">{initials}</div>
                                <div className="leave-emp-meta">
                                  <span className="leave-emp-name">{name}</span>
                                  <span className="leave-emp-email">{r.user?.email}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="hr-emp-dept-pill">{dept}</span>
                            </td>
                            <td>
                              <span className={`leave-type-pill ${r.type.toLowerCase()}`}>
                                {r.type}
                              </span>
                            </td>
                            <td>
                              <strong>{formatDate(r.startDate)}</strong>
                            </td>
                            <td>
                              <strong>{formatDate(r.endDate)}</strong>
                            </td>
                            <td>
                              <strong>{days} {days === 1 ? 'day' : 'days'}</strong>
                            </td>
                            <td style={{ maxWidth: '200px' }}>
                              <span style={{ display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={r.reason}>
                                {r.reason}
                              </span>
                            </td>
                            <td>
                              <span style={{ color: '#64748b' }}>{formatDate(r.createdAt || r.startDate)}</span>
                            </td>
                            <td>
                              <span className={`leave-status-badge ${r.status.toLowerCase()}`}>
                                {r.status}
                              </span>
                            </td>
                            <td>
                              <div className="leave-actions-wrap">
                                <button type="button" className="leave-btn-sm view" onClick={() => handleOpenDetail(r)}>
                                  View
                                </button>
                                {(r.status || '').toLowerCase() === 'pending' && (
                                  <>
                                    <button type="button" className="leave-btn-sm approve" onClick={() => handleOpenApprove(r)}>
                                      Approve
                                    </button>
                                    <button type="button" className="leave-btn-sm reject" onClick={() => handleOpenReject(r)}>
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

        {/* ─── TAB 2: LEAVE CALENDAR (HR ONLY) ─── */}
        {activeTab === 'calendar' && (
          <div className="leave-calendar-card">
            <div className="leave-calendar-header">
              <div className="leave-cal-nav">
                <button
                  type="button"
                  className="leave-secondary-btn"
                  onClick={() => setCalCurrentDate(new Date(calCurrentDate.getFullYear(), calCurrentDate.getMonth() - 1, 1))}
                >
                  ‹ Prev
                </button>
                <div className="leave-cal-month-title">{calMonthTitle}</div>
                <button
                  type="button"
                  className="leave-secondary-btn"
                  onClick={() => setCalCurrentDate(new Date(calCurrentDate.getFullYear(), calCurrentDate.getMonth() + 1, 1))}
                >
                  Next ›
                </button>
                <button
                  type="button"
                  className="leave-secondary-btn"
                  style={{ marginLeft: '0.5rem' }}
                  onClick={() => setCalCurrentDate(new Date())}
                >
                  Today
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.775rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#DBEAFE' }} /> Casual
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#FEE2E2' }} /> Sick
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#F3E8FF' }} /> Annual
                </span>
              </div>
            </div>

            <div className="leave-calendar-grid">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="leave-cal-day-header">{d}</div>
              ))}

              {calendarDays.map((cell, idx) => (
                <div
                  key={idx}
                  className={`leave-cal-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${cell.isToday ? 'today' : ''}`}
                >
                  <span className="leave-cal-date-num">{cell.dayNum}</span>
                  <div className="leave-cal-events-list">
                    {cell.events.map((ev) => {
                      const empName = getEmployeeName(ev.user);
                      const typeClass = ev.type.toLowerCase();
                      return (
                        <div
                          key={ev._id}
                          className={`leave-cal-event-pill leave-type-pill ${typeClass}`}
                          title={`${empName} (${ev.type} Leave)`}
                          onClick={() => handleOpenDetail(ev)}
                        >
                          {empName.split(' ')[0]} • {ev.type}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── TAB 3: LEAVE BALANCES (HR ONLY) ─── */}
        {activeTab === 'balances' && (
          <div>
            <div className="leave-toolbar" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <label style={{ fontWeight: '600', fontSize: '0.85rem', color: '#0f172a' }}>Select Employee:</label>
                <select
                  className="leave-filter-select"
                  style={{ minWidth: '280px' }}
                  value={selectedBalanceEmpId}
                  onChange={(e) => setSelectedBalanceEmpId(e.target.value)}
                >
                  {employees.map((emp) => {
                    const name = getEmployeeName(emp);
                    const dept = getEmployeeDepartment(emp);
                    return (
                      <option key={emp._id} value={emp._id}>
                        {name} ({dept})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {employeeBalances && (
              <div>
                <div className="leave-balance-grid">
                  {/* Casual Leave */}
                  <div className="leave-balance-card">
                    <div className="leave-bal-title-row">
                      <span className="leave-bal-type">Casual Leave</span>
                      <strong className="leave-bal-remaining">{employeeBalances.casual.remaining} left</strong>
                    </div>
                    <div className="leave-bal-progress-track">
                      <div
                        className="leave-bal-progress-fill"
                        style={{
                          width: `${Math.min(100, (employeeBalances.casual.approved / (employeeBalances.casual.allowed || 1)) * 100)}%`,
                          background: '#3B82F6',
                        }}
                      />
                    </div>
                    <div className="leave-bal-stats-row">
                      <span>Allowed: <strong>{employeeBalances.casual.allowed}</strong></span>
                      <span>Used: <strong>{employeeBalances.casual.approved}</strong></span>
                      <span>Pending: <strong>{employeeBalances.casual.pending}</strong></span>
                    </div>
                  </div>

                  {/* Sick Leave */}
                  <div className="leave-balance-card">
                    <div className="leave-bal-title-row">
                      <span className="leave-bal-type">Sick Leave</span>
                      <strong className="leave-bal-remaining">{employeeBalances.sick.remaining} left</strong>
                    </div>
                    <div className="leave-bal-progress-track">
                      <div
                        className="leave-bal-progress-fill"
                        style={{
                          width: `${Math.min(100, (employeeBalances.sick.approved / (employeeBalances.sick.allowed || 1)) * 100)}%`,
                          background: '#EF4444',
                        }}
                      />
                    </div>
                    <div className="leave-bal-stats-row">
                      <span>Allowed: <strong>{employeeBalances.sick.allowed}</strong></span>
                      <span>Used: <strong>{employeeBalances.sick.approved}</strong></span>
                      <span>Pending: <strong>{employeeBalances.sick.pending}</strong></span>
                    </div>
                  </div>

                  {/* Annual Leave */}
                  <div className="leave-balance-card">
                    <div className="leave-bal-title-row">
                      <span className="leave-bal-type">Annual Leave</span>
                      <strong className="leave-bal-remaining">{employeeBalances.annual.remaining} left</strong>
                    </div>
                    <div className="leave-bal-progress-track">
                      <div
                        className="leave-bal-progress-fill"
                        style={{
                          width: `${Math.min(100, (employeeBalances.annual.approved / (employeeBalances.annual.allowed || 1)) * 100)}%`,
                          background: '#8B5CF6',
                        }}
                      />
                    </div>
                    <div className="leave-bal-stats-row">
                      <span>Allowed: <strong>{employeeBalances.annual.allowed}</strong></span>
                      <span>Used: <strong>{employeeBalances.annual.approved}</strong></span>
                      <span>Pending: <strong>{employeeBalances.annual.pending}</strong></span>
                    </div>
                  </div>

                  {/* Unpaid Leave */}
                  <div className="leave-balance-card">
                    <div className="leave-bal-title-row">
                      <span className="leave-bal-type">Unpaid Leave</span>
                      <strong className="leave-bal-remaining" style={{ color: '#475569' }}>{employeeBalances.unpaid.approved} days</strong>
                    </div>
                    <div className="leave-bal-progress-track">
                      <div className="leave-bal-progress-fill" style={{ width: '0%', background: '#64748b' }} />
                    </div>
                    <div className="leave-bal-stats-row">
                      <span>Type: <strong>Unpaid / LOP</strong></span>
                      <span>Taken: <strong>{employeeBalances.unpaid.approved} days</strong></span>
                      <span>Pending: <strong>{employeeBalances.unpaid.pending}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Employee's Individual Leave History Table */}
                <div className="leave-table-card">
                  <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', background: '#F8FAFC' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#0f172a' }}>
                      Leave History: {getEmployeeName(employeeBalances.employee)} ({getEmployeeDepartment(employeeBalances.employee)})
                    </h4>
                  </div>
                  {employeeBalances.history.length === 0 ? (
                    <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>No leaves logged for this employee.</div>
                  ) : (
                    <div className="leave-table-wrap">
                      <table className="leave-table">
                        <thead>
                          <tr>
                            <th>Leave Type</th>
                            <th>Dates</th>
                            <th>Days</th>
                            <th>Reason</th>
                            <th>Status</th>
                            <th>Applied Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {employeeBalances.history.map((r) => (
                            <tr key={r._id}>
                              <td><span className={`leave-type-pill ${r.type.toLowerCase()}`}>{r.type}</span></td>
                              <td>{formatDate(r.startDate)} – {formatDate(r.endDate)}</td>
                              <td><strong>{calculateDays(r.startDate, r.endDate)} days</strong></td>
                              <td>{r.reason}</td>
                              <td><span className={`leave-status-badge ${r.status.toLowerCase()}`}>{r.status}</span></td>
                              <td>{formatDate(r.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── Attendance Overview Panel ─── */}
            {selectedBalanceEmpId && (
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#0f172a', fontWeight: '700' }}>Attendance Overview</h4>
                  <input
                    type="month"
                    value={balancePeriod}
                    onChange={(e) => setBalancePeriod(e.target.value)}
                    style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.3rem 0.6rem', fontSize: '0.825rem', color: '#0f172a', background: '#fff' }}
                  />
                </div>
                {leaveAttLoading ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Loading attendance data…</div>
                ) : leaveAttSummary ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
                    {[
                      { label: 'Working Days', value: leaveAttSummary.totalWorkingDays, color: '#0f172a' },
                      { label: 'Present', value: leaveAttSummary.presentCount, color: '#15803d' },
                      { label: 'Late', value: leaveAttSummary.lateCount, color: '#d97706', hideZero: true },
                      { label: 'Half Day', value: leaveAttSummary.halfDayCount, color: '#7c3aed', hideZero: true },
                      { label: 'Absent', value: leaveAttSummary.absentCount, color: '#dc2626', hideZero: true },
                      { label: 'Unpaid Leave', value: leaveAttSummary.unpaidApprovedDays, color: '#dc2626', hideZero: true },
                      { label: 'LOP Days', value: leaveAttSummary.lopDays, color: '#b91c1c', hideZero: true },
                    ]
                      .filter((item) => !item.hideZero || item.value > 0)
                      .map((item) => (
                        <div key={item.label} className="leave-balance-card" style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>{item.label}</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: item.color }}>{item.value}</div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No attendance records found for this period.</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 4: DEPARTMENT OVERVIEW (HR ONLY) ─── */}
        {activeTab === 'departments' && (
          <div className="leave-dept-grid">
            {departmentSummaries.map((dept) => (
              <div key={dept.name} className="leave-dept-card">
                <div className="leave-dept-card-header">
                  <span className="leave-dept-name">{dept.name}</span>
                  <span className="leave-dept-count-pill">{dept.totalEmployees} Employees</span>
                </div>
                <div className="leave-dept-metrics">
                  <div className="leave-dept-metric-col">
                    <span>Pending</span>
                    <strong style={{ color: dept.pendingRequests > 0 ? '#F59E0B' : '#0f172a' }}>{dept.pendingRequests}</strong>
                  </div>
                  <div className="leave-dept-metric-col">
                    <span>Approved</span>
                    <strong style={{ color: '#10B981' }}>{dept.approvedLeaves}</strong>
                  </div>
                  <div className="leave-dept-metric-col">
                    <span>Rejected</span>
                    <strong style={{ color: dept.rejectedLeaves > 0 ? '#EF4444' : '#0f172a' }}>{dept.rejectedLeaves}</strong>
                  </div>
                  <div className="leave-dept-metric-col">
                    <span>On Leave</span>
                    <strong style={{ color: dept.onLeaveToday > 0 ? '#EA580C' : '#0f172a' }}>{dept.onLeaveToday}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── TAB 5: LEAVE POLICY (HR ONLY) ─── */}
        {activeTab === 'policy' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            <div className="leave-balance-card" style={{ borderTop: '4px solid #3B82F6' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Casual Leave (CL)</h4>
              <p style={{ fontSize: '0.825rem', color: '#64748b', lineHeight: '1.5', margin: '0 0 1rem 0' }}>
                For personal errands, family emergencies, or brief time off.
              </p>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1D4ED8', marginBottom: '0.5rem' }}>
                12 Days / Year
              </div>
              <ul style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.775rem', color: '#475569', lineHeight: '1.6' }}>
                <li>Maximum 3 consecutive days at a time</li>
                <li>Requires 24-hour advance submission</li>
              </ul>
            </div>

            <div className="leave-balance-card" style={{ borderTop: '4px solid #EF4444' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Sick Leave (SL)</h4>
              <p style={{ fontSize: '0.825rem', color: '#64748b', lineHeight: '1.5', margin: '0 0 1rem 0' }}>
                For medical illness, recovery, or healthcare appointments.
              </p>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#B91C1C', marginBottom: '0.5rem' }}>
                10 Days / Year
              </div>
              <ul style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.775rem', color: '#475569', lineHeight: '1.6' }}>
                <li>Medical certificate required if &gt; 2 days</li>
                <li>Can be applied on the day of illness</li>
              </ul>
            </div>

            <div className="leave-balance-card" style={{ borderTop: '4px solid #8B5CF6' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Annual / Earned Leave (AL)</h4>
              <p style={{ fontSize: '0.825rem', color: '#64748b', lineHeight: '1.5', margin: '0 0 1rem 0' }}>
                For scheduled vacations, rest, and long planned time off.
              </p>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#6D28D9', marginBottom: '0.5rem' }}>
                15 Days / Year
              </div>
              <ul style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.775rem', color: '#475569', lineHeight: '1.6' }}>
                <li>Requires 7-day advance submission</li>
                <li>Carry-over up to 5 days allowed annually</li>
              </ul>
            </div>

            <div className="leave-balance-card" style={{ borderTop: '4px solid #64748B' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Unpaid Leave (LOP)</h4>
              <p style={{ fontSize: '0.825rem', color: '#64748b', lineHeight: '1.5', margin: '0 0 1rem 0' }}>
                When paid leave balance is exhausted or for extended leave.
              </p>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#334155', marginBottom: '0.5rem' }}>
                Approval Required
              </div>
              <ul style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.775rem', color: '#475569', lineHeight: '1.6' }}>
                <li>Subject to Management / HR approval</li>
                <li>Salary will be adjusted in the monthly payroll</li>
              </ul>
            </div>
          </div>
        )}

        {/* ─── LEAVE DETAILS MODAL ─── */}
        {showDetailModal && selectedRequest && (
          <div className="hr-modal-overlay" onClick={() => setShowDetailModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
              <div className="hr-modal-header">
                <h3>Leave Request Details</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowDetailModal(false)}>&times;</button>
              </div>

              <div className="hr-modal-body">
                {/* Employee Section */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <h5 style={{ margin: '0 0 0.6rem 0', color: '#0f172a', fontWeight: '700' }}>Employee Information</h5>
                  <div className="hr-profile-details-grid">
                    <div className="hr-profile-item">
                      <span>Employee Name</span>
                      <strong>{getEmployeeName(selectedRequest.user)}</strong>
                    </div>
                    <div className="hr-profile-item">
                      <span>Department</span>
                      <strong>{getEmployeeDepartment(selectedRequest.user)}</strong>
                    </div>
                    <div className="hr-profile-item">
                      <span>Designation</span>
                      <strong>{getEmployeeDesignation(selectedRequest.user)}</strong>
                    </div>
                    <div className="hr-profile-item">
                      <span>Email Address</span>
                      <strong>{selectedRequest.user?.email || '—'}</strong>
                    </div>
                  </div>
                </div>

                {/* Leave Info Section */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <h5 style={{ margin: 0, color: '#0f172a', fontWeight: '700' }}>Leave Information</h5>
                    <button
                      type="button"
                      className="leave-secondary-btn"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                      onClick={() => handleOpenEdit(selectedRequest)}
                    >
                      ✏️ Edit Leave Request
                    </button>
                  </div>

                  <div className="hr-profile-details-grid">
                    <div className="hr-profile-item">
                      <span>Leave Type</span>
                      <span className={`leave-type-pill ${selectedRequest.type.toLowerCase()}`}>{selectedRequest.type}</span>
                    </div>
                    <div className="hr-profile-item">
                      <span>Current Status</span>
                      <span className={`leave-status-badge ${selectedRequest.status.toLowerCase()}`}>{selectedRequest.status}</span>
                    </div>
                    <div className="hr-profile-item">
                      <span>Start Date</span>
                      <strong>{formatDate(selectedRequest.startDate)}</strong>
                    </div>
                    <div className="hr-profile-item">
                      <span>End Date</span>
                      <strong>{formatDate(selectedRequest.endDate)}</strong>
                    </div>
                    <div className="hr-profile-item">
                      <span>Total Days</span>
                      <strong>{calculateDays(selectedRequest.startDate, selectedRequest.endDate)} Days</strong>
                    </div>
                    <div className="hr-profile-item">
                      <span>Applied Date</span>
                      <strong>{formatDate(selectedRequest.createdAt || selectedRequest.startDate)}</strong>
                    </div>
                    <div className="hr-profile-item full-width">
                      <span>Reason for Leave</span>
                      <strong>{selectedRequest.reason}</strong>
                    </div>
                    {selectedRequest.reviewNote && (
                      <div className="hr-profile-item full-width" style={{ background: '#FFF7ED', padding: '0.6rem', borderRadius: '6px' }}>
                        <span style={{ color: '#EA580C' }}>
                          {selectedRequest.status === 'Rejected' ? 'Rejection Reason' : 'Approval Note / Remarks'}
                        </span>
                        <strong style={{ color: '#9A3412' }}>{selectedRequest.reviewNote}</strong>
                      </div>
                    )}
                    {selectedRequest.reviewedBy && (
                      <div className="hr-profile-item full-width">
                        <span>Reviewed By</span>
                        <strong>
                          {getEmployeeName(selectedRequest.reviewedBy)}
                          {selectedRequest.reviewedAt ? ` on ${formatDate(selectedRequest.reviewedAt)}` : ''}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="hr-modal-footer">
                <button type="button" className="hr-btn-secondary" onClick={() => setShowDetailModal(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* ─── EDIT LEAVE REQUEST MODAL (HR) ─── */}
        {showEditModal && selectedRequest && (
          <div className="hr-modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
              <div className="hr-modal-header">
                <h3>Edit Leave Request</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowEditModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleSaveEdit}>
                <div className="hr-modal-body">
                  {/* Locked Employee Display */}
                  <div style={{ background: '#F8FAFC', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.725rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', marginBottom: '0.2rem' }}>
                      Employee (Locked)
                    </div>
                    <div style={{ fontWeight: '700', color: '#0f172a' }}>
                      {getEmployeeName(selectedRequest.user)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {getEmployeeDepartment(selectedRequest.user)} • {selectedRequest.user?.email}
                    </div>
                  </div>

                  {/* Status & HR Decision Action Bar inside Modal */}
                  <div style={{ background: '#F1F5F9', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid #CBD5E1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.775rem', fontWeight: '700', color: '#334155' }}>Current Status:</span>
                        <span className={`leave-status-badge ${selectedRequest.status.toLowerCase()}`}>
                          {selectedRequest.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {selectedRequest.status === 'Pending' && (
                          <>
                            <button
                              type="button"
                              className="leave-btn-sm approve"
                              onClick={() => {
                                setShowEditModal(false);
                                handleOpenApprove(selectedRequest);
                              }}
                            >
                              ✓ Approve
                            </button>
                            <button
                              type="button"
                              className="leave-btn-sm reject"
                              onClick={() => {
                                setShowEditModal(false);
                                handleOpenReject(selectedRequest);
                              }}
                            >
                              ✗ Reject
                            </button>
                          </>
                        )}
                        {selectedRequest.status === 'Approved' && (
                          <button
                            type="button"
                            className="leave-btn-sm reject"
                            onClick={() => {
                              setShowEditModal(false);
                              handleOpenReject(selectedRequest);
                            }}
                          >
                            Reject / Change Decision
                          </button>
                        )}
                        {selectedRequest.status === 'Rejected' && (
                          <button
                            type="button"
                            className="leave-btn-sm approve"
                            onClick={() => {
                              setShowEditModal(false);
                              handleOpenApprove(selectedRequest);
                            }}
                          >
                            Approve / Change Decision
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {selectedRequest.status === 'Pending' && 'Decision pending. You can approve/reject above, or edit request details below and save.'}
                      {selectedRequest.status === 'Approved' && 'This request is currently Approved. Click "Reject / Change Decision" to change status to Rejected.'}
                      {selectedRequest.status === 'Rejected' && `This request is currently Rejected. ${selectedRequest.reviewNote ? `Reason: "${selectedRequest.reviewNote}". ` : ''}Click "Approve / Change Decision" to approve.`}
                    </div>
                  </div>

                  {/* Form fields for Leave Type, Dates, Reason */}
                  <div className="hr-form-grid">
                    <div className="hr-form-group full-width">
                      <label>Leave Type *</label>
                      <select
                        required
                        value={editForm.type}
                        onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                      >
                        <option value="Casual">Casual Leave</option>
                        <option value="Sick">Sick Leave</option>
                        <option value="Annual">Annual Leave</option>
                        <option value="Unpaid">Unpaid Leave</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Start Date *</label>
                      <input
                        type="date"
                        required
                        value={editForm.startDate}
                        onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>End Date *</label>
                      <input
                        type="date"
                        required
                        value={editForm.endDate}
                        onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Reason for Leave *</label>
                      <textarea
                        rows={3}
                        required
                        placeholder="Specify reason..."
                        value={editForm.reason}
                        onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Saving Changes...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── APPROVE CONFIRMATION MODAL ─── */}
        {showApproveModal && selectedRequest && (
          <div className="hr-modal-overlay" onClick={() => setShowApproveModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="hr-modal-header">
                <h3 style={{ color: '#15803D' }}>Confirm Leave Approval</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowApproveModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleSaveApprove}>
                <div className="hr-modal-body">
                  <div style={{ background: '#F0FDF4', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #BBF7D0' }}>
                    <div style={{ color: '#15803D', fontWeight: '700', marginBottom: '0.35rem', fontSize: '0.95rem' }}>
                      Are you sure you want to approve this leave request?
                    </div>
                    <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '1rem' }}>
                      {getEmployeeName(selectedRequest.user)}
                    </div>
                    <div style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '0.2rem' }}>
                      {getEmployeeDepartment(selectedRequest.user)} • {selectedRequest.type} Leave • {calculateDays(selectedRequest.startDate, selectedRequest.endDate)} days ({formatDate(selectedRequest.startDate)} – {formatDate(selectedRequest.endDate)})
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.4rem', fontStyle: 'italic', background: '#ffffff', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #DCFCE7' }}>
                      "{selectedRequest.reason}"
                    </div>
                  </div>

                  <div className="hr-form-group full-width">
                    <label>Approval Remarks / Note (Optional)</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Approved. Handover confirmed."
                      value={approvalNote}
                      onChange={(e) => setApprovalNote(e.target.value)}
                    />
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowApproveModal(false)}>Cancel</button>
                  <button type="submit" className="leave-btn-sm approve" style={{ padding: '0.65rem 1.3rem', fontSize: '0.85rem' }} disabled={submitting}>
                    {submitting ? 'Approving...' : 'Confirm & Approve'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── REJECT LEAVE MODAL ─── */}
        {showRejectModal && selectedRequest && (
          <div className="hr-modal-overlay" onClick={() => setShowRejectModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
              <div className="hr-modal-header">
                <h3 style={{ color: '#B91C1C' }}>Reject Leave Request</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowRejectModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleSaveReject}>
                <div className="hr-modal-body">
                  <div style={{ background: '#FEF2F2', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #FECACA' }}>
                    <div style={{ color: '#991B1B', fontWeight: '700', marginBottom: '0.35rem', fontSize: '0.95rem' }}>
                      Are you sure you want to reject this leave request?
                    </div>
                    <div style={{ fontWeight: '700', color: '#991B1B', marginBottom: '0.25rem' }}>
                      {getEmployeeName(selectedRequest.user)} ({getEmployeeDepartment(selectedRequest.user)})
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#B91C1C' }}>
                      {selectedRequest.type} Leave • {calculateDays(selectedRequest.startDate, selectedRequest.endDate)} days ({formatDate(selectedRequest.startDate)} – {formatDate(selectedRequest.endDate)})
                    </div>
                  </div>

                  <div className="hr-form-group full-width">
                    <label>Rejection Reason *</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Specify reason for rejecting this leave request..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                    />
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
                  <button type="submit" className="leave-btn-sm reject" style={{ padding: '0.65rem 1.3rem', fontSize: '0.85rem' }} disabled={submitting}>
                    {submitting ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── APPLY FOR LEAVE MODAL (EMPLOYEES) ─── */}
        {showApplyModal && (
          <div className="hr-modal-overlay" onClick={() => setShowApplyModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
              <div className="hr-modal-header">
                <h3>Submit Leave Request</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowApplyModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleSaveApply}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid">
                    <div className="hr-form-group full-width">
                      <label>Leave Type *</label>
                      <select
                        required
                        value={applyForm.type}
                        onChange={(e) => setApplyForm({ ...applyForm, type: e.target.value })}
                      >
                        <option value="Casual">Casual Leave</option>
                        <option value="Sick">Sick Leave</option>
                        <option value="Annual">Annual Leave</option>
                        <option value="Unpaid">Unpaid Leave</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Start Date *</label>
                      <input
                        type="date"
                        required
                        value={applyForm.startDate}
                        onChange={(e) => setApplyForm({ ...applyForm, startDate: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>End Date *</label>
                      <input
                        type="date"
                        required
                        value={applyForm.endDate}
                        onChange={(e) => setApplyForm({ ...applyForm, endDate: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Reason for Leave *</label>
                      <textarea
                        rows={3}
                        required
                        placeholder="Reason for applying time off..."
                        value={applyForm.reason}
                        onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowApplyModal(false)}>Cancel</button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit Request'}
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
