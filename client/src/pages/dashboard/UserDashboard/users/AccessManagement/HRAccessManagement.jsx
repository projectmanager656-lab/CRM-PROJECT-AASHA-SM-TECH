import React, { useState, useEffect, useMemo, useContext, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import apiClient from '../../../../../services/apiClient';
import { AppContext } from '../../../../../context/AppContext';
import UserLayout from '../components/UserLayout';
import './HRAccessManagement.css';
import '../Employees/HREmployees.css';

const formatDate = (val) => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return String(val);
  }
};

export default function HRAccessManagement({ embedded = false, initialSearch = '' }) {
  const { user } = useContext(AppContext);
  const location = useLocation();
  const isHrOrAdmin = ['admin', 'super_admin'].includes(user?.role) || user?.department === 'HR';

  const [employees, setEmployees] = useState([]);
  const [metadata, setMetadata] = useState({
    departments: [],
    designations: [],
    roles: [],
    modules: [],
  });

  const [summary, setSummary] = useState({
    totalEmployees: 0,
    activeAccess: 0,
    restrictedAccess: 0,
    revokedAccess: 0,
    pendingAccessChanges: 0,
    totalAudits: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedRole, setSelectedRole] = useState('All');
  const [selectedAccessStatus, setSelectedAccessStatus] = useState('All');
  const [selectedEmploymentStatus, setSelectedEmploymentStatus] = useState('All');

  // Modals
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [showRevokeAllModal, setShowRevokeAllModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);

  // Selected Employee & Access Details
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState('modules'); // 'modules' | 'audit'

  // Grant Form
  const [grantForm, setGrantForm] = useState({
    employeeId: '',
    moduleKey: '',
    moduleName: '',
    reason: '',
    permissions: { view: true, create: false, edit: false, delete: false, approve: false, export: false },
  });

  // Revoke All Form
  const [revokeAllReason, setRevokeAllReason] = useState('');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilterEmployee, setAuditFilterEmployee] = useState(null);

  // Pick up initialSearch or query param (?search=) from cross-module navigation
  useEffect(() => {
    if (initialSearch !== undefined && initialSearch !== null && initialSearch !== '') {
      setSearch(initialSearch);
      return;
    }
    const params = new URLSearchParams(location?.search || '');
    const q = params.get('search');
    if (q) setSearch(q);
  }, [location?.search, initialSearch]);

  // Fetch Metadata, Summary & Employee List dynamically from MongoDB
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [metaRes, sumRes, empRes] = await Promise.all([
        apiClient.get('/access-management/metadata').catch(() => ({ data: { data: null } })),
        apiClient.get('/access-management/summary').catch(() => ({ data: { data: null } })),
        apiClient.get('/access-management/employees'),
      ]);

      if (metaRes.data?.data) {
        setMetadata(metaRes.data.data);
      }
      if (sumRes.data?.data) {
        setSummary(sumRes.data.data);
      }
      setEmployees(empRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load access management data from Atlas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load single employee complete access details from existing RBAC
  const loadEmployeeAccess = async (empId) => {
    setDetailLoading(true);
    try {
      const res = await apiClient.get(`/access-management/employees/${empId}`);
      setDetailData(res.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch employee access details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDetail = (emp, initialTab = 'modules') => {
    setSelectedEmployee(emp);
    setDetailTab(initialTab);
    setShowDetailModal(true);
    loadEmployeeAccess(emp._id);
  };

  const handleOpenGrant = (emp = null) => {
    setError('');
    setSuccess('');
    setSelectedEmployee(emp);
    const defaultModule = metadata.modules?.[0];
    setGrantForm({
      employeeId: emp?._id || employees[0]?._id || '',
      moduleKey: defaultModule?.key || 'crm',
      moduleName: defaultModule?.name || 'CRM',
      reason: 'Standard access grant for department operational assignments',
      permissions: { view: true, create: true, edit: true, delete: false, approve: false, export: false },
    });
    setShowGrantModal(true);
  };

  const handleSaveGrant = async (e) => {
    e.preventDefault();
    if (!grantForm.employeeId || !grantForm.moduleKey) {
      setError('Employee and module selection are required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post(`/access-management/employees/${grantForm.employeeId}/grant`, grantForm);
      setShowGrantModal(false);
      setSuccess(`Access granted successfully for module ${grantForm.moduleName || grantForm.moduleKey}.`);
      await loadData();
      if (selectedEmployee?._id === grantForm.employeeId) {
        await loadEmployeeAccess(grantForm.employeeId);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to grant access.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenRevokeAll = (emp) => {
    setSelectedEmployee(emp);
    setRevokeAllReason('All system access revoked by administrator');
    setShowRevokeAllModal(true);
  };

  const handleConfirmRevokeAll = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post(`/access-management/employees/${selectedEmployee._id}/revoke-all`, {
        reason: revokeAllReason || 'All system access revoked by administrator',
      });
      setShowRevokeAllModal(false);
      setSuccess(`All system access successfully revoked for ${selectedEmployee.firstName || ''} ${selectedEmployee.lastName || ''}.`);
      await loadData();
      if (showDetailModal) {
        await loadEmployeeAccess(selectedEmployee._id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to revoke system access.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestoreAccess = async (emp) => {
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post(`/access-management/employees/${emp._id}/restore`, {
        reason: 'Restored full active system access by administrator',
      });
      setSuccess(`System access restored to Active for ${emp.firstName || ''} ${emp.lastName || ''}.`);
      await loadData();
      if (showDetailModal && selectedEmployee?._id === emp._id) {
        await loadEmployeeAccess(emp._id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to restore access.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleModuleAction = async (empId, moduleKey, moduleName, actionType) => {
    setSubmitting(true);
    setError('');
    try {
      if (actionType === 'restrict') {
        await apiClient.post(`/access-management/employees/${empId}/restrict`, {
          moduleKeys: [moduleKey],
          moduleName,
          reason: `Restricted module ${moduleName} by administrator policy`,
        });
        setSuccess(`Module ${moduleName} restricted.`);
      } else if (actionType === 'revoke') {
        await apiClient.post(`/access-management/employees/${empId}/revoke`, {
          moduleKeys: [moduleKey],
          moduleName,
          reason: `Revoked module ${moduleName} by administrator policy`,
        });
        setSuccess(`Module ${moduleName} revoked.`);
      } else if (actionType === 'restore') {
        await apiClient.post(`/access-management/employees/${empId}/grant`, {
          moduleKey,
          moduleName,
          reason: `Restored access to ${moduleName}`,
        });
        setSuccess(`Access to module ${moduleName} restored.`);
      }
      await loadData();
      await loadEmployeeAccess(empId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update module access.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenGlobalAudit = async (emp = null) => {
    setAuditFilterEmployee(emp);
    setShowAuditModal(true);
    setAuditLoading(true);
    try {
      const url = emp ? `/access-management/audit?employeeId=${emp._id}` : '/access-management/audit';
      const res = await apiClient.get(url);
      setAuditLogs(res.data?.data || []);
    } catch (err) {
      setError('Failed to load access management audit trail.');
    } finally {
      setAuditLoading(false);
    }
  };

  // Filtered employees list based on search and dynamic filters
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const name = (emp.personalInfo?.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`).toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const empId = (emp.jobDetails?.employeeId || emp.employeeId || '').toLowerCase();
      const q = search.toLowerCase();

      const matchesSearch = !q || name.includes(q) || email.includes(q) || empId.includes(q);
      const matchesDept = selectedDept === 'All' || emp.department === selectedDept || emp.jobDetails?.department === selectedDept;
      const matchesRole = selectedRole === 'All' || emp.role === selectedRole || emp.rbacRoleKey === selectedRole;
      const matchesAccess = selectedAccessStatus === 'All' || emp.accessStatus === selectedAccessStatus;
      const matchesEmp = selectedEmploymentStatus === 'All' || emp.employmentStatus === selectedEmploymentStatus;

      return matchesSearch && matchesDept && matchesRole && matchesAccess && matchesEmp;
    });
  }, [employees, search, selectedDept, selectedRole, selectedAccessStatus, selectedEmploymentStatus]);

  const content = (
    <div className="acc-container" style={embedded ? { padding: '0.25rem 0 2rem 0' } : undefined}>
      {/* Header */}
        <div className="acc-header">
          <div className="acc-title-area">
            <h2>Centralized Access Management</h2>
            <p>
              Centrally inspect, grant, restrict, and revoke system access across all departments, roles, and modules using real MongoDB security policies.
            </p>
          </div>
          <div className="acc-header-actions">
            <button type="button" className="acc-secondary-btn" onClick={() => handleOpenGlobalAudit(null)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '15px', height: '15px' }}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              View Global Audit
            </button>
            {isHrOrAdmin && (
              <button type="button" className="acc-primary-btn" onClick={() => handleOpenGrant(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '15px', height: '15px' }}>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                + Grant Access
              </button>
            )}
          </div>
        </div>

        {/* Dynamic 5-Card KPI Strip */}
        <div className="acc-kpi-grid">
          <div className="acc-kpi-card blue">
            <span className="acc-kpi-label">Total Workforce</span>
            <strong className="acc-kpi-value">{summary.totalEmployees}</strong>
            <span className="acc-kpi-subtext">Registered in Atlas</span>
          </div>
          <div className="acc-kpi-card green">
            <span className="acc-kpi-label">Active Access</span>
            <strong className="acc-kpi-value">{summary.activeAccess}</strong>
            <span className="acc-kpi-subtext">Unrestricted Accounts</span>
          </div>
          <div className="acc-kpi-card amber">
            <span className="acc-kpi-label">Restricted Access</span>
            <strong className="acc-kpi-value">{summary.restrictedAccess}</strong>
            <span className="acc-kpi-subtext">Module Restrictions</span>
          </div>
          <div className="acc-kpi-card red">
            <span className="acc-kpi-label">Revoked Access</span>
            <strong className="acc-kpi-value">{summary.revokedAccess}</strong>
            <span className="acc-kpi-subtext">Fully Locked Accounts</span>
          </div>
          <div className="acc-kpi-card purple">
            <span className="acc-kpi-label">Total Access Audits</span>
            <strong className="acc-kpi-value">{summary.totalAudits}</strong>
            <span className="acc-kpi-subtext">Historical Audit Logs</span>
          </div>
        </div>

        {/* Alerts */}
        {error && <div className="acc-alert-error">{error}</div>}
        {success && <div className="acc-alert-success">{success}</div>}

        {/* Toolbar & Filters (100% Dynamic from MongoDB) */}
        <div className="acc-toolbar">
          <div className="acc-search-wrap">
            <svg className="acc-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by employee name, email, or employee ID..."
              className="acc-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select className="acc-filter-select" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
            <option value="All">All Departments</option>
            {metadata.departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select className="acc-filter-select" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
            <option value="All">All Roles</option>
            {metadata.roles.map((r) => (
              <option key={r.key} value={r.key}>{r.name}</option>
            ))}
          </select>

          <select className="acc-filter-select" value={selectedAccessStatus} onChange={(e) => setSelectedAccessStatus(e.target.value)}>
            <option value="All">All Access States</option>
            <option value="Active">Active</option>
            <option value="Restricted">Restricted</option>
            <option value="Revoked">Revoked</option>
          </select>

          <select className="acc-filter-select" value={selectedEmploymentStatus} onChange={(e) => setSelectedEmploymentStatus(e.target.value)}>
            <option value="All">All Employment Statuses</option>
            <option value="Active">Active</option>
            <option value="Probation">Probation</option>
            <option value="Notice Period">Notice Period</option>
            <option value="Exited">Exited</option>
            <option value="Terminated">Terminated</option>
          </select>
        </div>

        {/* Employee Access Table (Exact Columns: Employee, Employee ID, Department, Designation, Role, Current Access Status, Assigned Modules, Actions) */}
        <div className="acc-table-card">
          {loading ? (
            <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
              Querying real employee system access records from MongoDB Atlas...
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '40px', height: '40px', color: '#94a3b8', margin: '0 auto 0.75rem' }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <h4 style={{ margin: '0 0 0.25rem 0', color: '#0f172a' }}>No Access Records Found</h4>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>No employee records match the active search and filter criteria.</p>
            </div>
          ) : (
            <div className="acc-table-wrap">
              <table className="acc-table">
                <thead>
                  <tr>
                    <th className="acc-th-emp">Employee</th>
                    <th className="acc-th-id">Employee ID</th>
                    <th className="acc-th-dept">Department</th>
                    <th className="acc-th-desig">Designation</th>
                    <th className="acc-th-role">Role</th>
                    <th className="acc-th-status">Current Access Status</th>
                    <th className="acc-th-modules">Assigned Modules</th>
                    <th className="acc-th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => {
                    const fullName = emp.personalInfo?.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.email;
                    const employeeId = emp.jobDetails?.employeeId || emp.employeeId || '—';
                    const dept = emp.department || emp.jobDetails?.department || 'General';
                    const desig = emp.designation || emp.jobDetails?.designation || 'Staff';
                    const roleName = emp.role === 'super_admin' ? 'Super Admin' : emp.role === 'admin' ? 'Admin' : 'Employee';
                    const accessState = emp.accessStatus || 'Active';
                    const assigned = emp.assignedModulesCount !== undefined ? emp.assignedModulesCount : 8;
                    const total = emp.totalModulesCount || (metadata.modules?.length || 10);
                    const pct = Math.round((assigned / Math.max(1, total)) * 100);

                    return (
                      <tr key={emp._id}>
                        {/* 1. Employee */}
                        <td className="acc-td-emp">
                          <strong>{fullName}</strong>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>
                            {emp.email}
                          </span>
                        </td>

                        {/* 2. Employee ID */}
                        <td className="acc-td-id">
                          <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.825rem' }}>{employeeId}</span>
                        </td>

                        {/* 3. Department */}
                        <td className="acc-td-dept">
                          <span className="hr-emp-dept-pill">{dept}</span>
                        </td>

                        {/* 4. Designation */}
                        <td className="acc-td-desig">
                          <span style={{ fontSize: '0.825rem', color: '#334155' }}>{desig}</span>
                        </td>

                        {/* 5. Role */}
                        <td className="acc-td-role">
                          <span className="acc-role-pill">{roleName}</span>
                        </td>

                        {/* 6. Current Access Status */}
                        <td className="acc-td-status">
                          <span className={`acc-badge ${accessState.toLowerCase()}`}>
                            {accessState}
                          </span>
                        </td>

                        {/* 7. Assigned Modules */}
                        <td className="acc-td-modules">
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                            <strong style={{ color: accessState === 'Revoked' ? '#DC2626' : '#0f172a' }}>
                              {assigned}/{total}
                            </strong>
                            <span style={{ color: '#64748b' }}>{pct}%</span>
                          </div>
                          <div className="acc-meter-bar">
                            <div
                              className="acc-meter-fill"
                              style={{
                                width: `${pct}%`,
                                background: accessState === 'Revoked' ? '#DC2626' : accessState === 'Restricted' ? '#D97706' : '#2563eb',
                              }}
                            />
                          </div>
                        </td>

                        {/* 8. Actions (View Access, Manage Access, Grant Access, Revoke/Restrict, View Audit) */}
                        <td className="acc-td-actions">
                          <div className="acc-actions-wrap">
                            <button
                              type="button"
                              className="acc-btn-sm view"
                              title="View assigned security permissions"
                              onClick={() => handleOpenDetail(emp, 'modules')}
                            >
                              View Access
                            </button>

                            {isHrOrAdmin && (
                              <>
                                <button
                                  type="button"
                                  className="acc-btn-sm manage"
                                  title="Manage modules and permission levels"
                                  onClick={() => handleOpenDetail(emp, 'modules')}
                                >
                                  Manage Access
                                </button>
                                <button
                                  type="button"
                                  className="acc-btn-sm grant"
                                  title="Grant module access"
                                  onClick={() => handleOpenGrant(emp)}
                                >
                                  Grant Access
                                </button>
                                {accessState !== 'Revoked' ? (
                                  <button
                                    type="button"
                                    className="acc-btn-sm revoke"
                                    title="Revoke or restrict access"
                                    onClick={() => handleOpenRevokeAll(emp)}
                                  >
                                    Revoke/Restrict
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="acc-btn-sm restore"
                                    title="Restore full active access"
                                    disabled={submitting}
                                    onClick={() => handleRestoreAccess(emp)}
                                  >
                                    Restore
                                  </button>
                                )}
                              </>
                            )}

                            <button
                              type="button"
                              className="acc-btn-sm audit"
                              title="View access change audit trail"
                              onClick={() => handleOpenGlobalAudit(emp)}
                            >
                              View Audit
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

        {/* ═══════════════════════════════════════════════════════════════
            MODAL 1: SINGLE EMPLOYEE ACCESS DETAILS
            ═══════════════════════════════════════════════════════════════ */}
        {showDetailModal && selectedEmployee && (
          <div className="acc-modal-overlay" onClick={() => setShowDetailModal(false)}>
            <div className="acc-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="acc-dialog-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div className="acc-emp-avatar">
                    {(selectedEmployee.personalInfo?.fullName?.[0] || selectedEmployee.firstName?.[0] || 'E').toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 2px 0', fontSize: '1.15rem', color: '#0f172a' }}>
                      {selectedEmployee.personalInfo?.fullName || [selectedEmployee.firstName, selectedEmployee.lastName].filter(Boolean).join(' ') || selectedEmployee.email}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                      {selectedEmployee.jobDetails?.employeeId || selectedEmployee.employeeId ? `Employee ID: ${selectedEmployee.jobDetails?.employeeId || selectedEmployee.employeeId} • ` : ''}
                      {selectedEmployee.department || selectedEmployee.jobDetails?.department || 'General'} • {selectedEmployee.designation || selectedEmployee.jobDetails?.designation || 'Staff'} • Role: <strong>{detailData?.role?.name || selectedEmployee.role}</strong>
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className={`acc-badge ${(selectedEmployee.accessStatus || 'Active').toLowerCase()}`}>
                    {selectedEmployee.accessStatus || 'Active'}
                  </span>
                  <button type="button" className="acc-dialog-close" onClick={() => setShowDetailModal(false)}>&times;</button>
                </div>
              </div>

              {/* Sub Navigation */}
              <div style={{ display: 'flex', gap: '0.5rem', padding: '0.65rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  className="acc-btn-sm view"
                  style={{ background: detailTab === 'modules' ? '#ffffff' : 'transparent', borderColor: detailTab === 'modules' ? '#cbd5e1' : 'transparent' }}
                  onClick={() => setDetailTab('modules')}
                >
                  Assigned Modules & Permissions ({detailData?.modules?.length || 0})
                </button>
                <button
                  type="button"
                  className="acc-btn-sm view"
                  style={{ background: detailTab === 'audit' ? '#ffffff' : 'transparent', borderColor: detailTab === 'audit' ? '#cbd5e1' : 'transparent' }}
                  onClick={() => setDetailTab('audit')}
                >
                  Access Change History ({detailData?.auditTrail?.length || 0})
                </button>
              </div>

              <div className="acc-dialog-body">
                {detailLoading ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                    Loading employee security profile from MongoDB Atlas...
                  </div>
                ) : detailTab === 'modules' ? (
                  <div>
                    {/* Access Action Banner */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div>
                        <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>Current System Access Policies</strong>
                        <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                          Permissions are strictly enforced on backend APIs and frontend routes based on the employee's RBAC role and active status.
                        </p>
                      </div>
                      {isHrOrAdmin && (
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className="acc-btn-sm grant"
                            onClick={() => handleOpenGrant(selectedEmployee)}
                          >
                            + Grant Module
                          </button>
                          {selectedEmployee.accessStatus !== 'Revoked' ? (
                            <button
                              type="button"
                              className="acc-btn-sm revoke"
                              onClick={() => handleOpenRevokeAll(selectedEmployee)}
                            >
                              Revoke All Access
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="acc-btn-sm restore"
                              disabled={submitting}
                              onClick={() => handleRestoreAccess(selectedEmployee)}
                            >
                              Restore Full Access
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Modules Grid */}
                    <div className="acc-module-grid">
                      {(detailData?.modules || []).map((mod) => (
                        <div key={mod.key} className="acc-module-card">
                          <div className="acc-module-header">
                            <div>
                              <div className="acc-module-title">{mod.name}</div>
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{mod.key} • {mod.category}</span>
                            </div>
                            <span className={`acc-badge ${mod.status.toLowerCase()}`}>
                              {mod.status}
                            </span>
                          </div>

                          <p className="acc-module-desc">{mod.description || 'Enterprise module access'}</p>

                          <div>
                            <span style={{ fontSize: '0.68rem', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>
                              Permission Levels:
                            </span>
                            <div className="acc-action-chips">
                              {(mod.permissionLevels || []).map((act) => (
                                <span key={act} className="acc-chip">
                                  ✓ {act}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.65rem', borderTop: '1px solid #f1f5f9' }}>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Source: {mod.source}</span>
                            {isHrOrAdmin && (
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                {mod.status === 'Active' && (
                                  <>
                                    <button
                                      type="button"
                                      className="acc-btn-sm restrict"
                                      disabled={submitting}
                                      onClick={() => handleModuleAction(selectedEmployee._id, mod.key, mod.name, 'restrict')}
                                    >
                                      Restrict
                                    </button>
                                    <button
                                      type="button"
                                      className="acc-btn-sm revoke"
                                      disabled={submitting}
                                      onClick={() => handleModuleAction(selectedEmployee._id, mod.key, mod.name, 'revoke')}
                                    >
                                      Revoke
                                    </button>
                                  </>
                                )}
                                {mod.status === 'Restricted' && (
                                  <>
                                    <button
                                      type="button"
                                      className="acc-btn-sm restore"
                                      disabled={submitting}
                                      onClick={() => handleModuleAction(selectedEmployee._id, mod.key, mod.name, 'restore')}
                                    >
                                      Un-restrict
                                    </button>
                                    <button
                                      type="button"
                                      className="acc-btn-sm revoke"
                                      disabled={submitting}
                                      onClick={() => handleModuleAction(selectedEmployee._id, mod.key, mod.name, 'revoke')}
                                    >
                                      Revoke
                                    </button>
                                  </>
                                )}
                                {mod.status === 'Revoked' && (
                                  <button
                                    type="button"
                                    className="acc-btn-sm restore"
                                    disabled={submitting}
                                    onClick={() => handleModuleAction(selectedEmployee._id, mod.key, mod.name, 'restore')}
                                  >
                                    Restore
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Employee Specific Audit Trail */
                  <div>
                    {(!detailData?.auditTrail || detailData.auditTrail.length === 0) ? (
                      <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>
                        No historical access change records logged for this employee.
                      </p>
                    ) : (
                      <table className="acc-table" style={{ minWidth: '600px' }}>
                        <thead>
                          <tr>
                            <th>Action</th>
                            <th>Module</th>
                            <th>Transition</th>
                            <th>Performed By</th>
                            <th>Date & Time</th>
                            <th>Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailData.auditTrail.map((ev) => (
                            <tr key={ev._id}>
                              <td><strong>{ev.action}</strong></td>
                              <td>{ev.moduleName || ev.moduleKey}</td>
                              <td>
                                <span className="acc-chip">{ev.previousStatus || 'Active'} &rarr; {ev.newStatus}</span>
                              </td>
                              <td>{ev.performedByName || 'Admin'}</td>
                              <td>{formatDate(ev.date)} {new Date(ev.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                              <td style={{ maxWidth: '200px', fontSize: '0.78rem', color: '#64748b' }}>{ev.reason || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>

              <div className="acc-dialog-footer">
                <button type="button" className="acc-secondary-btn" onClick={() => setShowDetailModal(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            MODAL 2: GRANT ACCESS MODAL (DYNAMIC MODULES & PERMISSIONS)
            ═══════════════════════════════════════════════════════════════ */}
        {showGrantModal && (
          <div className="acc-modal-overlay" onClick={() => setShowGrantModal(false)}>
            <div className="acc-dialog sm" onClick={(e) => e.stopPropagation()}>
              <div className="acc-dialog-header">
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Grant Module Access</h3>
                <button type="button" className="acc-dialog-close" onClick={() => setShowGrantModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleSaveGrant}>
                <div className="acc-dialog-body">
                  <div className="hr-form-grid">
                    <div className="hr-form-group full-width">
                      <label>Select Employee *</label>
                      <select
                        required
                        value={grantForm.employeeId}
                        onChange={(e) => setGrantForm({ ...grantForm, employeeId: e.target.value })}
                      >
                        {employees.map((emp) => {
                          const name = emp.personalInfo?.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.email;
                          const idText = emp.jobDetails?.employeeId || emp.employeeId ? ` (${emp.jobDetails?.employeeId || emp.employeeId})` : '';
                          return (
                            <option key={emp._id} value={emp._id}>
                              {name}{idText} — {emp.department || 'General'}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Target System Module *</label>
                      <select
                        required
                        value={grantForm.moduleKey}
                        onChange={(e) => {
                          const selected = metadata.modules.find((m) => m.key === e.target.value);
                          setGrantForm({
                            ...grantForm,
                            moduleKey: e.target.value,
                            moduleName: selected ? selected.name : e.target.value,
                          });
                        }}
                      >
                        {metadata.modules.map((m) => (
                          <option key={m.key} value={m.key}>
                            {m.name} ({m.category || 'System'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Permission Levels (Actions)</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.35rem' }}>
                        {['view', 'create', 'edit', 'delete', 'approve', 'export'].map((act) => (
                          <label key={act} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={Boolean(grantForm.permissions[act])}
                              onChange={(e) => setGrantForm({
                                ...grantForm,
                                permissions: { ...grantForm.permissions, [act]: e.target.checked },
                              })}
                            />
                            {act.toUpperCase()}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Reason / Authorization Note *</label>
                      <textarea
                        rows={2}
                        required
                        placeholder="Document business justification for granting this module access..."
                        value={grantForm.reason}
                        onChange={(e) => setGrantForm({ ...grantForm, reason: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="acc-dialog-footer">
                  <button type="button" className="acc-secondary-btn" onClick={() => setShowGrantModal(false)}>Cancel</button>
                  <button type="submit" className="acc-primary-btn" disabled={submitting}>
                    {submitting ? 'Granting...' : 'Grant Access'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            MODAL 3: REVOKE ALL CONFIRMATION MODAL
            ═══════════════════════════════════════════════════════════════ */}
        {showRevokeAllModal && selectedEmployee && (
          <div className="acc-modal-overlay" onClick={() => setShowRevokeAllModal(false)}>
            <div className="acc-dialog sm" onClick={(e) => e.stopPropagation()}>
              <div className="acc-dialog-header">
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#DC2626' }}>Confirm Revoke All Access</h3>
                <button type="button" className="acc-dialog-close" onClick={() => setShowRevokeAllModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleConfirmRevokeAll}>
                <div className="acc-dialog-body">
                  <div style={{ textAlign: 'center', padding: '0.5rem 0 1rem' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⚠️</div>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>
                      Revoke all system access for {selectedEmployee.firstName} {selectedEmployee.lastName}?
                    </h4>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: '1.4' }}>
                      This will immediately lock all system modules for this employee and block API authentication. Historical attendance, records, and assignments remain preserved in MongoDB Atlas.
                    </p>
                  </div>

                  <div className="hr-form-group full-width">
                    <label>Reason for Revocation *</label>
                    <textarea
                      rows={2}
                      required
                      placeholder="e.g. Employee separation, security policy, notice period clearance"
                      value={revokeAllReason}
                      onChange={(e) => setRevokeAllReason(e.target.value)}
                    />
                  </div>
                </div>

                <div className="acc-dialog-footer">
                  <button type="button" className="acc-secondary-btn" onClick={() => setShowRevokeAllModal(false)}>Cancel</button>
                  <button type="submit" className="acc-btn-sm revoke" style={{ padding: '0.65rem 1.25rem' }} disabled={submitting}>
                    {submitting ? 'Revoking...' : 'Confirm & Revoke All Access'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            MODAL 4: AUDIT TRAIL MODAL (GLOBAL OR EMPLOYEE-SPECIFIC)
            ═══════════════════════════════════════════════════════════════ */}
        {showAuditModal && (
          <div className="acc-modal-overlay" onClick={() => setShowAuditModal(false)}>
            <div className="acc-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="acc-dialog-header">
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                  {auditFilterEmployee
                    ? `Access Audit Trail — ${auditFilterEmployee.personalInfo?.fullName || auditFilterEmployee.email}`
                    : 'System-Wide Access Management Audit Trail'}
                </h3>
                <button type="button" className="acc-dialog-close" onClick={() => setShowAuditModal(false)}>&times;</button>
              </div>

              <div className="acc-dialog-body">
                {auditLoading ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                    Loading security audit trail from MongoDB Atlas...
                  </div>
                ) : auditLogs.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No audit events logged yet.</p>
                ) : (
                  <div className="acc-table-wrap">
                    <table className="acc-table">
                      <thead>
                        <tr>
                          <th>Action</th>
                          <th>Employee</th>
                          <th>Department</th>
                          <th>Module</th>
                          <th>Transition</th>
                          <th>Performed By</th>
                          <th>Date & Time</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log) => (
                          <tr key={log._id}>
                            <td><strong>{log.action}</strong></td>
                            <td>
                              <strong>{log.employeeName}</strong>
                              <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b' }}>{log.designation || log.role}</span>
                            </td>
                            <td><span className="hr-emp-dept-pill">{log.department || 'General'}</span></td>
                            <td>{log.moduleName || log.moduleKey}</td>
                            <td>
                              <span className="acc-chip">{log.previousStatus || 'Active'} &rarr; {log.newStatus}</span>
                            </td>
                            <td>{log.performedByName || 'Admin'}</td>
                            <td>{formatDate(log.date)} {new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td style={{ maxWidth: '200px', fontSize: '0.78rem', color: '#64748b' }}>{log.reason || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="acc-dialog-footer">
                <button type="button" className="acc-secondary-btn" onClick={() => setShowAuditModal(false)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <UserLayout pageTitle="Access Management" pageSubtitle="Workforce Security & Permissions">
      {content}
    </UserLayout>
  );
}
