import { useContext, useEffect, useMemo, useState } from 'react';
import apiClient from '../../../../services/apiClient';
import { AppContext } from '../../../../context/AppContext';
import AdminLayout from './AdminLayout';
import './AdminResourceManager.css';

const errorMessage = (error) =>
  error.response?.data?.message || (error.response ? 'Request failed.' : 'Unable to connect to the server.');

const blankForm = (fields) =>
  Object.fromEntries(fields.map((field) => [field.name, field.multiple ? [] : field.defaultValue ?? '']));

function valueForForm(value, field) {
  if (field.multiple) return (value || []).map((item) => item?._id || item);
  if (field.type === 'user') return value?._id || value || '';
  return field.type === 'date' && value ? String(value).slice(0, 10) : value ?? '';
}

const userName = (user) => `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

export default function AdminResourceManager({
  title,
  singular,
  endpoint,
  fields,
  columns,
  canDelete = true,
  transformSubmit,
  extraActions,
  filters = [],
  renderOverview,
  kpis,
  pageHeading,
  description,
  createBtnText,
  searchPlaceholder,
  Layout = AdminLayout,
}) {
  const { can } = useContext(AppContext);
  const permissionTarget =
    endpoint === '/projects'
      ? ['projects', 'projects']
      : endpoint === '/tasks'
      ? ['projects', 'tasks']
      : endpoint === '/leads'
      ? ['crm', 'leads']
      : endpoint === '/clients'
      ? ['crm', 'clients']
      : endpoint === '/users'
      ? ['administration', 'employees']
      : endpoint === '/admin/departments'
      ? ['administration', 'departments']
      : null;

  const allowed = (action) => !permissionTarget || can(permissionTarget[0], permissionTarget[1], action);

  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(() => blankForm(fields));
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [filterValues, setFilterValues] = useState({});
  const [fieldOptions, setFieldOptions] = useState({});
  const [memberSearch, setMemberSearch] = useState({});

  const needsUsers = useMemo(() => fields.some((field) => field.type === 'user'), [fields]);

  const load = async () => {
    setLoading(true);
    try {
      const params = {
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
        ...Object.fromEntries(Object.entries(filterValues).filter(([, value]) => value)),
      };
      const optionFields = [...fields, ...filters].filter((field) => field.optionsEndpoint);
      const [records, userData, ...optionResponses] = await Promise.all([
        apiClient.get(endpoint, { params }),
        needsUsers ? apiClient.get('/users') : Promise.resolve({ data: { data: [] } }),
        ...optionFields.map((field) => apiClient.get(field.optionsEndpoint)),
      ]);
      setItems(records.data.data || []);
      setUsers(userData.data.data || []);
      setFieldOptions(
        Object.fromEntries(optionFields.map((field, index) => [field.name, optionResponses[index].data.data || []]))
      );
      setError('');
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [endpoint, search, status, filterValues]);

  const create = () => {
    setEditing(null);
    setViewing(null);
    setMemberSearch({});
    setForm(blankForm(fields));
    setOpen(true);
  };

  const edit = (item) => {
    setEditing(item._id);
    setViewing(null);
    setMemberSearch({});
    setForm(Object.fromEntries(fields.map((field) => [field.name, valueForForm(item[field.name], field)])));
    setOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = transformSubmit ? transformSubmit(form, editing) : form;
      if (editing) await apiClient.put(`${endpoint}/${editing}`, payload);
      else await apiClient.post(endpoint, payload);
      setOpen(false);
      setSuccess(`${singular} saved successfully.`);
      await load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm(`Are you sure you want to delete this ${singular.toLowerCase()}?`)) return;
    try {
      await apiClient.delete(`${endpoint}/${id}`);
      setSuccess(`${singular} deleted.`);
      await load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    }
  };

  const display = (item, column) => {
    const value = column.value ? column.value(item) : item[column.key];
    if (value == null || value === '') return column.key === 'department' ? 'Department not assigned' : '—';
    if (column.format) return column.format(value, item);
    if (Array.isArray(value))
      return value.length
        ? value.map((entry) => (entry.firstName ? `${entry.firstName} ${entry.lastName || ''}` : String(entry))).join(', ')
        : '—';
    if (typeof value === 'object') return `${value.firstName || ''} ${value.lastName || ''}`.trim() || value.email || '—';
    return String(value);
  };

  const updateField = (field, value) => setForm({ ...form, [field.name]: value });
  const toggleMember = (field, id) =>
    updateField(
      field,
      form[field.name].includes(id)
        ? form[field.name].filter((memberId) => memberId !== id)
        : [...form[field.name], id]
    );

  const optionsFor = (field) => field.options || fieldOptions[field.name] || [];
  const optionValue = (option, field) => (typeof option === 'object' ? option[field.optionValue || 'name'] : option);
  const optionLabel = (option, field) => (typeof option === 'object' ? option[field.optionLabel || 'name'] : option);

  const employeeUsers = users.filter((user) => user.role === 'employee');

  // Compute 4 KPI cards if provided or fallback
  const computedKpis = useMemo(() => {
    if (typeof kpis === 'function') {
      return kpis(items, users);
    }
    if (Array.isArray(kpis)) {
      return kpis;
    }
    if (typeof renderOverview === 'function') {
      // If legacy renderOverview was passed, renderOverview itself might be used
      return null;
    }
    // Default 4 KPIs if none specified
    const activeCount = items.filter((i) => ['Active', 'In Progress', 'Qualified'].includes(i.status)).length;
    const pendingCount = items.filter((i) => ['Pending', 'Planning', 'New', 'Prospect'].includes(i.status)).length;
    const completedCount = items.filter((i) => ['Completed', 'Converted'].includes(i.status)).length;
    return [
      {
        label: `TOTAL ${title.toUpperCase()}`,
        value: items.length,
        bg: '#eff6ff',
        color: '#1d4ed8',
        borderColor: '#bfdbfe',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        ),
      },
      {
        label: 'ACTIVE',
        value: activeCount,
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
        label: 'PENDING / NEW',
        value: pendingCount,
        bg: '#fffbeb',
        color: '#b45309',
        borderColor: '#fde68a',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
          </svg>
        ),
      },
      {
        label: 'COMPLETED / WON',
        value: completedCount,
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
    ];
  }, [kpis, renderOverview, items, users, title]);

  return (
    <Layout pageTitle={title}>
      <div className="admin-mgmt-container">
        {/* ── Page Header (H2, description, right action button) ── */}
        <div className="admin-mgmt-header">
          <div className="admin-mgmt-title-area">
            <h2>{pageHeading || `${title} Management`}</h2>
            <p>{description || `Assign, monitor, and manage ${title.toLowerCase()} across active company workflows.`}</p>
          </div>
          {allowed('create') && (
            <button type="button" className="admin-mgmt-btn-primary" onClick={create}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {createBtnText || `+ Add ${singular}`}
            </button>
          )}
        </div>

        {/* ── Feedback Alerts ── */}
        {error && (
          <div className="admin-mgmt-alert error">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')}>&times;</button>
          </div>
        )}
        {success && (
          <div className="admin-mgmt-alert success">
            <span>{success}</span>
            <button type="button" onClick={() => setSuccess('')}>&times;</button>
          </div>
        )}

        {/* ── 4 KPI Cards Row ── */}
        {computedKpis && computedKpis.length > 0 && (
          <div className="admin-mgmt-kpi-grid">
            {computedKpis.map((kpi, idx) => (
              <div key={idx} className="admin-mgmt-kpi-card">
                <div
                  className="admin-mgmt-kpi-icon"
                  style={{
                    background: kpi.bg || '#f8fafc',
                    color: kpi.color || '#475569',
                    border: `1px solid ${kpi.borderColor || '#e2e8f0'}`,
                  }}
                >
                  {kpi.icon}
                </div>
                <div className="admin-mgmt-kpi-info">
                  <span className="admin-mgmt-kpi-label">{kpi.label}</span>
                  <span className="admin-mgmt-kpi-val" style={{ color: kpi.valColor || kpi.color || '#0f172a' }}>
                    {kpi.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Legacy custom overview fallback if specified and no kpis array */}
        {!computedKpis && renderOverview && renderOverview(items, users)}

        {/* ── Compact Filter Toolbar ── */}
        <div className="admin-mgmt-toolbar">
          <div className="admin-mgmt-search-wrap">
            <svg className="admin-mgmt-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="admin-mgmt-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder || `Search by ${title.toLowerCase()} title, description, keywords...`}
            />
          </div>

          {/* Dynamic Filter Selects */}
          {filters.map((filter) => (
            <select
              key={filter.name}
              className="admin-mgmt-filter-select"
              value={filterValues[filter.name] || ''}
              onChange={(e) => setFilterValues({ ...filterValues, [filter.name]: e.target.value })}
            >
              <option value="">{filter.label || `All ${filter.name}`}</option>
              {(optionsFor(filter) || []).map((option) => (
                <option key={option._id || optionValue(option, filter)} value={optionValue(option, filter)}>
                  {optionLabel(option, filter)}
                </option>
              ))}
            </select>
          ))}

          {/* Default Status Filter if not already in filters */}
          {!filters.some((f) => f.name === 'status') && fields.some((f) => f.name === 'status') && (
            <select
              className="admin-mgmt-filter-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              {(fields.find((f) => f.name === 'status')?.options || []).map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          )}
        </div>

        {/* ── Data Table ── */}
        {loading ? (
          <div className="admin-mgmt-empty">
            <div className="admin-mgmt-spinner" />
            <p>Loading {title.toLowerCase()} records...</p>
          </div>
        ) : items.length ? (
          <div className="admin-mgmt-table-card">
            <table className="admin-mgmt-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key || column.label}>{column.label}</th>
                  ))}
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id}>
                    {columns.map((column) => (
                      <td key={column.key || column.label}>
                        {column.key === 'status' ? (
                          <span className={`admin-status-badge ${String(display(item, column)).toLowerCase().replace(/\s+/g, '-')}`}>
                            {display(item, column)}
                          </span>
                        ) : (
                          display(item, column)
                        )}
                      </td>
                    ))}
                    <td style={{ textAlign: 'right' }}>
                      <div className="admin-mgmt-action-buttons">
                        {allowed('view') && (
                          <button type="button" className="admin-mgmt-action-btn view" onClick={() => setViewing(item)} title="View Details">
                            View
                          </button>
                        )}
                        {allowed('edit') && (
                          <button type="button" className="admin-mgmt-action-btn edit" onClick={() => edit(item)} title="Edit Record">
                            Edit
                          </button>
                        )}
                        {extraActions?.(item, load, setError)}
                        {canDelete && allowed('delete') && (
                          <button type="button" className="admin-mgmt-action-btn delete" onClick={() => remove(item._id)} title="Delete Record">
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-mgmt-empty">No {title.toLowerCase()} records found.</div>
        )}

        {/* ── Create / Edit Modal ── */}
        {open && (
          <div className="admin-modal-backdrop">
            <form className="admin-modal admin-card" onSubmit={submit}>
              <div className="admin-modal-header">
                <h3>{editing ? 'Edit' : 'Add'} {singular}</h3>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close">&times;</button>
              </div>
              <div className="admin-modal-grid">
                {fields
                  .filter((field) => !(editing && field.createOnly))
                  .map((field) => (
                    <label key={field.name} className={field.type === 'user' && field.multiple ? 'admin-modal-field-wide' : ''}>
                      <span>
                        {field.label}
                        {field.required && !editing ? ' *' : ''}
                      </span>
                      {field.type === 'select' ? (
                        <select
                          required={field.required && !editing}
                          value={form[field.name]}
                          onChange={(event) => updateField(field, event.target.value)}
                        >
                          <option value="">Select</option>
                          {optionsFor(field).map((option) => (
                            <option key={option._id || optionValue(option, field)} value={optionValue(option, field)}>
                              {optionLabel(option, field)}
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'user' && field.multiple ? (
                        <div className="employee-multiselect">
                          <div className="employee-chips">
                            {form[field.name].length ? (
                              form[field.name].map((id) => {
                                const user = employeeUsers.find((entry) => entry._id === id);
                                return user ? (
                                  <button type="button" key={id} className="employee-chip" onClick={() => toggleMember(field, id)}>
                                    {userName(user)} <span>&times;</span>
                                  </button>
                                ) : null;
                              })
                            ) : (
                              <span className="employee-placeholder">No employees selected</span>
                            )}
                          </div>
                          <div className="employee-picker-toolbar">
                            <input
                              type="search"
                              value={memberSearch[field.name] || ''}
                              onChange={(event) => setMemberSearch({ ...memberSearch, [field.name]: event.target.value })}
                              placeholder="Search employees by name or email"
                            />
                            <button
                              type="button"
                              className="ghost-btn"
                              onClick={() => updateField(field, [])}
                              disabled={!form[field.name].length}
                            >
                              Clear
                            </button>
                          </div>
                          <div className="employee-options">
                            {employeeUsers
                              .filter((user) =>
                                `${userName(user)} ${user.email || ''}`
                                  .toLowerCase()
                                  .includes((memberSearch[field.name] || '').trim().toLowerCase())
                              )
                              .map((user) => (
                                <label key={user._id} className="employee-option">
                                  <input
                                    type="checkbox"
                                    checked={form[field.name].includes(user._id)}
                                    onChange={() => toggleMember(field, user._id)}
                                  />
                                  <span>
                                    <strong>{userName(user)}</strong>
                                    <small>{user.email}</small>
                                  </span>
                                </label>
                              ))}
                            {!employeeUsers.length && <span className="employee-placeholder">No employee accounts found.</span>}
                          </div>
                        </div>
                      ) : field.type === 'user' ? (
                        <select
                          required={field.required && !editing}
                          value={form[field.name]}
                          onChange={(event) => updateField(field, event.target.value)}
                        >
                          <option value="">Select employee</option>
                          {employeeUsers.map((user) => (
                            <option key={user._id} value={user._id}>
                              {userName(user)} ({user.email})
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'textarea' ? (
                        <textarea value={form[field.name]} onChange={(event) => updateField(field, event.target.value)} />
                      ) : (
                        <input
                          type={field.type || 'text'}
                          required={field.required && !editing}
                          value={form[field.name]}
                          onChange={(event) => updateField(field, event.target.value)}
                        />
                      )}
                    </label>
                  ))}
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="ghost-btn" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button className="primary-btn" disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Details / View Modal ── */}
        {viewing && (
          <div className="admin-modal-backdrop">
            <div className="admin-modal admin-card">
              <div className="admin-modal-header">
                <h3>{singular} Details</h3>
                <button type="button" onClick={() => setViewing(null)} aria-label="Close">&times;</button>
              </div>
              <div className="admin-detail-grid">
                {columns.map((column) => (
                  <div key={column.key || column.label}>
                    <span>{column.label}</span>
                    <strong>{display(viewing, column)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
