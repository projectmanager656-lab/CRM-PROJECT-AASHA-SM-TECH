import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../../context/AppContext';
import apiClient from '../../../services/apiClient';
import UserLayout from './users/components/UserLayout';
import './Dashboard.css';

const quickLinks = [
  { title: 'My Tasks', icon: 'T', path: '/user/tasks', permission: ['projects', 'tasks'] }, 
  { title: 'My Projects', icon: 'P', path: '/user/projects', permission: ['projects', 'projects'] }, 
  { title: 'Attendance', icon: 'A', path: '/user/attendance', permission: ['hrms', 'attendance'] }, 
  { title: 'Leave Request', icon: 'L', path: '/user/leave-requests', permission: ['hrms', 'leave_requests'] }, 
  { title: 'My Leads', icon: 'L', path: '/user/leads', permission: ['crm', 'leads'] }, 
  { title: 'Invoices', icon: '$', path: '/user/invoices' }, 
  { title: 'Documents', icon: 'D', path: '/user/documents', permission: ['documents', 'documents'] }, 
  { title: 'Payroll', icon: '$', path: '/user/payroll', permission: ['finance', 'payroll'] },
];

const records = (result) => result.status === 'fulfilled' ? result.value.data.data || [] : [];
const formatDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not scheduled';
const initialsFor = (value) => String(value || '?').split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

