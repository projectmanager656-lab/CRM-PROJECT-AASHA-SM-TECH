import React, { useEffect, useMemo, useState } from 'react';
import apiClient from '../../services/apiClient';
import './AttendanceManagement.css';

const message = (error) => error.response?.data?.message || 'Unable to load attendance records.';
const showTime = (value) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
const toLocalISO = (date) => new Date(date).toISOString().slice(0, 16);

export default function AttendanceManagement({ Layout, title = "Attendance Management" }) {
  const [records, setRecords] = useState([]);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Form State
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formData, setFormData] = useState({ id: '', user: '', date: '', checkIn: '', checkOut: '', status: 'Present', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = async () => {
    try {
      const response = await apiClient.get('/users');
      setUsers(response.data.data || []);
    } catch (e) {
      console.error('Failed to load users', e);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/attendance', { params: date ? { date } : {} });
      setRecords(response.data.data || []);
      setError('');
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [date]);
  useEffect(() => { loadUsers(); }, []);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const name = r.user ? `${r.user.firstName} ${r.user.lastName || ''}`.toLowerCase() : '';
      const matchesSearch = name.includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [records, searchQuery, statusFilter]);

  const summary = useMemo(() => ({
    Present: filteredRecords.filter((x) => x.status === 'Present').length,
    Absent: filteredRecords.filter((x) => x.status === 'Absent').length,
    Late: filteredRecords.filter((x) => x.status === 'Late').length,
    'Half Day': filteredRecords.filter((x) => x.status === 'Half Day').length
  }), [filteredRecords]);

  const openModal = (record = null) => {
    setError('');
    if (record) {
      setIsEdit(true);
      setFormData({
        id: record._id,
        user: record.user?._id || '',
        date: record.date,
        checkIn: record.checkIn ? toLocalISO(record.checkIn) : '',
        checkOut: record.checkOut ? toLocalISO(record.checkOut) : '',
        status: record.status,
        notes: record.notes || ''
      });
    } else {
      setIsEdit(false);
      setFormData({ id: '', user: '', date: date || new Date().toISOString().slice(0, 10), checkIn: '', checkOut: '', status: 'Present', notes: '' });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = { ...formData };
      if (!payload.checkOut) delete payload.checkOut;
      if (isEdit) {
        await apiClient.put(`/attendance/${payload.id}`, payload);
      } else {
        await apiClient.post('/attendance', { ...payload, manual: true });
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(message(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this attendance record?')) return;
    try {
      await apiClient.delete(`/attendance/${id}`);
      load();
    } catch (err) {
      alert(message(err));
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await apiClient.put(`/attendance/${id}`, { status: newStatus });
      load();
    } catch (err) {
      alert(message(err));
    }
  };

  const content = (
    <div className="admin-page">
      <div className="admin-page-header" style={{ flexWrap: 'wrap' }}>
        <h2>{title}</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="text" placeholder="Search employee..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="att-input" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="att-input">
            <option value="All">All</option>
            <option value="Present">Present</option>
            <option value="Absent">Absent</option>
            <option value="Late">Late</option>
            <option value="Half Day">Half Day</option>
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="att-input" />
          <button className="att-btn att-btn-primary" onClick={() => openModal()}>+ Mark Attendance</button>
        </div>
      </div>
      {error && !showModal && <div className="admin-resource-message error">{error}</div>}
      
      <div className="attendance-summary">
        <div className="summary-grid admin-card">
          {Object.entries(summary).map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="attendance-table admin-card">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Date</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{textAlign:'center'}}>Loading...</td></tr>
            ) : filteredRecords.length ? (
              filteredRecords.map((record) => (
                <tr key={record._id}>
                  <td>{record.user ? `${record.user.firstName} ${record.user.lastName || ''}` : '—'}</td>
                  <td>{record.date}</td>
                  <td>{showTime(record.checkIn)}</td>
                  <td>{showTime(record.checkOut)}</td>
                  <td>
                    <select 
                      className={`att-status-select ${record.status.toLowerCase().replace(' ', '-')}`}
                      value={record.status}
                      onChange={(e) => handleStatusChange(record._id, e.target.value)}
                    >
                      <option value="Present">Present</option>
                      <option value="Absent">Absent</option>
                      <option value="Late">Late</option>
                      <option value="Half Day">Half Day</option>
                    </select>
                  </td>
                  <td>
                    <div className="att-actions">
                      <button className="att-btn-sm" onClick={() => openModal(record)}>Edit</button>
                      <button className="att-btn-sm att-btn-danger" onClick={() => handleDelete(record._id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="6" style={{textAlign:'center'}}>No attendance records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="att-modal-overlay">
          <div className="att-modal">
            <h3>{isEdit ? 'Edit Attendance' : 'Mark Attendance'}</h3>
            {error && <div className="admin-resource-message error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="att-form-group">
                <label>Employee</label>
                <select 
                  value={formData.user} 
                  onChange={e => setFormData({...formData, user: e.target.value})}
                  disabled={isEdit}
                  required
                >
                  <option value="">Select Employee</option>
                  {users.map(u => (
                    <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="att-form-group">
                <label>Date</label>
                <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} disabled={isEdit} required />
              </div>
              <div className="att-form-group">
                <label>Check In</label>
                <input type="datetime-local" value={formData.checkIn} onChange={e => setFormData({...formData, checkIn: e.target.value})} required />
              </div>
              <div className="att-form-group">
                <label>Check Out (Optional)</label>
                <input type="datetime-local" value={formData.checkOut} onChange={e => setFormData({...formData, checkOut: e.target.value})} />
              </div>
              <div className="att-form-group">
                <label>Status</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} required>
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="Late">Late</option>
                  <option value="Half Day">Half Day</option>
                </select>
              </div>
              <div className="att-form-group">
                <label>Notes (Optional)</label>
                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
              </div>
              <div className="att-modal-actions">
                <button type="button" className="att-btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="att-btn att-btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : (isEdit ? 'Save Changes' : 'Mark Attendance')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  return Layout ? <Layout pageTitle="Attendance">{content}</Layout> : content;
}
