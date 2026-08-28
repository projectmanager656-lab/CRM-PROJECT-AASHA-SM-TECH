import ResourceModule from '../components/ResourceModule';
const config = {
  singular: 'Task',
  plural: 'Tasks',
  endpoint: '/tasks',
  basePath: '/user/tasks',
  permission: ['projects', 'tasks'],
  statusEndpoint: 'status',
  statuses: ['Pending', 'In Progress', 'Completed', 'Overdue'],
  fields: [
    { name: 'title', label: 'Title', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High'], defaultValue: 'Medium' },
    { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'In Progress', 'Completed', 'Overdue'], defaultValue: 'Pending' },
    { name: 'dueDate', label: 'Due Date', type: 'date' }
  ],
  columns: [
    { key: 'title', label: 'Task' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
    { key: 'dueDate', label: 'Due', format: (v) => v ? new Date(v).toLocaleDateString() : '-' }
  ],
  renderCard: (record, onClick) => {
    let priorityColor = '#b45309';
    let priorityBg = 'rgba(245, 158, 11, 0.12)';
    if (record.priority === 'High') { priorityColor = '#b91c1c'; priorityBg = 'rgba(239, 68, 68, 0.12)'; }
    if (record.priority === 'Low') { priorityColor = '#047857'; priorityBg = 'rgba(16, 185, 129, 0.12)'; }

    return (
      <div key={record._id} onClick={onClick} style={{ border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '16px', padding: '1.1rem', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem' }}>
          <div style={{ width: '26px', height: '26px', minWidth: '26px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.09)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
            {record.status === 'Completed' ? '✓' : '•'}
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 0.4rem', color: '#0f172a', fontSize: '1rem', textDecoration: record.status === 'Completed' ? 'line-through' : 'none' }}>{record.title}</h4>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.5rem', borderRadius: '999px', background: priorityBg, color: priorityColor, fontSize: '0.68rem', fontWeight: 'bold' }}>{record.priority} Priority</span>
          </div>
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.75rem' }}>
          <strong style={{ color: record.status === 'Completed' ? '#059669' : '#2563eb' }}>{record.status}</strong>
          <span>{record.dueDate ? new Date(record.dueDate).toLocaleDateString() : 'No date'}</span>
        </div>
      </div>
    );
  }
};
export default function Tasks() { return <ResourceModule config={config} />; }
