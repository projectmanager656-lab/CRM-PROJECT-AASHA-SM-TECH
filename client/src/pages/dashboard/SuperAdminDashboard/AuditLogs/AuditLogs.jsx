import SuperAdminLayout from '../components/SuperAdminLayout';

export default function AuditLogs() {
  return <SuperAdminLayout pageTitle="Audit Logs"><div className="page-card"><div className="page-header-row"><div><div className="section-kicker">Compliance</div><h2>Audit Logs</h2></div></div><div className="resource-empty">No recent activity</div></div></SuperAdminLayout>;
}
