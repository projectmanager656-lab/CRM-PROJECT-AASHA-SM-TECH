import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../../context/AppContext';
import apiClient from '../../../services/apiClient';
import AdminLayout from './components/AdminLayout';
import './Dashboard.css';

const list = r => r.data.data || [];
const name = p => p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.email : '—';
const date = x => x ? new Date(x).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/* ─── tiny SVG icons for feature cards ──────────────────────────────────── */
const FEAT_ICONS = {
  tasks: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  board: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  gantt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  timeline: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  time: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  budget: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  team: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  report: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  leads: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
    </svg>
  )
};

/* ─── 8 feature card definitions ────────── */
const ADMIN_FEATURE_CARDS = [
  {
    id: 'task-management',
    icon: 'tasks',
    title: 'Task Management',
    desc: 'Organization tasks',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.10)',
    path: '/admin/tasks',
  },
  {
    id: 'project-management',
    icon: 'gantt',
    title: 'Project Management',
    desc: 'Organization projects',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.10)',
    path: '/admin/projects',
  },
  {
    id: 'team-status',
    icon: 'team',
    title: 'Team Status',
    desc: 'Managed employees',
    color: '#EC4899',
    bg: 'rgba(236,72,153,0.10)',
    path: '/admin/employees', // The existing Employees component
  },
  {
    id: 'time-attendance',
    icon: 'time',
    title: 'Time & Attendance',
    desc: 'Employee working time',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.10)',
    path: '/admin/attendance',
  },
  {
    id: 'leads-clients',
    icon: 'leads',
    title: 'Leads & Clients',
    desc: 'CRM management',
    color: '#7C3AED',
    bg: 'rgba(124,58,237,0.10)',
    path: '/admin/leads',
  },
  {
    id: 'budget-actuals',
    icon: 'budget',
    title: 'Budget & Actuals',
    desc: 'Invoices & financials',
    color: '#059669',
    bg: 'rgba(5,150,105,0.10)',
    path: '/admin/invoices',
  },
  {
    id: 'reports-analytics',
    icon: 'report',
    title: 'Reports & Analytics',
    desc: 'Organization reporting',
    color: '#0284C7',
    bg: 'rgba(2,132,199,0.10)',
    path: '/admin/reports',
  },
  {
    id: 'daily-reports',
    icon: 'board',
    title: 'Daily Reports',
    desc: 'Employee daily reports',
    color: '#DC2626',
    bg: 'rgba(220,38,38,0.10)',
    path: '/admin/reports',
  }
];

const ActionIcons = {
  'Add Lead': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>,
  'New Project': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,
  'Add Employee': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>,
  'Create Invoice': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>,
  'Attendance': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  'Tasks': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  'Reports': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  'Send Email': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
};

