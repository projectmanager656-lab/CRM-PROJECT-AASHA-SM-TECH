import { useState, useEffect, useMemo } from 'react';
import apiClient from '../../../../../services/apiClient';
import UserLayout from '../components/UserLayout';
import './HRTaskAllocation.css';

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

const getInitials = (user, fallback = 'U') => {
  if (!user) return fallback;
  const first = user.firstName?.[0] || '';
  const last = user.lastName?.[0] || '';
  if (first || last) return (first + last).toUpperCase();
  const full = user.personalInfo?.fullName || user.name || '';
  if (full) return full.slice(0, 2).toUpperCase();
  return fallback;
};

const getUserDisplayName = (user) => {
  if (!user) return 'Unassigned';
  return (
    user.personalInfo?.fullName?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    user.name ||
    user.email ||
    'User'
  );
};

export default function HRTaskAllocation() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters & Search
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('All');
  const [assigneeFilter, setAssigneeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [viewTask, setViewTask] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projectId: '',
    department: '',
    assignedTo: [],
    priority: 'Medium',
    status: 'Pending',
    startDate: '',
    dueDate: '',
  });

  const loadAllData = async () => {
    setLoading(true);
    setError('');
    try {
      const [tasksRes, projectsRes, usersRes, deptsRes] = await Promise.all([
        apiClient.get('/tasks').catch(() => ({ data: { data: [] } })),
        apiClient.get('/projects').catch(() => ({ data: { data: [] } })),
        apiClient.get('/users').catch(() => ({ data: { data: [] } })),
        apiClient.get('/admin/departments').catch(() => apiClient.get('/departments')).catch(() => ({ data: { data: [] } })),
      ]);

      setTasks(tasksRes.data?.data || []);
      setProjects(projectsRes.data?.data || []);
      setEmployees(usersRes.data?.data || []);
      setDepartments(deptsRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load task allocation data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, deptFilter, projectFilter, assigneeFilter, statusFilter, priorityFilter]);

  // Real KPIs
  const totalTasks = tasks.length;
  const pendingTasks = tasks.filter((t) => t.status === 'Pending').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'In Progress').length;
  const completedTasks = tasks.filter((t) => t.status === 'Completed').length;

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const searchLower = search.trim().toLowerCase();

      // Search match
      const titleMatch = (task.title || '').toLowerCase().includes(searchLower);
      const descMatch = (task.description || '').toLowerCase().includes(searchLower);
      const projName = task.projectId?.name || '';
      const projMatch = projName.toLowerCase().includes(searchLower);
      const assigneeNames = (Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo])
        .filter(Boolean)
        .map(getUserDisplayName)
        .join(' ')
        .toLowerCase();
      const assigneeMatch = assigneeNames.includes(searchLower);
      const matchesSearch = !searchLower || titleMatch || descMatch || projMatch || assigneeMatch;

      // Dropdown filters
      const matchesDept = deptFilter === 'All' || task.department === deptFilter;
      const matchesProj = projectFilter === 'All' || String(task.projectId?._id || task.projectId) === projectFilter;
      const matchesStatus = statusFilter === 'All' || task.status === statusFilter;
      const matchesPriority = priorityFilter === 'All' || task.priority === priorityFilter;

      let matchesAssignee = true;
      if (assigneeFilter !== 'All') {
        const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
        matchesAssignee = assignees.some((u) => String(u?._id || u) === assigneeFilter);
      }

      return matchesSearch && matchesDept && matchesProj && matchesStatus && matchesPriority && matchesAssignee;
    });
  }, [tasks, search, deptFilter, projectFilter, assigneeFilter, statusFilter, priorityFilter]);

  // Paginated records
  const totalItems = filteredTasks.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, currentPage, pageSize]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setError('');
    setSuccess('');
    setFormData({
      title: '',
      description: '',
      projectId: '',
      department: '',
      assignedTo: [],
      priority: 'Medium',
      status: 'Pending',
      startDate: new Date().toISOString().slice(0, 10),
      dueDate: '',
    });
    setShowCreateModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (task) => {
    setError('');
    setSuccess('');
    setSelectedTask(task);
    const assignees = (Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo])
      .filter(Boolean)
      .map((a) => a._id || a);

    setFormData({
      title: task.title || '',
      description: task.description || '',
      projectId: task.projectId?._id || task.projectId || '',
      department: task.department || '',
      assignedTo: assignees,
      priority: task.priority || 'Medium',
      status: task.status || 'Pending',
      startDate: task.startDate ? new Date(task.startDate).toISOString().slice(0, 10) : '',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
    });
    setShowEditModal(true);
  };

  // Submit Create Task
  const handleCreateTask = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        ...formData,
        projectId: formData.projectId || null,
        assignedTo: formData.assignedTo.filter(Boolean),
      };
      await apiClient.post('/tasks', payload);
      setShowCreateModal(false);
      setSuccess('Task created and allocated successfully!');
      await loadAllData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create task.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit Task
  const handleUpdateTask = async (e) => {
    e.preventDefault();
    if (!selectedTask) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        ...formData,
        projectId: formData.projectId || null,
        assignedTo: formData.assignedTo.filter(Boolean),
      };
      await apiClient.put(`/tasks/${selectedTask._id}`, payload);
      setShowEditModal(false);
      setSuccess('Task and allocation updated successfully!');
      await loadAllData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update task.');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Status Update
  const handleStatusChange = async (task, newStatus) => {
    try {
      await apiClient.patch(`/tasks/${task._id}/status`, { status: newStatus });
      setSuccess(`Task status changed to ${newStatus}`);
      await loadAllData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update task status.');
    }
  };

  // Delete Task
  const handleDeleteTask = async (task) => {
    if (!window.confirm(`Are you sure you want to delete "${task.title}"?`)) return;
    try {
      await apiClient.delete(`/tasks/${task._id}`);
      setSuccess('Task deleted successfully!');
      await loadAllData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete task.');
    }
  };

  return (
    <UserLayout pageTitle="Task Management & Allocation" pageSubtitle="HR Task Operations">
      <div className="hr-task-container">
        {/* Header */}
        <div className="hr-task-header">
          <div className="hr-task-title-area">
            <h2>Task Management & Allocation</h2>
            <p>Assign, monitor, and manage employee tasks across departments and active projects.</p>
          </div>
          <button type="button" className="hr-task-btn-primary" onClick={handleOpenCreate}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create & Allocate Task
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="hr-alert-box error">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
          </div>
        )}
        {success && (
          <div className="hr-alert-box success">
            <span>{success}</span>
            <button type="button" onClick={() => setSuccess('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="hr-task-kpi-grid">
          <div className="hr-task-kpi-card">
            <div className="hr-task-kpi-icon" style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
            <div className="hr-task-kpi-info">
              <span className="hr-task-kpi-label">Total Tasks</span>
              <span className="hr-task-kpi-val">{totalTasks}</span>
            </div>
          </div>

          <div className="hr-task-kpi-card">
            <div className="hr-task-kpi-icon" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="hr-task-kpi-info">
              <span className="hr-task-kpi-label">Pending</span>
              <span className="hr-task-kpi-val" style={{ color: '#b45309' }}>{pendingTasks}</span>
            </div>
          </div>

          <div className="hr-task-kpi-card">
            <div className="hr-task-kpi-icon" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
              </svg>
            </div>
            <div className="hr-task-kpi-info">
              <span className="hr-task-kpi-label">In Progress</span>
              <span className="hr-task-kpi-val" style={{ color: '#1d4ed8' }}>{inProgressTasks}</span>
            </div>
          </div>

          <div className="hr-task-kpi-card">
            <div className="hr-task-kpi-icon" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className="hr-task-kpi-info">
              <span className="hr-task-kpi-label">Completed</span>
              <span className="hr-task-kpi-val" style={{ color: '#047857' }}>{completedTasks}</span>
            </div>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="hr-task-toolbar">
          <div className="hr-task-search-wrap">
            <svg className="hr-task-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="hr-task-search-input"
              placeholder="Search by task title, description, project, assignee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Department Filter */}
          <select className="hr-task-filter-select" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="All">All Departments</option>
            {departments.map((d) => (
              <option key={d._id || d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Project Filter */}
          <select className="hr-task-filter-select" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="All">All Projects</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Assignee Filter */}
          <select className="hr-task-filter-select" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
            <option value="All">All Assignees</option>
            {employees.map((emp) => (
              <option key={emp._id} value={emp._id}>
                {getUserDisplayName(emp)}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select className="hr-task-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Overdue">Overdue</option>
          </select>

          {/* Priority Filter */}
          <select className="hr-task-filter-select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="All">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        {/* Tasks Table */}
        <div className="hr-task-table-card">
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading tasks...</div>
          ) : filteredTasks.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>No tasks found matching criteria.</div>
          ) : (
            <div className="hr-task-table-wrap">
              <table className="hr-task-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Project</th>
                    <th>Assigned To</th>
                    <th>Department</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Start Date</th>
                    <th>Due Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTasks.map((task) => {
                    const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
                    const primaryAssignee = assignees.find(Boolean);
                    const priorityClass = (task.priority || 'medium').toLowerCase();
                    const statusClass = (task.status || 'pending').toLowerCase().replace(' ', '-');

                    return (
                      <tr key={task._id}>
                        <td>
                          <div className="hr-task-title-cell">
                            <span className="hr-task-main-title" onClick={() => setViewTask(task)}>
                              {task.title}
                            </span>
                            {task.description && (
                              <span className="hr-task-sub-desc" title={task.description}>
                                {task.description}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {task.projectId ? (
                            <span className="hr-task-project-badge">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '12px', height: '12px' }}>
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                              </svg>
                              {task.projectId.name || 'Project'}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>Internal / General</span>
                          )}
                        </td>
                        <td>
                          {primaryAssignee ? (
                            <div className="hr-task-user-cell">
                              {primaryAssignee.personalInfo?.profilePhoto ? (
                                <img src={primaryAssignee.personalInfo.profilePhoto} alt="" className="hr-task-avatar" />
                              ) : (
                                <div className="hr-task-avatar">{getInitials(primaryAssignee)}</div>
                              )}
                              <div>
                                <span className="hr-task-user-name">{getUserDisplayName(primaryAssignee)}</span>
                                <span className="hr-task-user-email">{primaryAssignee.email}</span>
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>Unassigned</span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: '0.825rem', color: '#475569', fontWeight: 500 }}>
                            {task.department || 'General'}
                          </span>
                        </td>
                        <td>
                          <span className={`hr-priority-badge ${priorityClass}`}>
                            {task.priority || 'Medium'}
                          </span>
                        </td>
                        <td>
                          <select
                            className={`hr-status-pill ${statusClass}`}
                            value={task.status || 'Pending'}
                            onChange={(e) => handleStatusChange(task, e.target.value)}
                            style={{ outline: 'none' }}
                          >
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                            <option value="Overdue">Overdue</option>
                          </select>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.825rem', color: '#64748b' }}>{formatDate(task.startDate)}</span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.825rem', color: '#64748b' }}>{formatDate(task.dueDate)}</span>
                        </td>
                        <td>
                          <div className="hr-task-actions">
                            <button type="button" className="hr-task-action-btn view" onClick={() => setViewTask(task)}>
                              View
                            </button>
                            <button type="button" className="hr-task-action-btn edit" onClick={() => handleOpenEdit(task)}>
                              Edit
                            </button>
                            <button type="button" className="hr-task-action-btn delete" onClick={() => handleDeleteTask(task)}>
                              Delete
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

          {/* Pagination */}
          {!loading && filteredTasks.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#64748b' }}>
              <div>
                Showing {Math.min((currentPage - 1) * pageSize + 1, totalItems)} to{' '}
                {Math.min(currentPage * pageSize, totalItems)} of {totalItems} tasks
              </div>
              {totalPages > 1 && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="hr-task-btn-secondary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <span>Page {currentPage} of {totalPages}</span>
                  <button
                    type="button"
                    className="hr-task-btn-secondary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
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

        {/* ─── CREATE TASK MODAL ─── */}
        {showCreateModal && (
          <div className="hr-modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="hr-modal-header">
                <h3>Create & Allocate Task</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowCreateModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleCreateTask}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid">
                    <div className="hr-form-group full-width">
                      <label>Task Title *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Implement User Authentication"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Description</label>
                      <textarea
                        rows={3}
                        placeholder="Task details and instructions..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Connected Project</label>
                      <select
                        value={formData.projectId}
                        onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                      >
                        <option value="">None / General Internal</option>
                        {projects.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name} ({p.status})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Department</label>
                      <select
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      >
                        <option value="">Select Department</option>
                        {departments.map((d) => (
                          <option key={d._id || d.name} value={d.name}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Assign to Employee *</label>
                      <select
                        value={formData.assignedTo[0] || ''}
                        onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value ? [e.target.value] : [] })}
                        required
                      >
                        <option value="">Select Employee</option>
                        {employees.map((emp) => (
                          <option key={emp._id} value={emp._id}>
                            {getUserDisplayName(emp)} — {emp.jobDetails?.department || emp.department || 'Staff'} ({emp.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Priority</label>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Overdue">Overdue</option>
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Start Date</label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Due Date</label>
                      <input
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-task-btn-secondary" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="hr-task-btn-primary" disabled={submitting}>
                    {submitting ? 'Creating...' : 'Create & Allocate'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── EDIT & REASSIGN TASK MODAL ─── */}
        {showEditModal && selectedTask && (
          <div className="hr-modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="hr-modal-header">
                <h3>Edit & Reassign Task</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowEditModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleUpdateTask}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid">
                    <div className="hr-form-group full-width">
                      <label>Task Title *</label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Description</label>
                      <textarea
                        rows={3}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Connected Project</label>
                      <select
                        value={formData.projectId}
                        onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                      >
                        <option value="">None / General Internal</option>
                        {projects.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name} ({p.status})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Department</label>
                      <select
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      >
                        <option value="">Select Department</option>
                        {departments.map((d) => (
                          <option key={d._id || d.name} value={d.name}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Reassign / Assign to Employee *</label>
                      <select
                        value={formData.assignedTo[0] || ''}
                        onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value ? [e.target.value] : [] })}
                        required
                      >
                        <option value="">Select Employee</option>
                        {employees.map((emp) => (
                          <option key={emp._id} value={emp._id}>
                            {getUserDisplayName(emp)} — {emp.jobDetails?.department || emp.department || 'Staff'} ({emp.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Priority</label>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Overdue">Overdue</option>
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Start Date</label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Due Date</label>
                      <input
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-task-btn-secondary" onClick={() => setShowEditModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="hr-task-btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save & Reassign'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── VIEW TASK DETAIL MODAL ─── */}
        {viewTask && (
          <div className="hr-modal-overlay" onClick={() => setViewTask(null)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
              <div className="hr-modal-header">
                <div>
                  <h3 style={{ margin: 0 }}>Task Details</h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>ID: {viewTask._id}</span>
                </div>
                <button type="button" className="hr-modal-close" onClick={() => setViewTask(null)}>&times;</button>
              </div>
              <div className="hr-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.4rem', fontSize: '1.1rem', color: '#0f172a' }}>{viewTask.title}</h4>
                  <p style={{ margin: 0, color: '#475569', fontSize: '0.875rem', lineHeight: 1.5 }}>
                    {viewTask.description || 'No additional description provided.'}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Project</span>
                    <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{viewTask.projectId?.name || 'None'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Department</span>
                    <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{viewTask.department || 'General'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Priority</span>
                    <strong style={{ fontSize: '0.9rem', color: viewTask.priority === 'High' ? '#b91c1c' : '#b45309' }}>{viewTask.priority || 'Medium'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Status</span>
                    <strong style={{ fontSize: '0.9rem', color: viewTask.status === 'Completed' ? '#047857' : '#1d4ed8' }}>{viewTask.status || 'Pending'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Start Date</span>
                    <span style={{ fontSize: '0.85rem', color: '#334155' }}>{formatDate(viewTask.startDate)}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Due Date</span>
                    <span style={{ fontSize: '0.85rem', color: '#334155' }}>{formatDate(viewTask.dueDate)}</span>
                  </div>
                </div>

                {/* Assignee Card */}
                {(() => {
                  const assignees = Array.isArray(viewTask.assignedTo) ? viewTask.assignedTo : [viewTask.assignedTo];
                  const primaryAssignee = assignees.find(Boolean);
                  return (
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
                        Assigned Employee
                      </span>
                      {primaryAssignee ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div className="hr-task-avatar">{getInitials(primaryAssignee)}</div>
                          <div>
                            <strong style={{ color: '#0f172a', display: 'block' }}>{getUserDisplayName(primaryAssignee)}</strong>
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{primaryAssignee.email}</span>
                            {primaryAssignee.phone && (
                              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Phone: {primaryAssignee.phone}</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>No employee allocated to this task</span>
                      )}
                    </div>
                  );
                })()}

                {/* Quick Status Workflow */}
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>
                    Quick Status Update
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {['Pending', 'In Progress', 'Completed'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        className="hr-task-btn-secondary"
                        style={{
                          fontSize: '0.8rem',
                          padding: '0.35rem 0.75rem',
                          background: viewTask.status === st ? '#EA580C' : '#ffffff',
                          color: viewTask.status === st ? '#ffffff' : '#334155',
                          borderColor: viewTask.status === st ? '#EA580C' : '#cbd5e1',
                        }}
                        onClick={async () => {
                          await handleStatusChange(viewTask, st);
                          setViewTask({ ...viewTask, status: st });
                        }}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="hr-modal-footer">
                <button type="button" className="hr-task-btn-secondary" onClick={() => setViewTask(null)}>
                  Close
                </button>
                <button
                  type="button"
                  className="hr-task-btn-primary"
                  onClick={() => {
                    const taskToEdit = viewTask;
                    setViewTask(null);
                    handleOpenEdit(taskToEdit);
                  }}
                >
                  Edit / Reassign
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
}
