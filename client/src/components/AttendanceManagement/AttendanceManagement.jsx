import React, { useEffect, useMemo, useState } from 'react';
import apiClient from '../../services/apiClient';
import './AttendanceManagement.css';

const message = (error) => error.response?.data?.message || 'Unable to process request.';
const showTime = (value) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
const toLocalISO = (date) => new Date(date).toISOString().slice(0, 16);
const getEmployeeName = (u, record) => {
  const emp = u || record?.employee;
  if (record?.employeeName && record.employeeName !== 'Unknown Employee') return record.employeeName;
  if (!emp) return record?.isOrphaned ? 'Unknown Employee' : '—';
  if (typeof emp === 'string') return emp;
  if (emp.name) return emp.name;
  const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
  if (name) return name;
  if (emp.personalInfo?.fullName) return emp.personalInfo.fullName;
  if (emp.email) return emp.email.split('@')[0];
  return record?.isOrphaned ? 'Unknown Employee' : '—';
};

export default function AttendanceManagement({ Layout, title = "Attendance Management" }) {
  // Main Toggle: 'Employee' vs 'Training'
  const [attendanceType, setAttendanceType] = useState('Employee');

  /* ─────────────────────────────────────────────────────────────
     EMPLOYEE ATTENDANCE STATE & LOGIC (PRESERVED 100%)
  ───────────────────────────────────────────────────────────── */
  const [records, setRecords] = useState([]);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Employee Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Employee Form State
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formData, setFormData] = useState({ id: '', user: '', date: '', checkIn: '', checkOut: '', status: 'Present', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = async () => {
    try {
      const response = await apiClient.get('/users');
      const emps = (response.data.data || []).filter((u) => u.isActive !== false);
      setUsers(emps);
    } catch (e) {
      console.error('Failed to load users', e);
    }
  };

  const loadEmployeeAttendance = async () => {
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

  useEffect(() => {
    if (attendanceType === 'Employee') {
      loadEmployeeAttendance();
    }
  }, [date, attendanceType]);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (records && records.length) {
      records.forEach((r) => {
        if (r.isOrphaned) {
          console.warn(`[Attendance Warning] Attendance record ID "${r._id}" has an unresolvable employee reference ID "${r.employeeId}".`);
        }
      });
    }
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const name = getEmployeeName(r.user, r).toLowerCase();
      const email = (r.user?.email || r.employee?.email || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || name.includes(q) || email.includes(q);
      const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [records, searchQuery, statusFilter]);

  const summary = useMemo(() => ({
    present: filteredRecords.filter((x) => x.status === 'Present').length,
    absent: filteredRecords.filter((x) => x.status === 'Absent').length,
    late: filteredRecords.filter((x) => x.status === 'Late').length,
    leave: filteredRecords.filter((x) => x.status === 'Half Day' || x.status === 'Leave').length,
    total: filteredRecords.length,
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
      loadEmployeeAttendance();
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
      loadEmployeeAttendance();
    } catch (err) {
      alert(message(err));
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await apiClient.put(`/attendance/${id}`, { status: newStatus });
      loadEmployeeAttendance();
    } catch (err) {
      alert(message(err));
    }
  };


  /* ─────────────────────────────────────────────────────────────
     TRAINING ATTENDANCE STATE & LOGIC (REAL MONGODB PERSISTENCE)
  ───────────────────────────────────────────────────────────── */
  const [trainingPrograms, setTrainingPrograms] = useState([]);
  const [selectedTraining, setSelectedTraining] = useState('All');
  const [trainingSessions, setTrainingSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('All');
  const [trainingAssignments, setTrainingAssignments] = useState([]);
  const [trainingAttendanceRecords, setTrainingAttendanceRecords] = useState([]);
  
  // Training Filters
  const [trainingStatusFilter, setTrainingStatusFilter] = useState('All');
  const [trainingSearchQuery, setTrainingSearchQuery] = useState('');
  const [trainingDate, setTrainingDate] = useState('');

  // Training Mark Modal State
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [isTrainingEdit, setIsTrainingEdit] = useState(false);
  const [trainingFormData, setTrainingFormData] = useState({
    id: '',
    program: '',
    session: '',
    date: new Date().toISOString().slice(0, 10),
    remarks: ''
  });
  const [traineeRows, setTraineeRows] = useState([]);
  const [trainingSubmitting, setTrainingSubmitting] = useState(false);

  const loadTrainingData = async () => {
    setLoading(true);
    try {
      const [progsRes, sessRes, assignRes, attRes] = await Promise.all([
        apiClient.get('/training/programs').catch(() => ({ data: { data: [] } })),
        apiClient.get('/training/sessions').catch(() => ({ data: { data: [] } })),
        apiClient.get('/training/assignments').catch(() => ({ data: { data: [] } })),
        apiClient.get('/training/attendance').catch(() => ({ data: { data: [] } }))
      ]);
      setTrainingPrograms(progsRes.data?.data || []);
      setTrainingSessions(sessRes.data?.data || []);
      setTrainingAssignments(assignRes.data?.data || []);
      setTrainingAttendanceRecords(attRes.data?.data || []);
      setError('');
    } catch (e) {
      console.error('Failed to load training data', e);
      setError(message(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (attendanceType === 'Training') {
      loadTrainingData();
    }
  }, [attendanceType]);

  // Dynamic Sessions based on selected Training Program
  const availableSessions = useMemo(() => {
    if (selectedTraining === 'All' || !selectedTraining) return trainingSessions;
    return trainingSessions.filter((s) => {
      const pId = typeof s.program === 'object' ? s.program?._id : s.program;
      return pId === selectedTraining;
    });
  }, [trainingSessions, selectedTraining]);

  // Dynamic Assignments / Trainees based on selected Training Program
  const availableAssignments = useMemo(() => {
    if (selectedTraining === 'All' || !selectedTraining) return trainingAssignments;
    return trainingAssignments.filter((a) => {
      const pId = typeof a.program === 'object' ? a.program?._id : a.program;
      return pId === selectedTraining;
    });
  }, [trainingAssignments, selectedTraining]);

  // Filtered Training Attendance Records for display table
  const filteredTrainingRecords = useMemo(() => {
    return trainingAttendanceRecords.filter((r) => {
      // Program filter
      if (selectedTraining !== 'All' && selectedTraining) {
        const progId = r.session?.program?._id || r.session?.program;
        if (progId !== selectedTraining) return false;
      }
      // Session filter
      if (selectedSession !== 'All' && selectedSession) {
        const sessId = r.session?._id || r.session;
        if (sessId !== selectedSession) return false;
      }
      // Status filter
      if (trainingStatusFilter !== 'All' && r.status !== trainingStatusFilter) return false;
      // Date filter
      if (trainingDate) {
        const rDate = r.date ? new Date(r.date).toISOString().slice(0, 10) : '';
        if (rDate !== trainingDate) return false;
      }
      // Search Query
      if (trainingSearchQuery) {
        const empName = getEmployeeName(r.employee).toLowerCase();
        const empEmail = r.employee?.email ? r.employee.email.toLowerCase() : '';
        const q = trainingSearchQuery.toLowerCase();
        if (!empName.includes(q) && !empEmail.includes(q)) return false;
      }
      return true;
    });
  }, [trainingAttendanceRecords, selectedTraining, selectedSession, trainingStatusFilter, trainingDate, trainingSearchQuery]);

  // Training Dynamic Attendance Summary (KPIs)
  const trainingSummary = useMemo(() => {
    const assignedEmpIds = new Set(availableAssignments.map((a) => a.employee?._id || a.employee).filter(Boolean));
    const totalTrainees = assignedEmpIds.size || (availableAssignments.length > 0 ? availableAssignments.length : users.length);
    
    const present = filteredTrainingRecords.filter((x) => x.status === 'Present').length;
    const late = filteredTrainingRecords.filter((x) => x.status === 'Late').length;
    const absent = filteredTrainingRecords.filter((x) => x.status === 'Absent').length;
    const leave = filteredTrainingRecords.filter((x) => x.status === 'Half Day' || x.status === 'Leave' || x.status === 'Excused').length;
    
    const pct = totalTrainees > 0 
      ? Math.min(100, Math.round(((present + late) / totalTrainees) * 100))
      : (filteredTrainingRecords.length > 0 ? Math.round(((present + late) / filteredTrainingRecords.length) * 100) : 0);

    return {
      totalTrainees,
      present,
      late,
      absent,
      leave,
      pct
    };
  }, [availableAssignments, filteredTrainingRecords, users]);

  // Open Training Mark Attendance Modal
  const openTrainingModal = (record = null) => {
    setError('');
    if (record) {
      setIsTrainingEdit(true);
      const progId = record.session?.program?._id || record.session?.program || '';
      const sessId = record.session?._id || record.session || '';
      setTrainingFormData({
        id: record._id,
        program: progId,
        session: sessId,
        date: record.date ? new Date(record.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        remarks: record.remarks || ''
      });
      setTraineeRows([{
        employee: record.employee?._id || record.employee,
        name: getEmployeeName(record.employee),
        email: record.employee?.email || '',
        status: record.status || 'Present',
        checkIn: record.checkIn || '09:00',
        checkOut: record.checkOut || '17:00',
        remarks: record.remarks || ''
      }]);
    } else {
      setIsTrainingEdit(false);
      const firstProg = selectedTraining !== 'All' ? selectedTraining : (trainingPrograms[0]?._id || '');
      const progSessions = trainingSessions.filter((s) => (s.program?._id || s.program) === firstProg);
      const firstSess = selectedSession !== 'All' ? selectedSession : (progSessions[0]?._id || trainingSessions[0]?._id || '');
      
      setTrainingFormData({
        id: '',
        program: firstProg,
        session: firstSess,
        date: new Date().toISOString().slice(0, 10),
        remarks: ''
      });

      // Load Trainees assigned to firstProg or all employees
      populateTraineeRows(firstProg);
    }
    setShowTrainingModal(true);
  };

  const populateTraineeRows = (progId) => {
    let assigned = trainingAssignments;
    if (progId && progId !== 'All') {
      assigned = trainingAssignments.filter((a) => (a.program?._id || a.program) === progId);
    }

    if (assigned.length > 0) {
      const rows = assigned.map((a) => {
        const emp = a.employee;
        return {
          employee: emp?._id || emp,
          name: getEmployeeName(emp),
          email: emp?.email || '',
          status: 'Present',
          checkIn: '09:00',
          checkOut: '17:00',
          remarks: ''
        };
      });
      setTraineeRows(rows);
    } else {
      // Fallback to active users
      const rows = users.map((u) => ({
        employee: u._id,
        name: getEmployeeName(u),
        email: u.email || '',
        status: 'Present',
        checkIn: '09:00',
        checkOut: '17:00',
        remarks: ''
      }));
      setTraineeRows(rows);
    }
  };

  const handleProgramSelectInModal = (progId) => {
    const progSessions = trainingSessions.filter((s) => (s.program?._id || s.program) === progId);
    setTrainingFormData({
      ...trainingFormData,
      program: progId,
      session: progSessions[0]?._id || ''
    });
    populateTraineeRows(progId);
  };

  const handleMarkAllPresent = () => {
    setTraineeRows((prev) => prev.map((r) => ({ ...r, status: 'Present' })));
  };

  const handleTrainingSubmit = async (e) => {
    e.preventDefault();
    setTrainingSubmitting(true);
    setError('');

    try {
      if (!trainingFormData.session) throw new Error('Please select a Training Session');
      if (!traineeRows || traineeRows.length === 0) throw new Error('No trainees available to mark attendance');

      if (isTrainingEdit && trainingFormData.id) {
        // Update single record
        const singleRow = traineeRows[0];
        await apiClient.put(`/training/attendance/${trainingFormData.id}`, {
          session: trainingFormData.session,
          employee: singleRow.employee,
          date: trainingFormData.date,
          status: singleRow.status,
          checkIn: singleRow.checkIn,
          checkOut: singleRow.checkOut,
          remarks: singleRow.remarks
        });
      } else {
        // Bulk upsert records to prevent duplicates for (session, employee)
        const payloadRecords = traineeRows.map((r) => ({
          employee: r.employee,
          date: trainingFormData.date,
          status: r.status,
          checkIn: r.checkIn,
          checkOut: r.checkOut,
          remarks: r.remarks
        }));

        await apiClient.post('/training/attendance', {
          session: trainingFormData.session,
          records: payloadRecords
        });
      }

      setShowTrainingModal(false);
      loadTrainingData();
    } catch (err) {
      setError(message(err));
    } finally {
      setTrainingSubmitting(false);
    }
  };

  const handleTrainingStatusChange = async (id, newStatus) => {
    try {
      await apiClient.put(`/training/attendance/${id}`, { status: newStatus });
      loadTrainingData();
    } catch (err) {
      alert(message(err));
    }
  };

  const handleTrainingDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this training attendance record?')) return;
    try {
      await apiClient.delete(`/training/attendance/${id}`);
      loadTrainingData();
    } catch (err) {
      alert(message(err));
    }
  };

  /* ─────────────────────────────────────────────────────────────
     RENDER CONTENT: UNIFIED DUAL-MODE PAGE
  ───────────────────────────────────────────────────────────── */
  const content = (
    <div className="admin-page att-management-page">
      {/* Top Page Header with Attendance Type Switch */}
      <div className="admin-page-header att-page-header">
        <div className="att-header-left">
          <h2 className="att-page-title">{title}</h2>
          <div className="att-type-toggle">
            <span className="att-type-label">Attendance Type:</span>
            <select
              value={attendanceType}
              onChange={(e) => setAttendanceType(e.target.value)}
              className="att-type-select"
            >
              <option value="Employee">Employee Attendance</option>
              <option value="Training">Training Attendance</option>
            </select>
          </div>
        </div>

        {/* Dynamic Toolbar Based on Mode */}
        {attendanceType === 'Employee' ? (
          <div className="att-toolbar">
            <input
              type="text"
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="att-input att-search-input"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="att-input att-select-input"
            >
              <option value="All">All Status</option>
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Late">Late</option>
              <option value="Half Day">Half Day</option>
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="att-input att-date-input"
            />
            <button className="att-btn att-btn-primary att-btn-mark" onClick={() => openModal()}>
              + Mark Attendance
            </button>
          </div>
        ) : (
          <div className="att-toolbar">
            <select
              value={selectedTraining}
              onChange={(e) => {
                setSelectedTraining(e.target.value);
                setSelectedSession('All');
              }}
              className="att-input att-select-input"
            >
              <option value="All">All Trainings</option>
              {trainingPrograms.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>

            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="att-input att-select-input"
            >
              <option value="All">All Sessions</option>
              {availableSessions.map((s) => (
                <option key={s._id} value={s._id}>{s.sessionTitle}</option>
              ))}
            </select>

            <select
              value={trainingStatusFilter}
              onChange={(e) => setTrainingStatusFilter(e.target.value)}
              className="att-input att-select-input"
            >
              <option value="All">All Status</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Absent">Absent</option>
              <option value="Half Day">Half Day</option>
              <option value="Leave">Leave</option>
              <option value="Excused">Excused</option>
            </select>

            <input
              type="text"
              placeholder="Search trainee..."
              value={trainingSearchQuery}
              onChange={(e) => setTrainingSearchQuery(e.target.value)}
              className="att-input att-search-input"
            />

            <button className="att-btn att-btn-primary att-btn-mark" onClick={() => openTrainingModal()}>
              + Mark Training Attendance
            </button>
          </div>
        )}
      </div>

      {error && !showModal && !showTrainingModal && (
        <div className="admin-resource-message error" style={{ marginBottom: '1rem' }}>{error}</div>
      )}
      
      {/* Dynamic Summary Cards (KPIs) */}
      {attendanceType === 'Employee' ? (
        <div className="admin-overview-panel att-overview-panel">
          <h3>Today's Time Summary</h3>
          <div className="admin-overview-grid">
            <div className="admin-overview-card success">
              <span>Present</span>
              <strong>{summary.present}</strong>
            </div>
            <div className="admin-overview-card warning">
              <span>Late</span>
              <strong>{summary.late}</strong>
            </div>
            <div className="admin-overview-card primary">
              <span>Absent</span>
              <strong>{summary.absent}</strong>
            </div>
            <div className="admin-overview-card info">
              <span>Half Day / Leave</span>
              <strong>{summary.leave}</strong>
            </div>
          </div>
        </div>
      ) : (
        <div className="admin-overview-panel att-overview-panel">
          <h3>Training Attendance Summary & KPIs</h3>
          <div className="admin-overview-grid">
            <div className="admin-overview-card info">
              <span>Total Trainees</span>
              <strong>{trainingSummary.totalTrainees}</strong>
            </div>
            <div className="admin-overview-card success">
              <span>Present</span>
              <strong>{trainingSummary.present}</strong>
            </div>
            <div className="admin-overview-card warning">
              <span>Late</span>
              <strong>{trainingSummary.late}</strong>
            </div>
            <div className="admin-overview-card primary">
              <span>Absent</span>
              <strong>{trainingSummary.absent}</strong>
            </div>
            <div className="admin-overview-card success" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
              <span>Attendance Rate</span>
              <strong style={{ color: '#16a34a' }}>{trainingSummary.pct}%</strong>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Data Table */}
      {attendanceType === 'Employee' ? (
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
                <tr><td colSpan="6" style={{textAlign:'center', padding: '2rem'}}>Loading attendance records...</td></tr>
              ) : filteredRecords.length ? (
                filteredRecords.map((record) => (
                  <tr key={record._id}>
                    <td>{getEmployeeName(record.user, record)}</td>
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
                <tr><td colSpan="6" style={{textAlign:'center', padding: '2rem'}}>No attendance records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="attendance-table admin-card">
          <table>
            <thead>
              <tr>
                <th>Trainee</th>
                <th>Training Program</th>
                <th>Session</th>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{textAlign:'center', padding: '2rem'}}>Loading training attendance records...</td></tr>
              ) : filteredTrainingRecords.length ? (
                filteredTrainingRecords.map((record) => (
                  <tr key={record._id}>
                    <td>
                      <div>
                        <strong>{getEmployeeName(record.employee)}</strong>
                        {record.employee?.email && <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{record.employee.email}</div>}
                      </div>
                    </td>
                    <td>{record.session?.program?.name || record.session?.course?.title || 'Training'}</td>
                    <td>{record.session?.sessionTitle || 'Session'}</td>
                    <td>{record.date ? new Date(record.date).toLocaleDateString() : '—'}</td>
                    <td>{record.checkIn || '09:00'}</td>
                    <td>{record.checkOut || '17:00'}</td>
                    <td>
                      <select 
                        className={`att-status-select ${(record.status || 'Present').toLowerCase().replace(' ', '-')}`}
                        value={record.status || 'Present'}
                        onChange={(e) => handleTrainingStatusChange(record._id, e.target.value)}
                      >
                        <option value="Present">Present</option>
                        <option value="Late">Late</option>
                        <option value="Absent">Absent</option>
                        <option value="Half Day">Half Day</option>
                        <option value="Leave">Leave</option>
                        <option value="Excused">Excused</option>
                      </select>
                    </td>
                    <td>
                      <div className="att-actions">
                        <button className="att-btn-sm" onClick={() => openTrainingModal(record)}>Edit</button>
                        <button className="att-btn-sm att-btn-danger" onClick={() => handleTrainingDelete(record._id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="8" style={{textAlign:'center', padding: '2rem'}}>No training attendance records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* EMPLOYEE ATTENDANCE MODAL (PRESERVED) */}
      {showModal && (
        <div className="att-modal-overlay">
          <div className="att-modal">
            <h3>{isEdit ? 'Edit Attendance' : 'Mark Attendance'}</h3>
            {error && <div className="admin-resource-message error" style={{ marginBottom: '1rem' }}>{error}</div>}
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

      {/* TRAINING ATTENDANCE MODAL (SESSION-BASED MARK ATTENDANCE) */}
      {showTrainingModal && (
        <div className="att-modal-overlay">
          <div className="att-modal large">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>{isTrainingEdit ? 'Edit Training Attendance' : 'Mark Session Training Attendance'}</h3>
              <button
                type="button"
                className="att-btn att-btn-sm"
                onClick={handleMarkAllPresent}
                title="Set status of all listed trainees to Present"
              >
                ✓ Mark All Present
              </button>
            </div>

            {error && <div className="admin-resource-message error" style={{ marginBottom: '1rem' }}>{error}</div>}

            <form onSubmit={handleTrainingSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div className="att-form-group" style={{ marginBottom: 0 }}>
                  <label>Training Program</label>
                  <select
                    value={trainingFormData.program}
                    onChange={(e) => handleProgramSelectInModal(e.target.value)}
                    required
                  >
                    <option value="">Select Training Program</option>
                    {trainingPrograms.map((p) => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="att-form-group" style={{ marginBottom: 0 }}>
                  <label>Session</label>
                  <select
                    value={trainingFormData.session}
                    onChange={(e) => setTrainingFormData({ ...trainingFormData, session: e.target.value })}
                    required
                  >
                    <option value="">Select Session</option>
                    {trainingSessions
                      .filter((s) => !trainingFormData.program || (s.program?._id || s.program) === trainingFormData.program)
                      .map((s) => (
                        <option key={s._id} value={s._id}>{s.sessionTitle}</option>
                      ))}
                  </select>
                </div>

                <div className="att-form-group" style={{ marginBottom: 0 }}>
                  <label>Date</label>
                  <input
                    type="date"
                    value={trainingFormData.date}
                    onChange={(e) => setTrainingFormData({ ...trainingFormData, date: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Trainees List Table */}
              <div style={{ marginTop: '1rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.5rem' }}>
                  Assigned Trainees ({traineeRows.length})
                </label>
                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <table className="att-trainees-table">
                    <thead>
                      <tr>
                        <th>Trainee Name</th>
                        <th>Status</th>
                        <th>Check In</th>
                        <th>Check Out</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {traineeRows.length === 0 ? (
                        <tr><td colSpan="5" style={{ textAlign: 'center', color: '#64748b' }}>No trainees assigned to this training program.</td></tr>
                      ) : (
                        traineeRows.map((row, idx) => (
                          <tr key={row.employee || idx}>
                            <td>
                              <strong>{row.name}</strong>
                              {row.email && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{row.email}</div>}
                            </td>
                            <td>
                              <select
                                value={row.status}
                                onChange={(e) => {
                                  const updated = [...traineeRows];
                                  updated[idx].status = e.target.value;
                                  setTraineeRows(updated);
                                }}
                                className={`att-status-select ${row.status.toLowerCase().replace(' ', '-')}`}
                              >
                                <option value="Present">Present</option>
                                <option value="Late">Late</option>
                                <option value="Absent">Absent</option>
                                <option value="Half Day">Half Day</option>
                                <option value="Leave">Leave</option>
                                <option value="Excused">Excused</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="time"
                                value={row.checkIn}
                                onChange={(e) => {
                                  const updated = [...traineeRows];
                                  updated[idx].checkIn = e.target.value;
                                  setTraineeRows(updated);
                                }}
                                style={{ width: '90px', padding: '0.25rem', fontSize: '0.8rem' }}
                              />
                            </td>
                            <td>
                              <input
                                type="time"
                                value={row.checkOut}
                                onChange={(e) => {
                                  const updated = [...traineeRows];
                                  updated[idx].checkOut = e.target.value;
                                  setTraineeRows(updated);
                                }}
                                style={{ width: '90px', padding: '0.25rem', fontSize: '0.8rem' }}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                placeholder="Remarks..."
                                value={row.remarks}
                                onChange={(e) => {
                                  const updated = [...traineeRows];
                                  updated[idx].remarks = e.target.value;
                                  setTraineeRows(updated);
                                }}
                                style={{ width: '100%', padding: '0.25rem', fontSize: '0.8rem' }}
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="att-modal-actions" style={{ marginTop: '1.25rem' }}>
                <button type="button" className="att-btn" onClick={() => setShowTrainingModal(false)}>Cancel</button>
                <button type="submit" className="att-btn att-btn-primary" disabled={trainingSubmitting}>
                  {trainingSubmitting ? 'Saving...' : 'Save Training Attendance'}
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
