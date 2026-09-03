import React, { useContext, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../../../context/AppContext';
import apiClient from '../../../../services/apiClient';
import UserLayout from '../users/components/UserLayout';
import '../Dashboard.css';

const formatDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);

function DonutChart({ segments }) {
  const R = 36;
  const C = 2 * Math.PI * R;
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
          key={i} cx="40" cy="40" r={R} fill="none"
          stroke={arc.color} strokeWidth="12"
          strokeDasharray={`${arc.dash} ${arc.gap}`}
          strokeDashoffset={C / 4 - arc.offset}
          className="ud-donut-arc"
        />
      ))}
    </svg>
  );
}

export default function FinanceDashboard() {
  const { user, can, permissionsLoading } = useContext(AppContext) || {};
  const navigate = useNavigate();

  const [data, setData] = useState({ invoices: [], payroll: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (permissionsLoading) return;
    let active = true;
    setLoading(true);

    const requests = [
      apiClient.get('/invoices'),
      apiClient.get('/payroll'),
    ].map(req => req.catch(() => ({ data: { data: [] } })));

    Promise.allSettled(requests).then(results => {
      if (!active) return;
      const getRecs = (res) => (res.status === 'fulfilled' && res.value?.data?.data) ? res.value.data.data : [];
      setData({
        invoices: getRecs(results[0]),
        payroll: getRecs(results[1]),
      });
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [permissionsLoading]);

  // Finance Stats
  const paidInvoices = data.invoices.filter(i => i.status === 'Paid').length;
  const unpaidInvoices = data.invoices.filter(i => i.status !== 'Paid').length;

  const stats = [
    { title: 'Total Invoices', value: data.invoices.length, icon: '📄', tone: 'blue' },
    { title: 'Paid Invoices', value: paidInvoices, icon: '💰', tone: 'green' },
    { title: 'Unpaid Invoices', value: unpaidInvoices, icon: '⏳', tone: 'orange' },
    { title: 'Payroll Slips', value: data.payroll.length, icon: '🏢', tone: 'purple' },
  ];

  // Invoice Status Donut
  const INV_COLORS = { 'Paid': '#10B981', 'Pending': '#F59E0B', 'Overdue': '#EF4444', 'Draft': '#64748b' };
  const invStatusCounts = useMemo(() => {
    const map = {};
    data.invoices.forEach(i => { map[i.status] = (map[i.status] || 0) + 1; });
    return map;
  }, [data.invoices]);

  const invSegments = Object.entries(invStatusCounts).map(([label, count]) => ({
    label, count, color: INV_COLORS[label] || '#64748b',
    pct: data.invoices.length ? Math.round((count / data.invoices.length) * 100) : 0,
  }));

  return (
    <UserLayout pageTitle="Finance Dashboard">
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
                Manage invoices, payroll and financial activities from one place.
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

                {/* Invoice Status */}
                <div className="ud-card">
                  <div className="ud-card-header">
                    <h4 className="ud-card-title">Invoice Status</h4>
                  </div>
                  {data.invoices.length === 0 ? (
                    <p className="ud-empty">No invoices available.</p>
                  ) : (
                    <div className="ud-donut-wrap">
                      <div className="ud-donut-chart">
                        <DonutChart segments={invSegments} />
                        <div className="ud-donut-center">
                          <strong>{data.invoices.length}</strong>
                          <span>Total</span>
                        </div>
                      </div>
                      <ul className="ud-donut-legend">
                        {invSegments.map(s => (
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

                {/* Recent Invoices */}
                <div className="ud-card">
                  <div className="ud-card-header">
                    <h4 className="ud-card-title">Recent Invoices</h4>
                  </div>
                  {data.invoices.length === 0 ? (
                    <p className="ud-empty">No invoices available.</p>
                  ) : (
                    <ul className="ud-project-list">
                      {data.invoices.slice(0, 4).map(i => (
                        <li key={i._id} className="ud-project-row">
                          <div className="ud-project-row-top">
                            <span className="ud-project-name">{i.invoiceNumber || 'Invoice'}</span>
                            <span className="ud-project-status-pill" style={{ color: INV_COLORS[i.status] || '#64748b', background: `${INV_COLORS[i.status] || '#64748b'}18` }}>
                              {i.status}
                            </span>
                          </div>
                          <span className="ud-project-pct" style={{ alignSelf: 'flex-start' }}>
                            {formatCurrency(i.amount)} - Due: {formatDate(i.dueDate)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Payroll */}
                <div className="ud-card">
                  <div className="ud-card-header">
                    <h4 className="ud-card-title">My Payroll Slips</h4>
                  </div>
                  {data.payroll.length === 0 ? (
                    <p className="ud-empty">No payroll slips available.</p>
                  ) : (
                    <ul className="ud-project-list">
                      {data.payroll.slice(0, 4).map(p => (
                        <li key={p._id} className="ud-project-row">
                          <div className="ud-project-row-top">
                            <span className="ud-project-name">Slip: {p.payPeriod || formatDate(p.createdAt)}</span>
                            <span className="ud-project-status-pill" style={{ color: '#10B981', background: '#10B98118' }}>
                              Generated
                            </span>
                          </div>
                          <span className="ud-project-pct" style={{ alignSelf: 'flex-start' }}>
                            {formatCurrency(p.net)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Upcoming Items */}
                <div className="ud-card">
                  <div className="ud-card-header">
                    <h4 className="ud-card-title">Upcoming Financials</h4>
                  </div>
                  <p className="ud-empty" style={{ marginTop: '2rem' }}>All caught up! No upcoming items.</p>
                </div>

              </div>
            </section>
          </>
        )}
      </div>
    </UserLayout>
  );
}