export default function UserDashboard() {
  const { user, can, permissionsLoading } = useContext(AppContext);
  const navigate = useNavigate();
  const [data, setData] = useState({ tasks: [], projects: [], leads: [], clients: [], events: [], announcements: [], notifications: [], invoices: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (permissionsLoading) return undefined;
    let active = true;
    setLoading(true);
    
    const requests = [
      can('projects', 'tasks', 'view') ? apiClient.get('/tasks') : null, 
      can('projects', 'projects', 'view') ? apiClient.get('/projects') : null, 
      can('crm', 'leads', 'view') ? apiClient.get('/leads') : null, 
      can('crm', 'clients', 'view') ? apiClient.get('/clients') : null, 
      can('communications', 'calendar', 'view') ? apiClient.get('/calendar') : null, 
      can('communications', 'announcements', 'view') ? apiClient.get('/announcements', { params: { limit: 5 } }) : null, 
      can('communications', 'notifications', 'view') ? apiClient.get('/notifications') : null, 
      apiClient.get('/invoices')
    ].map((request) => request || Promise.resolve({ data: { data: [] } }));
    
    Promise.allSettled(requests).then((results) => { 
      if (active) {
        setData({ 
          tasks: records(results[0]), 
          projects: records(results[1]), 
          leads: records(results[2]), 
          clients: records(results[3]), 
          events: records(results[4]), 
          announcements: records(results[5]), 
          notifications: records(results[6]), 
          invoices: records(results[7]) 
        });
      }
    }).finally(() => { 
      if (active) setLoading(false); 
    });
    
    return () => { active = false; };
  }, [can, permissionsLoading]);

  const fullName = useMemo(() => [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Employee', [user]);
  const roleLabel = user?.rbacRoleKey || user?.role?.replace('_', ' ') || 'Employee';
  
  const stats = [
    { title: 'My Tasks', value: data.tasks.length, meta: `${data.tasks.filter((item) => item.status !== 'Completed').length} open`, tone: 'primary', icon: 'T', path: '/user/tasks' },
    { title: 'My Projects', value: data.projects.length, meta: `${data.projects.filter((item) => item.status === 'Active').length} active`, tone: 'success', icon: 'P', path: '/user/projects' },
    { title: 'My Leads', value: data.leads.length, meta: `${data.leads.filter((item) => item.status === 'New').length} new`, tone: 'warning', icon: 'L', path: '/user/leads' },
    { title: 'My Clients', value: data.clients.length, meta: `${data.clients.filter((item) => item.status === 'Active').length} active`, tone: 'info', icon: 'C', path: '/user/clients' },
  ];
  
  const events = data.events.filter((item) => new Date(item.startAt) >= new Date()).slice(0, 3);

  return (
    <UserLayout pageTitle="Dashboard">
      <div className="user-dashboard-page">
        <section className="welcome-banner">
          <div>
            <p className="welcome-kicker">Welcome back</p>
            <h2>Welcome back, {fullName}!</h2>
            <p>Here is what is happening with your work today.</p>
          </div>
          <div className="date-picker">
            <span>Today</span>
            <strong>{formatDate(new Date())}</strong>
          </div>
        </section>

        {loading ? (
          <div className="dashboard-loading">Loading dashboard data...</div>
        ) : (
          <>
            <section className="stats-grid">
              {stats.map((stat) => (
                <article key={stat.title} className={`stat-card ${stat.tone}`}>
                  <div className="stat-icon">{stat.icon}</div>
                  <div className="stat-body">
                    <span>{stat.title}</span>
                    <strong>{stat.value}</strong>
                    <small>{stat.meta}</small>
                  </div>
                  <button type="button" className="text-link" onClick={() => navigate(stat.path)}>View All</button>
                </article>
              ))}
            </section>

            <section className="main-grid">
              <div className="panel tasks-panel">
                <div className="panel-header">
                  <h3>My Tasks</h3>
                  <button type="button" className="view-link" onClick={() => navigate('/user/tasks')}>View All Tasks</button>
                </div>
                <div className="task-list">
                  {data.tasks.slice(0, 3).map((task) => (
                    <div key={task._id} className="task-item">
                      <div className="task-check">{task.status === 'Completed' ? 'Done' : 'Open'}</div>
                      <div className="task-copy">
                        <div className="task-line">
                          <h4>{task.title}</h4>
                          <span className={`priority priority-${String(task.priority || 'medium').toLowerCase()}`}>{task.priority || 'Medium'}</span>
                        </div>
                        <p>{task.description || 'No description provided.'}</p>
                        <div className="task-meta">
                          <span>Due {formatDate(task.dueDate)}</span>
                          <strong>{task.status}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!data.tasks.length && <p>No tasks available.</p>}
                </div>
              </div>

              <div className="panel profile-panel">
                <div className="panel-header">
                  <h3>My Profile</h3>
                  <button type="button" className="view-link" onClick={() => navigate('/user/profile')}>View Profile</button>
                </div>
                <div className="profile-card-box">
                  <div className="profile-box-avatar">{initialsFor(fullName)}</div>
                  <div className="profile-meta">
                    <h4>{fullName}</h4>
                    <p>{roleLabel}</p>
                  </div>
                </div>
                <div className="profile-details">
                  <div><span>Email</span><strong>{user?.email || 'Not available'}</strong></div>
                  <div><span>Department</span><strong>{user?.department || 'Not assigned'}</strong></div>
                  <div><span>Status</span><strong className="status-pill">{user?.isActive === false ? 'Inactive' : 'Active'}</strong></div>
                </div>
              </div>
            </section>

            <section className="secondary-grid">
              <div className="panel">
                <div className="panel-header">
                  <h3>My Projects</h3>
                  <button type="button" className="view-link" onClick={() => navigate('/user/projects')}>View All Projects</button>
                </div>
                <div className="project-list">
                  {data.projects.slice(0, 3).map((project) => (
                    <div key={project._id} className="project-item">
                      <div className="project-head">
                        <div>
                          <h4>{project.name}</h4>
                          <span>{project.description || 'No description provided.'}</span>
                        </div>
                      </div>
                      <div className="project-foot">
                        <span className="project-status">{project.status}</span>
                        <span>{project.dueDate ? `Due ${formatDate(project.dueDate)}` : 'No due date'}</span>
                      </div>
                    </div>
                  ))}
                  {!data.projects.length && <p>No projects available.</p>}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h3>My Schedule</h3>
                  <button type="button" className="view-link" onClick={() => navigate('/user/calendar')}>View Calendar</button>
                </div>
                <div className="schedule-list">
                  {events.map((item) => (
                    <div key={item._id} className="schedule-item">
                      <div className="schedule-time">{new Date(item.startAt).toLocaleString()}</div>
                      <div className="schedule-copy">
                        <h4>{item.title}</h4>
                        <p>{item.type}</p>
                      </div>
                      <span className="schedule-status">{item.status}</span>
                    </div>
                  ))}
                  {!events.length && <p>No upcoming events.</p>}
                </div>
              </div>
            </section>

            <section className="lower-grid">
              <div className="panel">
                <div className="panel-header">
                  <h3>Recent Leads</h3>
                  <button type="button" className="view-link" onClick={() => navigate('/user/leads')}>View All</button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Lead</th>
                        <th>Company</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.leads.slice(0, 4).map((lead) => (
                        <tr key={lead._id}>
                          <td>
                            <div className="lead-cell">
                              <span className="lead-avatar">{initialsFor(lead.name)}</span>
                              <span>{lead.name}</span>
                            </div>
                          </td>
                          <td>{lead.company || 'Not specified'}</td>
                          <td><span className={`lead-status ${String(lead.status).toLowerCase()}`}>{lead.status}</span></td>
                          <td>{formatDate(lead.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.leads.length && <p>No leads available.</p>}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h3>Announcements</h3>
                  <span className="view-link">Latest</span>
                </div>
                <div className="announcement-list">
                  {data.announcements.map((item) => (
                    <div key={item._id} className="announcement-item">
                      <div className="announcement-icon">Info</div>
                      <div className="announcement-copy">
                        <h4>{item.title}</h4>
                        <p>{item.message}</p>
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                  {!data.announcements.length && <p>No announcements yet.</p>}
                </div>
              </div>
            </section>

            <section className="quick-links-panel panel">
              <div className="panel-header">
                <h3>Quick Links</h3>
              </div>
              <div className="quick-links-grid">
                {quickLinks.filter((link) => !link.permission || can(...link.permission, 'view')).map((link) => (
                  <button key={link.title} type="button" className="quick-link-card" onClick={() => navigate(link.path)}>
                    <span>{link.icon}</span>
                    <strong>{link.title}</strong>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </UserLayout>
  );
}
