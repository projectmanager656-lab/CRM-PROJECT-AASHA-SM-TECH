import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../../../context/AppContext';
import apiClient from '../../../../services/apiClient';
import UserLayout from '../users/components/UserLayout';
import '../Dashboard.css';

export default function DigitalMarketingDashboard() {
  const { user, can, permissionsLoading } = useContext(AppContext) || {};
  const navigate = useNavigate();

  const [data, setData] = useState({
    tasks: [],
    projects: [],
    leads: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (permissionsLoading) return;
    let active = true;
    setLoading(true);

    const requests = [
      can && can('projects', 'tasks', 'view') ? apiClient.get('/tasks') : null,
      can && can('projects', 'projects', 'view') ? apiClient.get('/projects') : null,
      can && can('crm', 'leads', 'view') ? apiClient.get('/leads') : null,
    ].map((req) => req || Promise.resolve({ data: { data: [] } }));

    Promise.allSettled(requests)
      .then((results) => {
        if (!active) return;
        const getRecs = (res) =>
          res.status === 'fulfilled' && res.value?.data?.data ? res.value.data.data : [];
        setData({
          tasks: getRecs(results[0]),
          projects: getRecs(results[1]),
          leads: getRecs(results[2]),
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [permissionsLoading, can]);

  const stats = [
    { title: 'Active Campaigns', value: data.projects.length, icon: '📢', tone: 'blue' },
    { title: 'Marketing Tasks', value: data.tasks.length, icon: '📋', tone: 'orange' },
    { title: 'Inbound Inquiries', value: data.leads.length, icon: '🎯', tone: 'green' },
    { title: 'Team Members', value: 1, icon: '👥', tone: 'purple' },
  ];

  return (
    <UserLayout pageTitle="Digital Marketing Dashboard">
      <div className="user-dashboard-page">
        {/* Header Section */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0f172a', margin: '0 0 0.25rem 0' }}>
            Digital Marketing Dashboard
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
            Manage campaigns, SEO tracking, social media reach, and inbound lead generation.
          </p>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            Loading Digital Marketing dashboard...
          </div>
        ) : (
          <div>
            {/* KPI Cards Grid */}
            <div className="ud-stats-grid" style={{ marginBottom: '1.5rem' }}>
              {stats.map((st, i) => (
                <div key={i} className={`ud-stat-card ud-stat-${st.tone}`}>
                  <div className="ud-stat-icon-wrap">{st.icon}</div>
                  <div className="ud-stat-body">
                    <span className="ud-stat-label">{st.title}</span>
                    <strong className="ud-stat-value">{st.value}</strong>
                  </div>
                </div>
              ))}
            </div>

            {/* Structural Foundation Placeholder Banner */}
            <div
              style={{
                background: '#ffffff',
                border: '1px dashed #cbd5e1',
                borderRadius: '12px',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                color: '#475569',
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎯</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                Digital Marketing Workspace
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#64748b', maxWidth: '540px', margin: '0 auto' }}>
                Dashboard routing and department structure are successfully connected. Full module metrics and customized layout will be rendered upon design specification.
              </p>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
}
