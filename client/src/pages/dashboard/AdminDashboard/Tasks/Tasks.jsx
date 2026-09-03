import AdminResourceManager from '../components/AdminResourceManager';

const fields = [
  { name: 'title', label: 'Task Title', required: true },
  { name: 'description', label: 'Description', type: 'textarea', required: true },
  { name: 'assignedTo', label: 'Assign To', type: 'user', multiple: true, required: true },
  { name: 'department', label: 'Department', type: 'select', options: ['HR', 'Sales', 'Business Development', 'Finance'], required: true },
  { name: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High'], defaultValue: 'Medium' },
  { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'In Progress', 'Completed', 'Overdue'], defaultValue: 'Pending' },
  { name: 'startDate', label: 'Start Date', type: 'date', required: true },
  { name: 'dueDate', label: 'Due Date', type: 'date', required: true }
];

const columns = [
  { key: 'title', label: 'Task' },
  { key: 'assignedTo', label: 'Assigned To' },
  { key: 'department', label: 'Department' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'dueDate', label: 'Due', format: v => v ? new Date(v).toLocaleDateString() : '-' }
];

const renderTasksOverview = (tasks) => {
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const inProgress = tasks.filter(t => t.status === 'In Progress').length;
  const pending = tasks.filter(t => t.status === 'Pending').length;
  const overdue = tasks.filter(t => t.status === 'Overdue').length;
  
  return (
    <div className="admin-overview-panel">
      <h3>Task Analytics</h3>
      <div className="admin-overview-grid">
        <div className="admin-overview-card primary">
          <span>Total Tasks</span>
          <strong>{tasks.length}</strong>
        </div>
        <div className="admin-overview-card success">
          <span>Completed</span>
          <strong>{completed}</strong>
        </div>
        <div className="admin-overview-card warning">
          <span>In Progress</span>
          <strong>{inProgress}</strong>
        </div>
        <div className="admin-overview-card info">
          <span>Pending / Overdue</span>
          <strong>{pending} / {overdue}</strong>
        </div>
      </div>
    </div>
  );
};

export default function Tasks({ Layout }) {
  return (
    <AdminResourceManager 
      title="Tasks" 
      singular="Task" 
      endpoint="/tasks" 
      fields={fields} 
      columns={columns} 
      Layout={Layout}
      renderOverview={renderTasksOverview}
    />
  );
}
