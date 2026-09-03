import React, { useState, useEffect, useMemo, useCallback } from 'react';
import apiClient from '../../../../../services/apiClient';
import UserLayout from '../components/UserLayout';
import './Documents.css';

const DOCUMENT_CATEGORIES = [
  'Identity Proof',
  'Address Proof',
  'PAN Card',
  'Aadhaar / Government ID',
  'Passport',
  'Education Certificate',
  'Experience Letter',
  'Offer Letter',
  'Appointment Letter',
  'Employment Contract',
  'Joining Documents',
  'Bank Documents',
  'Salary / Payroll Documents',
  'Performance Documents',
  'Leave Documents',
  'Company Documents',
  'Other',
];

const OFFICIAL_DEPARTMENTS = ['HR', 'Finance', 'Business Development', 'Digital Marketing', 'Video Editor', 'Tech'];

const initialsFor = (firstName, lastName, email) => {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return 'EM';
};

const formatDate = (val) => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return String(val);
  }
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

// Compute dynamic expiry classification
const getExpiryClassification = (expiryDate) => {
  if (!expiryDate) return { label: 'No Expiry', status: 'valid', className: 'expiry-none' };
  const exp = new Date(expiryDate);
  const now = new Date();
  const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (exp < now) {
    return { label: 'Expired', status: 'expired', className: 'expiry-expired' };
  }
  if (exp <= thirtyDaysAhead) {
    const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    return { label: `Expiring (${daysLeft}d)`, status: 'expiring_soon', className: 'expiry-soon' };
  }
  return { label: 'Valid', status: 'valid', className: 'expiry-valid' };
};

