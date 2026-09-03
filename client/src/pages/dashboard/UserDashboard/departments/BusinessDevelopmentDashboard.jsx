import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../../../context/AppContext';
import apiClient from '../../../../services/apiClient';
import UserLayout from '../users/components/UserLayout';
import '../Dashboard.css';

const formatDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

export default function BusinessDevelopmentDashboard() {
  const { user, can, permissionsLoading } = useContext(AppContext) || {};
  const navigate = useNavigate();

  const [data, setData] = useState({ leads: [], clients: [], projects: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (permissionsLoading) return;
    let active = true;
    setLoading(true);

    const requests = [
      can && can('crm', 'leads', 'view') ? apiClient.get('/leads') : null,
      can && can('crm', 'clients', 'view') ? apiClient.get('/clients') : null,
      can && can('projects', 'projects', 'view') ? apiClient.get('/projects') : null,
    ].map(req => req || Promise.resolve({ data: { data: [] } }));

    Promise.allSettled(requests).then(results => {
      if (!active) return;
      const getRecs = (res) => (res.status === 'fulfilled' && res.value?.data?.data) ? res.value.data.data : [];
      setData({
        leads: getRecs(results[0]),
        clients: getRecs(results[1]),
        projects: getRecs(results[2]),
      });
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [permissionsLoading, can]);

  // BD Stats
  const activeProjects = data.projects.filter(p => ['Active', 'Planning', 'In Progress'].includes(p.status)).length;
  const completedProjects = data.projects.filter(p => p.status === 'Completed').length;

  const stats = [
    { title: 'Total Leads', value: data.leads.length, icon: '🎯', tone: 'blue' },
    { title: 'Total Clients', value: data.clients.length, icon: '🤝', tone: 'purple' },
    { title: 'Active Projects', value: activeProjects, icon: '🚀', tone: 'orange' },
    { title: 'Completed Projects', value: completedProjects, icon: '✅', tone: 'green' },
  ];

  const LEAD_COLORS = { 'New': '#3B82F6', 'Contacted': '#F59E0B', 'Qualified': '#8B5CF6', 'Lost': '#EF4444', 'Won': '#10B981' };
  const PROJ_COLORS = { 'Active': '#10B981', 'In Progress': '#3B82F6', 'Planning': '#8B5CF6', 'On Hold': '#F59E0B', 'Completed': '#64748b' };

  return (
    <UserLayout pageTitle="Business Development Dashboard">
      <div className="user-dashboard-page">
        {loading ? (
          <div className="dashboard-loading">Loading dashboard data…</div>
        ) : (
          <>
            <div style={{ marginBottom: '2rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b' }}>
                Welcome back, {user?.firstName} {user?.lastName}! 👋
              </h1>
              <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
                Track opportunities, clients and business growth from one place.
              </p>
            </div>

            <section className="stats-grid">
              {stats.map((stat) => (
                <article key={stat.title} className={`stat-card ${stat.tone}`}>
                  <div className="stat-content">
                    <div className="stat-body">
                      <span>{stat.title}</span>
                      <strong>{stat.value}</strong>
                    </div>
                    <div className="stat-icon-wrapper" style={{ fontSize: '1.25rem' }}>
                      {stat.icon}
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <section className="ud-features-section">
              <div className="ud-analytics-grid">

                {/* Leads / Opportunities */}
                <div className="ud-card">
                  <div className="ud-card-header">
                    <h4 className="ud-card-title">Recent Leads</h4>
                  </div>
                  {data.leads.length === 0 ? (
                    <p className="ud-empty">No leads available.</p>
                  ) : (
                    <ul className="ud-project-list">
                      {data.leads.slice(0, 4).map(l => (
                        <li key={l._id} className="ud-project-row">
                          <div className="ud-project-row-top">
                            <span className="ud-project-name">{l.title || l.company}</span>
                            <span className="ud-project-status-pill" style={{ color: LEAD_COLORS[l.status] || '#64748b', background: `${LEAD_COLORS[l.status] || '#64748b'}18` }}>
                              {l.status}
                            </span>
                          </div>
                          <span className="ud-project-pct" style={{ alignSelf: 'flex-start' }}>
                            {formatDate(l.createdAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Projects */}
                <div className="ud-card">
                  <div className="ud-card-header">
                    <h4 className="ud-card-title">Active Projects</h4>
                  </div>
                  {data.projects.length === 0 ? (
                    <p className="ud-empty">No active projects.</p>
                  ) : (
                    <ul className="ud-project-list">
                      {data.projects.slice(0, 4).map(p => (
                        <li key={p._id} className="ud-project-row">
                          <div className="ud-project-row-top">
                            <span className="ud-project-name">{p.name}</span>
                            <span className="ud-project-status-pill" style={{ color: PROJ_COLORS[p.status] || '#64748b', background: `${PROJ_COLORS[p.status] || '#64748b'}18` }}>
                              {p.status}
                            </span>
                          </div>
                          <span className="ud-project-pct" style={{ alignSelf: 'flex-start' }}>
                            Due: {formatDate(p.dueDate)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Clients */}
                <div className="ud-card">
                  <div className="ud-card-header">
                    <h4 className="ud-card-title">Recent Clients</h4>
                  </div>
                  {data.clients.length === 0 ? (
                    <p className="ud-empty">No clients available.</p>
                  ) : (
                    <ul className="ud-project-list">
                      {data.clients.slice(0, 4).map(c => (
                        <li key={c._id} className="ud-project-row">
                          <div className="ud-project-row-top">
                            <span className="ud-project-name">{c.name}</span>
                            <span className="ud-project-status-pill" style={{ color: c.status === 'Active' ? '#10B981' : '#64748b', background: c.status === 'Active' ? '#10B98118' : '#64748b18' }}>
                              {c.status}
                            </span>
                          </div>
                          <span className="ud-project-pct" style={{ alignSelf: 'flex-start' }}>
                            {c.email}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Recent Activity */}
                <div className="ud-card">
                  <div className="ud-card-header">
                    <h4 className="ud-card-title">Recent Activity</h4>
                  </div>
                  <p className="ud-empty" style={{ marginTop: '2rem' }}>All caught up! No recent alerts.</p>
                </div>

              </div>
            </section>
          </>
        )}
      </div>
    </UserLayout>
  );
}
