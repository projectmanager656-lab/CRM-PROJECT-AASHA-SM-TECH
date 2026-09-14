import { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import apiClient from '../../../../../services/apiClient';
import UserLayout from '../components/UserLayout';
import './HREmployees.css';

const initialsFor = (firstName, lastName, email) => {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return 'EM';
};

const formatDate = (val) => {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return String(val);
  }
};

const formatCurrency = (amount, currency = 'INR') => {
  const num = Number(amount || 0);
  return `${currency === 'INR' ? '₹' : currency + ' '}${num.toLocaleString('en-IN')}`;
};

const generateEmployeeId = () => {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `EMP-${randomNum}`;
};

export default function HREmployees() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & Multi-Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedDesignation, setSelectedDesignation] = useState('All');
  const [selectedEmploymentType, setSelectedEmploymentType] = useState('All');
  const [selectedManager, setSelectedManager] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState('personal');

  // Selected Employee
  const [selectedEmp, setSelectedEmp] = useState(null);

  // 360 Profile Data (Safety: loaded strictly for selected employee)
  const [profileLoading, setProfileLoading] = useState(false);
  const [employee360Data, setEmployee360Data] = useState({
    attendance: [],
    leaves: [],
    payroll: [],
    performance: [],
    trainingAssignments: [],
    certifications: [],
    documents: [],
    assets: [],
    history: [],
  });

  // Transfer & Role Change Form
  const [transferForm, setTransferForm] = useState({
    changeType: 'Transfer',
    department: '',
    designation: '',
    reportingManager: '',
    workLocation: '',
    effectiveDate: new Date().toISOString().slice(0, 10),
    reason: '',
    remarks: '',
  });

  // Lifecycle Status Form
  const [statusForm, setStatusForm] = useState({
    status: 'Active',
    effectiveDate: new Date().toISOString().slice(0, 10),
    reason: '',
    remarks: '',
  });

  // Add Employee Form State (3 Structured Sections)
  const [addForm, setAddForm] = useState({
    personalInfo: {
      profilePhoto: '',
      fullName: '',
      email: '',
      phoneNumber: '',
      dateOfBirth: '',
      gender: '',
      address: '',
    },
    jobDetails: {
      employeeId: '',
      department: 'HR',
      designation: '',
      joiningDate: new Date().toISOString().slice(0, 10),
      employmentType: 'Full Time',
      reportingManager: '',
      workLocation: 'Pune Office',
      employmentStatus: 'Active',
    },
    bankDetails: {
      accountHolderName: '',
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      branchName: '',
    },
  });

  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  // Edit Employee Form State
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    department: 'HR',
    designation: '',
    employmentType: 'Full Time',
    workLocation: '',
    isActive: true,
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, deptsRes] = await Promise.all([
        apiClient.get('/users'),
        apiClient
          .get('/departments')
          .catch(() => apiClient.get('/admin/departments'))
          .catch(() => ({ data: { data: [] } })),
      ]);
      setEmployees(usersRes.data?.data || []);
      setDepartments(deptsRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load employee records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (showAddModal || showEditModal || showViewModal || showTransferModal || showStatusModal) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [showAddModal, showEditModal, showViewModal, showTransferModal, showStatusModal]);

  // Derived filter options from real DB
  const departmentOptions = useMemo(() => {
    const fromMaster = departments.map((d) => d.name).filter(Boolean);
    const fromUsers = employees.map((e) => e.jobDetails?.department || e.department).filter(Boolean);
    return Array.from(new Set([...fromMaster, ...fromUsers])).sort();
  }, [departments, employees]);

  const designationOptions = useMemo(() => {
    const desigs = employees.map((e) => e.jobDetails?.designation || e.designation).filter(Boolean);
    return Array.from(new Set(desigs)).sort();
  }, [employees]);

  const managerOptions = useMemo(() => {
    const mgrs = employees
      .map((e) => e.personalInfo?.fullName || [e.firstName, e.lastName].filter(Boolean).join(' ') || e.email)
      .filter(Boolean);
    return Array.from(new Set(mgrs)).sort();
  }, [employees]);

  const locationOptions = useMemo(() => {
    const locs = employees.map((e) => e.jobDetails?.workLocation || e.location).filter(Boolean);
    return Array.from(new Set(locs)).sort();
  }, [employees]);

  // Dynamic 6 KPI Summary Calculations
  const totalCount = employees.length;
  const activeCount = employees.filter(
    (e) => e.isActive !== false && (e.employmentStatus === 'Active' || !e.employmentStatus)
  ).length;
  const probationCount = employees.filter((e) => e.employmentStatus === 'Probation').length;
  const onLeaveCount = employees.filter((e) => e.employmentStatus === 'On Leave').length;
  const noticeCount = employees.filter((e) => e.employmentStatus === 'Notice Period').length;
  const inactiveCount = employees.filter(
    (e) => !e.isActive || ['Inactive', 'Exited', 'Terminated'].includes(e.employmentStatus)
  ).length;

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const fullName = (
        emp.personalInfo?.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`
      ).toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const empId = (emp.jobDetails?.employeeId || '').toLowerCase();
      const q = search.toLowerCase().trim();

      const matchesSearch = !q || fullName.includes(q) || email.includes(q) || empId.includes(q);

      const dept = emp.jobDetails?.department || emp.department || '';
      const matchesDept = selectedDept === 'All' || dept === selectedDept;

      const desig = emp.jobDetails?.designation || emp.designation || '';
      const matchesDesig = selectedDesignation === 'All' || desig === selectedDesignation;

      const empType = emp.jobDetails?.employmentType || 'Full Time';
      const matchesType = selectedEmploymentType === 'All' || empType === selectedEmploymentType;

      const mgr = emp.jobDetails?.reportingManager || '';
      const matchesMgr = selectedManager === 'All' || mgr === selectedManager;

      const loc = emp.jobDetails?.workLocation || emp.location || '';
      const matchesLoc = selectedLocation === 'All' || loc === selectedLocation;

      // Status filter logic
      let matchesStatus = true;
      if (selectedStatus === 'Active') {
        matchesStatus = emp.isActive !== false && (emp.employmentStatus === 'Active' || !emp.employmentStatus);
      } else if (selectedStatus === 'Probation') {
        matchesStatus = emp.employmentStatus === 'Probation';
      } else if (selectedStatus === 'On Leave') {
        matchesStatus = emp.employmentStatus === 'On Leave';
      } else if (selectedStatus === 'Notice Period') {
        matchesStatus = emp.employmentStatus === 'Notice Period';
      } else if (selectedStatus === 'Inactive') {
        matchesStatus = !emp.isActive || emp.employmentStatus === 'Inactive';
      } else if (selectedStatus === 'Exited') {
        matchesStatus = emp.employmentStatus === 'Exited' || emp.employmentStatus === 'Terminated';
      }

      return matchesSearch && matchesDept && matchesDesig && matchesType && matchesMgr && matchesLoc && matchesStatus;
    });
  }, [
    employees,
    search,
    selectedDept,
    selectedDesignation,
    selectedEmploymentType,
    selectedManager,
    selectedLocation,
    selectedStatus,
  ]);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedDept('All');
    setSelectedDesignation('All');
    setSelectedEmploymentType('All');
    setSelectedManager('All');
    setSelectedStatus('All');
    setSelectedLocation('All');
  };

  // ── Open 360° Profile View Modal (Strictly isolated to selected employee) ──
  const handleOpenView = async (emp) => {
    setSelectedEmp(emp);
    setActiveProfileTab('personal');
    setShowViewModal(true);
    setProfileLoading(true);

    try {
      const [
        attRes,
        leaveRes,
        payRes,
        perfRes,
        trainAssignRes,
        trainCertRes,
        docRes,
        assetRes,
        historyRes,
      ] = await Promise.all([
        apiClient.get('/attendance', { params: { user: emp._id } }).catch(() => ({ data: { data: [] } })),
        apiClient.get('/leave-requests', { params: { user: emp._id } }).catch(() => ({ data: { data: [] } })),
        apiClient.get('/payroll', { params: { user: emp._id } }).catch(() => ({ data: { data: [] } })),
        apiClient.get('/performance', { params: { user: emp._id } }).catch(() => ({ data: { data: [] } })),
        apiClient.get('/training/assignments', { params: { employee: emp._id } }).catch(() => ({ data: { data: [] } })),
        apiClient.get('/training/certifications', { params: { employee: emp._id } }).catch(() => ({ data: { data: [] } })),
        apiClient.get('/documents', { params: { owner: emp._id } }).catch(() => ({ data: { data: [] } })),
        apiClient.get('/assets', { params: { assignedTo: emp._id } }).catch(() => ({ data: { data: [] } })),
        apiClient.get(`/users/${emp._id}/history`).catch(() => ({ data: { data: emp.lifecycleHistory || [] } })),
      ]);

      setEmployee360Data({
        attendance: attRes.data?.data || [],
        leaves: leaveRes.data?.data || [],
        payroll: payRes.data?.data || [],
        performance: perfRes.data?.data || [],
        trainingAssignments: trainAssignRes.data?.data || [],
        certifications: trainCertRes.data?.data || [],
        documents: docRes.data?.data || [],
        assets: assetRes.data?.data || [],
        history: historyRes.data?.data || emp.lifecycleHistory || [],
      });
    } catch (e) {
      console.error('Failed to load employee 360 profile data:', e);
    } finally {
      setProfileLoading(false);
    }
  };

  // ── Open Transfer / Role Change Modal ──
  const handleOpenTransfer = (emp) => {
    setError('');
    setSuccess('');
    setSelectedEmp(emp);
    setTransferForm({
      changeType: 'Transfer',
      department: emp.jobDetails?.department || emp.department || departmentOptions[0] || 'HR',
      designation: emp.jobDetails?.designation || emp.designation || '',
      reportingManager: emp.jobDetails?.reportingManager || '',
      workLocation: emp.jobDetails?.workLocation || emp.location || 'Pune Office',
      effectiveDate: new Date().toISOString().slice(0, 10),
      reason: '',
      remarks: '',
    });
    setShowTransferModal(true);
  };

  const handleSubmitTransfer = async (e) => {
    e.preventDefault();
    if (!selectedEmp) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await apiClient.post(`/users/${selectedEmp._id}/transfer`, transferForm);
      setShowTransferModal(false);
      setSuccess('Employee transfer / role update successfully applied to MongoDB Atlas!');
      await loadData();
      if (showViewModal) {
        setSelectedEmp(res.data?.data || selectedEmp);
        const historyRes = await apiClient.get(`/users/${selectedEmp._id}/history`).catch(() => ({ data: { data: [] } }));
        setEmployee360Data((prev) => ({ ...prev, history: historyRes.data?.data || [] }));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to apply employee transfer.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Open Status Management Modal ──
  const handleOpenStatus = (emp) => {
    setError('');
    setSuccess('');
    setSelectedEmp(emp);
    setStatusForm({
      status: emp.employmentStatus || (emp.isActive ? 'Active' : 'Inactive'),
      effectiveDate: new Date().toISOString().slice(0, 10),
      reason: '',
      remarks: '',
    });
    setShowStatusModal(true);
  };

  const handleSubmitStatus = async (e) => {
    e.preventDefault();
    if (!selectedEmp) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await apiClient.patch(`/users/${selectedEmp._id}/status`, statusForm);
      setShowStatusModal(false);
      setSuccess(`Employee status updated to ${statusForm.status} successfully!`);
      await loadData();
      if (showViewModal) {
        setSelectedEmp(res.data?.data || selectedEmp);
        const historyRes = await apiClient.get(`/users/${selectedEmp._id}/history`).catch(() => ({ data: { data: [] } }));
        setEmployee360Data((prev) => ({ ...prev, history: historyRes.data?.data || [] }));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update employee status.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Open Quick Edit Modal ──
  const handleOpenEdit = (emp) => {
    setError('');
    setSuccess('');
    setSelectedEmp(emp);
    setEditFormData({
      firstName: emp.firstName || emp.personalInfo?.fullName?.split(' ')[0] || '',
      lastName: emp.lastName || emp.personalInfo?.fullName?.split(' ').slice(1).join(' ') || '',
      email: emp.email || emp.personalInfo?.email || '',
      phone: emp.phone || emp.personalInfo?.phoneNumber || '',
      department: emp.department || emp.jobDetails?.department || departmentOptions[0] || 'HR',
      designation: emp.designation || emp.jobDetails?.designation || '',
      employmentType: emp.jobDetails?.employmentType || 'Full Time',
      workLocation: emp.jobDetails?.workLocation || emp.location || '',
      isActive: emp.isActive !== false,
    });
    setShowEditModal(true);
  };

  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    if (!selectedEmp) return;
    setSubmitting(true);
    setError('');
    try {
      await apiClient.put(`/users/${selectedEmp._id}`, editFormData);
      setShowEditModal(false);
      setSuccess('Employee profile updated successfully!');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update employee.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Open Add Employee Modal ──
  const handleOpenAdd = () => {
    setError('');
    setSuccess('');
    setFormErrors({});
    const defaultDept = departmentOptions[0] || 'HR';
    const autoId = generateEmployeeId();

    setAddForm({
      personalInfo: {
        profilePhoto: '',
        fullName: '',
        email: '',
        phoneNumber: '',
        dateOfBirth: '',
        gender: '',
        address: '',
      },
      jobDetails: {
        employeeId: autoId,
        department: defaultDept,
        designation: '',
        joiningDate: new Date().toISOString().slice(0, 10),
        employmentType: 'Full Time',
        reportingManager: '',
        workLocation: 'Pune Office',
        employmentStatus: 'Active',
      },
      bankDetails: {
        accountHolderName: '',
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        branchName: '',
      },
    });

    setShowAddModal(true);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setFormErrors((prev) => ({ ...prev, 'personalInfo.profilePhoto': 'Image must be under 2MB.' }));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAddForm((prev) => ({
          ...prev,
          personalInfo: { ...prev.personalInfo, profilePhoto: reader.result },
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validateAddForm = () => {
    const errs = {};
    const { personalInfo, jobDetails, bankDetails } = addForm;

    if (!personalInfo.fullName.trim()) errs['personalInfo.fullName'] = 'Full Name is required.';
    if (!personalInfo.email.trim()) {
      errs['personalInfo.email'] = 'Email Address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalInfo.email.trim())) {
      errs['personalInfo.email'] = 'Please enter a valid email address.';
    }
    if (!personalInfo.phoneNumber.trim()) {
      errs['personalInfo.phoneNumber'] = 'Phone Number is required.';
    }

    if (!jobDetails.department) errs['jobDetails.department'] = 'Department is required.';
    if (!jobDetails.designation.trim()) errs['jobDetails.designation'] = 'Designation is required.';
    if (!jobDetails.joiningDate) errs['jobDetails.joiningDate'] = 'Joining Date is required.';

    if (!bankDetails.accountHolderName.trim()) errs['bankDetails.accountHolderName'] = 'Account Holder Name is required.';
    if (!bankDetails.bankName.trim()) errs['bankDetails.bankName'] = 'Bank Name is required.';
    if (!bankDetails.accountNumber.trim()) {
      errs['bankDetails.accountNumber'] = 'Account Number is required.';
    } else if (!/^\d+$/.test(bankDetails.accountNumber.trim())) {
      errs['bankDetails.accountNumber'] = 'Account Number must contain digits only.';
    }
    if (!bankDetails.ifscCode.trim()) errs['bankDetails.ifscCode'] = 'IFSC Code is required.';

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    if (!validateAddForm()) return;

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        fullName: addForm.personalInfo.fullName,
        email: addForm.personalInfo.email,
        phone: addForm.personalInfo.phoneNumber,
        department: addForm.jobDetails.department,
        designation: addForm.jobDetails.designation,
        employmentStatus: addForm.jobDetails.employmentStatus || 'Active',
        personalInfo: addForm.personalInfo,
        jobDetails: addForm.jobDetails,
        bankDetails: addForm.bankDetails,
        role: 'employee',
        isActive: true,
      };

      await apiClient.post('/users', payload);
      setShowAddModal(false);
      setSuccess('Employee successfully onboarded and saved to MongoDB Atlas!');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create employee record.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusClass = (emp) => {
    if (!emp.isActive || emp.employmentStatus === 'Inactive') return 'inactive';
    if (emp.employmentStatus === 'Exited' || emp.employmentStatus === 'Terminated') return 'exited';
    if (emp.employmentStatus === 'Probation') return 'probation';
    if (emp.employmentStatus === 'On Leave') return 'on-leave';
    if (emp.employmentStatus === 'Notice Period') return 'notice-period';
    return 'active';
  };

  const getStatusLabel = (emp) => {
    if (emp.employmentStatus === 'Exited') return 'Exited';
    if (emp.employmentStatus === 'Terminated') return 'Terminated';
    if (emp.employmentStatus === 'Probation') return 'On Probation';
    if (emp.employmentStatus === 'On Leave') return 'On Leave';
    if (emp.employmentStatus === 'Notice Period') return 'Notice Period';
    if (!emp.isActive || emp.employmentStatus === 'Inactive') return 'Inactive';
    return 'Active';
  };

  return (
    <UserLayout pageTitle="Employee Management">
      <div className="hr-emp-container">
        {/* Header */}
        <div className="hr-emp-header">
          <div className="hr-emp-title-area">
            <h2>Employee Management</h2>
            <p>Enterprise workforce directory, internal transfers, lifecycle tracking & 360° HR records.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button type="button" className="hr-emp-refresh-btn" onClick={loadData} title="Refresh Live Records">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '15px', height: '15px' }}>
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Refresh
            </button>
            <button type="button" className="hr-emp-add-btn" onClick={handleOpenAdd}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Employee
            </button>
          </div>
        </div>

        {/* ─── DYNAMIC 6 KPI SUMMARY CARDS (Proportional Rule: ICON SIZE + TEXT SIZE = CARD SIZE) ─── */}
        <div className="hr-emp-stats-grid">
          {/* Card 1: Total Employees */}
          <div
            className={`hr-emp-stat-card blue ${selectedStatus === 'All' ? 'selected-filter' : ''}`}
            onClick={() => setSelectedStatus('All')}
            title="Click to view all employees"
          >
            <div className="hr-emp-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="hr-emp-stat-body">
              <span>Total Employees</span>
              <strong>{totalCount}</strong>
            </div>
          </div>

          {/* Card 2: Active Employees */}
          <div
            className={`hr-emp-stat-card green ${selectedStatus === 'Active' ? 'selected-filter' : ''}`}
            onClick={() => setSelectedStatus(selectedStatus === 'Active' ? 'All' : 'Active')}
            title="Click to filter Active employees"
          >
            <div className="hr-emp-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className="hr-emp-stat-body">
              <span>Active Staff</span>
              <strong>{activeCount}</strong>
            </div>
          </div>

          {/* Card 3: On Probation */}
          <div
            className={`hr-emp-stat-card indigo ${selectedStatus === 'Probation' ? 'selected-filter' : ''}`}
            onClick={() => setSelectedStatus(selectedStatus === 'Probation' ? 'All' : 'Probation')}
            title="Click to filter On Probation employees"
          >
            <div className="hr-emp-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="hr-emp-stat-body">
              <span>On Probation</span>
              <strong>{probationCount}</strong>
            </div>
          </div>

          {/* Card 4: On Leave */}
          <div
            className={`hr-emp-stat-card amber ${selectedStatus === 'On Leave' ? 'selected-filter' : ''}`}
            onClick={() => setSelectedStatus(selectedStatus === 'On Leave' ? 'All' : 'On Leave')}
            title="Click to filter On Leave employees"
          >
            <div className="hr-emp-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div className="hr-emp-stat-body">
              <span>On Leave</span>
              <strong>{onLeaveCount}</strong>
            </div>
          </div>

          {/* Card 5: Notice Period */}
          <div
            className={`hr-emp-stat-card orange ${selectedStatus === 'Notice Period' ? 'selected-filter' : ''}`}
            onClick={() => setSelectedStatus(selectedStatus === 'Notice Period' ? 'All' : 'Notice Period')}
            title="Click to filter Notice Period employees"
          >
            <div className="hr-emp-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div className="hr-emp-stat-body">
              <span>Notice Period</span>
              <strong>{noticeCount}</strong>
            </div>
          </div>

          {/* Card 6: Inactive / Exited */}
          <div
            className={`hr-emp-stat-card slate ${selectedStatus === 'Inactive' ? 'selected-filter' : ''}`}
            onClick={() => setSelectedStatus(selectedStatus === 'Inactive' ? 'All' : 'Inactive')}
            title="Click to filter Inactive & Exited staff"
          >
            <div className="hr-emp-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div className="hr-emp-stat-body">
              <span>Inactive / Exited</span>
              <strong>{inactiveCount}</strong>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="hr-emp-toast error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
            <button type="button" onClick={() => setError('')}>&times;</button>
          </div>
        )}
        {success && (
          <div className="hr-emp-toast success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{success}</span>
            <button type="button" onClick={() => setSuccess('')}>&times;</button>
          </div>
        )}

        {/* ─── MULTI-FILTER TOOLBAR ─── */}
        <div className="hr-emp-toolbar-card">
          <div className="hr-emp-search-wrap">
            <svg className="hr-emp-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, EMP ID, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="hr-search-clear" onClick={() => setSearch('')}>
                &times;
              </button>
            )}
          </div>

          <div className="hr-emp-filters-group">
            {/* Department Filter (Dynamic from MongoDB Atlas) */}
            <select
              className="hr-emp-filter-select"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              title="Filter by Department"
            >
              <option value="All">All Departments ({departmentOptions.length})</option>
              {departmentOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {/* Designation Filter */}
            <select
              className="hr-emp-filter-select"
              value={selectedDesignation}
              onChange={(e) => setSelectedDesignation(e.target.value)}
              title="Filter by Designation"
            >
              <option value="All">All Designations</option>
              {designationOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {/* Employment Type Filter */}
            <select
              className="hr-emp-filter-select"
              value={selectedEmploymentType}
              onChange={(e) => setSelectedEmploymentType(e.target.value)}
              title="Filter by Employment Type"
            >
              <option value="All">All Types</option>
              <option value="Full Time">Full Time</option>
              <option value="Part Time">Part Time</option>
              <option value="Intern">Intern</option>
              <option value="Contract">Contract</option>
            </select>

            {/* Status Filter */}
            <select
              className="hr-emp-filter-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              title="Filter by Status"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Probation">On Probation</option>
              <option value="On Leave">On Leave</option>
              <option value="Notice Period">Notice Period</option>
              <option value="Inactive">Inactive</option>
              <option value="Exited">Exited / Terminated</option>
            </select>

            {/* Manager Filter */}
            {managerOptions.length > 0 && (
              <select
                className="hr-emp-filter-select"
                value={selectedManager}
                onChange={(e) => setSelectedManager(e.target.value)}
                title="Filter by Reporting Manager"
              >
                <option value="All">All Managers</option>
                {managerOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}

            {/* Location Filter */}
            {locationOptions.length > 0 && (
              <select
                className="hr-emp-filter-select"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                title="Filter by Work Location"
              >
                <option value="All">All Locations</option>
                {locationOptions.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            )}

            {/* Reset Filters */}
            {(search || selectedDept !== 'All' || selectedDesignation !== 'All' || selectedEmploymentType !== 'All' || selectedStatus !== 'All' || selectedManager !== 'All' || selectedLocation !== 'All') && (
              <button type="button" className="hr-emp-reset-btn" onClick={handleResetFilters}>
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Directory Count Bar */}
        <div className="hr-emp-results-bar">
          <span>
            Showing <strong>{filteredEmployees.length}</strong> of <strong>{employees.length}</strong> employees
          </span>
          {selectedStatus !== 'All' && (
            <span className="hr-active-filter-badge">
              Status: {selectedStatus}
              <button type="button" onClick={() => setSelectedStatus('All')}>&times;</button>
            </span>
          )}
          {selectedDept !== 'All' && (
            <span className="hr-active-filter-badge">
              Dept: {selectedDept}
              <button type="button" onClick={() => setSelectedDept('All')}>&times;</button>
            </span>
          )}
        </div>

        {/* ─── ENRICHED DIRECTORY TABLE ─── */}
        <div className="hr-emp-table-card">
          {loading ? (
            <div className="hr-emp-empty">
              <div className="hr-emp-spinner" />
              <p>Loading enterprise employee records from MongoDB Atlas...</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="hr-emp-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '40px', height: '40px', color: '#94a3b8', margin: '0 auto 0.5rem' }}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <p>No employees match your search and filter criteria.</p>
              <button type="button" className="hr-btn-secondary" onClick={handleResetFilters} style={{ marginTop: '0.5rem' }}>
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="hr-emp-table-wrap">
              <table className="hr-emp-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Employee ID</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Employment Type</th>
                    <th>Joining Date</th>
                    <th>Reporting Manager</th>
                    <th>Work Location</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => {
                    const initials = initialsFor(emp.firstName, emp.lastName, emp.email);
                    const name =
                      emp.personalInfo?.fullName ||
                      [emp.firstName, emp.lastName].filter(Boolean).join(' ') ||
                      emp.email;
                    const dept = emp.jobDetails?.department || emp.department || 'Unassigned';
                    const designation = emp.jobDetails?.designation || emp.designation || '—';
                    const empType = emp.jobDetails?.employmentType || 'Full Time';
                    const joiningDate = emp.jobDetails?.joiningDate || emp.createdAt;
                    const empCode =
                      emp.jobDetails?.employeeId ||
                      (emp._id ? `EMP-${String(emp._id).slice(-5).toUpperCase()}` : 'EMP-00000');
                    const manager = emp.jobDetails?.reportingManager || '—';
                    const location = emp.jobDetails?.workLocation || emp.location || '—';
                    const statusClass = getStatusClass(emp);
                    const statusLabel = getStatusLabel(emp);

                    return (
                      <tr key={emp._id || emp.email}>
                        <td>
                          <div className="hr-emp-user-cell">
                            {emp.personalInfo?.profilePhoto ? (
                              <img
                                src={emp.personalInfo.profilePhoto}
                                alt={name}
                                className="hr-emp-avatar"
                                style={{ objectFit: 'cover' }}
                              />
                            ) : (
                              <div className="hr-emp-avatar">{initials}</div>
                            )}
                            <div className="hr-emp-info-wrap">
                              <span className="hr-emp-name" onClick={() => handleOpenView(emp)} title="Click to view 360° Profile">
                                {name}
                              </span>
                              <span className="hr-emp-email-sub">{emp.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="hr-emp-code-badge">{empCode}</span>
                        </td>
                        <td>
                          <span className="hr-emp-dept-pill">{dept}</span>
                        </td>
                        <td>
                          <span className="hr-emp-desig-text">{designation}</span>
                        </td>
                        <td>
                          <span className="hr-emp-type-badge">{empType}</span>
                        </td>
                        <td>{formatDate(joiningDate)}</td>
                        <td>{manager}</td>
                        <td>{location}</td>
                        <td>
                          <span className={`hr-emp-status-badge ${statusClass}`}>
                            <span className="hr-emp-status-dot" />
                            {statusLabel}
                          </span>
                        </td>
                        <td>
                          {/* Compact, Single-Row Horizontal Actions */}
                          <div className="hr-emp-actions-row">
                            <button
                              type="button"
                              className="hr-emp-action-btn view"
                              onClick={() => handleOpenView(emp)}
                              title="View 360° Profile"
                            >
                              360° Profile
                            </button>
                            <button
                              type="button"
                              className="hr-emp-action-btn transfer"
                              onClick={() => handleOpenTransfer(emp)}
                              title="Transfer or Promote"
                            >
                              Transfer
                            </button>
                            <button
                              type="button"
                              className="hr-emp-action-btn status"
                              onClick={() => handleOpenStatus(emp)}
                              title="Update Status"
                            >
                              Status
                            </button>
                            <button
                              type="button"
                              className="hr-emp-action-btn edit"
                              onClick={() => handleOpenEdit(emp)}
                              title="Quick Edit Profile"
                            >
                              Edit
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

        {/* ─── 360° HR EMPLOYEE PROFILE VIEW MODAL ─── */}
        {showViewModal && selectedEmp && ReactDOM.createPortal(
          <div className="hr-modal-overlay" onClick={() => setShowViewModal(false)}>
            <div className="hr-modal-card hr-profile-modal-card" onClick={(e) => e.stopPropagation()}>
              {/* Header Banner */}
              <div className="hr-modal-header hr-profile-banner">
                <div className="hr-profile-banner-left">
                  {selectedEmp.personalInfo?.profilePhoto ? (
                    <img
                      src={selectedEmp.personalInfo.profilePhoto}
                      alt="Avatar"
                      className="hr-profile-avatar-lg"
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <div className="hr-profile-avatar-lg">
                      {initialsFor(selectedEmp.firstName, selectedEmp.lastName, selectedEmp.email)}
                    </div>
                  )}
                  <div className="hr-profile-banner-info">
                    <div className="hr-profile-banner-title-row">
                      <h3>
                        {selectedEmp.personalInfo?.fullName ||
                          [selectedEmp.firstName, selectedEmp.lastName].filter(Boolean).join(' ') ||
                          selectedEmp.email}
                      </h3>
                      <span className={`hr-emp-status-badge ${getStatusClass(selectedEmp)}`}>
                        <span className="hr-emp-status-dot" />
                        {getStatusLabel(selectedEmp)}
                      </span>
                    </div>
                    <div className="hr-profile-banner-meta">
                      <span className="hr-emp-code-badge">
                        {selectedEmp.jobDetails?.employeeId ||
                          (selectedEmp._id ? `EMP-${String(selectedEmp._id).slice(-5).toUpperCase()}` : 'EMP-00000')}
                      </span>
                      <span>·</span>
                      <span className="hr-emp-dept-pill">
                        {selectedEmp.jobDetails?.department || selectedEmp.department || 'General'}
                      </span>
                      <span>·</span>
                      <span style={{ color: '#475569', fontWeight: 500 }}>
                        {selectedEmp.jobDetails?.designation || selectedEmp.designation || 'Designation not specified'}
                      </span>
                      <span>·</span>
                      <span style={{ color: '#64748b' }}>
                        Joined {formatDate(selectedEmp.jobDetails?.joiningDate || selectedEmp.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="hr-profile-banner-actions">
                  <button
                    type="button"
                    className="hr-emp-action-btn transfer"
                    onClick={() => handleOpenTransfer(selectedEmp)}
                  >
                    Transfer / Promote
                  </button>
                  <button
                    type="button"
                    className="hr-emp-action-btn status"
                    onClick={() => handleOpenStatus(selectedEmp)}
                  >
                    Change Status
                  </button>
                  <button type="button" className="hr-modal-close" onClick={() => setShowViewModal(false)}>
                    &times;
                  </button>
                </div>
              </div>

              {/* 12 Tabs Navigation */}
              <div className="hr-profile-tabs-bar">
                <button
                  type="button"
                  className={`hr-profile-tab ${activeProfileTab === 'personal' ? 'active' : ''}`}
                  onClick={() => setActiveProfileTab('personal')}
                >
                  Personal
                </button>
                <button
                  type="button"
                  className={`hr-profile-tab ${activeProfileTab === 'job' ? 'active' : ''}`}
                  onClick={() => setActiveProfileTab('job')}
                >
                  Job & Org
                </button>
                <button
                  type="button"
                  className={`hr-profile-tab ${activeProfileTab === 'bank' ? 'active' : ''}`}
                  onClick={() => setActiveProfileTab('bank')}
                >
                  Bank & Pay
                </button>
                <button
                  type="button"
                  className={`hr-profile-tab ${activeProfileTab === 'attendance' ? 'active' : ''}`}
                  onClick={() => setActiveProfileTab('attendance')}
                >
                  Attendance ({employee360Data.attendance.length})
                </button>
                <button
                  type="button"
                  className={`hr-profile-tab ${activeProfileTab === 'leave' ? 'active' : ''}`}
                  onClick={() => setActiveProfileTab('leave')}
                >
                  Leaves ({employee360Data.leaves.length})
                </button>
                <button
                  type="button"
                  className={`hr-profile-tab ${activeProfileTab === 'payroll' ? 'active' : ''}`}
                  onClick={() => setActiveProfileTab('payroll')}
                >
                  Payroll ({employee360Data.payroll.length})
                </button>
                <button
                  type="button"
                  className={`hr-profile-tab ${activeProfileTab === 'performance' ? 'active' : ''}`}
                  onClick={() => setActiveProfileTab('performance')}
                >
                  Performance ({employee360Data.performance.length})
                </button>
                <button
                  type="button"
                  className={`hr-profile-tab ${activeProfileTab === 'training' ? 'active' : ''}`}
                  onClick={() => setActiveProfileTab('training')}
                >
                  Training ({employee360Data.trainingAssignments.length + employee360Data.certifications.length})
                </button>
                <button
                  type="button"
                  className={`hr-profile-tab ${activeProfileTab === 'documents' ? 'active' : ''}`}
                  onClick={() => setActiveProfileTab('documents')}
                >
                  Documents ({employee360Data.documents.length})
                </button>
                <button
                  type="button"
                  className={`hr-profile-tab ${activeProfileTab === 'assets' ? 'active' : ''}`}
                  onClick={() => setActiveProfileTab('assets')}
                >
                  Assets ({employee360Data.assets.length})
                </button>
                <button
                  type="button"
                  className={`hr-profile-tab ${activeProfileTab === 'access' ? 'active' : ''}`}
                  onClick={() => setActiveProfileTab('access')}
                >
                  Access
                </button>
                <button
                  type="button"
                  className={`hr-profile-tab ${activeProfileTab === 'history' ? 'active' : ''}`}
                  onClick={() => setActiveProfileTab('history')}
                >
                  History ({employee360Data.history.length})
                </button>
              </div>

              {/* Tab Content Body */}
              <div className="hr-modal-body hr-profile-modal-body">
                {profileLoading ? (
                  <div className="hr-emp-empty" style={{ padding: '3rem 1rem' }}>
                    <div className="hr-emp-spinner" />
                    <p>Loading real-time 360° employee data from MongoDB Atlas...</p>
                  </div>
                ) : (
                  <>
                    {/* TAB 1: Personal Information */}
                    {activeProfileTab === 'personal' && (
                      <div className="hr-360-grid">
                        <div className="hr-360-card">
                          <h4>Contact & Personal Information</h4>
                          <div className="hr-profile-details-grid">
                            <div className="hr-profile-item">
                              <span>Full Name</span>
                              <strong>
                                {selectedEmp.personalInfo?.fullName ||
                                  [selectedEmp.firstName, selectedEmp.lastName].filter(Boolean).join(' ') ||
                                  '—'}
                              </strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Email Address</span>
                              <strong>{selectedEmp.personalInfo?.email || selectedEmp.email || '—'}</strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Phone Number</span>
                              <strong>{selectedEmp.personalInfo?.phoneNumber || selectedEmp.phone || '—'}</strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Date of Birth</span>
                              <strong>{formatDate(selectedEmp.personalInfo?.dateOfBirth)}</strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Gender</span>
                              <strong>{selectedEmp.personalInfo?.gender || '—'}</strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Current Address</span>
                              <strong>{selectedEmp.personalInfo?.address || selectedEmp.location || '—'}</strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Emergency Contact</span>
                              <strong>{selectedEmp.emergencyContact || '—'}</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 2: Job & Organization Details */}
                    {activeProfileTab === 'job' && (
                      <div className="hr-360-grid">
                        <div className="hr-360-card">
                          <h4>Job & Organizational Placement</h4>
                          <div className="hr-profile-details-grid">
                            <div className="hr-profile-item">
                              <span>Employee ID</span>
                              <strong>{selectedEmp.jobDetails?.employeeId || selectedEmp._id}</strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Department</span>
                              <strong>
                                {selectedEmp.jobDetails?.department || selectedEmp.department || 'Not Assigned'}
                              </strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Designation / Role</span>
                              <strong>{selectedEmp.jobDetails?.designation || selectedEmp.designation || '—'}</strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Employment Type</span>
                              <strong>{selectedEmp.jobDetails?.employmentType || 'Full Time'}</strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Joining Date</span>
                              <strong>{formatDate(selectedEmp.jobDetails?.joiningDate || selectedEmp.createdAt)}</strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Reporting Manager</span>
                              <strong>{selectedEmp.jobDetails?.reportingManager || 'Not Assigned'}</strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Work Location</span>
                              <strong>{selectedEmp.jobDetails?.workLocation || selectedEmp.location || 'Pune Office'}</strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Probation End Date</span>
                              <strong>{formatDate(selectedEmp.jobDetails?.probationEndDate)}</strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Confirmation Date</span>
                              <strong>{formatDate(selectedEmp.jobDetails?.confirmationDate)}</strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Notice Period</span>
                              <strong>{selectedEmp.jobDetails?.noticePeriodDays || 30} Days</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 3: Bank & Compensation */}
                    {activeProfileTab === 'bank' && (
                      <div className="hr-360-grid">
                        <div className="hr-360-card">
                          <h4>Bank Account Details</h4>
                          <div className="hr-profile-details-grid">
                            <div className="hr-profile-item">
                              <span>Account Holder Name</span>
                              <strong>{selectedEmp.bankDetails?.accountHolderName || '—'}</strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Bank Name</span>
                              <strong>{selectedEmp.bankDetails?.bankName || '—'}</strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Account Number</span>
                              <strong>{selectedEmp.bankDetails?.accountNumber || '—'}</strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>IFSC Code</span>
                              <strong>{selectedEmp.bankDetails?.ifscCode || '—'}</strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Branch Name</span>
                              <strong>{selectedEmp.bankDetails?.branchName || '—'}</strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Disbursement Method</span>
                              <strong>Direct Bank Transfer</strong>
                            </div>
                          </div>
                        </div>
                        {selectedEmp.salaryDetails && (
                          <div className="hr-360-card">
                            <h4>Current Compensation Summary</h4>
                            <div className="hr-profile-details-grid">
                              <div className="hr-profile-item">
                                <span>Basic Salary</span>
                                <strong>{formatCurrency(selectedEmp.salaryDetails.basicSalary, selectedEmp.salaryDetails.currency)}</strong>
                              </div>
                              <div className="hr-profile-item">
                                <span>Allowances</span>
                                <strong>{formatCurrency(selectedEmp.salaryDetails.allowances, selectedEmp.salaryDetails.currency)}</strong>
                              </div>
                              <div className="hr-profile-item">
                                <span>Bonus / Incentives</span>
                                <strong>{formatCurrency(selectedEmp.salaryDetails.bonus, selectedEmp.salaryDetails.currency)}</strong>
                              </div>
                              <div className="hr-profile-item">
                                <span>Standard Deductions</span>
                                <strong>{formatCurrency(selectedEmp.salaryDetails.deductions, selectedEmp.salaryDetails.currency)}</strong>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 4: Attendance Records */}
                    {activeProfileTab === 'attendance' && (
                      <div className="hr-360-tab-wrap">
                        {employee360Data.attendance.length === 0 ? (
                          <div className="hr-emp-empty">No attendance punch logs found for this employee.</div>
                        ) : (
                          <table className="hr-emp-table sub-table">
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Check In</th>
                                <th>Check Out</th>
                                <th>Working Hours</th>
                                <th>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {employee360Data.attendance.map((att) => (
                                <tr key={att._id || att.date}>
                                  <td><strong>{formatDate(att.date)}</strong></td>
                                  <td>
                                    <span className={`hr-emp-status-badge ${att.status === 'Present' ? 'active' : att.status === 'Late' ? 'orange' : 'inactive'}`}>
                                      {att.status}
                                    </span>
                                  </td>
                                  <td>{att.checkIn ? new Date(att.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                                  <td>{att.checkOut ? new Date(att.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                                  <td>{att.totalWorkingMinutes ? `${(att.totalWorkingMinutes / 60).toFixed(1)} hrs` : '—'}</td>
                                  <td>{att.notes || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {/* TAB 5: Leave Records */}
                    {activeProfileTab === 'leave' && (
                      <div className="hr-360-tab-wrap">
                        {employee360Data.leaves.length === 0 ? (
                          <div className="hr-emp-empty">No leave requests found for this employee.</div>
                        ) : (
                          <table className="hr-emp-table sub-table">
                            <thead>
                              <tr>
                                <th>Leave Type</th>
                                <th>Start Date</th>
                                <th>End Date</th>
                                <th>Reason</th>
                                <th>Status</th>
                                <th>Reviewer Note</th>
                              </tr>
                            </thead>
                            <tbody>
                              {employee360Data.leaves.map((l) => (
                                <tr key={l._id}>
                                  <td><strong>{l.type}</strong></td>
                                  <td>{formatDate(l.startDate)}</td>
                                  <td>{formatDate(l.endDate)}</td>
                                  <td>{l.reason}</td>
                                  <td>
                                    <span className={`hr-emp-status-badge ${l.status === 'Approved' ? 'active' : l.status === 'Pending' ? 'orange' : 'inactive'}`}>
                                      {l.status}
                                    </span>
                                  </td>
                                  <td>{l.reviewNote || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {/* TAB 6: Payroll History */}
                    {activeProfileTab === 'payroll' && (
                      <div className="hr-360-tab-wrap">
                        {employee360Data.payroll.length === 0 ? (
                          <div className="hr-emp-empty">No payroll records logged for this employee.</div>
                        ) : (
                          <table className="hr-emp-table sub-table">
                            <thead>
                              <tr>
                                <th>Pay Period</th>
                                <th>Basic</th>
                                <th>Allowances</th>
                                <th>Deductions</th>
                                <th>Net Pay</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {employee360Data.payroll.map((pay) => (
                                <tr key={pay._id}>
                                  <td><strong>{pay.payPeriod || pay.month || '—'}</strong></td>
                                  <td>{formatCurrency(pay.basicSalary || pay.earnings?.basic)}</td>
                                  <td>{formatCurrency(pay.allowances || pay.earnings?.allowances)}</td>
                                  <td>{formatCurrency(pay.totalDeductions || pay.deductions?.total)}</td>
                                  <td><strong>{formatCurrency(pay.netPayable || pay.net)}</strong></td>
                                  <td>
                                    <span className={`hr-emp-status-badge ${pay.status === 'Paid' ? 'active' : 'orange'}`}>
                                      {pay.status || 'Processed'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {/* TAB 7: Performance Reviews */}
                    {activeProfileTab === 'performance' && (
                      <div className="hr-360-tab-wrap">
                        {employee360Data.performance.length === 0 ? (
                          <div className="hr-emp-empty">No performance reviews recorded for this employee.</div>
                        ) : (
                          <div className="hr-360-perf-list">
                            {employee360Data.performance.map((rev) => (
                              <div key={rev._id} className="hr-360-card" style={{ marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                  <h4>{rev.reviewCycle || 'Annual Review'}</h4>
                                  <span className="hr-emp-status-badge active">
                                    Rating: {rev.overallRating || rev.rating || '—'} / 5 ★
                                  </span>
                                </div>
                                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#475569' }}>
                                  {rev.feedback || rev.summary || rev.comments || 'Performance evaluation on file.'}
                                </p>
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                  Review Date: {formatDate(rev.reviewDate || rev.createdAt)} · Reviewer: {rev.reviewer?.firstName || rev.reviewer?.email || 'HR Team'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 8: Training & Certifications */}
                    {activeProfileTab === 'training' && (
                      <div className="hr-360-grid">
                        <div className="hr-360-card">
                          <h4>Training Assignments</h4>
                          {employee360Data.trainingAssignments.length === 0 ? (
                            <div className="hr-emp-empty">No training programs assigned.</div>
                          ) : (
                            <table className="hr-emp-table sub-table">
                              <thead>
                                <tr>
                                  <th>Course / Program</th>
                                  <th>Status</th>
                                  <th>Assigned Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {employee360Data.trainingAssignments.map((t) => (
                                  <tr key={t._id}>
                                    <td><strong>{t.course?.title || t.courseName || 'Training Program'}</strong></td>
                                    <td>
                                      <span className={`hr-emp-status-badge ${t.status === 'Completed' ? 'active' : 'orange'}`}>
                                        {t.status || 'In Progress'}
                                      </span>
                                    </td>
                                    <td>{formatDate(t.assignedDate || t.createdAt)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>

                        <div className="hr-360-card">
                          <h4>Issued Certifications</h4>
                          {employee360Data.certifications.length === 0 ? (
                            <div className="hr-emp-empty">No certifications issued yet.</div>
                          ) : (
                            <table className="hr-emp-table sub-table">
                              <thead>
                                <tr>
                                  <th>Certificate</th>
                                  <th>Certificate #</th>
                                  <th>Issue Date</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {employee360Data.certifications.map((c) => (
                                  <tr key={c._id}>
                                    <td><strong>{c.course?.title || c.title || 'Certificate of Completion'}</strong></td>
                                    <td><code>{c.certificateNumber || '—'}</code></td>
                                    <td>{formatDate(c.issueDate || c.createdAt)}</td>
                                    <td>
                                      <span className={`hr-emp-status-badge ${c.status === 'Valid' || c.status === 'Active' ? 'active' : 'inactive'}`}>
                                        {c.status || 'Valid'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    )}

                    {/* TAB 9: Employee Documents */}
                    {activeProfileTab === 'documents' && (
                      <div className="hr-360-tab-wrap">
                        {employee360Data.documents.length === 0 ? (
                          <div className="hr-emp-empty">No documents uploaded for this employee.</div>
                        ) : (
                          <table className="hr-emp-table sub-table">
                            <thead>
                              <tr>
                                <th>Title</th>
                                <th>Category</th>
                                <th>File Type</th>
                                <th>Verification</th>
                                <th>Uploaded Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {employee360Data.documents.map((doc) => (
                                <tr key={doc._id}>
                                  <td><strong>{doc.title}</strong></td>
                                  <td>{doc.category || 'General'}</td>
                                  <td>{doc.mimeType || doc.fileType || 'PDF'}</td>
                                  <td>
                                    <span className={`hr-emp-status-badge ${doc.status === 'Verified' ? 'active' : doc.status === 'Pending' ? 'orange' : 'inactive'}`}>
                                      {doc.status || 'Pending'}
                                    </span>
                                  </td>
                                  <td>{formatDate(doc.createdAt)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {/* TAB 10: Assigned Assets */}
                    {activeProfileTab === 'assets' && (
                      <div className="hr-360-tab-wrap">
                        {employee360Data.assets.length === 0 ? (
                          <div className="hr-emp-empty">No company assets or equipment assigned to this employee.</div>
                        ) : (
                          <table className="hr-emp-table sub-table">
                            <thead>
                              <tr>
                                <th>Asset Name</th>
                                <th>Asset Code</th>
                                <th>Category</th>
                                <th>Brand / Model</th>
                                <th>Condition</th>
                                <th>Allocation Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {employee360Data.assets.map((ast) => (
                                <tr key={ast._id}>
                                  <td><strong>{ast.assetName || ast.name}</strong></td>
                                  <td><code>{ast.assetCode || '—'}</code></td>
                                  <td>{ast.category || 'Hardware'}</td>
                                  <td>{[ast.brand, ast.model].filter(Boolean).join(' ') || '—'}</td>
                                  <td>
                                    <span className="hr-emp-type-badge">{ast.condition || 'Good'}</span>
                                  </td>
                                  <td>{formatDate(ast.allocatedDate || ast.updatedAt)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {/* TAB 11: Access & Permissions */}
                    {activeProfileTab === 'access' && (
                      <div className="hr-360-grid">
                        <div className="hr-360-card">
                          <h4>Account Authentication & Security</h4>
                          <div className="hr-profile-details-grid">
                            <div className="hr-profile-item">
                              <span>Login Access</span>
                              <strong style={{ color: selectedEmp.isActive ? '#059669' : '#dc2626' }}>
                                {selectedEmp.isActive ? 'Active (Allowed)' : 'Inactive (Blocked)'}
                              </strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>System Role</span>
                              <strong>{selectedEmp.role || 'employee'}</strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Access Status</span>
                              <strong>{selectedEmp.accessStatus || 'Active'}</strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Last Login</span>
                              <strong>{selectedEmp.lastLogin ? new Date(selectedEmp.lastLogin).toLocaleString() : 'Never logged in'}</strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Restricted Modules</span>
                              <strong>
                                {selectedEmp.restrictedModules && selectedEmp.restrictedModules.length > 0
                                  ? selectedEmp.restrictedModules.join(', ')
                                  : 'None (Full Access)'}
                              </strong>
                            </div>
                            <div className="hr-profile-item">
                              <span>Last Access Modification</span>
                              <strong>
                                {selectedEmp.lastAccessChange?.action
                                  ? `${selectedEmp.lastAccessChange.action} on ${formatDate(selectedEmp.lastAccessChange.date)}`
                                  : 'Initial Setup'}
                              </strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 12: Lifecycle History & Transfers */}
                    {activeProfileTab === 'history' && (
                      <div className="hr-360-tab-wrap">
                        {employee360Data.history.length === 0 ? (
                          <div className="hr-emp-empty">No lifecycle transition events on file.</div>
                        ) : (
                          <div className="hr-timeline">
                            {employee360Data.history.map((evt, idx) => (
                              <div key={evt._id || idx} className="hr-timeline-item">
                                <div className="hr-timeline-dot" />
                                <div className="hr-timeline-content">
                                  <div className="hr-timeline-header">
                                    <span className="hr-timeline-action">{evt.action}</span>
                                    <span className="hr-timeline-date">{formatDate(evt.effectiveDate || evt.createdAt)}</span>
                                  </div>
                                  <div className="hr-timeline-details">
                                    {evt.previousDepartment && evt.newDepartment && (
                                      <div className="hr-timeline-diff">
                                        <span>Department:</span> <s>{evt.previousDepartment}</s> &rarr; <strong>{evt.newDepartment}</strong>
                                      </div>
                                    )}
                                    {evt.previousDesignation && evt.newDesignation && (
                                      <div className="hr-timeline-diff">
                                        <span>Designation:</span> <s>{evt.previousDesignation}</s> &rarr; <strong>{evt.newDesignation}</strong>
                                      </div>
                                    )}
                                    {evt.previousStatus && evt.newStatus && (
                                      <div className="hr-timeline-diff">
                                        <span>Status:</span> <s>{evt.previousStatus}</s> &rarr; <strong>{evt.newStatus}</strong>
                                      </div>
                                    )}
                                    {evt.reason && (
                                      <div className="hr-timeline-reason">
                                        <em>Reason: {evt.reason}</em>
                                      </div>
                                    )}
                                    {evt.remarks && (
                                      <div className="hr-timeline-remarks">
                                        Remarks: {evt.remarks}
                                      </div>
                                    )}
                                    <div className="hr-timeline-performer">
                                      Recorded by: {evt.performedByName || 'HR Administrator'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="hr-modal-footer">
                <button type="button" className="hr-btn-secondary" onClick={() => setShowViewModal(false)}>
                  Close
                </button>
                <button
                  type="button"
                  className="hr-btn-primary"
                  onClick={() => {
                    setShowViewModal(false);
                    handleOpenEdit(selectedEmp);
                  }}
                >
                  Edit Profile
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ─── TRANSFER & ROLE CHANGE MODAL ─── */}
        {showTransferModal && selectedEmp && ReactDOM.createPortal(
          <div className="hr-modal-overlay" onClick={() => setShowTransferModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
              <div className="hr-modal-header">
                <div>
                  <h3>Internal Transfer / Role Change</h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Updating: <strong>{selectedEmp.personalInfo?.fullName || selectedEmp.email}</strong> ({selectedEmp.jobDetails?.employeeId || 'EMP'})
                  </p>
                </div>
                <button type="button" className="hr-modal-close" onClick={() => setShowTransferModal(false)}>
                  &times;
                </button>
              </div>
              <form onSubmit={handleSubmitTransfer}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid">
                    {/* Transfer Type */}
                    <div className="hr-form-group full-width">
                      <label>Action / Change Type *</label>
                      <select
                        value={transferForm.changeType}
                        onChange={(e) => setTransferForm({ ...transferForm, changeType: e.target.value })}
                        required
                      >
                        <option value="Transfer">Department Transfer</option>
                        <option value="Promotion">Promotion & Role Upgrade</option>
                        <option value="Designation Change">Designation / Title Change</option>
                        <option value="Manager Change">Reporting Line Reassignment</option>
                        <option value="Location Change">Work Location Transfer</option>
                      </select>
                    </div>

                    {/* New Department (Populated from MongoDB Atlas) */}
                    <div className="hr-form-group">
                      <label>New Department *</label>
                      <select
                        value={transferForm.department}
                        onChange={(e) => setTransferForm({ ...transferForm, department: e.target.value })}
                        required
                      >
                        {departmentOptions.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    {/* New Designation */}
                    <div className="hr-form-group">
                      <label>New Designation *</label>
                      <input
                        type="text"
                        value={transferForm.designation}
                        onChange={(e) => setTransferForm({ ...transferForm, designation: e.target.value })}
                        placeholder="e.g. Senior Software Engineer"
                        required
                      />
                    </div>

                    {/* New Reporting Manager */}
                    <div className="hr-form-group">
                      <label>New Reporting Manager</label>
                      <select
                        value={transferForm.reportingManager}
                        onChange={(e) => setTransferForm({ ...transferForm, reportingManager: e.target.value })}
                      >
                        <option value="">Select Manager (Optional)</option>
                        {employees
                          .filter((e) => e._id !== selectedEmp._id)
                          .map((e) => {
                            const n = e.personalInfo?.fullName || [e.firstName, e.lastName].filter(Boolean).join(' ') || e.email;
                            return (
                              <option key={e._id} value={n}>
                                {n} ({e.jobDetails?.department || e.department || 'General'})
                              </option>
                            );
                          })}
                      </select>
                    </div>

                    {/* New Work Location */}
                    <div className="hr-form-group">
                      <label>New Work Location</label>
                      <input
                        type="text"
                        value={transferForm.workLocation}
                        onChange={(e) => setTransferForm({ ...transferForm, workLocation: e.target.value })}
                        placeholder="e.g. Pune Office / Remote"
                      />
                    </div>

                    {/* Effective Date */}
                    <div className="hr-form-group full-width">
                      <label>Effective Date *</label>
                      <input
                        type="date"
                        value={transferForm.effectiveDate}
                        onChange={(e) => setTransferForm({ ...transferForm, effectiveDate: e.target.value })}
                        required
                      />
                    </div>

                    {/* Reason */}
                    <div className="hr-form-group full-width">
                      <label>Reason for Transfer / Promotion *</label>
                      <input
                        type="text"
                        value={transferForm.reason}
                        onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                        placeholder="e.g. Moved to Tech team following successful skill assessment"
                        required
                      />
                    </div>

                    {/* Remarks */}
                    <div className="hr-form-group full-width">
                      <label>Additional Remarks / Notes</label>
                      <textarea
                        rows={2}
                        value={transferForm.remarks}
                        onChange={(e) => setTransferForm({ ...transferForm, remarks: e.target.value })}
                        placeholder="Any additional handover or transition notes..."
                      />
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowTransferModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Applying Transfer...' : 'Apply & Save to Atlas'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* ─── LIFECYCLE STATUS MANAGEMENT MODAL ─── */}
        {showStatusModal && selectedEmp && ReactDOM.createPortal(
          <div className="hr-modal-overlay" onClick={() => setShowStatusModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
              <div className="hr-modal-header">
                <div>
                  <h3>Manage Employee Status</h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Updating: <strong>{selectedEmp.personalInfo?.fullName || selectedEmp.email}</strong>
                  </p>
                </div>
                <button type="button" className="hr-modal-close" onClick={() => setShowStatusModal(false)}>
                  &times;
                </button>
              </div>
              <form onSubmit={handleSubmitStatus}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid">
                    {/* Status Dropdown */}
                    <div className="hr-form-group full-width">
                      <label>Target Employment Status *</label>
                      <select
                        value={statusForm.status}
                        onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                        required
                      >
                        <option value="Active">Active (Full Regular Employee)</option>
                        <option value="Probation">On Probation (Evaluation Period)</option>
                        <option value="On Leave">On Leave (Approved Leave of Absence)</option>
                        <option value="Notice Period">Notice Period (Serving Resignation Notice)</option>
                        <option value="Inactive">Inactive (Full Account Deactivation)</option>
                        <option value="Exited">Exited (Offboarded)</option>
                        <option value="Terminated">Terminated</option>
                      </select>
                    </div>

                    {/* Safety notice adhering strictly to user safety correction 2 */}
                    <div className="hr-form-group full-width">
                      {['Active', 'Probation', 'On Leave', 'Notice Period'].includes(statusForm.status) ? (
                        <div className="hr-info-callout green">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '15px', height: '15px' }}>
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                          </svg>
                          <span>This status preserves system credentials and portal login access.</span>
                        </div>
                      ) : (
                        <div className="hr-info-callout red">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '15px', height: '15px' }}>
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          <span>Warning: This status will deactivate user portal login access.</span>
                        </div>
                      )}
                    </div>

                    {/* Effective Date */}
                    <div className="hr-form-group full-width">
                      <label>Effective Date *</label>
                      <input
                        type="date"
                        value={statusForm.effectiveDate}
                        onChange={(e) => setStatusForm({ ...statusForm, effectiveDate: e.target.value })}
                        required
                      />
                    </div>

                    {/* Reason */}
                    <div className="hr-form-group full-width">
                      <label>Reason for Status Change *</label>
                      <input
                        type="text"
                        value={statusForm.reason}
                        onChange={(e) => setStatusForm({ ...statusForm, reason: e.target.value })}
                        placeholder="e.g. Probation successfully completed or Resigned"
                        required
                      />
                    </div>

                    {/* Remarks */}
                    <div className="hr-form-group full-width">
                      <label>Remarks</label>
                      <textarea
                        rows={2}
                        value={statusForm.remarks}
                        onChange={(e) => setStatusForm({ ...statusForm, remarks: e.target.value })}
                        placeholder="Internal HR notes or transition instructions..."
                      />
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowStatusModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Updating...' : 'Update Status in Atlas'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* ─── QUICK EDIT EMPLOYEE MODAL ─── */}
        {showEditModal && selectedEmp && ReactDOM.createPortal(
          <div className="hr-modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
              <div className="hr-modal-header">
                <h3>Edit Employee Record</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowEditModal(false)}>
                  &times;
                </button>
              </div>
              <form onSubmit={handleUpdateEmployee}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid">
                    <div className="hr-form-group">
                      <label>First Name</label>
                      <input
                        type="text"
                        value={editFormData.firstName}
                        onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                      />
                    </div>
                    <div className="hr-form-group">
                      <label>Last Name</label>
                      <input
                        type="text"
                        value={editFormData.lastName}
                        onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                      />
                    </div>
                    <div className="hr-form-group">
                      <label>Email Address</label>
                      <input
                        type="email"
                        value={editFormData.email}
                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      />
                    </div>
                    <div className="hr-form-group">
                      <label>Phone</label>
                      <input
                        type="tel"
                        value={editFormData.phone}
                        onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      />
                    </div>
                    <div className="hr-form-group">
                      <label>Department</label>
                      <select
                        value={editFormData.department}
                        onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                      >
                        {departmentOptions.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="hr-form-group">
                      <label>Designation</label>
                      <input
                        type="text"
                        value={editFormData.designation}
                        onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                      />
                    </div>
                    <div className="hr-form-group">
                      <label>Employment Type</label>
                      <select
                        value={editFormData.employmentType}
                        onChange={(e) => setEditFormData({ ...editFormData, employmentType: e.target.value })}
                      >
                        <option value="Full Time">Full Time</option>
                        <option value="Part Time">Part Time</option>
                        <option value="Intern">Intern</option>
                        <option value="Contract">Contract</option>
                      </select>
                    </div>
                    <div className="hr-form-group">
                      <label>Work Location</label>
                      <input
                        type="text"
                        value={editFormData.workLocation}
                        onChange={(e) => setEditFormData({ ...editFormData, workLocation: e.target.value })}
                      />
                    </div>
                    <div className="hr-form-group full-width">
                      <label>Account Login Access</label>
                      <select
                        value={String(editFormData.isActive)}
                        onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.value === 'true' })}
                      >
                        <option value="true">Active (Login Enabled)</option>
                        <option value="false">Inactive (Login Disabled)</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowEditModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* ─── ADD EMPLOYEE MODAL (3 Clearly Separated Sections) ─── */}
        {showAddModal && ReactDOM.createPortal(
          <div className="hr-modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="hr-modal-header">
                <h3>Onboard New Employee</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowAddModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleCreateEmployee} noValidate>
                <div className="hr-modal-body">
                  {/* SECTION 1: PERSONAL INFORMATION */}
                  <div className="hr-form-section">
                    <div className="hr-form-section-header">
                      <div className="hr-form-section-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <h4>Personal Information</h4>
                    </div>

                    {/* Photo Upload */}
                    <div className="hr-photo-upload-row">
                      <div className="hr-photo-preview-wrap">
                        {addForm.personalInfo.profilePhoto ? (
                          <img
                            src={addForm.personalInfo.profilePhoto}
                            alt="Profile Preview"
                            className="hr-photo-preview-img"
                          />
                        ) : (
                          <div className="hr-photo-placeholder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                              <circle cx="12" cy="13" r="4" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="hr-photo-controls">
                        <input
                          type="file"
                          ref={fileInputRef}
                          style={{ display: 'none' }}
                          accept="image/*"
                          onChange={handlePhotoUpload}
                        />
                        <button
                          type="button"
                          className="hr-upload-trigger-btn"
                          onClick={() => fileInputRef.current && fileInputRef.current.click()}
                        >
                          Upload Profile Picture
                        </button>
                        <span className="hr-upload-hint">PNG, JPG or WEBP. Max size 2MB.</span>
                      </div>
                    </div>

                    <div className="hr-form-grid">
                      <div className="hr-form-group">
                        <label>Full Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Rahul Verma"
                          className={formErrors['personalInfo.fullName'] ? 'hr-input-error' : ''}
                          value={addForm.personalInfo.fullName}
                          onChange={(e) => {
                            setAddForm({
                              ...addForm,
                              personalInfo: { ...addForm.personalInfo, fullName: e.target.value },
                            });
                            if (formErrors['personalInfo.fullName']) {
                              setFormErrors((prev) => ({ ...prev, 'personalInfo.fullName': null }));
                            }
                          }}
                        />
                        {formErrors['personalInfo.fullName'] && (
                          <span className="hr-error-text">{formErrors['personalInfo.fullName']}</span>
                        )}
                      </div>

                      <div className="hr-form-group">
                        <label>Email Address *</label>
                        <input
                          type="email"
                          required
                          placeholder="e.g. rahul.verma@company.com"
                          className={formErrors['personalInfo.email'] ? 'hr-input-error' : ''}
                          value={addForm.personalInfo.email}
                          onChange={(e) => {
                            setAddForm({
                              ...addForm,
                              personalInfo: { ...addForm.personalInfo, email: e.target.value },
                            });
                            if (formErrors['personalInfo.email']) {
                              setFormErrors((prev) => ({ ...prev, 'personalInfo.email': null }));
                            }
                          }}
                        />
                        {formErrors['personalInfo.email'] && (
                          <span className="hr-error-text">{formErrors['personalInfo.email']}</span>
                        )}
                      </div>

                      <div className="hr-form-group">
                        <label>Phone Number *</label>
                        <input
                          type="tel"
                          required
                          placeholder="e.g. +91 98765 43210"
                          className={formErrors['personalInfo.phoneNumber'] ? 'hr-input-error' : ''}
                          value={addForm.personalInfo.phoneNumber}
                          onChange={(e) => {
                            setAddForm({
                              ...addForm,
                              personalInfo: { ...addForm.personalInfo, phoneNumber: e.target.value },
                            });
                            if (formErrors['personalInfo.phoneNumber']) {
                              setFormErrors((prev) => ({ ...prev, 'personalInfo.phoneNumber': null }));
                            }
                          }}
                        />
                        {formErrors['personalInfo.phoneNumber'] && (
                          <span className="hr-error-text">{formErrors['personalInfo.phoneNumber']}</span>
                        )}
                      </div>

                      <div className="hr-form-group">
                        <label>Date of Birth</label>
                        <input
                          type="date"
                          value={addForm.personalInfo.dateOfBirth}
                          onChange={(e) =>
                            setAddForm({
                              ...addForm,
                              personalInfo: { ...addForm.personalInfo, dateOfBirth: e.target.value },
                            })
                          }
                        />
                      </div>

                      <div className="hr-form-group">
                        <label>Gender</label>
                        <select
                          value={addForm.personalInfo.gender}
                          onChange={(e) =>
                            setAddForm({
                              ...addForm,
                              personalInfo: { ...addForm.personalInfo, gender: e.target.value },
                            })
                          }
                        >
                          <option value="">Select Gender (Optional)</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div className="hr-form-group full-width">
                        <label>Residential Address</label>
                        <input
                          type="text"
                          placeholder="e.g. Flat 402, Sunshine Heights, Baner, Pune"
                          value={addForm.personalInfo.address}
                          onChange={(e) =>
                            setAddForm({
                              ...addForm,
                              personalInfo: { ...addForm.personalInfo, address: e.target.value },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: JOB DETAILS */}
                  <div className="hr-form-section">
                    <div className="hr-form-section-header">
                      <div className="hr-form-section-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                        </svg>
                      </div>
                      <h4>Job & Organizational Placement</h4>
                    </div>

                    <div className="hr-form-grid">
                      <div className="hr-form-group">
                        <label>Employee ID *</label>
                        <input
                          type="text"
                          required
                          value={addForm.jobDetails.employeeId}
                          onChange={(e) =>
                            setAddForm({
                              ...addForm,
                              jobDetails: { ...addForm.jobDetails, employeeId: e.target.value },
                            })
                          }
                        />
                      </div>

                      <div className="hr-form-group">
                        <label>Department *</label>
                        <select
                          required
                          value={addForm.jobDetails.department}
                          onChange={(e) =>
                            setAddForm({
                              ...addForm,
                              jobDetails: { ...addForm.jobDetails, department: e.target.value },
                            })
                          }
                        >
                          {departmentOptions.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>

                      <div className="hr-form-group">
                        <label>Designation *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Frontend Developer"
                          className={formErrors['jobDetails.designation'] ? 'hr-input-error' : ''}
                          value={addForm.jobDetails.designation}
                          onChange={(e) => {
                            setAddForm({
                              ...addForm,
                              jobDetails: { ...addForm.jobDetails, designation: e.target.value },
                            });
                            if (formErrors['jobDetails.designation']) {
                              setFormErrors((prev) => ({ ...prev, 'jobDetails.designation': null }));
                            }
                          }}
                        />
                        {formErrors['jobDetails.designation'] && (
                          <span className="hr-error-text">{formErrors['jobDetails.designation']}</span>
                        )}
                      </div>

                      <div className="hr-form-group">
                        <label>Joining Date *</label>
                        <input
                          type="date"
                          required
                          value={addForm.jobDetails.joiningDate}
                          onChange={(e) =>
                            setAddForm({
                              ...addForm,
                              jobDetails: { ...addForm.jobDetails, joiningDate: e.target.value },
                            })
                          }
                        />
                      </div>

                      <div className="hr-form-group">
                        <label>Employment Type *</label>
                        <select
                          value={addForm.jobDetails.employmentType}
                          onChange={(e) =>
                            setAddForm({
                              ...addForm,
                              jobDetails: { ...addForm.jobDetails, employmentType: e.target.value },
                            })
                          }
                        >
                          <option value="Full Time">Full Time</option>
                          <option value="Part Time">Part Time</option>
                          <option value="Intern">Intern</option>
                          <option value="Contract">Contract</option>
                        </select>
                      </div>

                      <div className="hr-form-group">
                        <label>Reporting Manager</label>
                        <select
                          value={addForm.jobDetails.reportingManager}
                          onChange={(e) =>
                            setAddForm({
                              ...addForm,
                              jobDetails: { ...addForm.jobDetails, reportingManager: e.target.value },
                            })
                          }
                        >
                          <option value="">Select Manager (Optional)</option>
                          {employees.map((emp) => {
                            const name =
                              emp.personalInfo?.fullName ||
                              [emp.firstName, emp.lastName].filter(Boolean).join(' ') ||
                              emp.email;
                            return (
                              <option key={emp._id} value={name}>
                                {name} ({emp.jobDetails?.department || emp.department || 'General'})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="hr-form-group">
                        <label>Work Location</label>
                        <input
                          type="text"
                          value={addForm.jobDetails.workLocation}
                          onChange={(e) =>
                            setAddForm({
                              ...addForm,
                              jobDetails: { ...addForm.jobDetails, workLocation: e.target.value },
                            })
                          }
                          placeholder="e.g. Pune Office / Remote"
                        />
                      </div>

                      <div className="hr-form-group">
                        <label>Initial Status</label>
                        <select
                          value={addForm.jobDetails.employmentStatus}
                          onChange={(e) =>
                            setAddForm({
                              ...addForm,
                              jobDetails: { ...addForm.jobDetails, employmentStatus: e.target.value },
                            })
                          }
                        >
                          <option value="Active">Active</option>
                          <option value="Probation">On Probation</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: BANK DETAILS */}
                  <div className="hr-form-section">
                    <div className="hr-form-section-header">
                      <div className="hr-form-section-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="5" width="20" height="14" rx="2" />
                          <line x1="2" y1="10" x2="22" y2="10" />
                        </svg>
                      </div>
                      <h4>Bank Account Details</h4>
                    </div>

                    <div className="hr-form-grid">
                      <div className="hr-form-group">
                        <label>Account Holder Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Rahul Verma"
                          className={formErrors['bankDetails.accountHolderName'] ? 'hr-input-error' : ''}
                          value={addForm.bankDetails.accountHolderName}
                          onChange={(e) => {
                            setAddForm({
                              ...addForm,
                              bankDetails: { ...addForm.bankDetails, accountHolderName: e.target.value },
                            });
                            if (formErrors['bankDetails.accountHolderName']) {
                              setFormErrors((prev) => ({ ...prev, 'bankDetails.accountHolderName': null }));
                            }
                          }}
                        />
                        {formErrors['bankDetails.accountHolderName'] && (
                          <span className="hr-error-text">{formErrors['bankDetails.accountHolderName']}</span>
                        )}
                      </div>

                      <div className="hr-form-group">
                        <label>Bank Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. HDFC Bank / State Bank of India"
                          className={formErrors['bankDetails.bankName'] ? 'hr-input-error' : ''}
                          value={addForm.bankDetails.bankName}
                          onChange={(e) => {
                            setAddForm({
                              ...addForm,
                              bankDetails: { ...addForm.bankDetails, bankName: e.target.value },
                            });
                            if (formErrors['bankDetails.bankName']) {
                              setFormErrors((prev) => ({ ...prev, 'bankDetails.bankName': null }));
                            }
                          }}
                        />
                        {formErrors['bankDetails.bankName'] && (
                          <span className="hr-error-text">{formErrors['bankDetails.bankName']}</span>
                        )}
                      </div>

                      <div className="hr-form-group">
                        <label>Account Number *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 50100452367812"
                          className={formErrors['bankDetails.accountNumber'] ? 'hr-input-error' : ''}
                          value={addForm.bankDetails.accountNumber}
                          onChange={(e) => {
                            setAddForm({
                              ...addForm,
                              bankDetails: { ...addForm.bankDetails, accountNumber: e.target.value },
                            });
                            if (formErrors['bankDetails.accountNumber']) {
                              setFormErrors((prev) => ({ ...prev, 'bankDetails.accountNumber': null }));
                            }
                          }}
                        />
                        {formErrors['bankDetails.accountNumber'] && (
                          <span className="hr-error-text">{formErrors['bankDetails.accountNumber']}</span>
                        )}
                      </div>

                      <div className="hr-form-group">
                        <label>IFSC Code *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. HDFC0001234"
                          style={{ textTransform: 'uppercase' }}
                          className={formErrors['bankDetails.ifscCode'] ? 'hr-input-error' : ''}
                          value={addForm.bankDetails.ifscCode}
                          onChange={(e) => {
                            setAddForm({
                              ...addForm,
                              bankDetails: { ...addForm.bankDetails, ifscCode: e.target.value.toUpperCase() },
                            });
                            if (formErrors['bankDetails.ifscCode']) {
                              setFormErrors((prev) => ({ ...prev, 'bankDetails.ifscCode': null }));
                            }
                          }}
                        />
                        {formErrors['bankDetails.ifscCode'] && (
                          <span className="hr-error-text">{formErrors['bankDetails.ifscCode']}</span>
                        )}
                      </div>

                      <div className="hr-form-group full-width">
                        <label>Branch Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Baner Branch, Pune"
                          value={addForm.bankDetails.branchName}
                          onChange={(e) =>
                            setAddForm({
                              ...addForm,
                              bankDetails: { ...addForm.bankDetails, branchName: e.target.value },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Creating Employee in Atlas...' : 'Complete Onboarding'}
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
