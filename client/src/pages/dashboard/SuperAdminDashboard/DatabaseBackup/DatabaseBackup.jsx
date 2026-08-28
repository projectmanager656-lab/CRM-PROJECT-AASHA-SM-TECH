import SuperAdminLayout from '../components/SuperAdminLayout';

export default function DatabaseBackup() {
  return (
    <SuperAdminLayout pageTitle="Database Backup">
      <div className="page-card">
        <div className="page-header-row">
          <div>
            <div className="section-kicker">Infrastructure</div>
            <h2>Database Backup</h2>
          </div>
        </div>

        <div className="resource-empty" style={{ marginTop: '2rem' }}>
          <h3>Not Supported by Backend API</h3>
          <p>The backend does not currently expose a Database Backup controller or utility endpoint. No data can be displayed.</p>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
