import SuperAdminLayout from '../components/SuperAdminLayout';

export default function Settings() {
  return (
    <SuperAdminLayout pageTitle="Settings">
      <div className="page-card">
        <div className="page-header-row">
          <div>
            <div className="section-kicker">Preferences</div>
            <h2>Settings</h2>
          </div>
          <button type="button" className="primary-button">Update Profile</button>
        </div>

        <div className="card-grid">
          <div className="info-card">
            <div className="chart-header"><h3>Account</h3></div>
            <div className="form-block">
              <div className="field"><label>Full Name</label><input defaultValue="Super Admin" /></div>
              <div className="field"><label>Email</label><input defaultValue="admin@company.com" /></div>
            </div>
          </div>

          <div className="info-card">
            <div className="chart-header"><h3>Preferences</h3></div>
            <div className="form-block">
              <div className="field"><label>Theme</label><select><option>Dark</option><option>Light</option></select></div>
              <div className="field"><label>Notifications</label><select><option>Enabled</option><option>Disabled</option></select></div>
            </div>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