export default function AdminDashboard() {
  const { user } = useContext(AppContext);
  const navigate = useNavigate();
  const [d, setD] = useState({ leads: [], projects: [], tasks: [], invoices: [], attendance: [], leaves: [], announcements: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let on = true;
    Promise.all([
      '/leads',
      '/projects',
      '/tasks',
      '/invoices',
      '/attendance',
      '/leave-requests',
      '/announcements?limit=4'
    ].map(x => apiClient.get(x)))
      .then(r => on && setD({
        leads: list(r[0]),
        projects: list(r[1]),
        tasks: list(r[2]),
        invoices: list(r[3]),
        attendance: list(r[4]),
        leaves: list(r[5]),
        announcements: list(r[6])
      }))
      .catch(e => on && setError(e.response?.data?.message || 'Unable to load dashboard data.'))
      .finally(() => on && setLoading(false));
    return () => { on = false };
  }, []);

  const pipeline = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'].map((x, i) => ({
    label: x === 'Converted' ? 'Converted / Won' : x,
    count: d.leads.filter(y => y.status === x).length,
    color: ['#4f46e5', '#2563eb', '#14b8a6', '#f59e0b', '#ef4444'][i]
  }));

  const project = [
    ['Active', 'In Progress', '#2563eb'],
    ['Completed', 'Completed', '#16a34a'],
    ['On Hold', 'On Hold', '#f59e0b'],
    ['Cancelled', 'Cancelled', '#ef4444']
  ].map(([s, label, color]) => ({
    label,
    count: d.projects.filter(x => x.status === s).length,
    color
  }));

  const attend = ['Present', 'Absent', 'Half Day'].map((label, i) => ({
    label,
    count: d.attendance.filter(x => x.status === label).length,
    color: ['#16a34a', '#ef4444', '#f59e0b'][i]
  }));

  const donut = items => {
    const t = items.reduce((a, x) => a + x.count, 0);
    let n = 0;
    return {
      t, style: {
        background: t ? `conic-gradient(${items.map(x => { let a = n; n += x.count / t * 100; return `${x.color} ${a}% ${n}%` }).join(',')})` : '#e5e7eb'
      }
    };
  };
  const pd = donut(project), ad = donut(attend), pct = ad.t ? Math.round(attend[0].count / ad.t * 100) : 0;

  const revenue = useMemo(() => {
    const xs = Array.from({ length: 7 }, (_, i) => {
      const q = new Date();
      q.setDate(q.getDate() - 6 + i);
      const k = q.toISOString().slice(0, 10);
      return {
        l: q.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }),
        v: d.invoices.filter(x => String(x.issueDate || '').slice(0, 10) === k).reduce((a, x) => a + Number(x.amount || 0), 0)
      }
    });
    return { xs, max: Math.max(...xs.map(x => x.v), 1) }
  }, [d.invoices]);

  const Card = ({ title, to, children }) => (
    <article className="dashboard-card">
      <div className="card-heading">
        <h3>{title}</h3>
        {to && <button onClick={() => navigate(to)}>View All</button>}
      </div>
      {children}
    </article>
  );

  const Legend = ({ items, total }) => (
    <div className="legend-list">
      {items.map(x => (
        <div key={x.label}>
          <span><i style={{ background: x.color }} />{x.label}</span>
          <b>{x.count}{total !== undefined && ` (${total ? Math.round(x.count / total * 100) : 0}%)`}</b>
        </div>
      ))}
    </div>
  );

  const fullName = user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.firstName || user?.email || 'Admin';

  return (
    <AdminLayout pageTitle="">
      <div className="admin-dashboard-page reference-dashboard">
        {error && <div className="admin-resource-message error">{error}</div>}
        {loading ? <div className="dashboard-loading">Loading dashboard data…</div> : <>

          {/* ══════════════════════════════════════════════════════════
              NEW CONTENT — 8 Admin Main Feature Cards
          ══════════════════════════════════════════════════════════ */}
          <section className="ud-features-section">
            <h3 className="ud-section-title">Main Features</h3>
            <div className="ud-features-grid">
              {ADMIN_FEATURE_CARDS.map((card) => {
                let dynamicDesc = card.desc;
                let dynamicTitle = card.title;

                // Real data injection for specific cards based on API results
                if (card.id === 'task-management' && d.tasks) {
                  const completed = d.tasks.filter(t => t.status === 'Completed').length;
                  dynamicDesc = `${completed}/${d.tasks.length} Completed`;
                }
                if (card.id === 'project-management' && d.projects) {
                  const active = d.projects.filter(p => p.status === 'In Progress').length;
                  dynamicDesc = `${active} Active Projects`;
                }
                if (card.id === 'leads-clients' && d.leads) {
                  dynamicDesc = `${d.leads.length} Active Leads`;
                }
                if (card.id === 'time-attendance' && d.attendance) {
                  const present = d.attendance.filter(a => a.status === 'Present').length;
                  dynamicDesc = `${present} Present Today`;
                }
                if (card.id === 'budget-actuals' && d.invoices) {
                  dynamicDesc = `${d.invoices.length} Invoices`;
                }

                return (
                  <button key={card.id} type="button" className="ud-feature-card" onClick={() => navigate(card.path)} aria-label={dynamicTitle}>
                    <div className="ud-feature-icon" style={{ background: card.bg, color: card.color }}>
                      {FEAT_ICONS[card.icon]}
                    </div>
                    <div className="ud-feature-body">
                      <strong className="ud-feature-title">{dynamicTitle}</strong>
                      <span className="ud-feature-desc">{dynamicDesc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="dashboard-grid top-row">
            <Card title="Sales Pipeline">
              <div className="pipeline-content">
                {d.leads.length ? <>
                  <div className="funnel">
                    {pipeline.map((x, i) => <span key={x.label} style={{ width: `${100 - i * 14}%`, background: x.color }} />)}
                  </div>
                  <Legend items={pipeline} total={d.leads.length} />
                </> : <div className="empty-card">No lead data available.</div>}
              </div>
            </Card>
            <Card title="Projects Overview">
              <div className="donut-content">
                <div className="donut" style={pd.style}>
                  <div><b>{pd.t}</b><small>Total Projects</small></div>
                </div>
                <Legend items={project} total={pd.t} />
              </div>
            </Card>
            <Card title="Revenue Overview">
              <div className="revenue-chart">
                {revenue.xs.some(x => x.v) ? revenue.xs.map(x => (
                  <div className="revenue-point" key={x.l}>
                    <span title={`₹${x.v}`} style={{ height: `${Math.max(8, x.v / revenue.max * 100)}%` }} />
                    <small>{x.l}</small>
                  </div>
                )) : <div className="empty-card">No invoice revenue available.</div>}
              </div>
            </Card>
          </section>
          <section className="dashboard-grid middle-row">
            <Card title="My Tasks" to="/admin/tasks">
              <div className="task-list">
                {d.tasks.slice(0, 5).map(x => (
                  <div key={x._id}>
                    <i className={`task-check ${x.status === 'Completed' ? 'done' : ''}`} />
                    <span><b>{x.title}</b><small>{x.description || 'No description'}</small></span>
                    <em>{date(x.dueDate)}</em>
                    <strong className={`priority ${String(x.priority).toLowerCase()}`}>{x.priority}</strong>
                  </div>
                ))}
                {!d.tasks.length && <div className="empty-card">No tasks available.</div>}
              </div>
            </Card>
            <Card title="Recent Projects" to="/admin/projects">
              <div className="mini-table">
                {d.projects.slice(0, 5).map(x => (
                  <div key={x._id}>
                    <b>{x.name}</b><span>—</span><span>{name(x.owner)}</span><em>{x.status}</em><i>—</i>
                  </div>
                ))}
                {!d.projects.length && <div className="empty-card">No projects available.</div>}
              </div>
            </Card>
            <Card title="Announcements" to="/admin/announcements">
              <div className="announcement-list">
                {d.announcements.map(x => (
                  <div key={x._id}>
                    <i className="announcement-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg></i>
                    <span><b>{x.title}</b><small>{x.message}</small></span>
                    <em>{date(x.createdAt)}</em>
                  </div>
                ))}
                {!d.announcements.length && <div className="empty-card">No announcements yet.</div>}
              </div>
              <button className="create-announcement" onClick={() => navigate('/admin/announcements')}>＋ Create Announcement</button>
            </Card>
          </section>
          <section className="dashboard-grid bottom-row">
            <Card title="Attendance Overview" to="/admin/attendance">
              <div className="donut-content">
                <div className="donut attendance" style={ad.style}>
                  <div><b>{pct}%</b><small>Present</small></div>
                </div>
                <Legend items={attend} />
              </div>
            </Card>
            <Card title="Leave Requests" to="/admin/leave-requests">
              <div className="leave-list">
                {d.leaves.slice(0, 5).map(x => (
                  <div key={x._id}>
                    <b>{name(x.user)}</b><span>{x.type}</span><span>{date(x.startDate)} – {date(x.endDate)}</span><em className={String(x.status).toLowerCase()}>{x.status}</em>
                  </div>
                ))}
                {!d.leaves.length && <div className="empty-card">No leave requests.</div>}
              </div>
            </Card>
            <Card title="Quick Actions">
              <div className="quick-actions">
                {
                  [
                    ['Add Lead', '/admin/leads'],
                    ['New Project', '/admin/projects'],
                    ['Add Employee', '/admin/employees'],
                    ['Create Invoice', '/admin/payroll'],
                    ['Attendance', '/admin/attendance'],
                    ['Tasks', '/admin/tasks'],
                    ['Reports', '/admin/reports'],
                    ['Send Email', '/admin/notifications']
                  ].map(x => (
                    <button key={x[0]} onClick={() => navigate(x[1])}>
                      <i>{ActionIcons[x[0]]}</i><span>{x[0]}</span>
                    </button>
                  ))
                }
              </div>
            </Card>
          </section>
        </>}
      </div>
    </AdminLayout>
  );
}
