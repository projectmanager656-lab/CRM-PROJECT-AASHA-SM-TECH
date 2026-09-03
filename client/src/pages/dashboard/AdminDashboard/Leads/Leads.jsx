import AdminResourceManager from '../components/AdminResourceManager';

const fields=[{name:'name',label:'Name',required:true},{name:'email',label:'Email',type:'email',required:true},{name:'phone',label:'Phone'},{name:'company',label:'Company'},{name:'source',label:'Source'},{name:'owner',label:'Assigned To',type:'user',required:true},{name:'sharedWith',label:'Share With',type:'user',multiple:true},{name:'status',label:'Status',type:'select',options:['New','Contacted','Qualified','Converted','Lost'],defaultValue:'New'},{name:'notes',label:'Notes',type:'textarea'},{name:'decisionMaker',label:'Owner / Decision Maker'},{name:'location',label:'Location'},{name:'category',label:'Category'},{name:'websiteStatus',label:'Website Status',type:'select',options:['Not Checked','Active','Inactive','Not Available'],defaultValue:'Not Checked'},{name:'instagramStatus',label:'Instagram Status',type:'select',options:['Not Checked','Active','Inactive','Not Available'],defaultValue:'Not Checked'},{name:'gmbStatus',label:'GMB Status',type:'select',options:['Not Checked','Active','Inactive','Not Available'],defaultValue:'Not Checked'},{name:'requirement',label:'Requirement',type:'textarea'},{name:'lastContact',label:'Last Contact',type:'date'},{name:'nextFollowUp',label:'Next Follow-up',type:'date'},{name:'proposalValue',label:'Proposal Value',type:'number'},{name:'result',label:'Result'}];
const columns=[{key:'name',label:'Lead'},{key:'company',label:'Company'},{key:'owner',label:'Assigned To'},{key:'source',label:'Source'},{key:'status',label:'Status'}];

const renderLeadsOverview = (leads) => {
  const newLeads = leads.filter(l => l.status === 'New').length;
  const contacted = leads.filter(l => l.status === 'Contacted').length;
  const qualified = leads.filter(l => l.status === 'Qualified').length;
  const converted = leads.filter(l => l.status === 'Converted').length;
  
  return (
    <div className="admin-overview-panel">
      <h3>Pipeline Summary</h3>
      <div className="admin-overview-grid">
        <div className="admin-overview-card primary">
          <span>Total Leads</span>
          <strong>{leads.length}</strong>
        </div>
        <div className="admin-overview-card info">
          <span>New / Contacted</span>
          <strong>{newLeads} / {contacted}</strong>
        </div>
        <div className="admin-overview-card warning">
          <span>Qualified</span>
          <strong>{qualified}</strong>
        </div>
        <div className="admin-overview-card success">
          <span>Converted (Won)</span>
          <strong>{converted}</strong>
        </div>
      </div>
    </div>
  );
};

export default function Leads({ Layout }) {
  return (
    <AdminResourceManager 
      title="Leads" 
      singular="Lead" 
      endpoint="/leads" 
      fields={fields} 
      columns={columns} 
      Layout={Layout}
      renderOverview={renderLeadsOverview}
    />
  );
}
