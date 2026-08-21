import SuperAdminLayout from '../components/SuperAdminLayout';

export default function ActivityLogs() {
  return <SuperAdminLayout pageTitle="Activity Logs"><div className="page-card"><div className="page-header-row"><div><div className="section-kicker">Audit</div><h2>Activity Logs</h2></div></div><div className="resource-empty">No recent activity</div></div></SuperAdminLayout>;
}
