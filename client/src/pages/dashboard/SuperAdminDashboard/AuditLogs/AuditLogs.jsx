import SuperAdminLayout from '../components/SuperAdminLayout';

export default function AuditLogs() {
  return (
    <SuperAdminLayout pageTitle="Audit Logs">
      <div className="page-card">
        <div className="page-header-row">
          <div>
            <div className="section-kicker">Compliance</div>
            <h2>Audit Logs</h2>
          </div>
        </div>
        <div className="resource-empty" style={{ marginTop: '2rem' }}>
          <h3>Not Supported by Backend API</h3>
          <p>The backend does not currently expose an Audit Logs controller or retrieval endpoint. No audit history is available.</p>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
