import { useContext, useEffect, useMemo, useState } from 'react';
import apiClient from '../../../../services/apiClient';
import { AppContext } from '../../../../context/AppContext';
import AdminLayout from './AdminLayout';
import './AdminResourceManager.css';

const errorMessage = (error) => error.response?.data?.message || (error.response ? 'Request failed.' : 'Unable to connect to the server.');
const blankForm = (fields) => Object.fromEntries(fields.map((field) => [field.name, field.multiple ? [] : field.defaultValue ?? '']));

function valueForForm(value, field) {
  if (field.multiple) return (value || []).map((item) => item?._id || item);
  if (field.type === 'user') return value?._id || value || '';
  return field.type === 'date' && value ? String(value).slice(0, 10) : value ?? '';
}

const userName = (user) => `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

export default function AdminResourceManager({ title, singular, endpoint, fields, columns, canDelete = true, transformSubmit, extraActions, filters = [], Layout = AdminLayout }) {
  const { can } = useContext(AppContext);
  const permissionTarget = endpoint === '/projects' ? ['projects', 'projects'] : endpoint === '/tasks' ? ['projects', 'tasks'] : endpoint === '/leads' ? ['crm', 'leads'] : endpoint === '/clients' ? ['crm', 'clients'] : endpoint === '/users' ? ['administration', 'employees'] : endpoint === '/admin/departments' ? ['administration', 'departments'] : null;
  const allowed = (action) => !permissionTarget || can(permissionTarget[0], permissionTarget[1], action);
  const [items, setItems] = useState([]); const [users, setUsers] = useState([]); const [form, setForm] = useState(() => blankForm(fields));
  const [editing, setEditing] = useState(null); const [viewing, setViewing] = useState(null); const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [filterValues, setFilterValues] = useState({}); const [fieldOptions, setFieldOptions] = useState({}); const [memberSearch, setMemberSearch] = useState({});
  const needsUsers = useMemo(() => fields.some((field) => field.type === 'user'), [fields]);

  const load = async () => {
    setLoading(true);
    try {
      const params = { ...(search ? { search } : {}), ...(status ? { status } : {}), ...Object.fromEntries(Object.entries(filterValues).filter(([, value]) => value)) };
      const optionFields = [...fields, ...filters].filter((field) => field.optionsEndpoint);
      const [records, userData, ...optionResponses] = await Promise.all([apiClient.get(endpoint, { params }), needsUsers ? apiClient.get('/users') : Promise.resolve({ data: { data: [] } }), ...optionFields.map((field) => apiClient.get(field.optionsEndpoint))]);
      setItems(records.data.data || []); setUsers(userData.data.data || []); setFieldOptions(Object.fromEntries(optionFields.map((field, index) => [field.name, optionResponses[index].data.data || []]))); setError('');
    } catch (loadError) { setError(errorMessage(loadError)); } finally { setLoading(false); }
  };

  useEffect(() => { const timer = setTimeout(load, search ? 250 : 0); return () => clearTimeout(timer); }, [endpoint, search, status, filterValues]);
  const create = () => { setEditing(null); setViewing(null); setMemberSearch({}); setForm(blankForm(fields)); setOpen(true); };
  const edit = (item) => { setEditing(item._id); setViewing(null); setMemberSearch({}); setForm(Object.fromEntries(fields.map((field) => [field.name, valueForForm(item[field.name], field)]))); setOpen(true); };

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try { const payload = transformSubmit ? transformSubmit(form, editing) : form; if (editing) await apiClient.put(`${endpoint}/${editing}`, payload); else await apiClient.post(endpoint, payload); setOpen(false); setSuccess(`${singular} saved.`); await load(); }
    catch (submitError) { setError(errorMessage(submitError)); } finally { setSaving(false); }
  };
  const remove = async (id) => {
    if (!window.confirm(`Delete this ${singular.toLowerCase()}?`)) return;
    try { await apiClient.delete(`${endpoint}/${id}`); setSuccess(`${singular} deleted.`); await load(); } catch (deleteError) { setError(errorMessage(deleteError)); }
  };
  const display = (item, column) => {
    const value = column.value ? column.value(item) : item[column.key];
    if (value == null || value === '') return column.key === 'department' ? 'Department not assigned' : '-'; if (column.format) return column.format(value, item);
    if (Array.isArray(value)) return value.length ? value.map((entry) => entry.firstName ? `${entry.firstName} ${entry.lastName || ''}` : String(entry)).join(', ') : '-';
    if (typeof value === 'object') return `${value.firstName || ''} ${value.lastName || ''}`.trim() || value.email || '-';
    return String(value);
  };
  const updateField = (field, value) => setForm({ ...form, [field.name]: value });
  const toggleMember = (field, id) => updateField(field, form[field.name].includes(id) ? form[field.name].filter((memberId) => memberId !== id) : [...form[field.name], id]);

  const optionsFor = (field) => field.options || fieldOptions[field.name] || [];
  const optionValue = (option, field) => typeof option === 'object' ? option[field.optionValue || 'name'] : option;
  const optionLabel = (option, field) => typeof option === 'object' ? option[field.optionLabel || 'name'] : option;

  const employeeUsers = users.filter((user) => user.role === 'employee');

  return <Layout pageTitle={title}><div className="admin-resource">
    <div className="admin-page-header"><h2>{title} Management</h2>{allowed('create') && <button type="button" className="primary-btn" onClick={create}>Add {singular}</button>}</div>
    <div className="admin-resource-toolbar admin-card"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${title.toLowerCase()}`} /><input value={status} onChange={(event) => setStatus(event.target.value)} placeholder="Filter status" />{filters.map((filter) => <select key={filter.name} value={filterValues[filter.name] || ''} onChange={(event) => setFilterValues({ ...filterValues, [filter.name]: event.target.value })}><option value="">{filter.label}</option>{(fieldOptions[filter.name] || []).map((option) => <option key={option._id || optionValue(option, filter)} value={optionValue(option, filter)}>{optionLabel(option, filter)}</option>)}</select>)}</div>
    {error && <div className="admin-resource-message error">{error}</div>}{success && <div className="admin-resource-message success">{success}</div>}
    {loading ? <div className="admin-resource-empty">Loading...</div> : items.length ? <div className="admin-resource-table admin-card"><table><thead><tr>{columns.map((column) => <th key={column.key || column.label}>{column.label}</th>)}<th>Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item._id}>{columns.map((column) => <td key={column.key || column.label}>{display(item, column)}</td>)}<td><div className="action-buttons">{allowed('view')&&<button type="button" className="action-btn view" onClick={() => setViewing(item)}>View</button>}{allowed('edit')&&<button type="button" className="action-btn edit" onClick={() => edit(item)}>Edit</button>}{extraActions?.(item, load, setError)}{canDelete && allowed('delete') && <button type="button" className="action-btn delete" onClick={() => remove(item._id)}>Delete</button>}</div></td></tr>)}</tbody></table></div> : <div className="admin-resource-empty">No records found.</div>}
    {open && <div className="admin-modal-backdrop"><form className="admin-modal admin-card" onSubmit={submit}><div className="admin-modal-header"><h3>{editing ? 'Edit' : 'Add'} {singular}</h3><button type="button" onClick={() => setOpen(false)} aria-label="Close">{'\u00D7'}</button></div><div className="admin-modal-grid">{fields.filter((field) => !(editing && field.createOnly)).map((field) => <label key={field.name} className={field.type === 'user' && field.multiple ? 'admin-modal-field-wide' : ''}><span>{field.label}{field.required && !editing ? ' *' : ''}</span>{field.type === 'select' ? <select required={field.required && !editing} value={form[field.name]} onChange={(event) => updateField(field, event.target.value)}><option value="">Select</option>{optionsFor(field).map((option) => <option key={option._id || optionValue(option, field)} value={optionValue(option, field)}>{optionLabel(option, field)}</option>)}</select> : field.type === 'user' && field.multiple ? <div className="employee-multiselect"><div className="employee-chips">{form[field.name].length ? form[field.name].map((id) => { const user = employeeUsers.find((entry) => entry._id === id); return user ? <button type="button" key={id} className="employee-chip" onClick={() => toggleMember(field, id)}>{userName(user)} <span>×</span></button> : null; }) : <span className="employee-placeholder">No employees selected</span>}</div><div className="employee-picker-toolbar"><input type="search" value={memberSearch[field.name] || ''} onChange={(event) => setMemberSearch({ ...memberSearch, [field.name]: event.target.value })} placeholder="Search employees by name or email" /><button type="button" className="ghost-btn" onClick={() => updateField(field, [])} disabled={!form[field.name].length}>Clear</button></div><div className="employee-options">{employeeUsers.filter((user) => `${userName(user)} ${user.email || ''}`.toLowerCase().includes((memberSearch[field.name] || '').trim().toLowerCase())).map((user) => <label key={user._id} className="employee-option"><input type="checkbox" checked={form[field.name].includes(user._id)} onChange={() => toggleMember(field, user._id)} /><span><strong>{userName(user)}</strong><small>{user.email}</small></span></label>)}{!employeeUsers.length && <span className="employee-placeholder">No employee accounts found.</span>}</div></div> : field.type === 'user' ? <select required={field.required && !editing} value={form[field.name]} onChange={(event) => updateField(field, event.target.value)}><option value="">Select employee</option>{employeeUsers.map((user) => <option key={user._id} value={user._id}>{userName(user)} ({user.email})</option>)}</select> : field.type === 'textarea' ? <textarea value={form[field.name]} onChange={(event) => updateField(field, event.target.value)} /> : <input type={field.type || 'text'} required={field.required && !editing} value={form[field.name]} onChange={(event) => updateField(field, event.target.value)} />}</label>)}</div><div className="admin-modal-actions"><button type="button" className="ghost-btn" onClick={() => setOpen(false)}>Cancel</button><button className="primary-btn" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></div></form></div>}
    {viewing && <div className="admin-modal-backdrop"><div className="admin-modal admin-card"><div className="admin-modal-header"><h3>{singular} Details</h3><button type="button" onClick={() => setViewing(null)} aria-label="Close">{'\u00D7'}</button></div><div className="admin-detail-grid">{columns.map((column) => <div key={column.key || column.label}><span>{column.label}</span><strong>{display(viewing, column)}</strong></div>)}</div></div></div>}
  </div></Layout>;
}
