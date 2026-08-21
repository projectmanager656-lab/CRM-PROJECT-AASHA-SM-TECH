import SuperAdminLayout from '../components/SuperAdminLayout';

const reports = [
  { name: 'Monthly Profit Summary', period: 'August 2026' },
  { name: 'Employee Attendance Report', period: 'This Month' },
  { name: 'Project Delivery Analysis', period: 'Quarterly' },
];

export default function Reports() {
  return (
    <SuperAdminLayout pageTitle="Reports">
      <div className="page-card">
        <div className="page-header-row">
          <div>
            <div className="section-kicker">Insights</div>
            <h2>Reports</h2>
          </div>
          <button type="button" className="primary-button">Generate Report</button>
        </div>

        <div className="page-list">
          {reports.map((report) => (
            <div key={report.name} className="list-item">
              <div className="list-item-main">
                <strong>{report.name}</strong>
                <span>{report.period}</span>
              </div>
              <div className="list-actions">
                <button type="button">Download</button>
                <button type="button">View</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SuperAdminLayout>
  );
}
