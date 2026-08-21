import { useEffect, useState } from 'react';
import apiClient from '../../../../services/apiClient';
import AdminLayout from '../components/AdminLayout';
import './LeaveRequests.css';

const message = (error) => error.response?.data?.message || 'Unable to load leave requests.';
const date = (value) => value ? String(value).slice(0, 10) : '—';

export default function LeaveRequests() {
  const [requests, setRequests] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = async () => { setLoading(true); try { const response = await apiClient.get('/leave-requests'); setRequests(response.data.data || []); setError(''); } catch (e) { setError(message(e)); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const review = async (id, status) => { try { await apiClient.patch(`/leave-requests/${id}/status`, { status }); await load(); } catch (e) { setError(message(e)); } };
  return <AdminLayout pageTitle="Leave Requests"><div className="admin-page"><div className="admin-page-header"><h2>Leave Request Management</h2></div>{error && <div className="admin-resource-message error">{error}</div>}<div className="leave-table admin-card"><table><thead><tr><th>Employee</th><th>Leave Type</th><th>Start Date</th><th>End Date</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead><tbody>{loading ? <tr><td colSpan="7">Loading...</td></tr> : requests.length ? requests.map((request) => <tr key={request._id}><td>{request.user ? `${request.user.firstName} ${request.user.lastName || ''}` : '—'}</td><td>{request.type}</td><td>{date(request.startDate)}</td><td>{date(request.endDate)}</td><td>{request.reason}</td><td><span className={`leave-status ${request.status.toLowerCase()}`}>{request.status}</span></td><td><div className="action-buttons">{request.status === 'Pending' && <><button type="button" className="action-btn approve" onClick={() => review(request._id, 'Approved')}>Approve</button><button type="button" className="action-btn reject" onClick={() => review(request._id, 'Rejected')}>Reject</button></>}</div></td></tr>) : <tr><td colSpan="7">No leave requests found.</td></tr>}</tbody></table></div></div></AdminLayout>;
}
