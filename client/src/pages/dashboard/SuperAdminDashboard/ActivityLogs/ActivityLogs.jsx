import SuperAdminLayout from '../components/SuperAdminLayout';

export default function ActivityLogs() {
  return (
    <SuperAdminLayout pageTitle="Activity Logs">
      <div className="page-card">
        <div className="page-header-row">
          <div>
            <div className="section-kicker">Audit</div>
            <h2>Activity Logs</h2>
          </div>
        </div>
        <div className="resource-empty" style={{ marginTop: '2rem' }}>
          <h3>Not Supported by Backend API</h3>
          <p>The backend does not currently expose an Activity Logs controller or retrieval endpoint. No activity history is available.</p>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
