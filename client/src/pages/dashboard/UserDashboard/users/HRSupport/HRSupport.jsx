import React, { useState, useEffect, useMemo, useContext, useCallback } from 'react';
import apiClient from '../../../../../services/apiClient';
import { AppContext } from '../../../../../context/AppContext';
import UserLayout from '../components/UserLayout';
import './HRSupport.css';

const formatDate = (val) => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch (e) {
    return String(val);
  }
};

const formatDateTime = (val) => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return String(val);
  }
};

export const HR_SUPPORT_DEPARTMENTS = [
  'Business Development',
  'Finance',
  'IT',
  'Graphics',
  'Video',
  'Social Media',
];

export default function HRSupport() {
  const { user } = useContext(AppContext);
  const isHR = ['admin', 'super_admin'].includes(user?.role) || user?.department === 'HR';

  // Data states
  const [requests, setRequests] = useState([]);
  const [departments, setDepartments] = useState(HR_SUPPORT_DEPARTMENTS);
  const [summary, setSummary] = useState({
    total: 0,
    open: 0,
    assigned: 0,
    inProgress: 0,
    pendingEmployee: 0,
    pendingInternal: 0,
    resolved: 0,
    closed: 0,
    highPriority: 0,
    urgent: 0,
    overdue: 0,
    reminderDue: 0,
    upcomingReminders: 0,
    grievances: 0,
  });
  const [categories, setCategories] = useState([]);
  const [hrStaff, setHrStaff] = useState([]);
  const [reportsData, setReportsData] = useState(null);

  // UI & Workflow states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState(isHR ? 'all' : 'my_requests');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedPriority, setSelectedPriority] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [reminderFilter, setReminderFilter] = useState('All');

  // Modal Controllers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailTab, setDetailTab] = useState('overview'); // 'overview' | 'conversation' | 'notes' | 'reminders' | 'history'

  // Quick Action Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);

  // Form states for Create Request
  const [createForm, setCreateForm] = useState({
    category: '',
    otherCategory: '',
    subject: '',
    description: '',
    priority: 'Medium',
    reminderEnabled: false,
    reminderDate: '',
    reminderTime: '',
    reminderNote: '',
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Action input states
  const [assignForm, setAssignForm] = useState({ assignedTo: '', reason: '' });
  const [statusForm, setStatusForm] = useState({ status: '', remarks: '' });
  const [priorityForm, setPriorityForm] = useState({ priority: 'Medium', reason: '' });
  const [resolveForm, setResolveForm] = useState({ resolutionDetails: '' });
  const [closeForm, setCloseForm] = useState({ closureDetails: '' });
  const [reopenForm, setReopenForm] = useState({ reason: '' });
  const [reminderForm, setReminderForm] = useState({
    action: 'create',
    date: '',
    time: '',
    note: '',
  });
  const [replyMessage, setReplyMessage] = useState('');
  const [internalNoteText, setInternalNoteText] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);

  // 1. Fetch initial metadata (categories & HR staff)
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [catRes, staffRes] = await Promise.all([
          apiClient.get('/hr-support/categories'),
          apiClient.get('/hr-support/hr-staff'),
        ]);
        if (catRes.data?.data?.categories) {
          setCategories(catRes.data.data.categories);
        }
        if (catRes.data?.data?.departments && Array.isArray(catRes.data.data.departments)) {
          const clean = catRes.data.data.departments.filter(
            (d) => d && d.trim().toUpperCase() !== 'HR'
          );
          if (clean.length > 0) {
            setDepartments(clean);
          }
        }
        if (staffRes.data?.data) {
          setHrStaff(staffRes.data.data);
        }
      } catch (err) {
        console.error('Failed to load HR Support metadata:', err);
      }
    };
    fetchMetadata();
  }, []);

  // 2. Fetch requests and real Atlas summary
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [summaryRes, listRes] = await Promise.all([
        apiClient.get('/hr-support/summary'),
        apiClient.get('/hr-support'),
      ]);

      if (summaryRes.data?.data) {
        setSummary(summaryRes.data.data);
      }
      if (listRes.data?.data) {
        setRequests(listRes.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load HR Support data from server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 3. Load Reports if on reports tab
  useEffect(() => {
    if (activeTab === 'reports' && isHR) {
      apiClient
        .get('/hr-support/reports')
        .then((res) => setReportsData(res.data?.data || null))
        .catch((err) => console.error('Failed to load reports:', err));
    }
  }, [activeTab, isHR]);

  // Refresh single selected request in drawer
  const refreshSelectedRequest = async (requestId) => {
    if (!requestId) return;
    try {
      const res = await apiClient.get(`/hr-support/${requestId}`);
      if (res.data?.data) {
        setSelectedRequest(res.data.data);
      }
    } catch (e) { }
  };

  // Filter requests according to active tab, search, and dropdowns
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Tab filter
      if (activeTab === 'my_requests') {
        if (String(r.employee?._id || r.employee) !== String(user?._id || user?.userId)) {
          return false;
        }
      } else if (activeTab === 'my_assigned') {
        if (String(r.assignedTo?._id || r.assignedTo) !== String(user?._id || user?.userId)) {
          return false;
        }
      } else if (activeTab === 'grievances') {
        const sensitiveList = [
          'Grievance / Complaint',
          'Manager Concern',
          'Colleague Concern',
          'Workplace Behaviour',
          'Salary Issue',
          'Payroll Issue',
        ];
        if (!sensitiveList.includes(r.category)) return false;
      } else if (activeTab === 'resolved') {
        if (!['Resolved', 'Closed'].includes(r.status)) return false;
      } else if (activeTab === 'reminders') {
        if (!r.reminder?.enabled) return false;
      }

      // Department filter
      if (selectedDept !== 'All') {
        const reqDept = (r.department || '').trim();
        if (selectedDept === 'IT') {
          if (reqDept !== 'IT' && reqDept !== 'Tech') return false;
        } else if (selectedDept === 'Video') {
          if (reqDept !== 'Video' && reqDept !== 'Video Editor') return false;
        } else if (selectedDept === 'Social Media') {
          if (reqDept !== 'Social Media' && reqDept !== 'Digital Marketing') return false;
        } else {
          if (reqDept !== selectedDept) return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'All' && r.category !== selectedCategory) return false;

      // Priority filter
      if (selectedPriority !== 'All' && r.priority !== selectedPriority) return false;

      // Status filter
      if (selectedStatus !== 'All' && r.status !== selectedStatus) return false;

      // Overdue filter
      if (overdueOnly) {
        const isClosed = ['Resolved', 'Closed'].includes(r.status);
        if (isClosed || !r.dueDate || new Date(r.dueDate) >= new Date()) return false;
      }

      // Reminder status filter
      if (reminderFilter !== 'All') {
        if (r.reminder?.status !== reminderFilter) return false;
      }

      // Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        const reqId = (r.requestId || '').toLowerCase();
        const empName = (r.employeeName || '').toLowerCase();
        const empId = (r.employeeId || '').toLowerCase();
        const subj = (r.subject || '').toLowerCase();
        if (
          !reqId.includes(q) &&
          !empName.includes(q) &&
          !empId.includes(q) &&
          !subj.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    requests,
    activeTab,
    selectedDept,
    selectedCategory,
    selectedPriority,
    selectedStatus,
    overdueOnly,
    reminderFilter,
    search,
    user,
  ]);

  // Department options for filter dropdown (exactly the 6 departments, HR excluded)
  const departmentOptions = useMemo(() => {
    const list = departments && departments.length > 0 ? departments : HR_SUPPORT_DEPARTMENTS;
    return list.filter((d) => d && d.trim().toUpperCase() !== 'HR');
  }, [departments]);

  // Create Request Form Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!createForm.category) {
      setError('Please select a category');
      return;
    }
    if (createForm.category === 'Other' && !createForm.otherCategory.trim()) {
      setError('Please specify the other category / issue');
      return;
    }
    if (!createForm.subject.trim()) {
      setError('Please enter a subject');
      return;
    }
    if (!createForm.description.trim()) {
      setError('Please provide a detailed description');
      return;
    }

    try {
      setCreateSubmitting(true);
      const res = await apiClient.post('/hr-support', createForm);
      setSuccess(`Request [${res.data?.data?.requestId}] created successfully!`);
      setShowCreateModal(false);
      setCreateForm({
        category: '',
        otherCategory: '',
        subject: '',
        description: '',
        priority: 'Medium',
        reminderEnabled: false,
        reminderDate: '',
        reminderTime: '',
        reminderNote: '',
      });
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit HR Support request');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Open Case Details Drawer
  const openCaseDetails = async (request) => {
    setSelectedRequest(request);
    setDetailTab('overview');
    setShowDetailModal(true);
    await refreshSelectedRequest(request._id);
  };

  // Assign / Reassign HR Handler
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    try {
      await apiClient.patch(`/hr-support/${selectedRequest._id}/assign`, assignForm);
      setSuccess('Case assigned successfully');
      setShowAssignModal(false);
      setAssignForm({ assignedTo: '', reason: '' });
      await refreshSelectedRequest(selectedRequest._id);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update assignment');
    }
  };

  // Status Change Handler
  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRequest || !statusForm.status) return;
    try {
      await apiClient.patch(`/hr-support/${selectedRequest._id}/status`, statusForm);
      setSuccess(`Status changed to ${statusForm.status}`);
      setShowStatusModal(false);
      setStatusForm({ status: '', remarks: '' });
      await refreshSelectedRequest(selectedRequest._id);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    }
  };

  // Priority Change Handler
  const handlePrioritySubmit = async (e) => {
    e.preventDefault();
    if (!selectedRequest || !priorityForm.priority) return;
    try {
      await apiClient.patch(`/hr-support/${selectedRequest._id}/priority`, priorityForm);
      setSuccess(`Priority updated to ${priorityForm.priority}`);
      setShowPriorityModal(false);
      setPriorityForm({ priority: 'Medium', reason: '' });
      await refreshSelectedRequest(selectedRequest._id);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update priority');
    }
  };

  // Resolve Handler
  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRequest || !resolveForm.resolutionDetails.trim()) {
      setError('Please provide resolution details');
      return;
    }
    try {
      await apiClient.post(`/hr-support/${selectedRequest._id}/resolve`, resolveForm);
      setSuccess('Case marked as Resolved');
      setShowResolveModal(false);
      setResolveForm({ resolutionDetails: '' });
      await refreshSelectedRequest(selectedRequest._id);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resolve request');
    }
  };

  // Close Handler
  const handleCloseSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    try {
      await apiClient.post(`/hr-support/${selectedRequest._id}/close`, closeForm);
      setSuccess('Case closed successfully');
      setShowCloseModal(false);
      setCloseForm({ closureDetails: '' });
      await refreshSelectedRequest(selectedRequest._id);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to close request');
    }
  };

  // Reopen Handler
  const handleReopenSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRequest || !reopenForm.reason.trim()) {
      setError('Please provide a reason for reopening');
      return;
    }
    try {
      await apiClient.post(`/hr-support/${selectedRequest._id}/reopen`, reopenForm);
      setSuccess('Request reopened successfully');
      setShowReopenModal(false);
      setReopenForm({ reason: '' });
      await refreshSelectedRequest(selectedRequest._id);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reopen request');
    }
  };

  // Reminder Action Handler
  const handleReminderSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    try {
      await apiClient.post(`/hr-support/${selectedRequest._id}/reminder`, reminderForm);
      setSuccess('Reminder updated successfully');
      setShowReminderModal(false);
      setReminderForm({ action: 'create', date: '', time: '', note: '' });
      await refreshSelectedRequest(selectedRequest._id);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update reminder');
    }
  };

  // Post Reply in Conversation Thread
  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!selectedRequest || !replyMessage.trim()) return;
    try {
      await apiClient.post(`/hr-support/${selectedRequest._id}/respond`, {
        message: replyMessage.trim(),
      });
      setReplyMessage('');
      await refreshSelectedRequest(selectedRequest._id);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send response');
    }
  };

  // Add Internal HR Note
  const handleAddInternalNote = async (e) => {
    e.preventDefault();
    if (!selectedRequest || !internalNoteText.trim()) return;
    try {
      await apiClient.post(`/hr-support/${selectedRequest._id}/internal-note`, {
        note: internalNoteText.trim(),
      });
      setInternalNoteText('');
      await refreshSelectedRequest(selectedRequest._id);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add internal note');
    }
  };

  // File Attachment Upload Handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRequest) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadingFile(true);
      await apiClient.post(`/hr-support/${selectedRequest._id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccess(`File "${file.name}" uploaded successfully`);
      await refreshSelectedRequest(selectedRequest._id);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload attachment');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  // Helpers for Badges
  const getPriorityBadgeClass = (priority) => {
    switch (priority) {
      case 'Urgent': return 'hrs-priority-urgent';
      case 'High': return 'hrs-priority-high';
      case 'Medium': return 'hrs-priority-medium';
      case 'Low': return 'hrs-priority-low';
      default: return 'hrs-priority-low';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'New': return 'hrs-status-new';
      case 'Assigned': return 'hrs-status-assigned';
      case 'In Progress': return 'hrs-status-in-progress';
      case 'Pending Employee': return 'hrs-status-pending-employee';
      case 'Pending Internal': return 'hrs-status-pending-internal';
      case 'Resolved': return 'hrs-status-resolved';
      case 'Closed': return 'hrs-status-closed';
      case 'Reopened': return 'hrs-status-reopened';
      default: return 'hrs-status-new';
    }
  };

  return (
    <UserLayout pageTitle="HR Support" pageSubtitle="Helpdesk & Case Management">
      <div className="hrs-container">
        {/* Toast / Feedback Alert Messages */}
        {error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              borderRadius: '8px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fee2e2',
              color: '#b91c1c',
              fontSize: '0.85rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>⚠️ {error}</span>
            <button
              onClick={() => setError('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                color: '#b91c1c',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {success && (
          <div
            style={{
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              borderRadius: '8px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #dcfce7',
              color: '#15803d',
              fontSize: '0.85rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>✓ {success}</span>
            <button
              onClick={() => setSuccess('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                color: '#15803d',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* 1. Header Section */}
        <div className="hrs-header">
          <div className="hrs-title-area">
            <h2>HR Support</h2>
            <p>Manage employee HR requests, resolve issues and support employees.</p>
          </div>
          <div className="hrs-header-actions">
            <button
              className="hrs-primary-btn"
              onClick={() => setShowCreateModal(true)}
              id="raise-hr-request-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Raise HR Support Request
            </button>
          </div>
        </div>

        {/* 2. Real Database-Driven KPI Summary Cards */}
        <div className="hrs-kpi-grid">
          <div
            className={`hrs-kpi-card ${selectedStatus === 'All' && !overdueOnly ? 'active' : ''}`}
            onClick={() => {
              setSelectedStatus('All');
              setOverdueOnly(false);
            }}
          >
            <div className="hrs-kpi-title">Total Requests</div>
            <div className="hrs-kpi-value">{summary.total || 0}</div>
          </div>

          <div
            className={`hrs-kpi-card ${selectedStatus === 'New' ? 'active' : ''}`}
            onClick={() => {
              setSelectedStatus('New');
              setOverdueOnly(false);
            }}
          >
            <div className="hrs-kpi-title">Open</div>
            <div className="hrs-kpi-value">{summary.open || 0}</div>
          </div>

          <div
            className={`hrs-kpi-card ${selectedStatus === 'In Progress' ? 'active' : ''}`}
            onClick={() => {
              setSelectedStatus('In Progress');
              setOverdueOnly(false);
            }}
          >
            <div className="hrs-kpi-title">In Progress</div>
            <div className="hrs-kpi-value">{summary.inProgress || 0}</div>
          </div>

          <div
            className={`hrs-kpi-card pending ${selectedStatus === 'Pending Employee' ? 'active' : ''}`}
            onClick={() => {
              setSelectedStatus('Pending Employee');
              setOverdueOnly(false);
            }}
          >
            <div className="hrs-kpi-title">Pending Employee</div>
            <div className="hrs-kpi-value">{summary.pendingEmployee || 0}</div>
          </div>

          <div
            className={`hrs-kpi-card pending ${selectedStatus === 'Pending Internal' ? 'active' : ''}`}
            onClick={() => {
              setSelectedStatus('Pending Internal');
              setOverdueOnly(false);
            }}
          >
            <div className="hrs-kpi-title">Pending Internal</div>
            <div className="hrs-kpi-value">{summary.pendingInternal || 0}</div>
          </div>

          <div
            className={`hrs-kpi-card resolved ${selectedStatus === 'Resolved' ? 'active' : ''}`}
            onClick={() => {
              setSelectedStatus('Resolved');
              setOverdueOnly(false);
            }}
          >
            <div className="hrs-kpi-title">Resolved</div>
            <div className="hrs-kpi-value">{summary.resolved || 0}</div>
          </div>

          <div
            className={`hrs-kpi-card ${selectedStatus === 'Closed' ? 'active' : ''}`}
            onClick={() => {
              setSelectedStatus('Closed');
              setOverdueOnly(false);
            }}
          >
            <div className="hrs-kpi-title">Closed</div>
            <div className="hrs-kpi-value">{summary.closed || 0}</div>
          </div>

          <div
            className={`hrs-kpi-card ${selectedPriority === 'High' ? 'active' : ''}`}
            onClick={() => setSelectedPriority('High')}
          >
            <div className="hrs-kpi-title">High Priority</div>
            <div className="hrs-kpi-value">{summary.highPriority || 0}</div>
          </div>

          <div
            className={`hrs-kpi-card urgent ${selectedPriority === 'Urgent' ? 'active' : ''}`}
            onClick={() => setSelectedPriority('Urgent')}
          >
            <div className="hrs-kpi-title">Urgent</div>
            <div className="hrs-kpi-value">{summary.urgent || 0}</div>
          </div>

          <div
            className={`hrs-kpi-card overdue ${overdueOnly ? 'active' : ''}`}
            onClick={() => setOverdueOnly(!overdueOnly)}
          >
            <div className="hrs-kpi-title">Overdue</div>
            <div className="hrs-kpi-value">{summary.overdue || 0}</div>
          </div>

          <div
            className={`hrs-kpi-card ${reminderFilter === 'Due' ? 'active' : ''}`}
            onClick={() => setReminderFilter(reminderFilter === 'Due' ? 'All' : 'Due')}
          >
            <div className="hrs-kpi-title">Reminder Due</div>
            <div className="hrs-kpi-value">{summary.reminderDue || 0}</div>
          </div>
        </div>

        {/* 3. Main Workflow Navigation Tabs */}
        <div className="hrs-tabs-bar">
          {isHR ? (
            <button
              className={`hrs-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All Requests
              <span className="hrs-tab-badge">{summary.total || 0}</span>
            </button>
          ) : null}

          <button
            className={`hrs-tab-btn ${activeTab === 'my_requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('my_requests')}
          >
            My Requests
          </button>

          {isHR ? (
            <button
              className={`hrs-tab-btn ${activeTab === 'my_assigned' ? 'active' : ''}`}
              onClick={() => setActiveTab('my_assigned')}
            >
              My Assigned
            </button>
          ) : null}

          <button
            className={`hrs-tab-btn ${activeTab === 'grievances' ? 'active' : ''}`}
            onClick={() => setActiveTab('grievances')}
          >
            Grievances & Concerns
            <span className="hrs-tab-badge">{summary.grievances || 0}</span>
          </button>

          <button
            className={`hrs-tab-btn ${activeTab === 'resolved' ? 'active' : ''}`}
            onClick={() => setActiveTab('resolved')}
          >
            Resolved & Closed
            <span className="hrs-tab-badge">{(summary.resolved || 0) + (summary.closed || 0)}</span>
          </button>

          <button
            className={`hrs-tab-btn ${activeTab === 'reminders' ? 'active' : ''}`}
            onClick={() => setActiveTab('reminders')}
          >
            Reminders & Due
            <span className="hrs-tab-badge">
              {(summary.reminderDue || 0) + (summary.upcomingReminders || 0)}
            </span>
          </button>

          {isHR ? (
            <button
              className={`hrs-tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              Reports & Analytics
            </button>
          ) : null}
        </div>

        {/* 4. Active Tab Content: Reports or Table */}
        {activeTab === 'reports' && isHR ? (
          <div className="hrs-reports-grid">
            {/* By Status */}
            <div className="hrs-report-card">
              <h4>Requests by Status</h4>
              {reportsData?.byStatus?.map((item) => (
                <div key={item._id} className="hrs-report-bar-row">
                  <span className="hrs-report-bar-label">{item._id || 'Unknown'}</span>
                  <div className="hrs-report-bar-track">
                    <div
                      className="hrs-report-bar-fill"
                      style={{
                        width: `${Math.min(100, ((item.count || 0) / (summary.total || 1)) * 100)}%`,
                      }}
                    ></div>
                  </div>
                  <span className="hrs-report-bar-value">{item.count}</span>
                </div>
              ))}
            </div>

            {/* By Category */}
            <div className="hrs-report-card">
              <h4>Requests by Category</h4>
              {reportsData?.byCategory?.slice(0, 7).map((item) => (
                <div key={item._id} className="hrs-report-bar-row">
                  <span className="hrs-report-bar-label" title={item._id}>
                    {item._id || 'Other'}
                  </span>
                  <div className="hrs-report-bar-track">
                    <div
                      className="hrs-report-bar-fill"
                      style={{
                        width: `${Math.min(100, ((item.count || 0) / (summary.total || 1)) * 100)}%`,
                        background: '#3b82f6',
                      }}
                    ></div>
                  </div>
                  <span className="hrs-report-bar-value">{item.count}</span>
                </div>
              ))}
            </div>

            {/* By Priority */}
            <div className="hrs-report-card">
              <h4>Requests by Priority</h4>
              {reportsData?.byPriority?.map((item) => (
                <div key={item._id} className="hrs-report-bar-row">
                  <span className="hrs-report-bar-label">{item._id}</span>
                  <div className="hrs-report-bar-track">
                    <div
                      className="hrs-report-bar-fill"
                      style={{
                        width: `${Math.min(100, ((item.count || 0) / (summary.total || 1)) * 100)}%`,
                        background:
                          item._id === 'Urgent'
                            ? '#dc2626'
                            : item._id === 'High'
                            ? '#ea580c'
                            : '#ca8a04',
                      }}
                    ></div>
                  </div>
                  <span className="hrs-report-bar-value">{item.count}</span>
                </div>
              ))}
            </div>

            {/* By Department */}
            <div className="hrs-report-card">
              <h4>Requests by Department</h4>
              {reportsData?.byDepartment?.map((item) => (
                <div key={item._id} className="hrs-report-bar-row">
                  <span className="hrs-report-bar-label">{item._id || 'General'}</span>
                  <div className="hrs-report-bar-track">
                    <div
                      className="hrs-report-bar-fill"
                      style={{
                        width: `${Math.min(100, ((item.count || 0) / (summary.total || 1)) * 100)}%`,
                        background: '#10b981',
                      }}
                    ></div>
                  </div>
                  <span className="hrs-report-bar-value">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Filter and Search Bar */}
            <div className="hrs-filter-toolbar">
              <div className="hrs-search-box">
                <span className="hrs-search-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </span>
                <input
                  type="text"
                  className="hrs-search-input"
                  placeholder="Search by ID, employee, subject..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Department Filter */}
              <select
                className="hrs-select"
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
              >
                <option value="All">All Departments</option>
                {departmentOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              {/* Category Filter */}
              <select
                className="hrs-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="All">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Priority Filter */}
              <select
                className="hrs-select"
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
              >
                <option value="All">All Priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>

              {/* Status Filter */}
              <select
                className="hrs-select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="New">New</option>
                <option value="Assigned">Assigned</option>
                <option value="In Progress">In Progress</option>
                <option value="Pending Employee">Pending Employee</option>
                <option value="Pending Internal">Pending Internal</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
                <option value="Reopened">Reopened</option>
              </select>

              {/* Overdue Button Toggle */}
              <button
                className={`hrs-clear-btn ${overdueOnly ? 'active' : ''}`}
                style={
                  overdueOnly
                    ? { backgroundColor: '#fee2e2', borderColor: '#fca5a5', color: '#b91c1c' }
                    : {}
                }
                onClick={() => setOverdueOnly(!overdueOnly)}
              >
                {overdueOnly ? '✓ Overdue Only' : 'Overdue'}
              </button>

              {/* Clear All Filters */}
              {(search ||
                selectedDept !== 'All' ||
                selectedCategory !== 'All' ||
                selectedPriority !== 'All' ||
                selectedStatus !== 'All' ||
                overdueOnly ||
                reminderFilter !== 'All') && (
                <button
                  className="hrs-clear-btn"
                  onClick={() => {
                    setSearch('');
                    setSelectedDept('All');
                    setSelectedCategory('All');
                    setSelectedPriority('All');
                    setSelectedStatus('All');
                    setOverdueOnly(false);
                    setReminderFilter('All');
                  }}
                >
                  Reset Filters
                </button>
              )}
            </div>

            {/* Request Management Table */}
            <div className="hrs-table-container">
              {loading ? (
                <div className="hrs-empty-state">
                  <div className="hrs-empty-desc">Loading HR Support requests...</div>
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="hrs-empty-state">
                  <div className="hrs-empty-icon">📁</div>
                  <h3 className="hrs-empty-title">No HR support requests found</h3>
                  <p className="hrs-empty-desc">
                    {search || selectedCategory !== 'All' || selectedStatus !== 'All'
                      ? 'No requests match the selected filters.'
                      : 'No requests have been submitted yet.'}
                  </p>
                </div>
              ) : (
                <table className="hrs-table">
                  <thead>
                    <tr>
                      <th>Request ID</th>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Category</th>
                      <th>Subject</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Assigned HR</th>
                      <th>Due Date</th>
                      <th>Reminder</th>
                      <th>Created Date</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((r) => {
                      const isOverdue =
                        r.dueDate &&
                        new Date(r.dueDate) < new Date() &&
                        !['Resolved', 'Closed'].includes(r.status);

                      return (
                        <tr key={r._id}>
                          <td>
                            <span
                              className="hrs-request-id-badge"
                              onClick={() => openCaseDetails(r)}
                              title="Click to view full case"
                            >
                              {r.requestId}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: '600', color: '#0f172a' }}>
                              {r.employeeName || 'Employee'}
                            </div>
                            <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                              {r.employeeId || '—'}
                            </div>
                          </td>
                          <td>
                            <div>{r.department || 'General'}</div>
                            <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                              {r.designation || ''}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: '500' }}>{r.category}</div>
                            {r.category === 'Other' && r.otherCategory && (
                              <div style={{ fontSize: '0.725rem', color: '#ea580c' }}>
                                ({r.otherCategory})
                              </div>
                            )}
                          </td>
                          <td style={{ maxWidth: '220px' }}>
                            <div
                              style={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                fontWeight: '500',
                              }}
                              title={r.subject}
                            >
                              {r.subject}
                            </div>
                          </td>
                          <td>
                            <span className={`hrs-badge ${getPriorityBadgeClass(r.priority)}`}>
                              {r.priority}
                            </span>
                          </td>
                          <td>
                            <span className={`hrs-badge ${getStatusBadgeClass(r.status)}`}>
                              {r.status}
                            </span>
                          </td>
                          <td>
                            {r.assignedToName ? (
                              <span
                                style={{
                                  fontSize: '0.775rem',
                                  fontWeight: '600',
                                  color: '#334155',
                                }}
                              >
                                {r.assignedToName}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td>
                            {r.dueDate ? (
                              <div>
                                <span style={isOverdue ? { color: '#dc2626', fontWeight: '700' } : {}}>
                                  {formatDate(r.dueDate)}
                                </span>
                                {isOverdue && (
                                  <div className="hrs-overdue-tag">⚠️ Overdue</div>
                                )}
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            {r.reminder?.enabled ? (
                              <span
                                className="hrs-badge"
                                style={{
                                  backgroundColor:
                                    r.reminder.status === 'Due'
                                      ? '#fef2f2'
                                      : r.reminder.status === 'Completed'
                                      ? '#f0fdf4'
                                      : '#f8fafc',
                                  color:
                                    r.reminder.status === 'Due'
                                      ? '#dc2626'
                                      : r.reminder.status === 'Completed'
                                      ? '#16a34a'
                                      : '#475569',
                                }}
                              >
                                🔔 {r.reminder.status}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>{formatDate(r.createdAt)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="hrs-actions-row" style={{ justifyContent: 'flex-end' }}>
                              <button
                                className="hrs-action-btn primary"
                                onClick={() => openCaseDetails(r)}
                              >
                                View
                              </button>

                              {isHR && (
                                <button
                                  className="hrs-action-btn"
                                  onClick={() => {
                                    setSelectedRequest(r);
                                    setAssignForm({
                                      assignedTo: r.assignedTo?._id || r.assignedTo || '',
                                      reason: '',
                                    });
                                    setShowAssignModal(true);
                                  }}
                                >
                                  Assign
                                </button>
                              )}

                              {isHR && r.status !== 'Resolved' && r.status !== 'Closed' && (
                                <button
                                  className="hrs-action-btn success"
                                  onClick={() => {
                                    setSelectedRequest(r);
                                    setShowResolveModal(true);
                                  }}
                                >
                                  Resolve
                                </button>
                              )}

                              {isHR && r.status === 'Resolved' && (
                                <button
                                  className="hrs-action-btn"
                                  onClick={() => {
                                    setSelectedRequest(r);
                                    setShowCloseModal(true);
                                  }}
                                >
                                  Close
                                </button>
                              )}

                              {r.status === 'Closed' && (
                                <button
                                  className="hrs-action-btn"
                                  onClick={() => {
                                    setSelectedRequest(r);
                                    setShowReopenModal(true);
                                  }}
                                >
                                  Reopen
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* =========================================================================
            MODAL 1: RAISE HR SUPPORT REQUEST (EMPLOYEE / HR)
            ========================================================================= */}
        {showCreateModal && (
          <div className="hrs-modal-backdrop">
            <div className="hrs-modal-dialog">
              <div className="hrs-modal-header">
                <h3 className="hrs-modal-title">Raise HR Support Request</h3>
                <button
                  className="hrs-modal-close-btn"
                  onClick={() => setShowCreateModal(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSubmit}>
                <div className="hrs-modal-body">
                  {/* Auto-populated Employee Details (Read-only) */}
                  <div
                    style={{
                      background: '#f8fafc',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      marginBottom: '1rem',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                      Employee Information (Auto-populated)
                    </div>
                    <div className="hrs-form-grid-2">
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Name:</span>{' '}
                        <strong style={{ fontSize: '0.825rem', color: '#0f172a' }}>
                          {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email}
                        </strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Department:</span>{' '}
                        <strong style={{ fontSize: '0.825rem', color: '#0f172a' }}>
                          {user?.department || 'General'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Designation:</span>{' '}
                        <strong style={{ fontSize: '0.825rem', color: '#0f172a' }}>
                          {user?.designation || 'Employee'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Role:</span>{' '}
                        <strong style={{ fontSize: '0.825rem', color: '#0f172a' }}>
                          {user?.role}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Category Selection */}
                  <div className="hrs-form-group">
                    <label className="hrs-form-label">
                      Category <span className="required">*</span>
                    </label>
                    <select
                      className="hrs-form-select"
                      value={createForm.category}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, category: e.target.value })
                      }
                      required
                    >
                      <option value="">-- Select Category --</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Other Category Input (Conditional) */}
                  {createForm.category === 'Other' && (
                    <div className="hrs-form-group">
                      <label className="hrs-form-label">
                        Other Issue / Category <span className="required">*</span>
                      </label>
                      <input
                        type="text"
                        className="hrs-form-input"
                        placeholder="Please specify your specific issue or category"
                        value={createForm.otherCategory}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, otherCategory: e.target.value })
                        }
                        required
                      />
                    </div>
                  )}

                  {/* Subject */}
                  <div className="hrs-form-group">
                    <label className="hrs-form-label">
                      Subject <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="hrs-form-input"
                      placeholder="Brief title of the problem"
                      value={createForm.subject}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, subject: e.target.value })
                      }
                      required
                    />
                  </div>

                  {/* Detailed Description */}
                  <div className="hrs-form-group">
                    <label className="hrs-form-label">
                      Detailed Description <span className="required">*</span>
                    </label>
                    <textarea
                      className="hrs-form-textarea"
                      placeholder="Please provide full details, dates, and context for HR..."
                      value={createForm.description}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, description: e.target.value })
                      }
                      required
                    />
                  </div>

                  {/* Priority */}
                  <div className="hrs-form-group">
                    <label className="hrs-form-label">Priority</label>
                    <select
                      className="hrs-form-select"
                      value={createForm.priority}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, priority: e.target.value })
                      }
                    >
                      <option value="Low">Low - General inquiry</option>
                      <option value="Medium">Medium - Standard processing</option>
                      <option value="High">High - Attention needed soon</option>
                      <option value="Urgent">Urgent - Critical / Blocked</option>
                    </select>
                  </div>

                  {/* Optional Follow-up Reminder */}
                  <div
                    style={{
                      borderTop: '1px solid #e2e8f0',
                      paddingTop: '0.85rem',
                      marginTop: '0.5rem',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.825rem', fontWeight: '600' }}>
                      <input
                        type="checkbox"
                        checked={createForm.reminderEnabled}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, reminderEnabled: e.target.checked })
                        }
                      />
                      <span>Set a follow-up reminder for this request</span>
                    </label>

                    {createForm.reminderEnabled && (
                      <div style={{ marginTop: '0.75rem', paddingLeft: '1.5rem' }}>
                        <div className="hrs-form-grid-2">
                          <div className="hrs-form-group">
                            <label className="hrs-form-label">Reminder Date</label>
                            <input
                              type="date"
                              className="hrs-form-input"
                              value={createForm.reminderDate}
                              onChange={(e) =>
                                setCreateForm({ ...createForm, reminderDate: e.target.value })
                              }
                              required={createForm.reminderEnabled}
                            />
                          </div>
                          <div className="hrs-form-group">
                            <label className="hrs-form-label">Reminder Time</label>
                            <input
                              type="time"
                              className="hrs-form-input"
                              value={createForm.reminderTime}
                              onChange={(e) =>
                                setCreateForm({ ...createForm, reminderTime: e.target.value })
                              }
                            />
                          </div>
                        </div>
                        <div className="hrs-form-group">
                          <label className="hrs-form-label">Reminder Note</label>
                          <input
                            type="text"
                            className="hrs-form-input"
                            placeholder="e.g. Check for HR response on Monday"
                            value={createForm.reminderNote}
                            onChange={(e) =>
                              setCreateForm({ ...createForm, reminderNote: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="hrs-modal-footer">
                  <button
                    type="button"
                    className="hrs-secondary-btn"
                    onClick={() => setShowCreateModal(false)}
                    disabled={createSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="hrs-primary-btn"
                    disabled={createSubmitting}
                  >
                    {createSubmitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 2: CASE DETAIL / DRAWER MODAL
            ========================================================================= */}
        {showDetailModal && selectedRequest && (
          <div className="hrs-modal-backdrop">
            <div className="hrs-modal-drawer">
              <div className="hrs-modal-header">
                <div>
                  <h3 className="hrs-modal-title">
                    Case: {selectedRequest.requestId}
                    <span className={`hrs-badge ${getStatusBadgeClass(selectedRequest.status)}`}>
                      {selectedRequest.status}
                    </span>
                    <span className={`hrs-badge ${getPriorityBadgeClass(selectedRequest.priority)}`}>
                      {selectedRequest.priority} Priority
                    </span>
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '3px' }}>
                    Created on {formatDateTime(selectedRequest.createdAt)}
                  </div>
                </div>
                <button
                  className="hrs-modal-close-btn"
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedRequest(null);
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Subtabs within Drawer */}
              <div
                style={{
                  display: 'flex',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  padding: '0 1rem',
                  gap: '0.5rem',
                }}
              >
                <button
                  className={`hrs-tab-btn ${detailTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setDetailTab('overview')}
                >
                  Overview & Details
                </button>
                <button
                  className={`hrs-tab-btn ${detailTab === 'conversation' ? 'active' : ''}`}
                  onClick={() => setDetailTab('conversation')}
                >
                  Communication ({selectedRequest.conversation?.length || 0})
                </button>
                {isHR && (
                  <button
                    className={`hrs-tab-btn ${detailTab === 'notes' ? 'active' : ''}`}
                    onClick={() => setDetailTab('notes')}
                  >
                    🔒 Internal Notes ({selectedRequest.internalNotes?.length || 0})
                  </button>
                )}
                <button
                  className={`hrs-tab-btn ${detailTab === 'reminders' ? 'active' : ''}`}
                  onClick={() => setDetailTab('reminders')}
                >
                  Reminders & SLA
                </button>
                <button
                  className={`hrs-tab-btn ${detailTab === 'history' ? 'active' : ''}`}
                  onClick={() => setDetailTab('history')}
                >
                  Audit History ({selectedRequest.history?.length || 0})
                </button>
              </div>

              <div className="hrs-modal-body">
                {/* SUBTAB 1: OVERVIEW & DETAILS */}
                {detailTab === 'overview' && (
                  <div>
                    {/* Employee Card */}
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '1rem',
                      }}
                    >
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#0f172a' }}>
                        Employee Information
                      </h4>
                      <div className="hrs-form-grid-2">
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Name:</span>{' '}
                          <strong>{selectedRequest.employeeName}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Employee ID:</span>{' '}
                          <strong>{selectedRequest.employeeId || '—'}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Department:</span>{' '}
                          <strong>{selectedRequest.department || '—'}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Designation:</span>{' '}
                          <strong>{selectedRequest.designation || '—'}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Request Information Card */}
                    <div
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '1rem',
                      }}
                    >
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#0f172a' }}>
                        Request Details
                      </h4>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Category:</span>{' '}
                        <strong>{selectedRequest.category}</strong>
                        {selectedRequest.category === 'Other' && selectedRequest.otherCategory && (
                          <span style={{ color: '#ea580c', marginLeft: '6px' }}>
                            ({selectedRequest.otherCategory})
                          </span>
                        )}
                      </div>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Subject:</span>
                        <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
                          {selectedRequest.subject}
                        </div>
                      </div>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Detailed Description:</span>
                        <div
                          style={{
                            background: '#f8fafc',
                            padding: '0.85rem',
                            borderRadius: '6px',
                            fontSize: '0.825rem',
                            color: '#1e293b',
                            lineHeight: 1.5,
                            marginTop: '4px',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {selectedRequest.description}
                        </div>
                      </div>
                    </div>

                    {/* Resolution Card if present */}
                    {selectedRequest.resolution?.details && (
                      <div
                        style={{
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          borderRadius: '8px',
                          padding: '1rem',
                          marginBottom: '1rem',
                        }}
                      >
                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#166534' }}>
                          Resolution Summary
                        </h4>
                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.825rem', color: '#14532d' }}>
                          {selectedRequest.resolution.details}
                        </p>
                        <div style={{ fontSize: '0.725rem', color: '#15803d' }}>
                          Resolved by {selectedRequest.resolution.resolvedByName} on{' '}
                          {formatDateTime(selectedRequest.resolution.resolvedAt)}
                        </div>
                      </div>
                    )}

                    {/* Attachments Section */}
                    <div
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '1rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#0f172a' }}>
                          Attachments ({selectedRequest.attachments?.length || 0})
                        </h4>
                        <label
                          className="hrs-action-btn primary"
                          style={{ cursor: uploadingFile ? 'not-allowed' : 'pointer' }}
                        >
                          {uploadingFile ? 'Uploading...' : '+ Upload Attachment'}
                          <input
                            type="file"
                            style={{ display: 'none' }}
                            onChange={handleFileUpload}
                            disabled={uploadingFile}
                          />
                        </label>
                      </div>

                      {(!selectedRequest.attachments || selectedRequest.attachments.length === 0) ? (
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No attachments uploaded yet.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {selectedRequest.attachments.map((att, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.5rem 0.75rem',
                                background: '#f8fafc',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                fontSize: '0.8rem',
                              }}
                            >
                              <span>📎 <strong>{att.name}</strong> ({Math.round((att.size || 0) / 1024)} KB)</span>
                              <a
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                className="hrs-action-btn"
                                style={{ textDecoration: 'none' }}
                              >
                                View / Download
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* SUBTAB 2: COMMUNICATION THREAD */}
                {detailTab === 'conversation' && (
                  <div>
                    <div className="hrs-conversation-thread">
                      {(!selectedRequest.conversation || selectedRequest.conversation.length === 0) ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.825rem' }}>
                          No messages yet. Send a response below to start communication.
                        </div>
                      ) : (
                        selectedRequest.conversation.map((msg, i) => (
                          <div
                            key={i}
                            className={`hrs-chat-bubble ${msg.senderRole === 'hr' ? 'hr' : 'employee'}`}
                          >
                            <div className="hrs-chat-meta">
                              <strong>{msg.senderName} ({msg.senderRole.toUpperCase()})</strong>
                              <span>{formatDateTime(msg.createdAt)}</span>
                            </div>
                            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.message}</div>
                          </div>
                        ))
                      )}
                    </div>

                    <form onSubmit={handleSendReply} style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        className="hrs-form-input"
                        placeholder="Type response to employee/HR..."
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button type="submit" className="hrs-primary-btn">
                        Send Reply
                      </button>
                    </form>
                  </div>
                )}

                {/* SUBTAB 3: INTERNAL HR NOTES (HR ONLY) */}
                {detailTab === 'notes' && isHR && (
                  <div>
                    <div className="hrs-internal-box">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>🔒</span>
                        <div>
                          <strong style={{ fontSize: '0.85rem', color: '#92400e' }}>
                            Confidential Internal HR Notes
                          </strong>
                          <div style={{ fontSize: '0.725rem', color: '#b45309' }}>
                            These notes are strictly confidential and NEVER exposed to employees.
                          </div>
                        </div>
                      </div>

                      {(!selectedRequest.internalNotes || selectedRequest.internalNotes.length === 0) ? (
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', padding: '0.5rem 0' }}>
                          No internal notes recorded.
                        </div>
                      ) : (
                        selectedRequest.internalNotes.map((note, idx) => (
                          <div key={idx} className="hrs-internal-note-item">
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: '#64748b', marginBottom: '3px' }}>
                              <strong>{note.authorName}</strong>
                              <span>{formatDateTime(note.createdAt)}</span>
                            </div>
                            <div style={{ fontSize: '0.825rem', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                              {note.note}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <form onSubmit={handleAddInternalNote}>
                      <div className="hrs-form-group">
                        <label className="hrs-form-label">Add New Internal Note</label>
                        <textarea
                          className="hrs-form-textarea"
                          placeholder="Type internal remarks, investigation notes, or assessment..."
                          value={internalNoteText}
                          onChange={(e) => setInternalNoteText(e.target.value)}
                          required
                        />
                      </div>
                      <button type="submit" className="hrs-primary-btn">
                        Save Internal Note
                      </button>
                    </form>
                  </div>
                )}

                {/* SUBTAB 4: REMINDERS & SLA */}
                {detailTab === 'reminders' && (
                  <div>
                    {/* Current Reminder Details */}
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '1rem',
                      }}
                    >
                      <h4 style={{ margin: '0 0 0.65rem 0', fontSize: '0.85rem', color: '#0f172a' }}>
                        Follow-Up Reminder
                      </h4>
                      {selectedRequest.reminder?.enabled ? (
                        <div>
                          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Date:</span>{' '}
                              <strong>{formatDate(selectedRequest.reminder.date)}</strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Time:</span>{' '}
                              <strong>{selectedRequest.reminder.time || '—'}</strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Status:</span>{' '}
                              <span className="hrs-badge" style={{ backgroundColor: '#fff7ed', color: '#ea580c' }}>
                                {selectedRequest.reminder.status}
                              </span>
                            </div>
                          </div>
                          <div style={{ marginBottom: '0.85rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Note:</span>{' '}
                            <em>{selectedRequest.reminder.note || 'No note'}</em>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="hrs-action-btn success"
                              onClick={() => {
                                setReminderForm({ action: 'complete' });
                                handleReminderSubmit({ preventDefault: () => {} });
                              }}
                            >
                              ✓ Mark Completed
                            </button>
                            <button
                              className="hrs-action-btn"
                              onClick={() => {
                                setReminderForm({ action: 'cancel' });
                                handleReminderSubmit({ preventDefault: () => {} });
                              }}
                            >
                              ✕ Cancel Reminder
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.825rem', color: '#64748b' }}>
                          No reminder is currently scheduled on this case.
                        </div>
                      )}
                    </div>

                    {/* Schedule / Reschedule Form */}
                    <form onSubmit={handleReminderSubmit}>
                      <h4 style={{ margin: '0 0 0.65rem 0', fontSize: '0.85rem', color: '#0f172a' }}>
                        {selectedRequest.reminder?.enabled ? 'Reschedule Reminder' : 'Set New Reminder'}
                      </h4>
                      <input type="hidden" value="create" />
                      <div className="hrs-form-grid-2">
                        <div className="hrs-form-group">
                          <label className="hrs-form-label">Reminder Date</label>
                          <input
                            type="date"
                            className="hrs-form-input"
                            value={reminderForm.date}
                            onChange={(e) =>
                              setReminderForm({ ...reminderForm, date: e.target.value, action: 'update' })
                            }
                            required
                          />
                        </div>
                        <div className="hrs-form-group">
                          <label className="hrs-form-label">Reminder Time</label>
                          <input
                            type="time"
                            className="hrs-form-input"
                            value={reminderForm.time}
                            onChange={(e) =>
                              setReminderForm({ ...reminderForm, time: e.target.value, action: 'update' })
                            }
                          />
                        </div>
                      </div>
                      <div className="hrs-form-group">
                        <label className="hrs-form-label">Reminder Note</label>
                        <input
                          type="text"
                          className="hrs-form-input"
                          placeholder="e.g. Follow up on employee salary discrepancy"
                          value={reminderForm.note}
                          onChange={(e) =>
                            setReminderForm({ ...reminderForm, note: e.target.value, action: 'update' })
                          }
                        />
                      </div>
                      <button type="submit" className="hrs-primary-btn">
                        Save Reminder
                      </button>
                    </form>
                  </div>
                )}

                {/* SUBTAB 5: AUDIT HISTORY */}
                {detailTab === 'history' && (
                  <div className="hrs-history-list">
                    {(!selectedRequest.history || selectedRequest.history.length === 0) ? (
                      <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                        No history entries recorded yet.
                      </div>
                    ) : (
                      selectedRequest.history.map((h, i) => (
                        <div key={i} className="hrs-history-item">
                          <div className="hrs-history-dot"></div>
                          <div className="hrs-history-action">{h.action}</div>
                          <div className="hrs-history-details">{h.details}</div>
                          <div className="hrs-history-meta">
                            By {h.performedByName} ({h.performedByRole}) • {formatDateTime(h.createdAt)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Drawer Footer Actions */}
              <div className="hrs-modal-footer">
                {isHR && (
                  <button
                    className="hrs-action-btn"
                    onClick={() => {
                      setAssignForm({
                        assignedTo: selectedRequest.assignedTo?._id || selectedRequest.assignedTo || '',
                        reason: '',
                      });
                      setShowAssignModal(true);
                    }}
                  >
                    Assign / Reassign
                  </button>
                )}

                {isHR && (
                  <button
                    className="hrs-action-btn"
                    onClick={() => {
                      setStatusForm({ status: selectedRequest.status, remarks: '' });
                      setShowStatusModal(true);
                    }}
                  >
                    Update Status
                  </button>
                )}

                {isHR && (
                  <button
                    className="hrs-action-btn"
                    onClick={() => {
                      setPriorityForm({ priority: selectedRequest.priority, reason: '' });
                      setShowPriorityModal(true);
                    }}
                  >
                    Update Priority
                  </button>
                )}

                {isHR && selectedRequest.status !== 'Resolved' && selectedRequest.status !== 'Closed' && (
                  <button
                    className="hrs-action-btn success"
                    onClick={() => setShowResolveModal(true)}
                  >
                    Resolve Case
                  </button>
                )}

                {isHR && selectedRequest.status === 'Resolved' && (
                  <button
                    className="hrs-action-btn"
                    onClick={() => setShowCloseModal(true)}
                  >
                    Close Case
                  </button>
                )}

                {selectedRequest.status === 'Closed' && (
                  <button
                    className="hrs-action-btn"
                    onClick={() => setShowReopenModal(true)}
                  >
                    Reopen Case
                  </button>
                )}

                <button
                  className="hrs-secondary-btn"
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedRequest(null);
                  }}
                >
                  Close Drawer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 3: ASSIGN / REASSIGN MODAL (HR ONLY)
            ========================================================================= */}
        {showAssignModal && selectedRequest && (
          <div className="hrs-modal-backdrop">
            <div className="hrs-modal-dialog">
              <div className="hrs-modal-header">
                <h3 className="hrs-modal-title">Assign HR Representative</h3>
                <button
                  className="hrs-modal-close-btn"
                  onClick={() => setShowAssignModal(false)}
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleAssignSubmit}>
                <div className="hrs-modal-body">
                  <div className="hrs-form-group">
                    <label className="hrs-form-label">Assign To (HR User)</label>
                    <select
                      className="hrs-form-select"
                      value={assignForm.assignedTo}
                      onChange={(e) =>
                        setAssignForm({ ...assignForm, assignedTo: e.target.value })
                      }
                    >
                      <option value="">-- Unassigned --</option>
                      {hrStaff.map((staff) => (
                        <option key={staff._id} value={staff._id}>
                          {staff.name} ({staff.designation} - {staff.department})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="hrs-form-group">
                    <label className="hrs-form-label">Reason / Assignment Note</label>
                    <input
                      type="text"
                      className="hrs-form-input"
                      placeholder="e.g. Lead HR case handler for workplace query"
                      value={assignForm.reason}
                      onChange={(e) =>
                        setAssignForm({ ...assignForm, reason: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="hrs-modal-footer">
                  <button
                    type="button"
                    className="hrs-secondary-btn"
                    onClick={() => setShowAssignModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="hrs-primary-btn">
                    Confirm Assignment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 4: UPDATE STATUS MODAL (HR ONLY)
            ========================================================================= */}
        {showStatusModal && selectedRequest && (
          <div className="hrs-modal-backdrop">
            <div className="hrs-modal-dialog">
              <div className="hrs-modal-header">
                <h3 className="hrs-modal-title">Update Status</h3>
                <button
                  className="hrs-modal-close-btn"
                  onClick={() => setShowStatusModal(false)}
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleStatusSubmit}>
                <div className="hrs-modal-body">
                  <div className="hrs-form-group">
                    <label className="hrs-form-label">New Status</label>
                    <select
                      className="hrs-form-select"
                      value={statusForm.status}
                      onChange={(e) =>
                        setStatusForm({ ...statusForm, status: e.target.value })
                      }
                      required
                    >
                      <option value="New">New</option>
                      <option value="Assigned">Assigned</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Pending Employee">Pending Employee</option>
                      <option value="Pending Internal">Pending Internal</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Closed">Closed</option>
                      <option value="Reopened">Reopened</option>
                    </select>
                  </div>
                  <div className="hrs-form-group">
                    <label className="hrs-form-label">Remarks / Note</label>
                    <input
                      type="text"
                      className="hrs-form-input"
                      placeholder="e.g. Waiting on payroll sheet validation"
                      value={statusForm.remarks}
                      onChange={(e) =>
                        setStatusForm({ ...statusForm, remarks: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="hrs-modal-footer">
                  <button
                    type="button"
                    className="hrs-secondary-btn"
                    onClick={() => setShowStatusModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="hrs-primary-btn">
                    Save Status
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 5: UPDATE PRIORITY MODAL (HR ONLY)
            ========================================================================= */}
        {showPriorityModal && selectedRequest && (
          <div className="hrs-modal-backdrop">
            <div className="hrs-modal-dialog">
              <div className="hrs-modal-header">
                <h3 className="hrs-modal-title">Update Priority</h3>
                <button
                  className="hrs-modal-close-btn"
                  onClick={() => setShowPriorityModal(false)}
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handlePrioritySubmit}>
                <div className="hrs-modal-body">
                  <div className="hrs-form-group">
                    <label className="hrs-form-label">Priority Level</label>
                    <select
                      className="hrs-form-select"
                      value={priorityForm.priority}
                      onChange={(e) =>
                        setPriorityForm({ ...priorityForm, priority: e.target.value })
                      }
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                  <div className="hrs-form-group">
                    <label className="hrs-form-label">Reason for Change</label>
                    <input
                      type="text"
                      className="hrs-form-input"
                      placeholder="e.g. Escalated due to upcoming payroll deadline"
                      value={priorityForm.reason}
                      onChange={(e) =>
                        setPriorityForm({ ...priorityForm, reason: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="hrs-modal-footer">
                  <button
                    type="button"
                    className="hrs-secondary-btn"
                    onClick={() => setShowPriorityModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="hrs-primary-btn">
                    Save Priority
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 6: RESOLVE REQUEST MODAL
            ========================================================================= */}
        {showResolveModal && selectedRequest && (
          <div className="hrs-modal-backdrop">
            <div className="hrs-modal-dialog">
              <div className="hrs-modal-header">
                <h3 className="hrs-modal-title">Resolve Request</h3>
                <button
                  className="hrs-modal-close-btn"
                  onClick={() => setShowResolveModal(false)}
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleResolveSubmit}>
                <div className="hrs-modal-body">
                  <div className="hrs-form-group">
                    <label className="hrs-form-label">
                      Resolution Details <span className="required">*</span>
                    </label>
                    <textarea
                      className="hrs-form-textarea"
                      placeholder="Explain how the problem was resolved and any actions taken..."
                      value={resolveForm.resolutionDetails}
                      onChange={(e) =>
                        setResolveForm({ resolutionDetails: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>
                <div className="hrs-modal-footer">
                  <button
                    type="button"
                    className="hrs-secondary-btn"
                    onClick={() => setShowResolveModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="hrs-primary-btn" style={{ background: '#16a34a', borderColor: '#16a34a' }}>
                    Confirm Resolution
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 7: CLOSE REQUEST MODAL
            ========================================================================= */}
        {showCloseModal && selectedRequest && (
          <div className="hrs-modal-backdrop">
            <div className="hrs-modal-dialog">
              <div className="hrs-modal-header">
                <h3 className="hrs-modal-title">Close Request</h3>
                <button
                  className="hrs-modal-close-btn"
                  onClick={() => setShowCloseModal(false)}
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleCloseSubmit}>
                <div className="hrs-modal-body">
                  <div className="hrs-form-group">
                    <label className="hrs-form-label">Closure Remarks</label>
                    <textarea
                      className="hrs-form-textarea"
                      placeholder="Optional final remarks before closing the ticket..."
                      value={closeForm.closureDetails}
                      onChange={(e) =>
                        setCloseForm({ closureDetails: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="hrs-modal-footer">
                  <button
                    type="button"
                    className="hrs-secondary-btn"
                    onClick={() => setShowCloseModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="hrs-primary-btn">
                    Confirm Closure
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL 8: REOPEN REQUEST MODAL
            ========================================================================= */}
        {showReopenModal && selectedRequest && (
          <div className="hrs-modal-backdrop">
            <div className="hrs-modal-dialog">
              <div className="hrs-modal-header">
                <h3 className="hrs-modal-title">Reopen Request</h3>
                <button
                  className="hrs-modal-close-btn"
                  onClick={() => setShowReopenModal(false)}
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleReopenSubmit}>
                <div className="hrs-modal-body">
                  <div className="hrs-form-group">
                    <label className="hrs-form-label">
                      Reason for Reopening <span className="required">*</span>
                    </label>
                    <textarea
                      className="hrs-form-textarea"
                      placeholder="Specify why this case needs to be reopened..."
                      value={reopenForm.reason}
                      onChange={(e) =>
                        setReopenForm({ reason: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>
                <div className="hrs-modal-footer">
                  <button
                    type="button"
                    className="hrs-secondary-btn"
                    onClick={() => setShowReopenModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="hrs-primary-btn">
                    Reopen Ticket
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
