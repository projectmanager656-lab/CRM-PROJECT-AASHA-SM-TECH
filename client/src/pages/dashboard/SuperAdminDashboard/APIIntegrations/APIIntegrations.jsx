import SuperAdminLayout from '../components/SuperAdminLayout';

const integrations = [
  { name: 'Stripe', status: 'Connected' },
  { name: 'Twilio', status: 'Connected' },
  { name: 'Slack', status: 'Connected' },
];

export default function APIIntegrations() {
  return (
    <SuperAdminLayout pageTitle="API Integrations">
      <div className="page-card">
        <div className="page-header-row">
          <div>
            <div className="section-kicker">System</div>
            <h2>API Integrations</h2>
          </div>
          <button type="button" className="primary-button">Add Integration</button>
        </div>

        <div className="page-list">
          {integrations.map((integration) => (
            <div key={integration.name} className="list-item">
              <div className="list-item-main">
                <strong>{integration.name}</strong>
                <small>Webhook + sync enabled</small>
              </div>
              <div className="list-actions">
                <span className="module-pill">{integration.status}</span>
                <button type="button">Manage</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SuperAdminLayout>
  );
}
