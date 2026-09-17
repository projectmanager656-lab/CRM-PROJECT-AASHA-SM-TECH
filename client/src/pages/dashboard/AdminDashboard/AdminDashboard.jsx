import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../../context/AppContext';
import apiClient from '../../../services/apiClient';
import AdminLayout from './components/AdminLayout';
import './Dashboard.css';

/* ─── helpers ──────────────────────────────────────────────────────────── */
const list = (r) => r?.data?.data || [];
const formatDate = (val) =>
  val
    ? new Date(val).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

const formatINR = (val) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val || 0);

/* ─── 3-Slice Attendance Donut Chart ─────────────────────────────────────── */
function AttendanceDonut({ present, onLeave, absent, total, hasRecords }) {
  const R = 40;
  const C = 2 * Math.PI * R;

  const validTotal = total > 0 ? total : 1;
  const pPct = hasRecords ? (present / validTotal) * 100 : 0;
  const lPct = hasRecords ? (onLeave / validTotal) * 100 : 0;
  const aPct = hasRecords ? (absent / validTotal) * 100 : 0;

  const slices = [
    { color: '#10B981', pct: pPct }, // Present (Green)
    { color: '#F59E0B', pct: lPct }, // On Leave (Amber)
    { color: '#EF4444', pct: aPct }, // Absent (Red)
  ];

  let offset = 0;
  const arcs = slices
    .filter((s) => s.pct > 0)
    .map((s) => {
      const dash = (s.pct / 100) * C;
      const arc = { ...s, dash, gap: C - dash, offset };
      offset += dash;
      return arc;
    });

  return (
    <svg viewBox="0 0 100 100" className="admin-donut-svg">
      <circle cx="50" cy="50" r={R} fill="none" stroke="#f1f5f9" strokeWidth="14" />
      {hasRecords &&
        arcs.map((arc, i) => (
          <circle
            key={i}
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={arc.color}
            strokeWidth="14"
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={-arc.offset}
            strokeLinecap="round"
          />
        ))}
    </svg>
  );
}

