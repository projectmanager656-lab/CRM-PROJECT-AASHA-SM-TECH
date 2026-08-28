import { useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../../../../services/apiClient';
import { AppContext } from '../../../../../context/AppContext';
import UserLayout from './UserLayout';
import './ResourceModule.css';

const emptyFrom = (fields) => Object.fromEntries(fields.map((field) => [field.name, field.defaultValue || '']));
const errorMessage = (error) => error.response?.data?.message || (error.response ? 'Request failed' : 'Unable to connect to server');

export default function ResourceModule({ config }) {
  const { can } = useContext(AppContext);
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [records, setRecords] = useState([]);
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(() => emptyFrom(config.fields));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');

  const mode = useMemo(() => location.pathname.endsWith('/new') ? 'create' : location.pathname.endsWith('/edit') ? 'edit' : id ? 'view' : 'list', [location.pathname, id]);
  const hasPermission = (action) => !config.permission || can(config.permission[0], config.permission[1], action);
  const canCreate = config.canCreate !== false && hasPermission('create');
  const canEdit = config.canEdit !== false && hasPermission('edit');
  const canDelete = config.canDelete !== false && hasPermission('delete');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError('');
      try {
        if (mode === 'list') {
          const response = await apiClient.get(config.endpoint, { params: search ? { search } : {} });
          if (active) setRecords(response.data.data || []);
        } else if (id) {
          const response = await apiClient.get(`${config.endpoint}/${id}`);
          if (active) {
            setRecord(response.data.data);
            setForm(Object.fromEntries(config.fields.map((field) => [field.name, response.data.data[field.name] ? String(response.data.data[field.name]).slice(0, field.type === 'date' ? 10 : undefined) : ''])));
          }
        }
      } catch (requestError) { if (active) setError(errorMessage(requestError)); }
      finally { if (active) setLoading(false); }
    };
    const timer = setTimeout(load, mode === 'list' && search ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [config, id, mode, search]);

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('');
    try {
      const response = mode === 'edit'
        ? await apiClient.put(`${config.endpoint}/${id}`, form)
        : await apiClient.post(config.endpoint, form);
      const saved = response.data.data;
      setSuccess(`${config.singular} saved successfully`);
      navigate(`${config.basePath}/${saved._id}`, { replace: true });
    } catch (requestError) { setError(errorMessage(requestError)); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!window.confirm(`Delete this ${config.singular.toLowerCase()}?`)) return;
    try { await apiClient.delete(`${config.endpoint}/${id}`); navigate(config.basePath); }
    catch (requestError) { setError(errorMessage(requestError)); }
  };

  const updateStatus = async (status) => {
    try {
      const path = config.statusEndpoint ? `${config.endpoint}/${id}/${config.statusEndpoint}` : `${config.endpoint}/${id}`;
      const response = await apiClient.patch(path, { status });
      setRecord(response.data.data); setSuccess('Status updated');
    } catch (requestError) { setError(errorMessage(requestError)); }
  };

  return <UserLayout pageTitle={`My ${config.plural}`}>
    <section className="resource-module">
      <div className="resource-toolbar">
        <div><span className="page-kicker">Workspace</span><h2>{mode === 'list' ? config.plural : mode === 'create' ? `Create ${config.singular}` : mode === 'edit' ? `Edit ${config.singular}` : `${config.singular} Details`}</h2></div>
        <div className="resource-actions">
          {mode !== 'list' && <button className="ghost-btn" type="button" onClick={() => navigate(config.basePath)}>Back</button>}
          {mode === 'list' && canCreate && <button className="primary-btn" type="button" onClick={() => navigate(`${config.basePath}/new`)}>Add {config.singular}</button>}
          {mode === 'view' && canEdit && <button className="primary-btn" type="button" onClick={() => navigate(`${config.basePath}/${id}/edit`)}>Edit</button>}
        </div>
      </div>

      {error && <div className="resource-message error">{error}</div>}
      {success && <div className="resource-message success">{success}</div>}
      {loading ? <div className="resource-empty">Loading...</div> : mode === 'list' ? <>
        <input className="resource-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${config.plural.toLowerCase()}`} />
        {records.length === 0 ? (config.renderEmptyState ? config.renderEmptyState() : <div className="resource-empty">No {config.plural.toLowerCase()} found.</div>) : config.renderCard ? <div className="resource-card-grid">{records.map(item => config.renderCard(item, () => navigate(`${config.basePath}/${item._id}`)))}</div> : <div className="resource-table-wrap"><table className="resource-table"><thead><tr>{config.columns.map((column) => <th key={column.key}>{column.label}</th>)}<th>Action</th></tr></thead><tbody>{records.map((item) => <tr key={item._id}>{config.columns.map((column) => <td key={column.key}>{column.format ? column.format(item[column.key], item) : item[column.key] || '-'}</td>)}<td><button className="table-action" type="button" onClick={() => navigate(`${config.basePath}/${item._id}`)}>View</button></td></tr>)}</tbody></table></div>}
      </> : (mode === 'create' || mode === 'edit') ? <form className="resource-form" onSubmit={submit}>{config.fields.map((field) => <label key={field.name}><span>{field.label}{field.required ? ' *' : ''}</span>{field.type === 'select' ? <select value={form[field.name]} required={field.required} onChange={(event) => setForm({ ...form, [field.name]: event.target.value })}><option value="">Select</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : field.type === 'textarea' ? <textarea value={form[field.name]} required={field.required} onChange={(event) => setForm({ ...form, [field.name]: event.target.value })} /> : <input type={field.type || 'text'} value={form[field.name]} required={field.required} onChange={(event) => setForm({ ...form, [field.name]: event.target.value })} />}</label>)}<div className="resource-form-actions"><button className="primary-btn" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></div></form> : record && <div className="resource-details">{config.fields.map((field) => <div key={field.name}><span>{field.label}</span><strong>{record[field.name] ? String(record[field.name]).slice(0, field.type === 'date' ? 10 : undefined) : '-'}</strong></div>)}{config.statuses && canEdit && <div className="resource-status-actions"><span>Update Status</span>{config.statuses.map((status) => <button key={status} type="button" className="secondary-btn" onClick={() => updateStatus(status)}>{status}</button>)}</div>}{canDelete && <button type="button" className="danger-btn" onClick={remove}>Delete</button>}</div>}
    </section>
  </UserLayout>;
}
