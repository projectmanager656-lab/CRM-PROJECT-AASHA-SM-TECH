import AdminResourceManager from '../components/AdminResourceManager';

const fields = [
  { name: 'name', label: 'Client / Company Name', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'phone', label: 'Phone' },
  { name: 'company', label: 'Organization' },
  { name: 'address', label: 'Address', type: 'textarea' },
  { name: 'owner', label: 'Assigned To', type: 'user', required: true },
  { name: 'sharedWith', label: 'Share With', type: 'user', multiple: true },
  { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive', 'Prospect'], defaultValue: 'Active' },
];

const columns = [
  { key: 'name', label: 'Client' },
  { key: 'company', label: 'Company' },
  { key: 'owner', label: 'Assigned To' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status' },
];

const clientKpis = (clients) => {
  const total = clients.length;
  const active = clients.filter((c) => c.status === 'Active').length;
  const prospects = clients.filter((c) => c.status === 'Prospect').length;
  const inactive = clients.filter((c) => c.status === 'Inactive').length;

  return [
    {
      label: 'TOTAL CLIENTS',
      value: total,
      bg: '#eff6ff',
      color: '#1d4ed8',
      borderColor: '#bfdbfe',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
    },
    {
      label: 'PROSPECTS',
      value: prospects,
      bg: '#fffbeb',
      color: '#b45309',
      borderColor: '#fde68a',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      label: 'INACTIVE',
      value: inactive,
      bg: '#fef2f2',
      color: '#dc2626',
      borderColor: '#fecaca',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ),
    },
  ];
};

export default function Clients({ Layout }) {
  return (
    <AdminResourceManager
      title="Clients"
      singular="Client"
      pageHeading="Clients Management"
      description="Manage company client directory, contacts, and active engagements."
      createBtnText="+ Add Client"
      searchPlaceholder="Search clients by name, company, email..."
      endpoint="/clients"
      fields={fields}
      columns={columns}
      kpis={clientKpis}
      Layout={Layout}
    />
  );
}
