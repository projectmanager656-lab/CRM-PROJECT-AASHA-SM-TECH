import { useState, useEffect } from 'react';
import apiClient from '../../../../../services/apiClient';
import UserLayout from '../components/UserLayout';
import './HRDepartments.css';
import '../Employees/HREmployees.css';

export default function HRDepartments() {
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
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

  const totalDepartments = departments.length;
  const activeDepartments = departments.filter((d) => d.status === 'Active').length;
  const totalHeadcount = employees.length;

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

  const handleOpenEdit = (dept) => {
    setError('');
    setSuccess('');
    setSelectedDept(dept);
    setFormData({
      name: dept.name || '',
      description: dept.description || '',
      manager: dept.manager?._id || dept.manager || '',
      status: dept.status || 'Active',
      members: (dept.members || []).map((m) => m._id || m),
    });
    setShowEditModal(true);
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
    if (!window.confirm(`Are you sure you want to delete the ${dept.name} department? Employees assigned to this department will have their department cleared.`)) {
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Department
          </button>
        </div>

        {/* Dynamic Stats Grid */}
        <div className="hr-emp-stats-grid">
          <div className="hr-emp-stat-card blue">
            <div className="hr-emp-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="9" y1="22" x2="9" y2="22.01" /><line x1="15" y1="22" x2="15" y2="22.01" /></svg>
            </div>
            <div className="hr-emp-stat-body">
              <span>Total Departments</span>
              <strong>{totalDepartments}</strong>
            </div>
          </div>

          <div className="hr-emp-stat-card green">
            <div className="hr-emp-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div className="hr-emp-stat-body">
              <span>Active Divisions</span>
              <strong>{activeDepartments}</strong>
            </div>
          </div>

          <div className="hr-emp-stat-card purple">
            <div className="hr-emp-stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
            </div>
            <div className="hr-emp-stat-body">
              <span>Assigned Employees</span>
              <strong>{totalHeadcount}</strong>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
        {success && <div style={{ background: '#DCFCE7', color: '#15803D', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>{success}</div>}

        {/* Departments Card Grid */}
        {loading ? (
          <div className="hr-emp-empty">Loading departments...</div>
        ) : departments.length === 0 ? (
          <div className="hr-emp-empty">No departments configured yet.</div>
        ) : (
          <div className="hr-dept-grid">
            {departments.map((dept) => {
              const managerName = dept.manager
                ? `${dept.manager.firstName || ''} ${dept.manager.lastName || ''}`.trim() || dept.manager.email
                : 'Not Assigned';
              const memberCount = dept.employeeCount !== undefined
                ? dept.employeeCount
                : employees.filter((e) => e.department === dept.name).length;

              return (
                <div key={dept._id || dept.name} className="hr-dept-card">
                  <div>
                    <div className="hr-dept-card-top">
                      <div>
                        <h3 className="hr-dept-name">{dept.name}</h3>
                        <span className={`hr-emp-status-badge ${dept.status === 'Active' ? 'active' : 'inactive'}`}>
                          <span className="hr-emp-status-dot" />
                          {dept.status || 'Active'}
                        </span>
                      </div>
                      <div className="hr-dept-headcount-badge">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px', height: '14px' }}>
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                        </svg>
                        {memberCount} Members
                      </div>
                    </div>

                    <p className="hr-dept-desc">{dept.description || 'No description provided for this department.'}</p>

                    <div className="hr-dept-meta-row">
                      <span>Department Head</span>
                      <strong>{managerName}</strong>
                    </div>
                  </div>

                  <div className="hr-dept-card-actions">
                    <button
                      type="button"
                      className="hr-emp-action-btn edit"
                      style={{ flex: 1, padding: '0.5rem' }}
                      onClick={() => handleOpenEdit(dept)}
                    >
                      Edit Department
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
                </div>
              );
            })}
          </div>
        )}

        {/* ─── ADD DEPARTMENT MODAL ─── */}
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
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="hr-modal-header">
                <h3>Edit Department</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowEditModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleUpdateDept}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid">
                    <div className="hr-form-group full-width">
                      <label>Department Name</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="hr-form-group full-width">
                      <label>Description</label>
                      <input
                        type="text"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>
                    <div className="hr-form-group">
                      <label>Department Manager</label>
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
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
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
