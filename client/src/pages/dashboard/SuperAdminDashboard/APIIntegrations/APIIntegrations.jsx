import SuperAdminLayout from '../components/SuperAdminLayout';

export default function APIIntegrations() {
  return (
    <SuperAdminLayout pageTitle="API Integrations">
      <div className="page-card">
        <div className="page-header-row">
          <div>
            <div className="section-kicker">System</div>
            <h2>API Integrations</h2>
          </div>
        </div>

        <div className="resource-empty" style={{ marginTop: '2rem' }}>
          <h3>Not Supported by Backend API</h3>
          <p>The backend does not currently expose an API Integrations controller. No active Webhooks or third-party API configurations are managed here.</p>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
