import { useEffect, useMemo, useState } from 'react';
import apiClient from '../../../../services/apiClient';
import SuperAdminLayout from '../components/SuperAdminLayout';

const errorMessage = (error) => error.response?.data?.message || 'Unable to load departments.';
const managerName = (manager) => manager ? `${manager.firstName || ''} ${manager.lastName || ''}`.trim() || manager.email || 'Not assigned' : 'Not assigned';
const formattedDate = (date) => date ? new Date(date).toLocaleDateString() : '—';

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState(null);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/admin/departments');
      setDepartments(response.data.data || []);
      setError('');
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDepartments(); }, []);

  const visibleDepartments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? departments.filter((department) => [department.name, department.description, managerName(department.manager), department.status].some((value) => String(value || '').toLowerCase().includes(term))) : departments;
  }, [departments, search]);

  const activeCount = departments.filter((department) => department.status === 'Active').length;
  const inactiveCount = departments.filter((department) => department.status === 'Inactive').length;

  return <SuperAdminLayout pageTitle="Departments">
    <section className="page-card">
      <div className="page-header-row">
        <div>
          <div className="section-kicker">Organisation oversight</div>
          <h2>Department Management</h2>
          <p className="section-subtitle">Live department records created and maintained in Admin Department Management.</p>
        </div>
        <button type="button" className="secondary-button" onClick={loadDepartments} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>

      <div className="department-stats" aria-label="Department summary">
        <div><span>Total Departments</span><strong>{departments.length}</strong></div>
        <div><span>Active Departments</span><strong>{activeCount}</strong></div>
        <div><span>Inactive Departments</span><strong>{inactiveCount}</strong></div>
      </div>

      <input className="superadmin-resource-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search departments" />
      {error && <div className="resource-message error">{error}</div>}
      {loading ? <div className="resource-empty">Loading departments...</div> : visibleDepartments.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Department Name</th><th>Description</th><th>Manager</th><th>Members</th><th>Status</th><th>Created Date</th><th>Action</th></tr></thead><tbody>{visibleDepartments.map((department) => <tr key={department._id}><td>{department.name}</td><td>{department.description || '—'}</td><td>{managerName(department.manager)}</td><td>{department.employeeCount || 0}</td><td><span className={`status-pill status-${String(department.status || '').toLowerCase()}`}>{department.status}</span></td><td>{formattedDate(department.createdAt)}</td><td><button type="button" className="table-action-link" onClick={() => setViewing(department)}>View Details</button></td></tr>)}</tbody></table></div> : <div className="resource-empty">No departments found.</div>}
    </section>

    {viewing && <div className="department-detail-backdrop" role="dialog" aria-modal="true" aria-label="Department details"><div className="department-detail-modal"><div className="department-detail-header"><h3>Department Details</h3><button type="button" onClick={() => setViewing(null)} aria-label="Close">×</button></div><div className="department-detail-grid"><div><span>Department Name</span><strong>{viewing.name}</strong></div><div><span>Status</span><strong>{viewing.status}</strong></div><div><span>Description</span><strong>{viewing.description || '—'}</strong></div><div><span>Manager</span><strong>{managerName(viewing.manager)}</strong></div><div><span>Members Count</span><strong>{viewing.employeeCount || 0}</strong></div><div><span>Created Date</span><strong>{formattedDate(viewing.createdAt)}</strong></div></div></div></div>}
  </SuperAdminLayout>;
}
