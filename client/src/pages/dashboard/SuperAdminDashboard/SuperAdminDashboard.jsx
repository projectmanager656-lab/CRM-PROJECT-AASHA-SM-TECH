import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../../context/AppContext';
import apiClient from '../../../services/apiClient';
import SuperAdminLayout from './components/SuperAdminLayout';
import './Dashboard.css';

const labels = {
  users: 'Total Employees',
  admins: 'Total Admins',
  superAdmins: 'Super Admins',
  projects: 'Projects',
  leads: 'Leads',
  clients: 'Clients',
  tasks: 'Tasks',
  departments: 'Departments',
  roles: 'Roles',
  modules: 'Modules',
  announcements: 'Announcements',
  notifications: 'Notifications'
};

const colors = ['#ea580c', '#c2410c', '#9a3412', '#7c2d12', '#fb923c', '#fdba74', '#fed7aa'];

const kpiIcons = {
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  projects: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,
  leads: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>,
  clients: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
  tasks: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="M8 12l3 3 5-5" /></svg>,
  invoices: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
};

export default function SuperAdminDashboard() {
  const { user } = useContext(AppContext);
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/super-admin/summary')
      .then(r => setData(r.data.data))
      .catch(e => setError(e.response?.data?.message || 'Unable to load dashboard data.'));
  }, []);

  const name = user?.firstName || 'Super Admin';
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // Filter KPI metrics we want to highlight
  const topMetrics = ['users', 'projects', 'leads', 'clients', 'tasks'];

  return (
    <SuperAdminLayout pageTitle="Dashboard">

      {/* Dashboard Page Header */}
      <div className="dashboard-page-header animate-fade-up">
        <div>
          <h1>Dashboard</h1>
          <p>Good morning, {name}! 👋</p>
          <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.2rem' }}>Here's what's happening with your organization today.</p>
        </div>
        <div className="dashboard-date-chip">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          Today, {today}
        </div>
      </div>

      {error && <div style={{ color: 'red', marginTop: '1rem' }}>{error}</div>}

      {!data ? (
        <div style={{ marginTop: '2rem' }}>Loading dashboard data…</div>
      ) : (
        <>
          {/* KPI GRID */}
          <div className="kpi-grid animate-fade-up delay-100">
            {topMetrics.map((key, index) => (
              <div className="kpi-card" key={key}>
                <div className="kpi-icon-wrap" style={{ background: index % 2 === 0 ? 'rgba(234, 88, 12, 0.1)' : 'rgba(154, 52, 18, 0.1)', color: index % 2 === 0 ? '#ea580c' : '#9a3412' }}>
                  <div style={{ width: '24px', height: '24px' }}>
                    {kpiIcons[key]}
                  </div>
                </div>
                <div className="kpi-content">
                  <span className="kpi-label">{labels[key]}</span>
                  <span className="kpi-value">{data.counts[key] || 0}</span>
                  <span className="kpi-trend">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>
                    Live Data
                  </span>
                </div>
              </div>
            ))}
            <div className="kpi-card">
              <div className="kpi-icon-wrap" style={{ background: 'rgba(194, 65, 12, 0.1)', color: '#c2410c' }}>
                <div style={{ width: '24px', height: '24px' }}>
                  {kpiIcons['invoices']}
                </div>
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Invoices</span>
                <span className="kpi-value">{data.invoiceStatuses?.reduce((acc, curr) => acc + curr.count, 0) || 0}</span>
                <span className="kpi-trend">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>
                  Live Data
                </span>
              </div>
            </div>
          </div>

          {/* DASHBOARD CHARTS */}
          <div className="dashboard-main-grid animate-fade-up delay-200">
            {/* Sales Pipeline */}
            <div className="chart-card">
              <div className="chart-header">
                <h3>Sales Pipeline</h3>
                <button type="button" className="chart-more-btn">⋮</button>
              </div>
              <div className="sales-funnel-container">
                <div className="sales-funnel">
                  {data.leadStatuses?.map((x, i) => (
                    <div key={x._id} className="funnel-segment" style={{ background: colors[i % colors.length] }}></div>
                  ))}
                </div>
                <div className="chart-legend">
                  {data.leadStatuses?.map((x, i) => {
                    const total = data.leadStatuses.reduce((acc, curr) => acc + curr.count, 0);
                    const pct = total > 0 ? Math.round((x.count / total) * 100) : 0;
                    return (
                      <div className="legend-item" key={x._id}>
                        <div className="legend-label">
                          <span className="legend-dot" style={{ background: colors[i % colors.length] }}></span>
                          <span>{x._id || 'Unspecified'}</span>
                        </div>
                        <span className="legend-value">{x.count} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Projects Overview */}
            <div className="chart-card">
              <div className="chart-header">
                <h3>Projects Overview</h3>
                <button type="button" className="chart-more-btn">⋮</button>
              </div>
              {(() => {
                const total = data.projectStatuses?.reduce((acc, curr) => acc + curr.count, 0) || 0;
                let currentP = 0;
                const conicGradient = data.projectStatuses?.map((s, i) => {
                  const p = (s.count / total) * 100;
                  const grad = `${colors[i % colors.length]} ${currentP}% ${currentP + p}%`;
                  currentP += p;
                  return grad;
                }).join(', ');

                return (
                  <div className="donut-container">
                    <div className="donut-chart" style={{ background: `conic-gradient(${conicGradient})` }}>
                      <div className="donut-hole">
                        <span className="donut-hole-value">{total}</span>
                        <span className="donut-hole-label">Total Projects</span>
                      </div>
                    </div>
                    <div className="chart-legend">
                      {data.projectStatuses?.map((x, i) => {
                        const pct = total > 0 ? Math.round((x.count / total) * 100) : 0;
                        return (
                          <div className="legend-item" key={x._id}>
                            <div className="legend-label">
                              <span className="legend-dot" style={{ background: colors[i % colors.length] }}></span>
                              <span>{x._id || 'Unspecified'}</span>
                            </div>
                            <span className="legend-value">{x.count} ({pct}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Task Analytics */}
            <div className="chart-card">
              <div className="chart-header">
                <h3>Task Analytics</h3>
                <button type="button" className="chart-more-btn">⋮</button>
              </div>
              <div className="progress-bar-container">
                <div className="progress-track">
                  {(() => {
                    const total = data.taskStatuses?.reduce((acc, curr) => acc + curr.count, 0) || 0;
                    return data.taskStatuses?.map((x, i) => (
                      <div key={x._id} className="progress-segment" style={{ width: `${(x.count / total) * 100}%`, background: colors[i % colors.length] }}></div>
                    ));
                  })()}
                </div>
                <div className="chart-legend">
                  {(() => {
                    const total = data.taskStatuses?.reduce((acc, curr) => acc + curr.count, 0) || 0;
                    return data.taskStatuses?.map((x, i) => {
                      const pct = total > 0 ? Math.round((x.count / total) * 100) : 0;
                      return (
                        <div className="legend-item" key={x._id}>
                          <div className="legend-label">
                            <span className="legend-dot" style={{ background: colors[i % colors.length] }}></span>
                            <span>{x._id || 'Unspecified'}</span>
                          </div>
                          <span className="legend-value">{x.count} ({pct}%)</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM GRID */}
          <div className="dashboard-bottom-grid animate-fade-up delay-300">

            {/* Revenue Overview */}
            <div className="chart-card">
              <div className="chart-header">
                <h3>Revenue Overview (Invoices)</h3>
                <button type="button" className="chart-more-btn">⋮</button>
              </div>
              <div className="revenue-content">
                <div className="revenue-stats">
                  {(() => {
                    const totalRevenue = data.invoiceStatuses?.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0) || 0;
                    return (
                      <div className="revenue-total">
                        <span>Total Invoiced</span>
                        <h2>${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                      </div>
                    );
                  })()}

                  <div className="chart-legend" style={{ gap: '1rem' }}>
                    {data.invoiceStatuses?.map((x, i) => (
                      <div className="legend-item" key={x._id}>
                        <div className="legend-label">
                          <span className="legend-dot" style={{ background: colors[(i + 2) % colors.length] }}></span>
                          <span>{x._id || 'Unspecified'}</span>
                        </div>
                        <span className="legend-value">${(x.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} <span style={{ fontSize: '0.7em', color: '#64748b', fontWeight: 'normal' }}>({x.count} Invoices)</span></span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Decorative image/wallet icon replacement on the right */}
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ width: '140px', height: '140px', color: '#e2e8f0' }}>
                    <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="chart-card">
              <div className="chart-header">
                <h3>Recent Activity</h3>
                <button type="button" className="chart-more-btn">⋮</button>
              </div>
              <div className="activity-list">
                {data.recentUsers?.length ? (
                  data.recentUsers.map(x => (
                    <div className="activity-item" key={x._id}>
                      <div className="activity-icon">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                      </div>
                      <span className="activity-text">New user {x.firstName} {x.lastName} registered</span>
                      <span className="activity-time">{new Date(x.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>No recent activity.</div>
                )}
              </div>
              <button type="button" className="view-all-btn" onClick={() => navigate('/super-admin/users')}>View All Activity</button>
            </div>

          </div>
        </>
      )}
    </SuperAdminLayout>
  );
}