export default function Documents() {
  // Data States
  const [documents, setDocuments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState({
    totalDocuments: 0,
    pendingVerification: 0,
    verifiedDocuments: 0,
    rejectedDocuments: 0,
    expiredDocuments: 0,
    expiringSoon: 0,
    totalEmployees: 0,
    categoryBreakdown: {},
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Tabs: 'all' | 'pending' | 'verified' | 'rejected' | 'expiring_soon' | 'expired' | 'repository'
  const [activeTab, setActiveTab] = useState('all');

  // Search & Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedExpiry, setSelectedExpiry] = useState('All');
  const [selectedOwner, setSelectedOwner] = useState('All');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [paginationMeta, setPaginationMeta] = useState({ total: 0, totalPages: 1 });

  // Employee Repository Tab specific selection
  const [repoSelectedEmployeeId, setRepoSelectedEmployeeId] = useState('');

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [activeDoc, setActiveDoc] = useState(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Upload Form State
  const [uploadForm, setUploadForm] = useState({
    owner: '',
    name: '',
    category: 'Identity Proof',
    documentNumber: '',
    issueDate: '',
    expiryDate: '',
    description: '',
    file: null,
  });

  // Replace Form State
  const [replaceForm, setReplaceForm] = useState({
    name: '',
    category: '',
    documentNumber: '',
    expiryDate: '',
    description: '',
    file: null,
  });

  // Load live data from MongoDB
  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let statusParam = selectedStatus !== 'All' ? selectedStatus : undefined;
      let expiryParam = selectedExpiry !== 'All' ? selectedExpiry : undefined;

      if (activeTab === 'pending') statusParam = 'Pending';
      else if (activeTab === 'verified') statusParam = 'Verified';
      else if (activeTab === 'rejected') statusParam = 'Rejected';
      else if (activeTab === 'expiring_soon') expiryParam = 'Expiring Soon';
      else if (activeTab === 'expired') expiryParam = 'Expired';

      const ownerParam =
        activeTab === 'repository' && repoSelectedEmployeeId
          ? repoSelectedEmployeeId
          : selectedOwner !== 'All'
          ? selectedOwner
          : undefined;

      const [docsRes, sumRes, empRes] = await Promise.all([
        apiClient.get('/documents', {
          params: {
            search: search || undefined,
            department: selectedDept !== 'All' ? selectedDept : undefined,
            category: selectedCategory !== 'All' ? selectedCategory : undefined,
            status: statusParam,
            expiryStatus: expiryParam,
            owner: ownerParam,
            page: currentPage,
            limit: pageSize,
          },
        }),
        apiClient.get('/documents/summary').catch(() => ({ data: { data: null } })),
        apiClient.get('/users').catch(() => ({ data: { data: [] } })),
      ]);

      const fetchedDocs = docsRes.data?.data?.documents || [];
      const fetchedMeta = docsRes.data?.data?.pagination || { total: fetchedDocs.length, totalPages: 1 };
      setDocuments(fetchedDocs);
      setPaginationMeta(fetchedMeta);

      if (sumRes.data?.data) {
        setSummary(sumRes.data.data);
      }

      // Filter active employees
      const activeEmps = (empRes.data?.data || []).filter(
        (u) => u.role === 'employee' && u.isActive !== false && u.employmentStatus !== 'Exited' && u.employmentStatus !== 'Terminated'
      );
      setEmployees(activeEmps);

      // Default selected employee in upload form if empty
      if (activeEmps.length > 0 && !uploadForm.owner) {
        setUploadForm((prev) => ({ ...prev, owner: activeEmps[0]._id }));
      }
      if (activeEmps.length > 0 && !repoSelectedEmployeeId) {
        setRepoSelectedEmployeeId(activeEmps[0]._id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load documents.');
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    selectedStatus,
    selectedExpiry,
    selectedDept,
    selectedCategory,
    selectedOwner,
    search,
    currentPage,
    pageSize,
    repoSelectedEmployeeId,
  ]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Derived selected employee in Upload form
  const selectedUploadEmployee = useMemo(() => {
    return employees.find((e) => String(e._id) === String(uploadForm.owner)) || null;
  }, [employees, uploadForm.owner]);

  // Derived selected employee in Repository tab
  const repoEmployee = useMemo(() => {
    return employees.find((e) => String(e._id) === String(repoSelectedEmployeeId)) || null;
  }, [employees, repoSelectedEmployeeId]);

  // Documents belonging to repository selected employee
  const repoEmployeeDocs = useMemo(() => {
    if (!repoSelectedEmployeeId) return [];
    return documents.filter((d) => String(d.owner?._id || d.owner) === String(repoSelectedEmployeeId));
  }, [documents, repoSelectedEmployeeId]);

  // Summary counts for repository selected employee
  const repoEmployeeSummary = useMemo(() => {
    const list = repoEmployeeDocs;
    const now = new Date();
    const verified = list.filter((d) => d.status === 'Verified').length;
    const pending = list.filter((d) => d.status === 'Pending').length;
    const rejected = list.filter((d) => d.status === 'Rejected').length;
    const expired = list.filter((d) => d.expiryDate && new Date(d.expiryDate) < now).length;
    return {
      total: list.length,
      verified,
      pending,
      rejected,
      expired,
    };
  }, [repoEmployeeDocs]);

  // Handle Tab Switch
  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setCurrentPage(1);
  };

  // Open Upload Modal
  const handleOpenUpload = (targetEmployeeId = null) => {
    setError('');
    setSuccess('');
    const defaultOwner = targetEmployeeId || (employees.length > 0 ? employees[0]._id : '');
    setUploadForm({
      owner: defaultOwner,
      name: '',
      category: 'Identity Proof',
      documentNumber: '',
      issueDate: '',
      expiryDate: '',
      description: '',
      file: null,
    });
    setShowUploadModal(true);
  };

  // Submit Upload Form
  const handleSaveUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.owner) {
      setError('Please select an employee.');
      return;
    }
    if (!uploadForm.name.trim()) {
      setError('Document name is required.');
      return;
    }
    if (!uploadForm.file) {
      setError('Please select a file to upload.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('owner', uploadForm.owner);
      formData.append('name', uploadForm.name.trim());
      formData.append('category', uploadForm.category);
      if (uploadForm.documentNumber) formData.append('documentNumber', uploadForm.documentNumber.trim());
      if (uploadForm.issueDate) formData.append('issueDate', uploadForm.issueDate);
      if (uploadForm.expiryDate) formData.append('expiryDate', uploadForm.expiryDate);
      if (uploadForm.description) formData.append('description', uploadForm.description.trim());
      formData.append('file', uploadForm.file);

      await apiClient.post('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setShowUploadModal(false);
      setSuccess('Document uploaded successfully and queued as Pending verification.');
      await loadDocuments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload document.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Document Details Modal
  const handleOpenDetails = (doc) => {
    setActiveDoc(doc);
    setShowDetailsModal(true);
  };

  // View / Download File
  const handleDownload = async (doc, isDownload = false) => {
    try {
      const res = await apiClient.get(`/documents/${doc._id}/content`, {
        params: isDownload ? { download: '1' } : {},
        responseType: 'blob',
      });
      const blobUrl = URL.createObjectURL(res.data);
      if (isDownload) {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = doc.name || 'document';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        window.open(blobUrl, '_blank');
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
    } catch (err) {
      setError('Unable to open or download the document.');
    }
  };

  // Verify Document (Pending → Verified)
  const handleVerifyDoc = async (doc) => {
    if (!window.confirm(`Are you sure you want to mark "${doc.name}" as Verified?`)) {
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiClient.patch(`/documents/${doc._id}/verify`);
      setSuccess(`Document "${doc.name}" has been marked as Verified.`);
      if (showDetailsModal) setShowDetailsModal(false);
      await loadDocuments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to verify document.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Reject Modal
  const handleOpenReject = (doc) => {
    setActiveDoc(doc);
    setRejectionReasonInput('');
    setShowRejectModal(true);
  };

  // Confirm Reject
  const handleSaveReject = async (e) => {
    e.preventDefault();
    if (!rejectionReasonInput.trim()) {
      setError('Rejection reason is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiClient.patch(`/documents/${activeDoc._id}/reject`, {
        reason: rejectionReasonInput.trim(),
      });
      setShowRejectModal(false);
      if (showDetailsModal) setShowDetailsModal(false);
      setSuccess(`Document "${activeDoc.name}" was rejected. Rejection reason has been recorded.`);
      await loadDocuments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject document.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Replace Modal
  const handleOpenReplace = (doc) => {
    setActiveDoc(doc);
    setReplaceForm({
      name: doc.name || '',
      category: doc.category || 'Other',
      documentNumber: doc.documentNumber || '',
      expiryDate: doc.expiryDate ? doc.expiryDate.split('T')[0] : '',
      description: doc.description || '',
      file: null,
    });
    setShowReplaceModal(true);
  };

  // Submit Replace Form
  const handleSaveReplace = async (e) => {
    e.preventDefault();
    if (!replaceForm.file) {
      setError('Please select a replacement file.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('name', replaceForm.name.trim());
      formData.append('category', replaceForm.category);
      if (replaceForm.documentNumber) formData.append('documentNumber', replaceForm.documentNumber.trim());
      if (replaceForm.expiryDate) formData.append('expiryDate', replaceForm.expiryDate);
      if (replaceForm.description) formData.append('description', replaceForm.description.trim());
      formData.append('file', replaceForm.file);

      await apiClient.post(`/documents/${activeDoc._id}/replace`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setShowReplaceModal(false);
      if (showDetailsModal) setShowDetailsModal(false);
      setSuccess('Replacement document uploaded successfully. Status has been reset to Pending for verification.');
      await loadDocuments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to replace document.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Delete Modal
  const handleOpenDelete = (doc) => {
    setActiveDoc(doc);
    setShowDeleteModal(true);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    setSubmitting(true);
    setError('');
    try {
      await apiClient.delete(`/documents/${activeDoc._id}`);
      setShowDeleteModal(false);
      if (showDetailsModal) setShowDetailsModal(false);
      setSuccess(`Document "${activeDoc.name}" has been deleted.`);
      await loadDocuments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete document.');
    } finally {
      setSubmitting(false);
    }
  };

  // Clear all filters
  const handleResetFilters = () => {
    setSearch('');
    setSelectedDept('All');
    setSelectedCategory('All');
    setSelectedStatus('All');
    setSelectedExpiry('All');
    setSelectedOwner('All');
    setCurrentPage(1);
  };

  return (
    <UserLayout pageTitle="Document Management">
      <div className="doc-container">
        {/* ─── Top Header Section ─── */}
        <div className="doc-header-area">
          <div className="doc-title-meta">
            <h2>Documents</h2>
            <p>Manage, verify and monitor employee documents from one place.</p>
          </div>
          <div className="doc-header-actions">
            <button
              type="button"
              className="doc-secondary-btn"
              onClick={loadDocuments}
              title="Refresh Records"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              Refresh
            </button>
            <button
              type="button"
              className="doc-primary-btn"
              onClick={() => handleOpenUpload()}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              Upload Document
            </button>
          </div>
        </div>

        {/* ─── Feedback Alerts ─── */}
        {error && (
          <div className="doc-alert error">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')}>✕</button>
          </div>
        )}
        {success && (
          <div className="doc-alert success">
            <span>{success}</span>
            <button type="button" onClick={() => setSuccess('')}>✕</button>
          </div>
        )}

        {/* ─── 6 Dynamic KPI Cards ─── */}
        <div className="doc-kpi-grid">
          {/* Card 1: Total Documents */}
          <div
            className={`doc-kpi-card blue ${activeTab === 'all' ? 'active-kpi' : ''}`}
            onClick={() => handleTabChange('all')}
          >
            <div className="doc-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <div className="doc-kpi-body">
              <span className="doc-kpi-label">Total Documents</span>
              <strong className="doc-kpi-value">{summary.totalDocuments}</strong>
              <span className="doc-kpi-sub">Across {summary.totalEmployees} employees</span>
            </div>
          </div>

          {/* Card 2: Pending Verification */}
          <div
            className={`doc-kpi-card amber ${activeTab === 'pending' ? 'active-kpi' : ''}`}
            onClick={() => handleTabChange('pending')}
          >
            <div className="doc-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="doc-kpi-body">
              <span className="doc-kpi-label">Pending Verification</span>
              <strong className="doc-kpi-value">{summary.pendingVerification}</strong>
              <span className="doc-kpi-sub">Awaiting HR Review</span>
            </div>
          </div>

          {/* Card 3: Verified Documents */}
          <div
            className={`doc-kpi-card emerald ${activeTab === 'verified' ? 'active-kpi' : ''}`}
            onClick={() => handleTabChange('verified')}
          >
            <div className="doc-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className="doc-kpi-body">
              <span className="doc-kpi-label">Verified Documents</span>
              <strong className="doc-kpi-value">{summary.verifiedDocuments}</strong>
              <span className="doc-kpi-sub">Approved & Compliant</span>
            </div>
          </div>

          {/* Card 4: Rejected Documents */}
          <div
            className={`doc-kpi-card rose ${activeTab === 'rejected' ? 'active-kpi' : ''}`}
            onClick={() => handleTabChange('rejected')}
          >
            <div className="doc-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div className="doc-kpi-body">
              <span className="doc-kpi-label">Rejected Documents</span>
              <strong className="doc-kpi-value">{summary.rejectedDocuments}</strong>
              <span className="doc-kpi-sub">Needs Replacement</span>
            </div>
          </div>

          {/* Card 5: Expired Documents */}
          <div
            className={`doc-kpi-card red ${activeTab === 'expired' ? 'active-kpi' : ''}`}
            onClick={() => handleTabChange('expired')}
          >
            <div className="doc-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="doc-kpi-body">
              <span className="doc-kpi-label">Expired Documents</span>
              <strong className="doc-kpi-value">{summary.expiredDocuments}</strong>
              <span className="doc-kpi-sub">Renewal Required</span>
            </div>
          </div>

          {/* Card 6: Expiring Soon */}
          <div
            className={`doc-kpi-card orange ${activeTab === 'expiring_soon' ? 'active-kpi' : ''}`}
            onClick={() => handleTabChange('expiring_soon')}
          >
            <div className="doc-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="doc-kpi-body">
              <span className="doc-kpi-label">Expiring Soon</span>
              <strong className="doc-kpi-value">{summary.expiringSoon}</strong>
              <span className="doc-kpi-sub">Within next 30 days</span>
            </div>
          </div>
        </div>

        {/* ─── Navigation Tabs ─── */}
        <div className="doc-nav-tabs-wrap">
          <div className="doc-nav-tabs">
            <button
              type="button"
              className={`doc-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => handleTabChange('all')}
            >
              All Documents
              <span className="doc-tab-badge">{summary.totalDocuments}</span>
            </button>
            <button
              type="button"
              className={`doc-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => handleTabChange('pending')}
            >
              Pending Verification
              <span className="doc-tab-badge amber">{summary.pendingVerification}</span>
            </button>
            <button
              type="button"
              className={`doc-tab-btn ${activeTab === 'verified' ? 'active' : ''}`}
              onClick={() => handleTabChange('verified')}
            >
              Verified
              <span className="doc-tab-badge emerald">{summary.verifiedDocuments}</span>
            </button>
            <button
              type="button"
              className={`doc-tab-btn ${activeTab === 'rejected' ? 'active' : ''}`}
              onClick={() => handleTabChange('rejected')}
            >
              Rejected
              <span className="doc-tab-badge rose">{summary.rejectedDocuments}</span>
            </button>
            <button
              type="button"
              className={`doc-tab-btn ${activeTab === 'expiring_soon' ? 'active' : ''}`}
              onClick={() => handleTabChange('expiring_soon')}
            >
              Expiring Soon
              <span className="doc-tab-badge orange">{summary.expiringSoon}</span>
            </button>
            <button
              type="button"
              className={`doc-tab-btn ${activeTab === 'expired' ? 'active' : ''}`}
              onClick={() => handleTabChange('expired')}
            >
              Expired
              <span className="doc-tab-badge red">{summary.expiredDocuments}</span>
            </button>
            <button
              type="button"
              className={`doc-tab-btn ${activeTab === 'repository' ? 'active' : ''}`}
              onClick={() => handleTabChange('repository')}
            >
              Employee Repository
            </button>
          </div>
        </div>

        {/* ─── TAB CONTENT 1-6: DOCUMENT TABLE VIEW ─── */}
        {activeTab !== 'repository' && (
          <>
            {/* Toolbar: Search and Multi-Select Filters */}
            <div className="doc-toolbar">
              <div className="doc-search-wrap">
                <svg className="doc-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="doc-search-input"
                  placeholder="Search by employee, ID, document name, or number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Department Filter */}
              <select
                className="doc-filter-select"
                value={selectedDept}
                onChange={(e) => {
                  setSelectedDept(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="All">All Departments</option>
                {OFFICIAL_DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              {/* Category Filter */}
              <select
                className="doc-filter-select"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="All">All Categories</option>
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* Status Filter (Only active on 'all' tab) */}
              {activeTab === 'all' && (
                <select
                  className="doc-filter-select"
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Verified">Verified</option>
                  <option value="Rejected">Rejected</option>
                </select>
              )}

              {/* Expiry Filter */}
              {activeTab === 'all' && (
                <select
                  className="doc-filter-select"
                  value={selectedExpiry}
                  onChange={(e) => {
                    setSelectedExpiry(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="All">All Expiry States</option>
                  <option value="Valid">Valid</option>
                  <option value="Expiring Soon">Expiring Soon</option>
                  <option value="Expired">Expired</option>
                </select>
              )}

              {/* Reset Filters */}
              {(search || selectedDept !== 'All' || selectedCategory !== 'All' || selectedStatus !== 'All' || selectedExpiry !== 'All') && (
                <button type="button" className="doc-reset-btn" onClick={handleResetFilters}>
                  Clear Filters
                </button>
              )}
            </div>

            {/* Document Table Card */}
            <div className="doc-table-card">
              {loading ? (
                <div className="doc-loading-state">
                  <div className="doc-spinner" />
                  <p>Loading documents from database...</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="doc-empty-state">
                  <div className="doc-empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="11" x2="12" y2="17" />
                      <line x1="9" y1="14" x2="15" y2="14" />
                    </svg>
                  </div>
                  <h3>No Documents Found</h3>
                  <p>
                    {search || selectedDept !== 'All' || selectedCategory !== 'All' || activeTab !== 'all'
                      ? 'No documents match your active search and filter criteria.'
                      : 'Upload an employee document to get started.'}
                  </p>
                  <button type="button" className="doc-primary-btn" onClick={() => handleOpenUpload()}>
                    ⚡ Upload Document Now
                  </button>
                </div>
              ) : (
                <div className="doc-table-wrap">
                  <table className="doc-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Department</th>
                        <th>Document</th>
                        <th>Category</th>
                        <th>Uploaded Date</th>
                        <th>Expiry Status</th>
                        <th>Verification</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc) => {
                        const ownerObj = doc.owner || {};
                        const fullName =
                          ownerObj.personalInfo?.fullName ||
                          [ownerObj.firstName, ownerObj.lastName].filter(Boolean).join(' ') ||
                          ownerObj.email ||
                          'Employee';
                        const empId = ownerObj.jobDetails?.employeeId || `EMP-${String(ownerObj._id || '').slice(-5).toUpperCase()}`;
                        const dept = ownerObj.jobDetails?.department || ownerObj.department || '—';
                        const expiryCls = getExpiryClassification(doc.expiryDate);
                        const docStatusStr = (doc.status || 'Pending').toLowerCase();

                        return (
                          <tr key={doc._id}>
                            {/* Employee Cell */}
                            <td>
                              <div className="doc-emp-cell">
                                <div className="doc-emp-avatar">
                                  {initialsFor(ownerObj.firstName, ownerObj.lastName, ownerObj.email)}
                                </div>
                                <div className="doc-emp-meta">
                                  <span className="doc-emp-name">{fullName}</span>
                                  <span className="doc-emp-id">{empId}</span>
                                </div>
                              </div>
                            </td>

                            {/* Department */}
                            <td>
                              <span className="doc-dept-pill">{dept}</span>
                            </td>

                            {/* Document Title & Type */}
                            <td>
                              <div className="doc-title-cell">
                                <strong className="doc-name">{doc.name}</strong>
                                {doc.documentNumber && (
                                  <span className="doc-num-sub">#{doc.documentNumber}</span>
                                )}
                              </div>
                            </td>

                            {/* Category */}
                            <td>
                              <span className="doc-cat-badge">{doc.category || 'Other'}</span>
                            </td>

                            {/* Uploaded Date */}
                            <td>{formatDate(doc.createdAt)}</td>

                            {/* Expiry Date & Classification */}
                            <td>
                              <div className="doc-expiry-cell">
                                <span>{formatDate(doc.expiryDate)}</span>
                                <span className={`doc-expiry-badge ${expiryCls.className}`}>
                                  {expiryCls.label}
                                </span>
                              </div>
                            </td>

                            {/* Verification Status */}
                            <td>
                              <span className={`doc-status-pill ${docStatusStr}`}>
                                {doc.status === 'Pending' && '⏳ Pending'}
                                {doc.status === 'Verified' && '✅ Verified'}
                                {doc.status === 'Rejected' && '❌ Rejected'}
                              </span>
                            </td>

                            {/* Contextual Actions */}
                            <td>
                              <div className="doc-actions-wrap">
                                <button
                                  type="button"
                                  className="doc-btn-sm view"
                                  onClick={() => handleOpenDetails(doc)}
                                  title="View Details"
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  className="doc-btn-sm download"
                                  onClick={() => handleDownload(doc, true)}
                                  title="Download File"
                                >
                                  Download
                                </button>
                                {doc.status === 'Pending' && (
                                  <>
                                    <button
                                      type="button"
                                      className="doc-btn-sm verify"
                                      onClick={() => handleVerifyDoc(doc)}
                                      title="Verify Document"
                                    >
                                      Verify
                                    </button>
                                    <button
                                      type="button"
                                      className="doc-btn-sm reject"
                                      onClick={() => handleOpenReject(doc)}
                                      title="Reject Document"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                                {doc.status === 'Rejected' && (
                                  <button
                                    type="button"
                                    className="doc-btn-sm replace"
                                    onClick={() => handleOpenReplace(doc)}
                                    title="Re-upload / Replace"
                                  >
                                    Replace
                                  </button>
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

              {/* Table Pagination Footer */}
              {paginationMeta.total > pageSize && (
                <div className="doc-pagination-bar">
                  <div className="doc-pagination-info">
                    Showing {Math.min((currentPage - 1) * pageSize + 1, paginationMeta.total)} to{' '}
                    {Math.min(currentPage * pageSize, paginationMeta.total)} of {paginationMeta.total} records
                  </div>
                  <div className="doc-pagination-controls">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
                      ← Previous
                    </button>
                    <span className="doc-page-indicator">
                      Page {currentPage} of {paginationMeta.totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= paginationMeta.totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── TAB CONTENT 7: EMPLOYEE REPOSITORY TAB ─── */}
        {activeTab === 'repository' && (
          <div className="doc-repo-workspace">
            {/* Employee Selector Card */}
            <div className="doc-repo-header-card">
              <div className="doc-repo-select-row">
                <label>
                  <strong>Select Employee:</strong>
                </label>
                <select
                  className="doc-repo-employee-select"
                  value={repoSelectedEmployeeId}
                  onChange={(e) => setRepoSelectedEmployeeId(e.target.value)}
                >
                  {employees.map((emp) => {
                    const name = emp.personalInfo?.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email;
                    const id = emp.jobDetails?.employeeId || `EMP-${String(emp._id).slice(-5).toUpperCase()}`;
                    const dept = emp.jobDetails?.department || emp.department || '—';
                    return (
                      <option key={emp._id} value={emp._id}>
                        {name} ({id}) — {dept}
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  className="doc-primary-btn"
                  onClick={() => handleOpenUpload(repoSelectedEmployeeId)}
                >
                  + Add Document for this Employee
                </button>
              </div>

              {/* Selected Employee Profile Summary */}
              {repoEmployee && (
                <div className="doc-repo-profile-banner">
                  <div className="doc-repo-avatar">
                    {initialsFor(repoEmployee.firstName, repoEmployee.lastName, repoEmployee.email)}
                  </div>
                  <div className="doc-repo-profile-info">
                    <h3>
                      {repoEmployee.personalInfo?.fullName ||
                        `${repoEmployee.firstName || ''} ${repoEmployee.lastName || ''}`.trim() ||
                        repoEmployee.email}
                    </h3>
                    <div className="doc-repo-meta-tags">
                      <span><strong>ID:</strong> {repoEmployee.jobDetails?.employeeId || `EMP-${String(repoEmployee._id).slice(-5).toUpperCase()}`}</span>
                      <span><strong>Dept:</strong> {repoEmployee.jobDetails?.department || repoEmployee.department || '—'}</span>
                      <span><strong>Role:</strong> {repoEmployee.designation || repoEmployee.jobDetails?.designation || 'Staff'}</span>
                      <span><strong>Email:</strong> {repoEmployee.email}</span>
                    </div>
                  </div>

                  {/* Document Counters for Employee */}
                  <div className="doc-repo-counters">
                    <div className="doc-counter-col">
                      <span>Total Docs</span>
                      <strong>{repoEmployeeSummary.total}</strong>
                    </div>
                    <div className="doc-counter-col green">
                      <span>Verified</span>
                      <strong>{repoEmployeeSummary.verified}</strong>
                    </div>
                    <div className="doc-counter-col amber">
                      <span>Pending</span>
                      <strong>{repoEmployeeSummary.pending}</strong>
                    </div>
                    <div className="doc-counter-col red">
                      <span>Rejected</span>
                      <strong>{repoEmployeeSummary.rejected}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Employee's Document Table */}
            <div className="doc-table-card">
              <div className="doc-card-heading">
                <h4>All Documents for {repoEmployee?.firstName || 'Selected Employee'}</h4>
              </div>
              {repoEmployeeDocs.length === 0 ? (
                <div className="doc-empty-state">
                  <p>No documents found for this employee.</p>
                  <button
                    type="button"
                    className="doc-primary-btn"
                    onClick={() => handleOpenUpload(repoSelectedEmployeeId)}
                  >
                    Upload First Document
                  </button>
                </div>
              ) : (
                <div className="doc-table-wrap">
                  <table className="doc-table">
                    <thead>
                      <tr>
                        <th>Document Name</th>
                        <th>Category</th>
                        <th>Uploaded Date</th>
                        <th>Expiry Date</th>
                        <th>Expiry Status</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repoEmployeeDocs.map((doc) => {
                        const expiryCls = getExpiryClassification(doc.expiryDate);
                        const docStatusStr = (doc.status || 'Pending').toLowerCase();
                        return (
                          <tr key={doc._id}>
                            <td>
                              <strong>{doc.name}</strong>
                              {doc.documentNumber && <div className="doc-num-sub">#{doc.documentNumber}</div>}
                            </td>
                            <td>
                              <span className="doc-cat-badge">{doc.category}</span>
                            </td>
                            <td>{formatDate(doc.createdAt)}</td>
                            <td>{formatDate(doc.expiryDate)}</td>
                            <td>
                              <span className={`doc-expiry-badge ${expiryCls.className}`}>{expiryCls.label}</span>
                            </td>
                            <td>
                              <span className={`doc-status-pill ${docStatusStr}`}>
                                {doc.status === 'Pending' && '⏳ Pending'}
                                {doc.status === 'Verified' && '✅ Verified'}
                                {doc.status === 'Rejected' && '❌ Rejected'}
                              </span>
                            </td>
                            <td>
                              <div className="doc-actions-wrap">
                                <button
                                  type="button"
                                  className="doc-btn-sm view"
                                  onClick={() => handleOpenDetails(doc)}
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  className="doc-btn-sm download"
                                  onClick={() => handleDownload(doc, true)}
                                >
                                  Download
                                </button>
                                {doc.status === 'Pending' && (
                                  <>
                                    <button
                                      type="button"
                                      className="doc-btn-sm verify"
                                      onClick={() => handleVerifyDoc(doc)}
                                    >
                                      Verify
                                    </button>
                                    <button
                                      type="button"
                                      className="doc-btn-sm reject"
                                      onClick={() => handleOpenReject(doc)}
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                                {doc.status === 'Rejected' && (
                                  <button
                                    type="button"
                                    className="doc-btn-sm replace"
                                    onClick={() => handleOpenReplace(doc)}
                                  >
                                    Replace
                                  </button>
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

        {/* ─── MODAL 1: UPLOAD DOCUMENT ─── */}
        {showUploadModal && (
          <div className="doc-modal-overlay">
            <div className="doc-modal-card">
              <div className="doc-modal-header">
                <h3>Upload Employee Document</h3>
                <button
                  type="button"
                  className="doc-modal-close"
                  onClick={() => setShowUploadModal(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveUpload} className="doc-modal-form">
                {/* Employee Selector */}
                <div className="doc-form-group">
                  <label>
                    Assigned Employee <span className="req">*</span>
                  </label>
                  <select
                    className="doc-input"
                    value={uploadForm.owner}
                    onChange={(e) => setUploadForm({ ...uploadForm, owner: e.target.value })}
                    required
                  >
                    <option value="" disabled>Select Employee</option>
                    {employees.map((emp) => {
                      const name = emp.personalInfo?.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email;
                      const id = emp.jobDetails?.employeeId || `EMP-${String(emp._id).slice(-5).toUpperCase()}`;
                      const dept = emp.jobDetails?.department || emp.department || '—';
                      return (
                        <option key={emp._id} value={emp._id}>
                          {name} ({id}) — {dept}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Derived Department */}
                {selectedUploadEmployee && (
                  <div className="doc-form-group">
                    <label>Department</label>
                    <input
                      type="text"
                      className="doc-input readonly"
                      readOnly
                      value={selectedUploadEmployee.jobDetails?.department || selectedUploadEmployee.department || 'General'}
                    />
                  </div>
                )}

                {/* Category & Title */}
                <div className="doc-form-row">
                  <div className="doc-form-group">
                    <label>
                      Document Category <span className="req">*</span>
                    </label>
                    <select
                      className="doc-input"
                      value={uploadForm.category}
                      onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                      required
                    >
                      {DOCUMENT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="doc-form-group">
                    <label>
                      Document Title / Name <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      className="doc-input"
                      placeholder="e.g. PAN Card, Passport, Degree Certificate"
                      value={uploadForm.name}
                      onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Document Number & Dates */}
                <div className="doc-form-row">
                  <div className="doc-form-group">
                    <label>Document / ID Number (Optional)</label>
                    <input
                      type="text"
                      className="doc-input"
                      placeholder="e.g. ABCDE1234F"
                      value={uploadForm.documentNumber}
                      onChange={(e) => setUploadForm({ ...uploadForm, documentNumber: e.target.value })}
                    />
                  </div>
                  <div className="doc-form-group">
                    <label>Issue Date</label>
                    <input
                      type="date"
                      className="doc-input"
                      value={uploadForm.issueDate}
                      onChange={(e) => setUploadForm({ ...uploadForm, issueDate: e.target.value })}
                    />
                  </div>
                  <div className="doc-form-group">
                    <label>Expiry Date</label>
                    <input
                      type="date"
                      className="doc-input"
                      value={uploadForm.expiryDate}
                      onChange={(e) => setUploadForm({ ...uploadForm, expiryDate: e.target.value })}
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="doc-form-group">
                  <label>Description / Notes</label>
                  <textarea
                    className="doc-textarea"
                    rows="2"
                    placeholder="Add any additional notes about this document..."
                    value={uploadForm.description}
                    onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  />
                </div>

                {/* File Dropzone */}
                <div className="doc-form-group">
                  <label>
                    Upload File <span className="req">*</span>
                  </label>
                  <div className="doc-dropzone">
                    <input
                      type="file"
                      id="doc-file-input"
                      onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files[0] })}
                      required
                    />
                    <div className="doc-dropzone-inner">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                      </svg>
                      {uploadForm.file ? (
                        <p className="doc-file-chosen">
                          Selected: <strong>{uploadForm.file.name}</strong> ({formatFileSize(uploadForm.file.size)})
                        </p>
                      ) : (
                        <p>
                          <strong>Click to browse</strong> or drag and drop your file here
                          <br />
                          <small>Supported: PDF, DOC, DOCX, PNG, JPG (Max 15MB)</small>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="doc-modal-footer">
                  <button
                    type="button"
                    className="doc-secondary-btn"
                    onClick={() => setShowUploadModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="doc-primary-btn" disabled={submitting}>
                    {submitting ? 'Uploading...' : 'Save Document'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL 2: DOCUMENT DETAILS & AUDIT TRAIL ─── */}
        {showDetailsModal && activeDoc && (
          <div className="doc-modal-overlay">
            <div className="doc-modal-card doc-details-card">
              <div className="doc-modal-header">
                <div className="doc-details-title-wrap">
                  <h3>{activeDoc.name}</h3>
                  <span className={`doc-status-pill ${(activeDoc.status || 'pending').toLowerCase()}`}>
                    {activeDoc.status === 'Pending' && '⏳ Pending Verification'}
                    {activeDoc.status === 'Verified' && '✅ Verified'}
                    {activeDoc.status === 'Rejected' && '❌ Rejected'}
                  </span>
                </div>
                <button
                  type="button"
                  className="doc-modal-close"
                  onClick={() => setShowDetailsModal(false)}
                >
                  ✕
                </button>
              </div>

              <div className="doc-details-body">
                {/* Employee Section */}
                <div className="doc-details-emp-card">
                  <div className="doc-emp-avatar lg">
                    {initialsFor(activeDoc.owner?.firstName, activeDoc.owner?.lastName, activeDoc.owner?.email)}
                  </div>
                  <div className="doc-details-emp-meta">
                    <h4>
                      {activeDoc.owner?.personalInfo?.fullName ||
                        [activeDoc.owner?.firstName, activeDoc.owner?.lastName].filter(Boolean).join(' ') ||
                        activeDoc.owner?.email}
                    </h4>
                    <p>
                      <strong>ID:</strong> {activeDoc.owner?.jobDetails?.employeeId || `EMP-${String(activeDoc.owner?._id || '').slice(-5).toUpperCase()}`} •{' '}
                      <strong>Dept:</strong> {activeDoc.owner?.jobDetails?.department || activeDoc.owner?.department || '—'} •{' '}
                      <strong>Designation:</strong> {activeDoc.owner?.designation || activeDoc.owner?.jobDetails?.designation || 'Staff'}
                    </p>
                  </div>
                </div>

                {/* Document Metadata Grid */}
                <div className="doc-meta-grid">
                  <div className="doc-meta-item">
                    <span>Category</span>
                    <strong>{activeDoc.category || 'Other'}</strong>
                  </div>
                  <div className="doc-meta-item">
                    <span>Document Number</span>
                    <strong>{activeDoc.documentNumber || '—'}</strong>
                  </div>
                  <div className="doc-meta-item">
                    <span>File Size</span>
                    <strong>{formatFileSize(activeDoc.size)}</strong>
                  </div>
                  <div className="doc-meta-item">
                    <span>File Type</span>
                    <strong>{activeDoc.mimeType || 'Document'}</strong>
                  </div>
                  <div className="doc-meta-item">
                    <span>Issue Date</span>
                    <strong>{formatDate(activeDoc.issueDate)}</strong>
                  </div>
                  <div className="doc-meta-item">
                    <span>Expiry Date</span>
                    <strong>
                      {formatDate(activeDoc.expiryDate)}{' '}
                      <span className={`doc-expiry-badge sm ${getExpiryClassification(activeDoc.expiryDate).className}`}>
                        {getExpiryClassification(activeDoc.expiryDate).label}
                      </span>
                    </strong>
                  </div>
                </div>

                {/* Description */}
                {activeDoc.description && (
                  <div className="doc-details-desc">
                    <span>Description / Notes:</span>
                    <p>{activeDoc.description}</p>
                  </div>
                )}

                {/* Audit Trail Section */}
                <div className="doc-audit-section">
                  <h5>Audit & Verification History</h5>
                  <div className="doc-audit-timeline">
                    {/* Upload Event */}
                    <div className="doc-audit-event">
                      <span className="doc-audit-bullet blue" />
                      <div>
                        <strong>Uploaded</strong> by {activeDoc.uploadedByName || 'HR Manager'}
                        <small>{formatDate(activeDoc.createdAt)} at {new Date(activeDoc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                      </div>
                    </div>

                    {/* Verified Event */}
                    {activeDoc.status === 'Verified' && activeDoc.verifiedAt && (
                      <div className="doc-audit-event">
                        <span className="doc-audit-bullet green" />
                        <div>
                          <strong>Verified</strong> by {activeDoc.verifiedByName || 'HR Manager'}
                          <small>{formatDate(activeDoc.verifiedAt)} at {new Date(activeDoc.verifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                        </div>
                      </div>
                    )}

                    {/* Rejected Event */}
                    {activeDoc.status === 'Rejected' && activeDoc.rejectedAt && (
                      <div className="doc-audit-event">
                        <span className="doc-audit-bullet red" />
                        <div>
                          <strong>Rejected</strong> by {activeDoc.rejectedByName || 'HR Manager'}
                          <small>{formatDate(activeDoc.rejectedAt)} at {new Date(activeDoc.rejectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                          {activeDoc.rejectionReason && (
                            <div className="doc-rejection-box">
                              <strong>Reason for Rejection:</strong> {activeDoc.rejectionReason}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="doc-modal-footer space-between">
                <div>
                  <button
                    type="button"
                    className="doc-secondary-btn"
                    onClick={() => handleDownload(activeDoc, false)}
                  >
                    👁️ Preview
                  </button>
                  <button
                    type="button"
                    className="doc-primary-btn"
                    onClick={() => handleDownload(activeDoc, true)}
                    style={{ marginLeft: '0.5rem' }}
                  >
                    ⬇️ Download
                  </button>
                </div>

                <div className="doc-footer-right-actions">
                  {activeDoc.status === 'Pending' && (
                    <>
                      <button
                        type="button"
                        className="doc-btn-verify-lg"
                        onClick={() => handleVerifyDoc(activeDoc)}
                      >
                        ✅ Verify
                      </button>
                      <button
                        type="button"
                        className="doc-btn-reject-lg"
                        onClick={() => handleOpenReject(activeDoc)}
                      >
                        ❌ Reject
                      </button>
                    </>
                  )}
                  {activeDoc.status === 'Rejected' && (
                    <button
                      type="button"
                      className="doc-primary-btn"
                      onClick={() => handleOpenReplace(activeDoc)}
                    >
                      🔄 Replace Document
                    </button>
                  )}
                  <button
                    type="button"
                    className="doc-danger-btn"
                    onClick={() => handleOpenDelete(activeDoc)}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL 3: REJECT DOCUMENT MODAL ─── */}
        {showRejectModal && activeDoc && (
          <div className="doc-modal-overlay">
            <div className="doc-modal-card sm">
              <div className="doc-modal-header">
                <h3>Reject Document</h3>
                <button
                  type="button"
                  className="doc-modal-close"
                  onClick={() => setShowRejectModal(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveReject} className="doc-modal-form">
                <div className="doc-reject-warning">
                  <p>
                    Are you sure you want to reject <strong>"{activeDoc.name}"</strong>?
                    <br />
                    The employee will be notified and required to upload a replacement.
                  </p>
                </div>

                <div className="doc-form-group">
                  <label>
                    Rejection Reason <span className="req">*</span>
                  </label>
                  <textarea
                    className="doc-textarea"
                    rows="3"
                    placeholder="Specify clearly why this document is being rejected (e.g. Blurred scan, Expired date, Missing signature)..."
                    value={rejectionReasonInput}
                    onChange={(e) => setRejectionReasonInput(e.target.value)}
                    required
                  />
                </div>

                <div className="doc-modal-footer">
                  <button
                    type="button"
                    className="doc-secondary-btn"
                    onClick={() => setShowRejectModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="doc-danger-btn"
                    disabled={submitting || !rejectionReasonInput.trim()}
                  >
                    {submitting ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL 4: REPLACE / RE-UPLOAD MODAL ─── */}
        {showReplaceModal && activeDoc && (
          <div className="doc-modal-overlay">
            <div className="doc-modal-card">
              <div className="doc-modal-header">
                <h3>Replace / Re-upload Document</h3>
                <button
                  type="button"
                  className="doc-modal-close"
                  onClick={() => setShowReplaceModal(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveReplace} className="doc-modal-form">
                <div className="doc-replace-notice">
                  <p>
                    Uploading a replacement for <strong>"{activeDoc.name}"</strong> ({activeDoc.category}).
                    <br />
                    <small>The replacement document will be submitted in <strong>Pending</strong> status and will require HR verification.</small>
                  </p>
                </div>

                <div className="doc-form-row">
                  <div className="doc-form-group">
                    <label>Document Title</label>
                    <input
                      type="text"
                      className="doc-input"
                      value={replaceForm.name}
                      onChange={(e) => setReplaceForm({ ...replaceForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="doc-form-group">
                    <label>Category</label>
                    <select
                      className="doc-input"
                      value={replaceForm.category}
                      onChange={(e) => setReplaceForm({ ...replaceForm, category: e.target.value })}
                    >
                      {DOCUMENT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="doc-form-row">
                  <div className="doc-form-group">
                    <label>Document Number (Optional)</label>
                    <input
                      type="text"
                      className="doc-input"
                      value={replaceForm.documentNumber}
                      onChange={(e) => setReplaceForm({ ...replaceForm, documentNumber: e.target.value })}
                    />
                  </div>
                  <div className="doc-form-group">
                    <label>Expiry Date</label>
                    <input
                      type="date"
                      className="doc-input"
                      value={replaceForm.expiryDate}
                      onChange={(e) => setReplaceForm({ ...replaceForm, expiryDate: e.target.value })}
                    />
                  </div>
                </div>

                {/* Replacement File */}
                <div className="doc-form-group">
                  <label>
                    New Replacement File <span className="req">*</span>
                  </label>
                  <div className="doc-dropzone">
                    <input
                      type="file"
                      onChange={(e) => setReplaceForm({ ...replaceForm, file: e.target.files[0] })}
                      required
                    />
                    <div className="doc-dropzone-inner">
                      {replaceForm.file ? (
                        <p className="doc-file-chosen">
                          Selected: <strong>{replaceForm.file.name}</strong> ({formatFileSize(replaceForm.file.size)})
                        </p>
                      ) : (
                        <p>
                          <strong>Click to select new replacement file</strong>
                          <br />
                          <small>PDF, DOC, DOCX, PNG, JPG (Max 15MB)</small>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="doc-modal-footer">
                  <button
                    type="button"
                    className="doc-secondary-btn"
                    onClick={() => setShowReplaceModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="doc-primary-btn" disabled={submitting}>
                    {submitting ? 'Uploading Replacement...' : 'Submit for Verification'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL 5: DELETE CONFIRMATION MODAL ─── */}
        {showDeleteModal && activeDoc && (
          <div className="doc-modal-overlay">
            <div className="doc-modal-card sm">
              <div className="doc-modal-header">
                <h3>Confirm Deletion</h3>
                <button
                  type="button"
                  className="doc-modal-close"
                  onClick={() => setShowDeleteModal(false)}
                >
                  ✕
                </button>
              </div>

              <div className="doc-modal-form">
                <p>
                  Are you sure you want to permanently delete document <strong>"{activeDoc.name}"</strong>?
                  <br />
                  This action cannot be undone.
                </p>

                <div className="doc-modal-footer">
                  <button
                    type="button"
                    className="doc-secondary-btn"
                    onClick={() => setShowDeleteModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="doc-danger-btn"
                    onClick={handleConfirmDelete}
                    disabled={submitting}
                  >
                    {submitting ? 'Deleting...' : 'Delete Permanently'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
}
