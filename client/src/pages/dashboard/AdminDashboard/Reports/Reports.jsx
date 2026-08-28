import AdminLayout from '../components/AdminLayout';
import './Reports.css';

const reportTypes = [
  { id: 'REP-001', type: 'Employee Report', description: 'Overview of all employees and their details' },
  { id: 'REP-002', type: 'Attendance Report', description: 'Monthly attendance summary by employee' },
  { id: 'REP-003', type: 'Leave Report', description: 'Leave requests and approvals' },
  { id: 'REP-004', type: 'Payroll Report', description: 'Salary and payroll details' },
  { id: 'REP-005', type: 'Project Report', description: 'Project status and progress' },
  { id: 'REP-006', type: 'Task Report', description: 'Task completion and performance metrics' },
];

export default function Reports({ Layout = AdminLayout }) {
  return (
    <Layout pageTitle="Reports">
      <div className="admin-page">
        <div className="admin-page-header">
          <h2>Report Generator</h2>
        </div>

        <div className="report-filters admin-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700' }}>Report Type</label>
              <select style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <option>Select Report Type</option>
                {reportTypes.map((rep) => (
                  <option key={rep.id}>{rep.type}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700' }}>Date Range</label>
              <input type="month" style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700' }}>Department</label>
              <select style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <option>All Departments</option>
                <option>Engineering</option>
                <option>HR</option>
                <option>Sales</option>
              </select>
            </div>
          </div>
          <button type="button" className="primary-btn" style={{ marginTop: '1rem' }}>Generate Report</button>
          <button type="button" className="secondary-btn" style={{ marginTop: '1rem', marginLeft: '0.5rem' }}>Export PDF</button>
        </div>

        <div className="reports-grid">
          {reportTypes.map((rep) => (
            <article key={rep.id} className="report-card admin-card">
              <h3>{rep.type}</h3>
              <p>{rep.description}</p>
              <button className="secondary-btn" style={{ width: '100%', marginTop: '1rem' }}>Generate</button>
            </article>
          ))}
        </div>
      </div>
    </Layout>
  );
}
