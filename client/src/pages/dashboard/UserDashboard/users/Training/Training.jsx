import { useState, useEffect } from 'react';
import apiClient from '../../../../../services/apiClient';
import UserLayout from '../components/UserLayout';
import CustomSelect from '../../../../../components/common/CustomSelect';
import './HRTrainingManagement.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'programs', label: 'Programs' },
  { id: 'courses', label: 'Courses' },
  { id: 'trainers', label: 'Trainers' },
  { id: 'sessions', label: 'Schedule & Sessions' },
  { id: 'assignments', label: 'Employee Assignments' },
  { id: 'progress', label: 'Progress Tracking' },
  { id: 'assessments', label: 'Assessments' },
  { id: 'certifications', label: 'Certifications' },
  { id: 'completion', label: 'Completion Records' },
  { id: 'costs', label: 'Cost Management' },
  { id: 'cost-reports', label: 'Cost Reports' },
];

const ROW1_TABS = TABS.slice(0, 6);
const ROW2_TABS = TABS.slice(6);

const formatDate = (v) => {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(v);
  }
};

const getEmpName = (emp) => {
  if (!emp) return 'Unassigned';
  if (typeof emp === 'string') return emp;
  return [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.name || emp.email || 'Employee';
};

export default function Training() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

  // Core Lookup Data
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Dynamic Data States
  const [overview, setOverview] = useState({});
  const [programs, setPrograms] = useState([]);
  const [courses, setCourses] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [progressData, setProgressData] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [certifications, setCertifications] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [completionData, setCompletionData] = useState([]);
  const [costs, setCosts] = useState([]);
  const [costReports, setCostReports] = useState({});

  // Search & Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterProgram, setFilterProgram] = useState('All');
  const [filterDept, setFilterDept] = useState('All');
  const [filterTrainer, setFilterTrainer] = useState('All');

  // Modals
  const [showModal, setShowModal] = useState(null); // 'program' | 'course' | 'trainer' | 'session' | 'assignment' | 'attendance' | 'assessment' | 'certification' | 'feedback' | 'cost'
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});

  // Dedicated Certificate Generation & Preview Modals
  const [showGenCertModal, setShowGenCertModal] = useState(false);
  const [genCertForm, setGenCertForm] = useState({ employee: '', program: '', course: '', assignment: '' });
  const [previewCert, setPreviewCert] = useState(null);

  // Multi-employee selection for assignment
  const [selectedEmployees, setSelectedEmployees] = useState([]);

  const showToastMsg = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 3500);
  };

  // Initial Load Lookups & Tab Data
  useEffect(() => {
    // Fetch departments
    apiClient.get('/admin/departments')
      .catch(() => apiClient.get('/departments'))
      .then((res) => setDepartments(res.data?.data || []))
      .catch(() => {});

    // Fetch employees
    apiClient.get('/admin/employees')
      .catch(() => apiClient.get('/users'))
      .then((res) => setEmployees(res.data?.data || []))
      .catch(() => {});

    // Fetch training programs lookup
    apiClient.get('/training/programs')
      .then((res) => setPrograms(res.data?.data || []))
      .catch(() => {});

    // Fetch training courses lookup
    apiClient.get('/training/courses')
      .then((res) => setCourses(res.data?.data || []))
      .catch(() => {});
  }, []);

  const loadTabData = (tab) => {
    setLoading(true);
    let endpoint = `/training/${tab}`;
    if (tab === 'overview') endpoint = '/training/overview';

    // Build backend filter parameters if set
    const params = {};
    if (search) params.search = search;
    if (filterStatus !== 'All') params.status = filterStatus;
    if (filterProgram !== 'All') params.program = filterProgram;
    if (filterDept !== 'All') params.department = filterDept;
    if (filterTrainer !== 'All') params.trainer = filterTrainer;

    apiClient.get(endpoint, { params })
      .then((res) => {
        const d = res.data?.data;
        if (tab === 'overview') setOverview(d || {});
        else if (tab === 'programs') setPrograms(d || []);
        else if (tab === 'courses') setCourses(d || []);
        else if (tab === 'trainers') setTrainers(d || []);
        else if (tab === 'sessions') setSessions(d || []);
        else if (tab === 'assignments') setAssignments(d || []);
        else if (tab === 'attendance') setAttendance(d || []);
        else if (tab === 'progress') setProgressData(d || []);
        else if (tab === 'assessments') setAssessments(d || []);
        else if (tab === 'certifications') setCertifications(d || []);
        else if (tab === 'feedback') setFeedback(d || []);
        else if (tab === 'completion') setCompletionData(d || []);
        else if (tab === 'costs') setCosts(d || []);
        else if (tab === 'cost-reports') setCostReports(d || {});
      })
      .catch((err) => {
        showToastMsg(err.response?.data?.message || 'Failed to load data', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, search, filterStatus, filterProgram, filterDept, filterTrainer]);

  // Handle Main Form Modal Submit
  const handleFormSubmit = async (e) => {
    e.preventDefault();

    // Session validation
    if (showModal === 'session') {
      if (formData.startTime && formData.endTime && formData.endTime <= formData.startTime) {
        showToastMsg('End time cannot be before or equal to start time', 'error');
        return;
      }
    }

    // Cost validation
    if (showModal === 'cost') {
      if (!formData.title || !formData.title.trim()) {
        showToastMsg('Please enter an expense title', 'error');
        return;
      }
      const amt = Number(formData.amount || formData.totalCost || 0);
      if (!amt || amt <= 0) {
        showToastMsg('Please enter a valid cost amount greater than 0', 'error');
        return;
      }
      if (!formData.dateIncurred) {
        showToastMsg('Please select date incurred', 'error');
        return;
      }
    }

    setLoading(true);

    try {
      let url = `/training/${showModal}s`;
      if (showModal === 'attendance') url = '/training/attendance';
      if (showModal === 'feedback') url = '/training/feedback';

      if (editingItem) {
        url = `${url}/${editingItem._id}`;
        let payload = { ...formData };
        if (showModal === 'cost') {
          const amt = Number(formData.amount || formData.totalCost || 0);
          const cat = formData.category || 'Trainer Fee';
          payload = {
            ...formData,
            title: formData.title.trim(),
            totalCost: amt,
            courseFee: cat === 'Course Fee' ? amt : 0,
            trainerFee: cat === 'Trainer Fee' ? amt : 0,
            venueCost: cat === 'Venue' ? amt : 0,
            materialsCost: cat === 'Materials' ? amt : 0,
            travelCost: cat === 'Certification' || cat === 'Travel' ? amt : 0,
            otherCost: cat === 'Other' ? amt : 0,
            dateIncurred: formData.dateIncurred,
            notes: formData.notes || '',
          };
          if (!payload.program) delete payload.program;
          if (!payload.course) delete payload.course;
          if (!payload.session) delete payload.session;
        }
        await apiClient.put(url, payload);
        showToastMsg('Updated successfully');
      } else {
        let payload = { ...formData };
        if (showModal === 'assignment' && selectedEmployees.length > 0) {
          payload.employees = selectedEmployees;
        }
        if (showModal === 'cost') {
          const amt = Number(formData.amount || formData.totalCost || 0);
          const cat = formData.category || 'Trainer Fee';
          payload = {
            ...formData,
            title: formData.title.trim(),
            totalCost: amt,
            courseFee: cat === 'Course Fee' ? amt : 0,
            trainerFee: cat === 'Trainer Fee' ? amt : 0,
            venueCost: cat === 'Venue' ? amt : 0,
            materialsCost: cat === 'Materials' ? amt : 0,
            travelCost: cat === 'Certification' || cat === 'Travel' ? amt : 0,
            otherCost: cat === 'Other' ? amt : 0,
            dateIncurred: formData.dateIncurred,
            notes: formData.notes || '',
          };
          if (!payload.program) delete payload.program;
          if (!payload.course) delete payload.course;
          if (!payload.session) delete payload.session;
        }
        await apiClient.post(url, payload);
        showToastMsg('Created successfully');
      }

      setShowModal(null);
      setEditingItem(null);
      setFormData({});
      setSelectedEmployees([]);
      loadTabData(activeTab);
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Operation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Generate Certification Handler
  const handleGenerateCertSubmit = async (e) => {
    e.preventDefault();
    if (!genCertForm.employee || !genCertForm.course) {
      showToastMsg('Please select employee and course', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post('/training/certifications/generate', genCertForm);
      showToastMsg(res.data?.message || 'Certification generated successfully!');
      setShowGenCertModal(false);
      setGenCertForm({ employee: '', program: '', course: '', assignment: '' });
      loadTabData('certifications');
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to generate certification', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Revoke Certification Handler
  const handleRevokeCert = async (certId) => {
    if (!window.confirm('Are you sure you want to revoke this certificate?')) return;
    setLoading(true);
    try {
      await apiClient.post(`/training/certifications/${certId}/revoke`);
      showToastMsg('Certificate revoked successfully');
      loadTabData('certifications');
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to revoke certificate', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Delete Item
  const handleDelete = async (type, id) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    setLoading(true);
    try {
      let endpoint = `/training/${type}s/${id}`;
      if (type === 'attendance') endpoint = `/training/attendance/${id}`;
      if (type === 'feedback') endpoint = `/training/feedback/${id}`;
      await apiClient.delete(endpoint);
      showToastMsg('Deleted successfully');
      loadTabData(activeTab);
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to delete', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Open Create Modal
  const openCreateModal = (type) => {
    setEditingItem(null);
    setSelectedEmployees([]);
    if (type === 'cost') {
      if (programs.length === 0) apiClient.get('/training/programs').then(res => setPrograms(res.data?.data || [])).catch(() => {});
      if (courses.length === 0) apiClient.get('/training/courses').then(res => setCourses(res.data?.data || [])).catch(() => {});
      setFormData({
        category: 'Trainer Fee',
        dateIncurred: new Date().toISOString().slice(0, 10),
      });
    } else {
      setFormData({});
    }
    setShowModal(type);
  };

  // Open Edit Modal
  const openEditModal = (type, item) => {
    setEditingItem(item);
    if (type === 'cost') {
      if (programs.length === 0) apiClient.get('/training/programs').then(res => setPrograms(res.data?.data || [])).catch(() => {});
      if (courses.length === 0) apiClient.get('/training/courses').then(res => setCourses(res.data?.data || [])).catch(() => {});
      let category = 'Other';
      if (item.trainerFee > 0) category = 'Trainer Fee';
      else if (item.courseFee > 0) category = 'Course Fee';
      else if (item.venueCost > 0) category = 'Venue';
      else if (item.materialsCost > 0) category = 'Materials';
      else if (item.travelCost > 0) category = 'Certification';

      setFormData({
        ...item,
        program: item.program?._id || item.program || '',
        course: item.course?._id || item.course || '',
        title: item.title || '',
        category,
        amount: item.totalCost || 0,
        dateIncurred: item.dateIncurred ? new Date(item.dateIncurred).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        notes: item.notes || '',
      });
    } else {
      setFormData({ ...item });
    }
    setShowModal(type);
  };

  /* ──────────────── RENDER TAB CONTENTS ──────────────── */

  const renderOverview = () => {
    const upcomingSessionsList = overview.upcomingSessions || [];
    const progData = overview.trainingProgress || {
      completedPct: overview.kpis?.completionRate || overview.completionRate || 0,
      inProgressPct: 0,
      notStartedPct: 100 - (overview.kpis?.completionRate || overview.completionRate || 0),
      totalEnrollments: overview.kpis?.totalAssignments || overview.totalAssignments || 0
    };
    const recentActivity = overview.recentActivity || [];
    const topPrograms = overview.topPrograms || [];

    return (
      <div>
        {/* Row 1: Upcoming Sessions | Training Progress */}
        <div className="hrtm-overview-grid">
          {/* Upcoming Sessions Widget */}
          <div className="hrtm-card">
            <div className="hrtm-card-header">
              <h4>Upcoming Sessions</h4>
              <button className="hrtm-btn hrtm-btn-secondary hrtm-btn-sm" onClick={() => setActiveTab('sessions')}>View All</button>
            </div>
            <div className="hrtm-table-wrap">
              <table className="hrtm-table">
                <thead>
                  <tr>
                    <th>Session & Date</th>
                    <th>Program / Course</th>
                    <th>Trainer</th>
                    <th>Enrolled</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingSessionsList.length === 0 ? (
                    <tr><td colSpan="6" className="hrtm-empty">No upcoming training sessions</td></tr>
                  ) : (
                    upcomingSessionsList.map(s => (
                      <tr key={s._id}>
                        <td>
                          <strong>{s.sessionTitle}</strong>
                          <br /><small style={{ color: '#64748b' }}>{formatDate(s.sessionDate)} ({s.startTime || 'TBD'})</small>
                        </td>
                        <td>{s.program?.name} / {s.course?.title}</td>
                        <td>{s.trainer ? (s.trainer.trainerType === 'Internal' ? getEmpName(s.trainer.employee) : s.trainer.name) : '—'}</td>
                        <td><strong>{s.enrolledCount || 0}</strong></td>
                        <td><span className={`hrtm-badge hrtm-badge-${(s.status || '').toLowerCase()}`}><span className="hrtm-badge-dot" />{s.status}</span></td>
                        <td className="hrtm-actions">
                          <button className="hrtm-btn-icon" title="Edit" onClick={() => openEditModal('session', s)}>✏️</button>
                          <button className="hrtm-btn-icon" title="Cancel" onClick={() => handleDelete('session', s._id)}>🗑️</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Training Progress Widget */}
          <div className="hrtm-card">
            <div className="hrtm-card-header">
              <h4>Training Progress</h4>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <div className="hrtm-progress-summary">
                <div
                  className="hrtm-progress-circle"
                  style={{
                    '--comp-pct': `${progData.completedPct || 0}%`,
                    '--inprog-pct': `${(progData.completedPct || 0) + (progData.inProgressPct || 0)}%`
                  }}
                >
                  <div className="hrtm-progress-circle-inner">
                    <strong>{progData.completedPct || 0}%</strong>
                    <span>Completed</span>
                  </div>
                </div>
                <div className="hrtm-legend-list">
                  <div className="hrtm-legend-item">
                    <span className="hrtm-legend-dot" style={{ background: '#22c55e' }} />
                    <span>Completed: <strong>{progData.completedPct || 0}%</strong> ({progData.completedCount || 0})</span>
                  </div>
                  <div className="hrtm-legend-item">
                    <span className="hrtm-legend-dot" style={{ background: '#3b82f6' }} />
                    <span>In Progress: <strong>{progData.inProgressPct || 0}%</strong> ({progData.inProgressCount || 0})</span>
                  </div>
                  <div className="hrtm-legend-item">
                    <span className="hrtm-legend-dot" style={{ background: '#cbd5e1' }} />
                    <span>Not Started: <strong>{progData.notStartedPct || 0}%</strong> ({progData.notStartedCount || 0})</span>
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: '#64748b' }}>
                    Total Enrollments: <strong>{progData.totalEnrollments || 0}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Recent Training Activity | Top Performing Programs */}
        <div className="hrtm-overview-grid">
          {/* Recent Training Activity */}
          <div className="hrtm-card">
            <div className="hrtm-card-header">
              <h4>Recent Training Activity</h4>
              <button className="hrtm-btn hrtm-btn-secondary hrtm-btn-sm" onClick={() => setActiveTab('assignments')}>View All</button>
            </div>
            <div className="hrtm-table-wrap">
              <table className="hrtm-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Program / Course</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.length === 0 ? (
                    <tr><td colSpan="4" className="hrtm-empty">No recent training activity</td></tr>
                  ) : (
                    recentActivity.map(act => (
                      <tr key={act._id}>
                        <td><strong>{getEmpName(act.employee)}</strong></td>
                        <td>{act.program?.name} / {act.course?.title}</td>
                        <td><span className={`hrtm-badge hrtm-badge-${(act.status || '').toLowerCase().replace(' ', '-')}`}><span className="hrtm-badge-dot" />{act.status}</span></td>
                        <td>{formatDate(act.updatedAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Performing Programs */}
          <div className="hrtm-card">
            <div className="hrtm-card-header">
              <h4>Top Performing Programs</h4>
              <button className="hrtm-btn hrtm-btn-secondary hrtm-btn-sm" onClick={() => setActiveTab('programs')}>View All</button>
            </div>
            <div className="hrtm-table-wrap">
              <table className="hrtm-table">
                <thead>
                  <tr>
                    <th>Program</th>
                    <th>Participants</th>
                    <th>Completion Rate</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {topPrograms.length === 0 ? (
                    <tr><td colSpan="4" className="hrtm-empty">No performance data available</td></tr>
                  ) : (
                    topPrograms.map(tp => (
                      <tr key={tp._id}>
                        <td><strong>{tp.name}</strong></td>
                        <td><strong>{tp.participants}</strong> enrolled</td>
                        <td><span className="hrtm-badge hrtm-badge-active">{tp.completionRate}%</span></td>
                        <td>
                          <div className="hrtm-progress-cell">
                            <div className="hrtm-progress-bar">
                              <div className="hrtm-progress-fill" style={{ width: `${tp.completionRate}%` }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPrograms = () => {
    const list = programs.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));
    return (
      <div className="hrtm-card">
        <div className="hrtm-card-header">
          <h4>Training Programs</h4>
          <button className="hrtm-btn hrtm-btn-primary hrtm-btn-sm" onClick={() => openCreateModal('program')}>+ Create Program</button>
        </div>
        <div className="hrtm-table-wrap">
          <table className="hrtm-table">
            <thead>
              <tr>
                <th>Program Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Budget</th>
                <th>Dates</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan="6" className="hrtm-empty">No training programs found</td></tr>
              ) : list.map(p => (
                <tr key={p._id}>
                  <td><strong>{p.name}</strong><br/><small style={{color:'#64748b'}}>{p.description}</small></td>
                  <td><span className="hrtm-badge hrtm-badge-internal">{p.trainingType}</span></td>
                  <td><span className={`hrtm-badge hrtm-badge-${(p.status||'').toLowerCase()}`}><span className="hrtm-badge-dot"/>{p.status}</span></td>
                  <td>₹{(p.budget||0).toLocaleString()}</td>
                  <td>{formatDate(p.startDate)} – {formatDate(p.endDate)}</td>
                  <td className="hrtm-actions">
                    <button className="hrtm-btn-icon" onClick={() => openEditModal('program', p)}>✏️</button>
                    <button className="hrtm-btn-icon" onClick={() => handleDelete('program', p._id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCourses = () => {
    const list = courses.filter(c => c.title?.toLowerCase().includes(search.toLowerCase()));
    return (
      <div className="hrtm-card">
        <div className="hrtm-card-header">
          <h4>Course Catalog</h4>
          <button className="hrtm-btn hrtm-btn-primary hrtm-btn-sm" onClick={() => openCreateModal('course')}>+ Add Course</button>
        </div>
        <div className="hrtm-table-wrap">
          <table className="hrtm-table">
            <thead>
              <tr>
                <th>Course Title</th>
                <th>Category</th>
                <th>Difficulty</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan="6" className="hrtm-empty">No courses found</td></tr>
              ) : list.map(c => (
                <tr key={c._id}>
                  <td><strong>{c.title}</strong> {c.code && <small>({c.code})</small>}<br/><small style={{color:'#64748b'}}>{c.description}</small></td>
                  <td>{c.category}</td>
                  <td><span className={`hrtm-badge hrtm-badge-${(c.difficulty||'').toLowerCase()}`}>{c.difficulty}</span></td>
                  <td>{c.durationHours} hrs</td>
                  <td><span className={`hrtm-badge hrtm-badge-${(c.status||'').toLowerCase()}`}><span className="hrtm-badge-dot"/>{c.status}</span></td>
                  <td className="hrtm-actions">
                    <button className="hrtm-btn-icon" onClick={() => openEditModal('course', c)}>✏️</button>
                    <button className="hrtm-btn-icon" onClick={() => handleDelete('course', c._id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderTrainers = () => {
    const list = trainers.filter(t => (t.name || getEmpName(t.employee))?.toLowerCase().includes(search.toLowerCase()));
    return (
      <div className="hrtm-card">
        <div className="hrtm-card-header">
          <h4>Trainer Registry</h4>
        </div>
        <div className="hrtm-table-wrap">
          <table className="hrtm-table">
            <thead>
              <tr>
                <th>Trainer</th>
                <th>Type</th>
                <th>Organization / Expertise</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan="6" className="hrtm-empty">No trainers found</td></tr>
              ) : list.map(t => (
                <tr key={t._id}>
                  <td><strong>{t.trainerType === 'Internal' ? getEmpName(t.employee) : t.name}</strong></td>
                  <td><span className={`hrtm-badge hrtm-badge-${(t.trainerType||'').toLowerCase()}`}>{t.trainerType}</span></td>
                  <td>{t.organization || (t.expertise || []).join(', ') || '—'}</td>
                  <td>{t.email || t.phone || '—'}</td>
                  <td><span className={`hrtm-badge hrtm-badge-${(t.status||'').toLowerCase()}`}><span className="hrtm-badge-dot"/>{t.status}</span></td>
                  <td className="hrtm-actions">
                    <button className="hrtm-btn-icon" onClick={() => openEditModal('trainer', t)}>✏️</button>
                    <button className="hrtm-btn-icon" onClick={() => handleDelete('trainer', t._id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSessions = () => {
    const list = sessions.filter(s => s.sessionTitle?.toLowerCase().includes(search.toLowerCase()));
    return (
      <div className="hrtm-card">
        <div className="hrtm-card-header">
          <h4>Training Sessions & Schedule</h4>
          <button className="hrtm-btn hrtm-btn-primary hrtm-btn-sm" onClick={() => openCreateModal('session')}>+ Schedule Session</button>
        </div>
        <div className="hrtm-table-wrap">
          <table className="hrtm-table">
            <thead>
              <tr>
                <th>Session Title</th>
                <th>Program / Course</th>
                <th>Trainer</th>
                <th>Date & Time</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan="7" className="hrtm-empty">No sessions scheduled</td></tr>
              ) : list.map(s => (
                <tr key={s._id}>
                  <td><strong>{s.sessionTitle}</strong></td>
                  <td>{s.program?.name} / {s.course?.title}</td>
                  <td>{s.trainer ? (s.trainer.trainerType === 'Internal' ? getEmpName(s.trainer.employee) : s.trainer.name) : '—'}</td>
                  <td>{formatDate(s.sessionDate)} ({s.startTime || 'TBD'} - {s.endTime || 'TBD'})</td>
                  <td>{s.location}</td>
                  <td><span className={`hrtm-badge hrtm-badge-${(s.status||'').toLowerCase()}`}><span className="hrtm-badge-dot"/>{s.status}</span></td>
                  <td className="hrtm-actions">
                    <button className="hrtm-btn-icon" onClick={() => openEditModal('session', s)}>✏️</button>
                    <button className="hrtm-btn-icon" onClick={() => handleDelete('session', s._id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAssignments = () => {
    const list = assignments.filter(a => getEmpName(a.employee)?.toLowerCase().includes(search.toLowerCase()));
    return (
      <div className="hrtm-card">
        <div className="hrtm-card-header">
          <h4>Employee Assignments</h4>
          <button className="hrtm-btn hrtm-btn-primary hrtm-btn-sm" onClick={() => openCreateModal('assignment')}>+ Assign Employee(s)</button>
        </div>
        <div className="hrtm-table-wrap">
          <table className="hrtm-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Program</th>
                <th>Course</th>
                <th>Mandatory</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan="7" className="hrtm-empty">No employee assignments found</td></tr>
              ) : list.map(a => (
                <tr key={a._id}>
                  <td><strong>{getEmpName(a.employee)}</strong></td>
                  <td>{a.program?.name}</td>
                  <td>{a.course?.title}</td>
                  <td>{a.isMandatory ? 'Yes' : 'No'}</td>
                  <td>{formatDate(a.dueDate)}</td>
                  <td><span className={`hrtm-badge hrtm-badge-${(a.status||'').toLowerCase().replace(' ','-')}`}><span className="hrtm-badge-dot"/>{a.status}</span></td>
                  <td className="hrtm-actions">
                    <button className="hrtm-btn-icon" onClick={() => openEditModal('assignment', a)}>✏️</button>
                    <button className="hrtm-btn-icon" onClick={() => handleDelete('assignment', a._id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAttendance = () => (
    <div className="hrtm-card">
      <div className="hrtm-card-header">
        <h4>Session Attendance Records</h4>
        <button className="hrtm-btn hrtm-btn-primary hrtm-btn-sm" onClick={() => openCreateModal('attendance')}>+ Record Attendance</button>
      </div>
      <div className="hrtm-table-wrap">
        <table className="hrtm-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Session</th>
              <th>Date</th>
              <th>Status</th>
              <th>Remarks</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {attendance.length === 0 ? (
              <tr><td colSpan="6" className="hrtm-empty">No attendance records found</td></tr>
            ) : attendance.map(att => (
              <tr key={att._id}>
                <td><strong>{getEmpName(att.employee)}</strong></td>
                <td>{att.session?.sessionTitle || '—'}</td>
                <td>{formatDate(att.date)}</td>
                <td><span className={`hrtm-badge hrtm-badge-${(att.status||'').toLowerCase()}`}><span className="hrtm-badge-dot"/>{att.status}</span></td>
                <td>{att.remarks || '—'}</td>
                <td className="hrtm-actions">
                  <button className="hrtm-btn-icon" onClick={() => handleDelete('attendance', att._id)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderProgress = () => (
    <div className="hrtm-card">
      <div className="hrtm-card-header">
        <h4>Employee Progress Tracking</h4>
      </div>
      <div className="hrtm-table-wrap">
        <table className="hrtm-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Program / Course</th>
              <th>Sessions Attended</th>
              <th>Progress</th>
              <th>Assessment Result</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {progressData.length === 0 ? (
              <tr><td colSpan="6" className="hrtm-empty">No progress records available</td></tr>
            ) : progressData.map(p => (
              <tr key={p._id}>
                <td><strong>{getEmpName(p.employee)}</strong></td>
                <td>{p.program?.name} / {p.course?.title}</td>
                <td>{p.attendedSessions} / {p.totalSessions}</td>
                <td>
                  <div className="hrtm-progress-cell">
                    <div className="hrtm-progress-bar">
                      <div className="hrtm-progress-fill" style={{ width: `${p.progressPercent}%` }} />
                    </div>
                    <span>{p.progressPercent}%</span>
                  </div>
                </td>
                <td><span className={`hrtm-badge hrtm-badge-${(p.assessmentResult||'').toLowerCase()}`}>{p.assessmentResult}</span></td>
                <td><span className={`hrtm-badge hrtm-badge-${(p.assignmentStatus||'').toLowerCase().replace(' ','-')}`}>{p.assignmentStatus}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderAssessments = () => (
    <div className="hrtm-card">
      <div className="hrtm-card-header">
        <h4>Training Assessments</h4>
        <button className="hrtm-btn hrtm-btn-primary hrtm-btn-sm" onClick={() => openCreateModal('assessment')}>+ Record Assessment</button>
      </div>
      <div className="hrtm-table-wrap">
        <table className="hrtm-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Course</th>
              <th>Score</th>
              <th>Passing Score</th>
              <th>Result</th>
              <th>Assessment Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {assessments.length === 0 ? (
              <tr><td colSpan="7" className="hrtm-empty">No assessment records found</td></tr>
            ) : assessments.map(ass => (
              <tr key={ass._id}>
                <td><strong>{getEmpName(ass.employee)}</strong></td>
                <td>{ass.course?.title}</td>
                <td><strong>{ass.score}</strong> / {ass.maxScore}</td>
                <td>{ass.passingScore}</td>
                <td><span className={`hrtm-badge hrtm-badge-${(ass.result||'').toLowerCase()}`}><span className="hrtm-badge-dot"/>{ass.result}</span></td>
                <td>{formatDate(ass.assessmentDate)}</td>
                <td className="hrtm-actions">
                  <button className="hrtm-btn-icon" onClick={() => handleDelete('assessment', ass._id)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCertifications = () => (
    <div className="hrtm-card">
      <div className="hrtm-card-header">
        <h4>Certifications & Awards</h4>
        <button className="hrtm-btn hrtm-btn-primary hrtm-btn-sm" onClick={() => setShowGenCertModal(true)}>
          + Generate Certification
        </button>
      </div>
      <div className="hrtm-table-wrap">
        <table className="hrtm-table">
          <thead>
            <tr>
              <th>Certificate #</th>
              <th>Employee</th>
              <th>Program</th>
              <th>Course</th>
              <th>Completion Date</th>
              <th>Issue Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {certifications.length === 0 ? (
              <tr><td colSpan="8" className="hrtm-empty">No certifications generated</td></tr>
            ) : certifications.map(cert => (
              <tr key={cert._id}>
                <td><code>{cert.certificateNumber}</code></td>
                <td><strong>{getEmpName(cert.employee)}</strong></td>
                <td>{cert.program?.name || 'General'}</td>
                <td>{cert.course?.title}</td>
                <td>{formatDate(cert.completionDate || cert.issueDate)}</td>
                <td>{formatDate(cert.issueDate)}</td>
                <td><span className={`hrtm-badge hrtm-badge-${(cert.status||'').toLowerCase().replace(' ','-')}`}><span className="hrtm-badge-dot"/>{cert.status}</span></td>
                <td className="hrtm-actions">
                  <button className="hrtm-btn-icon" title="View / Preview Certificate" onClick={() => setPreviewCert(cert)}>👁️</button>
                  {cert.status !== 'Revoked' && (
                    <button className="hrtm-btn-icon" title="Revoke Certificate" onClick={() => handleRevokeCert(cert._id)}>🚫</button>
                  )}
                  <button className="hrtm-btn-icon" title="Delete" onClick={() => handleDelete('certification', cert._id)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderFeedback = () => (
    <div className="hrtm-card">
      <div className="hrtm-card-header">
        <h4>Training Feedback & Ratings</h4>
        <button className="hrtm-btn hrtm-btn-primary hrtm-btn-sm" onClick={() => openCreateModal('feedback')}>+ Submit Feedback</button>
      </div>
      <div className="hrtm-table-wrap">
        <table className="hrtm-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Course</th>
              <th>Rating</th>
              <th>Comments</th>
              <th>Submitted Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {feedback.length === 0 ? (
              <tr><td colSpan="6" className="hrtm-empty">No feedback entries found</td></tr>
            ) : feedback.map(fb => (
              <tr key={fb._id}>
                <td><strong>{getEmpName(fb.employee)}</strong></td>
                <td>{fb.course?.title}</td>
                <td><span className="hrtm-stars">{'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}</span> ({fb.rating}/5)</td>
                <td>{fb.comments || '—'}</td>
                <td>{formatDate(fb.submittedAt)}</td>
                <td className="hrtm-actions">
                  <button className="hrtm-btn-icon" onClick={() => handleDelete('feedback', fb._id)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCompletion = () => (
    <div className="hrtm-card">
      <div className="hrtm-card-header">
        <h4>Completion Records</h4>
      </div>
      <div className="hrtm-table-wrap">
        <table className="hrtm-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Program / Course</th>
              <th>Completion Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {completionData.length === 0 ? (
              <tr><td colSpan="4" className="hrtm-empty">No completion records found</td></tr>
            ) : completionData.map(c => (
              <tr key={c._id}>
                <td><strong>{getEmpName(c.employee)}</strong></td>
                <td>{c.program?.name} / {c.course?.title}</td>
                <td>{formatDate(c.completionDate || c.updatedAt)}</td>
                <td><span className={`hrtm-badge hrtm-badge-${(c.status||'').toLowerCase().replace(' ','-')}`}><span className="hrtm-badge-dot"/>{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCosts = () => (
    <div className="hrtm-card">
      <div className="hrtm-card-header">
        <h4>Cost & Expense Management</h4>
        <button className="hrtm-btn hrtm-btn-primary hrtm-btn-sm" onClick={() => openCreateModal('cost')}>+ Record Cost</button>
      </div>
      <div className="hrtm-table-wrap">
        <table className="hrtm-table">
          <thead>
            <tr>
              <th>Expense Title</th>
              <th>Program / Course</th>
              <th>Breakdown</th>
              <th>Total Cost</th>
              <th>Date Incurred</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {costs.length === 0 ? (
              <tr><td colSpan="6" className="hrtm-empty">No training costs recorded</td></tr>
            ) : costs.map(c => (
              <tr key={c._id}>
                <td><strong>{c.title}</strong></td>
                <td>{c.program?.name || c.course?.title || 'General'}</td>
                <td><small>Fee: ₹{c.courseFee||0} | Trainer: ₹{c.trainerFee||0} | Venue: ₹{c.venueCost||0}</small></td>
                <td><strong>₹{(c.totalCost||0).toLocaleString()}</strong></td>
                <td>{formatDate(c.dateIncurred)}</td>
                <td className="hrtm-actions">
                  <button className="hrtm-btn-icon" onClick={() => openEditModal('cost', c)} title="Edit Cost">✏️</button>
                  <button className="hrtm-btn-icon" onClick={() => handleDelete('cost', c._id)} title="Delete Cost">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCostReports = () => {
    const sum = costReports.summary || {};
    return (
      <div>
        <div className="hrtm-cost-summary">
          <div className="hrtm-cost-card">
            <h5>Total Expenses</h5>
            <p>₹{(sum.totalCost || 0).toLocaleString()}</p>
          </div>
          <div className="hrtm-cost-card">
            <h5>Employees Trained</h5>
            <p>{costReports.employeesTrained || 0}</p>
          </div>
          <div className="hrtm-cost-card">
            <h5>Cost / Employee</h5>
            <p>₹{(costReports.costPerEmployee || 0).toLocaleString()}</p>
          </div>
          <div className="hrtm-cost-card">
            <h5>Cost / Completion</h5>
            <p>₹{(costReports.costPerCompletedEmployee || 0).toLocaleString()}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="hrtm-card">
            <div className="hrtm-card-header"><h4>Cost by Program</h4></div>
            <div className="hrtm-table-wrap">
              <table className="hrtm-table">
                <thead><tr><th>Program</th><th>Expenses</th></tr></thead>
                <tbody>
                  {(costReports.byProgram || []).map(p => (
                    <tr key={p._id}><td>{p.programName || 'Unlinked'}</td><td><strong>₹{(p.totalCost||0).toLocaleString()}</strong></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="hrtm-card">
            <div className="hrtm-card-header"><h4>Cost by Course</h4></div>
            <div className="hrtm-table-wrap">
              <table className="hrtm-table">
                <thead><tr><th>Course</th><th>Expenses</th></tr></thead>
                <tbody>
                  {(costReports.byCourse || []).map(c => (
                    <tr key={c._id}><td>{c.courseTitle || 'Unlinked'}</td><td><strong>₹{(c.totalCost||0).toLocaleString()}</strong></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ──────────────── MODAL FORM RENDERING WITH CUSTOM SELECT ──────────────── */

  const renderModalForm = () => {
    if (!showModal) return null;

    return (
      <div className="hrtm-modal-overlay">
        <div className="hrtm-modal">
          <div className="hrtm-modal-header">
            <h3>{editingItem ? 'Edit' : 'Create'} {showModal.charAt(0).toUpperCase() + showModal.slice(1)}</h3>
            <button className="hrtm-modal-close" onClick={() => setShowModal(null)}>✕</button>
          </div>
          <form onSubmit={handleFormSubmit}>
            <div className="hrtm-modal-body">
              {showModal === 'program' && (
                <>
                  <div className="hrtm-form-group">
                    <label>Program Name *</label>
                    <input type="text" required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Leadership Excellence 2026"/>
                  </div>
                  <div className="hrtm-form-group">
                    <label>Description</label>
                    <textarea value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Program goals & scope..."/>
                  </div>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Training Type</label>
                      <CustomSelect
                        options={['Internal', 'External', 'Online', 'Workshop', 'On-the-Job']}
                        value={formData.trainingType || 'Internal'}
                        onChange={v => setFormData({...formData, trainingType: v})}
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Department</label>
                      <CustomSelect
                        options={[{ value: '', label: 'All Departments' }, ...departments.map(d => ({ value: d._id, label: d.name }))]}
                        value={formData.department || ''}
                        onChange={v => setFormData({...formData, department: v})}
                        placeholder="All Departments"
                      />
                    </div>
                  </div>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Start Date</label>
                      <input type="date" value={formData.startDate ? formData.startDate.slice(0,10) : ''} onChange={e => setFormData({...formData, startDate: e.target.value})}/>
                    </div>
                    <div className="hrtm-form-group">
                      <label>End Date</label>
                      <input type="date" value={formData.endDate ? formData.endDate.slice(0,10) : ''} onChange={e => setFormData({...formData, endDate: e.target.value})}/>
                    </div>
                  </div>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Budget (₹)</label>
                      <input type="number" value={formData.budget || 0} onChange={e => setFormData({...formData, budget: Number(e.target.value)})}/>
                    </div>
                    <div className="hrtm-form-group">
                      <label>Status</label>
                      <CustomSelect
                        options={['Draft', 'Scheduled', 'Active', 'Completed', 'Cancelled']}
                        value={formData.status || 'Draft'}
                        onChange={v => setFormData({...formData, status: v})}
                      />
                    </div>
                  </div>
                </>
              )}

              {showModal === 'course' && (
                <>
                  <div className="hrtm-form-group">
                    <label>Course Title *</label>
                    <input type="text" required value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Advanced Cybersecurity Practices"/>
                  </div>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Course Code</label>
                      <input type="text" value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} placeholder="e.g. CRS-101"/>
                    </div>
                    <div className="hrtm-form-group">
                      <label>Category</label>
                      <input type="text" value={formData.category || 'General'} onChange={e => setFormData({...formData, category: e.target.value})}/>
                    </div>
                  </div>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Difficulty</label>
                      <CustomSelect
                        options={['Beginner', 'Intermediate', 'Advanced']}
                        value={formData.difficulty || 'Beginner'}
                        onChange={v => setFormData({...formData, difficulty: v})}
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Duration (Hours)</label>
                      <input type="number" value={formData.durationHours || 0} onChange={e => setFormData({...formData, durationHours: Number(e.target.value)})}/>
                    </div>
                  </div>
                  <div className="hrtm-form-group">
                    <label>Description</label>
                    <textarea value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})}/>
                  </div>
                </>
              )}

              {showModal === 'trainer' && (
                <>
                  <div className="hrtm-form-group">
                    <label>Trainer Type</label>
                    <CustomSelect
                      options={[{ value: 'Internal', label: 'Internal Employee' }, { value: 'External', label: 'External Expert' }]}
                      value={formData.trainerType || 'Internal'}
                      onChange={v => setFormData({...formData, trainerType: v})}
                    />
                  </div>
                  {formData.trainerType === 'Internal' ? (
                    <div className="hrtm-form-group">
                      <label>Select Employee *</label>
                      <CustomSelect
                        options={employees.map(e => ({ value: e._id, label: getEmpName(e), subtitle: e.department || 'General' }))}
                        value={formData.employee || ''}
                        onChange={v => setFormData({...formData, employee: v})}
                        placeholder="-- Choose Employee --"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="hrtm-form-group">
                        <label>Trainer Full Name *</label>
                        <input type="text" required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})}/>
                      </div>
                      <div className="hrtm-form-row">
                        <div className="hrtm-form-group">
                          <label>Email</label>
                          <input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})}/>
                        </div>
                        <div className="hrtm-form-group">
                          <label>Organization</label>
                          <input type="text" value={formData.organization || ''} onChange={e => setFormData({...formData, organization: e.target.value})}/>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {showModal === 'session' && (
                <>
                  <div className="hrtm-form-group">
                    <label>Session Title *</label>
                    <input type="text" required value={formData.sessionTitle || ''} onChange={e => setFormData({...formData, sessionTitle: e.target.value})} placeholder="e.g. Session 1: Fundamentals"/>
                  </div>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Program *</label>
                      <CustomSelect
                        options={programs.map(p => ({ value: p._id, label: p.name }))}
                        value={formData.program || ''}
                        onChange={v => {
                          // Dynamic Program -> Course dependency filter
                          const filteredCourses = courses.filter(c => !v || String(c.program || '') === String(v));
                          const isValidCourse = filteredCourses.some(c => String(c._id) === String(formData.course));
                          setFormData({
                            ...formData,
                            program: v,
                            course: isValidCourse ? formData.course : ''
                          });
                        }}
                        placeholder="-- Choose Program --"
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Course *</label>
                      <CustomSelect
                        options={courses
                          .filter(c => !formData.program || String(c.program || '') === String(formData.program))
                          .map(c => ({ value: c._id, label: c.title }))}
                        value={formData.course || ''}
                        onChange={v => setFormData({...formData, course: v})}
                        placeholder="-- Choose Course --"
                      />
                    </div>
                  </div>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Trainer</label>
                      <CustomSelect
                        options={trainers.map(t => ({ value: t._id, label: t.trainerType === 'Internal' ? getEmpName(t.employee) : t.name }))}
                        value={formData.trainer || ''}
                        onChange={v => setFormData({...formData, trainer: v})}
                        placeholder="-- Choose Trainer --"
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Date *</label>
                      <input type="date" required value={formData.sessionDate ? formData.sessionDate.slice(0,10) : ''} onChange={e => setFormData({...formData, sessionDate: e.target.value})}/>
                    </div>
                  </div>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Start Time</label>
                      <input type="time" value={formData.startTime || ''} onChange={e => setFormData({...formData, startTime: e.target.value})}/>
                    </div>
                    <div className="hrtm-form-group">
                      <label>End Time</label>
                      <input type="time" value={formData.endTime || ''} onChange={e => setFormData({...formData, endTime: e.target.value})}/>
                    </div>
                  </div>
                </>
              )}

              {showModal === 'assignment' && (
                <>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Program *</label>
                      <CustomSelect
                        options={programs.map(p => ({ value: p._id, label: p.name }))}
                        value={formData.program || ''}
                        onChange={v => setFormData({...formData, program: v})}
                        placeholder="-- Choose Program --"
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Course *</label>
                      <CustomSelect
                        options={courses.map(c => ({ value: c._id, label: c.title }))}
                        value={formData.course || ''}
                        onChange={v => setFormData({...formData, course: v})}
                        placeholder="-- Choose Course --"
                      />
                    </div>
                  </div>

                  {!editingItem ? (
                    <div className="hrtm-form-group">
                      <label>Select Employees ({selectedEmployees.length} selected)</label>
                      <div className="hrtm-emp-pick-list">
                        {employees.map(emp => {
                          const isSel = selectedEmployees.includes(emp._id);
                          return (
                            <div key={emp._id} className="hrtm-emp-pick-row" onClick={() => {
                              if (isSel) setSelectedEmployees(selectedEmployees.filter(id => id !== emp._id));
                              else setSelectedEmployees([...selectedEmployees, emp._id]);
                            }}>
                              <input type="checkbox" checked={isSel} onChange={() => {}} />
                              <span>{getEmpName(emp)} ({emp.email})</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="hrtm-form-group">
                      <label>Status</label>
                      <CustomSelect
                        options={['Assigned', 'In Progress', 'Completed', 'Failed', 'Overdue']}
                        value={formData.status || 'Assigned'}
                        onChange={v => setFormData({...formData, status: v})}
                      />
                    </div>
                  )}
                </>
              )}

              {showModal === 'attendance' && (
                <>
                  <div className="hrtm-form-group">
                    <label>Session *</label>
                    <CustomSelect
                      options={sessions.map(s => ({ value: s._id, label: s.sessionTitle, subtitle: formatDate(s.sessionDate) }))}
                      value={formData.session || ''}
                      onChange={v => setFormData({...formData, session: v})}
                      placeholder="-- Choose Session --"
                    />
                  </div>
                  <div className="hrtm-form-group">
                    <label>Employee *</label>
                    <CustomSelect
                      options={employees.map(e => ({ value: e._id, label: getEmpName(e) }))}
                      value={formData.employee || ''}
                      onChange={v => setFormData({...formData, employee: v})}
                      placeholder="-- Choose Employee --"
                    />
                  </div>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Status</label>
                      <CustomSelect
                        options={['Present', 'Absent', 'Late', 'Excused']}
                        value={formData.status || 'Present'}
                        onChange={v => setFormData({...formData, status: v})}
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Remarks</label>
                      <input type="text" value={formData.remarks || ''} onChange={e => setFormData({...formData, remarks: e.target.value})}/>
                    </div>
                  </div>
                </>
              )}

              {showModal === 'assessment' && (
                <>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Course *</label>
                      <CustomSelect
                        options={courses.map(c => ({ value: c._id, label: c.title }))}
                        value={formData.course || ''}
                        onChange={v => setFormData({...formData, course: v})}
                        placeholder="-- Choose Course --"
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Employee *</label>
                      <CustomSelect
                        options={employees.map(e => ({ value: e._id, label: getEmpName(e) }))}
                        value={formData.employee || ''}
                        onChange={v => setFormData({...formData, employee: v})}
                        placeholder="-- Choose Employee --"
                      />
                    </div>
                  </div>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Score Achieved *</label>
                      <input type="number" required value={formData.score || 0} onChange={e => setFormData({...formData, score: Number(e.target.value)})}/>
                    </div>
                    <div className="hrtm-form-group">
                      <label>Passing Score</label>
                      <input type="number" value={formData.passingScore || 70} onChange={e => setFormData({...formData, passingScore: Number(e.target.value)})}/>
                    </div>
                  </div>
                </>
              )}

              {showModal === 'feedback' && (
                <>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Course *</label>
                      <CustomSelect
                        options={courses.map(c => ({ value: c._id, label: c.title }))}
                        value={formData.course || ''}
                        onChange={v => setFormData({...formData, course: v})}
                        placeholder="-- Choose Course --"
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Employee *</label>
                      <CustomSelect
                        options={employees.map(e => ({ value: e._id, label: getEmpName(e) }))}
                        value={formData.employee || ''}
                        onChange={v => setFormData({...formData, employee: v})}
                        placeholder="-- Choose Employee --"
                      />
                    </div>
                  </div>
                  <div className="hrtm-form-group">
                    <label>Rating *</label>
                    <CustomSelect
                      options={[{ value: 5, label: '5 - Excellent' }, { value: 4, label: '4 - Good' }, { value: 3, label: '3 - Average' }, { value: 2, label: '2 - Below Average' }, { value: 1, label: '1 - Poor' }]}
                      value={formData.rating || 5}
                      onChange={v => setFormData({...formData, rating: Number(v)})}
                    />
                  </div>
                  <div className="hrtm-form-group">
                    <label>Comments</label>
                    <textarea value={formData.comments || ''} onChange={e => setFormData({...formData, comments: e.target.value})}/>
                  </div>
                </>
              )}

              {showModal === 'cost' && (
                <>
                  <div className="hrtm-form-group">
                    <label>Expense Title *</label>
                    <input
                      type="text"
                      required
                      value={formData.title || ''}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g. External Instructor Fee, AWS Certification Voucher"
                    />
                  </div>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Training Program</label>
                      <CustomSelect
                        options={[
                          { value: '', label: 'Select Program (Optional)' },
                          ...programs.map((p) => ({ value: p._id, label: p.name })),
                        ]}
                        value={formData.program || ''}
                        onChange={(v) => {
                          setFormData({
                            ...formData,
                            program: v,
                          });
                        }}
                        placeholder="-- Choose Program --"
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Training Course</label>
                      <CustomSelect
                        options={[
                          { value: '', label: 'Select Course (Optional)' },
                          ...courses
                            .filter((c) => {
                              if (!formData.program) return true;
                              const selectedProg = programs.find((p) => String(p._id) === String(formData.program));
                              if (selectedProg && Array.isArray(selectedProg.courses) && selectedProg.courses.length > 0) {
                                return selectedProg.courses.some((pc) => String(pc._id || pc) === String(c._id));
                              }
                              return true;
                            })
                            .map((c) => ({
                              value: c._id,
                              label: c.title,
                              subtitle: c.code ? `${c.code} • ${c.category || 'General'}` : (c.category || 'General')
                            })),
                        ]}
                        value={formData.course || ''}
                        onChange={(v) => setFormData({ ...formData, course: v })}
                        placeholder="-- Choose Course (Optional) --"
                      />
                    </div>
                  </div>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Cost Category / Type *</label>
                      <CustomSelect
                        options={[
                          'Trainer Fee',
                          'Course Fee',
                          'Venue',
                          'Materials',
                          'Certification',
                          'Other',
                        ]}
                        value={formData.category || 'Trainer Fee'}
                        onChange={(v) => setFormData({ ...formData, category: v })}
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Amount (₹) *</label>
                      <input
                        type="number"
                        required
                        min="1"
                        step="1"
                        value={formData.amount || ''}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        placeholder="e.g. 15000"
                      />
                    </div>
                  </div>
                  <div className="hrtm-form-group">
                    <label>Date Incurred *</label>
                    <input
                      type="date"
                      required
                      value={formData.dateIncurred ? String(formData.dateIncurred).slice(0, 10) : ''}
                      onChange={(e) => setFormData({ ...formData, dateIncurred: e.target.value })}
                    />
                  </div>
                  <div className="hrtm-form-group">
                    <label>Description / Notes</label>
                    <textarea
                      rows="3"
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Vendor details, invoice reference, or payment notes..."
                    />
                  </div>
                </>
              )}
            </div>

            <div className="hrtm-modal-footer">
              <button type="button" className="hrtm-btn hrtm-btn-secondary" onClick={() => setShowModal(null)}>Cancel</button>
              <button type="submit" className="hrtm-btn hrtm-btn-primary">{editingItem ? 'Update' : 'Save'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  /* ──────────────── GENERATE CERTIFICATION MODAL ──────────────── */

  const renderGenerateCertModal = () => {
    if (!showGenCertModal) return null;

    return (
      <div className="hrtm-modal-overlay">
        <div className="hrtm-modal">
          <div className="hrtm-modal-header">
            <h3>Generate Employee Certification</h3>
            <button className="hrtm-modal-close" onClick={() => setShowGenCertModal(false)}>✕</button>
          </div>
          <form onSubmit={handleGenerateCertSubmit}>
            <div className="hrtm-modal-body">
              <div className="hrtm-form-group">
                <label>Select Employee *</label>
                <CustomSelect
                  options={employees.map(e => ({ value: e._id, label: getEmpName(e), subtitle: e.department || 'Employee' }))}
                  value={genCertForm.employee}
                  onChange={v => setGenCertForm({ ...genCertForm, employee: v })}
                  placeholder="-- Search & Select Employee --"
                />
              </div>
              <div className="hrtm-form-group">
                <label>Training Program</label>
                <CustomSelect
                  options={programs.map(p => ({ value: p._id, label: p.name }))}
                  value={genCertForm.program}
                  onChange={v => setGenCertForm({ ...genCertForm, program: v })}
                  placeholder="-- Choose Program (Optional) --"
                />
              </div>
              <div className="hrtm-form-group">
                <label>Course *</label>
                <CustomSelect
                  options={courses
                    .filter(c => !genCertForm.program || String(c.program || '') === String(genCertForm.program))
                    .map(c => ({ value: c._id, label: c.title, subtitle: c.code }))}
                  value={genCertForm.course}
                  onChange={v => setGenCertForm({ ...genCertForm, course: v })}
                  placeholder="-- Choose Course --"
                />
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                Note: Eligibility validation will check if the selected employee has completed all requirements for this course.
              </p>
            </div>
            <div className="hrtm-modal-footer">
              <button type="button" className="hrtm-btn hrtm-btn-secondary" onClick={() => setShowGenCertModal(false)}>Cancel</button>
              <button type="submit" className="hrtm-btn hrtm-btn-primary">Generate Certification</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  /* ──────────────── CERTIFICATE DOCUMENT PREVIEW MODAL ──────────────── */

  const renderPreviewCertModal = () => {
    if (!previewCert) return null;

    return (
      <div className="hrtm-modal-overlay">
        <div className="hrtm-modal" style={{ maxWidth: '720px' }}>
          <div className="hrtm-modal-header">
            <h3>Certificate Document Preview</h3>
            <button className="hrtm-modal-close" onClick={() => setPreviewCert(null)}>✕</button>
          </div>
          <div className="hrtm-modal-body">
            <div className="hrtm-cert-frame">
              <div className="hrtm-cert-inner-border">
                <div className="hrtm-cert-company">AAsha Tech CRM Solutions</div>
                <div className="hrtm-cert-main-title">Certificate of Completion</div>
                <div className="hrtm-cert-subtitle">This official certificate is proudly presented to</div>
                <div className="hrtm-cert-recipient">{getEmpName(previewCert.employee)}</div>
                <div className="hrtm-cert-text">
                  for successfully completing all requirements, assessments, and learning modules for the corporate training program:
                  <br />
                  <strong style={{ color: '#0f172a', fontSize: '1.05rem', display: 'block', marginTop: '0.4rem' }}>
                    {previewCert.course?.title || previewCert.program?.name || 'Professional Skills Training'}
                  </strong>
                </div>

                <div className="hrtm-cert-meta-grid">
                  <div className="hrtm-cert-meta-item">
                    <span>Certificate No.</span>
                    <strong>{previewCert.certificateNumber}</strong>
                  </div>
                  <div className="hrtm-cert-meta-item">
                    <span>Issue Date</span>
                    <strong>{formatDate(previewCert.issueDate)}</strong>
                  </div>
                  <div className="hrtm-cert-meta-item">
                    <span>Final Score</span>
                    <strong>{previewCert.finalScore !== null && previewCert.finalScore !== undefined ? `${previewCert.finalScore}%` : 'PASSED'}</strong>
                  </div>
                </div>

                <div className="hrtm-cert-footer">
                  <div>
                    <div className="hrtm-cert-sig-line" />
                    <div className="hrtm-cert-sig-title">Corporate Training Director</div>
                  </div>
                  <div className="hrtm-cert-stamp">VERIFIED</div>
                  <div>
                    <div className="hrtm-cert-sig-line" />
                    <div className="hrtm-cert-sig-title">Head of Human Resources</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="hrtm-modal-footer">
            <button type="button" className="hrtm-btn hrtm-btn-secondary" onClick={() => setPreviewCert(null)}>Close</button>
            <button type="button" className="hrtm-btn hrtm-btn-primary" onClick={() => window.print()}>Print / Download Certificate</button>
          </div>
        </div>
      </div>
    );
  };

  const kpis = overview.kpis || overview;

  return (
    <UserLayout pageTitle="Training & Development">
      <div className="hrtm-container">
        {toast.show && <div className={`hrtm-toast hrtm-toast-${toast.type}`}>{toast.msg}</div>}

        {/* 1. Training Management Header */}
        <div className="hrtm-header">
          <div>
            <h2>Training Management System</h2>
            <p>Comprehensive corporate learning, course scheduling, attendance, skill tracking, and cost analytics.</p>
          </div>
        </div>

        {/* 2. 8 KPI Cards (4 × 2 Grid Layout) */}
        <div className="hrtm-kpi-grid-4x2">
          <div className="hrtm-kpi-card">
            <div className="hrtm-kpi-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>📘</div>
            <div className="hrtm-kpi-info">
              <h4>{kpis.totalPrograms || 0}</h4>
              <span>Total Programs</span>
            </div>
          </div>
          <div className="hrtm-kpi-card">
            <div className="hrtm-kpi-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>🎓</div>
            <div className="hrtm-kpi-info">
              <h4>{kpis.totalCourses || 0}</h4>
              <span>Training Courses</span>
            </div>
          </div>
          <div className="hrtm-kpi-card">
            <div className="hrtm-kpi-icon" style={{ background: '#fefce8', color: '#ca8a04' }}>👨‍🏫</div>
            <div className="hrtm-kpi-info">
              <h4>{kpis.totalTrainers || 0}</h4>
              <span>Registered Trainers</span>
            </div>
          </div>
          <div className="hrtm-kpi-card">
            <div className="hrtm-kpi-icon" style={{ background: '#faf5ff', color: '#9333ea' }}>🗓️</div>
            <div className="hrtm-kpi-info">
              <h4>{kpis.upcomingSessions || 0}</h4>
              <span>Upcoming Sessions</span>
            </div>
          </div>
          <div className="hrtm-kpi-card">
            <div className="hrtm-kpi-icon" style={{ background: '#ecfeff', color: '#0891b2' }}>👥</div>
            <div className="hrtm-kpi-info">
              <h4>{kpis.totalAssignments || 0}</h4>
              <span>Enrolled Assignments</span>
            </div>
          </div>
          <div className="hrtm-kpi-card">
            <div className="hrtm-kpi-icon" style={{ background: '#f0fdf4', color: '#15803d' }}>✅</div>
            <div className="hrtm-kpi-info">
              <h4>{kpis.completionRate || 0}%</h4>
              <span>Completion Rate</span>
            </div>
          </div>
          <div className="hrtm-kpi-card">
            <div className="hrtm-kpi-icon" style={{ background: '#fdf2f8', color: '#db2777' }}>📊</div>
            <div className="hrtm-kpi-info">
              <h4>{kpis.averageScore || 0}</h4>
              <span>Average Assessment Score</span>
            </div>
          </div>
          <div className="hrtm-kpi-card">
            <div className="hrtm-kpi-icon" style={{ background: '#fef3c7', color: '#d97706' }}>💰</div>
            <div className="hrtm-kpi-info">
              <h4>₹{(kpis.totalInvestment || kpis.totalCost || 0).toLocaleString()}</h4>
              <span>Total Investment</span>
            </div>
          </div>
        </div>

        {/* 3. Search + Filter Toolbar (Using Portal CustomSelect) */}
        <div className="hrtm-filter-toolbar">
          <div className="hrtm-filter-group">
            <input
              type="text"
              className="hrtm-search"
              placeholder="Global Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div style={{ minWidth: '160px' }}>
              <CustomSelect
                options={[{ value: 'All', label: 'All Programs' }, ...programs.map(p => ({ value: p._id, label: p.name }))]}
                value={filterProgram}
                onChange={setFilterProgram}
                placeholder="All Programs"
              />
            </div>
            <div style={{ minWidth: '160px' }}>
              <CustomSelect
                options={[{ value: 'All', label: 'All Departments' }, ...departments.map(d => ({ value: d._id, label: d.name }))]}
                value={filterDept}
                onChange={setFilterDept}
                placeholder="All Departments"
              />
            </div>
            <div style={{ minWidth: '140px' }}>
              <CustomSelect
                options={[{ value: 'All', label: 'All Statuses' }, { value: 'Active', label: 'Active' }, { value: 'Scheduled', label: 'Scheduled' }, { value: 'Completed', label: 'Completed' }, { value: 'Draft', label: 'Draft' }]}
                value={filterStatus}
                onChange={setFilterStatus}
                placeholder="All Statuses"
              />
            </div>
            <div style={{ minWidth: '160px' }}>
              <CustomSelect
                options={[{ value: 'All', label: 'All Trainers' }, ...trainers.map(t => ({ value: t._id, label: t.trainerType === 'Internal' ? getEmpName(t.employee) : t.name }))]}
                value={filterTrainer}
                onChange={setFilterTrainer}
                placeholder="All Trainers"
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className="hrtm-btn hrtm-btn-secondary" onClick={() => openCreateModal('trainer')}>
              + Add Trainer
            </button>
            <button className="hrtm-btn hrtm-btn-primary" onClick={() => openCreateModal('program')}>
              + Add Training
            </button>
          </div>
        </div>

        {/* 4. Training Module Navigation (2 Rows) */}
        <div className="hrtm-tabs-container">
          <div className="hrtm-tab-row">
            {ROW1_TABS.map(tab => (
              <button
                key={tab.id}
                className={`hrtm-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="hrtm-tab-row">
            {ROW2_TABS.map(tab => (
              <button
                key={tab.id}
                className={`hrtm-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 5. Dashboard / Data Content */}
        {loading ? (
          <div className="hrtm-card"><div className="hrtm-empty">Loading training data...</div></div>
        ) : (
          <>
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'programs' && renderPrograms()}
            {activeTab === 'courses' && renderCourses()}
            {activeTab === 'trainers' && renderTrainers()}
            {activeTab === 'sessions' && renderSessions()}
            {activeTab === 'assignments' && renderAssignments()}
            {activeTab === 'attendance' && renderAttendance()}
            {activeTab === 'progress' && renderProgress()}
            {activeTab === 'assessments' && renderAssessments()}
            {activeTab === 'certifications' && renderCertifications()}
            {activeTab === 'feedback' && renderFeedback()}
            {activeTab === 'completion' && renderCompletion()}
            {activeTab === 'costs' && renderCosts()}
            {activeTab === 'cost-reports' && renderCostReports()}
          </>
        )}

        {/* Dynamic Form & Action Modals */}
        {renderModalForm()}
        {renderGenerateCertModal()}
        {renderPreviewCertModal()}
      </div>
    </UserLayout>
  );
}
