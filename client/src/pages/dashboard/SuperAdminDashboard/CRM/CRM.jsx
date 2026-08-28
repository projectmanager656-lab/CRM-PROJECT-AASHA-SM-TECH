import React, { useState } from 'react';
import SuperAdminLayout from '../components/SuperAdminLayout';
import Leads from '../../AdminDashboard/Leads/Leads';
import Clients from '../../AdminDashboard/Clients/Clients';

export default function CRM() {
  const [tab, setTab] = useState('leads');
  const FragmentLayout = ({ children }) => <>{children}</>;

  return (
    <SuperAdminLayout pageTitle="CRM">
      <div className="admin-page">
        <div className="admin-page-header">
          <h2>Customer Relationship Management</h2>
          <div className="admin-tabs" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button 
              className={`action-btn ${tab === 'leads' ? 'primary' : 'view'}`} 
              onClick={() => setTab('leads')}
            >
              Leads
            </button>
            <button 
              className={`action-btn ${tab === 'clients' ? 'primary' : 'view'}`} 
              onClick={() => setTab('clients')}
            >
              Clients
            </button>
          </div>
        </div>
        
        <div style={{ marginTop: '2rem' }}>
          {tab === 'leads' && <Leads Layout={FragmentLayout} />}
          {tab === 'clients' && <Clients Layout={FragmentLayout} />}
        </div>
      </div>
    </SuperAdminLayout>
  );
}
