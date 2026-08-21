import { useEffect, useMemo, useState } from 'react';
import apiClient from '../../../../services/apiClient';
import SuperAdminLayout from './SuperAdminLayout';

const errorMessage = (error) => error.response?.data?.message || 'Unable to load records.';
const value = (item, field) => {
  const data = item[field];
  if ((data == null || data === '') && field === 'department') return 'Department not assigned';
  if (data == null || data === '') return '—';
  if (Array.isArray(data)) return data.length ? data.join(', ') : '—';
  if (typeof data === 'object') return `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.email || '—';
  if (field.endsWith('At') || field === 'createdAt') return new Date(data).toLocaleDateString();
  return String(data);
};

export default function SuperAdminResourceList({ pageTitle, kicker, description, endpoint, columns }) {
  const [items, setItems] = useState([]); const [search, setSearch] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { let active = true; apiClient.get(endpoint).then((response) => { if (active) { setItems(response.data.data || []); setError(''); } }).catch((loadError) => active && setError(errorMessage(loadError))).finally(() => active && setLoading(false)); return () => { active = false; }; }, [endpoint]);
  const filtered = useMemo(() => { const term = search.trim().toLowerCase(); return term ? items.filter((item) => columns.some((column) => value(item, column.key).toLowerCase().includes(term))) : items; }, [items, search, columns]);
  return <SuperAdminLayout pageTitle={pageTitle}><section className="page-card"><div className="page-header-row"><div><div className="section-kicker">{kicker}</div><h2>{pageTitle}</h2><p className="section-subtitle">{description}</p></div></div><input className="superadmin-resource-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${pageTitle.toLowerCase()}`} />{error && <div className="resource-message error">{error}</div>}{loading ? <div className="resource-empty">Loading...</div> : filtered.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{filtered.map((item) => <tr key={item._id}>{columns.map((column) => <td key={column.key}>{value(item, column.key)}</td>)}</tr>)}</tbody></table></div> : <div className="resource-empty">No records found.</div>}</section></SuperAdminLayout>;
}
