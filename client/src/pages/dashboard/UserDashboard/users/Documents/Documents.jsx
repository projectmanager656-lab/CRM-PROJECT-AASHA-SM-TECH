import React, { useState, useEffect, useMemo, useCallback } from 'react';
import apiClient from '../../../../../services/apiClient';
import UserLayout from '../components/UserLayout';
import './Documents.css';

export const DOCUMENT_CATEGORIES = [
  'Identity Proof',
  'Education Certificate',
  'Employment',
  'Payroll / Financial',
  'Other HR',
];

export const DOCUMENT_TYPES = {
  'Identity Proof': ['Aadhaar Card', 'PAN Card', 'Passport', 'Driving Licence', 'Voter ID', 'Other ID Proof'],
  'Education Certificate': ['10th Certificate', '12th Certificate', 'Degree Certificate', 'Diploma', 'Marksheet', 'Professional Certification'],
  'Employment': ['Offer Letter', 'Appointment Letter', 'Employment Agreement', 'Joining Letter', 'Promotion Letter', 'Transfer Letter', 'Salary Revision Letter', 'Experience Letter', 'Relieving Letter'],
  'Payroll / Financial': ['Payslip', 'Salary Documents', 'Tax Documents', 'Investment Declaration', 'Bank Proof'],
  'Other HR': ['Medical Certificate', 'Insurance Document', 'Emergency Contact Form', 'Employee Form', 'Other'],
};

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
  const [departments, setDepartments] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [missingData, setMissingData] = useState([]);
  const [historyList, setHistoryList] = useState([]);

  const [summary, setSummary] = useState({
    totalDocuments: 0,
    pendingVerification: 0,
    verifiedDocuments: 0,
    rejectedDocuments: 0,
    expiredDocuments: 0,
    expiringSoon: 0,
    totalEmployees: 0,
    mandatoryRequirementsCount: 0,
    categoryBreakdown: {},
  });

  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 9 Tabs: 'all' | 'repository' | 'pending' | 'expiring_soon' | 'expired' | 'missing' | 'categories' | 'requirements' | 'history'
  const [activeTab, setActiveTab] = useState('all');

  // Search & Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDocumentType, setSelectedDocumentType] = useState('All');
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
  const [showViewerModal, setShowViewerModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showRequirementModal, setShowRequirementModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [activeDoc, setActiveDoc] = useState(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // In-App Viewer Zoom State
  const [viewerZoom, setViewerZoom] = useState(1);

  // Upload Form State
  const [uploadForm, setUploadForm] = useState({
    owner: '',
    name: '',
    category: 'Identity Proof',
    documentType: 'Aadhaar Card',
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
    documentType: '',
    documentNumber: '',
    expiryDate: '',
    description: '',
    file: null,
  });

  // New Requirement Form State
  const [newReqForm, setNewReqForm] = useState({
    name: '',
    category: 'Identity Proof',
    documentType: '',
    isMandatory: true,
    applicableDepartment: 'All',
    description: '',
  });

  // Load live data from MongoDB
  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let statusParam = selectedStatus !== 'All' ? selectedStatus : undefined;
      let expiryParam = selectedExpiry !== 'All' ? selectedExpiry : undefined;

      if (activeTab === 'pending') statusParam = 'Pending';
      else if (activeTab === 'expiring_soon') expiryParam = 'Expiring Soon';
      else if (activeTab === 'expired') expiryParam = 'Expired';

      const ownerParam =
        activeTab === 'repository' && repoSelectedEmployeeId
          ? repoSelectedEmployeeId
          : selectedOwner !== 'All'
          ? selectedOwner
          : undefined;

      const [docsRes, sumRes, empRes, deptRes] = await Promise.all([
        apiClient.get('/documents', {
          params: {
            search: search || undefined,
            department: selectedDept !== 'All' ? selectedDept : undefined,
            category: selectedCategory !== 'All' ? selectedCategory : undefined,
            documentType: selectedDocumentType !== 'All' ? selectedDocumentType : undefined,
            status: statusParam,
            expiryStatus: expiryParam,
            owner: ownerParam,
            page: currentPage,
            limit: pageSize,
          },
        }),
        apiClient.get('/documents/summary').catch(() => ({ data: { data: null } })),
        apiClient.get('/users').catch(() => ({ data: { data: [] } })),
        apiClient.get('/departments').catch(() => apiClient.get('/admin/departments')).catch(() => ({ data: { data: [] } })),
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

      // Extract unique departments
      const loadedDepts = (deptRes.data?.data || []).map((d) => (typeof d === 'string' ? d : d.name)).filter(Boolean);
      const empDepts = Array.from(new Set(activeEmps.map((e) => e.department || e.jobDetails?.department).filter(Boolean)));
      const combinedDepts = Array.from(new Set([...loadedDepts, ...empDepts, 'Tech', 'HR', 'Finance', 'Business Development', 'Digital Marketing', 'Video Editor']));
      setDepartments(combinedDepts);

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
    selectedDocumentType,
    selectedOwner,
    search,
    currentPage,
    pageSize,
    repoSelectedEmployeeId,
  ]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Load secondary tab data when switching to specialized tabs
  const loadTabSpecificData = useCallback(async (tabKey) => {
    if (tabKey === 'requirements') {
      setTabLoading(true);
      try {
        const res = await apiClient.get('/documents/requirements');
        setRequirements(res.data?.data || []);
      } catch (err) {
        // Fallback
      } finally {
        setTabLoading(false);
      }
    } else if (tabKey === 'missing') {
      setTabLoading(true);
      try {
        const res = await apiClient.get('/documents/missing');
        setMissingData(res.data?.data || []);
      } catch (err) {
        // Fallback
      } finally {
        setTabLoading(false);
      }
    } else if (tabKey === 'history') {
      setTabLoading(true);
      try {
        const res = await apiClient.get('/documents/history');
        setHistoryList(res.data?.data || []);
      } catch (err) {
        // Fallback
      } finally {
        setTabLoading(false);
      }
    }
  }, []);

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setCurrentPage(1);
    loadTabSpecificData(tabKey);
  };

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

  // Grouped documents for repository selected employee
  const repoGroupedDocs = useMemo(() => {
    const groups = {
      'Identity Proof': [],
      'Education Certificate': [],
      'Employment': [],
      'Payroll / Financial': [],
      'Other HR': [],
    };
    repoEmployeeDocs.forEach((doc) => {
      const cat = doc.category || 'Other HR';
      if (groups[cat]) {
        groups[cat].push(doc);
      } else {
        groups['Other HR'].push(doc);
      }
    });
    return groups;
  }, [repoEmployeeDocs]);

  // Open Upload Modal
  const handleOpenUpload = (targetEmployeeId = null) => {
    setError('');
    setSuccess('');
    const defaultOwner = targetEmployeeId || (employees.length > 0 ? employees[0]._id : '');
    setUploadForm({
      owner: defaultOwner,
      name: '',
      category: 'Identity Proof',
      documentType: 'Aadhaar Card',
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
      if (uploadForm.documentType) formData.append('documentType', uploadForm.documentType.trim());
      if (uploadForm.documentNumber) formData.append('documentNumber', uploadForm.documentNumber.trim());
      if (uploadForm.issueDate) formData.append('issueDate', uploadForm.issueDate);
      if (uploadForm.expiryDate) formData.append('expiryDate', uploadForm.expiryDate);
      if (uploadForm.description) formData.append('description', uploadForm.description.trim());
      formData.append('file', uploadForm.file);

      await apiClient.post('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setShowUploadModal(false);
      setSuccess('Document uploaded successfully and queued for verification.');
      await loadDocuments();
      if (activeTab === 'missing') loadTabSpecificData('missing');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload document.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Document In-App Viewer Modal
  const handleOpenViewer = (doc) => {
    setActiveDoc(doc);
    setViewerZoom(1);
    setShowViewerModal(true);
  };

  // Open Document History Timeline Modal
  const handleOpenHistoryModal = (doc) => {
    setActiveDoc(doc);
    setShowHistoryModal(true);
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
      setError('Unable to download the document. Please check permissions.');
    }
  };

  // Verify Document
  const handleVerifyDoc = async (doc) => {
    if (!window.confirm(`Are you sure you want to verify "${doc.name}"?`)) {
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiClient.patch(`/documents/${doc._id}/verify`);
      setSuccess(`Document "${doc.name}" has been marked as Verified.`);
      if (showViewerModal) setShowViewerModal(false);
      await loadDocuments();
      if (activeTab === 'missing') loadTabSpecificData('missing');
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
      if (showViewerModal) setShowViewerModal(false);
      setSuccess(`Document "${activeDoc.name}" was rejected. Rejection reason has been recorded.`);
      await loadDocuments();
      if (activeTab === 'missing') loadTabSpecificData('missing');
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
      category: doc.category || 'Other HR',
      documentType: doc.documentType || '',
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
      if (replaceForm.documentType) formData.append('documentType', replaceForm.documentType.trim());
      if (replaceForm.documentNumber) formData.append('documentNumber', replaceForm.documentNumber.trim());
      if (replaceForm.expiryDate) formData.append('expiryDate', replaceForm.expiryDate);
      if (replaceForm.description) formData.append('description', replaceForm.description.trim());
      formData.append('file', replaceForm.file);

      await apiClient.post(`/documents/${activeDoc._id}/replace`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setShowReplaceModal(false);
      if (showViewerModal) setShowViewerModal(false);
      setSuccess(`Replacement document uploaded as new version. Status reset to Pending verification.`);
      await loadDocuments();
      if (activeTab === 'missing') loadTabSpecificData('missing');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to replace document.');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Archive
  const handleToggleArchive = async (doc) => {
    const actionLabel = doc.isArchived ? 'restore' : 'archive';
    if (!window.confirm(`Are you sure you want to ${actionLabel} "${doc.name}"?`)) return;
    try {
      await apiClient.patch(`/documents/${doc._id}/archive`);
      setSuccess(`Document "${doc.name}" ${doc.isArchived ? 'restored' : 'archived'} successfully.`);
      await loadDocuments();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${actionLabel} document.`);
    }
  };

  // Export CSV
  const handleExportCSV = async () => {
    try {
      const res = await apiClient.get('/documents/export', { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `document_compliance_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
      setSuccess('Document report exported successfully.');
    } catch (err) {
      setError('Unable to export document report.');
    }
  };

  // Create Document Requirement
  const handleSaveRequirement = async (e) => {
    e.preventDefault();
    if (!newReqForm.name.trim()) {
      setError('Requirement name is required.');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post('/documents/requirements', newReqForm);
      setShowRequirementModal(false);
      setNewReqForm({
        name: '',
        category: 'Identity Proof',
        documentType: '',
        isMandatory: true,
        applicableDepartment: 'All',
        description: '',
      });
      setSuccess('Document requirement added successfully.');
      loadTabSpecificData('requirements');
      loadDocuments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add requirement.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Document Requirement
  const handleDeleteRequirement = async (reqId, reqName) => {
    if (!window.confirm(`Delete document requirement "${reqName}"?`)) return;
    try {
      await apiClient.delete(`/documents/requirements/${reqId}`);
      setSuccess(`Requirement "${reqName}" deleted.`);
      loadTabSpecificData('requirements');
      loadDocuments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete requirement.');
    }
  };

  // Clear all filters
  const handleResetFilters = () => {
    setSearch('');
    setSelectedDept('All');
    setSelectedCategory('All');
    setSelectedDocumentType('All');
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
            <h2>Document Management</h2>
            <p>Secure employee document repository, verification workflows, compliance tracking, and audit history.</p>
          </div>
          <div className="doc-header-actions">
            <button type="button" className="doc-secondary-btn" onClick={handleExportCSV} title="Export CSV Report">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Export CSV
            </button>
            <button type="button" className="doc-secondary-btn" onClick={loadDocuments} title="Refresh Records">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              Refresh
            </button>
            <button type="button" className="doc-primary-btn" onClick={() => handleOpenUpload()}>
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
          <div className={`doc-kpi-card blue ${activeTab === 'all' ? 'active-kpi' : ''}`} onClick={() => handleTabChange('all')}>
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
          <div className={`doc-kpi-card amber ${activeTab === 'pending' ? 'active-kpi' : ''}`} onClick={() => handleTabChange('pending')}>
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
          <div className={`doc-kpi-card emerald ${selectedStatus === 'Verified' && activeTab === 'all' ? 'active-kpi' : ''}`} onClick={() => { setSelectedStatus('Verified'); handleTabChange('all'); }}>
            <div className="doc-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className="doc-kpi-body">
              <span className="doc-kpi-label">Verified</span>
              <strong className="doc-kpi-value">{summary.verifiedDocuments}</strong>
              <span className="doc-kpi-sub">Approved &amp; Compliant</span>
            </div>
          </div>

          {/* Card 4: Rejected Documents */}
          <div className={`doc-kpi-card rose ${selectedStatus === 'Rejected' && activeTab === 'all' ? 'active-kpi' : ''}`} onClick={() => { setSelectedStatus('Rejected'); handleTabChange('all'); }}>
            <div className="doc-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div className="doc-kpi-body">
              <span className="doc-kpi-label">Rejected</span>
              <strong className="doc-kpi-value">{summary.rejectedDocuments}</strong>
              <span className="doc-kpi-sub">Needs Re-upload</span>
            </div>
          </div>

          {/* Card 5: Expiring Soon */}
          <div className={`doc-kpi-card orange ${activeTab === 'expiring_soon' ? 'active-kpi' : ''}`} onClick={() => handleTabChange('expiring_soon')}>
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
              <span className="doc-kpi-sub">Within 30 days</span>
            </div>
          </div>

          {/* Card 6: Expired Documents */}
          <div className={`doc-kpi-card red ${activeTab === 'expired' ? 'active-kpi' : ''}`} onClick={() => handleTabChange('expired')}>
            <div className="doc-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="doc-kpi-body">
              <span className="doc-kpi-label">Expired</span>
              <strong className="doc-kpi-value">{summary.expiredDocuments}</strong>
              <span className="doc-kpi-sub">Action required</span>
            </div>
          </div>
        </div>

        {/* ─── 9 Navigation Tabs ─── */}
        <div className="doc-nav-tabs-wrap">
          <div className="doc-nav-tabs">
            <button type="button" className={`doc-tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => handleTabChange('all')}>
              All Documents
              <span className="doc-tab-badge">{summary.totalDocuments}</span>
            </button>
            <button type="button" className={`doc-tab-btn ${activeTab === 'repository' ? 'active' : ''}`} onClick={() => handleTabChange('repository')}>
              Employee Repository
            </button>
            <button type="button" className={`doc-tab-btn ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => handleTabChange('pending')}>
              Pending Verification
              <span className="doc-tab-badge amber">{summary.pendingVerification}</span>
            </button>
            <button type="button" className={`doc-tab-btn ${activeTab === 'expiring_soon' ? 'active' : ''}`} onClick={() => handleTabChange('expiring_soon')}>
              Expiring Soon
              <span className="doc-tab-badge orange">{summary.expiringSoon}</span>
            </button>
            <button type="button" className={`doc-tab-btn ${activeTab === 'expired' ? 'active' : ''}`} onClick={() => handleTabChange('expired')}>
              Expired
              <span className="doc-tab-badge red">{summary.expiredDocuments}</span>
            </button>
            <button type="button" className={`doc-tab-btn ${activeTab === 'missing' ? 'active' : ''}`} onClick={() => handleTabChange('missing')}>
              Missing Documents
            </button>
            <button type="button" className={`doc-tab-btn ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => handleTabChange('categories')}>
              Document Categories
            </button>
            <button type="button" className={`doc-tab-btn ${activeTab === 'requirements' ? 'active' : ''}`} onClick={() => handleTabChange('requirements')}>
              Document Requirements
            </button>
            <button type="button" className={`doc-tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => handleTabChange('history')}>
              Document History
            </button>
          </div>
        </div>

        {/* ─── TAB CONTENT: ALL / PENDING / EXPIRING SOON / EXPIRED ─── */}
        {['all', 'pending', 'expiring_soon', 'expired'].includes(activeTab) && (
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
                  placeholder="Search by ID, Document Name, Employee, or Number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Department Filter (Dynamic from MongoDB) */}
              <select
                className="doc-filter-select"
                value={selectedDept}
                onChange={(e) => { setSelectedDept(e.target.value); setCurrentPage(1); }}
              >
                <option value="All">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>

              {/* Category Filter */}
              <select
                className="doc-filter-select"
                value={selectedCategory}
                onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
              >
                <option value="All">All Categories</option>
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {/* Status Filter (Active on 'all' tab) */}
              {activeTab === 'all' && (
                <select
                  className="doc-filter-select"
                  value={selectedStatus}
                  onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending Verification</option>
                  <option value="Verified">Verified</option>
                  <option value="Rejected">Rejected</option>
                </select>
              )}

              {/* Expiry Filter */}
              {activeTab === 'all' && (
                <select
                  className="doc-filter-select"
                  value={selectedExpiry}
                  onChange={(e) => { setSelectedExpiry(e.target.value); setCurrentPage(1); }}
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
                        <th>Document ID</th>
                        <th>Employee</th>
                        <th>Department</th>
                        <th>Document</th>
                        <th>Category</th>
                        <th>Status</th>
                        <th>Expiry</th>
                        <th>Uploaded Date</th>
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
                        const empId = ownerObj.jobDetails?.employeeId || (ownerObj._id ? `EMP-${String(ownerObj._id).slice(-5).toUpperCase()}` : '—');
                        const dept = ownerObj.jobDetails?.department || ownerObj.department || doc.department || '—';
                        const expiryCls = getExpiryClassification(doc.expiryDate);
                        const docStatusStr = (doc.status || 'Pending').toLowerCase().replace(' ', '-');

                        return (
                          <tr key={doc._id}>
                            {/* Document ID */}
                            <td>
                              <span className="doc-id-badge">{doc.documentId || `DOC-${String(doc._id).slice(-6).toUpperCase()}`}</span>
                              {doc.version > 1 && <span className="doc-version-pill">v{doc.version}</span>}
                            </td>

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
                                {doc.documentType && <span className="doc-type-sub">{doc.documentType}</span>}
                                {doc.documentNumber && <span className="doc-num-sub">#{doc.documentNumber}</span>}
                              </div>
                            </td>

                            {/* Category */}
                            <td>
                              <span className="doc-cat-badge">{doc.category || 'Other HR'}</span>
                            </td>

                            {/* Verification Status */}
                            <td>
                              <span className={`doc-status-pill ${docStatusStr}`}>
                                {doc.status === 'Verified' && '✅ Verified'}
                                {doc.status === 'Rejected' && '❌ Rejected'}
                                {['Pending', 'Pending Verification', 'Under Review', 'Re-upload Required'].includes(doc.status) && '⏳ Pending'}
                              </span>
                            </td>

                            {/* Expiry Date & Classification */}
                            <td>
                              <div className="doc-expiry-cell">
                                <span>{formatDate(doc.expiryDate)}</span>
                                <span className={`doc-expiry-badge ${expiryCls.className}`}>
                                  {expiryCls.label}
                                </span>
                              </div>
                            </td>

                            {/* Uploaded Date */}
                            <td>{formatDate(doc.createdAt)}</td>

                            {/* Contextual Actions */}
                            <td>
                              <div className="doc-actions-wrap">
                                <button type="button" className="doc-btn-sm view" onClick={() => handleOpenViewer(doc)} title="View Document Preview">
                                  View
                                </button>
                                {['Pending', 'Pending Verification', 'Under Review'].includes(doc.status) && (
                                  <>
                                    <button type="button" className="doc-btn-sm verify" onClick={() => handleVerifyDoc(doc)} title="Verify Document">
                                      Verify
                                    </button>
                                    <button type="button" className="doc-btn-sm reject" onClick={() => handleOpenReject(doc)} title="Reject Document">
                                      Reject
                                    </button>
                                  </>
                                )}
                                <button type="button" className="doc-btn-sm download" onClick={() => handleDownload(doc, true)} title="Download File">
                                  Download
                                </button>
                                <button type="button" className="doc-btn-sm replace" onClick={() => handleOpenReplace(doc)} title="Upload Replacement / New Version">
                                  Replace
                                </button>
                                <button type="button" className="doc-btn-sm history" onClick={() => handleOpenHistoryModal(doc)} title="View Version &amp; Audit History">
                                  History
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

              {/* Table Pagination Footer */}
              {paginationMeta.total > pageSize && (
                <div className="doc-pagination-bar">
                  <div className="doc-pagination-info">
                    Showing {Math.min((currentPage - 1) * pageSize + 1, paginationMeta.total)} to{' '}
                    {Math.min(currentPage * pageSize, paginationMeta.total)} of {paginationMeta.total} records
                  </div>
                  <div className="doc-pagination-controls">
                    <button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                      ← Previous
                    </button>
                    <span className="doc-page-indicator">
                      Page {currentPage} of {paginationMeta.totalPages}
                    </span>
                    <button type="button" disabled={currentPage >= paginationMeta.totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── TAB CONTENT: EMPLOYEE REPOSITORY ─── */}
        {activeTab === 'repository' && (
          <div className="doc-repo-workspace">
            {/* Employee Selector Card */}
            <div className="doc-repo-header-card">
              <div className="doc-repo-select-row">
                <label><strong>Select Employee:</strong></label>
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
                <button type="button" className="doc-primary-btn" onClick={() => handleOpenUpload(repoSelectedEmployeeId)}>
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

                  <div className="doc-repo-counters">
                    <div className="doc-counter-col">
                      <span>Total Docs</span>
                      <strong>{repoEmployeeDocs.length}</strong>
                    </div>
                    <div className="doc-counter-col green">
                      <span>Verified</span>
                      <strong>{repoEmployeeDocs.filter((d) => d.status === 'Verified').length}</strong>
                    </div>
                    <div className="doc-counter-col amber">
                      <span>Pending</span>
                      <strong>{repoEmployeeDocs.filter((d) => ['Pending', 'Pending Verification', 'Under Review'].includes(d.status)).length}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Categorized Document Folders */}
            <div className="doc-repo-categories-grid">
              {DOCUMENT_CATEGORIES.map((cat) => {
                const catDocs = repoGroupedDocs[cat] || [];
                return (
                  <div key={cat} className="doc-repo-cat-card">
                    <div className="doc-repo-cat-header">
                      <div>
                        <h4>{cat}</h4>
                        <span className="doc-repo-cat-count">{catDocs.length} file{catDocs.length !== 1 ? 's' : ''}</span>
                      </div>
                      <button
                        type="button"
                        className="doc-mini-btn"
                        onClick={() => {
                          setUploadForm((prev) => ({ ...prev, owner: repoSelectedEmployeeId, category: cat }));
                          setShowUploadModal(true);
                        }}
                      >
                        + Upload
                      </button>
                    </div>

                    {catDocs.length === 0 ? (
                      <div className="doc-cat-empty">No documents in this category.</div>
                    ) : (
                      <ul className="doc-repo-file-list">
                        {catDocs.map((doc) => (
                          <li key={doc._id} className="doc-repo-file-item">
                            <div className="doc-repo-file-info">
                              <span className="doc-repo-file-icon">📄</span>
                              <div>
                                <strong className="doc-repo-file-title">{doc.name}</strong>
                                <span className="doc-repo-file-sub">
                                  {doc.documentId} • {formatDate(doc.createdAt)} • {doc.status}
                                </span>
                              </div>
                            </div>
                            <div className="doc-actions-wrap">
                              <button type="button" className="doc-btn-sm view" onClick={() => handleOpenViewer(doc)}>View</button>
                              <button type="button" className="doc-btn-sm download" onClick={() => handleDownload(doc, true)}>Download</button>
                              <button type="button" className="doc-btn-sm replace" onClick={() => handleOpenReplace(doc)}>Replace</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── TAB CONTENT: MISSING DOCUMENTS ─── */}
        {activeTab === 'missing' && (
          <div className="doc-missing-workspace">
            <div className="doc-missing-header-card">
              <h3>Missing Required Documents Compliance</h3>
              <p>Compares active employees with mandatory company document requirements to identify missing compliance records.</p>
            </div>

            {tabLoading ? (
              <div className="doc-loading-state"><div className="doc-spinner" /><p>Analyzing missing documents...</p></div>
            ) : missingData.length === 0 ? (
              <div className="doc-empty-state"><p>All employees have 100% compliant documents!</p></div>
            ) : (
              <div className="doc-missing-grid">
                {missingData.map((item) => (
                  <div key={item.employee._id} className="doc-missing-card">
                    <div className="doc-missing-card-top">
                      <div>
                        <h4>{item.employee.name}</h4>
                        <span className="doc-emp-meta-sub">{item.employee.employeeId} • {item.employee.department}</span>
                      </div>
                      <div className="doc-compliance-pill" style={{ background: item.compliancePercentage === 100 ? '#ecfdf5' : '#fffbeb', color: item.compliancePercentage === 100 ? '#059669' : '#d97706' }}>
                        {item.compliancePercentage}% Compliance
                      </div>
                    </div>

                    <div className="doc-compliance-bar">
                      <div className="doc-compliance-fill" style={{ width: `${item.compliancePercentage}%`, background: item.compliancePercentage === 100 ? '#10b981' : '#f59e0b' }} />
                    </div>

                    <div className="doc-missing-section">
                      <h5>Required Documents Checklist:</h5>
                      <ul className="doc-req-check-list">
                        {item.fulfilled.map((f, i) => (
                          <li key={i} className="doc-req-check-item fulfilled">
                            <span className="doc-check-icon">✓</span>
                            <span>{f.requirement}</span>
                            <span className="doc-fulfilled-status">({f.status})</span>
                          </li>
                        ))}
                        {item.missing.map((m, i) => (
                          <li key={i} className="doc-req-check-item missing">
                            <span className="doc-cross-icon">✕</span>
                            <span>{m.name}</span>
                            <span className="doc-missing-tag">Missing</span>
                            <button
                              type="button"
                              className="doc-mini-btn"
                              onClick={() => {
                                handleOpenUpload(item.employee._id);
                                setUploadForm((prev) => ({ ...prev, name: m.name, category: m.category }));
                              }}
                            >
                              Upload
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB CONTENT: DOCUMENT CATEGORIES ─── */}
        {activeTab === 'categories' && (
          <div className="doc-categories-workspace">
            <div className="doc-cat-guide-header">
              <h3>Document Classification &amp; Verification Guide</h3>
              <p>Standard enterprise document hierarchy with accepted types and verification policies.</p>
            </div>

            <div className="doc-cat-catalog-grid">
              {DOCUMENT_CATEGORIES.map((cat) => (
                <div key={cat} className="doc-catalog-card">
                  <div className="doc-catalog-header">
                    <h4>{cat}</h4>
                    <span className="doc-catalog-pill">Accepts PDF, JPG, PNG (Max 15MB)</span>
                  </div>
                  <ul className="doc-catalog-types">
                    {(DOCUMENT_TYPES[cat] || []).map((t) => (
                      <li key={t}>
                        <span className="doc-catalog-dot" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="doc-catalog-footer">
                    <span>Verification Required: <strong>Yes</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── TAB CONTENT: DOCUMENT REQUIREMENTS ─── */}
        {activeTab === 'requirements' && (
          <div className="doc-requirements-workspace">
            <div className="doc-req-header-row">
              <div>
                <h3>Mandatory Document Requirements</h3>
                <p>Define which document types are mandatory for company employees.</p>
              </div>
              <button type="button" className="doc-primary-btn" onClick={() => setShowRequirementModal(true)}>
                + Add Requirement
              </button>
            </div>

            {tabLoading ? (
              <div className="doc-loading-state"><div className="doc-spinner" /><p>Loading requirements...</p></div>
            ) : requirements.length === 0 ? (
              <div className="doc-empty-state"><p>No requirements configured yet.</p></div>
            ) : (
              <div className="doc-table-card">
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>Requirement Name</th>
                      <th>Category</th>
                      <th>Applicable Department</th>
                      <th>Status</th>
                      <th>Created By</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requirements.map((req) => (
                      <tr key={req._id}>
                        <td><strong>{req.name}</strong></td>
                        <td><span className="doc-cat-badge">{req.category}</span></td>
                        <td><span className="doc-dept-pill">{req.applicableDepartment}</span></td>
                        <td><span className="doc-status-pill verified">{req.isMandatory ? 'Mandatory' : 'Optional'}</span></td>
                        <td>{req.createdByName || 'System'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button type="button" className="doc-btn-sm reject" onClick={() => handleDeleteRequirement(req._id, req.name)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB CONTENT: DOCUMENT HISTORY ─── */}
        {activeTab === 'history' && (
          <div className="doc-history-workspace">
            <div className="doc-history-header">
              <h3>Global Document Audit Trail</h3>
              <p>Immutable audit log recording uploads, verifications, rejections, replacements, and secure downloads.</p>
            </div>

            {tabLoading ? (
              <div className="doc-loading-state"><div className="doc-spinner" /><p>Loading audit trail...</p></div>
            ) : historyList.length === 0 ? (
              <div className="doc-empty-state"><p>No document activity has been recorded yet.</p></div>
            ) : (
              <div className="doc-table-card">
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>Date &amp; Time</th>
                      <th>Performed By</th>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Action</th>
                      <th>Details / Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyList.map((aud) => (
                      <tr key={aud._id}>
                        <td>{new Date(aud.date || aud.createdAt).toLocaleString()}</td>
                        <td><strong>{aud.performedByName || 'System'}</strong></td>
                        <td>{aud.employeeName}</td>
                        <td><span className="doc-dept-pill">{aud.department || '—'}</span></td>
                        <td>
                          <span className={`doc-action-pill ${aud.action.toLowerCase()}`}>
                            {aud.action}
                          </span>
                        </td>
                        <td>{aud.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── MODAL 1: UPLOAD DOCUMENT ─── */}
        {showUploadModal && (
          <div className="doc-modal-overlay">
            <div className="doc-modal-card">
              <div className="doc-modal-header">
                <h3>Upload Employee Document</h3>
                <button type="button" className="doc-modal-close" onClick={() => setShowUploadModal(false)}>✕</button>
              </div>

              <form onSubmit={handleSaveUpload} className="doc-modal-form">
                {/* Employee Selector */}
                <div className="doc-form-group">
                  <label>Assigned Employee <span className="req">*</span></label>
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

                {/* Auto-filled Department */}
                {selectedUploadEmployee && (
                  <div className="doc-form-row">
                    <div className="doc-form-group">
                      <label>Department</label>
                      <input type="text" className="doc-input readonly" readOnly value={selectedUploadEmployee.jobDetails?.department || selectedUploadEmployee.department || 'General'} />
                    </div>
                    <div className="doc-form-group">
                      <label>Designation</label>
                      <input type="text" className="doc-input readonly" readOnly value={selectedUploadEmployee.designation || selectedUploadEmployee.jobDetails?.designation || 'Staff'} />
                    </div>
                  </div>
                )}

                {/* Category & Document Type */}
                <div className="doc-form-row">
                  <div className="doc-form-group">
                    <label>Document Category <span className="req">*</span></label>
                    <select
                      className="doc-input"
                      value={uploadForm.category}
                      onChange={(e) => {
                        const newCat = e.target.value;
                        const defaultType = DOCUMENT_TYPES[newCat]?.[0] || 'Other';
                        setUploadForm({ ...uploadForm, category: newCat, documentType: defaultType });
                      }}
                      required
                    >
                      {DOCUMENT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="doc-form-group">
                    <label>Document Type</label>
                    <select
                      className="doc-input"
                      value={uploadForm.documentType}
                      onChange={(e) => setUploadForm({ ...uploadForm, documentType: e.target.value })}
                    >
                      {(DOCUMENT_TYPES[uploadForm.category] || []).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Name & Document Number */}
                <div className="doc-form-row">
                  <div className="doc-form-group">
                    <label>Document Name <span className="req">*</span></label>
                    <input
                      type="text"
                      className="doc-input"
                      placeholder="e.g. Rahul Sharma PAN Card"
                      value={uploadForm.name}
                      onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="doc-form-group">
                    <label>Document ID / Number (Optional)</label>
                    <input
                      type="text"
                      className="doc-input"
                      placeholder="e.g. ABCDE1234F"
                      value={uploadForm.documentNumber}
                      onChange={(e) => setUploadForm({ ...uploadForm, documentNumber: e.target.value })}
                    />
                  </div>
                </div>

                {/* Issue Date & Expiry Date */}
                <div className="doc-form-row">
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

                {/* File Upload Drag & Drop */}
                <div className="doc-form-group">
                  <label>Document Attachment <span className="req">*</span></label>
                  <div className="doc-file-dropzone">
                    <input
                      type="file"
                      id="doc-upload-input"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp"
                      onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files[0] })}
                      required
                    />
                    <label htmlFor="doc-upload-input" className="doc-file-label">
                      {uploadForm.file ? (
                        <span>📁 {uploadForm.file.name} ({formatFileSize(uploadForm.file.size)})</span>
                      ) : (
                        <span>Click or Drag &amp; Drop Document File (PDF, DOCX, JPG, PNG up to 15MB)</span>
                      )}
                    </label>
                  </div>
                </div>

                {/* Description */}
                <div className="doc-form-group">
                  <label>Remarks / Notes</label>
                  <textarea
                    className="doc-textarea"
                    rows="2"
                    placeholder="Add any internal verification remarks or details..."
                    value={uploadForm.description}
                    onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  />
                </div>

                <div className="doc-modal-actions">
                  <button type="button" className="doc-secondary-btn" onClick={() => setShowUploadModal(false)}>Cancel</button>
                  <button type="submit" className="doc-primary-btn" disabled={submitting}>
                    {submitting ? 'Uploading...' : 'Save & Upload'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL 2: IN-APP DOCUMENT VIEWER ─── */}
        {showViewerModal && activeDoc && (
          <div className="doc-modal-overlay">
            <div className="doc-modal-card doc-viewer-modal">
              <div className="doc-modal-header">
                <div className="doc-viewer-meta">
                  <h3>{activeDoc.name}</h3>
                  <span className="doc-viewer-sub">{activeDoc.documentId} • {activeDoc.category} • Version {activeDoc.version || 1}</span>
                </div>
                <div className="doc-viewer-controls">
                  <button type="button" className="doc-control-btn" onClick={() => setViewerZoom((z) => Math.max(0.5, z - 0.25))} title="Zoom Out">-</button>
                  <span className="doc-zoom-text">{Math.round(viewerZoom * 100)}%</span>
                  <button type="button" className="doc-control-btn" onClick={() => setViewerZoom((z) => Math.min(2.5, z + 0.25))} title="Zoom In">+</button>
                  <button type="button" className="doc-secondary-btn" onClick={() => handleDownload(activeDoc, true)} title="Download File">Download</button>
                  {['Pending', 'Pending Verification', 'Under Review'].includes(activeDoc.status) && (
                    <>
                      <button type="button" className="doc-primary-btn" onClick={() => handleVerifyDoc(activeDoc)}>Verify</button>
                      <button type="button" className="doc-danger-btn" onClick={() => handleOpenReject(activeDoc)}>Reject</button>
                    </>
                  )}
                  <button type="button" className="doc-modal-close" onClick={() => setShowViewerModal(false)}>✕</button>
                </div>
              </div>

              <div className="doc-viewer-body">
                {activeDoc.mimeType?.includes('pdf') ? (
                  <iframe
                    src={`/api/documents/${activeDoc._id}/content`}
                    title={activeDoc.name}
                    className="doc-pdf-frame"
                    style={{ transform: `scale(${viewerZoom})`, transformOrigin: 'top center' }}
                  />
                ) : activeDoc.mimeType?.includes('image') ? (
                  <div className="doc-image-wrap">
                    <img
                      src={`/api/documents/${activeDoc._id}/content`}
                      alt={activeDoc.name}
                      style={{ transform: `scale(${viewerZoom})`, transformOrigin: 'center center' }}
                    />
                  </div>
                ) : (
                  <div className="doc-generic-preview">
                    <div className="doc-file-big-icon">📄</div>
                    <h4>{activeDoc.name}</h4>
                    <p>Format: {activeDoc.mimeType} ({formatFileSize(activeDoc.size)})</p>
                    <button type="button" className="doc-primary-btn" onClick={() => handleDownload(activeDoc, true)}>
                      Download to View File
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL 3: REJECT DOCUMENT ─── */}
        {showRejectModal && activeDoc && (
          <div className="doc-modal-overlay">
            <div className="doc-modal-card">
              <div className="doc-modal-header">
                <h3>Reject Document: {activeDoc.name}</h3>
                <button type="button" className="doc-modal-close" onClick={() => setShowRejectModal(false)}>✕</button>
              </div>
              <form onSubmit={handleSaveReject} className="doc-modal-form">
                <div className="doc-form-group">
                  <label>Rejection Reason <span className="req">*</span></label>
                  <textarea
                    className="doc-textarea"
                    rows="4"
                    placeholder="e.g. Document copy is blurred / illegible. Please upload a clear color scan."
                    value={rejectionReasonInput}
                    onChange={(e) => setRejectionReasonInput(e.target.value)}
                    required
                  />
                </div>
                <div className="doc-modal-actions">
                  <button type="button" className="doc-secondary-btn" onClick={() => setShowRejectModal(false)}>Cancel</button>
                  <button type="submit" className="doc-danger-btn" disabled={submitting}>
                    {submitting ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL 4: REPLACE DOCUMENT ─── */}
        {showReplaceModal && activeDoc && (
          <div className="doc-modal-overlay">
            <div className="doc-modal-card">
              <div className="doc-modal-header">
                <h3>Replace / Re-upload Document (Version {(activeDoc.version || 1) + 1})</h3>
                <button type="button" className="doc-modal-close" onClick={() => setShowReplaceModal(false)}>✕</button>
              </div>
              <form onSubmit={handleSaveReplace} className="doc-modal-form">
                <div className="doc-form-group">
                  <label>Document Name <span className="req">*</span></label>
                  <input
                    type="text"
                    className="doc-input"
                    value={replaceForm.name}
                    onChange={(e) => setReplaceForm({ ...replaceForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="doc-form-group">
                  <label>Replacement File <span className="req">*</span></label>
                  <div className="doc-file-dropzone">
                    <input
                      type="file"
                      id="doc-replace-file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp"
                      onChange={(e) => setReplaceForm({ ...replaceForm, file: e.target.files[0] })}
                      required
                    />
                    <label htmlFor="doc-replace-file" className="doc-file-label">
                      {replaceForm.file ? (
                        <span>📁 {replaceForm.file.name} ({formatFileSize(replaceForm.file.size)})</span>
                      ) : (
                        <span>Click to Select New File Version</span>
                      )}
                    </label>
                  </div>
                </div>
                <div className="doc-modal-actions">
                  <button type="button" className="doc-secondary-btn" onClick={() => setShowReplaceModal(false)}>Cancel</button>
                  <button type="submit" className="doc-primary-btn" disabled={submitting}>
                    {submitting ? 'Uploading...' : 'Save New Version'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL 5: DOCUMENT AUDIT & VERSION TIMELINE ─── */}
        {showHistoryModal && activeDoc && (
          <div className="doc-modal-overlay">
            <div className="doc-modal-card">
              <div className="doc-modal-header">
                <h3>History &amp; Audit: {activeDoc.name}</h3>
                <button type="button" className="doc-modal-close" onClick={() => setShowHistoryModal(false)}>✕</button>
              </div>
              <div className="doc-modal-body">
                <div className="doc-history-summary">
                  <p><strong>Document ID:</strong> {activeDoc.documentId}</p>
                  <p><strong>Current Version:</strong> v{activeDoc.version || 1}</p>
                  <p><strong>Status:</strong> {activeDoc.status}</p>
                </div>

                <div className="doc-timeline-wrap">
                  {(activeDoc.history || []).length === 0 ? (
                    <p className="doc-empty-state">No audit timeline recorded.</p>
                  ) : (
                    <ul className="doc-timeline">
                      {activeDoc.history.map((h, i) => (
                        <li key={i} className="doc-timeline-item">
                          <div className="doc-timeline-dot" />
                          <div className="doc-timeline-content">
                            <span className="doc-timeline-action">{h.action} (v{h.version || 1})</span>
                            <span className="doc-timeline-user">By {h.performedByName || 'User'} on {new Date(h.timestamp).toLocaleString()}</span>
                            {h.details && <p className="doc-timeline-details">{h.details}</p>}
                            {h.rejectionReason && <p className="doc-timeline-rejection">Reason: {h.rejectionReason}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL 6: ADD DOCUMENT REQUIREMENT ─── */}
        {showRequirementModal && (
          <div className="doc-modal-overlay">
            <div className="doc-modal-card">
              <div className="doc-modal-header">
                <h3>Add Mandatory Document Requirement</h3>
                <button type="button" className="doc-modal-close" onClick={() => setShowRequirementModal(false)}>✕</button>
              </div>
              <form onSubmit={handleSaveRequirement} className="doc-modal-form">
                <div className="doc-form-group">
                  <label>Requirement Name <span className="req">*</span></label>
                  <input
                    type="text"
                    className="doc-input"
                    placeholder="e.g. Passport or Police Verification"
                    value={newReqForm.name}
                    onChange={(e) => setNewReqForm({ ...newReqForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="doc-form-row">
                  <div className="doc-form-group">
                    <label>Category</label>
                    <select
                      className="doc-input"
                      value={newReqForm.category}
                      onChange={(e) => setNewReqForm({ ...newReqForm, category: e.target.value })}
                    >
                      {DOCUMENT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="doc-form-group">
                    <label>Applicable Department</label>
                    <select
                      className="doc-input"
                      value={newReqForm.applicableDepartment}
                      onChange={(e) => setNewReqForm({ ...newReqForm, applicableDepartment: e.target.value })}
                    >
                      <option value="All">All Departments</option>
                      {departments.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="doc-modal-actions">
                  <button type="button" className="doc-secondary-btn" onClick={() => setShowRequirementModal(false)}>Cancel</button>
                  <button type="submit" className="doc-primary-btn" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Add Requirement'}
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
