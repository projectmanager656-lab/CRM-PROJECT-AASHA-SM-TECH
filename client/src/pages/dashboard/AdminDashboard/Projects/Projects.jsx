import AdminResourceManager from '../components/AdminResourceManager';
import { PROJECT_CATEGORIES } from '../../../../config/departments';

const fields = [
  { name: 'name', label: 'Project Name', required: true },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'category', label: 'Project Category', type: 'select', options: PROJECT_CATEGORIES, defaultValue: 'Tech', required: true },
  { name: 'owner', label: 'Assigned To', type: 'user', required: true },
  { name: 'sharedWith', label: 'Share With', type: 'user', multiple: true },
  { name: 'status', label: 'Status', type: 'select', options: ['Planning', 'Active', 'On Hold', 'Completed'], defaultValue: 'Planning' },
  { name: 'startDate', label: 'Start Date', type: 'date' },
  { name: 'dueDate', label: 'Due Date', type: 'date' },
];

const columns = [
  { key: 'name', label: 'Project' },
  { key: 'category', label: 'Category' },
  { key: 'owner', label: 'Assigned To' },
  { key: 'status', label: 'Status' },
  { key: 'startDate', label: 'Start', format: (v) => (v ? new Date(v).toLocaleDateString() : '—') },
  { key: 'dueDate', label: 'Due', format: (v) => (v ? new Date(v).toLocaleDateString() : '—') },
];

const projectKpis = (projects) => {
  const total = projects.length;
  const active = projects.filter((p) => p.status === 'Active' || p.status === 'In Progress').length;
  const planning = projects.filter((p) => p.status === 'Planning').length;
  const onHoldCompleted = projects.filter((p) => p.status === 'On Hold' || p.status === 'Completed').length;

  return [
    {
      label: 'TOTAL PROJECTS',
      value: total,
      bg: '#eff6ff',
      color: '#1d4ed8',
      borderColor: '#bfdbfe',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      ),
    },
    {
      label: 'ACTIVE',
      value: active,
      bg: '#ecfdf5',
      color: '#047857',
      borderColor: '#a7f3d0',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      label: 'PLANNING',
      value: planning,
      bg: '#f5f3ff',
      color: '#7c3aed',
      borderColor: '#ddd6fe',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      ),
    },
    {
      label: 'ON HOLD / COMPLETED',
      value: onHoldCompleted,
      bg: '#fffbeb',
      color: '#b45309',
      borderColor: '#fde68a',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
    },
  ];
};

const projectFilters = [
  {
    name: 'category',
    label: 'All Categories',
    options: PROJECT_CATEGORIES,
  },
];

export default function Projects({ Layout }) {
  return (
    <AdminResourceManager
      title="Projects"
      singular="Project"
      pageHeading="Projects Management"
      description="Plan, monitor and manage organizational projects."
      createBtnText="+ Add Project"
      searchPlaceholder="Search projects by name, category, assignee..."
      endpoint="/projects"
      fields={fields}
      columns={columns}
      kpis={projectKpis}
      filters={projectFilters}
      Layout={Layout}
    />
  );
}
