import AdminResourceManager from '../components/AdminResourceManager';
import { PROJECT_CATEGORIES } from '../../../../config/departments';

const fields=[{name:'name',label:'Project Name',required:true},{name:'description',label:'Description',type:'textarea'},{name:'category',label:'Project Category',type:'select',options:PROJECT_CATEGORIES,defaultValue:'Tech',required:true},{name:'owner',label:'Assigned To',type:'user',required:true},{name:'sharedWith',label:'Share With',type:'user',multiple:true},{name:'status',label:'Status',type:'select',options:['Planning','Active','On Hold','Completed'],defaultValue:'Planning'},{name:'startDate',label:'Start Date',type:'date'},{name:'dueDate',label:'Due Date',type:'date'}];
const columns=[{key:'name',label:'Project'},{key:'category',label:'Category'},{key:'owner',label:'Assigned To'},{key:'status',label:'Status'},{key:'startDate',label:'Start',format:v=>v?new Date(v).toLocaleDateString():'-'},{key:'dueDate',label:'Due',format:v=>v?new Date(v).toLocaleDateString():'-'}];

const renderProjectsOverview = (projects) => {
  const active = projects.filter(p => p.status === 'Active' || p.status === 'In Progress').length;
  const completed = projects.filter(p => p.status === 'Completed').length;
  const planning = projects.filter(p => p.status === 'Planning').length;
  const onHold = projects.filter(p => p.status === 'On Hold').length;
  
  return (
    <div className="admin-overview-panel">
      <h3>Project Health & Progress</h3>
      <div className="admin-overview-grid">
        <div className="admin-overview-card primary">
          <span>Total Projects</span>
          <strong>{projects.length}</strong>
        </div>
        <div className="admin-overview-card success">
          <span>Active</span>
          <strong>{active}</strong>
        </div>
        <div className="admin-overview-card info">
          <span>Planning</span>
          <strong>{planning}</strong>
        </div>
        <div className="admin-overview-card warning">
          <span>On Hold / Completed</span>
          <strong>{onHold} / {completed}</strong>
        </div>
      </div>
    </div>
  );
};

export default function Projects({ Layout }) {
  return (
    <AdminResourceManager 
      title="Projects" 
      singular="Project" 
      endpoint="/projects" 
      fields={fields} 
      columns={columns} 
      Layout={Layout}
      renderOverview={renderProjectsOverview}
    />
  );
}
