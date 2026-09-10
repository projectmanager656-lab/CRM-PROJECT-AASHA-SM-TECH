import { useState, useEffect, useMemo } from 'react';
import apiClient from '../../../../../services/apiClient';
import UserLayout from '../components/UserLayout';
import './HRProjectAllocation.css';

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

export default function HRProjectAllocation() {
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters & Search
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [pmFilter, setPmFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [viewProject, setViewProject] = useState(null);
  const [deleteModalProject, setDeleteModalProject] = useState(null);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Search inside Member Picker
  const [teamSearch, setTeamSearch] = useState('');

  // Form State for Project
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Tech',
    department: '',
    clientId: '',
    owner: '',
    sharedWith: [],
    status: 'Planning',
    priority: 'Medium',
    startDate: '',
    dueDate: '',
  });

  // Form State for Quick Add Task to Project
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    status: 'Pending',
    assignedTo: [],
    dueDate: '',
  });

  const loadAllData = async () => {
    setLoading(true);
    setError('');
    try {
      const [projectsRes, clientsRes, usersRes, deptsRes, tasksRes] = await Promise.all([
        apiClient.get('/projects').catch(() => ({ data: { data: [] } })),
        apiClient.get('/clients').catch(() => ({ data: { data: [] } })),
        apiClient.get('/users').catch(() => ({ data: { data: [] } })),
        apiClient.get('/admin/departments').catch(() => apiClient.get('/departments')).catch(() => ({ data: { data: [] } })),
        apiClient.get('/tasks').catch(() => ({ data: { data: [] } })),
      ]);

      setProjects(projectsRes.data?.data || []);
      setClients(clientsRes.data?.data || []);
      setEmployees(usersRes.data?.data || []);
      setDepartments(deptsRes.data?.data || []);
      setTasks(tasksRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load project allocation data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Compute Live Dynamic KPIs
  const kpis = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => p.status === 'Active').length;
    const completed = projects.filter((p) => p.status === 'Completed').length;

    // Unique allocated team members across all projects
    const allocatedUserIds = new Set();
    projects.forEach((p) => {
      const ownerId = p.owner?._id || p.owner;
      if (ownerId) allocatedUserIds.add(String(ownerId));
      if (Array.isArray(p.sharedWith)) {
        p.sharedWith.forEach((member) => {
          const mId = member?._id || member;
          if (mId) allocatedUserIds.add(String(mId));
        });
      }
    });

    return {
      total,
      active,
      completed,
      allocatedMembers: allocatedUserIds.size,
    };
  }, [projects]);

  // Project Progress Calculation
  const getProjectProgress = (proj) => {
    const projIdStr = String(proj._id);
    const related = tasks.filter((t) => {
      const tProjId = String(t.projectId?._id || t.projectId || '');
      return tProjId === projIdStr;
    });

    if (related.length === 0) {
      if (proj.status === 'Completed') return { percent: 100, count: 0, total: 0 };
      if (proj.status === 'Active') return { percent: 50, count: 0, total: 0 };
      return { percent: 0, count: 0, total: 0 };
    }

    const completed = related.filter((t) => t.status === 'Completed').length;
    const percent = Math.round((completed / related.length) * 100);
    return { percent, count: completed, total: related.length };
  };

  // Filter Projects
  const filteredProjects = useMemo(() => {
    return projects.filter((proj) => {
      const s = search.toLowerCase();
      const matchSearch =
        !s ||
        proj.name?.toLowerCase().includes(s) ||
        proj.description?.toLowerCase().includes(s) ||
        proj.clientId?.name?.toLowerCase().includes(s) ||
        proj.clientId?.company?.toLowerCase().includes(s) ||
        getUserDisplayName(proj.owner).toLowerCase().includes(s);

      const matchClient =
        clientFilter === 'All' ||
        String(proj.clientId?._id || proj.clientId) === clientFilter;

      const matchDept =
        deptFilter === 'All' ||
        (proj.department && proj.department.toLowerCase() === deptFilter.toLowerCase());

      const matchPm =
        pmFilter === 'All' ||
        String(proj.owner?._id || proj.owner) === pmFilter;

      const matchStatus =
        statusFilter === 'All' ||
        proj.status?.toLowerCase() === statusFilter.toLowerCase();

      const matchPriority =
        priorityFilter === 'All' ||
        proj.priority?.toLowerCase() === priorityFilter.toLowerCase();

      return matchSearch && matchClient && matchDept && matchPm && matchStatus && matchPriority;
    });
  }, [projects, search, clientFilter, deptFilter, pmFilter, statusFilter, priorityFilter]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredProjects.length / pageSize) || 1;
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, currentPage]);

  const openCreateModal = () => {
    setFormData({
      name: '',
      description: '',
      category: 'Tech',
      department: departments[0]?.name || '',
      clientId: clients[0]?._id || '',
      owner: '',
      sharedWith: [],
      status: 'Planning',
      priority: 'Medium',
      startDate: new Date().toISOString().slice(0, 10),
      dueDate: '',
    });
    setTeamSearch('');
    setShowCreateModal(true);
  };

  const openEditModal = (proj) => {
    setSelectedProject(proj);
    const sharedIds = Array.isArray(proj.sharedWith)
      ? proj.sharedWith.map((m) => (m?._id ? String(m._id) : String(m)))
      : [];

    setFormData({
      name: proj.name || '',
      description: proj.description || '',
      category: proj.category || 'Tech',
      department: proj.department || '',
      clientId: proj.clientId?._id || proj.clientId || '',
      owner: proj.owner?._id || proj.owner || '',
      sharedWith: sharedIds,
      status: proj.status || 'Planning',
      priority: proj.priority || 'Medium',
      startDate: proj.startDate ? new Date(proj.startDate).toISOString().slice(0, 10) : '',
      dueDate: proj.dueDate ? new Date(proj.dueDate).toISOString().slice(0, 10) : '',
    });
    setTeamSearch('');
    setShowEditModal(true);
  };

  const toggleTeamMember = (userId) => {
    setFormData((prev) => {
      const current = prev.sharedWith || [];
      const strId = String(userId);
      if (current.includes(strId)) {
        return { ...prev, sharedWith: current.filter((id) => id !== strId) };
      } else {
        return { ...prev, sharedWith: [...current, strId] };
      }
    });
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Project name is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        department: formData.department,
        clientId: formData.clientId || undefined,
        owner: formData.owner || undefined,
        sharedWith: formData.sharedWith,
        status: formData.status,
        priority: formData.priority,
        startDate: formData.startDate || undefined,
        dueDate: formData.dueDate || undefined,
      };

      await apiClient.post('/projects', payload);
      setSuccess('Project created and team allocated successfully!');
      setShowCreateModal(false);
      await loadAllData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create project.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !selectedProject) {
      setError('Project name is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        department: formData.department,
        clientId: formData.clientId || null,
        owner: formData.owner || null,
        sharedWith: formData.sharedWith,
        status: formData.status,
        priority: formData.priority,
        startDate: formData.startDate || null,
        dueDate: formData.dueDate || null,
      };

      await apiClient.patch(`/projects/${selectedProject._id}`, payload);
      setSuccess('Project and team allocations updated successfully!');
      setShowEditModal(false);
      await loadAllData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update project.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteModalProject) return;
    setSubmitting(true);
    setError('');
    try {
      await apiClient.delete(`/projects/${deleteModalProject._id}`);
      setSuccess(`Project "${deleteModalProject.name}" deleted successfully.`);
      setDeleteModalProject(null);
      if (viewProject?._id === deleteModalProject._id) {
        setViewProject(null);
      }
      await loadAllData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete project.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTaskToProject = async (e) => {
    e.preventDefault();
    if (!taskFormData.title.trim() || !viewProject) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        title: taskFormData.title.trim(),
        description: taskFormData.description.trim(),
        projectId: viewProject._id,
        department: viewProject.department || undefined,
        priority: taskFormData.priority,
        status: taskFormData.status,
        assignedTo: taskFormData.assignedTo,
        dueDate: taskFormData.dueDate || undefined,
      };

      await apiClient.post('/tasks', payload);
      setSuccess('Task added to project successfully!');
      setShowAddTaskModal(false);
      setTaskFormData({
        title: '',
        description: '',
        priority: 'Medium',
        status: 'Pending',
        assignedTo: [],
        dueDate: '',
      });
      await loadAllData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add task to project.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTeamPickerEmployees = useMemo(() => {
    const s = teamSearch.toLowerCase();
    if (!s) return employees;
    return employees.filter((emp) => {
      const name = getUserDisplayName(emp).toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const dept = (emp.department || '').toLowerCase();
      return name.includes(s) || email.includes(s) || dept.includes(s);
    });
  }, [employees, teamSearch]);

  const viewProjectTasks = useMemo(() => {
    if (!viewProject) return [];
    return tasks.filter((t) => {
      const pId = String(t.projectId?._id || t.projectId || '');
      return pId === String(viewProject._id);
    });
  }, [viewProject, tasks]);

  return (
    <UserLayout>
      <div className="hr-proj-container">
        {/* Header */}
        <div className="hr-proj-header">
          <div className="hr-proj-title-area">
            <h2>Project Management & Allocation</h2>
            <p>Manage enterprise projects, allocate managers & teams, track clients, and monitor live progress</p>
          </div>
          <button
            type="button"
            className="hr-proj-btn-primary"
            onClick={openCreateModal}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create & Allocate Project
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="hr-proj-alert error">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="hr-proj-alert success">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        {/* Live Dynamic KPIs */}
        <div className="hr-proj-kpi-grid">
          <div className="hr-proj-kpi-card">
            <div className="hr-proj-kpi-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <div className="hr-proj-kpi-info">
              <span className="hr-proj-kpi-label">Total Projects</span>
              <span className="hr-proj-kpi-val">{kpis.total}</span>
            </div>
          </div>

          <div className="hr-proj-kpi-card">
            <div className="hr-proj-kpi-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="hr-proj-kpi-info">
              <span className="hr-proj-kpi-label">Active Projects</span>
              <span className="hr-proj-kpi-val">{kpis.active}</span>
            </div>
          </div>

          <div className="hr-proj-kpi-card">
            <div className="hr-proj-kpi-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="hr-proj-kpi-info">
              <span className="hr-proj-kpi-label">Completed Projects</span>
              <span className="hr-proj-kpi-val">{kpis.completed}</span>
            </div>
          </div>

          <div className="hr-proj-kpi-card">
            <div className="hr-proj-kpi-icon" style={{ background: '#fff7ed', color: '#ea580c' }}>
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="hr-proj-kpi-info">
              <span className="hr-proj-kpi-label">Team Members Allocated</span>
              <span className="hr-proj-kpi-val">{kpis.allocatedMembers}</span>
            </div>
          </div>
        </div>

        {/* Toolbar: Search & Dynamic Filters */}
        <div className="hr-proj-toolbar">
          <div className="hr-proj-search-wrap">
            <svg className="hr-proj-search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="hr-proj-search-input"
              placeholder="Search by project name, description, client, manager..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="hr-proj-filters-group">
            {/* Client Filter */}
            <select
              className="hr-proj-select"
              value={clientFilter}
              onChange={(e) => {
                setClientFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="All">All Clients</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.company || c.name}
                </option>
              ))}
            </select>

            {/* Department Filter */}
            <select
              className="hr-proj-select"
              value={deptFilter}
              onChange={(e) => {
                setDeptFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="All">All Departments</option>
              {departments.map((d) => (
                <option key={d._id || d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>

            {/* Project Manager Filter */}
            <select
              className="hr-proj-select"
              value={pmFilter}
              onChange={(e) => {
                setPmFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="All">All Managers</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {getUserDisplayName(emp)}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              className="hr-proj-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="All">All Statuses</option>
              <option value="Planning">Planning</option>
              <option value="Active">Active</option>
              <option value="On Hold">On Hold</option>
              <option value="Completed">Completed</option>
            </select>

            {/* Priority Filter */}
            <select
              className="hr-proj-select"
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="All">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            {(search || clientFilter !== 'All' || deptFilter !== 'All' || pmFilter !== 'All' || statusFilter !== 'All' || priorityFilter !== 'All') && (
              <button
                type="button"
                className="hr-proj-btn-outline"
                onClick={() => {
                  setSearch('');
                  setClientFilter('All');
                  setDeptFilter('All');
                  setPmFilter('All');
                  setStatusFilter('All');
                  setPriorityFilter('All');
                  setCurrentPage(1);
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Project Table */}
        <div className="hr-proj-table-card">
          {loading ? (
            <div className="hr-proj-loading">
              <div className="hr-proj-spinner" />
              <span>Loading projects and allocations from server...</span>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="hr-proj-empty">
              <svg className="hr-proj-empty-icon" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              <h4>No projects found</h4>
              <p>No projects match your current filters. Create a new project or adjust the search criteria.</p>
            </div>
          ) : (
            <>
              <div className="hr-proj-table-wrap">
                <table className="hr-proj-table">
                  <thead>
                    <tr>
                      <th>Project Name</th>
                      <th>Client</th>
                      <th>Project Manager</th>
                      <th>Allocated Team</th>
                      <th>Department</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Timeline</th>
                      <th>Tasks & Progress</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProjects.map((proj) => {
                      const prog = getProjectProgress(proj);
                      const sharedList = Array.isArray(proj.sharedWith) ? proj.sharedWith : [];

                      return (
                        <tr key={proj._id}>
                          {/* Project Name & Category */}
                          <td>
                            <div className="hr-proj-info-col">
                              <span
                                className="hr-proj-name"
                                onClick={() => setViewProject(proj)}
                                title="Click to view details"
                              >
                                {proj.name}
                              </span>
                              <div className="hr-proj-meta-sub">
                                <span className="hr-proj-badge-category">{proj.category || 'Tech'}</span>
                              </div>
                            </div>
                          </td>

                          {/* Client */}
                          <td>
                            <div className="hr-proj-client-cell">
                              <div className="hr-proj-client-icon">
                                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path d="M3 21h18M5 21V7l8-4v18M13 11h2M13 15h2M13 19h2M19 21v-8l-6-3" />
                                </svg>
                              </div>
                              <div>
                                <div style={{ fontWeight: 600 }}>{proj.clientId?.company || proj.clientId?.name || 'Internal'}</div>
                                {proj.clientId?.email && (
                                  <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{proj.clientId.email}</div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Project Manager */}
                          <td>
                            <div className="hr-proj-user-cell">
                              <div className="hr-proj-avatar">
                                {getInitials(proj.owner, 'PM')}
                              </div>
                              <div className="hr-proj-user-meta">
                                <span className="hr-proj-user-name">{getUserDisplayName(proj.owner)}</span>
                                <span className="hr-proj-user-sub">{proj.owner?.email || 'PM'}</span>
                              </div>
                            </div>
                          </td>

                          {/* Allocated Team Members */}
                          <td>
                            {sharedList.length === 0 ? (
                              <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>None allocated</span>
                            ) : (
                              <div className="hr-proj-team-stack" title={`${sharedList.length} members allocated`}>
                                {sharedList.slice(0, 3).map((member, idx) => (
                                  <div
                                    key={member?._id || idx}
                                    className="hr-proj-team-avatar"
                                    title={getUserDisplayName(member)}
                                  >
                                    {getInitials(member)}
                                  </div>
                                ))}
                                {sharedList.length > 3 && (
                                  <div className="hr-proj-team-more">+{sharedList.length - 3}</div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Department */}
                          <td>
                            <span style={{ fontWeight: 500, color: '#334155' }}>
                              {proj.department || 'General'}
                            </span>
                          </td>

                          {/* Priority */}
                          <td>
                            <span className={`hr-proj-pill prio-${(proj.priority || 'Medium').toLowerCase()}`}>
                              {proj.priority || 'Medium'}
                            </span>
                          </td>

                          {/* Status */}
                          <td>
                            <span className={`hr-proj-pill status-${(proj.status || 'Planning').toLowerCase().replace(' ', '-')}`}>
                              <span className="hr-proj-pill-dot" />
                              {proj.status || 'Planning'}
                            </span>
                          </td>

                          {/* Timeline */}
                          <td>
                            <div style={{ fontSize: '0.775rem', lineHeight: 1.3 }}>
                              <div><strong style={{ color: '#64748b' }}>Start:</strong> {formatDate(proj.startDate)}</div>
                              <div><strong style={{ color: '#64748b' }}>Due:</strong> {formatDate(proj.dueDate)}</div>
                            </div>
                          </td>

                          {/* Tasks & Progress */}
                          <td>
                            <div className="hr-proj-progress-col">
                              <div className="hr-proj-progress-top">
                                <span>Progress</span>
                                <span>{prog.percent}%</span>
                              </div>
                              <div className="hr-proj-progress-track">
                                <div
                                  className="hr-proj-progress-bar"
                                  style={{ width: `${prog.percent}%` }}
                                />
                              </div>
                              <span className="hr-proj-tasks-meta">
                                {prog.total > 0 ? `${prog.count}/${prog.total} tasks done` : 'No tasks linked'}
                              </span>
                            </div>
                          </td>

                          {/* Actions */}
                          <td>
                            <div className="hr-proj-actions" style={{ justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                className="hr-proj-action-btn"
                                onClick={() => setViewProject(proj)}
                                title="View Project Details & Tasks"
                              >
                                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              </button>

                              <button
                                type="button"
                                className="hr-proj-action-btn edit"
                                onClick={() => openEditModal(proj)}
                                title="Edit Project & Team Allocation"
                              >
                                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>

                              <button
                                type="button"
                                className="hr-proj-action-btn delete"
                                onClick={() => setDeleteModalProject(proj)}
                                title="Delete Project"
                              >
                                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar */}
              <div className="hr-proj-pagination">
                <span>
                  Showing {paginatedProjects.length} of {filteredProjects.length} projects (Page {currentPage} of {totalPages})
                </span>
                <div className="hr-proj-pagination-btns">
                  <button
                    type="button"
                    className="hr-proj-pg-btn"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                    <button
                      key={num}
                      type="button"
                      className={`hr-proj-pg-btn ${num === currentPage ? 'active' : ''}`}
                      onClick={() => setCurrentPage(num)}
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="hr-proj-pg-btn"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal: Create Project & Allocate Team */}
        {showCreateModal && (
          <div className="hr-proj-modal-overlay">
            <div className="hr-proj-modal lg">
              <div className="hr-proj-modal-header">
                <h3>Create Project & Allocate Team</h3>
                <button
                  type="button"
                  className="hr-proj-modal-close"
                  onClick={() => setShowCreateModal(false)}
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleCreateProject} className="hr-proj-modal-form">
                <div className="hr-proj-modal-body">
                  {/* Basic Details */}
                  <div className="hr-proj-section-title">1. Project Information</div>
                  <div className="hr-proj-form-group">
                    <label>Project Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Enterprise HR Automation Portal"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="hr-proj-form-group">
                    <label>Description</label>
                    <textarea
                      rows={2}
                      placeholder="Brief overview of the project scope and deliverables..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <div className="hr-proj-form-row">
                    <div className="hr-proj-form-group">
                      <label>Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      >
                        <option value="Tech">Tech</option>
                        <option value="Non-Tech">Non-Tech</option>
                      </select>
                    </div>

                    <div className="hr-proj-form-group">
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
                  </div>

                  {/* Client & Project Manager Allocation */}
                  <div className="hr-proj-section-title">2. Client & Leadership Allocation</div>
                  <div className="hr-proj-form-row">
                    <div className="hr-proj-form-group">
                      <label>Client</label>
                      <select
                        value={formData.clientId}
                        onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                      >
                        <option value="">Internal / No Client</option>
                        {clients.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.company ? `${c.company} (${c.name})` : c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-proj-form-group">
                      <label>Project Manager (Owner)</label>
                      <select
                        value={formData.owner}
                        onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                      >
                        <option value="">Assign Project Manager</option>
                        {employees.map((emp) => (
                          <option key={emp._id} value={emp._id}>
                            {getUserDisplayName(emp)} ({emp.department || emp.role || 'Staff'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Team Members Allocation */}
                  <div className="hr-proj-section-title">3. Allocate Team Members (Employees)</div>
                  <div className="hr-proj-form-group">
                    <div className="hr-proj-team-header-row">
                      <span className="hr-proj-team-count">
                        Selected: <strong>{formData.sharedWith.length} members</strong>
                      </span>
                      <input
                        type="text"
                        className="hr-proj-team-search"
                        placeholder="Search employee..."
                        value={teamSearch}
                        onChange={(e) => setTeamSearch(e.target.value)}
                      />
                    </div>

                    <div className="hr-proj-team-picker">
                      {filteredTeamPickerEmployees.map((emp) => {
                        const isSelected = formData.sharedWith.includes(String(emp._id));
                        return (
                          <div
                            key={emp._id}
                            className={`hr-proj-member-row ${isSelected ? 'selected' : ''}`}
                            onClick={() => toggleTeamMember(emp._id)}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="hr-proj-member-check"
                            />
                            <div className="hr-proj-member-avatar">
                              {getInitials(emp)}
                            </div>
                            <span className="hr-proj-member-name">
                              {getUserDisplayName(emp)}
                            </span>
                            <span className="hr-proj-member-dept">
                              {emp.department || 'General'}
                            </span>
                            <span className="hr-proj-member-email">
                              {emp.email}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Schedule & Priority */}
                  <div className="hr-proj-section-title">4. Status, Priority & Dates</div>
                  <div className="hr-proj-form-row">
                    <div className="hr-proj-form-group">
                      <label>Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      >
                        <option value="Planning">Planning</option>
                        <option value="Active">Active</option>
                        <option value="On Hold">On Hold</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>

                    <div className="hr-proj-form-group">
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
                  </div>

                  <div className="hr-proj-form-row">
                    <div className="hr-proj-form-group">
                      <label>Start Date</label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      />
                    </div>

                    <div className="hr-proj-form-group">
                      <label>Due Date</label>
                      <input
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="hr-proj-modal-footer">
                  <button
                    type="button"
                    className="hr-proj-btn-outline"
                    onClick={() => setShowCreateModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="hr-proj-btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? 'Creating...' : 'Create & Allocate'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Project & Reallocate Team */}
        {showEditModal && selectedProject && (
          <div className="hr-proj-modal-overlay">
            <div className="hr-proj-modal lg">
              <div className="hr-proj-modal-header">
                <h3>Edit Project & Reallocate Team</h3>
                <button
                  type="button"
                  className="hr-proj-modal-close"
                  onClick={() => setShowEditModal(false)}
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleUpdateProject} className="hr-proj-modal-form">
                <div className="hr-proj-modal-body">
                  {/* Basic Details */}
                  <div className="hr-proj-section-title">1. Project Information</div>
                  <div className="hr-proj-form-group">
                    <label>Project Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="hr-proj-form-group">
                    <label>Description</label>
                    <textarea
                      rows={2}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <div className="hr-proj-form-row">
                    <div className="hr-proj-form-group">
                      <label>Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      >
                        <option value="Tech">Tech</option>
                        <option value="Non-Tech">Non-Tech</option>
                      </select>
                    </div>

                    <div className="hr-proj-form-group">
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
                  </div>

                  {/* Client & Project Manager Allocation */}
                  <div className="hr-proj-section-title">2. Client & Leadership Allocation</div>
                  <div className="hr-proj-form-row">
                    <div className="hr-proj-form-group">
                      <label>Client</label>
                      <select
                        value={formData.clientId}
                        onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                      >
                        <option value="">Internal / No Client</option>
                        {clients.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.company ? `${c.company} (${c.name})` : c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-proj-form-group">
                      <label>Project Manager (Owner)</label>
                      <select
                        value={formData.owner}
                        onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                      >
                        <option value="">Assign Project Manager</option>
                        {employees.map((emp) => (
                          <option key={emp._id} value={emp._id}>
                            {getUserDisplayName(emp)} ({emp.department || emp.role || 'Staff'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Team Members Allocation */}
                  <div className="hr-proj-section-title">3. Team Allocation ({formData.sharedWith.length} Members)</div>
                  <div className="hr-proj-form-group">
                    <div className="hr-proj-team-header-row">
                      <span className="hr-proj-team-count">
                        Select team members to allocate to this project:
                      </span>
                      <input
                        type="text"
                        className="hr-proj-team-search"
                        placeholder="Search employee..."
                        value={teamSearch}
                        onChange={(e) => setTeamSearch(e.target.value)}
                      />
                    </div>

                    <div className="hr-proj-team-picker">
                      {filteredTeamPickerEmployees.map((emp) => {
                        const isSelected = formData.sharedWith.includes(String(emp._id));
                        return (
                          <div
                            key={emp._id}
                            className={`hr-proj-member-row ${isSelected ? 'selected' : ''}`}
                            onClick={() => toggleTeamMember(emp._id)}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="hr-proj-member-check"
                            />
                            <div className="hr-proj-member-avatar">
                              {getInitials(emp)}
                            </div>
                            <span className="hr-proj-member-name">
                              {getUserDisplayName(emp)}
                            </span>
                            <span className="hr-proj-member-dept">
                              {emp.department || 'General'}
                            </span>
                            <span className="hr-proj-member-email">
                              {emp.email}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Schedule & Priority */}
                  <div className="hr-proj-section-title">4. Status, Priority & Dates</div>
                  <div className="hr-proj-form-row">
                    <div className="hr-proj-form-group">
                      <label>Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      >
                        <option value="Planning">Planning</option>
                        <option value="Active">Active</option>
                        <option value="On Hold">On Hold</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>

                    <div className="hr-proj-form-group">
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
                  </div>

                  <div className="hr-proj-form-row">
                    <div className="hr-proj-form-group">
                      <label>Start Date</label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      />
                    </div>

                    <div className="hr-proj-form-group">
                      <label>Due Date</label>
                      <input
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="hr-proj-modal-footer">
                  <button
                    type="button"
                    className="hr-proj-btn-outline"
                    onClick={() => setShowEditModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="hr-proj-btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? 'Saving...' : 'Save & Update'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: View Project Details & Related Tasks */}
        {viewProject && (
          <div className="hr-proj-modal-overlay">
            <div className="hr-proj-modal lg">
              <div className="hr-proj-modal-header">
                <div>
                  <h3 style={{ marginBottom: '0.2rem' }}>{viewProject.name}</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className="hr-proj-badge-category">{viewProject.category || 'Tech'}</span>
                    <span className={`hr-proj-pill status-${(viewProject.status || 'Planning').toLowerCase().replace(' ', '-')}`}>
                      {viewProject.status || 'Planning'}
                    </span>
                    <span className={`hr-proj-pill prio-${(viewProject.priority || 'Medium').toLowerCase()}`}>
                      {viewProject.priority || 'Medium'} Priority
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="hr-proj-modal-close"
                  onClick={() => setViewProject(null)}
                >
                  &times;
                </button>
              </div>

              <div className="hr-proj-modal-body">
                {viewProject.description && (
                  <div style={{ fontSize: '0.875rem', color: '#475569', background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    {viewProject.description}
                  </div>
                )}

                {/* Grid: Client & Manager Info */}
                <div className="hr-proj-detail-grid">
                  <div className="hr-proj-detail-box">
                    <h4>Client Information</h4>
                    {viewProject.clientId ? (
                      <div>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.925rem' }}>
                          {viewProject.clientId.company || viewProject.clientId.name}
                        </div>
                        {viewProject.clientId.name && viewProject.clientId.company && (
                          <div style={{ fontSize: '0.8rem', color: '#475569' }}>Contact: {viewProject.clientId.name}</div>
                        )}
                        {viewProject.clientId.email && (
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Email: {viewProject.clientId.email}</div>
                        )}
                        {viewProject.clientId.phone && (
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Phone: {viewProject.clientId.phone}</div>
                        )}
                      </div>
                    ) : (
                      <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Internal Project (No Client)</div>
                    )}
                  </div>

                  <div className="hr-proj-detail-box">
                    <h4>Project Manager</h4>
                    {viewProject.owner ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="hr-proj-avatar" style={{ width: 36, height: 36 }}>
                          {getInitials(viewProject.owner, 'PM')}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{getUserDisplayName(viewProject.owner)}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{viewProject.owner.email}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Dept: {viewProject.owner.department || 'General'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No manager assigned</div>
                    )}
                  </div>
                </div>

                {/* Timeline & Department */}
                <div className="hr-proj-detail-grid">
                  <div className="hr-proj-detail-box">
                    <h4>Department & Category</h4>
                    <div style={{ fontSize: '0.875rem', color: '#1e293b' }}>
                      <strong>Department:</strong> {viewProject.department || 'General'}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#1e293b', marginTop: '0.25rem' }}>
                      <strong>Category:</strong> {viewProject.category || 'Tech'}
                    </div>
                  </div>

                  <div className="hr-proj-detail-box">
                    <h4>Timeline & Deadlines</h4>
                    <div style={{ fontSize: '0.875rem', color: '#1e293b' }}>
                      <strong>Start Date:</strong> {formatDate(viewProject.startDate)}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#1e293b', marginTop: '0.25rem' }}>
                      <strong>Due Date:</strong> {formatDate(viewProject.dueDate)}
                    </div>
                  </div>
                </div>

                {/* Allocated Team Members List */}
                <div className="hr-proj-detail-box">
                  <h4>Allocated Team Members ({Array.isArray(viewProject.sharedWith) ? viewProject.sharedWith.length : 0})</h4>
                  {Array.isArray(viewProject.sharedWith) && viewProject.sharedWith.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.65rem', marginTop: '0.5rem' }}>
                      {viewProject.sharedWith.map((mem, idx) => (
                        <div
                          key={mem?._id || idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.4rem 0.6rem',
                            background: '#ffffff',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <div className="hr-proj-avatar" style={{ width: 26, height: 26, fontSize: '0.7rem' }}>
                            {getInitials(mem)}
                          </div>
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                              {getUserDisplayName(mem)}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                              {mem?.email || 'Employee'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No team members allocated to this project yet.</div>
                  )}
                </div>

                {/* Related Tasks Section */}
                <div className="hr-proj-tasks-container">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                      Related Tasks ({viewProjectTasks.length})
                    </div>
                    <button
                      type="button"
                      className="hr-proj-btn-primary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                      onClick={() => setShowAddTaskModal(true)}
                    >
                      + Add Task to Project
                    </button>
                  </div>

                  {viewProjectTasks.length === 0 ? (
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontSize: '0.825rem' }}>
                      No tasks created for this project yet. Click &quot;+ Add Task to Project&quot; to assign tasks.
                    </div>
                  ) : (
                    <div className="hr-proj-tasks-list">
                      {viewProjectTasks.map((t) => (
                        <div key={t._id} className="hr-proj-task-row">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <span style={{ fontWeight: 600, color: '#0f172a' }}>{t.title}</span>
                            <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
                              Due: {formatDate(t.dueDate)} &bull; Priority: {t.priority || 'Medium'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#475569' }}>
                              {Array.isArray(t.assignedTo) && t.assignedTo.length > 0
                                ? getUserDisplayName(t.assignedTo[0])
                                : 'Unassigned'}
                            </span>
                            <span className={`hr-proj-pill status-${(t.status || 'Pending').toLowerCase().replace(' ', '-')}`}>
                              {t.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="hr-proj-modal-footer">
                <button
                  type="button"
                  className="hr-proj-btn-outline"
                  onClick={() => openEditModal(viewProject)}
                >
                  Edit Project & Allocations
                </button>
                <button
                  type="button"
                  className="hr-proj-btn-primary"
                  onClick={() => setViewProject(null)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Quick Add Task directly to Project */}
        {showAddTaskModal && viewProject && (
          <div className="hr-proj-modal-overlay" style={{ zIndex: 1001 }}>
            <div className="hr-proj-modal">
              <div className="hr-proj-modal-header">
                <h3>Add Task to {viewProject.name}</h3>
                <button
                  type="button"
                  className="hr-proj-modal-close"
                  onClick={() => setShowAddTaskModal(false)}
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleAddTaskToProject}>
                <div className="hr-proj-modal-body">
                  <div className="hr-proj-form-group">
                    <label>Task Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Implement client dashboard charts"
                      value={taskFormData.title}
                      onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                    />
                  </div>

                  <div className="hr-proj-form-group">
                    <label>Task Description</label>
                    <textarea
                      rows={2}
                      placeholder="Details of the task..."
                      value={taskFormData.description}
                      onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                    />
                  </div>

                  <div className="hr-proj-form-row">
                    <div className="hr-proj-form-group">
                      <label>Assignee</label>
                      <select
                        value={taskFormData.assignedTo[0] || ''}
                        onChange={(e) =>
                          setTaskFormData({
                            ...taskFormData,
                            assignedTo: e.target.value ? [e.target.value] : [],
                          })
                        }
                      >
                        <option value="">Select Assignee</option>
                        {employees.map((emp) => (
                          <option key={emp._id} value={emp._id}>
                            {getUserDisplayName(emp)} ({emp.department || 'Staff'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-proj-form-group">
                      <label>Due Date</label>
                      <input
                        type="date"
                        value={taskFormData.dueDate}
                        onChange={(e) => setTaskFormData({ ...taskFormData, dueDate: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="hr-proj-form-row">
                    <div className="hr-proj-form-group">
                      <label>Priority</label>
                      <select
                        value={taskFormData.priority}
                        onChange={(e) => setTaskFormData({ ...taskFormData, priority: e.target.value })}
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>

                    <div className="hr-proj-form-group">
                      <label>Status</label>
                      <select
                        value={taskFormData.status}
                        onChange={(e) => setTaskFormData({ ...taskFormData, status: e.target.value })}
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="hr-proj-modal-footer">
                  <button
                    type="button"
                    className="hr-proj-btn-outline"
                    onClick={() => setShowAddTaskModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="hr-proj-btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? 'Adding...' : 'Create Task'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Delete Confirmation */}
        {deleteModalProject && (
          <div className="hr-proj-modal-overlay">
            <div className="hr-proj-modal" style={{ maxWidth: 460 }}>
              <div className="hr-proj-modal-header">
                <h3 style={{ color: '#dc2626' }}>Delete Project</h3>
                <button
                  type="button"
                  className="hr-proj-modal-close"
                  onClick={() => setDeleteModalProject(null)}
                >
                  &times;
                </button>
              </div>

              <div className="hr-proj-modal-body">
                <p style={{ margin: 0, color: '#334155', fontSize: '0.9rem' }}>
                  Are you sure you want to delete project <strong>&quot;{deleteModalProject.name}&quot;</strong>?
                </p>
                <p style={{ margin: '0.5rem 0 0 0', color: '#64748b', fontSize: '0.8rem' }}>
                  This project will be permanently removed from MongoDB. Associated task records will remain intact.
                </p>
              </div>

              <div className="hr-proj-modal-footer">
                <button
                  type="button"
                  className="hr-proj-btn-outline"
                  onClick={() => setDeleteModalProject(null)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="hr-proj-btn-primary"
                  style={{ background: '#dc2626', borderColor: '#dc2626' }}
                  onClick={handleDeleteProject}
                  disabled={submitting}
                >
                  {submitting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
}
