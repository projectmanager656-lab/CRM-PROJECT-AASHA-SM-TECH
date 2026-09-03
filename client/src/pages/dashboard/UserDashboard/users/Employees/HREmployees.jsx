import { useState, useEffect, useMemo, useRef } from 'react';
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
    return new Date(val).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return String(val);
  }
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

  // Search & Filter
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState('personal');

  // Add Employee Form State (Structured into 3 Sections)
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
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    department: 'HR',
    designation: '',
    isActive: true,
  });

  // HR Summary data for profile modal
  const [profileSummary, setProfileSummary] = useState({
    attendance: [],
    leaves: [],
    payroll: [],
    loading: false,
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, deptsRes] = await Promise.all([
        apiClient.get('/users'),
        apiClient.get('/admin/departments').catch(() => apiClient.get('/departments')).catch(() => ({ data: { data: [] } })),
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

  // Filtered list
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const fullName = (emp.personalInfo?.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`).toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const matchesSearch = fullName.includes(search.toLowerCase()) || email.includes(search.toLowerCase());

      const dept = emp.jobDetails?.department || emp.department;
      const matchesDept = selectedDept === 'All' || dept === selectedDept;
      const matchesStatus = selectedStatus === 'All' || (selectedStatus === 'Active' ? emp.isActive : !emp.isActive);

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [employees, search, selectedDept, selectedStatus]);

  // Dynamic stats
  const totalCount = employees.length;
  const activeCount = employees.filter((e) => e.isActive).length;
  const inactiveCount = totalCount - activeCount;
  const deptCount = new Set(employees.map((e) => e.jobDetails?.department || e.department).filter(Boolean)).size;

  // Open Add Employee Modal
  const handleOpenAdd = () => {
    setError('');
    setSuccess('');
    setFormErrors({});
    const defaultDept = departments[0]?.name || 'HR';
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

  // Image Upload Handler
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
          personalInfo: {
            ...prev.personalInfo,
            profilePhoto: reader.result,
          },
        }));
        setFormErrors((prev) => {
          const updated = { ...prev };
          delete updated['personalInfo.profilePhoto'];
          return updated;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Form Validation
  const validateAddForm = () => {
    const errs = {};
    const { personalInfo, jobDetails, bankDetails } = addForm;

    // 1. Personal Information Validation
    if (!personalInfo.fullName.trim()) {
      errs['personalInfo.fullName'] = 'Full Name is required.';
    }

    if (!personalInfo.email.trim()) {
      errs['personalInfo.email'] = 'Email Address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalInfo.email.trim())) {
      errs['personalInfo.email'] = 'Please enter a valid email address.';
    }

    if (!personalInfo.phoneNumber.trim()) {
      errs['personalInfo.phoneNumber'] = 'Phone Number is required.';
    } else if (!/^[0-9+\s()-]{8,20}$/.test(personalInfo.phoneNumber.trim())) {
      errs['personalInfo.phoneNumber'] = 'Please enter a valid phone number.';
    }

    // 2. Job Details Validation
    if (!jobDetails.department) {
      errs['jobDetails.department'] = 'Department is required.';
    }

    if (!jobDetails.designation.trim()) {
      errs['jobDetails.designation'] = 'Designation is required.';
    }

    if (!jobDetails.joiningDate) {
      errs['jobDetails.joiningDate'] = 'Joining Date is required.';
    }

    if (!jobDetails.employmentType) {
      errs['jobDetails.employmentType'] = 'Employment Type is required.';
    }

    // 3. Bank Details Validation
    if (!bankDetails.accountHolderName.trim()) {
      errs['bankDetails.accountHolderName'] = 'Account Holder Name is required.';
    }

    if (!bankDetails.bankName.trim()) {
      errs['bankDetails.bankName'] = 'Bank Name is required.';
    }

    if (!bankDetails.accountNumber.trim()) {
      errs['bankDetails.accountNumber'] = 'Account Number is required.';
    } else if (!/^\d+$/.test(bankDetails.accountNumber.trim())) {
      errs['bankDetails.accountNumber'] = 'Account Number must contain digits only.';
    }

    if (!bankDetails.ifscCode.trim()) {
      errs['bankDetails.ifscCode'] = 'IFSC Code is required.';
    } else if (bankDetails.ifscCode.trim().length < 4) {
      errs['bankDetails.ifscCode'] = 'Please enter a valid IFSC code.';
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit Add Employee
  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    if (!validateAddForm()) {
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        fullName: addForm.personalInfo.fullName,
        email: addForm.personalInfo.email,
        phone: addForm.personalInfo.phoneNumber,
        department: addForm.jobDetails.department,
        designation: addForm.jobDetails.designation,
        personalInfo: addForm.personalInfo,
        jobDetails: addForm.jobDetails,
        bankDetails: addForm.bankDetails,
        role: 'employee',
        isActive: true,
      };

      await apiClient.post('/users', payload);
      setShowAddModal(false);
      setSuccess('Employee added successfully!');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create employee record.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Employee Modal
  const handleOpenEdit = (emp) => {
    setError('');
    setSuccess('');
    setSelectedEmp(emp);
    setEditFormData({
      firstName: emp.firstName || emp.personalInfo?.fullName?.split(' ')[0] || '',
      lastName: emp.lastName || emp.personalInfo?.fullName?.split(' ').slice(1).join(' ') || '',
      email: emp.email || emp.personalInfo?.email || '',
      phone: emp.phone || emp.personalInfo?.phoneNumber || '',
      department: emp.department || emp.jobDetails?.department || 'HR',
      designation: emp.designation || emp.jobDetails?.designation || '',
      isActive: emp.isActive !== false,
    });
    setShowEditModal(true);
  };

  // Submit Update Employee
  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    if (!selectedEmp) return;
    setSubmitting(true);
    setError('');
    try {
      await apiClient.put(`/users/${selectedEmp._id}`, editFormData);
      setShowEditModal(false);
      setSuccess('Employee updated successfully!');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update employee.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open View Profile Modal
  const handleOpenView = async (emp) => {
    setSelectedEmp(emp);
    setActiveProfileTab('personal');
    setShowViewModal(true);

    setProfileSummary({ attendance: [], leaves: [], payroll: [], loading: true });
    try {
      const [attRes, leaveRes, payRes] = await Promise.all([
        apiClient.get('/attendance', { params: { user: emp._id } }).catch(() => ({ data: { data: [] } })),
        apiClient.get('/leave-requests', { params: { user: emp._id } }).catch(() => ({ data: { data: [] } })),
        apiClient.get('/payroll', { params: { user: emp._id } }).catch(() => ({ data: { data: [] } })),
      ]);
      setProfileSummary({
        attendance: attRes.data?.data || [],
        leaves: leaveRes.data?.data || [],
        payroll: payRes.data?.data || [],
        loading: false,
      });
    } catch (e) {
      setProfileSummary({ attendance: [], leaves: [], payroll: [], loading: false });
    }
  };

  return (
    <UserLayout pageTitle="Employee Management">
      <div className="hr-emp-container">
        {/* Header */}
        <div className="hr-emp-header">
          <div className="hr-emp-title-area">
            <h2>Employee Management</h2>
            <p>View, manage and onboard workforce records across all departments.</p>
          </div>
          <button type="button" className="hr-emp-add-btn" onClick={handleOpenAdd}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Employee
          </button>
        </div>

        {/* Dynamic KPI Stat Cards */}
        <div className="hr-emp-stats-grid">
          <div className="hr-emp-stat-card blue">
            <div className="hr-emp-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </div>
            <div className="hr-emp-stat-body">
              <span>Total Workforce</span>
              <strong>{totalCount}</strong>
            </div>
          </div>

          <div className="hr-emp-stat-card green">
            <div className="hr-emp-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            </div>
            <div className="hr-emp-stat-body">
              <span>Active Accounts</span>
              <strong>{activeCount}</strong>
            </div>
          </div>

          <div className="hr-emp-stat-card amber">
            <div className="hr-emp-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            </div>
            <div className="hr-emp-stat-body">
              <span>Inactive / On Hold</span>
              <strong>{inactiveCount}</strong>
            </div>
          </div>

          <div className="hr-emp-stat-card purple">
            <div className="hr-emp-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="9" y1="22" x2="9" y2="22.01" /><line x1="15" y1="22" x2="15" y2="22.01" /></svg>
            </div>
            <div className="hr-emp-stat-body">
              <span>Departments</span>
              <strong>{deptCount}</strong>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
        {success && <div style={{ background: '#DCFCE7', color: '#15803D', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>{success}</div>}

        {/* Toolbar & Filter */}
        <div className="hr-emp-toolbar">
          <div className="hr-emp-search-wrap">
            <svg className="hr-emp-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input
              type="text"
              placeholder="Search by employee name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select className="hr-emp-filter-select" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
            <option value="All">All Departments</option>
            <option value="HR">HR</option>
            <option value="Finance">Finance</option>
            <option value="Business Development">Business Development</option>
            <option value="Digital Marketing">Digital Marketing</option>
            <option value="Video Editor">Video Editor</option>
            <option value="Tech">Tech</option>
          </select>

          <select className="hr-emp-filter-select" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        {/* Employee Table */}
        <div className="hr-emp-table-card">
          {loading ? (
            <div className="hr-emp-empty">Loading employee directory...</div>
          ) : filteredEmployees.length === 0 ? (
            <div className="hr-emp-empty">No employees match the selected criteria.</div>
          ) : (
            <div className="hr-emp-table-wrap">
              <table className="hr-emp-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Joining Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => {
                    const initials = initialsFor(emp.firstName, emp.lastName, emp.email);
                    const name = emp.personalInfo?.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.email;
                    const dept = emp.jobDetails?.department || emp.department || 'Not Assigned';
                    const designation = emp.jobDetails?.designation || emp.designation || '—';
                    const joiningDate = emp.jobDetails?.joiningDate || emp.createdAt;
                    const empCode = emp.jobDetails?.employeeId || `EMP-${emp._id.slice(-5).toUpperCase()}`;

                    return (
                      <tr key={emp._id}>
                        <td>
                          <div className="hr-emp-user-cell">
                            {emp.personalInfo?.profilePhoto ? (
                              <img src={emp.personalInfo.profilePhoto} alt={name} className="hr-emp-avatar" style={{ objectFit: 'cover' }} />
                            ) : (
                              <div className="hr-emp-avatar">{initials}</div>
                            )}
                            <div>
                              <span className="hr-emp-name">{name}</span>
                              <span className="hr-emp-id-sub">{empCode}</span>
                            </div>
                          </div>
                        </td>
                        <td>{emp.email}</td>
                        <td>{emp.phone || emp.personalInfo?.phoneNumber || '—'}</td>
                        <td>
                          <span className="hr-emp-dept-pill">{dept}</span>
                        </td>
                        <td>{designation}</td>
                        <td>{formatDate(joiningDate)}</td>
                        <td>
                          <span className={`hr-emp-status-badge ${emp.isActive ? 'active' : 'inactive'}`}>
                            <span className="hr-emp-status-dot" />
                            {emp.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className="hr-emp-actions">
                            <button type="button" className="hr-emp-action-btn view" onClick={() => handleOpenView(emp)}>
                              View
                            </button>
                            <button type="button" className="hr-emp-action-btn edit" onClick={() => handleOpenEdit(emp)}>
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

        {/* ─── ADD EMPLOYEE MODAL (3 Clearly Separated Sections) ─── */}
        {showAddModal && (
          <div className="hr-modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="hr-modal-header">
                <h3>Add New Employee</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowAddModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleCreateEmployee} noValidate>
                <div className="hr-modal-body">
                  {/* ═══════════════════════════════════════════════════════
                      SECTION 1: PERSONAL INFORMATION
                     ═══════════════════════════════════════════════════════ */}
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

                    <div className="hr-form-grid">
                      {/* Profile Photo (Full Width) */}
                      <div className="hr-form-group full-width">
                        <label>Profile Photo</label>
                        <div className="hr-photo-upload-wrap">
                          <div className="hr-photo-preview-box">
                            {addForm.personalInfo.profilePhoto ? (
                              <img src={addForm.personalInfo.profilePhoto} alt="Preview" className="hr-photo-preview-img" />
                            ) : (
                              <div className="hr-photo-preview-placeholder">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '28px', height: '28px' }}>
                                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                  <circle cx="12" cy="7" r="4" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="hr-photo-upload-controls">
                            <input
                              type="file"
                              ref={fileInputRef}
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={handlePhotoUpload}
                            />
                            <button
                              type="button"
                              className="hr-photo-file-label"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px', height: '14px' }}>
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                              </svg>
                              {addForm.personalInfo.profilePhoto ? 'Change Photo' : 'Upload Photo'}
                            </button>
                            <p className="hr-photo-help-text">JPG, PNG or WEBP (Max 2MB). Optional.</p>
                            {formErrors['personalInfo.profilePhoto'] && (
                              <span className="hr-error-text">{formErrors['personalInfo.profilePhoto']}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Full Name (Required) */}
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

                      {/* Email Address (Required) */}
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

                      {/* Phone Number (Required) */}
                      <div className="hr-form-group">
                        <label>Phone Number *</label>
                        <input
                          type="tel"
                          required
                          placeholder="e.g. +91 9876543210"
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

                      {/* Date of Birth (Optional) */}
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

                      {/* Gender (Optional Dropdown) */}
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
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                          <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                      </div>

                      {/* Address (Optional Full Width Textarea) */}
                      <div className="hr-form-group full-width">
                        <label>Address</label>
                        <textarea
                          placeholder="Enter residential or permanent address"
                          rows={2}
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

                  {/* ═══════════════════════════════════════════════════════
                      SECTION 2: JOB DETAILS
                     ═══════════════════════════════════════════════════════ */}
                  <div className="hr-form-section">
                    <div className="hr-form-section-header">
                      <div className="hr-form-section-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                        </svg>
                      </div>
                      <h4>Job Details</h4>
                    </div>

                    <div className="hr-form-grid">
                      {/* Employee ID (Auto-generated & Read-only) */}
                      <div className="hr-form-group">
                        <label>Employee ID (Auto-generated)</label>
                        <input
                          type="text"
                          readOnly
                          className="hr-input-readonly"
                          value={addForm.jobDetails.employeeId}
                        />
                      </div>

                      {/* Department (Required Dropdown) */}
                      <div className="hr-form-group">
                        <label>Department *</label>
                        <select
                          required
                          className={formErrors['jobDetails.department'] ? 'hr-input-error' : ''}
                          value={addForm.jobDetails.department}
                          onChange={(e) => {
                            setAddForm({
                              ...addForm,
                              jobDetails: { ...addForm.jobDetails, department: e.target.value },
                            });
                            if (formErrors['jobDetails.department']) {
                              setFormErrors((prev) => ({ ...prev, 'jobDetails.department': null }));
                            }
                          }}
                        >
                          <option value="">Select Department</option>
                          <option value="HR">HR</option>
                          <option value="Finance">Finance</option>
                          <option value="Business Development">Business Development</option>
                          <option value="Digital Marketing">Digital Marketing</option>
                          <option value="Video Editor">Video Editor</option>
                          <option value="Tech">Tech</option>
                        </select>
                        {formErrors['jobDetails.department'] && (
                          <span className="hr-error-text">{formErrors['jobDetails.department']}</span>
                        )}
                      </div>

                      {/* Designation (Required) */}
                      <div className="hr-form-group">
                        <label>Designation *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Senior Software Engineer"
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

                      {/* Joining Date (Required Date Picker) */}
                      <div className="hr-form-group">
                        <label>Joining Date *</label>
                        <input
                          type="date"
                          required
                          className={formErrors['jobDetails.joiningDate'] ? 'hr-input-error' : ''}
                          value={addForm.jobDetails.joiningDate}
                          onChange={(e) => {
                            setAddForm({
                              ...addForm,
                              jobDetails: { ...addForm.jobDetails, joiningDate: e.target.value },
                            });
                            if (formErrors['jobDetails.joiningDate']) {
                              setFormErrors((prev) => ({ ...prev, 'jobDetails.joiningDate': null }));
                            }
                          }}
                        />
                        {formErrors['jobDetails.joiningDate'] && (
                          <span className="hr-error-text">{formErrors['jobDetails.joiningDate']}</span>
                        )}
                      </div>

                      {/* Employment Type (Required Dropdown) */}
                      <div className="hr-form-group">
                        <label>Employment Type *</label>
                        <select
                          required
                          className={formErrors['jobDetails.employmentType'] ? 'hr-input-error' : ''}
                          value={addForm.jobDetails.employmentType}
                          onChange={(e) => {
                            setAddForm({
                              ...addForm,
                              jobDetails: { ...addForm.jobDetails, employmentType: e.target.value },
                            });
                            if (formErrors['jobDetails.employmentType']) {
                              setFormErrors((prev) => ({ ...prev, 'jobDetails.employmentType': null }));
                            }
                          }}
                        >
                          <option value="Full Time">Full Time</option>
                          <option value="Part Time">Part Time</option>
                          <option value="Intern">Intern</option>
                          <option value="Contract">Contract</option>
                        </select>
                        {formErrors['jobDetails.employmentType'] && (
                          <span className="hr-error-text">{formErrors['jobDetails.employmentType']}</span>
                        )}
                      </div>

                      {/* Reporting Manager (Optional Dropdown) */}
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
                          <option value="">Select Reporting Manager (Optional)</option>
                          {employees.map((emp) => {
                            const name = emp.personalInfo?.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.email;
                            return (
                              <option key={emp._id} value={name}>
                                {name} ({emp.department || 'General'})
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* ═══════════════════════════════════════════════════════
                      SECTION 3: BANK DETAILS
                     ═══════════════════════════════════════════════════════ */}
                  <div className="hr-form-section">
                    <div className="hr-form-section-header">
                      <div className="hr-form-section-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="5" width="20" height="14" rx="2" />
                          <line x1="2" y1="10" x2="22" y2="10" />
                        </svg>
                      </div>
                      <h4>Bank Details</h4>
                    </div>

                    <div className="hr-form-grid">
                      {/* Account Holder Name (Required) */}
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

                      {/* Bank Name (Required) */}
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

                      {/* Account Number (Required & Numeric Only) */}
                      <div className="hr-form-group">
                        <label>Account Number *</label>
                        <input
                          type="text"
                          required
                          inputMode="numeric"
                          placeholder="e.g. 50100456789123"
                          className={formErrors['bankDetails.accountNumber'] ? 'hr-input-error' : ''}
                          value={addForm.bankDetails.accountNumber}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setAddForm({
                              ...addForm,
                              bankDetails: { ...addForm.bankDetails, accountNumber: val },
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

                      {/* IFSC Code (Required & Auto-Uppercase) */}
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
                            const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                            setAddForm({
                              ...addForm,
                              bankDetails: { ...addForm.bankDetails, ifscCode: val },
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

                      {/* Branch Name (Optional) */}
                      <div className="hr-form-group full-width">
                        <label>Branch Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Connaught Place Branch, New Delhi"
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
                    {submitting ? 'Saving Employee...' : 'Add Employee'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── EDIT EMPLOYEE MODAL ─── */}
        {showEditModal && selectedEmp && (
          <div className="hr-modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="hr-modal-header">
                <h3>Edit Employee Details</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowEditModal(false)}>&times;</button>
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
                        <option value="HR">HR</option>
                        <option value="Finance">Finance</option>
                        <option value="Business Development">Business Development</option>
                        <option value="Digital Marketing">Digital Marketing</option>
                        <option value="Video Editor">Video Editor</option>
                        <option value="Tech">Tech</option>
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
                    <div className="hr-form-group full-width">
                      <label>Status</label>
                      <select
                        value={String(editFormData.isActive)}
                        onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.value === 'true' })}
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── VIEW EMPLOYEE PROFILE MODAL ─── */}
        {showViewModal && selectedEmp && (
          <div className="hr-modal-overlay" onClick={() => setShowViewModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="hr-modal-header">
                <h3>Employee Profile</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowViewModal(false)}>&times;</button>
              </div>
              <div className="hr-modal-body">
                {/* Banner */}
                <div className="hr-profile-header-banner">
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
                  <div className="hr-profile-main-info">
                    <h4>{selectedEmp.personalInfo?.fullName || [selectedEmp.firstName, selectedEmp.lastName].filter(Boolean).join(' ') || selectedEmp.email}</h4>
                    <span>{selectedEmp.jobDetails?.designation || selectedEmp.designation || 'Designation not specified'} · {selectedEmp.jobDetails?.department || selectedEmp.department || 'General'}</span>
                  </div>
                </div>

                {/* Tabs */}
                <div className="hr-profile-tabs">
                  <button
                    type="button"
                    className={`hr-profile-tab-btn ${activeProfileTab === 'personal' ? 'active' : ''}`}
                    onClick={() => setActiveProfileTab('personal')}
                  >
                    Personal & Contact
                  </button>
                  <button
                    type="button"
                    className={`hr-profile-tab-btn ${activeProfileTab === 'employment' ? 'active' : ''}`}
                    onClick={() => setActiveProfileTab('employment')}
                  >
                    Job Details
                  </button>
                  <button
                    type="button"
                    className={`hr-profile-tab-btn ${activeProfileTab === 'bank' ? 'active' : ''}`}
                    onClick={() => setActiveProfileTab('bank')}
                  >
                    Bank Details
                  </button>
                  <button
                    type="button"
                    className={`hr-profile-tab-btn ${activeProfileTab === 'hrSummary' ? 'active' : ''}`}
                    onClick={() => setActiveProfileTab('hrSummary')}
                  >
                    HR History
                  </button>
                </div>

                {/* Tab 1: Personal & Contact */}
                {activeProfileTab === 'personal' && (
                  <div className="hr-profile-details-grid">
                    <div className="hr-profile-item">
                      <span>Full Name</span>
                      <strong>{selectedEmp.personalInfo?.fullName || [selectedEmp.firstName, selectedEmp.lastName].filter(Boolean).join(' ') || '—'}</strong>
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
                      <span>Address</span>
                      <strong>{selectedEmp.personalInfo?.address || selectedEmp.location || '—'}</strong>
                    </div>
                  </div>
                )}

                {/* Tab 2: Employment / Job Details */}
                {activeProfileTab === 'employment' && (
                  <div className="hr-profile-details-grid">
                    <div className="hr-profile-item">
                      <span>Employee ID</span>
                      <strong>{selectedEmp.jobDetails?.employeeId || selectedEmp._id}</strong>
                    </div>
                    <div className="hr-profile-item">
                      <span>Department</span>
                      <strong>{selectedEmp.jobDetails?.department || selectedEmp.department || 'Not Assigned'}</strong>
                    </div>
                    <div className="hr-profile-item">
                      <span>Designation</span>
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
                  </div>
                )}

                {/* Tab 3: Bank Details */}
                {activeProfileTab === 'bank' && (
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
                      <span>Payment Method</span>
                      <strong>Direct Bank Transfer</strong>
                    </div>
                  </div>
                )}

                {/* Tab 4: HR History Summary */}
                {activeProfileTab === 'hrSummary' && (
                  <div>
                    {profileSummary.loading ? (
                      <div className="hr-emp-empty">Loading HR history...</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="hr-profile-item">
                          <span>Total Recorded Attendance</span>
                          <strong>{profileSummary.attendance.length} days logged</strong>
                        </div>
                        <div className="hr-profile-item">
                          <span>Leave Requests</span>
                          <strong>
                            {profileSummary.leaves.length} total ({profileSummary.leaves.filter((l) => l.status === 'Approved').length} approved, {profileSummary.leaves.filter((l) => l.status === 'Pending').length} pending)
                          </strong>
                        </div>
                        <div className="hr-profile-item">
                          <span>Payroll Records</span>
                          <strong>{profileSummary.payroll.length} pay periods on file</strong>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="hr-modal-footer">
                <button type="button" className="hr-btn-secondary" onClick={() => setShowViewModal(false)}>Close</button>
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
          </div>
        )}
      </div>
    </UserLayout>
  );
}
