import React, { useState, useEffect, useMemo, useContext, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import apiClient from '../../../../../services/apiClient';
import { AppContext } from '../../../../../context/AppContext';
import UserLayout from '../components/UserLayout';
import HRAccessManagement from '../AccessManagement/HRAccessManagement';
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

const formatCurrency = (val) => {
  const num = Number(val);
  if (isNaN(num) || num === null || num === undefined) return '—';
  return `₹${num.toLocaleString('en-IN')}`;
};

const OFFICIAL_DEPARTMENTS = ['HR', 'Finance', 'Business Development', 'Digital Marketing', 'Video Editor', 'Tech'];

export default function ResignationExit() {
  const { user } = useContext(AppContext);
  const location = useLocation();
  const isHrOrAdmin = ['admin', 'super_admin'].includes(user?.role) || user?.department === 'HR';

  const [resignations, setResignations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState({
    pendingResignations: 0,
    underReview: 0,
    approved: 0,
    servingNotice: 0,
    activeOffboarding: 0,
    pendingClearance: 0,
    settlementDue: 0,
    exitThisMonth: 0,
    exitCompleted: 0,
    total: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 9 Workflow Tabs: 'onboarding' | 'requests' | 'notice' | 'offboarding' | 'clearance' | 'interview' | 'settlement' | 'history' | 'access'
  const [activeTab, setActiveTab] = useState('onboarding');
  const [accessSearch, setAccessSearch] = useState('');

  // ── Onboarding System State (DYNAMIC & ATLAS BACKED) ─────────────────
  const [onboardingList, setOnboardingList] = useState([]);
  const [onboardingSummary, setOnboardingSummary] = useState({
    total: 0,
    scheduled: 0,
    inProgress: 0,
    docsPending: 0,
    assetsPending: 0,
    accessPending: 0,
    completed: 0,
    joiningThisWeek: 0,
  });
  const [eligibleEmployees, setEligibleEmployees] = useState([]);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingSearch, setOnboardingSearch] = useState('');
  const [onboardingDeptFilter, setOnboardingDeptFilter] = useState('All');
  const [onboardingStatusFilter, setOnboardingStatusFilter] = useState('All');
  const [showStartOnboardingModal, setShowStartOnboardingModal] = useState(false);
  const [showOnboardingDrawer, setShowOnboardingDrawer] = useState(false);
  const [selectedOnboarding, setSelectedOnboarding] = useState(null);
  const [onboardingDetailData, setOnboardingDetailData] = useState(null);
  const [onboardingInnerTab, setOnboardingInnerTab] = useState('checklist');
  const [checklistUpdateLoading, setChecklistUpdateLoading] = useState(false);
  const [startOnboardingForm, setStartOnboardingForm] = useState({
    employeeId: '',
    candidateId: '',
    joiningDate: new Date().toISOString().slice(0, 10),
    employmentType: 'Full Time',
    designation: '',
    department: 'Tech',
    reportingManager: '',
    workLocation: 'Head Office / Hybrid',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: 'Spouse',
    notes: '',
  });

  // ── Employee Lifecycle Details Modal State ───────────────────────────
  const [showLifecycleModal, setShowLifecycleModal] = useState(false);
  const [lifecycleRecord, setLifecycleRecord] = useState(null);
  const [lifecycleActiveStageIndex, setLifecycleActiveStageIndex] = useState(0);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [lifecycleDetailData, setLifecycleDetailData] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Dedicated Tab Modal Controller: null | 'resignation_detail' | 'notice_detail' | 'offboarding_detail' | 'clearance_detail' | 'interview_detail' | 'settlement_detail' | 'history_detail'
  const [activeModalType, setActiveModalType] = useState(null);

  // Central Offboarding Modal / Drawer
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailInnerTab, setDetailInnerTab] = useState('overview'); // overview, notice, documents, assets, access, clearance, interview, settlement, timeline
  const [offboardingLoading, setOffboardingLoading] = useState(false);
  const [offboardingData, setOffboardingData] = useState(null);

  // Other Modals
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCompleteExitModal, setShowCompleteExitModal] = useState(false);
  const [showEmployeeSubmitModal, setShowEmployeeSubmitModal] = useState(false);
  const [showAddResignationModal, setShowAddResignationModal] = useState(false);
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [showScheduleInterviewModal, setShowScheduleInterviewModal] = useState(false);

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Tab 2 Notice Period Management Form
  const [noticeManageForm, setNoticeManageForm] = useState({
    resignationDate: '',
    approvedLastWorkingDay: '',
    noticePeriodDays: 30,
    noticeStatus: 'Active',
    earlyReleaseStatus: 'None',
    earlyReleaseDate: '',
    waiverDays: 0,
    waiverRemarks: '',
  });

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

  // Terminate Employee form (Strictly Preserved Existing Functionality)
  const [terminateForm, setTerminateForm] = useState({
    userId: '',
    effectiveDate: new Date().toISOString().slice(0, 10),
    terminationReason: 'Performance Issues',
    comments: '',
  });

  // Access Management form inside Detail Modal
  const [accessForm, setAccessForm] = useState({
    crmAccess: 'Active',
    emailAccess: 'Active',
    notes: '',
    restrictedModules: [],
  });

  // Exit Interview form
  const [interviewForm, setInterviewForm] = useState({
    status: 'Completed',
    scheduledDate: '',
    interviewerName: '',
    reasonForLeaving: '',
    managementFeedback: '',
    suggestions: '',
    rehireEligibility: 'Eligible',
    hrComments: '',
  });

  // Final Settlement form
  const [settlementActionForm, setSettlementActionForm] = useState({
    settlementAmount: 0,
    status: 'Completed',
    remarks: '',
  });

  // Load live data from MongoDB Atlas
  const loadData = useCallback(async () => {
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
          approved: records.filter((r) => r.status === 'Approved').length,
          servingNotice: records.filter((r) => ['Approved', 'Notice Period', 'Offboarding', 'Exit Clearance'].includes(r.status)).length,
          activeOffboarding: records.filter((r) => r.status === 'Offboarding' || r.offboarding?.status === 'In Progress').length,
          pendingClearance: records.filter((r) => {
            if (['Rejected', 'Completed'].includes(r.status)) return false;
            const clr = r.clearance || {};
            return clr.hr?.status !== 'Completed' || clr.manager?.status !== 'Completed' || clr.finance?.status !== 'Completed' || clr.itAssets?.status !== 'Completed';
          }).length,
          settlementDue: records.filter((r) => {
            if (['Rejected', 'Completed'].includes(r.status)) return false;
            return r.clearance?.finance?.settlementStatus !== 'Completed';
          }).length,
          exitThisMonth: records.filter((r) => {
            if (r.status === 'Rejected') return false;
            const target = r.approvedLastWorkingDay ? new Date(r.approvedLastWorkingDay) : new Date(r.proposedLastWorkingDay);
            return target && target.getMonth() === currentMonth && target.getFullYear() === currentYear;
          }).length,
          exitCompleted: records.filter((r) => r.status === 'Completed').length,
          total: records.length,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load resignation records from database.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOnboardingData = useCallback(async () => {
    setOnboardingLoading(true);
    try {
      const params = {};
      if (onboardingDeptFilter !== 'All') params.department = onboardingDeptFilter;
      if (onboardingStatusFilter !== 'All') params.status = onboardingStatusFilter;
      if (onboardingSearch && onboardingSearch.trim()) params.search = onboardingSearch.trim();

      const [listRes, sumRes] = await Promise.all([
        apiClient.get('/onboarding', { params }),
        apiClient.get('/onboarding/summary').catch(() => ({ data: { data: {} } })),
      ]);
      setOnboardingList(listRes.data?.data || []);
      if (sumRes.data?.data) {
        setOnboardingSummary(sumRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load onboarding data:', err);
    } finally {
      setOnboardingLoading(false);
    }
  }, [onboardingDeptFilter, onboardingStatusFilter, onboardingSearch]);

  const loadEligibleEmployees = async () => {
    try {
      const res = await apiClient.get('/onboarding/eligible-employees');
      setEligibleEmployees(res.data?.data?.all || []);
    } catch (err) {
      console.error('Failed to load eligible employees:', err);
    }
  };

  useEffect(() => {
    loadData();
    loadOnboardingData();
  }, [loadData, loadOnboardingData]);

  useEffect(() => {
    if (activeTab === 'onboarding') {
      loadOnboardingData();
    }
  }, [activeTab, loadOnboardingData]);

  const handleOpenStartOnboarding = async () => {
    await loadEligibleEmployees();
    setStartOnboardingForm({
      employeeId: '',
      candidateId: '',
      joiningDate: new Date().toISOString().slice(0, 10),
      employmentType: 'Full Time',
      designation: '',
      department: 'Tech',
      reportingManager: '',
      workLocation: 'Head Office / Hybrid',
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelation: 'Spouse',
      notes: '',
    });
    setShowStartOnboardingModal(true);
  };

  const handleCreateOnboarding = async (e) => {
    e.preventDefault();
    if (!startOnboardingForm.employeeId && !startOnboardingForm.candidateId) {
      setError('Please select an employee or candidate to onboard.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post('/onboarding', {
        employeeId: startOnboardingForm.employeeId || undefined,
        candidateId: startOnboardingForm.candidateId || undefined,
        joiningDate: startOnboardingForm.joiningDate,
        employmentType: startOnboardingForm.employmentType,
        designation: startOnboardingForm.designation,
        department: startOnboardingForm.department,
        reportingManager: startOnboardingForm.reportingManager,
        workLocation: startOnboardingForm.workLocation,
        emergencyContact: {
          name: startOnboardingForm.emergencyContactName,
          phone: startOnboardingForm.emergencyContactPhone,
          relation: startOnboardingForm.emergencyContactRelation,
        },
        notes: startOnboardingForm.notes,
      });
      setShowStartOnboardingModal(false);
      setSuccess('Employee onboarding profile created with 17-item checklist!');
      await loadOnboardingData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to initialize onboarding.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenOnboardingDetail = async (record) => {
    setSelectedOnboarding(record);
    setOnboardingInnerTab('checklist');
    setShowOnboardingDrawer(true);
    try {
      const res = await apiClient.get(`/onboarding/${record._id}`);
      setOnboardingDetailData(res.data?.data || null);
    } catch (err) {
      console.error('Failed to load onboarding detail:', err);
    }
  };

  const handleToggleChecklistItem = async (itemId, currentStatus) => {
    if (!selectedOnboarding) return;
    const nextStatus = currentStatus === 'Completed' ? 'Pending' : currentStatus === 'In Progress' ? 'Completed' : 'Completed';
    setChecklistUpdateLoading(true);
    try {
      const res = await apiClient.patch(`/onboarding/${selectedOnboarding._id}/checklist/${itemId}`, {
        status: nextStatus,
        completedAt: nextStatus === 'Completed' ? new Date() : undefined,
      });
      if (res.data?.data) {
        setSelectedOnboarding(res.data.data);
        const detailRes = await apiClient.get(`/onboarding/${selectedOnboarding._id}`);
        setOnboardingDetailData(detailRes.data?.data || null);
        loadOnboardingData();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update checklist item.');
    } finally {
      setChecklistUpdateLoading(false);
    }
  };

  const handleCompleteOnboarding = async (onboardingId) => {
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post(`/onboarding/${onboardingId}/complete`);
      setSuccess('Onboarding completed successfully! Employee status updated to Active.');
      setShowOnboardingDrawer(false);
      await loadOnboardingData();
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete onboarding.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenLifecycle = async (record) => {
    setLifecycleRecord(record);
    setShowLifecycleModal(true);
    setLifecycleLoading(true);
    setLifecycleDetailData(null);
    try {
      const empId = record.employee?._id || record.employeeId?._id || record.user?._id || record.userId?._id || record.userId || record._id;
      const [uRes, onbRes, resRes] = await Promise.all([
        apiClient.get(`/users/${empId}`).catch(() => null),
        apiClient.get('/onboarding', { params: { employeeId: empId } }).catch(() => null),
        apiClient.get('/resignation', { params: { search: record.employee?.email || record.user?.email || '' } }).catch(() => null),
      ]);
      const userObj = uRes?.data?.data || record.employee || record.user || {};
      const onbObj = onbRes?.data?.data?.[0] || null;
      const resObj = resRes?.data?.data?.[0] || (record.resignationDate ? record : null);

      let activeIndex = 1;
      if (onbObj && onbObj.status !== 'Completed') {
        activeIndex = 0;
      } else if (resObj) {
        if (resObj.status === 'Completed') activeIndex = 8;
        else if (resObj.clearance?.finance?.settlementStatus === 'Completed') activeIndex = 7;
        else if (resObj.exitInterview?.status === 'Completed') activeIndex = 6;
        else if (resObj.status === 'Exit Clearance') activeIndex = 5;
        else if (resObj.status === 'Offboarding') activeIndex = 4;
        else if (resObj.status === 'Approved' || resObj.noticeStatus === 'Active') activeIndex = 3;
        else if (['Submitted', 'Under Review'].includes(resObj.status)) activeIndex = 2;
      }
      setLifecycleActiveStageIndex(activeIndex);
      setLifecycleDetailData({
        user: userObj,
        onboarding: onbObj,
        resignation: resObj,
      });
    } catch (err) {
      console.error('Failed to load lifecycle:', err);
    } finally {
      setLifecycleLoading(false);
    }
  };

  // Load comprehensive offboarding details for Central Offboarding View
  const loadOffboardingDetails = async (recordId, targetTab = null) => {
    setOffboardingLoading(true);
    try {
      const res = await apiClient.get(`/resignation/${recordId}/offboarding-details`);
      const data = res.data?.data || null;
      setOffboardingData(data);
      if (data?.resignation) {
        setSelectedRecord(data.resignation);
        setAccessForm({
          crmAccess: data.resignation.accessManagement?.crmAccess || 'Active',
          emailAccess: data.resignation.accessManagement?.emailAccess || 'Active',
          notes: data.resignation.accessManagement?.notes || '',
          restrictedModules: data.resignation.accessManagement?.restrictedModules || ['crm', 'projects', 'finance', 'leads', 'clients', 'reports'],
        });
        if (data.resignation.exitInterview) {
          setInterviewForm({
            status: data.resignation.exitInterview.status || 'Completed',
            scheduledDate: data.resignation.exitInterview.scheduledDate ? new Date(data.resignation.exitInterview.scheduledDate).toISOString().slice(0, 10) : '',
            interviewerName: data.resignation.exitInterview.interviewerName || '',
            reasonForLeaving: data.resignation.exitInterview.reasonForLeaving || '',
            managementFeedback: data.resignation.exitInterview.managementFeedback || '',
            suggestions: data.resignation.exitInterview.suggestions || '',
            rehireEligibility: data.resignation.exitInterview.rehireEligibility || 'Eligible',
            hrComments: data.resignation.exitInterview.hrComments || '',
          });
        }
        if (data.settlement) {
          setSettlementActionForm({
            settlementAmount: data.settlement.netPayable || 0,
            status: data.settlement.status || 'Completed',
            remarks: '',
          });
        }
      }
      if (targetTab) {
        setDetailInnerTab(targetTab);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load offboarding details.');
    } finally {
      setOffboardingLoading(false);
    }
  };

  // Close any active modal and reset record state
  const handleCloseModal = () => {
    setActiveModalType(null);
    setShowDetailModal(false);
    setSelectedRecord(null);
    setOffboardingData(null);
  };

  // Pick up query params (?tab= / ?search=) from navigation
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['onboarding', 'requests', 'notice', 'offboarding', 'clearance', 'interview', 'settlement', 'history', 'access'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    const searchParam = params.get('search');
    if (searchParam) {
      setAccessSearch(searchParam);
    }
  }, [location.search]);

  // Navigate directly to Tab 8: Access Management (optionally pre-filtered by employee email)
  const handleGoToAccessTab = (searchTerm = '') => {
    setAccessSearch(searchTerm);
    setActiveTab('access');
    setShowDetailModal(false);
    setActiveModalType(null);
  };

  // Switch tabs and clean up state to prevent cross-tab contamination
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setActiveModalType(null);
    setShowDetailModal(false);
    setSelectedRecord(null);
    setOffboardingData(null);
    setShowApproveModal(false);
    setShowRejectModal(false);
    setShowCompleteExitModal(false);
    setError('');
    setSuccess('');
    if (newTab !== 'access') {
      setAccessSearch('');
    }
  };

  // Tab 1: Resignation Requests Detail Handler
  const handleOpenResignationDetail = (record) => {
    setSelectedRecord(record);
    setActiveModalType('resignation_detail');
  };

  // Tab 2: Notice Period Detail & Management Handler
  const handleOpenNoticeDetail = (record) => {
    setSelectedRecord(record);
    const lwd = record.approvedLastWorkingDay || record.proposedLastWorkingDay;
    setNoticeManageForm({
      resignationDate: record.resignationDate ? new Date(record.resignationDate).toISOString().slice(0, 10) : '',
      approvedLastWorkingDay: lwd ? new Date(lwd).toISOString().slice(0, 10) : '',
      noticePeriodDays: record.noticePeriodDays || 30,
      noticeStatus: record.noticeStatus || 'Active',
      earlyReleaseStatus: record.earlyReleaseStatus || 'None',
      earlyReleaseDate: record.earlyReleaseDate ? new Date(record.earlyReleaseDate).toISOString().slice(0, 10) : '',
      waiverDays: record.waiverDays || 0,
      waiverRemarks: record.waiverRemarks || '',
    });
    setActiveModalType('notice_detail');
  };

  // Save Notice Period Management
  const handleSaveNoticeManage = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setSubmitting(true);
    setError('');
    try {
      await apiClient.patch(`/resignation/${selectedRecord._id}/notice-period`, noticeManageForm);
      setSuccess('Notice period details successfully saved to MongoDB Atlas.');
      handleCloseModal();
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update notice period.');
    } finally {
      setSubmitting(false);
    }
  };

  // Tab 3: Offboarding Central Detail Handler
  const handleOpenOffboardingDetail = (record) => {
    setSelectedRecord(record);
    setDetailInnerTab('overview');
    setActiveModalType('offboarding_detail');
    loadOffboardingDetails(record._id, 'overview');
  };

  // Tab 4: Exit Clearance Detail Handler
  const handleOpenClearanceDetail = (record) => {
    setSelectedRecord(record);
    setActiveModalType('clearance_detail');
    loadOffboardingDetails(record._id, 'clearance');
  };

  // Tab 5: Exit Interview Detail Handler
  const handleOpenInterviewDetail = (record) => {
    setSelectedRecord(record);
    const interview = record.exitInterview || {};
    setInterviewForm({
      status: interview.status || 'Scheduled',
      scheduledDate: interview.scheduledDate
        ? new Date(interview.scheduledDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      interviewerName: interview.interviewerName || (user?.personalInfo?.fullName || user?.email || ''),
      reasonForLeaving: interview.reasonForLeaving || record.reason || '',
      managementFeedback: interview.managementFeedback || '',
      suggestions: interview.suggestions || '',
      rehireEligibility: interview.rehireEligibility || 'Eligible',
      hrComments: interview.hrComments || '',
    });
    setActiveModalType('interview_detail');
    loadOffboardingDetails(record._id, 'interview');
  };

  // Tab 6: Final Settlement Detail Handler
  const handleOpenSettlementDetail = (record) => {
    setSelectedRecord(record);
    setActiveModalType('settlement_detail');
    loadOffboardingDetails(record._id, 'settlement');
  };

  // Tab 7: Exit History & Audit Detail Handler
  const handleOpenHistoryDetail = (record) => {
    setSelectedRecord(record);
    setActiveModalType('history_detail');
    loadOffboardingDetails(record._id, 'timeline');
  };

  // Open Central Offboarding Modal (backwards compatible)
  const handleOpenDetail = (record, initialInnerTab = 'overview') => {
    setSelectedRecord(record);
    setDetailInnerTab(initialInnerTab);
    setShowDetailModal(true);
    loadOffboardingDetails(record._id, initialInnerTab);
  };

  // Filtered records for Tab 1: Requests
  const requestRecords = useMemo(() => {
    return resignations.filter((r) => {
      if (r.status === 'Completed') return false;
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

  // Tab 2: Notice Period Records
  const noticePeriodRecords = useMemo(() => {
    return resignations.filter((r) => ['Approved', 'Notice Period', 'Offboarding', 'Exit Clearance'].includes(r.status));
  }, [resignations]);

  // Tab 3: Offboarding Records
  const offboardingRecords = useMemo(() => {
    return resignations.filter((r) => ['Offboarding', 'Exit Clearance', 'Notice Period'].includes(r.status));
  }, [resignations]);

  // Tab 5: Exit Interview Records
  const interviewRecords = useMemo(() => {
    return resignations.filter((r) => ['Notice Period', 'Offboarding', 'Exit Clearance', 'Completed'].includes(r.status));
  }, [resignations]);

  // Tab 7: Exit History (Completed & Terminated)
  const completedRecords = useMemo(() => {
    return resignations.filter((r) => r.status === 'Completed' || r.status === 'Rejected');
  }, [resignations]);

  // Quick Action Handlers
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

  // Strictly Preserved: handleOpenTerminate
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
        await loadOffboardingDetails(selectedRecord._id);
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
        await loadOffboardingDetails(selectedRecord._id);
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
        await loadOffboardingDetails(record._id);
      }
    } catch (err) {
      setError('Failed to mark as Under Review.');
    }
  };

  const handleStartOffboarding = async (recordId) => {
    try {
      await apiClient.patch(`/resignation/${recordId}/start-offboarding`, { notes: 'Offboarding workflow initiated by HR' });
      setSuccess('Offboarding workflow started successfully.');
      await loadData();
      if (showDetailModal && selectedRecord?._id === recordId) {
        await loadOffboardingDetails(recordId);
      }
    } catch (err) {
      setError('Failed to initiate offboarding.');
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
      if (showDetailModal && selectedRecord?._id === recordId) {
        await loadOffboardingDetails(recordId);
      }
    } catch (err) {
      setError('Failed to update clearance status.');
    }
  };

  // Real Access Revocation & Modification
  const handleSaveAccess = async (crmAccessState) => {
    if (!selectedRecord) return;
    setSubmitting(true);
    setError('');
    try {
      await apiClient.patch(`/resignation/${selectedRecord._id}/access`, {
        crmAccess: crmAccessState,
        emailAccess: crmAccessState === 'Revoked' ? 'Revoked' : 'Active',
        notes: accessForm.notes || `Access updated to ${crmAccessState} by HR`,
        restrictedModules: crmAccessState === 'Restricted' ? ['crm', 'projects', 'finance', 'leads', 'clients', 'reports'] : [],
      });
      setSuccess(`Employee access successfully updated to ${crmAccessState}.`);
      await loadData();
      await loadOffboardingDetails(selectedRecord._id);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update access management.');
    } finally {
      setSubmitting(false);
    }
  };

  // Exit Interview Save
  const handleSaveExitInterview = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post(`/resignation/${selectedRecord._id}/exit-interview`, interviewForm);
      setShowScheduleInterviewModal(false);
      setSuccess('Exit interview details saved successfully.');
      await loadData();
      if (showDetailModal) {
        await loadOffboardingDetails(selectedRecord._id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save exit interview.');
    } finally {
      setSubmitting(false);
    }
  };

  // Finalize Settlement
  const handleFinalizeSettlement = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post(`/resignation/${selectedRecord._id}/finalize-settlement`, {
        settlementAmount: settlementActionForm.settlementAmount,
        status: 'Completed',
        remarks: settlementActionForm.remarks || 'Full and final settlement approved and paid',
      });
      setSuccess('Final settlement processed and saved to database.');
      await loadData();
      if (showDetailModal) {
        await loadOffboardingDetails(selectedRecord._id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to finalize settlement.');
    } finally {
      setSubmitting(false);
    }
  };

  // Complete Full Exit
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

  // Handle Terminate Employee (Strictly Preserved Existing Functionality)
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
    <UserLayout pageTitle="Resignation & Exit Management">
      <div className="exit-container">
        {/* Header with Title and Preserved Actions */}
        <div className="exit-header">
          <div className="exit-title-area">
            <h2>Resignation & Exit Management</h2>
            <p>End-to-end offboarding workflows, notice tracking, asset & document clearance, exit interviews, and final settlements.</p>
          </div>
          <div className="exit-header-actions">
            {isHrOrAdmin ? (
              <>
                {/* Onboarding Start Button */}
                <button
                  type="button"
                  className="exit-primary-btn"
                  onClick={handleOpenStartOnboarding}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '15px', height: '15px' }}>
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                  Start Onboarding
                </button>

                {/* STRICTLY PRESERVED: EXISTING TERMINATION BUTTON */}
                <button
                  type="button"
                  className="exit-secondary-btn"
                  onClick={handleOpenTerminate}
                  style={{ color: '#DC2626', borderColor: '#FECACA' }}
                >
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

        {/* Dynamic Contextual KPI Strip */}
        {activeTab === 'onboarding' ? (
          <div className="exit-kpi-grid" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            <div className="exit-kpi-card accent">
              <span className="exit-kpi-label">Total Onboarding</span>
              <strong className="exit-kpi-value">{onboardingSummary.total || onboardingList.length}</strong>
              <span className="exit-kpi-subtext">All Initialized</span>
            </div>
            <div className="exit-kpi-card">
              <span className="exit-kpi-label">In Progress</span>
              <strong className="exit-kpi-value" style={{ color: '#0284C7' }}>{onboardingSummary.inProgress || 0}</strong>
              <span className="exit-kpi-subtext">Checklist Active</span>
            </div>
            <div className="exit-kpi-card">
              <span className="exit-kpi-label">Joining This Week</span>
              <strong className="exit-kpi-value" style={{ color: '#EA580C' }}>{onboardingSummary.joiningThisWeek || 0}</strong>
              <span className="exit-kpi-subtext">Immediate Joiners</span>
            </div>
            <div className="exit-kpi-card">
              <span className="exit-kpi-label">Docs Pending</span>
              <strong className="exit-kpi-value" style={{ color: '#D97706' }}>{onboardingSummary.docsPending || 0}</strong>
              <span className="exit-kpi-subtext">Verification Awaited</span>
            </div>
            <div className="exit-kpi-card">
              <span className="exit-kpi-label">Assets Pending</span>
              <strong className="exit-kpi-value" style={{ color: '#7C3AED' }}>{onboardingSummary.assetsPending || 0}</strong>
              <span className="exit-kpi-subtext">IT Allocation</span>
            </div>
            <div className="exit-kpi-card">
              <span className="exit-kpi-label">Access Pending</span>
              <strong className="exit-kpi-value" style={{ color: '#DC2626' }}>{onboardingSummary.accessPending || 0}</strong>
              <span className="exit-kpi-subtext">Credentials Setup</span>
            </div>
            <div className="exit-kpi-card">
              <span className="exit-kpi-label">Completed</span>
              <strong className="exit-kpi-value" style={{ color: '#16A34A' }}>{onboardingSummary.completed || 0}</strong>
              <span className="exit-kpi-subtext">Activated Employees</span>
            </div>
          </div>
        ) : (
          <div className="exit-kpi-grid">
            <div className="exit-kpi-card accent">
              <span className="exit-kpi-label">Pending Requests</span>
              <strong className="exit-kpi-value">{summary.pendingResignations}</strong>
              <span className="exit-kpi-subtext">Awaiting HR Review</span>
            </div>
            <div className="exit-kpi-card">
              <span className="exit-kpi-label">Notice Period</span>
              <strong className="exit-kpi-value">{summary.servingNotice}</strong>
              <span className="exit-kpi-subtext">Active Notice Period</span>
            </div>
            <div className="exit-kpi-card">
              <span className="exit-kpi-label">Offboarding</span>
              <strong className="exit-kpi-value">{summary.activeOffboarding}</strong>
              <span className="exit-kpi-subtext">In Active Transition</span>
            </div>
            <div className="exit-kpi-card">
              <span className="exit-kpi-label">Pending Clearance</span>
              <strong className="exit-kpi-value">{summary.pendingClearance}</strong>
              <span className="exit-kpi-subtext">Dues &amp; Assets Check</span>
            </div>
            <div className="exit-kpi-card">
              <span className="exit-kpi-label">Exits This Month</span>
              <strong className="exit-kpi-value">{summary.exitThisMonth}</strong>
              <span className="exit-kpi-subtext">Scheduled Releases</span>
            </div>
            <div className="exit-kpi-card">
              <span className="exit-kpi-label">Completed Exits</span>
              <strong className="exit-kpi-value">{summary.exitCompleted}</strong>
              <span className="exit-kpi-subtext">Archived Workforce</span>
            </div>
          </div>
        )}

        {/* Dynamic Alerts */}
        {error && <div className="exit-alert-error">{error}</div>}
        {success && <div className="exit-alert-success">{success}</div>}

        {/* 9 Workflow Navigation Tabs (One Row) */}
        <div className="exit-nav-tabs-wrap">
          <div className="exit-nav-tabs">
            <button
              type="button"
              className={`exit-tab-btn ${activeTab === 'onboarding' ? 'active' : ''}`}
              onClick={() => handleTabChange('onboarding')}
            >
              Onboarding ({onboardingSummary.total || onboardingList.length})
            </button>
            <button
              type="button"
              className={`exit-tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => handleTabChange('requests')}
            >
              Resignation Requests ({resignations.filter((r) => r.status !== 'Completed').length})
            </button>
            <button
              type="button"
              className={`exit-tab-btn ${activeTab === 'notice' ? 'active' : ''}`}
              onClick={() => handleTabChange('notice')}
            >
              Notice Period ({noticePeriodRecords.length})
            </button>
            <button
              type="button"
              className={`exit-tab-btn ${activeTab === 'offboarding' ? 'active' : ''}`}
              onClick={() => handleTabChange('offboarding')}
            >
              Offboarding ({offboardingRecords.length})
            </button>
            <button
              type="button"
              className={`exit-tab-btn ${activeTab === 'clearance' ? 'active' : ''}`}
              onClick={() => handleTabChange('clearance')}
            >
              Exit Clearance
            </button>
            <button
              type="button"
              className={`exit-tab-btn ${activeTab === 'interview' ? 'active' : ''}`}
              onClick={() => handleTabChange('interview')}
            >
              Exit Interview ({interviewRecords.length})
            </button>
            <button
              type="button"
              className={`exit-tab-btn ${activeTab === 'settlement' ? 'active' : ''}`}
              onClick={() => handleTabChange('settlement')}
            >
              Final Settlement
            </button>
            <button
              type="button"
              className={`exit-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => handleTabChange('history')}
            >
              Exit History ({completedRecords.length})
            </button>
            <button
              type="button"
              className={`exit-tab-btn ${activeTab === 'access' ? 'active' : ''}`}
              onClick={() => handleTabChange('access')}
            >
              Access Management
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            TAB 0: ONBOARDING MANAGEMENT
            ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'onboarding' && (
          <div>
            <div className="exit-toolbar">
              <div className="exit-search-wrap">
                <svg className="exit-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search onboarding by employee, code, or designation..."
                  className="exit-search-input"
                  value={onboardingSearch}
                  onChange={(e) => setOnboardingSearch(e.target.value)}
                />
              </div>

              <div className="exit-filter-group">
                <label>Department:</label>
                <select
                  className="exit-filter-select"
                  value={onboardingDeptFilter}
                  onChange={(e) => setOnboardingDeptFilter(e.target.value)}
                >
                  <option value="All">All Departments</option>
                  {OFFICIAL_DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="exit-filter-group">
                <label>Status:</label>
                <select
                  className="exit-filter-select"
                  value={onboardingStatusFilter}
                  onChange={(e) => setOnboardingStatusFilter(e.target.value)}
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>

            <div className="exit-table-card">
              {onboardingLoading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading onboarding records...</div>
              ) : onboardingList.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  No onboarding records found. Click <strong>+ Start Onboarding</strong> to onboard a new employee or candidate.
                </div>
              ) : (
                <div className="exit-table-wrap">
                  <table className="exit-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Role &amp; Department</th>
                        <th>Joining Date</th>
                        <th>17-Item Checklist Progress</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {onboardingList.map((onb) => {
                        const empName = onb.employee ? `${onb.employee.firstName || ''} ${onb.employee.lastName || ''}`.trim() || onb.employee.email : onb.candidate?.name || 'Employee';
                        const empEmail = onb.employee?.email || onb.candidate?.email || '';
                        const empCode = onb.employeeId || onb.employee?.jobDetails?.employeeId || '—';
                        const totalTasks = onb.checklist?.length || 17;
                        const completedTasks = onb.checklist?.filter((t) => t.status === 'Completed').length || 0;
                        const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                        return (
                          <tr key={onb._id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                <div style={{
                                  width: '34px', height: '34px', borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #DBEAFE, #93C5FD)',
                                  color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontWeight: 700, fontSize: '0.85rem'
                                }}>
                                  {(empName || 'E').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <strong>{empName}</strong>
                                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>
                                    {empCode} &bull; {empEmail}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div>{onb.designation || 'Associate'}</div>
                              <span className="hr-emp-dept-pill">{onb.department || 'Tech'}</span>
                            </td>
                            <td>
                              <div>{formatDate(onb.joiningDate)}</div>
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{onb.employmentType || 'Full Time'}</span>
                            </td>
                            <td style={{ minWidth: '180px' }}>
                              <div className="exit-progress-wrapper">
                                <div className="exit-progress-text">
                                  <span>{completedTasks} of {totalTasks} Tasks</span>
                                  <span>{pct}%</span>
                                </div>
                                <div className="exit-progress-track">
                                  <div
                                    className={`exit-progress-fill ${pct === 100 ? 'completed' : ''}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className={`exit-badge ${onb.status === 'Completed' ? 'completed' : onb.status === 'In Progress' ? 'under_review' : 'submitted'}`}>
                                {onb.status}
                              </span>
                            </td>
                            <td>
                              <div className="exit-actions-wrap" style={{ gap: '0.35rem' }}>
                                <button
                                  type="button"
                                  className="exit-btn-sm view"
                                  onClick={() => handleOpenOnboardingDetail(onb)}
                                >
                                  Checklist &amp; Details
                                </button>
                                <button
                                  type="button"
                                  className="exit-btn-sm interview"
                                  title="View Full Lifecycle Progression"
                                  onClick={() => handleOpenLifecycle(onb)}
                                >
                                  Lifecycle
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
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB 1: RESIGNATION REQUESTS
            ═══════════════════════════════════════════════════════════════ */}
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
                  placeholder="Search by employee name, email, or employee ID..."
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
                <option value="Offboarding">Offboarding</option>
                <option value="Exit Clearance">Exit Clearance</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div className="exit-table-card">
              {loading ? (
                <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>Loading records from MongoDB Atlas...</div>
              ) : requestRecords.length === 0 ? (
                <div className="exit-empty-box" style={{ margin: '2rem' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '40px', height: '40px', color: '#94a3b8' }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <h4 style={{ margin: '0.75rem 0 0.25rem 0', color: '#0f172a' }}>No Resignation Requests Found</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>There are currently no active resignation requests matching your filters.</p>
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
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requestRecords.map((r) => {
                        const name = r.user?.personalInfo?.fullName || [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') || r.user?.email || 'Employee';
                        const dept = r.user?.jobDetails?.department || r.user?.department || 'General';
                        const lwd = r.approvedLastWorkingDay || r.proposedLastWorkingDay;

                        return (
                          <tr key={r._id}>
                            <td>
                              <strong>{name}</strong>
                              <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>
                                {r.user?.jobDetails?.employeeId ? `${r.user.jobDetails.employeeId} • ` : ''}{r.user?.email}
                              </span>
                            </td>
                            <td><span className="hr-emp-dept-pill">{dept}</span></td>
                            <td>{formatDate(r.resignationDate)}</td>
                            <td><strong>{formatDate(lwd)}</strong></td>
                            <td style={{ maxWidth: '220px' }}>
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
                                <button type="button" className="exit-btn-sm view" onClick={() => handleOpenResignationDetail(r)}>
                                  View Details
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

        {/* ═══════════════════════════════════════════════════════════════
            TAB 2: NOTICE PERIOD
            ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'notice' && (
          <div className="exit-table-card">
            {noticePeriodRecords.length === 0 ? (
              <div className="exit-empty-box" style={{ margin: '2rem' }}>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#0f172a' }}>No Employees Currently Serving Notice</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Approved resignations serving official notice periods will appear here.</p>
              </div>
            ) : (
              <div className="exit-table-wrap">
                <table className="exit-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Notice Service</th>
                      <th>Last Working Day</th>
                      <th>Days Remaining</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noticePeriodRecords.map((r) => {
                      const name = r.user?.personalInfo?.fullName || [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') || r.user?.email;
                      const lwd = r.approvedLastWorkingDay || r.proposedLastWorkingDay;
                      const diffMs = new Date(lwd).getTime() - Date.now();
                      const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
                      const totalDays = r.noticePeriodDays || 30;
                      const progressPct = Math.min(100, Math.max(0, Math.round(((totalDays - daysLeft) / totalDays) * 100)));

                      return (
                        <tr key={r._id}>
                          <td>
                            <strong>{name}</strong>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>{r.user?.email}</span>
                          </td>
                          <td><span className="hr-emp-dept-pill">{r.user?.department || 'General'}</span></td>
                          <td style={{ minWidth: '150px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginBottom: '3px' }}>
                              <span>{progressPct}% served</span>
                              <span>{totalDays}d total</span>
                            </div>
                            <div className="exit-meter-bar">
                              <div className="exit-meter-fill" style={{ width: `${progressPct}%` }} />
                            </div>
                          </td>
                          <td><strong>{formatDate(lwd)}</strong></td>
                          <td>
                            <strong style={{ color: daysLeft <= 7 ? '#DC2626' : daysLeft <= 15 ? '#EA580C' : '#16A34A' }}>
                              {daysLeft} days
                            </strong>
                          </td>
                          <td>
                            <span className={`exit-badge ${r.status.toLowerCase().replace(' ', '_')}`}>
                              {r.status}
                            </span>
                          </td>
                          <td>
                            <div className="exit-actions-wrap">
                              <button type="button" className="exit-btn-sm view" onClick={() => handleOpenNoticeDetail(r)}>
                                Manage Notice
                              </button>
                              {isHrOrAdmin && r.status !== 'Offboarding' && (
                                <button type="button" className="exit-btn-sm complete" onClick={() => handleStartOffboarding(r._id)}>
                                  Start Offboarding
                                </button>
                              )}
                              {isHrOrAdmin && (
                                <button type="button" className="exit-btn-sm review" onClick={() => handleOpenNoticeDetail(r)}>
                                  Adjust LWD
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
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB 3: OFFBOARDING WORKFLOW TRACKER
            ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'offboarding' && (
          <div className="exit-table-card">
            {offboardingRecords.length === 0 ? (
              <div className="exit-empty-box" style={{ margin: '2rem' }}>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#0f172a' }}>No Active Offboarding Cases</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Employees undergoing offboarding, transition, and clearance will be tracked here.</p>
              </div>
            ) : (
              <div className="exit-table-wrap">
                <table className="exit-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Target Release Date</th>
                      <th>Offboarding Phase</th>
                      <th>Clearance Progress</th>
                      <th>System Access</th>
                      <th>Interview</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offboardingRecords.map((r) => {
                      const name = r.user?.personalInfo?.fullName || [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') || r.user?.email;
                      const lwd = r.approvedLastWorkingDay || r.proposedLastWorkingDay;
                      const clr = r.clearance || {};
                      const clearedCount = ['hr', 'manager', 'finance', 'itAssets', 'knowledgeTransfer'].filter(k => clr[k]?.status === 'Completed').length;
                      const accessState = r.accessManagement?.crmAccess || 'Active';
                      const interviewDone = r.exitInterview?.status === 'Completed';

                      return (
                        <tr key={r._id}>
                          <td>
                            <strong>{name}</strong>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>{r.user?.department || 'General'}</span>
                          </td>
                          <td><strong>{formatDate(lwd)}</strong></td>
                          <td>
                            <span className={`exit-badge ${r.status === 'Offboarding' ? 'exit_clearance' : 'notice_period'}`}>
                              {r.status}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <strong style={{ color: clearedCount === 5 ? '#16A34A' : '#EA580C' }}>{clearedCount}/5 Cleared</strong>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({Math.round((clearedCount / 5) * 100)}%)</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                              <span className={`exit-badge ${accessState === 'Revoked' ? 'rejected' : accessState === 'Restricted' ? 'submitted' : 'approved'}`}>
                                {accessState}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleGoToAccessTab(r.user?.email || '')}
                                style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.72rem', color: '#2563eb', textDecoration: 'none', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
                              >
                                Manage Access &rarr;
                              </button>
                            </div>
                          </td>
                          <td>
                            <span className={`exit-badge ${interviewDone ? 'approved' : 'submitted'}`}>
                              {interviewDone ? '✓ Conducted' : 'Pending'}
                            </span>
                          </td>
                          <td>
                            <div className="exit-actions-wrap">
                              <button type="button" className="exit-btn-sm view" onClick={() => handleOpenOffboardingDetail(r)}>
                                Offboarding Details
                              </button>
                              {isHrOrAdmin && clearedCount === 5 && (
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
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB 4: EXIT CLEARANCE
            ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'clearance' && (
          <div className="exit-table-card">
            {noticePeriodRecords.length === 0 ? (
              <div className="exit-empty-box" style={{ margin: '2rem' }}>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#0f172a' }}>No Employees Requiring Clearance</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Departmental clearance workflows will appear here once resignations are approved.</p>
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
                      <th>IT & Assets</th>
                      <th>Knowledge Transfer</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noticePeriodRecords.map((r) => {
                      const name = r.user?.personalInfo?.fullName || [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') || r.user?.email;
                      const clr = r.clearance || {};
                      const allCleared = ['hr', 'manager', 'finance', 'itAssets', 'knowledgeTransfer'].every(k => clr[k]?.status === 'Completed');

                      return (
                        <tr key={r._id}>
                          <td>
                            <strong>{name}</strong>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>{r.user?.department || 'General'}</span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`exit-btn-sm ${clr.hr?.status === 'Completed' ? 'approve' : 'view'}`}
                              onClick={() => isHrOrAdmin && handleUpdateClearance(r._id, 'hr', clr.hr?.status === 'Completed' ? 'Pending' : 'Completed')}
                            >
                              {clr.hr?.status === 'Completed' ? '✓ Done' : 'Pending'}
                            </button>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`exit-btn-sm ${clr.manager?.status === 'Completed' ? 'approve' : 'view'}`}
                              onClick={() => isHrOrAdmin && handleUpdateClearance(r._id, 'manager', clr.manager?.status === 'Completed' ? 'Pending' : 'Completed')}
                            >
                              {clr.manager?.status === 'Completed' ? '✓ Done' : 'Pending'}
                            </button>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`exit-btn-sm ${clr.finance?.status === 'Completed' ? 'approve' : 'view'}`}
                              onClick={() => isHrOrAdmin && handleUpdateClearance(r._id, 'finance', clr.finance?.status === 'Completed' ? 'Pending' : 'Completed')}
                            >
                              {clr.finance?.status === 'Completed' ? '✓ Done' : 'Pending'}
                            </button>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`exit-btn-sm ${clr.itAssets?.status === 'Completed' ? 'approve' : 'view'}`}
                              onClick={() => isHrOrAdmin && handleUpdateClearance(r._id, 'itAssets', clr.itAssets?.status === 'Completed' ? 'Pending' : 'Completed')}
                            >
                              {clr.itAssets?.status === 'Completed' ? '✓ Done' : 'Pending'}
                            </button>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`exit-btn-sm ${clr.knowledgeTransfer?.status === 'Completed' ? 'approve' : 'view'}`}
                              onClick={() => isHrOrAdmin && handleUpdateClearance(r._id, 'knowledgeTransfer', clr.knowledgeTransfer?.status === 'Completed' ? 'Pending' : 'Completed')}
                            >
                              {clr.knowledgeTransfer?.status === 'Completed' ? '✓ Done' : 'Pending'}
                            </button>
                          </td>
                          <td>
                            <div className="exit-actions-wrap">
                              <button type="button" className="exit-btn-sm view" onClick={() => handleOpenClearanceDetail(r)}>
                                Clearance Details
                              </button>
                              {isHrOrAdmin && allCleared && (
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
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB 5: EXIT INTERVIEW
            ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'interview' && (
          <div className="exit-table-card">
            {interviewRecords.length === 0 ? (
              <div className="exit-empty-box" style={{ margin: '2rem' }}>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#0f172a' }}>No Exit Interviews Scheduled</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Employees in transition and exit clearance will appear here for structured exit interviews.</p>
              </div>
            ) : (
              <div className="exit-table-wrap">
                <table className="exit-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Interview Status</th>
                      <th>Scheduled / Conducted Date</th>
                      <th>Rehire Eligibility</th>
                      <th>Primary Reason</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interviewRecords.map((r) => {
                      const name = r.user?.personalInfo?.fullName || [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') || r.user?.email;
                      const int = r.exitInterview || {};
                      const isDone = int.status === 'Completed';

                      return (
                        <tr key={r._id}>
                          <td>
                            <strong>{name}</strong>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>{r.user?.email}</span>
                          </td>
                          <td><span className="hr-emp-dept-pill">{r.user?.department || 'General'}</span></td>
                          <td>
                            <span className={`exit-badge ${isDone ? 'approved' : int.status === 'Scheduled' ? 'notice_period' : 'submitted'}`}>
                              {int.status || 'Pending'}
                            </span>
                          </td>
                          <td>{formatDate(int.submittedAt || int.scheduledDate)}</td>
                          <td>
                            <span className={`exit-badge ${int.rehireEligibility === 'Eligible' ? 'approved' : int.rehireEligibility === 'Not Eligible' ? 'rejected' : 'completed'}`}>
                              {int.rehireEligibility || 'Pending'}
                            </span>
                          </td>
                          <td style={{ maxWidth: '200px' }}>
                            <span style={{ display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {int.reasonForLeaving || r.reason || '—'}
                            </span>
                          </td>
                          <td>
                            <div className="exit-actions-wrap">
                              <button
                                type="button"
                                className="exit-btn-sm view"
                                onClick={() => handleOpenInterviewDetail(r)}
                              >
                                View Details
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
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB 6: FINAL SETTLEMENT (REAL PAYROLL / F&F DATA)
            ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'settlement' && (
          <div className="exit-table-card">
            {noticePeriodRecords.length === 0 ? (
              <div className="exit-empty-box" style={{ margin: '2rem' }}>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#0f172a' }}>No Employees Pending Final Settlement</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Real payroll settlement figures and calculations will be rendered here for offboarding employees.</p>
              </div>
            ) : (
              <div className="exit-table-wrap">
                <table className="exit-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Last Working Day</th>
                      <th>Basic Salary</th>
                      <th>Net Settlement Amount</th>
                      <th>Settlement Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noticePeriodRecords.map((r) => {
                      const name = r.user?.personalInfo?.fullName || [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') || r.user?.email;
                      const fin = r.clearance?.finance || {};
                      const basicSal = r.user?.salaryDetails?.basicSalary;
                      const netPayable = r.finalSettlement?.netPayable || fin.settlementAmount;

                      return (
                        <tr key={r._id}>
                          <td>
                            <strong>{name}</strong>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>{r.user?.email}</span>
                          </td>
                          <td>{formatDate(r.approvedLastWorkingDay || r.proposedLastWorkingDay)}</td>
                          <td>{basicSal ? formatCurrency(basicSal) : <span style={{ color: '#94a3b8' }}>Data not available</span>}</td>
                          <td>
                            <strong>
                              {netPayable !== undefined && netPayable !== null && netPayable > 0
                                ? formatCurrency(netPayable)
                                : <span style={{ color: '#94a3b8' }}>Pending calculation</span>}
                            </strong>
                          </td>
                          <td>
                            <span className={`exit-badge ${fin.settlementStatus === 'Completed' ? 'approved' : 'submitted'}`}>
                              {fin.settlementStatus || 'Pending'}
                            </span>
                          </td>
                          <td>
                            <div className="exit-actions-wrap">
                              <button type="button" className="exit-btn-sm view" onClick={() => handleOpenSettlementDetail(r)}>
                                View F&F Breakdown
                              </button>
                              {isHrOrAdmin && fin.settlementStatus !== 'Completed' && (
                                <button
                                  type="button"
                                  className="exit-btn-sm approve"
                                  onClick={() => handleOpenSettlementDetail(r)}
                                >
                                  Finalize Settlement
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
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB 7: EXIT HISTORY (ARCHIVED RECORDS)
            ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <div className="exit-table-card">
            {completedRecords.length === 0 ? (
              <div className="exit-empty-box" style={{ margin: '2rem' }}>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#0f172a' }}>No Archived Exit Records</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Completed employee exits and historical records safely preserved in MongoDB Atlas will appear here.</p>
              </div>
            ) : (
              <div className="exit-table-wrap">
                <table className="exit-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Resignation Date</th>
                      <th>Official Exit Date</th>
                      <th>Separation Status</th>
                      <th>System Access</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedRecords.map((r) => {
                      const name = r.user?.personalInfo?.fullName || [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') || r.user?.email;
                      const accessState = r.accessManagement?.crmAccess || (r.status === 'Completed' ? 'Revoked' : 'Active');

                      return (
                        <tr key={r._id}>
                          <td>
                            <strong>{name}</strong>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>{r.user?.email}</span>
                          </td>
                          <td><span className="hr-emp-dept-pill">{r.user?.department || 'General'}</span></td>
                          <td>{formatDate(r.resignationDate)}</td>
                          <td>{formatDate(r.exitCompletedAt || r.updatedAt)}</td>
                          <td>
                            <span className={`exit-badge ${r.status.toLowerCase().replace(' ', '_')}`}>
                              {r.status}
                            </span>
                          </td>
                          <td>
                            <span className={`exit-badge ${accessState === 'Revoked' ? 'rejected' : accessState === 'Restricted' ? 'submitted' : 'approved'}`}>
                              {accessState}
                            </span>
                          </td>
                          <td>
                            <button type="button" className="exit-btn-sm view" onClick={() => handleOpenHistoryDetail(r)}>
                              View History & Audit
                            </button>
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

        {/* ═══════════════════════════════════════════════════════════════
            TAB 8: ACCESS MANAGEMENT (CENTRALIZED RBAC & PERMISSIONS)
            ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'access' && (
          <HRAccessManagement embedded={true} initialSearch={accessSearch} />
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB 1: DEDICATED RESIGNATION DETAILS MODAL
            ═══════════════════════════════════════════════════════════════ */}
        {activeModalType === 'resignation_detail' && selectedRecord && (
          <div className="exit-modal-overlay" onClick={handleCloseModal}>
            <div className="exit-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
              <div className="exit-dialog-header">
                <div className="exit-dialog-header-info">
                  <div className="exit-emp-avatar">
                    {(selectedRecord.user?.personalInfo?.fullName?.[0] || selectedRecord.user?.firstName?.[0] || 'E').toUpperCase()}
                  </div>
                  <div>
                    <h3>{selectedRecord.user?.personalInfo?.fullName || [selectedRecord.user?.firstName, selectedRecord.user?.lastName].filter(Boolean).join(' ') || selectedRecord.user?.email}</h3>
                    <p className="exit-dialog-subtext">
                      {selectedRecord.user?.jobDetails?.employeeId ? `ID: ${selectedRecord.user.jobDetails.employeeId} • ` : ''}
                      {selectedRecord.user?.jobDetails?.department || selectedRecord.user?.department || 'General'} • {selectedRecord.user?.jobDetails?.designation || selectedRecord.user?.designation || 'Staff'}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className={`exit-badge ${selectedRecord.status.toLowerCase().replace(' ', '_')}`}>{selectedRecord.status}</span>
                  <button type="button" className="exit-dialog-close" onClick={handleCloseModal}>&times;</button>
                </div>
              </div>
              <div className="exit-dialog-body">
                <div className="exit-section-card">
                  <h4 className="exit-card-title">Resignation Request Summary</h4>
                  <div className="exit-grid-2col">
                    <div className="exit-info-item">
                      <span className="exit-item-label">Resignation Date</span>
                      <strong className="exit-item-val">{formatDate(selectedRecord.resignationDate)}</strong>
                    </div>
                    <div className="exit-info-item">
                      <span className="exit-item-label">Proposed Last Working Day</span>
                      <strong className="exit-item-val">{formatDate(selectedRecord.proposedLastWorkingDay)}</strong>
                    </div>
                    <div className="exit-info-item">
                      <span className="exit-item-label">Approved Last Working Day</span>
                      <strong className="exit-item-val">{selectedRecord.approvedLastWorkingDay ? formatDate(selectedRecord.approvedLastWorkingDay) : 'Pending approval'}</strong>
                    </div>
                    <div className="exit-info-item">
                      <span className="exit-item-label">Notice Period Required</span>
                      <strong className="exit-item-val">{selectedRecord.noticePeriodDays || 30} days</strong>
                    </div>
                    <div className="exit-info-item full">
                      <span className="exit-item-label">Reason for Resignation</span>
                      <p className="exit-item-text">{selectedRecord.reason || '—'}</p>
                    </div>
                    {selectedRecord.employeeComments && (
                      <div className="exit-info-item full">
                        <span className="exit-item-label">Employee Comments / Handover Plan</span>
                        <p className="exit-item-text">{selectedRecord.employeeComments}</p>
                      </div>
                    )}
                    {selectedRecord.hrRemarks && (
                      <div className="exit-info-item full">
                        <span className="exit-item-label">HR Remarks</span>
                        <p className="exit-item-text" style={{ color: '#0f172a', fontWeight: '500' }}>{selectedRecord.hrRemarks}</p>
                      </div>
                    )}
                    {selectedRecord.rejectionReason && (
                      <div className="exit-info-item full">
                        <span className="exit-item-label" style={{ color: '#DC2626' }}>Rejection Reason</span>
                        <p className="exit-item-text" style={{ color: '#DC2626' }}>{selectedRecord.rejectionReason}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="exit-dialog-footer">
                <button type="button" className="exit-secondary-btn" onClick={handleCloseModal}>Close</button>
                {isHrOrAdmin && selectedRecord.status === 'Submitted' && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="exit-btn-sm review" onClick={() => { handleMarkReview(selectedRecord); handleCloseModal(); }}>Mark Review</button>
                    <button type="button" className="exit-btn-sm approve" onClick={() => { handleOpenApprove(selectedRecord); }}>Approve</button>
                    <button type="button" className="exit-btn-sm reject" onClick={() => { handleOpenReject(selectedRecord); }}>Reject</button>
                  </div>
                )}
                {isHrOrAdmin && selectedRecord.status === 'Under Review' && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="exit-btn-sm approve" onClick={() => { handleOpenApprove(selectedRecord); }}>Approve</button>
                    <button type="button" className="exit-btn-sm reject" onClick={() => { handleOpenReject(selectedRecord); }}>Reject</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB 2: DEDICATED NOTICE PERIOD MANAGEMENT MODAL
            ═══════════════════════════════════════════════════════════════ */}
        {activeModalType === 'notice_detail' && selectedRecord && (
          <div className="exit-modal-overlay" onClick={handleCloseModal}>
            <div className="exit-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
              <div className="exit-dialog-header">
                <div className="exit-dialog-header-info">
                  <div className="exit-emp-avatar">
                    {(selectedRecord.user?.personalInfo?.fullName?.[0] || selectedRecord.user?.firstName?.[0] || 'E').toUpperCase()}
                  </div>
                  <div>
                    <h3>Manage Notice Period — {selectedRecord.user?.personalInfo?.fullName || [selectedRecord.user?.firstName, selectedRecord.user?.lastName].filter(Boolean).join(' ') || selectedRecord.user?.email}</h3>
                    <p className="exit-dialog-subtext">
                      {selectedRecord.user?.jobDetails?.employeeId ? `ID: ${selectedRecord.user.jobDetails.employeeId} • ` : ''}
                      {selectedRecord.user?.jobDetails?.department || selectedRecord.user?.department || 'General'}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className={`exit-badge ${selectedRecord.status.toLowerCase().replace(' ', '_')}`}>{selectedRecord.status}</span>
                  <button type="button" className="exit-dialog-close" onClick={handleCloseModal}>&times;</button>
                </div>
              </div>
              <form onSubmit={handleSaveNoticeManage}>
                <div className="exit-dialog-body">
                  {(() => {
                    const lwd = noticeManageForm.approvedLastWorkingDay || selectedRecord.approvedLastWorkingDay || selectedRecord.proposedLastWorkingDay;
                    const diffMs = new Date(lwd).getTime() - Date.now();
                    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
                    const totalDays = Number(noticeManageForm.noticePeriodDays) || 30;
                    const progressPct = Math.min(100, Math.max(0, Math.round(((totalDays - daysRemaining) / totalDays) * 100)));

                    return (
                      <div className="exit-notice-progress-box" style={{ marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>Notice Period Progress</span>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}><strong>{progressPct}%</strong> served ({Math.max(0, totalDays - daysRemaining)}/{totalDays} days)</span>
                        </div>
                        <div className="exit-meter-bar" style={{ height: '8px' }}>
                          <div className="exit-meter-fill" style={{ width: `${progressPct}%` }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                          <span>Resignation: {formatDate(selectedRecord.resignationDate)}</span>
                          <strong style={{ color: daysRemaining <= 7 ? '#DC2626' : '#16A34A' }}>{daysRemaining} days remaining</strong>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="hr-form-grid">
                    <div className="hr-form-group">
                      <label>Approved Last Working Day *</label>
                      <input
                        type="date"
                        required
                        value={noticeManageForm.approvedLastWorkingDay}
                        onChange={(e) => setNoticeManageForm({ ...noticeManageForm, approvedLastWorkingDay: e.target.value })}
                      />
                    </div>
                    <div className="hr-form-group">
                      <label>Notice Period (Days) *</label>
                      <input
                        type="number"
                        min="0"
                        max="180"
                        required
                        value={noticeManageForm.noticePeriodDays}
                        onChange={(e) => setNoticeManageForm({ ...noticeManageForm, noticePeriodDays: Number(e.target.value) })}
                      />
                    </div>
                    <div className="hr-form-group">
                      <label>Notice Status</label>
                      <select
                        value={noticeManageForm.noticeStatus}
                        onChange={(e) => setNoticeManageForm({ ...noticeManageForm, noticeStatus: e.target.value })}
                      >
                        <option value="Active">Active Notice</option>
                        <option value="Extended">Extended Notice</option>
                        <option value="Shortened">Shortened Notice</option>
                        <option value="Completed">Completed Notice</option>
                      </select>
                    </div>
                    <div className="hr-form-group">
                      <label>Early Release Status</label>
                      <select
                        value={noticeManageForm.earlyReleaseStatus}
                        onChange={(e) => setNoticeManageForm({ ...noticeManageForm, earlyReleaseStatus: e.target.value })}
                      >
                        <option value="None">None</option>
                        <option value="Requested">Requested</option>
                        <option value="Approved">Approved</option>
                        <option value="Waived">Waived</option>
                      </select>
                    </div>
                    <div className="hr-form-group">
                      <label>Early Release Date (if applicable)</label>
                      <input
                        type="date"
                        value={noticeManageForm.earlyReleaseDate}
                        onChange={(e) => setNoticeManageForm({ ...noticeManageForm, earlyReleaseDate: e.target.value })}
                      />
                    </div>
                    <div className="hr-form-group">
                      <label>Waiver Days Granted</label>
                      <input
                        type="number"
                        min="0"
                        value={noticeManageForm.waiverDays}
                        onChange={(e) => setNoticeManageForm({ ...noticeManageForm, waiverDays: Number(e.target.value) })}
                      />
                    </div>
                    <div className="hr-form-group full-width">
                      <label>Waiver / LWD Adjustment Remarks</label>
                      <textarea
                        rows={2}
                        placeholder="Document any reason for early release, buyout, or notice period adjustments..."
                        value={noticeManageForm.waiverRemarks}
                        onChange={(e) => setNoticeManageForm({ ...noticeManageForm, waiverRemarks: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="exit-dialog-footer">
                  <button type="button" className="exit-secondary-btn" onClick={handleCloseModal}>Cancel</button>
                  <button type="submit" className="exit-primary-btn" disabled={submitting}>
                    {submitting ? 'Saving to Atlas...' : 'Save Notice Period'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB 4: DEDICATED EXIT CLEARANCE CHECKLIST MODAL
            ═══════════════════════════════════════════════════════════════ */}
        {activeModalType === 'clearance_detail' && selectedRecord && (
          <div className="exit-modal-overlay" onClick={handleCloseModal}>
            <div className="exit-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
              <div className="exit-dialog-header">
                <div className="exit-dialog-header-info">
                  <div className="exit-emp-avatar">
                    {(selectedRecord.user?.personalInfo?.fullName?.[0] || selectedRecord.user?.firstName?.[0] || 'E').toUpperCase()}
                  </div>
                  <div>
                    <h3>Departmental Exit Clearance — {selectedRecord.user?.personalInfo?.fullName || [selectedRecord.user?.firstName, selectedRecord.user?.lastName].filter(Boolean).join(' ') || selectedRecord.user?.email}</h3>
                    <p className="exit-dialog-subtext">
                      {selectedRecord.user?.jobDetails?.employeeId ? `ID: ${selectedRecord.user.jobDetails.employeeId} • ` : ''}
                      {selectedRecord.user?.jobDetails?.department || selectedRecord.user?.department || 'General'} • Target LWD: {formatDate(selectedRecord.approvedLastWorkingDay || selectedRecord.proposedLastWorkingDay)}
                    </p>
                  </div>
                </div>
                <button type="button" className="exit-dialog-close" onClick={handleCloseModal}>&times;</button>
              </div>
              <div className="exit-dialog-body">
                {(() => {
                  const clr = selectedRecord.clearance || {};
                  const depts = [
                    { key: 'hr', title: 'HR Department Clearance', desc: 'Exit formalities, ID card return, employee file clearance', val: clr.hr },
                    { key: 'manager', title: 'Reporting Manager Clearance', desc: 'Project handover, client account transfer, active tasks reassigned', val: clr.manager },
                    { key: 'finance', title: 'Finance & Accounts Clearance', desc: 'Expense reimbursements settled, loan advances cleared, travel claims', val: clr.finance },
                    { key: 'itAssets', title: 'IT & Hardware Asset Return', desc: 'Company laptop, monitor, peripherals, badge, and software access', val: clr.itAssets },
                    { key: 'knowledgeTransfer', title: 'Knowledge Transfer & Handover', desc: 'Documentation submitted, code repositories, passwords transitioned', val: clr.knowledgeTransfer },
                  ];
                  const allDone = depts.every(d => d.val?.status === 'Completed');

                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', padding: '0.75rem 1rem', background: allDone ? '#ECFDF5' : '#F8FAFC', border: `1px solid ${allDone ? '#A7F3D0' : '#E2E8F0'}`, borderRadius: '8px' }}>
                        <div>
                          <strong style={{ color: allDone ? '#065F46' : '#0F172A', fontSize: '0.9rem' }}>
                            {allDone ? '✓ All Clearances Completed' : 'Departmental Clearances In Progress'}
                          </strong>
                          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                            {depts.filter(d => d.val?.status === 'Completed').length} of {depts.length} departments signed off.
                          </p>
                        </div>
                        <span className={`exit-badge ${allDone ? 'approved' : 'submitted'}`} style={{ fontSize: '0.85rem' }}>
                          {allDone ? '100% Cleared' : `${Math.round((depts.filter(d => d.val?.status === 'Completed').length / depts.length) * 100)}%`}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {depts.map((d) => {
                          const isDone = d.val?.status === 'Completed';
                          return (
                            <div key={d.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                              <div style={{ maxWidth: '400px' }}>
                                <strong style={{ fontSize: '0.875rem', color: '#0f172a', display: 'block' }}>{d.title}</strong>
                                <span style={{ fontSize: '0.775rem', color: '#64748b' }}>{d.desc}</span>
                                {d.val?.remarks && (
                                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#0284c7', marginTop: '2px' }}>
                                    Notes: {d.val.remarks}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span className={`exit-badge ${isDone ? 'approved' : 'submitted'}`}>
                                  {isDone ? 'Completed' : 'Pending'}
                                </span>
                                {isHrOrAdmin && (
                                  <button
                                    type="button"
                                    className={`exit-btn-sm ${isDone ? 'view' : 'approve'}`}
                                    onClick={async () => {
                                      await handleUpdateClearance(selectedRecord._id, d.key, isDone ? 'Pending' : 'Completed');
                                      setSelectedRecord(prev => ({
                                        ...prev,
                                        clearance: {
                                          ...prev.clearance,
                                          [d.key]: { ...prev.clearance?.[d.key], status: isDone ? 'Pending' : 'Completed' }
                                        }
                                      }));
                                    }}
                                  >
                                    {isDone ? 'Reopen' : 'Mark Cleared'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="exit-dialog-footer">
                <button type="button" className="exit-secondary-btn" onClick={handleCloseModal}>Close</button>
                {isHrOrAdmin && ['hr', 'manager', 'finance', 'itAssets', 'knowledgeTransfer'].every(k => selectedRecord.clearance?.[k]?.status === 'Completed') && (
                  <button
                    type="button"
                    className="exit-btn-sm complete"
                    style={{ padding: '0.55rem 1.1rem' }}
                    onClick={() => {
                      handleCloseModal();
                      setShowCompleteExitModal(true);
                    }}
                  >
                    Proceed to Complete Exit
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB 5: DEDICATED EXIT INTERVIEW MODAL
            ═══════════════════════════════════════════════════════════════ */}
        {activeModalType === 'interview_detail' && selectedRecord && (
          <div className="exit-modal-overlay" onClick={handleCloseModal}>
            <div className="exit-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
              <div className="exit-dialog-header">
                <div className="exit-dialog-header-info">
                  <div className="exit-emp-avatar">
                    {(selectedRecord.user?.personalInfo?.fullName?.[0] || selectedRecord.user?.firstName?.[0] || 'E').toUpperCase()}
                  </div>
                  <div>
                    <h3>Exit Interview — {selectedRecord.user?.personalInfo?.fullName || [selectedRecord.user?.firstName, selectedRecord.user?.lastName].filter(Boolean).join(' ') || selectedRecord.user?.email}</h3>
                    <p className="exit-dialog-subtext">
                      {selectedRecord.user?.jobDetails?.employeeId ? `ID: ${selectedRecord.user.jobDetails.employeeId} • ` : ''}
                      {selectedRecord.user?.jobDetails?.department || selectedRecord.user?.department || 'General'}
                    </p>
                  </div>
                </div>
                <button type="button" className="exit-dialog-close" onClick={handleCloseModal}>&times;</button>
              </div>
              <form onSubmit={handleSaveExitInterview}>
                <div className="exit-dialog-body">
                  <div className="hr-form-grid">
                    <div className="hr-form-group">
                      <label>Interview Status *</label>
                      <select
                        value={interviewForm.status}
                        onChange={(e) => setInterviewForm({ ...interviewForm, status: e.target.value })}
                      >
                        <option value="Scheduled">Scheduled</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div className="hr-form-group">
                      <label>Interview Date *</label>
                      <input
                        type="date"
                        required
                        value={interviewForm.scheduledDate}
                        onChange={(e) => setInterviewForm({ ...interviewForm, scheduledDate: e.target.value })}
                      />
                    </div>
                    <div className="hr-form-group">
                      <label>Interviewer Name</label>
                      <input
                        type="text"
                        placeholder="Name of HR or Manager conducting interview"
                        value={interviewForm.interviewerName}
                        onChange={(e) => setInterviewForm({ ...interviewForm, interviewerName: e.target.value })}
                      />
                    </div>
                    <div className="hr-form-group">
                      <label>Rehire Eligibility</label>
                      <select
                        value={interviewForm.rehireEligibility}
                        onChange={(e) => setInterviewForm({ ...interviewForm, rehireEligibility: e.target.value })}
                      >
                        <option value="Eligible">Eligible for Rehire</option>
                        <option value="Not Eligible">Not Eligible for Rehire</option>
                        <option value="Conditional">Conditional / Under Review</option>
                      </select>
                    </div>
                    <div className="hr-form-group full-width">
                      <label>Reason for Leaving</label>
                      <input
                        type="text"
                        placeholder="Primary reason given during interview..."
                        value={interviewForm.reasonForLeaving}
                        onChange={(e) => setInterviewForm({ ...interviewForm, reasonForLeaving: e.target.value })}
                      />
                    </div>
                    <div className="hr-form-group full-width">
                      <label>Feedback on Management, Team & Culture</label>
                      <textarea
                        rows={2}
                        placeholder="Employee's perspective on management support, team dynamics, tools, and culture..."
                        value={interviewForm.managementFeedback}
                        onChange={(e) => setInterviewForm({ ...interviewForm, managementFeedback: e.target.value })}
                      />
                    </div>
                    <div className="hr-form-group full-width">
                      <label>Suggestions for Organization Improvement</label>
                      <textarea
                        rows={2}
                        placeholder="Key suggestions, ideas, or grievances shared by the departing employee..."
                        value={interviewForm.suggestions}
                        onChange={(e) => setInterviewForm({ ...interviewForm, suggestions: e.target.value })}
                      />
                    </div>
                    <div className="hr-form-group full-width">
                      <label>HR Confidential Comments</label>
                      <textarea
                        rows={2}
                        placeholder="Confidential observations, notes, and recommendation for HR records..."
                        value={interviewForm.hrComments}
                        onChange={(e) => setInterviewForm({ ...interviewForm, hrComments: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="exit-dialog-footer">
                  <button type="button" className="exit-secondary-btn" onClick={handleCloseModal}>Cancel</button>
                  <button type="submit" className="exit-primary-btn" disabled={submitting}>
                    {submitting ? 'Saving to Atlas...' : 'Save Exit Interview'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB 6: DEDICATED FINAL SETTLEMENT MODAL
            ═══════════════════════════════════════════════════════════════ */}
        {activeModalType === 'settlement_detail' && selectedRecord && (
          <div className="exit-modal-overlay" onClick={handleCloseModal}>
            <div className="exit-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
              <div className="exit-dialog-header">
                <div className="exit-dialog-header-info">
                  <div className="exit-emp-avatar">
                    {(selectedRecord.user?.personalInfo?.fullName?.[0] || selectedRecord.user?.firstName?.[0] || 'E').toUpperCase()}
                  </div>
                  <div>
                    <h3>Full & Final Settlement — {selectedRecord.user?.personalInfo?.fullName || [selectedRecord.user?.firstName, selectedRecord.user?.lastName].filter(Boolean).join(' ') || selectedRecord.user?.email}</h3>
                    <p className="exit-dialog-subtext">
                      {selectedRecord.user?.jobDetails?.employeeId ? `ID: ${selectedRecord.user.jobDetails.employeeId} • ` : ''}
                      {selectedRecord.user?.jobDetails?.department || selectedRecord.user?.department || 'General'} • LWD: {formatDate(selectedRecord.approvedLastWorkingDay || selectedRecord.proposedLastWorkingDay)}
                    </p>
                  </div>
                </div>
                <button type="button" className="exit-dialog-close" onClick={handleCloseModal}>&times;</button>
              </div>
              <div className="exit-dialog-body">
                {(() => {
                  const basicSal = selectedRecord.user?.salaryDetails?.basicSalary;
                  const fin = selectedRecord.clearance?.finance || {};
                  const netAmount = settlementActionForm.settlementAmount || selectedRecord.finalSettlement?.netPayable || fin.settlementAmount || 0;
                  const isSettled = fin.settlementStatus === 'Completed';

                  return (
                    <div>
                      <div className="exit-section-card" style={{ marginBottom: '1.25rem' }}>
                        <h4 className="exit-card-title">Salary & Compensation Breakdown</h4>
                        <div className="exit-grid-2col">
                          <div className="exit-info-item">
                            <span className="exit-item-label">Basic Salary</span>
                            <strong className="exit-item-val">{basicSal ? formatCurrency(basicSal) : 'Data not available'}</strong>
                          </div>
                          <div className="exit-info-item">
                            <span className="exit-item-label">Notice Period Required</span>
                            <strong className="exit-item-val">{selectedRecord.noticePeriodDays || 30} days</strong>
                          </div>
                          <div className="exit-info-item">
                            <span className="exit-item-label">Settlement Status</span>
                            <span className={`exit-badge ${isSettled ? 'approved' : 'submitted'}`} style={{ display: 'inline-block', marginTop: '4px' }}>
                              {fin.settlementStatus || 'Pending'}
                            </span>
                          </div>
                          <div className="exit-info-item">
                            <span className="exit-item-label">Net Payable Amount</span>
                            <strong className="exit-item-val" style={{ color: '#059669', fontSize: '1.1rem' }}>
                              {netAmount ? formatCurrency(netAmount) : 'Pending calculation'}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {isHrOrAdmin && !isSettled && (
                        <form onSubmit={handleFinalizeSettlement} className="exit-section-card">
                          <h4 className="exit-card-title">Finalize Settlement & Release</h4>
                          <div className="hr-form-grid">
                            <div className="hr-form-group">
                              <label>Final Settlement Amount (₹) *</label>
                              <input
                                type="number"
                                required
                                min="0"
                                value={settlementActionForm.settlementAmount}
                                onChange={(e) => setSettlementActionForm({ ...settlementActionForm, settlementAmount: Number(e.target.value) })}
                              />
                            </div>
                            <div className="hr-form-group">
                              <label>Payment Mode / Account</label>
                              <input
                                type="text"
                                placeholder="Bank Transfer / Direct Deposit"
                                defaultValue="Direct Bank Deposit"
                              />
                            </div>
                            <div className="hr-form-group full-width">
                              <label>Settlement Remarks</label>
                              <textarea
                                rows={2}
                                placeholder="Full and final settlement approved including leave encashment and dues..."
                                value={settlementActionForm.remarks}
                                onChange={(e) => setSettlementActionForm({ ...settlementActionForm, remarks: e.target.value })}
                              />
                            </div>
                          </div>
                          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button type="submit" className="exit-btn-sm approve" style={{ padding: '0.6rem 1.25rem' }} disabled={submitting}>
                              {submitting ? 'Processing...' : 'Confirm & Finalize Settlement'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="exit-dialog-footer">
                <button type="button" className="exit-secondary-btn" onClick={handleCloseModal}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB 7: DEDICATED EXIT HISTORY & AUDIT MODAL
            ═══════════════════════════════════════════════════════════════ */}
        {activeModalType === 'history_detail' && selectedRecord && (
          <div className="exit-modal-overlay" onClick={handleCloseModal}>
            <div className="exit-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
              <div className="exit-dialog-header">
                <div className="exit-dialog-header-info">
                  <div className="exit-emp-avatar">
                    {(selectedRecord.user?.personalInfo?.fullName?.[0] || selectedRecord.user?.firstName?.[0] || 'E').toUpperCase()}
                  </div>
                  <div>
                    <h3>Exit History & Audit — {selectedRecord.user?.personalInfo?.fullName || [selectedRecord.user?.firstName, selectedRecord.user?.lastName].filter(Boolean).join(' ') || selectedRecord.user?.email}</h3>
                    <p className="exit-dialog-subtext">
                      {selectedRecord.user?.jobDetails?.employeeId ? `ID: ${selectedRecord.user.jobDetails.employeeId} • ` : ''}
                      {selectedRecord.user?.jobDetails?.department || selectedRecord.user?.department || 'General'} • Status: {selectedRecord.status}
                    </p>
                  </div>
                </div>
                <button type="button" className="exit-dialog-close" onClick={handleCloseModal}>&times;</button>
              </div>
              <div className="exit-dialog-body">
                <div className="exit-section-card" style={{ marginBottom: '1.25rem' }}>
                  <h4 className="exit-card-title">Separation Record Summary</h4>
                  <div className="exit-grid-2col">
                    <div className="exit-info-item">
                      <span className="exit-item-label">Resignation Date</span>
                      <strong className="exit-item-val">{formatDate(selectedRecord.resignationDate)}</strong>
                    </div>
                    <div className="exit-info-item">
                      <span className="exit-item-label">Official Exit Date</span>
                      <strong className="exit-item-val">{formatDate(selectedRecord.exitCompletedAt || selectedRecord.approvedLastWorkingDay || selectedRecord.proposedLastWorkingDay)}</strong>
                    </div>
                    <div className="exit-info-item">
                      <span className="exit-item-label">Final Status</span>
                      <span className={`exit-badge ${selectedRecord.status.toLowerCase().replace(' ', '_')}`} style={{ display: 'inline-block', marginTop: '4px' }}>
                        {selectedRecord.status}
                      </span>
                    </div>
                    <div className="exit-info-item">
                      <span className="exit-item-label">System Access</span>
                      <span className={`exit-badge ${(selectedRecord.accessManagement?.crmAccess || (selectedRecord.status === 'Completed' ? 'Revoked' : 'Active')).toLowerCase().replace(' ', '_')}`} style={{ display: 'inline-block', marginTop: '4px' }}>
                        {selectedRecord.accessManagement?.crmAccess || (selectedRecord.status === 'Completed' ? 'Revoked' : 'Active')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="exit-section-card">
                  <h4 className="exit-card-title">Chronological Audit Log</h4>
                  {(!selectedRecord.auditTrail || selectedRecord.auditTrail.length === 0) ? (
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.5rem 0' }}>No historical audit events logged for this record.</p>
                  ) : (
                    <div className="exit-timeline-wrap">
                      {selectedRecord.auditTrail.map((ev, i) => (
                        <div key={i} className="exit-timeline-item">
                          <div className="exit-timeline-dot" />
                          <div className="exit-timeline-content">
                            <div className="exit-timeline-header">
                              <strong>{ev.action}</strong>
                              <span className="exit-timeline-time">{formatDate(ev.date || ev.timestamp)}</span>
                            </div>
                            <p className="exit-timeline-details">{ev.notes || ev.reason || 'Audit log event'}</p>
                            {ev.performedByName && (
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>By {ev.performedByName}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="exit-dialog-footer">
                <button type="button" className="exit-secondary-btn" onClick={handleCloseModal}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB 3: DEDICATED OFFBOARDING DETAILS MODAL (ONLY OFFBOARDING)
            ═══════════════════════════════════════════════════════════════ */}
        {activeModalType === 'offboarding_detail' && selectedRecord && (
          <div className="exit-modal-overlay" onClick={handleCloseModal}>
            <div className="exit-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
              <div className="exit-dialog-header">
                <div className="exit-dialog-header-info">
                  <div className="exit-emp-avatar">
                    {(selectedRecord.user?.personalInfo?.fullName?.[0] || selectedRecord.user?.firstName?.[0] || 'E').toUpperCase()}
                  </div>
                  <div>
                    <h3>Offboarding Workflow — {selectedRecord.user?.personalInfo?.fullName || [selectedRecord.user?.firstName, selectedRecord.user?.lastName].filter(Boolean).join(' ') || selectedRecord.user?.email}</h3>
                    <p className="exit-dialog-subtext">
                      {selectedRecord.user?.jobDetails?.employeeId ? `ID: ${selectedRecord.user.jobDetails.employeeId} • ` : ''}
                      {selectedRecord.user?.jobDetails?.department || selectedRecord.user?.department || 'General'} • {selectedRecord.user?.jobDetails?.designation || selectedRecord.user?.designation || 'Staff'}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className={`exit-badge ${selectedRecord.status.toLowerCase().replace(' ', '_')}`}>{selectedRecord.status}</span>
                  <button type="button" className="exit-dialog-close" onClick={handleCloseModal}>&times;</button>
                </div>
              </div>

              <div className="exit-dialog-body">
                {/* 1. Offboarding Progression Summary */}
                <div className="exit-section-card" style={{ marginBottom: '1.25rem' }}>
                  <h4 className="exit-card-title">Offboarding Progression</h4>
                  <div className="exit-grid-2col">
                    <div className="exit-info-item">
                      <span className="exit-item-label">Current Separation Phase</span>
                      <strong className="exit-item-val">{selectedRecord.status}</strong>
                    </div>
                    <div className="exit-info-item">
                      <span className="exit-item-label">Target Release / Last Working Day</span>
                      <strong className="exit-item-val">{formatDate(selectedRecord.approvedLastWorkingDay || selectedRecord.proposedLastWorkingDay)}</strong>
                    </div>
                    <div className="exit-info-item">
                      <span className="exit-item-label">Notice Service Required</span>
                      <strong className="exit-item-val">{selectedRecord.noticePeriodDays || 30} days</strong>
                    </div>
                    <div className="exit-info-item">
                      <span className="exit-item-label">Exit Interview Status</span>
                      <span className={`exit-badge ${selectedRecord.exitInterview?.status === 'Completed' ? 'approved' : 'submitted'}`} style={{ display: 'inline-block', marginTop: '4px' }}>
                        {selectedRecord.exitInterview?.status === 'Completed' ? '✓ Conducted' : 'Pending Interview'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Departmental Clearances Checklist */}
                <div className="exit-section-card" style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 className="exit-card-title" style={{ margin: 0 }}>Departmental Clearance Status</h4>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {['hr', 'manager', 'finance', 'itAssets', 'knowledgeTransfer'].filter(k => selectedRecord.clearance?.[k]?.status === 'Completed').length} / 5 Cleared
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {[
                      { key: 'hr', name: 'HR Department' },
                      { key: 'manager', name: 'Reporting Manager' },
                      { key: 'finance', name: 'Finance & Accounts' },
                      { key: 'itAssets', name: 'IT & Hardware Assets' },
                      { key: 'knowledgeTransfer', name: 'Knowledge Transfer' },
                    ].map((dept) => {
                      const isDone = selectedRecord.clearance?.[dept.key]?.status === 'Completed';
                      return (
                        <div key={dept.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.8rem' }}>
                          <span>{dept.name}</span>
                          <span className={`exit-badge ${isDone ? 'approved' : 'submitted'}`} style={{ fontSize: '0.7rem' }}>
                            {isDone ? 'Cleared' : 'Pending'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Centralized System Access Reference */}
                <div className="exit-section-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h4 className="exit-card-title" style={{ margin: 0 }}>System Access Status</h4>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                        Access status: <strong style={{ color: selectedRecord.accessManagement?.crmAccess === 'Revoked' ? '#DC2626' : '#059669' }}>{selectedRecord.accessManagement?.crmAccess || 'Active'}</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleGoToAccessTab(selectedRecord.user?.email || '')}
                      className="exit-primary-btn"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.45rem 0.85rem', cursor: 'pointer' }}
                    >
                      Manage Access in Access Management &rarr;
                    </button>
                  </div>
                </div>
              </div>

              <div className="exit-dialog-footer">
                <button type="button" className="exit-secondary-btn" onClick={handleCloseModal}>Close</button>
                {isHrOrAdmin && ['hr', 'manager', 'finance', 'itAssets', 'knowledgeTransfer'].every(k => selectedRecord.clearance?.[k]?.status === 'Completed') && (
                  <button
                    type="button"
                    className="exit-btn-sm complete"
                    style={{ padding: '0.55rem 1.1rem' }}
                    onClick={() => {
                      handleCloseModal();
                      setShowCompleteExitModal(true);
                    }}
                  >
                    Proceed to Complete Exit
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            CENTRAL OFFBOARDING VIEW MODAL (DRAWER)
            ═══════════════════════════════════════════════════════════════ */}
        {showDetailModal && !activeModalType && selectedRecord && (
          <div className="exit-modal-overlay" onClick={handleCloseModal}>
            <div className="exit-modal-dialog exit-offboarding-dialog" onClick={(e) => e.stopPropagation()}>
              {/* Header with Profile Info */}
              <div className="exit-dialog-header">
                <div className="exit-dialog-header-info">
                  <div className="exit-emp-avatar">
                    {(selectedRecord.user?.personalInfo?.fullName?.[0] || selectedRecord.user?.firstName?.[0] || 'E').toUpperCase()}
                  </div>
                  <div>
                    <h3>
                      {selectedRecord.user?.personalInfo?.fullName || [selectedRecord.user?.firstName, selectedRecord.user?.lastName].filter(Boolean).join(' ') || selectedRecord.user?.email}
                    </h3>
                    <p className="exit-dialog-subtext">
                      {selectedRecord.user?.jobDetails?.employeeId ? `ID: ${selectedRecord.user.jobDetails.employeeId} • ` : ''}
                      {selectedRecord.user?.jobDetails?.department || selectedRecord.user?.department || 'General'} • {selectedRecord.user?.jobDetails?.designation || selectedRecord.user?.designation || 'Staff'} • Joined: {formatDate(selectedRecord.user?.jobDetails?.joiningDate || selectedRecord.user?.createdAt)}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className={`exit-badge ${selectedRecord.status.toLowerCase().replace(' ', '_')}`}>
                    {selectedRecord.status}
                  </span>
                  <button type="button" className="exit-dialog-close" onClick={handleCloseModal}>&times;</button>
                </div>
              </div>

              {/* Central Offboarding Navigation Tabs */}
              <div className="exit-offboarding-tabs">
                <button
                  type="button"
                  className={`exit-off-tab ${detailInnerTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setDetailInnerTab('overview')}
                >
                  1. Resignation
                </button>
                <button
                  type="button"
                  className={`exit-off-tab ${detailInnerTab === 'notice' ? 'active' : ''}`}
                  onClick={() => setDetailInnerTab('notice')}
                >
                  2. Notice Period
                </button>
                <button
                  type="button"
                  className={`exit-off-tab ${detailInnerTab === 'documents' ? 'active' : ''}`}
                  onClick={() => setDetailInnerTab('documents')}
                >
                  3. Documents ({offboardingData?.documents?.length || 0})
                </button>
                <button
                  type="button"
                  className={`exit-off-tab ${detailInnerTab === 'assets' ? 'active' : ''}`}
                  onClick={() => setDetailInnerTab('assets')}
                >
                  4. Assets ({offboardingData?.assets?.length || 0})
                </button>
                <button
                  type="button"
                  className={`exit-off-tab ${detailInnerTab === 'access' ? 'active' : ''}`}
                  onClick={() => setDetailInnerTab('access')}
                >
                  5. Access Management
                </button>
                <button
                  type="button"
                  className={`exit-off-tab ${detailInnerTab === 'clearance' ? 'active' : ''}`}
                  onClick={() => setDetailInnerTab('clearance')}
                >
                  6. Clearance
                </button>
                <button
                  type="button"
                  className={`exit-off-tab ${detailInnerTab === 'interview' ? 'active' : ''}`}
                  onClick={() => setDetailInnerTab('interview')}
                >
                  7. Exit Interview
                </button>
                <button
                  type="button"
                  className={`exit-off-tab ${detailInnerTab === 'settlement' ? 'active' : ''}`}
                  onClick={() => setDetailInnerTab('settlement')}
                >
                  8. Final Settlement
                </button>
                <button
                  type="button"
                  className={`exit-off-tab ${detailInnerTab === 'timeline' ? 'active' : ''}`}
                  onClick={() => setDetailInnerTab('timeline')}
                >
                  9. Audit Timeline ({selectedRecord.auditTrail?.length || 0})
                </button>
              </div>

              {/* Modal Body with Offboarding Content */}
              <div className="exit-dialog-body">
                {offboardingLoading ? (
                  <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
                    Loading real employee records from MongoDB Atlas...
                  </div>
                ) : (
                  <>
                    {/* SECTION 1: RESIGNATION DETAILS */}
                    {detailInnerTab === 'overview' && (
                      <div className="exit-section-pane">
                        <div className="exit-section-card">
                          <h4 className="exit-card-title">Resignation Record</h4>
                          <div className="exit-grid-2col">
                            <div className="exit-info-item">
                              <span className="exit-item-label">Resignation Date</span>
                              <strong className="exit-item-val">{formatDate(selectedRecord.resignationDate)}</strong>
                            </div>
                            <div className="exit-info-item">
                              <span className="exit-item-label">Proposed Last Working Day</span>
                              <strong className="exit-item-val">{formatDate(selectedRecord.proposedLastWorkingDay)}</strong>
                            </div>
                            <div className="exit-info-item">
                              <span className="exit-item-label">Approved Last Working Day</span>
                              <strong className="exit-item-val">
                                {selectedRecord.approvedLastWorkingDay ? formatDate(selectedRecord.approvedLastWorkingDay) : 'Pending approval'}
                              </strong>
                            </div>
                            <div className="exit-info-item">
                              <span className="exit-item-label">Notice Period Days</span>
                              <strong className="exit-item-val">{selectedRecord.noticePeriodDays || 30} days</strong>
                            </div>
                            <div className="exit-info-item full">
                              <span className="exit-item-label">Reason for Resignation</span>
                              <p className="exit-item-text">{selectedRecord.reason}</p>
                            </div>
                            {selectedRecord.employeeComments && (
                              <div className="exit-info-item full">
                                <span className="exit-item-label">Employee Transition Handover Comments</span>
                                <p className="exit-item-text">{selectedRecord.employeeComments}</p>
                              </div>
                            )}
                            {selectedRecord.hrRemarks && (
                              <div className="exit-info-item full">
                                <span className="exit-item-label">HR Remarks</span>
                                <p className="exit-item-text" style={{ color: '#0f172a', fontWeight: '500' }}>{selectedRecord.hrRemarks}</p>
                              </div>
                            )}
                            {selectedRecord.rejectionReason && (
                              <div className="exit-info-item full">
                                <span className="exit-item-label" style={{ color: '#DC2626' }}>Rejection Reason</span>
                                <p className="exit-item-text" style={{ color: '#DC2626' }}>{selectedRecord.rejectionReason}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SECTION 2: NOTICE PERIOD */}
                    {detailInnerTab === 'notice' && (
                      <div className="exit-section-pane">
                        <div className="exit-section-card">
                          <h4 className="exit-card-title">Notice Period Tracker</h4>
                          {(() => {
                            const lwd = selectedRecord.approvedLastWorkingDay || selectedRecord.proposedLastWorkingDay;
                            const diffMs = new Date(lwd).getTime() - Date.now();
                            const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
                            const totalDays = selectedRecord.noticePeriodDays || 30;
                            const progressPct = Math.min(100, Math.max(0, Math.round(((totalDays - daysRemaining) / totalDays) * 100)));

                            return (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                                  <div>
                                    <span className="exit-item-label">Days Remaining</span>
                                    <div style={{ fontSize: '2.2rem', fontWeight: '800', color: daysRemaining <= 7 ? '#DC2626' : daysRemaining <= 15 ? '#EA580C' : '#16A34A' }}>
                                      {daysRemaining} Days
                                    </div>
                                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                      Scheduled Release: <strong>{formatDate(lwd)}</strong>
                                    </span>
                                  </div>
                                  {isHrOrAdmin && (
                                    <button
                                      type="button"
                                      className="exit-secondary-btn"
                                      onClick={() => handleOpenApprove(selectedRecord)}
                                    >
                                      Adjust Last Working Day
                                    </button>
                                  )}
                                </div>

                                <div style={{ marginBottom: '1rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>
                                    <span>Notice Progress: {progressPct}% served</span>
                                    <span>Total Notice: {totalDays} days</span>
                                  </div>
                                  <div className="exit-meter-bar" style={{ height: '10px' }}>
                                    <div className="exit-meter-fill" style={{ width: `${progressPct}%` }} />
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* SECTION 3: REAL DOCUMENTS FROM MONGODB ATLAS */}
                    {detailInnerTab === 'documents' && (
                      <div className="exit-section-pane">
                        <div className="exit-section-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h4 className="exit-card-title" style={{ margin: 0 }}>Real Employee Documents</h4>
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                              Queried from Documents Module
                            </span>
                          </div>

                          {(!offboardingData?.documents || offboardingData.documents.length === 0) ? (
                            <div className="exit-empty-box">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '36px', height: '36px', color: '#94a3b8' }}>
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                              <p style={{ marginTop: '0.5rem', fontWeight: '600' }}>No document uploaded</p>
                              <span style={{ fontSize: '0.8rem' }}>No employee documents are uploaded in the Document Management module for this user.</span>
                            </div>
                          ) : (
                            <div className="exit-resource-list">
                              {offboardingData.documents.map((doc) => (
                                <div key={doc._id} className="exit-resource-item">
                                  <div className="exit-resource-info">
                                    <div className="exit-resource-icon">📄</div>
                                    <div>
                                      <strong>{doc.name}</strong>
                                      <span className="exit-resource-sub">
                                        {doc.category} {doc.documentNumber ? `• ID: ${doc.documentNumber}` : ''} • {doc.size ? `${Math.round(doc.size / 1024)} KB` : ''}
                                      </span>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span className={`exit-badge ${doc.status === 'Verified' ? 'approved' : doc.status === 'Rejected' ? 'rejected' : 'submitted'}`}>
                                      {doc.status}
                                    </span>
                                    <a
                                      href={`http://localhost:5005/api/v1/documents/${doc._id}/content`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="exit-btn-sm view"
                                    >
                                      View / Download
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* SECTION 4: REAL ASSETS FROM MONGODB ATLAS */}
                    {detailInnerTab === 'assets' && (
                      <div className="exit-section-pane">
                        <div className="exit-section-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h4 className="exit-card-title" style={{ margin: 0 }}>Assigned Company Assets</h4>
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                              Queried from Assets Module
                            </span>
                          </div>

                          {(!offboardingData?.assets || offboardingData.assets.length === 0) ? (
                            <div className="exit-empty-box">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '36px', height: '36px', color: '#94a3b8' }}>
                                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                <line x1="8" y1="21" x2="16" y2="21" />
                                <line x1="12" y1="17" x2="12" y2="21" />
                              </svg>
                              <p style={{ marginTop: '0.5rem', fontWeight: '600' }}>No company assets assigned</p>
                              <span style={{ fontSize: '0.8rem' }}>No company hardware or assets are currently allocated to this employee.</span>
                            </div>
                          ) : (
                            <div className="exit-resource-list">
                              {offboardingData.assets.map((ast) => (
                                <div key={ast._id} className="exit-resource-item">
                                  <div className="exit-resource-info">
                                    <div className="exit-resource-icon">💻</div>
                                    <div>
                                      <strong>{ast.assetName}</strong>
                                      <span className="exit-resource-sub">
                                        Code: {ast.assetCode} • {ast.category} • Condition: {ast.condition || 'Good'}
                                      </span>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span className={`exit-badge ${ast.status === 'Returned' ? 'approved' : 'notice_period'}`}>
                                      {ast.status}
                                    </span>
                                    {isHrOrAdmin && (
                                      <button
                                        type="button"
                                        className="exit-btn-sm view"
                                        onClick={() => handleUpdateClearance(selectedRecord._id, 'itAssets', 'Completed')}
                                      >
                                        Mark Asset Cleared
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* SECTION 5: ACCESS MANAGEMENT */}
                    {detailInnerTab === 'access' && (
                      <div className="exit-section-pane">
                        <div className="exit-section-card">
                          <h4 className="exit-card-title">System & CRM Access Controls</h4>
                          <p style={{ fontSize: '0.825rem', color: '#64748b', marginBottom: '1.25rem' }}>
                            Configure system access state. Differentiated controls: Restrict operational modules (keeps account active for self-service/handover) or permanently revoke all system access.
                          </p>

                          <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '8px', padding: '0.85rem 1.15rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <div>
                              <strong style={{ color: '#3730A3', fontSize: '0.875rem' }}>Centralized Access Management Feature</strong>
                              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#4338CA' }}>
                                Manage granular module permissions, grant/revoke system rights, and view audit trail centrally.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleGoToAccessTab('')}
                              className="exit-primary-btn"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap', fontSize: '0.825rem', padding: '0.45rem 0.9rem', cursor: 'pointer' }}
                            >
                              Go to Access Management &rarr;
                            </button>
                          </div>

                          <div className="exit-access-status-box">
                            <div>
                              <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>Current Access State</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                <span className={`exit-badge ${(selectedRecord.accessManagement?.crmAccess || selectedRecord.user?.accessStatus || 'Active') === 'Revoked' ? 'rejected' : (selectedRecord.accessManagement?.crmAccess || selectedRecord.user?.accessStatus || 'Active') === 'Restricted' ? 'submitted' : 'approved'}`} style={{ fontSize: '0.9rem', padding: '0.35rem 0.85rem' }}>
                                  {(selectedRecord.accessManagement?.crmAccess || selectedRecord.user?.accessStatus || 'Active').toUpperCase()}
                                </span>
                                {selectedRecord.accessManagement?.updatedByName && (
                                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                    Updated by {selectedRecord.accessManagement.updatedByName} on {formatDate(selectedRecord.accessManagement.updatedAt)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleGoToAccessTab(selectedRecord.user?.email || '')}
                              className="exit-primary-btn"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
                            >
                              Manage Access in Access Management &rarr;
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SECTION 6: CLEARANCE CHECKLIST */}
                    {detailInnerTab === 'clearance' && (
                      <div className="exit-section-pane">
                        <div className="exit-section-card">
                          <h4 className="exit-card-title">Inter-Departmental Exit Clearance</h4>
                          <div className="exit-clearance-list">
                            {[
                              { key: 'hr', name: 'Human Resources (HR)', desc: 'ID card, benefits cessation, documentation verify' },
                              { key: 'manager', name: 'Reporting Manager', desc: 'Project handover, client transition, credentials release' },
                              { key: 'finance', name: 'Finance & Accounts', desc: 'Advance recovery, expense claims, dues check' },
                              { key: 'itAssets', name: 'IT & Asset Management', desc: 'Laptop, peripherals, access cards, hardware return' },
                              { key: 'knowledgeTransfer', name: 'Knowledge Transfer (KT)', desc: 'Documentation of tasks, code repo access handover' },
                            ].map((dept) => {
                              const item = selectedRecord.clearance?.[dept.key] || {};
                              const isDone = item.status === 'Completed';

                              return (
                                <div key={dept.key} className="exit-clearance-item">
                                  <div>
                                    <strong>{dept.name}</strong>
                                    <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>{dept.desc}</p>
                                    {isDone && item.completedBy && (
                                      <small style={{ color: '#16A34A', display: 'block', marginTop: '3px' }}>
                                        Cleared by {item.completedBy} on {formatDate(item.completedDate)}
                                      </small>
                                    )}
                                  </div>
                                  <div>
                                    {isHrOrAdmin ? (
                                      <button
                                        type="button"
                                        className={`exit-btn-sm ${isDone ? 'approve' : 'view'}`}
                                        onClick={() => handleUpdateClearance(selectedRecord._id, dept.key, isDone ? 'Pending' : 'Completed')}
                                      >
                                        {isDone ? '✓ Completed' : 'Mark Completed'}
                                      </button>
                                    ) : (
                                      <span className={`exit-badge ${isDone ? 'approved' : 'submitted'}`}>
                                        {item.status || 'Pending'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SECTION 7: EXIT INTERVIEW */}
                    {detailInnerTab === 'interview' && (
                      <div className="exit-section-pane">
                        <div className="exit-section-card">
                          <h4 className="exit-card-title">Exit Interview Record</h4>
                          <form onSubmit={handleSaveExitInterview}>
                            <div className="hr-form-grid">
                              <div className="hr-form-group">
                                <label>Interview Status</label>
                                <select
                                  value={interviewForm.status}
                                  onChange={(e) => setInterviewForm({ ...interviewForm, status: e.target.value })}
                                  disabled={!isHrOrAdmin}
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="Scheduled">Scheduled</option>
                                  <option value="Completed">Completed</option>
                                </select>
                              </div>

                              <div className="hr-form-group">
                                <label>Scheduled / Conducted Date</label>
                                <input
                                  type="date"
                                  value={interviewForm.scheduledDate}
                                  onChange={(e) => setInterviewForm({ ...interviewForm, scheduledDate: e.target.value })}
                                  disabled={!isHrOrAdmin}
                                />
                              </div>

                              <div className="hr-form-group full-width">
                                <label>Primary Reason for Leaving</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Compensation, Career Advancement, Relocation"
                                  value={interviewForm.reasonForLeaving}
                                  onChange={(e) => setInterviewForm({ ...interviewForm, reasonForLeaving: e.target.value })}
                                  disabled={!isHrOrAdmin}
                                />
                              </div>

                              <div className="hr-form-group full-width">
                                <label>Management & Team Feedback</label>
                                <textarea
                                  rows={2}
                                  placeholder="Observations on management support, teamwork, communication..."
                                  value={interviewForm.managementFeedback}
                                  onChange={(e) => setInterviewForm({ ...interviewForm, managementFeedback: e.target.value })}
                                  disabled={!isHrOrAdmin}
                                />
                              </div>

                              <div className="hr-form-group full-width">
                                <label>Suggestions for Organizational Improvement</label>
                                <textarea
                                  rows={2}
                                  placeholder="Actionable ideas for retention and process enhancements..."
                                  value={interviewForm.suggestions}
                                  onChange={(e) => setInterviewForm({ ...interviewForm, suggestions: e.target.value })}
                                  disabled={!isHrOrAdmin}
                                />
                              </div>

                              <div className="hr-form-group">
                                <label>Rehire Eligibility</label>
                                <select
                                  value={interviewForm.rehireEligibility}
                                  onChange={(e) => setInterviewForm({ ...interviewForm, rehireEligibility: e.target.value })}
                                  disabled={!isHrOrAdmin}
                                >
                                  <option value="Eligible">Eligible for Rehire</option>
                                  <option value="Not Eligible">Not Eligible</option>
                                </select>
                              </div>

                              <div className="hr-form-group full-width">
                                <label>Confidential HR Observations</label>
                                <textarea
                                  rows={2}
                                  placeholder="Confidential notes regarding this employee's exit..."
                                  value={interviewForm.hrComments}
                                  onChange={(e) => setInterviewForm({ ...interviewForm, hrComments: e.target.value })}
                                  disabled={!isHrOrAdmin}
                                />
                              </div>
                            </div>

                            {isHrOrAdmin && (
                              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                                <button type="submit" className="exit-primary-btn" disabled={submitting}>
                                  {submitting ? 'Saving...' : 'Save Exit Interview'}
                                </button>
                              </div>
                            )}
                          </form>
                        </div>
                      </div>
                    )}

                    {/* SECTION 8: FINAL SETTLEMENT (REAL PAYROLL / F&F DATA) */}
                    {detailInnerTab === 'settlement' && (
                      <div className="exit-section-pane">
                        <div className="exit-section-card">
                          <h4 className="exit-card-title">Full & Final Payroll Settlement</h4>
                          <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '1rem' }}>
                            Calculated dynamically from real workforce attendance, leave balances, and salary components.
                          </span>

                          <div className="exit-settlement-breakdown">
                            <div className="exit-settlement-col">
                              <h5>Earnings & Payable</h5>
                              <div className="exit-calc-row">
                                <span>Basic Salary (Monthly)</span>
                                <strong>{formatCurrency(offboardingData?.settlement?.basicSalary)}</strong>
                              </div>
                              <div className="exit-calc-row">
                                <span>Allowances</span>
                                <strong>{formatCurrency(offboardingData?.settlement?.allowances)}</strong>
                              </div>
                              <div className="exit-calc-row">
                                <span>Bonus / Incentives</span>
                                <strong>{formatCurrency(offboardingData?.settlement?.bonus)}</strong>
                              </div>
                              <div className="exit-calc-row">
                                <span>Leave Encashment</span>
                                <strong>{formatCurrency(offboardingData?.settlement?.leaveEncashment)}</strong>
                              </div>
                              <div className="exit-calc-row total">
                                <span>Gross Payable</span>
                                <strong>{formatCurrency(offboardingData?.settlement?.grossEarnings)}</strong>
                              </div>
                            </div>

                            <div className="exit-settlement-col">
                              <h5>Deductions & Recoveries</h5>
                              <div className="exit-calc-row">
                                <span>Notice Period Recovery</span>
                                <strong>{formatCurrency(offboardingData?.settlement?.noticeRecovery)}</strong>
                              </div>
                              <div className="exit-calc-row">
                                <span>Asset Loss / Damage Recovery</span>
                                <strong>{formatCurrency(offboardingData?.settlement?.assetRecovery)}</strong>
                              </div>
                              <div className="exit-calc-row">
                                <span>Statutory & Other Deductions</span>
                                <strong>{formatCurrency(offboardingData?.settlement?.deductions)}</strong>
                              </div>
                              <div className="exit-calc-row total" style={{ color: '#DC2626' }}>
                                <span>Total Deductions</span>
                                <strong>{formatCurrency((offboardingData?.settlement?.deductions || 0) + (offboardingData?.settlement?.noticeRecovery || 0) + (offboardingData?.settlement?.assetRecovery || 0))}</strong>
                              </div>
                            </div>
                          </div>

                          <div className="exit-net-payable-box">
                            <div>
                              <span>NET PAYABLE SETTLEMENT</span>
                              <div className="exit-net-amount">
                                {formatCurrency(offboardingData?.settlement?.netPayable)}
                              </div>
                              <small>Status: {selectedRecord.clearance?.finance?.settlementStatus || 'Pending'}</small>
                            </div>

                            {isHrOrAdmin && (
                              <form onSubmit={handleFinalizeSettlement} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <input
                                  type="number"
                                  placeholder="Amount"
                                  style={{ width: '130px', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                  value={settlementActionForm.settlementAmount}
                                  onChange={(e) => setSettlementActionForm({ ...settlementActionForm, settlementAmount: Number(e.target.value) })}
                                />
                                <button type="submit" className="exit-btn-sm approve" style={{ padding: '0.55rem 1rem' }} disabled={submitting}>
                                  {submitting ? 'Processing...' : 'Finalize & Approve Settlement'}
                                </button>
                              </form>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SECTION 9: AUDIT TIMELINE */}
                    {detailInnerTab === 'timeline' && (
                      <div className="exit-section-pane">
                        <div className="exit-section-card">
                          <h4 className="exit-card-title">Resignation & Exit Audit Trail</h4>
                          {(!selectedRecord.auditTrail || selectedRecord.auditTrail.length === 0) ? (
                            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No historical audit events logged yet.</p>
                          ) : (
                            <div className="exit-timeline">
                              {selectedRecord.auditTrail.map((ev, i) => (
                                <div key={i} className="exit-timeline-item">
                                  <div className="exit-timeline-bullet" />
                                  <div className="exit-timeline-content">
                                    <div className="exit-timeline-header">
                                      <strong>{ev.action}</strong>
                                      <span className="exit-timeline-date">{formatDate(ev.date)} {new Date(ev.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <p className="exit-timeline-by">Performed by {ev.performedByName || 'System'}</p>
                                    {ev.previousValue && ev.newValue && (
                                      <span className="exit-timeline-transition">
                                        {ev.previousValue} &rarr; {ev.newValue}
                                      </span>
                                    )}
                                    {ev.reason && <p className="exit-timeline-note">{ev.reason}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="exit-dialog-footer">
                <button type="button" className="exit-secondary-btn" onClick={handleCloseModal}>Close</button>
                {isHrOrAdmin && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {selectedRecord.status === 'Submitted' && (
                      <>
                        <button type="button" className="exit-btn-sm review" onClick={() => handleMarkReview(selectedRecord)}>
                          Review
                        </button>
                        <button type="button" className="exit-btn-sm approve" onClick={() => handleOpenApprove(selectedRecord)}>
                          Approve Resignation
                        </button>
                        <button type="button" className="exit-btn-sm reject" onClick={() => handleOpenReject(selectedRecord)}>
                          Reject
                        </button>
                      </>
                    )}
                    {selectedRecord.status !== 'Completed' && (
                      <button
                        type="button"
                        className="exit-btn-sm complete"
                        style={{ padding: '0.55rem 1.1rem' }}
                        onClick={() => setShowCompleteExitModal(true)}
                      >
                        Complete Full Exit
                      </button>
                    )}
                  </div>
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
                <h3>Complete Exit Formalities</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowCompleteExitModal(false)}>&times;</button>
              </div>

              <div className="hr-modal-body">
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👋</div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>
                    Confirm final offboarding release?
                  </h4>
                  <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: '1.5' }}>
                    This will mark <strong>{selectedRecord.user?.personalInfo?.fullName || selectedRecord.user?.email}</strong> as <strong>Exited</strong> and permanently revoke system access. All documents, attendance, and payroll records are safely preserved in MongoDB Atlas.
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

        {/* ─── ADD RESIGNATION MODAL ─── */}
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
                                {name} ({emp.jobDetails?.employeeId ? `${emp.jobDetails.employeeId} - ` : ''}{emp.department || 'General'})
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

        {/* ─── STRICTLY PRESERVED: TERMINATE EMPLOYEE MODAL ─── */}
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
                              {name} ({emp.jobDetails?.employeeId ? `${emp.jobDetails.employeeId} - ` : ''}{emp.department || 'General'})
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

        {/* Start Onboarding Modal */}
        {showStartOnboardingModal && (
          <div className="hr-modal-overlay" onClick={() => setShowStartOnboardingModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px' }}>
              <div className="hr-modal-header">
                <h3>Start Employee Onboarding</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowStartOnboardingModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleCreateOnboarding}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid">
                    <div className="hr-form-group full-width">
                      <label>Select Employee or Converted Candidate *</label>
                      <select
                        required
                        value={startOnboardingForm.employeeId || startOnboardingForm.candidateId}
                        onChange={(e) => {
                          const val = e.target.value;
                          const selected = eligibleEmployees.find((x) => String(x._id) === String(val));
                          if (selected?.type === 'Candidate') {
                            setStartOnboardingForm({
                              ...startOnboardingForm,
                              candidateId: val,
                              employeeId: '',
                              designation: selected.designation || '',
                              department: selected.department || 'Tech',
                            });
                          } else {
                            setStartOnboardingForm({
                              ...startOnboardingForm,
                              employeeId: val,
                              candidateId: '',
                              designation: selected?.designation || '',
                              department: selected?.department || 'Tech',
                            });
                          }
                        }}
                      >
                        <option value="">Select Candidate or Employee...</option>
                        {eligibleEmployees.map((emp) => (
                          <option key={emp._id} value={emp._id}>
                            [{emp.type}] {emp.name} — {emp.designation} ({emp.department})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Joining Date *</label>
                      <input
                        type="date"
                        required
                        value={startOnboardingForm.joiningDate}
                        onChange={(e) => setStartOnboardingForm({ ...startOnboardingForm, joiningDate: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Employment Type *</label>
                      <select
                        value={startOnboardingForm.employmentType}
                        onChange={(e) => setStartOnboardingForm({ ...startOnboardingForm, employmentType: e.target.value })}
                      >
                        <option value="Full Time">Full Time</option>
                        <option value="Part Time">Part Time</option>
                        <option value="Contract">Contract</option>
                        <option value="Intern">Intern</option>
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Official Designation *</label>
                      <input
                        type="text"
                        required
                        value={startOnboardingForm.designation}
                        onChange={(e) => setStartOnboardingForm({ ...startOnboardingForm, designation: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Department *</label>
                      <select
                        value={startOnboardingForm.department}
                        onChange={(e) => setStartOnboardingForm({ ...startOnboardingForm, department: e.target.value })}
                      >
                        {OFFICIAL_DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Reporting Manager</label>
                      <input
                        type="text"
                        placeholder="Manager Name / Title"
                        value={startOnboardingForm.reportingManager}
                        onChange={(e) => setStartOnboardingForm({ ...startOnboardingForm, reportingManager: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Work Location</label>
                      <input
                        type="text"
                        value={startOnboardingForm.workLocation}
                        onChange={(e) => setStartOnboardingForm({ ...startOnboardingForm, workLocation: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Emergency Contact Name</label>
                      <input
                        type="text"
                        placeholder="Contact Person"
                        value={startOnboardingForm.emergencyContactName}
                        onChange={(e) => setStartOnboardingForm({ ...startOnboardingForm, emergencyContactName: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Emergency Contact Phone</label>
                      <input
                        type="text"
                        placeholder="+91 9876543210"
                        value={startOnboardingForm.emergencyContactPhone}
                        onChange={(e) => setStartOnboardingForm({ ...startOnboardingForm, emergencyContactPhone: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Onboarding Notes</label>
                      <textarea
                        rows={2}
                        placeholder="Additional instructions, welcome kit status, or special equipment..."
                        value={startOnboardingForm.notes}
                        onChange={(e) => setStartOnboardingForm({ ...startOnboardingForm, notes: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowStartOnboardingModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Initializing...' : 'Initialize Onboarding'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Comprehensive Onboarding Details & Checklist Drawer */}
        {showOnboardingDrawer && selectedOnboarding && (
          <div className="hr-modal-overlay" onClick={() => setShowOnboardingDrawer(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '820px' }}>
              <div className="hr-modal-header">
                <div>
                  <h3 style={{ margin: 0 }}>
                    Onboarding: {selectedOnboarding.employee?.firstName ? `${selectedOnboarding.employee.firstName} ${selectedOnboarding.employee.lastName || ''}` : selectedOnboarding.candidate?.name || selectedOnboarding.employeeId}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {selectedOnboarding.employeeId} &bull; {selectedOnboarding.designation} ({selectedOnboarding.department}) &bull; Joining: {formatDate(selectedOnboarding.joiningDate)}
                  </span>
                </div>
                <button type="button" className="hr-modal-close" onClick={() => setShowOnboardingDrawer(false)}>&times;</button>
              </div>

              {/* Checklist Progress Overview */}
              <div style={{ padding: '0.75rem 1.5rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {(() => {
                  const tasks = selectedOnboarding.checklist || [];
                  const comp = tasks.filter((t) => t.status === 'Completed').length;
                  const pct = tasks.length > 0 ? Math.round((comp / tasks.length) * 100) : 0;
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.825rem', fontWeight: 600 }}>
                        <span>Overall Onboarding Progress</span>
                        <span style={{ color: pct === 100 ? '#16A34A' : '#EA580C' }}>{comp} of {tasks.length} Completed ({pct}%)</span>
                      </div>
                      <div className="exit-progress-track" style={{ height: '8px' }}>
                        <div className={`exit-progress-fill ${pct === 100 ? 'completed' : ''}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Sub-tabs */}
              <div className="exit-detail-tabs" style={{ padding: '0 1.5rem', background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                <button
                  type="button"
                  className={`exit-detail-tab-btn ${onboardingInnerTab === 'checklist' ? 'active' : ''}`}
                  onClick={() => setOnboardingInnerTab('checklist')}
                >
                  17-Item Checklist ({selectedOnboarding.checklist?.filter((t) => t.status === 'Completed').length || 0}/17)
                </button>
                <button
                  type="button"
                  className={`exit-detail-tab-btn ${onboardingInnerTab === 'documents' ? 'active' : ''}`}
                  onClick={() => setOnboardingInnerTab('documents')}
                >
                  Documents ({onboardingDetailData?.documents?.length || 0})
                </button>
                <button
                  type="button"
                  className={`exit-detail-tab-btn ${onboardingInnerTab === 'assets' ? 'active' : ''}`}
                  onClick={() => setOnboardingInnerTab('assets')}
                >
                  Assets ({onboardingDetailData?.assets?.length || 0})
                </button>
                <button
                  type="button"
                  className={`exit-detail-tab-btn ${onboardingInnerTab === 'access' ? 'active' : ''}`}
                  onClick={() => setOnboardingInnerTab('access')}
                >
                  Access Status
                </button>
              </div>

              <div className="hr-modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
                {/* INNER TAB 1: 17-ITEM CHECKLIST */}
                {onboardingInnerTab === 'checklist' && (
                  <div>
                    {['Documentation', 'Finance', 'IT Setup', 'HR & Orientation'].map((cat) => {
                      const catTasks = (selectedOnboarding.checklist || []).filter((t) => t.category === cat);
                      if (catTasks.length === 0) return null;
                      return (
                        <div key={cat} className="exit-checklist-category">
                          <div className="exit-checklist-cat-header">
                            <h4>{cat === 'Documentation' ? '📄 Document Verification' : cat === 'Finance' ? '💰 Bank & Payroll Setup' : cat === 'IT Setup' ? '💻 IT Hardware & Workstation Setup' : '🤝 HR Induction & Culture'}</h4>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {catTasks.filter((t) => t.status === 'Completed').length} / {catTasks.length} Completed
                            </span>
                          </div>
                          <div>
                            {catTasks.map((item) => {
                              const isDone = item.status === 'Completed';
                              return (
                                <div key={item._id} className="exit-checklist-item-row">
                                  <div className="exit-checklist-item-left">
                                    <input
                                      type="checkbox"
                                      className="exit-checklist-checkbox"
                                      checked={isDone}
                                      disabled={checklistUpdateLoading}
                                      onChange={() => handleToggleChecklistItem(item._id, item.status)}
                                    />
                                    <div className="exit-checklist-task-info">
                                      <span className="exit-checklist-task-title" style={{ textDecoration: isDone ? 'line-through' : 'none', color: isDone ? '#64748b' : '#1e293b' }}>
                                        {item.task}
                                      </span>
                                      <div className="exit-checklist-task-meta">
                                        <span>Owner: <strong>{item.owner || 'HR'}</strong></span>
                                        {item.dueDate && <span>&bull; Due: {formatDate(item.dueDate)}</span>}
                                        {item.completionDate && <span style={{ color: '#16A34A' }}>&bull; Done: {formatDate(item.completionDate)}</span>}
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    <button
                                      type="button"
                                      className={`exit-badge ${isDone ? 'completed' : item.status === 'In Progress' ? 'under_review' : 'submitted'}`}
                                      style={{ border: 'none', cursor: 'pointer', padding: '4px 10px' }}
                                      onClick={() => handleToggleChecklistItem(item._id, item.status)}
                                    >
                                      {item.status}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* INNER TAB 2: LIVE DOCUMENTS */}
                {onboardingInnerTab === 'documents' && (
                  <div>
                    <h4 style={{ margin: '0 0 0.75rem 0', color: '#0f172a' }}>Employee Document Records</h4>
                    {(!onboardingDetailData?.documents || onboardingDetailData.documents.length === 0) ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', background: '#F8FAFC', borderRadius: '8px' }}>
                        No uploaded documents found for this employee yet. Identity and contract files will show here automatically once uploaded.
                      </div>
                    ) : (
                      <table className="exit-table">
                        <thead>
                          <tr>
                            <th>Document Name</th>
                            <th>Category</th>
                            <th>Uploaded Date</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {onboardingDetailData.documents.map((doc) => (
                            <tr key={doc._id}>
                              <td><strong>{doc.name || doc.title || 'Document'}</strong></td>
                              <td>{doc.category || 'General'}</td>
                              <td>{formatDate(doc.createdAt)}</td>
                              <td><span className="exit-badge completed">{doc.status || 'Verified'}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* INNER TAB 3: LIVE ASSETS */}
                {onboardingInnerTab === 'assets' && (
                  <div>
                    <h4 style={{ margin: '0 0 0.75rem 0', color: '#0f172a' }}>Allocated IT Assets</h4>
                    {(!onboardingDetailData?.assets || onboardingDetailData.assets.length === 0) ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', background: '#F8FAFC', borderRadius: '8px' }}>
                        No hardware assets currently allocated. Assigned laptops, access cards, and monitors will appear here automatically.
                      </div>
                    ) : (
                      <table className="exit-table">
                        <thead>
                          <tr>
                            <th>Asset Tag</th>
                            <th>Model / Name</th>
                            <th>Type</th>
                            <th>Allocated Date</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {onboardingDetailData.assets.map((asset) => (
                            <tr key={asset._id}>
                              <td><strong>{asset.assetTag || asset.assetId || '—'}</strong></td>
                              <td>{asset.model || asset.name}</td>
                              <td>{asset.type || 'Hardware'}</td>
                              <td>{formatDate(asset.allocationDate || asset.assignedAt)}</td>
                              <td><span className="exit-badge approved">{asset.status || 'Allocated'}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* INNER TAB 4: ACCESS STATUS */}
                {onboardingInnerTab === 'access' && (
                  <div>
                    <h4 style={{ margin: '0 0 0.75rem 0', color: '#0f172a' }}>System Access &amp; Permissions</h4>
                    <div style={{ background: '#F8FAFC', padding: '1.25rem', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Account Status</span>
                          <strong style={{ fontSize: '1rem', color: '#16A34A' }}>
                            {onboardingDetailData?.user?.isActive ? 'Active User' : 'Pending Activation'}
                          </strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Employment Status</span>
                          <strong style={{ fontSize: '1rem', color: '#0284C7' }}>
                            {onboardingDetailData?.user?.employmentStatus || 'Onboarding'}
                          </strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Role</span>
                          <strong style={{ fontSize: '1rem', color: '#0F172A' }}>
                            {onboardingDetailData?.user?.role || 'Employee'}
                          </strong>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="exit-secondary-btn"
                      onClick={() => handleGoToAccessTab(selectedOnboarding.employee?.email || '')}
                    >
                      Manage System Credentials in Tab 8 ↗
                    </button>
                  </div>
                )}
              </div>

              <div className="hr-modal-footer">
                <button type="button" className="hr-btn-secondary" onClick={() => setShowOnboardingDrawer(false)}>
                  Close
                </button>
                {selectedOnboarding.status !== 'Completed' && (
                  <button
                    type="button"
                    className="hr-btn-primary"
                    style={{ background: '#16A34A', borderColor: '#16A34A' }}
                    disabled={submitting}
                    onClick={() => handleCompleteOnboarding(selectedOnboarding._id)}
                  >
                    {submitting ? 'Activating...' : 'Complete Onboarding & Activate Employee'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Interactive Employee Lifecycle Details Modal */}
        {showLifecycleModal && (
          <div className="hr-modal-overlay" onClick={() => setShowLifecycleModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '920px' }}>
              <div className="hr-modal-header">
                <div>
                  <h3 style={{ margin: 0 }}>
                    Employee Full Lifecycle Progression
                  </h3>
                  <span style={{ fontSize: '0.825rem', color: '#64748b' }}>
                    {lifecycleDetailData?.user?.firstName ? `${lifecycleDetailData.user.firstName} ${lifecycleDetailData.user.lastName || ''}` : lifecycleRecord?.employee?.name || lifecycleRecord?.user?.email || 'Employee Profile'} &bull; {lifecycleDetailData?.user?.jobDetails?.employeeId || lifecycleRecord?.employeeId || 'ID'} &bull; {lifecycleDetailData?.user?.department || lifecycleRecord?.department || 'Tech'}
                  </span>
                </div>
                <button type="button" className="hr-modal-close" onClick={() => setShowLifecycleModal(false)}>&times;</button>
              </div>

              <div className="hr-modal-body" style={{ padding: '1.25rem 1.5rem' }}>
                {lifecycleLoading ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                    Loading employee lifecycle data...
                  </div>
                ) : (
                  <div>
                    {/* Horizontal 9-Stage Interactive Stepper */}
                    <div className="exit-lifecycle-stepper">
                      {[
                        { title: '1. Onboarding', sub: 'Pre-Joining & Setup' },
                        { title: '2. Active Employee', sub: 'Active Workforce' },
                        { title: '3. Resignation', sub: 'Notice Intimation' },
                        { title: '4. Notice Period', sub: 'Serving Tenure' },
                        { title: '5. Offboarding', sub: 'Handover & KT' },
                        { title: '6. Exit Clearance', sub: 'Dept Dues & Assets' },
                        { title: '7. Exit Interview', sub: 'Feedback & Rehire' },
                        { title: '8. Settlement', sub: 'F&F Settlement' },
                        { title: '9. Exited', sub: 'Access Revoked' },
                      ].map((st, idx) => {
                        const isDone = idx < lifecycleActiveStageIndex;
                        const isCurrent = idx === lifecycleActiveStageIndex;
                        const cls = isCurrent ? 'active' : isDone ? 'completed' : 'pending';

                        return (
                          <div
                            key={st.title}
                            className={`exit-lifecycle-step ${cls}`}
                            onClick={() => setLifecycleActiveStageIndex(idx)}
                          >
                            <div className="exit-lifecycle-circle">
                              {isDone ? '✓' : idx + 1}
                            </div>
                            <span className="exit-lifecycle-title">{st.title}</span>
                            <span className="exit-lifecycle-sub">{st.sub}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Stage Details Panel */}
                    <div className="exit-lifecycle-panel">
                      <div className="exit-lifecycle-panel-header">
                        <h4>
                          {[
                            'Stage 1: Employee Onboarding & Verification',
                            'Stage 2: Active Employee Service & Operations',
                            'Stage 3: Resignation Submission & Review',
                            'Stage 4: Notice Period Tracking & Transition',
                            'Stage 5: Department Offboarding & Handover',
                            'Stage 6: Multi-Department Exit Clearance',
                            'Stage 7: Exit Interview Evaluation',
                            'Stage 8: Full & Final Settlement Calculation',
                            'Stage 9: Completed Exit & Access Revocation',
                          ][lifecycleActiveStageIndex]}
                        </h4>
                        <span className={`exit-badge ${lifecycleActiveStageIndex <= 1 ? 'completed' : 'under_review'}`}>
                          {lifecycleActiveStageIndex === 0 ? 'Onboarding' : lifecycleActiveStageIndex === 1 ? 'Active' : lifecycleActiveStageIndex === 8 ? 'Completed Exit' : 'In Transition'}
                        </span>
                      </div>

                      {/* Stage 0: Onboarding */}
                      {lifecycleActiveStageIndex === 0 && (
                        <div>
                          <p style={{ color: '#475569', fontSize: '0.875rem' }}>
                            Onboarding establishes the employee identity, collects compliance documents, provisions IT equipment, and assigns initial induction workflows.
                          </p>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', background: '#F8FAFC', padding: '1rem', borderRadius: '8px' }}>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Checklist Tasks</span>
                              <div style={{ fontWeight: 700, color: '#0F172A' }}>
                                {lifecycleDetailData?.onboarding?.checklist?.length || 17} Verification Items
                              </div>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Status</span>
                              <div style={{ fontWeight: 700, color: '#0284C7' }}>
                                {lifecycleDetailData?.onboarding?.status || 'Active'}
                              </div>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Joining Date</span>
                              <div style={{ fontWeight: 700, color: '#16A34A' }}>
                                {formatDate(lifecycleDetailData?.onboarding?.joiningDate || lifecycleDetailData?.user?.jobDetails?.joiningDate)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Stage 1: Active Employee */}
                      {lifecycleActiveStageIndex === 1 && (
                        <div>
                          <p style={{ color: '#475569', fontSize: '0.875rem' }}>
                            Active employee phase covers day-to-day operations, attendance management, performance evaluations, and active payroll.
                          </p>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', background: '#F8FAFC', padding: '1rem', borderRadius: '8px' }}>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Employment Status</span>
                              <div style={{ fontWeight: 700, color: '#16A34A' }}>
                                {lifecycleDetailData?.user?.employmentStatus || 'Active'}
                              </div>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>System Access</span>
                              <div style={{ fontWeight: 700, color: '#0284C7' }}>
                                {lifecycleDetailData?.user?.isActive ? 'Granted & Enabled' : 'Restricted'}
                              </div>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Designation</span>
                              <div style={{ fontWeight: 700, color: '#0F172A' }}>
                                {lifecycleDetailData?.user?.designation || lifecycleDetailData?.user?.jobDetails?.designation || 'Associate'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Stages 2-8: Exit Lifecycle breakdown */}
                      {lifecycleActiveStageIndex >= 2 && (
                        <div>
                          <p style={{ color: '#475569', fontSize: '0.875rem' }}>
                            {lifecycleActiveStageIndex === 2 && 'Formal resignation submitted with proposed last working day and business justification.'}
                            {lifecycleActiveStageIndex === 3 && 'Employee serving notice period tenure with KT commitments and waiver tracking.'}
                            {lifecycleActiveStageIndex === 4 && 'Operational handover, key project asset transfers, and knowledge transfer sign-off.'}
                            {lifecycleActiveStageIndex === 5 && 'Inter-departmental clearance verifying IT assets, Finance dues, HR formalities, and Admin badges.'}
                            {lifecycleActiveStageIndex === 6 && 'Exit interview capturing reasons for leaving, company feedback, and rehire eligibility.'}
                            {lifecycleActiveStageIndex === 7 && 'Full & final settlement calculating gratuity, encashment, recovery deductions, and net payable.'}
                            {lifecycleActiveStageIndex === 8 && 'Employee officially exited and archived with email/system access revoked.'}
                          </p>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', background: '#F8FAFC', padding: '1rem', borderRadius: '8px' }}>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Exit Status</span>
                              <div style={{ fontWeight: 700, color: '#EA580C' }}>
                                {lifecycleDetailData?.resignation?.status || 'In Progress'}
                              </div>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Last Working Day</span>
                              <div style={{ fontWeight: 700, color: '#0F172A' }}>
                                {formatDate(lifecycleDetailData?.resignation?.approvedLastWorkingDay || lifecycleDetailData?.resignation?.proposedLastWorkingDay)}
                              </div>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Clearance / Settlement</span>
                              <div style={{ fontWeight: 700, color: '#16A34A' }}>
                                {lifecycleDetailData?.resignation?.clearance?.finance?.settlementStatus || 'Pending'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="hr-modal-footer">
                <button type="button" className="hr-btn-secondary" onClick={() => setShowLifecycleModal(false)}>
                  Close Lifecycle View
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
}
