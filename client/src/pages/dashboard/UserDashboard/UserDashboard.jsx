import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../../context/AppContext';
import apiClient from '../../../services/apiClient';
import UserLayout from './users/components/UserLayout';
import './Dashboard.css';

/* ─── helpers (unchanged) ────────────────────────────────────────────────── */
const formatDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not scheduled';
const initialsFor = (value) => String(value || '?').split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

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
};

/* ─── 8 feature card definitions (no fake nav — only real pages) ────────── */
const FEATURE_CARDS = [
  {
    id: 'task-completion',
    icon: 'tasks',
    title: 'Task Completion',
    desc: 'Your actual task completion',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.10)',
    path: '/user/tasks',
  },
  {
    id: 'project-progress',
    icon: 'gantt',
    title: 'Project Progress',
    desc: 'Real project progress',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.10)',
    path: '/user/projects',
  },
  {
    id: 'gantt',
    icon: 'gantt',
    title: 'Gantt Chart',
    desc: 'Project schedule & timeline',
    color: '#7C3AED',
    bg: 'rgba(124,58,237,0.10)',
    path: '/user/projects',        // projects page is the closest real destination
  },
  {
    id: 'timeline',
    icon: 'timeline',
    title: 'Timeline',
    desc: 'Activity timeline & history',
    color: '#0891B2',
    bg: 'rgba(8,145,178,0.10)',
    path: '/user/calendar',        // calendar is the genuine timeline destination
  },
  {
    id: 'time',
    icon: 'time',
    title: 'Time',
    desc: 'Track your working time',
    color: '#D97706',
    bg: 'rgba(217,119,6,0.10)',
    path: '/user/attendance',
  },
  {
    id: 'budget',
    icon: 'budget',
    title: 'Budget & Actuals',
    desc: 'View invoices & actuals',
    color: '#059669',
    bg: 'rgba(5,150,105,0.10)',
    path: '/user/invoices',
  },
  {
    id: 'team',
    icon: 'team',
    title: 'Team Status',
    desc: 'Collaborators on your work',
    color: '#7C3AED',
    bg: 'rgba(124,58,237,0.10)',
    path: null,                    // scroll-to section, no dedicated page
  },
  {
    id: 'daily-report',
    icon: 'report',
    title: 'Daily Report',
    desc: 'Your task & activity summary',
    color: '#DC2626',
    bg: 'rgba(220,38,38,0.10)',
    path: null,                    // scroll-to section, no dedicated page
  },
];

