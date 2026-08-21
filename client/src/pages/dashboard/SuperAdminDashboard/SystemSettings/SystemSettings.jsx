import SuperAdminLayout from '../components/SuperAdminLayout';

export default function SystemSettings() {
  return (
    <SuperAdminLayout pageTitle="System Settings">
      <div className="page-card">
        <div className="page-header-row">
          <div>
            <div className="section-kicker">System</div>
            <h2>System Settings</h2>
          </div>
          <button type="button" className="primary-button">Save Changes</button>
        </div>

        <div className="card-grid">
          <div className="info-card">
            <div className="chart-header">
              <h3>General Settings</h3>
            </div>
            <div className="form-block">
              <div className="field"><label>Company Name</label><input defaultValue="IT Company Management System" /></div>
              <div className="field"><label>Default Time Zone</label><input defaultValue="UTC+05:30" /></div>
              <div className="field"><label>Language</label><select><option>English</option><option>Hindi</option></select></div>
            </div>
          </div>

          <div className="info-card">
            <div className="chart-header">
              <h3>Security</h3>
            </div>
            <div className="form-block">
              <div className="field"><label>Session Timeout</label><input defaultValue="30 minutes" /></div>
              <div className="field"><label>2FA Enforcement</label><select><option>Enabled</option><option>Disabled</option></select></div>
              <div className="field"><label>Password Policy</label><input defaultValue="Strong" /></div>
            </div>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
