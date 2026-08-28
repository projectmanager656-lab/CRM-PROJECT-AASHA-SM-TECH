import ResourceModule from '../components/ResourceModule';
import { PROJECT_CATEGORIES } from '../../../../../config/departments';
const config = {
  singular: 'Project',
  plural: 'Projects',
  endpoint: '/projects',
  basePath: '/user/projects',
  permission: ['projects', 'projects'],
  canCreate: false,
  canDelete: false,
  statuses: ['Planning', 'Active', 'On Hold', 'Completed'],
  fields: [
    { name: 'name', label: 'Project Name', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'category', label: 'Project Category', type: 'select', options: PROJECT_CATEGORIES, defaultValue: 'Tech', required: true },
    { name: 'status', label: 'Status', type: 'select', options: ['Planning', 'Active', 'On Hold', 'Completed'], defaultValue: 'Planning' },
    { name: 'startDate', label: 'Start Date', type: 'date' },
    { name: 'dueDate', label: 'Due Date', type: 'date' }
  ],
  columns: [
    { key: 'name', label: 'Project' },
    { key: 'category', label: 'Category' },
    { key: 'status', label: 'Status' },
    { key: 'startDate', label: 'Start', format: v => v ? new Date(v).toLocaleDateString() : '-' },
    { key: 'dueDate', label: 'Due', format: v => v ? new Date(v).toLocaleDateString() : '-' }
  ],
  renderCard: (record, onClick) => {
    const progress = record.status === 'Completed' ? '100%' : record.status === 'Active' ? '65%' : record.status === 'On Hold' ? '40%' : '15%';
    return (
      <div key={record._id} onClick={onClick} style={{ border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '16px', padding: '1.1rem', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.8rem' }}>
          <div>
            <h4 style={{ margin: '0 0 0.2rem', color: '#0f172a', fontSize: '1rem' }}>{record.name}</h4>
            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{record.category}</span>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.3rem 0.6rem', borderRadius: '999px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', fontSize: '0.75rem', fontWeight: 'bold' }}>{record.status}</span>
        </div>
        <div style={{ marginTop: '1rem', height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
          <span style={{ display: 'block', height: '100%', width: progress, background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)', borderRadius: 'inherit' }}></span>
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
          <span>Start: {record.startDate ? new Date(record.startDate).toLocaleDateString() : '-'}</span>
          <span>Due: {record.dueDate ? new Date(record.dueDate).toLocaleDateString() : '-'}</span>
        </div>
      </div>
    );
  }
};
export default function Projects() { return <ResourceModule config={config} />; }
