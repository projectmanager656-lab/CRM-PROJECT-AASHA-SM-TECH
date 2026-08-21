import AdminLayout from '../components/AdminLayout';
import './Documents.css';

const documents = [
  { id: 'DOC-001', name: 'Employee Contract.pdf', category: 'Contract', uploadedBy: 'Sarah Lee', date: '2026-08-10', status: 'Verified' },
  { id: 'DOC-002', name: 'Q3 Financial Report.xlsx', category: 'Report', uploadedBy: 'Marcus Johnson', date: '2026-08-12', status: 'Verified' },
  { id: 'DOC-003', name: 'Training Certificate.pdf', category: 'Certificate', uploadedBy: 'Alicia Thompson', date: '2026-08-08', status: 'Pending Review' },
];

export default function Documents() {
  return (
    <AdminLayout pageTitle="Documents">
      <div className="admin-page">
        <div className="admin-page-header">
          <h2>Document Management</h2>
          <div className="admin-page-header-actions">
            <button type="button" className="ghost-btn">Filter</button>
            <button type="button" className="primary-btn">Upload Document</button>
          </div>
        </div>

        <div className="documents-table admin-card">
          <table>
            <thead>
              <tr>
                <th>Document ID</th>
                <th>Name</th>
                <th>Category</th>
                <th>Uploaded By</th>
                <th>Upload Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.id}</td>
                  <td>{doc.name}</td>
                  <td>{doc.category}</td>
                  <td>{doc.uploadedBy}</td>
                  <td>{doc.date}</td>
                  <td><span className={`doc-status ${doc.status.toLowerCase().replace(' ', '-')}`}>{doc.status}</span></td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn view">View</button>
                      <button className="action-btn edit">Download</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
