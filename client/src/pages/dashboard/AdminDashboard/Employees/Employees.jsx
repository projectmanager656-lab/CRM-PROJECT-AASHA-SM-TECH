import AdminResourceManager from '../components/AdminResourceManager';

const fields=[{name:'firstName',label:'First Name',required:true},{name:'lastName',label:'Last Name',required:true},{name:'email',label:'Email',type:'email',required:true},{name:'password',label:'Password',type:'password',required:true,createOnly:true},{name:'phone',label:'Phone'},{name:'department',label:'Department',type:'select',optionsEndpoint:'/departments'},{name:'designation',label:'Designation'},{name:'isActive',label:'Status',type:'select',options:['true','false'],defaultValue:'true'}];
const columns=[{key:'firstName',label:'Name',value:x=>`${x.firstName||''} ${x.lastName||''}`},{key:'email',label:'Email'},{key:'phone',label:'Phone'},{key:'department',label:'Department'},{key:'designation',label:'Designation'},{key:'isActive',label:'Status',format:v=>v?'Active':'Inactive'}];
const filters=[{name:'department',label:'All Departments',optionsEndpoint:'/departments'}];

const renderEmployeesOverview = (employees) => {
  const active = employees.filter(e => e.isActive === true).length;
  const inactive = employees.length - active;
  // Departments breakdown if populated, else just basic metrics
  
  return (
    <div className="admin-overview-panel">
      <h3>Team Workload & Status</h3>
      <div className="admin-overview-grid">
        <div className="admin-overview-card primary">
          <span>Total Employees</span>
          <strong>{employees.length}</strong>
        </div>
        <div className="admin-overview-card success">
          <span>Active Accounts</span>
          <strong>{active}</strong>
        </div>
        <div className="admin-overview-card warning">
          <span>Inactive / Suspended</span>
          <strong>{inactive}</strong>
        </div>
        <div className="admin-overview-card info">
          <span>Departments</span>
          <strong>{new Set(employees.map(e => typeof e.department === 'object' ? e.department?.name : e.department).filter(Boolean)).size}</strong>
        </div>
      </div>
    </div>
  );
};

export default function Employees({ Layout }) {
  return (
    <AdminResourceManager 
      title="Employees" 
      singular="Employee" 
      endpoint="/users" 
      fields={fields} 
      columns={columns} 
      filters={filters} 
      transformSubmit={f=>({...f,isActive:f.isActive===true||f.isActive==='true',role:'employee'})} 
      Layout={Layout}
      renderOverview={renderEmployeesOverview}
    />
  );
}
