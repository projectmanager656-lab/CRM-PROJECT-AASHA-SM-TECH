import { useEffect, useState } from 'react';
import apiClient from '../../../../services/apiClient';
import SuperAdminLayout from '../components/SuperAdminLayout';

export default function Modules() {
  const [modules, setModules] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { apiClient.get('/rbac/modules').then((response) => setModules(response.data.data || [])).catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load modules.')).finally(() => setLoading(false)); }, []);
  return (
    <SuperAdminLayout pageTitle="Modules">
      <div className="page-card">
        <div className="page-header-row">
          <div>
            <div className="section-kicker">Platform</div>
            <h2>Modules</h2>
          </div>
        </div>
        {error && <div className="resource-message error">{error}</div>}{loading ? <div className="resource-empty">Loading...</div> : modules.length ? <div className="page-list">
          {modules.map((module) => (
            <div key={module._id} className="list-item">
              <div className="list-item-main">
                <strong>{module.name}</strong>
                <small>{module.description}</small>
              </div>
              <div className="list-actions">
                <span className="module-pill">{module.status}</span>
              </div>
            </div>
          ))}
        </div> : <div className="resource-empty">No modules found.</div>}
      </div>
    </SuperAdminLayout>
  );
}