export default function AdminDashboard() {
  const { user } = useContext(AppContext);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [d, setD] = useState({
    leads: [],
    projects: [],
    tasks: [],
    invoices: [],
    attendance: [],
    leaves: [],
    departments: [],
    users: [],
  });

  useEffect(() => {
    let on = true;
    Promise.all([
      apiClient.get('/leads').catch(() => ({ data: { data: [] } })),
      apiClient.get('/projects').catch(() => ({ data: { data: [] } })),
      apiClient.get('/tasks').catch(() => ({ data: { data: [] } })),
      apiClient.get('/invoices').catch(() => ({ data: { data: [] } })),
      apiClient.get('/attendance').catch(() => ({ data: { data: [] } })),
      apiClient.get('/leave-requests').catch(() => ({ data: { data: [] } })),
      apiClient.get('/admin/departments').catch(() => apiClient.get('/departments')).catch(() => ({ data: { data: [] } })),
      apiClient.get('/users').catch(() => ({ data: { data: [] } })),
    ])
      .then((res) => {
        if (!on) return;
        setD({
          leads: list(res[0]),
          projects: list(res[1]),
          tasks: list(res[2]),
          invoices: list(res[3]),
          attendance: list(res[4]),
          leaves: list(res[5]),
          departments: list(res[6]),
          users: list(res[7]),
        });
      })
      .catch((e) => {
        if (on) setError(e.response?.data?.message || 'Unable to load dashboard data.');
      })
      .finally(() => {
        if (on) setLoading(false);
      });

    return () => {
      on = false;
    };
  }, []);

  /* ─── Real Dynamic Calculations ─── */
  // 1. Total Employees
  const totalEmployeesCount = useMemo(() => {
    const employees = (d.users || []).filter(
      (u) => u.role === 'employee' && u.isActive !== false && u.employmentStatus !== 'Exited' && u.employmentStatus !== 'Terminated'
    );
    return employees.length || (d.users || []).filter((u) => u.role === 'employee').length || (d.users || []).length;
  }, [d.users]);

  // 2. Total Departments
  const totalDepartmentsCount = useMemo(() => {
    return (d.departments || []).length;
  }, [d.departments]);

  // 3. Attendance Counts
  const presentCount = useMemo(() => {
    return d.attendance.filter(
      (a) => a.status === 'Present' || a.status === 'Late' || a.status === 'Half Day'
    ).length;
  }, [d.attendance]);

  const onLeaveCount = useMemo(() => {
    return d.leaves.filter((l) => l.status === 'Approved').length;
  }, [d.leaves]);

  const absentCount = useMemo(() => {
    return d.attendance.filter((a) => a.status === 'Absent').length;
  }, [d.attendance]);

  const hasAttendanceRecords = d.attendance.length > 0 || onLeaveCount > 0;

  const validTotalEmployees = totalEmployeesCount > 0 ? totalEmployeesCount : 1;
  const presentPct = hasAttendanceRecords
    ? ((presentCount / validTotalEmployees) * 100).toFixed(2)
    : '0.00';
  const onLeavePct = hasAttendanceRecords
    ? ((onLeaveCount / validTotalEmployees) * 100).toFixed(2)
    : '0.00';
  const absentPct = hasAttendanceRecords
    ? ((absentCount / validTotalEmployees) * 100).toFixed(2)
    : '0.00';

  // 4. Projects Counts
  const activeProjectsCount = useMemo(() => {
    return d.projects.filter((p) => p.status === 'In Progress' || p.status === 'Active').length;
  }, [d.projects]);

  const projectStatusCounts = useMemo(() => {
    return {
      inProgress: d.projects.filter((p) => p.status === 'In Progress' || p.status === 'Active').length,
      completed: d.projects.filter((p) => p.status === 'Completed').length,
      onHold: d.projects.filter((p) => p.status === 'On Hold').length,
      cancelled: d.projects.filter((p) => p.status === 'Cancelled').length,
    };
  }, [d.projects]);

  // 5. Tasks Counts
  const pendingTasksCount = useMemo(() => {
    return d.tasks.filter((t) => t.status !== 'Completed').length;
  }, [d.tasks]);

  // 6. Leads Counts
  const activeLeadsCount = useMemo(() => {
    return d.leads.filter((l) => l.status !== 'Converted' && l.status !== 'Lost').length;
  }, [d.leads]);

  // 7. Invoices & Revenue
  const totalInvoiced = useMemo(() => {
    return d.invoices.reduce((sum, inv) => sum + (Number(inv.amount || inv.total) || 0), 0);
  }, [d.invoices]);

  const totalPaid = useMemo(() => {
    return d.invoices
      .filter((inv) => inv.status === 'Paid')
      .reduce((sum, inv) => sum + (Number(inv.amount || inv.total) || 0), 0);
  }, [d.invoices]);

  const totalPendingInvoiced = Math.max(0, totalInvoiced - totalPaid);



  return (
    <AdminLayout pageTitle="Admin Dashboard">
      <div className="admin-dash-container">
        {error && <div className="admin-resource-message error">{error}</div>}

        {/* ── Page Header matching HR Reference ── */}
        <div className="admin-dash-header">
          <div className="admin-dash-title-area">
            <h2>Admin Overview &amp; Analytics</h2>
            <p>Real-time organizational metrics, project delivery, sales pipeline, and resource tracking.</p>
          </div>
        </div>

        {loading ? (
          <div className="admin-dashboard-loading">Loading organizational metrics…</div>
        ) : (
          <>
            {/* ══════════════════════════════════════════════════════════
                5 KPI STAT CARDS ROW (Exact HR Dashboard proportions)
            ══════════════════════════════════════════════════════════ */}
            <div className="admin-kpi-grid">
              {/* 1. Total Employees (Blue) */}
              <div className="admin-kpi-card blue" onClick={() => navigate('/admin/employees')}>
                <div className="admin-kpi-icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div className="admin-kpi-body">
                  <span className="admin-kpi-title">TOTAL EMPLOYEES</span>
                  <strong className="admin-kpi-value">{totalEmployeesCount}</strong>
                </div>
              </div>

              {/* 2. Total Departments (Green) */}
              <div className="admin-kpi-card green" onClick={() => navigate('/admin/departments')}>
                <div className="admin-kpi-icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                  </svg>
                </div>
                <div className="admin-kpi-body">
                  <span className="admin-kpi-title">TOTAL DEPARTMENTS</span>
                  <strong className="admin-kpi-value">{totalDepartmentsCount}</strong>
                </div>
              </div>

              {/* 3. Active Projects (Amber) */}
              <div className="admin-kpi-card amber" onClick={() => navigate('/admin/projects')}>
                <div className="admin-kpi-icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className="admin-kpi-body">
                  <span className="admin-kpi-title">ACTIVE PROJECTS</span>
                  <strong className="admin-kpi-value">{activeProjectsCount}</strong>
                </div>
              </div>

              {/* 4. Pending Tasks (Purple) */}
              <div className="admin-kpi-card purple" onClick={() => navigate('/admin/tasks')}>
                <div className="admin-kpi-icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </div>
                <div className="admin-kpi-body">
                  <span className="admin-kpi-title">PENDING TASKS</span>
                  <strong className="admin-kpi-value">{pendingTasksCount}</strong>
                </div>
              </div>

              {/* 5. Active Leads (Red/Rose) */}
              <div className="admin-kpi-card red" onClick={() => navigate('/admin/leads')}>
                <div className="admin-kpi-icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20V10" />
                    <path d="M18 20V4" />
                    <path d="M6 20v-4" />
                  </svg>
                </div>
                <div className="admin-kpi-body">
                  <span className="admin-kpi-title">ACTIVE LEADS</span>
                  <strong className="admin-kpi-value">{activeLeadsCount}</strong>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                ROW 1: Attendance Overview (Donut) + Task Management (List)
            ══════════════════════════════════════════════════════════ */}
            <div className="admin-grid-row-2">
              {/* Attendance Overview Card */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3>Attendance Overview</h3>
                  <button
                    type="button"
                    className="admin-card-action-link"
                    onClick={() => navigate('/admin/attendance')}
                  >
                    View Details
                  </button>
                </div>

                <div className="admin-donut-wrapper">
                  <div className="admin-donut-box">
                    <AttendanceDonut
                      present={presentCount}
                      onLeave={onLeaveCount}
                      absent={absentCount}
                      total={totalEmployeesCount}
                      hasRecords={hasAttendanceRecords}
                    />
                    <div className="admin-donut-center-info">
                      <strong>{totalEmployeesCount}</strong>
                      <span>Total</span>
                    </div>
                  </div>

                  <ul className="admin-donut-legend-list">
                    <li className="admin-donut-legend-item">
                      <div className="admin-donut-legend-left">
                        <span className="admin-legend-dot" style={{ background: '#10B981' }} />
                        <span>Present ({presentCount})</span>
                      </div>
                      <span className="admin-donut-legend-right">{presentPct}%</span>
                    </li>

                    <li className="admin-donut-legend-item">
                      <div className="admin-donut-legend-left">
                        <span className="admin-legend-dot" style={{ background: '#F59E0B' }} />
                        <span>On Leave ({onLeaveCount})</span>
                      </div>
                      <span className="admin-donut-legend-right">{onLeavePct}%</span>
                    </li>

                    <li className="admin-donut-legend-item">
                      <div className="admin-donut-legend-left">
                        <span className="admin-legend-dot" style={{ background: '#EF4444' }} />
                        <span>Absent ({absentCount})</span>
                      </div>
                      <span className="admin-donut-legend-right">{absentPct}%</span>
                    </li>
                  </ul>
                </div>

                {!hasAttendanceRecords && (
                  <div className="admin-empty-indicator">No attendance records for today</div>
                )}
              </div>

              {/* Task Management Card */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3>Task Management &amp; Allocation</h3>
                  <button
                    type="button"
                    className="admin-card-action-link"
                    onClick={() => navigate('/admin/tasks')}
                  >
                    View All
                  </button>
                </div>

                {d.tasks.length === 0 ? (
                  <div className="admin-empty-card">No tasks allocated yet.</div>
                ) : (
                  <ul className="admin-task-list">
                    {d.tasks.slice(0, 4).map((task) => {
                      const prioClass = String(task.priority || 'medium').toLowerCase();
                      return (
                        <li key={task._id} className="admin-task-item">
                          <div className="admin-task-left">
                            <div className="admin-task-avatar">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="9 11 12 14 22 4" />
                                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                              </svg>
                            </div>
                            <div>
                              <span className="admin-task-name">{task.title}</span>
                              <span className="admin-task-sub">
                                {task.project?.name || task.description || 'Task Assignment'}
                              </span>
                            </div>
                          </div>

                          <div className="admin-task-right">
                            <span className="admin-task-date">{formatDate(task.dueDate)}</span>
                            <span className={`admin-pill ${prioClass}`}>
                              {task.priority || 'Medium'}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                ROW 2: Financial Summary + Projects Status
            ══════════════════════════════════════════════════════════ */}
            <div className="admin-grid-row-2">
              {/* Financial & Revenue Summary */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3>Financial Summary</h3>
                  <button
                    type="button"
                    className="admin-card-action-link"
                    onClick={() => navigate('/admin/invoices')}
                  >
                    View Invoices
                  </button>
                </div>

                <div className="admin-payroll-summary-content">
                  <span className="admin-payroll-cost-label">Total Invoiced Value</span>
                  <div className="admin-payroll-cost-value">{formatINR(totalInvoiced)}</div>

                  <div className="admin-payroll-meta-grid">
                    <div className="admin-payroll-meta-col">
                      <span>Paid Revenue</span>
                      <strong style={{ color: '#059669' }}>{formatINR(totalPaid)}</strong>
                    </div>
                    <div className="admin-payroll-meta-col">
                      <span>Pending Due</span>
                      <strong style={{ color: '#d97706' }}>{formatINR(totalPendingInvoiced)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Projects Status & Distribution */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3>Projects Status</h3>
                  <button
                    type="button"
                    className="admin-card-action-link"
                    onClick={() => navigate('/admin/projects')}
                  >
                    View Report
                  </button>
                </div>

                <div className="admin-project-dist-container">
                  <div className="admin-dist-row">
                    <div className="admin-dist-label">
                      <span>In Progress</span>
                      <strong>{projectStatusCounts.inProgress}</strong>
                    </div>
                    <div className="admin-dist-bar-track">
                      <div
                        className="admin-dist-bar-fill blue"
                        style={{
                          width: `${d.projects.length ? (projectStatusCounts.inProgress / d.projects.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="admin-dist-row">
                    <div className="admin-dist-label">
                      <span>Completed</span>
                      <strong>{projectStatusCounts.completed}</strong>
                    </div>
                    <div className="admin-dist-bar-track">
                      <div
                        className="admin-dist-bar-fill green"
                        style={{
                          width: `${d.projects.length ? (projectStatusCounts.completed / d.projects.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="admin-dist-row">
                    <div className="admin-dist-label">
                      <span>On Hold</span>
                      <strong>{projectStatusCounts.onHold}</strong>
                    </div>
                    <div className="admin-dist-bar-track">
                      <div
                        className="admin-dist-bar-fill amber"
                        style={{
                          width: `${d.projects.length ? (projectStatusCounts.onHold / d.projects.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="admin-dist-row">
                    <div className="admin-dist-label">
                      <span>Cancelled</span>
                      <strong>{projectStatusCounts.cancelled}</strong>
                    </div>
                    <div className="admin-dist-bar-track">
                      <div
                        className="admin-dist-bar-fill red"
                        style={{
                          width: `${d.projects.length ? (projectStatusCounts.cancelled / d.projects.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