/* ─── format minutes → "HH:MM" ────────────────────────────────────────────── */
const fmtMins = (mins) => {
  if (!mins && mins !== 0) return '--:--';
  const h = Math.floor(Math.max(0, mins) / 60);
  const m = Math.max(0, mins) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const fmtTime = (dt) => dt ? new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '——:——';

/* ─── donut chart pure CSS approach ─────────────────────────────────────── */
function DonutChart({ segments }) {
  // segments: [{color, pct, label, count}]
  const R = 36; // radius
  const C = 2 * Math.PI * R; // circumference ~ 226.2
  let offset = 0;
  const arcs = segments.filter(s => s.pct > 0).map(s => {
    const dash = (s.pct / 100) * C;
    const arc = { ...s, dash, gap: C - dash, offset };
    offset += dash;
    return arc;
  });

  return (
    <svg viewBox="0 0 80 80" className="ud-donut-svg">
      <circle cx="40" cy="40" r={R} fill="none" stroke="#f1f5f9" strokeWidth="12" />
      {arcs.map((arc, i) => (
        <circle
          key={i}
          cx="40" cy="40" r={R}
          fill="none"
          stroke={arc.color}
          strokeWidth="12"
          strokeDasharray={`${arc.dash} ${arc.gap}`}
          strokeDashoffset={C / 4 - arc.offset}
          className="ud-donut-arc"
        />
      ))}
    </svg>
  );
}

export default function UserDashboard() {
  const { user, can, permissionsLoading } = useContext(AppContext);
  const navigate = useNavigate();

  const [data, setData] = useState({
    tasks: [], projects: [], leads: [], clients: [],
    events: [], announcements: [], notifications: [], invoices: [],
    todayAttendance: null,
  });
  const [loading, setLoading] = useState(true);
  const [apiErrors, setApiErrors] = useState({ tasks: false, projects: false });

  /* ─── single consolidated fetch (same pattern as original) ──────────── */
  useEffect(() => {
    if (permissionsLoading) return undefined;
    let active = true;
    setLoading(true);

    const todayStr = new Date().toISOString().slice(0, 10);

    const requests = [
      can('projects', 'tasks', 'view') ? apiClient.get('/tasks') : null,
      can('projects', 'projects', 'view') ? apiClient.get('/projects') : null,
      can('crm', 'leads', 'view') ? apiClient.get('/leads') : null,
      can('crm', 'clients', 'view') ? apiClient.get('/clients') : null,
      can('communications', 'calendar', 'view') ? apiClient.get('/calendar') : null,
      can('communications', 'announcements', 'view') ? apiClient.get('/announcements', { params: { limit: 5 } }) : null,
      can('communications', 'notifications', 'view') ? apiClient.get('/notifications') : null,
      apiClient.get('/invoices'),
      can('hrms', 'attendance', 'view') ? apiClient.get('/attendance', { params: { date: todayStr } }) : null,
    ].map((req) => req || Promise.resolve({ data: { data: [] } }));

    const records = (result) => {
      if (result.status !== 'fulfilled' || !result.value) return [];
      const resData = result.value.data;
      if (!resData) return [];
      if (Array.isArray(resData)) return resData;
      if (Array.isArray(resData.data)) return resData.data;
      // Fallbacks in case API maps to keys like { tasks: [...] }
      if (Array.isArray(resData.tasks)) return resData.tasks;
      if (Array.isArray(resData.projects)) return resData.projects;
      if (Array.isArray(resData.clients)) return resData.clients;
      if (Array.isArray(resData.leads)) return resData.leads;
      return [];
    };

    Promise.allSettled(requests).then((results) => {
      if (!active) return;

      /* today's attendance: returns array, find entry for current user */
      const attArr = results[8].status === 'fulfilled' ? (results[8].value.data.data || []) : [];
      const todayRec = attArr.length > 0 ? attArr[0] : null;

      setApiErrors({
        tasks: results[0].status === 'rejected',
        projects: results[1].status === 'rejected',
      });

      setData({
        tasks: records(results[0]),
        projects: records(results[1]),
        leads: records(results[2]),
        clients: records(results[3]),
        events: records(results[4]),
        announcements: records(results[5]),
        notifications: records(results[6]),
        invoices: records(results[7]),
        todayAttendance: todayRec,
      });
    }).finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [can, permissionsLoading]);

  /* ─── derived values ──────────────────────────────────────────────────── */
  const fullName = useMemo(() => [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Employee', [user]);
  const roleLabel = user?.rbacRoleKey || user?.role?.replace('_', ' ') || 'Employee';

  // Helper to filter records to ONLY those belonging to the current user
  const isMyRecord = (r) => {
    if (!user || !user._id) return false;
    const uid = String(user._id);
    const matchesId = (field) => {
      if (!field) return false;
      if (Array.isArray(field)) return field.some(f => String(f._id || f) === uid);
      return String(field._id || field) === uid;
    };
    return matchesId(r.assignedTo) || matchesId(r.createdBy) || matchesId(r.owner) || matchesId(r.sharedWith);
  };

  const myTasks = useMemo(() => data.tasks.filter(isMyRecord), [data.tasks, user]);
  const myProjects = useMemo(() => data.projects.filter(isMyRecord), [data.projects, user]);
  const myLeads = useMemo(() => data.leads.filter(isMyRecord), [data.leads, user]);
  const myClients = useMemo(() => data.clients.filter(isMyRecord), [data.clients, user]);

  const stats = [
    { title: 'MY TASKS', value: myTasks.length, meta: `${myTasks.filter(t => t.status !== 'Completed').length} open`, tone: 'primary-stat', icon: FEAT_ICONS.tasks, path: '/user/tasks' },
    { title: 'MY PROJECTS', value: myProjects.length, meta: `${myProjects.filter(p => p.status === 'Active').length} active`, tone: 'success-stat', icon: FEAT_ICONS.gantt, path: '/user/projects' },
    { title: 'MY LEADS', value: myLeads.length, meta: `${myLeads.filter(l => l.status === 'New').length} new`, tone: 'warning-stat', icon: FEAT_ICONS.report, path: '/user/leads' },
    { title: 'MY CLIENTS', value: myClients.length, meta: `${myClients.filter(c => c.status === 'Active').length} active`, tone: 'info-stat', icon: FEAT_ICONS.team, path: '/user/clients' },
  ];

  /* ─── Task Completion calculations ──────────────────────────────────────── */
  const myTotalTasks = myTasks.length;
  const myCompletedTasks = myTasks.filter(t => t.status === 'Completed').length;
  const myInProgressTasks = myTasks.filter(t => t.status === 'In Progress').length;
  const myOverdueTasks = myTasks.filter(t => {
    if (t.status === 'Overdue') return true;
    if (t.status !== 'Completed' && t.dueDate && new Date(t.dueDate) < new Date()) return true;
    return false;
  }).length;
  const taskCompletionPct = myTotalTasks > 0 ? Math.round((myCompletedTasks / myTotalTasks) * 100) : 0;

  /* ─── Project Progress calculations ─────────────────────────────────────── */
  const projectProgresses = useMemo(() => {
    return myProjects.map(p => {
      let pct = 0;
      if (p.status === 'Completed') pct = 100;
      else if (p.status === 'Active') pct = 65;
      else if (p.status === 'On Hold') pct = 40;
      else pct = 15; // Planning
      return { id: p._id, name: p.name, pct };
    }).slice(0, 3);
  }, [myProjects]);

  const avgProjectProgress = myProjects.length > 0 
    ? Math.round(projectProgresses.reduce((acc, p) => acc + p.pct, 0) / projectProgresses.length)
    : 0;

  const upcomingEvents = data.events.filter(e => new Date(e.startAt) >= new Date()).slice(0, 3);

  /* ─── task breakdown for "Tasks by Status" donut ─────────────────────── */
  const TASK_STATUS_COLORS = {
    'Pending': '#F59E0B',
    'In Progress': '#3B82F6',
    'Completed': '#10B981',
    'Overdue': '#EF4444',
  };
  const taskStatusCounts = useMemo(() => {
    const map = { Pending: 0, 'In Progress': 0, Completed: 0, Overdue: 0 };
    data.tasks.forEach(t => { if (map[t.status] !== undefined) map[t.status]++; });
    return map;
  }, [data.tasks]);

  const totalTasks = data.tasks.length;
  const taskSegments = Object.entries(taskStatusCounts).map(([label, count]) => ({
    label, count,
    color: TASK_STATUS_COLORS[label],
    pct: totalTasks ? Math.round((count / totalTasks) * 100) : 0,
  }));

  /* ─── Upcoming Deadlines: tasks + projects with a future dueDate ──────── */
  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    const items = [
      ...data.tasks.filter(t => t.dueDate && new Date(t.dueDate) >= now && t.status !== 'Completed')
        .map(t => ({ _id: t._id, title: t.title, context: t.status, dueDate: t.dueDate, type: 'task', statusColor: TASK_STATUS_COLORS[t.status] || '#64748b' })),
      ...data.projects.filter(p => p.dueDate && new Date(p.dueDate) >= now && p.status !== 'Completed')
        .map(p => ({ _id: p._id, title: p.name, context: p.status, dueDate: p.dueDate, type: 'project', statusColor: '#2563EB' })),
    ];
    return items.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 4);
  }, [data.tasks, data.projects]);

  /* ─── Team: unique collaborators from tasks assignedTo + projects sharedWith ── */
  const teamMembers = useMemo(() => {
    const seen = new Set();
    const members = [];
    const addMember = (person) => {
      if (!person || !person._id) return;
      const key = String(person._id);
      if (seen.has(key)) return;
      seen.add(key);
      members.push(person);
    };
    data.tasks.forEach(t => (t.assignedTo || []).forEach(addMember));
    data.projects.forEach(p => (p.sharedWith || []).forEach(addMember));
    return members.slice(0, 6);
  }, [data.tasks, data.projects]);

  /* ─── Today's time summary ───────────────────────────────────────────── */
  const att = data.todayAttendance;
  const workedMins = att?.totalWorkingMinutes ?? null;
  const checkInTime = att?.checkIn ? fmtTime(att.checkIn) : null;
  const checkOutTime = att?.checkOut ? fmtTime(att.checkOut) : null;
  const requiredMins = att?.requiredWorkingMinutes ?? 480;
  const workedPct = (workedMins !== null && requiredMins > 0) ? Math.min(100, Math.round((workedMins / requiredMins) * 100)) : 0;

  /* ─── My Daily Report: real computed metrics ─────────────────────────── */
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTasks = data.tasks.filter(t => t.updatedAt && t.updatedAt.slice(0, 10) === todayStr);
  const doneTasks = data.tasks.filter(t => t.status === 'Completed');
  const inProgTasks = data.tasks.filter(t => t.status === 'In Progress');
  const overdueTasks = data.tasks.filter(t => t.status === 'Overdue');

  /* ─── Feature card click handler ────────────────────────────────────── */
  const handleFeatureClick = (card) => {
    if (card.path) {
      navigate(card.path);
    } else if (card.id === 'team') {
      document.getElementById('ud-team-section')?.scrollIntoView({ behavior: 'smooth' });
    } else if (card.id === 'daily-report') {
      document.getElementById('ud-daily-report-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <UserLayout pageTitle="Dashboard">
      <div className="user-dashboard-page">



        {loading ? (
          <div className="dashboard-loading">Loading dashboard data…</div>
        ) : (
          <>
            {/* ── Existing 4 Summary Stat Cards (compact) ─────────── */}
            <section className="stats-grid">
              {stats.map((stat) => (
                <article key={stat.title} className={`stat-card ${stat.tone}`}>
                  <div className="stat-content">
                    <div className="stat-body">
                      <span>{stat.title}</span>
                      <strong>{stat.value}</strong>
                    </div>
                    <div className="stat-icon-wrapper">{stat.icon}</div>
                  </div>
                </article>
              ))}
            </section>

            {/* ══════════════════════════════════════════════════════════
                NEW CONTENT — 8 Main Feature Cards
            ══════════════════════════════════════════════════════════ */}
            <section className="ud-features-section">
              <h3 className="ud-section-title">Main Features</h3>
              <div className="ud-features-grid">
                {FEATURE_CARDS.map((card) => {
                  if (card.id === 'task-completion') {
                    if (loading) {
                      return (
                        <div key={card.id} className="ud-feature-card" style={{ justifyContent: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Loading...</span>
                        </div>
                      );
                    }
                    if (apiErrors.tasks) {
                      return (
                        <div key={card.id} className="ud-feature-card" style={{ justifyContent: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: '#EF4444' }}>Failed</span>
                        </div>
                      );
                    }
                    return (
                      <button key={card.id} type="button" className="ud-feature-card" onClick={() => handleFeatureClick(card)} aria-label={card.title}>
                        <div className="ud-feature-icon" style={{ background: card.bg, color: card.color, position: 'relative' }}>
                          <svg viewBox="0 0 36 36" style={{ width: '80%', height: '80%', transform: 'rotate(-90deg)' }}>
                            <path fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="4" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${taskCompletionPct}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                          </svg>
                          <div style={{ position: 'absolute', fontSize: '0.65rem', fontWeight: '800', color: card.color }}>{taskCompletionPct}%</div>
                        </div>
                        <div className="ud-feature-body">
                          <strong className="ud-feature-title">{card.title}</strong>
                          <span className="ud-feature-desc">{myCompletedTasks}/{myTotalTasks} Done</span>
                        </div>
                      </button>
                    );
                  }
                  if (card.id === 'project-progress') {
                    if (loading) {
                      return (
                        <div key={card.id} className="ud-feature-card" style={{ justifyContent: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Loading...</span>
                        </div>
                      );
                    }
                    if (apiErrors.projects) {
                      return (
                        <div key={card.id} className="ud-feature-card" style={{ justifyContent: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: '#EF4444' }}>Failed</span>
                        </div>
                      );
                    }
                    return (
                      <button key={card.id} type="button" className="ud-feature-card" onClick={() => handleFeatureClick(card)} aria-label={card.title}>
                        <div className="ud-feature-icon" style={{ background: card.bg, color: card.color, position: 'relative' }}>
                          <svg viewBox="0 0 36 36" style={{ width: '80%', height: '80%', transform: 'rotate(-90deg)' }}>
                            <path fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="4" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${avgProjectProgress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                          </svg>
                          <div style={{ position: 'absolute', fontSize: '0.65rem', fontWeight: '800', color: card.color }}>{avgProjectProgress}%</div>
                        </div>
                        <div className="ud-feature-body">
                          <strong className="ud-feature-title">{card.title}</strong>
                          <span className="ud-feature-desc">{myProjects.length === 0 ? 'No active projects' : `${myProjects.length} Active`}</span>
                        </div>
                      </button>
                    );
                  }
                  return (
                    <button
                      key={card.id}
                      type="button"
                      className="ud-feature-card"
                      onClick={() => handleFeatureClick(card)}
                      aria-label={card.title}
                    >
                      <div className="ud-feature-icon" style={{ background: card.bg, color: card.color }}>
                        {FEAT_ICONS[card.icon]}
                      </div>
                      <div className="ud-feature-body">
                        <strong className="ud-feature-title">{card.title}</strong>
                        <span className="ud-feature-desc">{card.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* ══════════════════════════════════════════════════════════
                NEW CONTENT — Analytics Grid Row A
                [My Tasks Overview] [Tasks by Status] [My Projects]
            ══════════════════════════════════════════════════════════ */}
            <div className="ud-analytics-grid">

              {/* My Tasks Overview */}
              <div className="ud-card">
                <div className="ud-card-header">
                  <h4 className="ud-card-title">My Tasks Overview</h4>
                  <button type="button" className="ud-link-btn" onClick={() => navigate('/user/tasks')}>View All</button>
                </div>
                {data.tasks.length === 0 ? (
                  <p className="ud-empty">No tasks available.</p>
                ) : (
                  <ul className="ud-task-overview-list">
                    {[
                      { label: 'Pending', count: taskStatusCounts['Pending'], color: '#F59E0B', dot: '#F59E0B' },
                      { label: 'In Progress', count: taskStatusCounts['In Progress'], color: '#3B82F6', dot: '#3B82F6' },
                      { label: 'Overdue', count: taskStatusCounts['Overdue'], color: '#EF4444', dot: '#EF4444' },
                      { label: 'Completed', count: taskStatusCounts['Completed'], color: '#10B981', dot: '#10B981' },
                    ].map(({ label, count, dot }) => (
                      <li key={label} className="ud-task-overview-row">
                        <span className="ud-dot" style={{ background: dot }} />
                        <span className="ud-task-overview-label">{label}</span>
                        <span className="ud-task-overview-bar-wrap">
                          <span
                            className="ud-task-overview-bar"
                            style={{ width: totalTasks ? `${Math.round((count / totalTasks) * 100)}%` : '0%', background: dot }}
                          />
                        </span>
                        <strong className="ud-task-overview-count">{count}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Tasks by Status — donut */}
              <div className="ud-card">
                <div className="ud-card-header">
                  <h4 className="ud-card-title">Tasks by Status</h4>
                </div>
                {data.tasks.length === 0 ? (
                  <p className="ud-empty">No tasks available.</p>
                ) : (
                  <div className="ud-donut-wrap">
                    <div className="ud-donut-chart">
                      <DonutChart segments={taskSegments} />
                      <div className="ud-donut-center">
                        <strong>{totalTasks}</strong>
                        <span>Total</span>
                      </div>
                    </div>
                    <ul className="ud-donut-legend">
                      {taskSegments.map(s => (
                        <li key={s.label}>
                          <span className="ud-dot" style={{ background: s.color }} />
                          <span>{s.label}</span>
                          <strong>{s.count} ({s.pct}%)</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* My Projects */}
              <div className="ud-card">
                <div className="ud-card-header">
                  <h4 className="ud-card-title">My Projects</h4>
                  <button type="button" className="ud-link-btn" onClick={() => navigate('/user/projects')}>View All</button>
                </div>
                {data.projects.length === 0 ? (
                  <p className="ud-empty">No projects available.</p>
                ) : (
                  <ul className="ud-project-list">
                    {data.projects.slice(0, 4).map((p) => {
                      const statusColors = { Active: '#10B981', 'On Hold': '#F59E0B', Planning: '#3B82F6', Completed: '#6366F1' };
                      const col = statusColors[p.status] || '#64748b';
                      /* progress: completed tasks out of all tasks for this project */
                      const projTasks = data.tasks.filter(t => String(t.projectId) === String(p._id));
                      const projDone = projTasks.filter(t => t.status === 'Completed').length;
                      const projPct = projTasks.length ? Math.round((projDone / projTasks.length) * 100) : 0;

                      return (
                        <li key={p._id} className="ud-project-row">
                          <div className="ud-project-row-top">
                            <span className="ud-project-name">{p.name}</span>
                            <span className="ud-project-status-pill" style={{ color: col, background: `${col}18` }}>{p.status}</span>
                          </div>
                          <div className="ud-progress-bar-track">
                            <div className="ud-progress-bar-fill" style={{ width: `${projPct}%`, background: col }} />
                          </div>
                          <span className="ud-project-pct">{projTasks.length ? `${projPct}%` : 'No tasks'}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* ── Analytics Grid Row B ──────────────────────────────── */}
              {/* Upcoming Deadlines */}
              <div className="ud-card">
                <div className="ud-card-header">
                  <h4 className="ud-card-title">Upcoming Deadlines</h4>
                  <button type="button" className="ud-link-btn" onClick={() => navigate('/user/tasks')}>View All</button>
                </div>
                {upcomingDeadlines.length === 0 ? (
                  <p className="ud-empty">No upcoming deadlines.</p>
                ) : (
                  <ul className="ud-deadline-list">
                    {upcomingDeadlines.map((item) => {
                      const d = new Date(item.dueDate);
                      return (
                        <li key={item._id} className="ud-deadline-row">
                          <div className="ud-deadline-date">
                            <strong>{d.getDate()}</strong>
                            <span>{d.toLocaleString('default', { month: 'short' })}</span>
                          </div>
                          <div className="ud-deadline-info">
                            <span className="ud-deadline-title">{item.title}</span>
                            <span className="ud-deadline-context">{item.type === 'project' ? 'Project' : 'Task'}</span>
                          </div>
                          <span className="ud-status-pill" style={{ color: item.statusColor, background: `${item.statusColor}18` }}>{item.context}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Timeline / Activity Feed — from notifications */}
              <div className="ud-card">
                <div className="ud-card-header">
                  <h4 className="ud-card-title">Timeline / Activity Feed</h4>
                  <button type="button" className="ud-link-btn" onClick={() => navigate('/user/notifications')}>View All</button>
                </div>
                {data.notifications.length === 0 ? (
                  <p className="ud-empty">No activity yet.</p>
                ) : (
                  <ul className="ud-activity-list">
                    {data.notifications.slice(0, 5).map((n) => {
                      const typeColors = { Success: '#10B981', Warning: '#F59E0B', Error: '#EF4444', Info: '#3B82F6' };
                      const col = typeColors[n.type] || '#3B82F6';
                      return (
                        <li key={n._id} className="ud-activity-item">
                          <span className="ud-activity-dot" style={{ background: col }} />
                          <div className="ud-activity-body">
                            <span className="ud-activity-title">{n.title}</span>
                            <span className="ud-activity-time">{formatDate(n.createdAt)}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Today's Time Summary — from attendance */}
              <div className="ud-card">
                <div className="ud-card-header">
                  <h4 className="ud-card-title">Today&rsquo;s Time Summary</h4>
                  <button type="button" className="ud-link-btn" onClick={() => navigate('/user/attendance')}>View Details →</button>
                </div>
                {att === null ? (
                  <p className="ud-empty">No attendance record for today.</p>
                ) : (
                  <div className="ud-time-summary">
                    <div className="ud-time-ring-wrap">
                      <svg viewBox="0 0 80 80" className="ud-time-ring-svg">
                        <circle cx="40" cy="40" r="32" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                        <circle
                          cx="40" cy="40" r="32"
                          fill="none"
                          stroke="#EA580C"
                          strokeWidth="8"
                          strokeDasharray={`${(workedPct / 100) * 201} 201`}
                          strokeDashoffset="50.3"
                          className="ud-time-ring-arc"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="ud-time-ring-label">
                        <strong>{fmtMins(workedMins)}</strong>
                        <span>Hrs Worked</span>
                      </div>
                    </div>
                    <ul className="ud-time-detail-list">
                      <li><span>Clock In</span>  <strong>{checkInTime || '——:——'}</strong></li>
                      <li><span>Clock Out</span> <strong>{checkOutTime || '——:——'}</strong></li>
                      <li><span>Status</span>    <strong>{att.status || '—'}</strong></li>
                    </ul>
                  </div>
                )}
              </div>

              {/* ── Analytics Grid Row C ──────────────────────────────── */}
              {/* Team Status — collaborators from tasks/projects */}
              <div className="ud-card" id="ud-team-section">
                <div className="ud-card-header">
                  <h4 className="ud-card-title">Team Status (My Team)</h4>
                </div>
                {teamMembers.length === 0 ? (
                  <p className="ud-empty">No collaborators found on your tasks or projects.</p>
                ) : (
                  <ul className="ud-team-list">
                    {teamMembers.map((m) => {
                      const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || '?';
                      return (
                        <li key={m._id} className="ud-team-row">
                          <span className="ud-team-avatar">{initialsFor(name)}</span>
                          <div className="ud-team-info">
                            <strong>{name}</strong>
                            <span>{m.designation || m.department || m.role || 'Employee'}</span>
                          </div>
                          <span className={`ud-team-status ${m.isActive !== false ? 'online' : 'offline'}`}>
                            {m.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* My Daily Report */}
              <div className="ud-card ud-daily-report-card" id="ud-daily-report-section">
                <div className="ud-card-header">
                  <h4 className="ud-card-title">My Daily Report</h4>
                  <span className="ud-report-date">{formatDate(new Date())}</span>
                </div>
                <ul className="ud-report-stats">
                  <li>
                    <div className="ud-report-stat-icon" style={{ background: 'rgba(234,88,12,0.10)', color: '#EA580C' }}>{FEAT_ICONS.tasks}</div>
                    <div>
                      <strong>{data.tasks.length}</strong>
                      <span>Total Tasks</span>
                    </div>
                  </li>
                  <li>
                    <div className="ud-report-stat-icon" style={{ background: 'rgba(16,185,129,0.10)', color: '#10B981' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <div>
                      <strong>{doneTasks.length}</strong>
                      <span>Completed</span>
                    </div>
                  </li>
                  <li>
                    <div className="ud-report-stat-icon" style={{ background: 'rgba(59,130,246,0.10)', color: '#3B82F6' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    </div>
                    <div>
                      <strong>{inProgTasks.length}</strong>
                      <span>In Progress</span>
                    </div>
                  </li>
                  <li>
                    <div className="ud-report-stat-icon" style={{ background: 'rgba(239,68,68,0.10)', color: '#EF4444' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    </div>
                    <div>
                      <strong>{overdueTasks.length}</strong>
                      <span>Overdue</span>
                    </div>
                  </li>
                </ul>
                {att && (
                  <div className="ud-report-time-row">
                    <span>Time worked today</span>
                    <strong style={{ color: '#EA580C' }}>{fmtMins(workedMins)} hrs</strong>
                  </div>
                )}
                {data.projects.length > 0 && (
                  <div className="ud-report-time-row">
                    <span>Active projects</span>
                    <strong style={{ color: '#2563EB' }}>{data.projects.filter(p => p.status === 'Active').length}</strong>
                  </div>
                )}
              </div>

            </div>
            {/* ══ END new analytics grid ══════════════════════════════ */}

            {/* ── Consolidated 4-Column Grid ─────────────────────────────── */}
            <section className="dashboard-4-col">
              {/* My Tasks */}
              <div className="panel tasks-panel">
                <div className="panel-header">
                  <h3>My Tasks</h3>
                  <button type="button" className="view-link" onClick={() => navigate('/user/tasks')}>View All</button>
                </div>
                <div className="task-list">
                  {myTasks.slice(0, 5).map((task) => (
                    <div key={task._id} className="task-item">
                      <div className={`task-status-circle ${task.status === 'Completed' ? 'completed' : task.status === 'In Progress' ? 'in-progress' : 'pending'}`}>
                        {task.status === 'Completed' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                      </div>
                      <div className="task-copy">
                        <div className="task-line">
                          <h4>{task.title}</h4>
                        </div>
                        {task.category && <span className="task-tag">{task.category}</span>}
                        <div className="task-meta">
                          <span className="task-date">Due {formatDate(task.dueDate)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {myTasks.length === 0 && <p>No tasks available.</p>}
                </div>
              </div>

              {/* My Projects */}
              <div className="panel">
                <div className="panel-header">
                  <h3>My Projects</h3>
                  <button type="button" className="view-link" onClick={() => navigate('/user/projects')}>View All</button>
                </div>
                <div className="project-list">
                  {myProjects.slice(0, 5).map((project) => (
                    <div key={project._id} className="project-item">
                      <div className="project-head">
                        <div>
                          <h4>{project.name}</h4>
                        </div>
                      </div>
                      <div className="project-foot">
                        <span className="project-status">{project.status}</span>
                        <span>{project.dueDate ? `Due ${formatDate(project.dueDate)}` : 'No due date'}</span>
                      </div>
                    </div>
                  ))}
                  {myProjects.length === 0 && <p>No projects available.</p>}
                </div>
              </div>

              {/* My Schedule */}
              <div className="panel">
                <div className="panel-header">
                  <h3>My Schedule</h3>
                  <button type="button" className="view-link" onClick={() => navigate('/user/calendar')}>View Calendar</button>
                </div>
                <div className="schedule-list">
                  {upcomingEvents.map((item) => (
                    <div key={item._id} className="schedule-item">
                      <div className="schedule-time">{new Date(item.startAt).toLocaleString()}</div>
                      <div className="schedule-copy">
                        <h4>{item.title}</h4>
                        <p>{item.type}</p>
                      </div>
                    </div>
                  ))}
                  {!upcomingEvents.length && <p>No upcoming events.</p>}
                </div>
              </div>

              {/* Recent Leads */}
              <div className="panel">
                <div className="panel-header">
                  <h3>Recent Leads</h3>
                  <button type="button" className="view-link" onClick={() => navigate('/user/leads')}>View All</button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Lead</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {myLeads.slice(0, 5).map((lead) => (
                        <tr key={lead._id}>
                          <td>
                            <div className="lead-cell">
                              <span className="lead-avatar">{initialsFor(lead.name)}</span>
                              <span>{lead.name}</span>
                            </div>
                          </td>
                          <td><span className={`lead-status ${String(lead.status).toLowerCase()}`}>{lead.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!myLeads.length && <p>No leads available.</p>}
                </div>
              </div>
            </section>


          </>
        )}
      </div>
    </UserLayout>
  );
}
