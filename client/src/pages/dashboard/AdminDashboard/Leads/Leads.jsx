import AdminResourceManager from '../components/AdminResourceManager';

const fields = [
  { name: 'name', label: 'Name', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'phone', label: 'Phone' },
  { name: 'company', label: 'Company' },
  { name: 'source', label: 'Source' },
  { name: 'owner', label: 'Assigned To', type: 'user', required: true },
  { name: 'sharedWith', label: 'Share With', type: 'user', multiple: true },
  { name: 'status', label: 'Status', type: 'select', options: ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'], defaultValue: 'New' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
  { name: 'decisionMaker', label: 'Owner / Decision Maker' },
  { name: 'location', label: 'Location' },
  { name: 'category', label: 'Category' },
  { name: 'websiteStatus', label: 'Website Status', type: 'select', options: ['Not Checked', 'Active', 'Inactive', 'Not Available'], defaultValue: 'Not Checked' },
  { name: 'instagramStatus', label: 'Instagram Status', type: 'select', options: ['Not Checked', 'Active', 'Inactive', 'Not Available'], defaultValue: 'Not Checked' },
  { name: 'gmbStatus', label: 'GMB Status', type: 'select', options: ['Not Checked', 'Active', 'Inactive', 'Not Available'], defaultValue: 'Not Checked' },
  { name: 'requirement', label: 'Requirement', type: 'textarea' },
  { name: 'lastContact', label: 'Last Contact', type: 'date' },
  { name: 'nextFollowUp', label: 'Next Follow-up', type: 'date' },
  { name: 'proposalValue', label: 'Proposal Value', type: 'number' },
  { name: 'result', label: 'Result' },
];

const columns = [
  { key: 'name', label: 'Lead' },
  { key: 'company', label: 'Company' },
  { key: 'owner', label: 'Assigned To' },
  { key: 'source', label: 'Source' },
  { key: 'status', label: 'Status' },
];

const leadKpis = (leads) => {
  const total = leads.length;
  const newLeads = leads.filter((l) => l.status === 'New').length;
  const qualified = leads.filter((l) => l.status === 'Qualified').length;
  const converted = leads.filter((l) => l.status === 'Converted').length;

  return [
    {
      label: 'TOTAL LEADS',
      value: total,
      bg: '#eff6ff',
      color: '#1d4ed8',
      borderColor: '#bfdbfe',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20V10" />
          <path d="M18 20V4" />
          <path d="M6 20v-4" />
        </svg>
      ),
    },
    {
      label: 'NEW',
      value: newLeads,
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
      label: 'QUALIFIED',
      value: qualified,
      bg: '#f5f3ff',
      color: '#7c3aed',
      borderColor: '#ddd6fe',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
    },
    {
      label: 'CONVERTED',
      value: converted,
      bg: '#ecfdf5',
      color: '#047857',
      borderColor: '#a7f3d0',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <polyline points="16 11 18 13 22 9" />
        </svg>
      ),
    },
  ];
};

const leadFilters = [
  {
    name: 'source',
    label: 'All Sources',
    options: ['Website', 'Referral', 'LinkedIn', 'Cold Call', 'Email', 'Other'],
  },
];

export default function Leads({ Layout }) {
  return (
    <AdminResourceManager
      title="Leads"
      singular="Lead"
      pageHeading="Leads Management"
      description="Track, qualify, and convert organizational business leads."
      createBtnText="+ Add Lead"
      searchPlaceholder="Search leads by name, company, email, source..."
      endpoint="/leads"
      fields={fields}
      columns={columns}
      kpis={leadKpis}
      filters={leadFilters}
      Layout={Layout}
    />
  );
}
