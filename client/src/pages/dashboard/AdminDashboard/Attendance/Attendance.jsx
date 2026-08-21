import { useEffect, useMemo, useState } from 'react';
import apiClient from '../../../../services/apiClient';
import AdminLayout from '../components/AdminLayout';
import './Attendance.css';

const message = (error) => error.response?.data?.message || 'Unable to load attendance records.';
const showTime = (value) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

export default function Attendance() {
  const [records, setRecords] = useState([]); const [date, setDate] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = async () => { setLoading(true); try { const response = await apiClient.get('/attendance', { params: date ? { date } : {} }); setRecords(response.data.data || []); setError(''); } catch (e) { setError(message(e)); } finally { setLoading(false); } };
  useEffect(() => { load(); }, [date]);
  const summary = useMemo(() => ({ Present: records.filter((x) => x.status === 'Present').length, Absent: records.filter((x) => x.status === 'Absent').length, Late: records.filter((x) => x.status === 'Late').length, 'Half Day': records.filter((x) => x.status === 'Half Day').length }), [records]);
  return <AdminLayout pageTitle="Attendance"><div className="admin-page"><div className="admin-page-header"><h2>Attendance Management</h2><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>{error && <div className="admin-resource-message error">{error}</div>}<div className="attendance-summary"><div className="summary-grid admin-card">{Object.entries(summary).map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></div><div className="attendance-table admin-card"><table><thead><tr><th>Employee</th><th>Date</th><th>Check In</th><th>Check Out</th><th>Status</th></tr></thead><tbody>{loading ? <tr><td colSpan="5">Loading...</td></tr> : records.length ? records.map((record) => <tr key={record._id}><td>{record.user ? `${record.user.firstName} ${record.user.lastName || ''}` : '—'}</td><td>{record.date}</td><td>{showTime(record.checkIn)}</td><td>{showTime(record.checkOut)}</td><td><span className={`att-status ${record.status.toLowerCase().replace(' ', '-')}`}>{record.status}</span></td></tr>) : <tr><td colSpan="5">No attendance records found.</td></tr>}</tbody></table></div></div></AdminLayout>;
}
