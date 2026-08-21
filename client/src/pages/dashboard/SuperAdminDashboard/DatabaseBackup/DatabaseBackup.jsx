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
          <button type="button" className="primary-button">Run Backup</button>
        </div>

        <div className="card-grid">
          <div className="info-card">
            <div className="chart-header"><h3>Backup Status</h3></div>
            <div className="activity-list">
              <div className="activity-item"><span>Last full backup</span><small>Today 02:00 AM</small></div>
              <div className="activity-item"><span>Archive retention</span><small>30 days</small></div>
              <div className="activity-item"><span>Backup size</span><small>2.45 GB</small></div>
            </div>
          </div>

          <div className="info-card">
            <div className="chart-header"><h3>Restore Health</h3></div>
            <div className="activity-list">
              <div className="activity-item"><span>Integrity test</span><small>Passed</small></div>
              <div className="activity-item"><span>Offsite copy</span><small>Synced</small></div>
              <div className="activity-item"><span>Recovery time objective</span><small>2 hours</small></div>
            </div>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
