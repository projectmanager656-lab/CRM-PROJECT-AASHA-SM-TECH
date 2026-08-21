import AdminLayout from '../components/AdminLayout';
import './Settings.css';

const settings = [
  { id: 'SET-001', title: 'Account Security', icon: '🔒', description: 'Manage password, two-factor authentication, and security settings.' },
  { id: 'SET-002', title: 'Notification Preferences', icon: '🔔', description: 'Control email alerts, desktop notifications, and in-app notifications.' },
  { id: 'SET-003', title: 'Appearance & Theme', icon: '🎨', description: 'Change interface theme, language, and display preferences.' },
  { id: 'SET-004', title: 'Privacy & Data', icon: '🔐', description: 'Review data collection, sharing preferences, and privacy settings.' },
  { id: 'SET-005', title: 'API Keys & Integration', icon: '⚙️', description: 'Manage API keys, webhooks, and third-party integrations.' },
  { id: 'SET-006', title: 'System Settings', icon: '🛠️', description: 'Configure system-wide settings, backup, and maintenance options.' },
];

export default function Settings() {
  return (
    <AdminLayout pageTitle="Settings">
      <div className="admin-page">
        <div className="admin-page-header">
          <h2>Admin Settings</h2>
          <div className="admin-page-header-actions">
            <button type="button" className="ghost-btn">Reset to Default</button>
            <button type="button" className="primary-btn">Save Settings</button>
          </div>
        </div>

        <div className="settings-grid">
          {settings.map((setting) => (
            <article key={setting.id} className="settings-card admin-card">
              <span className="settings-icon">{setting.icon}</span>
              <div>
                <h3>{setting.title}</h3>
                <p>{setting.description}</p>
              </div>
              <button type="button" className="secondary-btn">Configure</button>
            </article>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
