import { useState, useEffect, useMemo } from 'react';
import apiClient from '../../../../../services/apiClient';
import UserLayout from '../components/UserLayout';
import './HRDepartments.css';
import '../Employees/HREmployees.css';

const formatDate = (val) => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(val);
  }
};

export default function HRDepartments() {
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search, Filter & Pagination state
  const [search, setSearch] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [viewDept, setViewDept] = useState(null);
  const [selectedDept, setSelectedDept] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    manager: '',
    status: 'Active',
    members: [],
  });

  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [deptRes, empRes] = await Promise.all([
        apiClient.get('/admin/departments').catch(() => apiClient.get('/departments')),
        apiClient.get('/users').catch(() => ({ data: { data: [] } })),
      ]);
      setDepartments(deptRes.data?.data || []);
      setEmployees(empRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load department data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Reset pagination when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedDeptFilter, selectedStatusFilter]);

  // Existing KPI card metrics
  const totalDepartments = departments.length;
  const activeDepartments = departments.filter((d) => d.status === 'Active').length;
  const totalHeadcount = employees.length;

  // Resolve manager details from dept.manager or employees list
  const getManagerDetails = (dept) => {
    if (!dept) return null;

    // 1. Check direct manager reference on department
    const mgrRef =
      dept.manager ||
      dept.managerId ||
      dept.manager_id ||
      dept.departmentHead ||
      dept.head ||
      dept.lead ||
      dept.managedBy;

    let empMatch = null;

    if (mgrRef) {
      const mgrId = typeof mgrRef === 'object' && mgrRef !== null ? (mgrRef._id || mgrRef.id) : mgrRef;
      const mgrEmail =
        typeof mgrRef === 'object' && mgrRef !== null
          ? mgrRef.email
          : typeof mgrRef === 'string' && mgrRef.includes('@')
          ? mgrRef
          : null;

      if (mgrId) {
        empMatch = employees.find((e) => String(e._id || e.id) === String(mgrId));
      }

      if (!empMatch && mgrEmail) {
        empMatch = employees.find(
          (e) =>
            (e.email && e.email.trim().toLowerCase() === mgrEmail.trim().toLowerCase()) ||
            (e.personalInfo?.email && e.personalInfo.email.trim().toLowerCase() === mgrEmail.trim().toLowerCase())
        );
      }

      if (!empMatch && typeof mgrRef === 'object' && mgrRef !== null) {
        const refName = [mgrRef.firstName, mgrRef.lastName].filter(Boolean).join(' ').trim().toLowerCase();
        if (refName) {
          empMatch = employees.find((e) => {
            const eName = (e.personalInfo?.fullName || [e.firstName, e.lastName].filter(Boolean).join(' ')).trim().toLowerCase();
            return eName === refName;
          });
        }
      }
    }

    // 2. If no direct manager reference matched or was set, resolve from assigned department employees/members
    if (!empMatch && !mgrRef) {
      const deptEmployees = employees.filter((e) => {
        const empDept = e.jobDetails?.department || e.department;
        return empDept && empDept.trim().toLowerCase() === (dept.name || '').trim().toLowerCase();
      });

      if (deptEmployees.length > 0) {
        // Priority A: Designation containing manager, lead, head, supervisor, director
        empMatch = deptEmployees.find((e) => {
          const desig = (e.jobDetails?.designation || e.designation || '').toLowerCase();
          return (
            desig.includes('manager') ||
            desig.includes('lead') ||
            desig.includes('head') ||
            desig.includes('director') ||
            desig.includes('supervisor')
          );
        });

        // Priority B: Name containing "manager" or "lead"
        if (!empMatch) {
          empMatch = deptEmployees.find((e) => {
            const fullName = (e.personalInfo?.fullName || [e.firstName, e.lastName].filter(Boolean).join(' ')).toLowerCase();
            return fullName.includes('manager') || fullName.includes('lead');
          });
        }

        // Priority C: Role containing manager or admin
        if (!empMatch) {
          empMatch = deptEmployees.find((e) => {
            const role = (e.role || '').toLowerCase();
            return role === 'manager' || role === 'admin';
          });
        }

        // Priority D: Senior/specialist designation or primary assigned employee
        if (!empMatch) {
          empMatch =
            deptEmployees.find((e) => {
              const desig = (e.jobDetails?.designation || e.designation || '').toLowerCase();
              return desig.includes('specialist') || desig.includes('senior') || desig.includes('engineer');
            }) || deptEmployees[0];
        }
      }
    }

    // 3. Format resolved employee data
    if (empMatch) {
      const name =
        empMatch.personalInfo?.fullName?.trim() ||
        [empMatch.firstName, empMatch.lastName].filter(Boolean).join(' ').trim() ||
        empMatch.email;
      const email =
        empMatch.email?.trim() ||
        empMatch.personalInfo?.email?.trim() ||
        '—';
      const phone =
        empMatch.phone?.trim() ||
        empMatch.personalInfo?.phoneNumber?.trim() ||
        empMatch.phoneNumber?.trim() ||
        '—';
      const photo = empMatch.personalInfo?.profilePhoto || null;
      const initials =
        [empMatch.firstName?.[0], empMatch.lastName?.[0]].filter(Boolean).join('').toUpperCase() ||
        name.slice(0, 2).toUpperCase() ||
        'M';

      return {
        name,
        email,
        phone,
        photo,
        initials,
      };
    }

    // 4. Fallback for populated manager object where employee profile was not loaded in users list
    if (typeof mgrRef === 'object' && mgrRef !== null && (mgrRef.firstName || mgrRef.lastName || mgrRef.email)) {
      const name =
        [mgrRef.firstName, mgrRef.lastName].filter(Boolean).join(' ').trim() ||
        mgrRef.name ||
        mgrRef.email ||
        'Assigned';
      return {
        name,
        email: mgrRef.email || '—',
        phone: mgrRef.phone?.trim() || mgrRef.phoneNumber?.trim() || '—',
        photo: null,
        initials:
          [mgrRef.firstName?.[0], mgrRef.lastName?.[0]].filter(Boolean).join('').toUpperCase() ||
          name.slice(0, 2).toUpperCase() ||
          'M',
      };
    }

    return null;
  };

  // Get real employee count per department
  const getEmployeeCount = (dept) => {
    if (dept.employeeCount !== undefined) return dept.employeeCount;
    return employees.filter((e) => {
      const empDept = e.jobDetails?.department || e.department;
      return empDept === dept.name;
    }).length;
  };

  // Filtered department list based on search and filters
  const filteredDepartments = useMemo(() => {
    return departments.filter((dept) => {
      const mgr = getManagerDetails(dept);
      const searchLower = search.trim().toLowerCase();

      const nameMatch = (dept.name || '').toLowerCase().includes(searchLower);
      const mgrMatch = mgr
        ? mgr.name.toLowerCase().includes(searchLower) || mgr.email.toLowerCase().includes(searchLower)
        : false;
      const matchesSearch = !searchLower || nameMatch || mgrMatch;

      const matchesDept = selectedDeptFilter === 'All' || dept.name === selectedDeptFilter;
      const matchesStatus =
        selectedStatusFilter === 'All' || (dept.status || 'Active') === selectedStatusFilter;

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [departments, employees, search, selectedDeptFilter, selectedStatusFilter]);

  // Paginated records
  const totalItems = filteredDepartments.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedDepartments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDepartments.slice(start, start + pageSize);
  }, [filteredDepartments, currentPage, pageSize]);

  const handleOpenAdd = () => {
    setError('');
    setSuccess('');
    setFormData({
      name: '',
      description: '',
      manager: '',
      status: 'Active',
      members: [],
    });
    setShowAddModal(true);
  };

  const selectedManager = useMemo(() => {
    if (!formData.manager) return null;
    return (
      employees.find((emp) => String(emp._id) === String(formData.manager)) ||
      (typeof selectedDept?.manager === 'object' && String(selectedDept.manager?._id) === String(formData.manager)
        ? selectedDept.manager
        : null)
    );
  }, [formData.manager, employees, selectedDept]);

  const handleOpenEdit = async (dept) => {
    setError('');
    setSuccess('');
    setSelectedDept(dept);
    const mgrId = dept.manager?._id || dept.manager || '';
    setFormData({
      name: dept.name || '',
      description: dept.description || '',
      manager: mgrId,
      status: dept.status || 'Active',
      members: (dept.members || []).map((m) => m._id || m),
    });
    setShowEditModal(true);

    if (mgrId) {
      try {
        const res = await apiClient.get(`/users/${mgrId}`);
        if (res.data?.data) {
          const userObj = res.data.data;
          setEmployees((prev) => {
            const exists = prev.some((u) => String(u._id) === String(userObj._id));
            if (exists) {
              return prev.map((u) => (String(u._id) === String(userObj._id) ? { ...u, ...userObj } : u));
            }
            return [...prev, userObj];
          });
        }
      } catch {
        // quiet fallback
      }
    }
  };

  const handleManagerSelect = async (e) => {
    const newMgrId = e.target.value;
    setFormData((prev) => ({ ...prev, manager: newMgrId }));

    if (newMgrId) {
      try {
        const res = await apiClient.get(`/users/${newMgrId}`);
        if (res.data?.data) {
          const userObj = res.data.data;
          setEmployees((prev) => {
            const exists = prev.some((u) => String(u._id) === String(userObj._id));
            if (exists) {
              return prev.map((u) => (String(u._id) === String(userObj._id) ? { ...u, ...userObj } : u));
            }
            return [...prev, userObj];
          });
        }
      } catch {
        // quiet fallback
      }
    }
  };

  const handleCreateDept = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post('/admin/departments', formData);
      setShowAddModal(false);
      setSuccess('Department created successfully!');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create department.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateDept = async (e) => {
    e.preventDefault();
    if (!selectedDept) return;
    setSubmitting(true);
    setError('');
    try {
      await apiClient.put(`/admin/departments/${selectedDept._id}`, formData);
      setShowEditModal(false);
      setSuccess('Department updated successfully!');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update department.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDept = async (dept) => {
    if (
      !window.confirm(
        `Are you sure you want to delete the ${dept.name} department? Employees assigned to this department will have their department cleared.`
      )
    ) {
      return;
    }
    setError('');
    try {
      await apiClient.delete(`/admin/departments/${dept._id}`);
      setSuccess('Department deleted successfully!');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete department.');
    }
  };

  return (
    <UserLayout pageTitle="Department Management">
      <div className="hr-dept-container">
        {/* Header */}
        <div className="hr-dept-header">
          <div className="hr-dept-title-area">
            <h2>Department Management</h2>
            <p>Structure and manage organizational units, assign department managers and monitor headcounts.</p>
          </div>
          <button type="button" className="hr-emp-add-btn" onClick={handleOpenAdd}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: '16px', height: '16px' }}
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Department
          </button>
        </div>

        {/* 1. Dynamic Stats Grid (3 KPI cards kept exactly as existing page) */}
        <div className="hr-emp-stats-grid">
          <div className="hr-emp-stat-card blue">
            <div className="hr-emp-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <line x1="9" y1="22" x2="9" y2="22.01" />
                <line x1="15" y1="22" x2="15" y2="22.01" />
              </svg>
            </div>
            <div className="hr-emp-stat-body">
              <span>Total Departments</span>
              <strong>{totalDepartments}</strong>
            </div>
          </div>

          <div className="hr-emp-stat-card green">
            <div className="hr-emp-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="hr-emp-stat-body">
              <span>Active Divisions</span>
              <strong>{activeDepartments}</strong>
            </div>
          </div>

          <div className="hr-emp-stat-card purple">
            <div className="hr-emp-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>
            <div className="hr-emp-stat-body">
              <span>Assigned Employees</span>
              <strong>{totalHeadcount}</strong>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div
            style={{
              background: '#FEE2E2',
              color: '#B91C1C',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            style={{
              background: '#DCFCE7',
              color: '#15803D',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}
          >
            {success}
          </div>
        )}

        {/* 2 & 3. Search & Filter Bar */}
        <div className="hr-emp-toolbar hr-dept-toolbar">
          <div className="hr-emp-search-wrap">
            <svg className="hr-emp-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by Department Name or Manager..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="hr-emp-filter-select"
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
          >
            <option value="All">All Departments</option>
            {departments.map((d) => (
              <option key={d._id || d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            className="hr-emp-filter-select"
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        {/* 4. Department Listing Table */}
        <div className="hr-emp-table-card">
          {loading ? (
            <div className="hr-emp-empty">Loading departments...</div>
          ) : filteredDepartments.length === 0 ? (
            <div className="hr-emp-empty">No departments match the selected criteria.</div>
          ) : (
            <div className="hr-emp-table-wrap">
              <table className="hr-emp-table hr-dept-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Department Manager</th>
                    <th>Manager Email</th>
                    <th>Manager Phone</th>
                    <th>Employee Count</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDepartments.map((dept) => {
                    const mgr = getManagerDetails(dept);
                    const memberCount = getEmployeeCount(dept);

                    return (
                      <tr key={dept._id || dept.name}>
                        <td>
                          <div className="hr-dept-name-cell">
                            <div className="hr-dept-icon-box">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="4" y="2" width="16" height="20" rx="2" />
                                <line x1="9" y1="22" x2="9" y2="22.01" />
                                <line x1="15" y1="22" x2="15" y2="22.01" />
                                <line x1="8" y1="6" x2="16" y2="6" />
                                <line x1="8" y1="10" x2="16" y2="10" />
                                <line x1="8" y1="14" x2="16" y2="14" />
                              </svg>
                            </div>
                            <div>
                              <span className="hr-dept-table-name">{dept.name}</span>
                              {dept.description && (
                                <span className="hr-dept-table-desc" title={dept.description}>
                                  {dept.description}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          {mgr ? (
                            <div className="hr-emp-user-cell">
                              {mgr.photo ? (
                                <img
                                  src={mgr.photo}
                                  alt={mgr.name}
                                  className="hr-emp-avatar"
                                  style={{ objectFit: 'cover' }}
                                />
                              ) : (
                                <div className="hr-emp-avatar">{mgr.initials}</div>
                              )}
                              <div>
                                <span className="hr-emp-name">{mgr.name}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="hr-dept-unassigned">Not Assigned</span>
                          )}
                        </td>
                        <td>
                          <span className="hr-dept-text-cell">{mgr ? mgr.email : '—'}</span>
                        </td>
                        <td>
                          <span className="hr-dept-text-cell">{mgr ? mgr.phone : '—'}</span>
                        </td>
                        <td>
                          <span className="hr-dept-count-badge">
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              style={{ width: '13px', height: '13px' }}
                            >
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                            </svg>
                            {memberCount} {memberCount === 1 ? 'Employee' : 'Employees'}
                          </span>
                        </td>
                        <td>
                          <span className={`hr-emp-status-badge ${dept.status === 'Active' ? 'active' : 'inactive'}`}>
                            <span className="hr-emp-status-dot" />
                            {dept.status || 'Active'}
                          </span>
                        </td>
                        <td>
                          <div className="hr-emp-actions">
                            <button
                              type="button"
                              className="hr-emp-action-btn view"
                              onClick={() => setViewDept(dept)}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="hr-emp-action-btn edit"
                              onClick={() => handleOpenEdit(dept)}
                            >
                              Edit
                            </button>
                            {dept._id && (
                              <button
                                type="button"
                                className="hr-emp-action-btn view"
                                style={{ background: '#fee2e2', color: '#dc2626', borderColor: '#fecaca' }}
                                onClick={() => handleDeleteDept(dept)}
                              >
                                Delete
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

          {/* 6. Proper Bottom Section with Showing X to Y of Z and Pagination */}
          {!loading && filteredDepartments.length > 0 && (
            <div className="hr-dept-pagination-bar">
              <div className="hr-dept-pagination-info">
                Showing {Math.min((currentPage - 1) * pageSize + 1, totalItems)} to{' '}
                {Math.min(currentPage * pageSize, totalItems)} of {totalItems}{' '}
                {totalItems === 1 ? 'department' : 'departments'}
              </div>
              {totalPages > 1 && (
                <div className="hr-dept-pagination-controls">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <span className="hr-dept-page-indicator">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── VIEW DEPARTMENT MODAL (Read-Only Detail Modal) ─── */}
        {viewDept && (
          <div className="hr-modal-overlay" onClick={() => setViewDept(null)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
              <div className="hr-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="hr-dept-icon-box" style={{ width: '38px', height: '38px' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px' }}>
                      <rect x="4" y="2" width="16" height="20" rx="2" />
                      <line x1="9" y1="22" x2="9" y2="22.01" />
                      <line x1="15" y1="22" x2="15" y2="22.01" />
                    </svg>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>{viewDept.name}</h3>
                    <span className={`hr-emp-status-badge ${viewDept.status === 'Active' ? 'active' : 'inactive'}`} style={{ marginTop: '0.25rem' }}>
                      <span className="hr-emp-status-dot" />
                      {viewDept.status || 'Active'}
                    </span>
                  </div>
                </div>
                <button type="button" className="hr-modal-close" onClick={() => setViewDept(null)}>&times;</button>
              </div>
              <div className="hr-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
                    Description
                  </h4>
                  <p style={{ margin: 0, color: '#334155', fontSize: '0.875rem', lineHeight: 1.5 }}>
                    {viewDept.description || 'No description provided for this department.'}
                  </p>
                </div>

                <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
                    Department Head
                  </h4>
                  {(() => {
                    const mgr = getManagerDetails(viewDept);
                    if (!mgr) return <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No manager assigned</span>;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {mgr.photo ? (
                            <img src={mgr.photo} alt={mgr.name} className="hr-emp-avatar" style={{ objectFit: 'cover' }} />
                          ) : (
                            <div className="hr-emp-avatar">{mgr.initials}</div>
                          )}
                          <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>{mgr.name}</strong>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem', color: '#475569', fontSize: '0.8rem' }}>
                          <div><span style={{ color: '#64748b' }}>Email:</span> {mgr.email}</div>
                          <div><span style={{ color: '#64748b' }}>Phone:</span> {mgr.phone}</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
                      Assigned Employees ({getEmployeeCount(viewDept)})
                    </h4>
                  </div>
                  {(() => {
                    const deptMembers = employees.filter((e) => (e.jobDetails?.department || e.department) === viewDept.name);
                    if (deptMembers.length === 0) {
                      return <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>No employees currently assigned to this department.</p>;
                    }
                    return (
                      <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                          <tbody>
                            {deptMembers.map((emp) => {
                              const empName = emp.personalInfo?.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.email;
                              const designation = emp.jobDetails?.designation || emp.designation || 'Staff';
                              return (
                                <tr key={emp._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '0.5rem 0.75rem' }}>
                                    <span style={{ fontWeight: 600, color: '#0f172a', display: 'block' }}>{empName}</span>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{emp.email}</span>
                                  </td>
                                  <td style={{ padding: '0.5rem 0.75rem', color: '#475569', textAlign: 'right' }}>{designation}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="hr-modal-footer">
                <button type="button" className="hr-btn-secondary" onClick={() => setViewDept(null)}>Close</button>
                <button
                  type="button"
                  className="hr-btn-primary"
                  onClick={() => {
                    const deptToEdit = viewDept;
                    setViewDept(null);
                    handleOpenEdit(deptToEdit);
                  }}
                >
                  Edit Department
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── ADD DEPARTMENT MODAL (Preserved unchanged) ─── */}
        {showAddModal && (
          <div className="hr-modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="hr-modal-header">
                <h3>Add New Department</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowAddModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleCreateDept}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid">
                    <div className="hr-form-group full-width">
                      <label>Department Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Product Engineering"
                      />
                    </div>
                    <div className="hr-form-group full-width">
                      <label>Description</label>
                      <input
                        type="text"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Department responsibilities and scope"
                      />
                    </div>
                    <div className="hr-form-group">
                      <label>Department Manager / Head</label>
                      <select
                        value={formData.manager}
                        onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                      >
                        <option value="">Select Manager</option>
                        {employees.map((emp) => (
                          <option key={emp._id} value={emp._id}>
                            {[emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.email} ({emp.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="hr-form-group">
                      <label>Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Creating...' : 'Create Department'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── EDIT DEPARTMENT MODAL ─── */}
        {showEditModal && selectedDept && (
          <div className="hr-modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="hr-modal-card hr-dept-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="hr-modal-header">
                <div>
                  <h3>Edit Department</h3>
                  <p className="hr-dept-modal-subtitle">
                    Update department information, assign management, and configure settings.
                  </p>
                </div>
                <button type="button" className="hr-modal-close" onClick={() => setShowEditModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleUpdateDept}>
                <div className="hr-modal-body">
                  {/* 1. Department Information */}
                  <div className="hr-dept-form-section">
                    <div className="hr-dept-section-title">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="4" y="2" width="16" height="20" rx="2" />
                        <line x1="9" y1="22" x2="9" y2="22.01" />
                        <line x1="15" y1="22" x2="15" y2="22.01" />
                      </svg>
                      <h4>Department Information</h4>
                    </div>

                    <div className="hr-form-grid">
                      <div className="hr-form-group">
                        <label>Department Name *</label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g. Product Engineering"
                        />
                      </div>

                      {/* Department ID (show only if available in existing data) */}
                      {selectedDept._id && (
                        <div className="hr-form-group">
                          <label>Department ID</label>
                          <input
                            type="text"
                            value={selectedDept._id}
                            readOnly
                            disabled
                            className="hr-input-readonly"
                          />
                        </div>
                      )}

                      <div className="hr-form-group full-width">
                        <label>Description</label>
                        <textarea
                          rows={3}
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Department responsibilities and scope"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Management */}
                  <div className="hr-dept-form-section">
                    <div className="hr-dept-section-title">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <h4>Management</h4>
                    </div>

                    <div className="hr-form-grid">
                      <div className="hr-form-group full-width">
                        <label>Department Manager</label>
                        <select
                          value={formData.manager}
                          onChange={handleManagerSelect}
                        >
                          <option value="">Select Manager</option>
                          {employees.map((emp) => {
                            const empName =
                              emp.personalInfo?.fullName ||
                              [emp.firstName, emp.lastName].filter(Boolean).join(' ') ||
                              emp.email;
                            return (
                              <option key={emp._id} value={emp._id}>
                                {empName} ({emp.email})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Manager Email (Auto-populated from selected real manager, Read-only) */}
                      <div className="hr-form-group">
                        <label>Manager Email</label>
                        <input
                          type="text"
                          value={
                            formData.manager
                              ? (selectedManager?.email || selectedManager?.personalInfo?.email || 'Not Available')
                              : ''
                          }
                          placeholder={formData.manager ? 'Not Available' : 'Select a manager'}
                          readOnly
                          disabled
                          className="hr-input-readonly"
                        />
                      </div>

                      {/* Manager Phone (Auto-populated from selected real manager, Read-only) */}
                      <div className="hr-form-group">
                        <label>Manager Phone</label>
                        <input
                          type="text"
                          value={
                            formData.manager
                              ? (selectedManager?.phone?.trim() ||
                                selectedManager?.personalInfo?.phoneNumber?.trim() ||
                                selectedManager?.phoneNumber?.trim() ||
                                'Not Available')
                              : ''
                          }
                          placeholder={formData.manager ? 'Not Available' : 'Select a manager'}
                          readOnly
                          disabled
                          className="hr-input-readonly"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. Department Settings */}
                  <div className="hr-dept-form-section">
                    <div className="hr-dept-section-title">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                      <h4>Department Settings</h4>
                    </div>

                    <div className="hr-form-grid">
                      <div className="hr-form-group">
                        <label>Status</label>
                        <select
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>

                      {/* Location (shown ONLY if supported by existing department data) */}
                      {selectedDept.location && (
                        <div className="hr-form-group">
                          <label>Location</label>
                          <input
                            type="text"
                            value={formData.location || selectedDept.location || ''}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4. Read-only Department Summary */}
                  {(() => {
                    const deptMembers = employees.filter(
                      (e) => (e.jobDetails?.department || e.department) === selectedDept.name
                    );
                    const totalDeptEmployees =
                      selectedDept.employeeCount !== undefined && deptMembers.length === 0
                        ? selectedDept.employeeCount
                        : deptMembers.length;
                    const activeDeptEmployees = deptMembers.filter((e) => e.isActive).length;

                    return (
                      <div className="hr-dept-summary-card">
                        <div className="hr-dept-summary-header">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                          </svg>
                          <span>Department Overview (Read-Only)</span>
                        </div>
                        <div className="hr-dept-summary-grid">
                          <div className="hr-dept-summary-item">
                            <span className="label">Total Employees</span>
                            <strong className="val">{totalDeptEmployees}</strong>
                          </div>
                          <div className="hr-dept-summary-item">
                            <span className="label">Active Employees</span>
                            <strong className="val" style={{ color: '#16a34a' }}>
                              {activeDeptEmployees}
                            </strong>
                          </div>
                          {selectedDept.createdAt && (
                            <div className="hr-dept-summary-item">
                              <span className="label">Created Date</span>
                              <strong className="val">{formatDate(selectedDept.createdAt)}</strong>
                            </div>
                          )}
                          {selectedDept.updatedAt && (
                            <div className="hr-dept-summary-item">
                              <span className="label">Last Updated</span>
                              <strong className="val">{formatDate(selectedDept.updatedAt)}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
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
          </div>
        )}
      </div>
    </UserLayout>
  );
}
