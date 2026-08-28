import React, { useState } from 'react';
import SuperAdminLayout from '../components/SuperAdminLayout';
import ProjectsAdmin from '../../AdminDashboard/Projects/Projects';
import TasksAdmin from '../../AdminDashboard/Tasks/Tasks';

export default function Projects() {
  const [tab, setTab] = useState('projects');
  const FragmentLayout = ({ children }) => <>{children}</>;

  return (
    <SuperAdminLayout pageTitle="Projects & Tasks">
      <div className="admin-page">
        <div className="admin-page-header">
          <h2>Project Management</h2>
          <div className="admin-tabs" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button 
              className={`action-btn ${tab === 'projects' ? 'primary' : 'view'}`} 
              onClick={() => setTab('projects')}
            >
              Projects
            </button>
            <button 
              className={`action-btn ${tab === 'tasks' ? 'primary' : 'view'}`} 
              onClick={() => setTab('tasks')}
            >
              Tasks
            </button>
          </div>
        </div>
        
        <div style={{ marginTop: '2rem' }}>
          {tab === 'projects' && <ProjectsAdmin Layout={FragmentLayout} />}
          {tab === 'tasks' && <TasksAdmin Layout={FragmentLayout} />}
        </div>
      </div>
    </SuperAdminLayout>
  );
}
