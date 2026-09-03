import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../../../../services/apiClient';
import UserLayout from '../components/UserLayout';
import './Performance.css';
import '../Employees/HREmployees.css';

const initialsFor = (firstName, lastName, email) => {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return 'EM';
};

const formatDate = (val) => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return String(val);
  }
};

const OFFICIAL_DEPARTMENTS = ['HR', 'Finance', 'Business Development', 'Digital Marketing', 'Video Editor', 'Tech'];
const REVIEW_CYCLES = ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026', 'Annual 2026'];

export default function Performance() {
  const [employees, setEmployees] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({
    totalEmployees: 0,
    reviewsCompleted: 0,
    reviewsPending: 0,
    averageRating: 0,
    categoryAverages: {},
    departmentPerformance: {},
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Tabs
  const [activeTab, setActiveTab] = useState('roster'); // 'roster' | 'reviews' | 'goals' | 'analytics'

  // Search & Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedCycle, setSelectedCycle] = useState('All');

  // Modals
  const [showEvaluateModal, setShowEvaluateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [selectedReview, setSelectedReview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Evaluation Form State
  const [evalForm, setEvalForm] = useState({
    userId: '',
    reviewCycle: 'Q1 2026',
    reviewPeriod: 'Jan 2026 - Mar 2026',
    productivity: 4,
    qualityOfWork: 4,
    communication: 4,
    teamwork: 4,
    problemSolving: 4,
    punctuality: 4,
    strengths: '',
    areasForImprovement: '',
    hrComments: '',
    managerFeedback: '',
    status: 'Completed',
  });

  // Goal Form State
  const [goalForm, setGoalForm] = useState({
    userId: '',
    title: '',
    description: '',
    target: '',
    deadline: '',
    priority: 'Medium',
  });

  // Load live data from MongoDB
  const loadPerformanceData = async () => {
    setLoading(true);
    setError('');
    try {
      const [empRes, revRes, sumRes] = await Promise.all([
        apiClient.get('/users'),
        apiClient.get('/performance').catch(() => ({ data: { data: [] } })),
        apiClient.get('/performance/summary').catch(() => ({ data: { data: null } })),
      ]);

      const empList = (empRes.data?.data || []).filter(
        (u) => u.role === 'employee' && u.isActive !== false && u.employmentStatus !== 'Exited' && u.employmentStatus !== 'Terminated'
      );
      const revList = revRes.data?.data || [];
      setEmployees(empList);
      setReviews(revList);

      if (sumRes.data?.data) {
        setSummary(sumRes.data.data);
      } else {
        // Fallback local calculations
        const completed = revList.filter((r) => r.status === 'Completed');
        const ratingSum = completed.reduce((sum, r) => sum + (Number(r.overallRating) || 0), 0);
        setSummary({
          totalEmployees: empList.length,
          reviewsCompleted: completed.length,
          reviewsPending: revList.filter((r) => r.status === 'Pending' || r.status === 'In Review').length,
          averageRating: completed.length > 0 ? Number((ratingSum / completed.length).toFixed(2)) : 0,
          categoryAverages: {},
          departmentPerformance: {},
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load performance records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPerformanceData();
  }, []);

  // Map latest review to each employee
  const employeePerformanceList = useMemo(() => {
    const reviewByUser = new Map();
    reviews.forEach((r) => {
      const uId = r.user?._id || r.user;
      if (!reviewByUser.has(uId)) {
        reviewByUser.set(uId, r);
      }
    });

    return employees.map((emp) => {
      const rev = reviewByUser.get(emp._id);
      const goals = rev?.goals || [];
      const completedGoals = goals.filter((g) => g.status === 'Completed').length;
      const goalProgress = goals.length > 0 ? Math.round((completedGoals / goals.length) * 100) : 0;

      return {
        ...emp,
        latestReview: rev || null,
        overallRating: rev?.overallRating || null,
        reviewStatus: rev?.status || 'Pending',
        reviewCycle: rev?.reviewCycle || 'Q1 2026',
        goals,
        goalProgress,
      };
    });
  }, [employees, reviews]);

  // Filtered employees table list
  const filteredEmployees = useMemo(() => {
    return employeePerformanceList.filter((emp) => {
      const name = (emp.personalInfo?.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`).toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const empId = (emp.jobDetails?.employeeId || '').toLowerCase();
      const matchesSearch = name.includes(search.toLowerCase()) || email.includes(search.toLowerCase()) || empId.includes(search.toLowerCase());

      const dept = emp.jobDetails?.department || emp.department || '';
      const matchesDept = selectedDept === 'All' || dept === selectedDept;
      const matchesStatus = selectedStatus === 'All' || emp.reviewStatus === selectedStatus;
      const matchesCycle = selectedCycle === 'All' || emp.reviewCycle === selectedCycle;

      return matchesSearch && matchesDept && matchesStatus && matchesCycle;
    });
  }, [employeePerformanceList, search, selectedDept, selectedStatus, selectedCycle]);

  // Filtered Review History
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      const name = (r.user?.personalInfo?.fullName || `${r.user?.firstName || ''} ${r.user?.lastName || ''}`).toLowerCase();
      const email = (r.user?.email || '').toLowerCase();
      const matchesSearch = name.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
      const dept = r.user?.jobDetails?.department || r.user?.department || '';
      const matchesDept = selectedDept === 'All' || dept === selectedDept;
      const matchesStatus = selectedStatus === 'All' || r.status === selectedStatus;
      const matchesCycle = selectedCycle === 'All' || r.reviewCycle === selectedCycle;
      return matchesSearch && matchesDept && matchesStatus && matchesCycle;
    });
  }, [reviews, search, selectedDept, selectedStatus, selectedCycle]);

  // All aggregate goals
  const allGoals = useMemo(() => {
    const list = [];
    reviews.forEach((r) => {
      (r.goals || []).forEach((g) => {
        list.push({
          ...g,
          reviewId: r._id,
          employeeName: r.user?.personalInfo?.fullName || `${r.user?.firstName || ''} ${r.user?.lastName || ''}` || r.user?.email || 'Employee',
          employeeDept: r.user?.department || r.user?.jobDetails?.department || 'General',
        });
      });
    });
    return list;
  }, [reviews]);

  // Live Overall Rating calculation preview in modal
  const liveOverallRating = useMemo(() => {
    const sum =
      Number(evalForm.productivity) +
      Number(evalForm.qualityOfWork) +
      Number(evalForm.communication) +
      Number(evalForm.teamwork) +
      Number(evalForm.problemSolving) +
      Number(evalForm.punctuality);
    return (sum / 6).toFixed(2);
  }, [evalForm]);

  // Open Evaluate Modal
  const handleOpenEvaluate = (emp = null) => {
    setError('');
    setSuccess('');
    setSelectedEmp(emp);
    const targetUserId = emp ? emp._id : employees[0]?._id || '';

    setEvalForm({
      userId: targetUserId,
      reviewCycle: emp?.reviewCycle || 'Q1 2026',
      reviewPeriod: 'Jan 2026 - Mar 2026',
      productivity: emp?.latestReview?.ratings?.productivity || 4,
      qualityOfWork: emp?.latestReview?.ratings?.qualityOfWork || 4,
      communication: emp?.latestReview?.ratings?.communication || 4,
      teamwork: emp?.latestReview?.ratings?.teamwork || 4,
      problemSolving: emp?.latestReview?.ratings?.problemSolving || 4,
      punctuality: emp?.latestReview?.ratings?.punctuality || 4,
      strengths: emp?.latestReview?.strengths || '',
      areasForImprovement: emp?.latestReview?.areasForImprovement || '',
      hrComments: emp?.latestReview?.hrComments || '',
      managerFeedback: emp?.latestReview?.managerFeedback || '',
      status: emp?.latestReview?.status || 'Completed',
    });

    setShowEvaluateModal(true);
  };

  // Submit Evaluation Form
  const handleSaveEvaluation = async (e) => {
    e.preventDefault();
    if (!evalForm.userId) {
      setError('Please select an employee to evaluate.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const payload = {
        user: evalForm.userId,
        reviewCycle: evalForm.reviewCycle,
        reviewPeriod: evalForm.reviewPeriod,
        ratings: {
          productivity: Number(evalForm.productivity),
          qualityOfWork: Number(evalForm.qualityOfWork),
          communication: Number(evalForm.communication),
          teamwork: Number(evalForm.teamwork),
          problemSolving: Number(evalForm.problemSolving),
          punctuality: Number(evalForm.punctuality),
        },
        overallRating: Number(liveOverallRating),
        strengths: evalForm.strengths,
        areasForImprovement: evalForm.areasForImprovement,
        hrComments: evalForm.hrComments,
        managerFeedback: evalForm.managerFeedback,
        status: evalForm.status,
      };

      await apiClient.post('/performance', payload);
      setShowEvaluateModal(false);
      setSuccess('Performance evaluation saved successfully!');
      await loadPerformanceData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save performance evaluation.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open View Profile Modal
  const handleOpenView = (emp) => {
    setSelectedEmp(emp);
    setSelectedReview(emp.latestReview);
    setShowViewModal(true);
  };

  // Open Add Goal Modal
  const handleOpenAddGoal = (emp = null) => {
    setError('');
    setSuccess('');
    setSelectedEmp(emp);
    setGoalForm({
      userId: emp ? emp._id : employees[0]?._id || '',
      title: '',
      description: '',
      target: '',
      deadline: '',
      priority: 'Medium',
    });
    setShowGoalModal(true);
  };

  // Save Goal
  const handleSaveGoal = async (e) => {
    e.preventDefault();
    if (!goalForm.title.trim()) {
      setError('Goal title is required.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await apiClient.post('/performance/goals', goalForm);
      setShowGoalModal(false);
      setSuccess('Goal assigned successfully!');
      await loadPerformanceData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add goal.');
    } finally {
      setSubmitting(false);
    }
  };

  // Update Goal Progress
  const handleUpdateGoalProgress = async (reviewId, goalId, newProgress, newStatus) => {
    try {
      await apiClient.patch(`/performance/${reviewId}/goals/${goalId}`, {
        progress: newProgress,
        status: newStatus,
      });
      await loadPerformanceData();
    } catch (err) {
      setError('Failed to update goal progress.');
    }
  };

  return (
    <UserLayout pageTitle="Performance Management">
      <div className="perf-container">
        {/* Header */}
        <div className="perf-header">
          <div className="perf-title-area">
            <h2>Performance Management</h2>
            <p>Track employee performance, goals, reviews and development.</p>
          </div>
          <div className="perf-header-actions">
            <button type="button" className="perf-secondary-btn" onClick={() => handleOpenAddGoal()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              Add Goal
            </button>
            <button type="button" className="perf-primary-btn" onClick={() => handleOpenEvaluate()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              Evaluate Employee
            </button>
          </div>
        </div>

        {/* Real-time KPI Summary Cards */}
        <div className="perf-stats-grid">
          <div className="perf-stat-card blue">
            <div className="perf-stat-icon">👥</div>
            <div className="perf-stat-body">
              <span>Total Employees</span>
              <strong>{summary.totalEmployees}</strong>
            </div>
          </div>

          <div className="perf-stat-card green">
            <div className="perf-stat-icon">✅</div>
            <div className="perf-stat-body">
              <span>Reviews Completed</span>
              <strong>{summary.reviewsCompleted}</strong>
            </div>
          </div>

          <div className="perf-stat-card amber">
            <div className="perf-stat-icon">⏳</div>
            <div className="perf-stat-body">
              <span>Reviews Pending</span>
              <strong>{summary.reviewsPending}</strong>
            </div>
          </div>

          <div className="perf-stat-card purple">
            <div className="perf-stat-icon">⭐</div>
            <div className="perf-stat-body">
              <span>Average Rating</span>
              <strong>{summary.averageRating > 0 ? `${summary.averageRating} / 5.0` : '0.0 / 5.0'}</strong>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
        {success && <div style={{ background: '#DCFCE7', color: '#15803D', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>{success}</div>}

        {/* Navigation Tabs */}
        <div className="perf-nav-tabs">
          <button
            type="button"
            className={`perf-tab-btn ${activeTab === 'roster' ? 'active' : ''}`}
            onClick={() => setActiveTab('roster')}
          >
            Workforce Roster & Appraisals
          </button>
          <button
            type="button"
            className={`perf-tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
            onClick={() => setActiveTab('reviews')}
          >
            Review History ({reviews.length})
          </button>
          <button
            type="button"
            className={`perf-tab-btn ${activeTab === 'goals' ? 'active' : ''}`}
            onClick={() => setActiveTab('goals')}
          >
            Goals & KPIs ({allGoals.length})
          </button>
          <button
            type="button"
            className={`perf-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            Performance Analytics
          </button>
        </div>

        {/* ─── TAB 1: WORKFORCE ROSTER ─── */}
        {activeTab === 'roster' && (
          <div>
            {/* Toolbar */}
            <div className="perf-toolbar">
              <div className="perf-search-wrap">
                <svg className="perf-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name, email, or employee ID..."
                  className="perf-search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select className="perf-filter-select" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
                <option value="All">All Departments</option>
                {OFFICIAL_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select className="perf-filter-select" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                <option value="All">All Review Statuses</option>
                <option value="Completed">Completed</option>
                <option value="In Review">In Review</option>
                <option value="Pending">Pending</option>
              </select>

              <select className="perf-filter-select" value={selectedCycle} onChange={(e) => setSelectedCycle(e.target.value)}>
                <option value="All">All Review Cycles</option>
                {REVIEW_CYCLES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Table */}
            <div className="perf-table-card">
              {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading workforce performance data...</div>
              ) : filteredEmployees.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>No employees found matching the filters.</div>
              ) : (
                <div className="perf-table-wrap">
                  <table className="perf-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Employee ID</th>
                        <th>Department</th>
                        <th>Designation</th>
                        <th>Review Cycle</th>
                        <th>Overall Rating</th>
                        <th>Goal Progress</th>
                        <th>Review Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmployees.map((emp) => {
                        const name = emp.personalInfo?.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.email;
                        const initials = initialsFor(emp.firstName, emp.lastName, emp.email);
                        const empId = emp.jobDetails?.employeeId || `EMP-${emp._id.slice(-5).toUpperCase()}`;
                        const dept = emp.jobDetails?.department || emp.department || 'Not Assigned';
                        const designation = emp.jobDetails?.designation || emp.designation || '—';

                        return (
                          <tr key={emp._id}>
                            <td>
                              <div className="perf-user-cell">
                                {emp.personalInfo?.profilePhoto ? (
                                  <img src={emp.personalInfo.profilePhoto} alt={name} className="perf-avatar" style={{ objectFit: 'cover' }} />
                                ) : (
                                  <div className="perf-avatar">{initials}</div>
                                )}
                                <div>
                                  <span className="perf-user-name">{name}</span>
                                  <span className="perf-user-sub">{emp.email}</span>
                                </div>
                              </div>
                            </td>
                            <td><strong>{empId}</strong></td>
                            <td><span className="hr-emp-dept-pill">{dept}</span></td>
                            <td>{designation}</td>
                            <td>{emp.reviewCycle}</td>
                            <td>
                              {emp.overallRating ? (
                                <span className="perf-rating-pill">⭐ {emp.overallRating}</span>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Not evaluated</span>
                              )}
                            </td>
                            <td>
                              <div className="perf-progress-container">
                                <div className="perf-progress-bar">
                                  <div className="perf-progress-fill" style={{ width: `${emp.goalProgress}%` }} />
                                </div>
                                <span className="perf-progress-text">{emp.goalProgress}%</span>
                              </div>
                            </td>
                            <td>
                              <span className={`perf-status-badge ${emp.reviewStatus.toLowerCase().replace(' ', '_')}`}>
                                {emp.reviewStatus}
                              </span>
                            </td>
                            <td>
                              <div className="perf-table-actions">
                                <button type="button" className="perf-action-btn view" onClick={() => handleOpenView(emp)}>
                                  View
                                </button>
                                <button type="button" className="perf-action-btn evaluate" onClick={() => handleOpenEvaluate(emp)}>
                                  Evaluate
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 2: REVIEW HISTORY ─── */}
        {activeTab === 'reviews' && (
          <div>
            <div className="perf-table-card">
              {filteredReviews.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  No performance reviews on file yet. Click "Evaluate Employee" to create the first evaluation.
                </div>
              ) : (
                <div className="perf-table-wrap">
                  <table className="perf-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Review Cycle</th>
                        <th>Review Period</th>
                        <th>Overall Rating</th>
                        <th>Reviewer</th>
                        <th>Review Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReviews.map((rev) => {
                        const name = rev.user?.personalInfo?.fullName || [rev.user?.firstName, rev.user?.lastName].filter(Boolean).join(' ') || rev.user?.email || 'Employee';
                        return (
                          <tr key={rev._id}>
                            <td>
                              <strong>{name}</strong>
                              <span className="perf-user-sub">{rev.user?.department || 'General'}</span>
                            </td>
                            <td>{rev.reviewCycle}</td>
                            <td>{rev.reviewPeriod}</td>
                            <td>
                              <span className="perf-rating-pill">⭐ {rev.overallRating} / 5.0</span>
                            </td>
                            <td>{rev.reviewerName || 'HR Manager'}</td>
                            <td>{formatDate(rev.reviewDate || rev.createdAt)}</td>
                            <td>
                              <span className={`perf-status-badge ${rev.status.toLowerCase().replace(' ', '_')}`}>
                                {rev.status}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="perf-action-btn view"
                                onClick={() => {
                                  setSelectedReview(rev);
                                  setSelectedEmp(rev.user);
                                  setShowViewModal(true);
                                }}
                              >
                                View Review
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 3: GOALS & KPIS ─── */}
        {activeTab === 'goals' && (
          <div>
            {allGoals.length === 0 ? (
              <div
                style={{
                  background: '#ffffff',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '12px',
                  padding: '3rem 2rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎯</div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', margin: '0 0 0.5rem 0' }}>No Goals Assigned Yet</h3>
                <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '460px', margin: '0 auto 1.5rem auto' }}>
                  Assign goals and target milestones to employees to track ongoing performance across cycles.
                </p>
                <button type="button" className="perf-primary-btn" onClick={() => handleOpenAddGoal()}>
                  Add Employee Goal
                </button>
              </div>
            ) : (
              <div className="perf-goals-grid">
                {allGoals.map((goal, i) => (
                  <div key={goal._id || i} className="perf-goal-card">
                    <div>
                      <div className="perf-goal-header">
                        <span className={`perf-status-badge ${goal.status.toLowerCase().replace(' ', '_')}`}>
                          {goal.status}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: goal.priority === 'High' ? '#DC2626' : '#D97706' }}>
                          {goal.priority} Priority
                        </span>
                      </div>
                      <h4 className="perf-goal-title">{goal.title}</h4>
                      <p className="perf-goal-desc">{goal.description || 'No detailed description provided.'}</p>
                    </div>

                    <div>
                      <div className="perf-goal-meta">
                        <span>Assigned to: <strong>{goal.employeeName}</strong></span>
                        <span>Due: {formatDate(goal.deadline)}</span>
                      </div>

                      <div className="perf-progress-container" style={{ marginBottom: '1rem' }}>
                        <div className="perf-progress-bar">
                          <div className="perf-progress-fill" style={{ width: `${goal.progress}%` }} />
                        </div>
                        <span className="perf-progress-text">{goal.progress}%</span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="perf-action-btn view"
                          style={{ flex: 1, textAlign: 'center' }}
                          onClick={() => {
                            const next = goal.progress >= 100 ? 50 : Math.min(100, goal.progress + 25);
                            handleUpdateGoalProgress(goal.reviewId, goal._id, next, next === 100 ? 'Completed' : 'In Progress');
                          }}
                        >
                          +25% Progress
                        </button>
                        {goal.status !== 'Completed' && (
                          <button
                            type="button"
                            className="perf-action-btn evaluate"
                            onClick={() => handleUpdateGoalProgress(goal.reviewId, goal._id, 100, 'Completed')}
                          >
                            Mark Completed
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 4: PERFORMANCE ANALYTICS ─── */}
        {activeTab === 'analytics' && (
          <div className="perf-analytics-grid">
            {/* Department Breakdown */}
            <div className="perf-analytics-card">
              <h4>Department-Wise Performance</h4>
              {OFFICIAL_DEPARTMENTS.map((dept) => {
                const info = summary.departmentPerformance?.[dept] || { count: 0, completed: 0, avgRating: 0 };
                const pct = (info.avgRating / 5) * 100;
                return (
                  <div key={dept} className="perf-bar-row">
                    <span className="perf-bar-label">{dept}</span>
                    <div className="perf-bar-track">
                      <div className="perf-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="perf-bar-val">{info.avgRating > 0 ? `${info.avgRating} ★` : '—'}</span>
                  </div>
                );
              })}
            </div>

            {/* Competency Ratings Average */}
            <div className="perf-analytics-card">
              <h4>Average Competency Scores</h4>
              {[
                { label: 'Productivity', val: summary.categoryAverages?.productivity || 0 },
                { label: 'Quality of Work', val: summary.categoryAverages?.qualityOfWork || 0 },
                { label: 'Communication', val: summary.categoryAverages?.communication || 0 },
                { label: 'Teamwork', val: summary.categoryAverages?.teamwork || 0 },
                { label: 'Problem Solving', val: summary.categoryAverages?.problemSolving || 0 },
                { label: 'Punctuality', val: summary.categoryAverages?.punctuality || 0 },
              ].map((cat) => (
                <div key={cat.label} className="perf-bar-row">
                  <span className="perf-bar-label">{cat.label}</span>
                  <div className="perf-bar-track">
                    <div className="perf-bar-fill" style={{ width: `${(cat.val / 5) * 100}%` }} />
                  </div>
                  <span className="perf-bar-val">{cat.val > 0 ? `${cat.val} / 5` : '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── EVALUATE EMPLOYEE MODAL ─── */}
        {showEvaluateModal && (
          <div className="hr-modal-overlay" onClick={() => setShowEvaluateModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
              <div className="hr-modal-header">
                <h3>Evaluate Employee Performance</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowEvaluateModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleSaveEvaluation}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid" style={{ marginBottom: '1.25rem' }}>
                    <div className="hr-form-group">
                      <label>Select Employee *</label>
                      <select
                        required
                        value={evalForm.userId}
                        onChange={(e) => setEvalForm({ ...evalForm, userId: e.target.value })}
                      >
                        <option value="">Select Employee</option>
                        {employees.map((emp) => {
                          const name = emp.personalInfo?.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.email;
                          return (
                            <option key={emp._id} value={emp._id}>
                              {name} ({emp.department || 'General'})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Review Cycle *</label>
                      <select
                        value={evalForm.reviewCycle}
                        onChange={(e) => setEvalForm({ ...evalForm, reviewCycle: e.target.value })}
                      >
                        {REVIEW_CYCLES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Review Period</label>
                      <input
                        type="text"
                        value={evalForm.reviewPeriod}
                        onChange={(e) => setEvalForm({ ...evalForm, reviewPeriod: e.target.value })}
                        placeholder="e.g. Jan 2026 - Mar 2026"
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Evaluation Status</label>
                      <select
                        value={evalForm.status}
                        onChange={(e) => setEvalForm({ ...evalForm, status: e.target.value })}
                      >
                        <option value="Completed">Completed</option>
                        <option value="In Review">In Review</option>
                        <option value="Pending">Pending</option>
                        <option value="Draft">Draft</option>
                      </select>
                    </div>
                  </div>

                  {/* 6 Category Rating Sliders */}
                  <div className="perf-rating-grid">
                    {[
                      { key: 'productivity', label: 'Productivity & Output' },
                      { key: 'qualityOfWork', label: 'Quality of Work' },
                      { key: 'communication', label: 'Communication Skills' },
                      { key: 'teamwork', label: 'Team Collaboration' },
                      { key: 'problemSolving', label: 'Problem Solving' },
                      { key: 'punctuality', label: 'Punctuality & Discipline' },
                    ].map((cat) => (
                      <div key={cat.key} className="perf-rating-item">
                        <div className="perf-rating-header">
                          <span>{cat.label}</span>
                          <strong>{evalForm[cat.key]} / 5 ⭐</strong>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          step="1"
                          className="perf-rating-slider"
                          value={evalForm[cat.key]}
                          onChange={(e) => setEvalForm({ ...evalForm, [cat.key]: Number(e.target.value) })}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Overall Rating Banner */}
                  <div className="perf-overall-banner">
                    <span>Overall Calculated Score</span>
                    <strong>{liveOverallRating} / 5.0 ⭐</strong>
                  </div>

                  {/* Qualitative Feedback */}
                  <div className="hr-form-grid">
                    <div className="hr-form-group full-width">
                      <label>Key Strengths</label>
                      <textarea
                        rows={2}
                        placeholder="What did the employee excel at during this period?"
                        value={evalForm.strengths}
                        onChange={(e) => setEvalForm({ ...evalForm, strengths: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Areas for Improvement</label>
                      <textarea
                        rows={2}
                        placeholder="What competencies or deliverables require focus and growth?"
                        value={evalForm.areasForImprovement}
                        onChange={(e) => setEvalForm({ ...evalForm, areasForImprovement: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group full-width">
                      <label>HR / Manager Comments</label>
                      <textarea
                        rows={2}
                        placeholder="Official HR summary and recommended development steps..."
                        value={evalForm.hrComments}
                        onChange={(e) => setEvalForm({ ...evalForm, hrComments: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowEvaluateModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Saving Evaluation...' : 'Save Review'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── VIEW EMPLOYEE PERFORMANCE PROFILE MODAL ─── */}
        {showViewModal && selectedEmp && (
          <div className="hr-modal-overlay" onClick={() => setShowViewModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
              <div className="hr-modal-header">
                <h3>Employee Performance Profile</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowViewModal(false)}>&times;</button>
              </div>

              <div className="hr-modal-body">
                {/* Banner */}
                <div className="hr-profile-header-banner">
                  {selectedEmp.personalInfo?.profilePhoto ? (
                    <img src={selectedEmp.personalInfo.profilePhoto} alt="Avatar" className="hr-profile-avatar-lg" style={{ objectFit: 'cover' }} />
                  ) : (
                    <div className="hr-profile-avatar-lg">
                      {initialsFor(selectedEmp.firstName, selectedEmp.lastName, selectedEmp.email)}
                    </div>
                  )}
                  <div className="hr-profile-main-info">
                    <h4>{selectedEmp.personalInfo?.fullName || [selectedEmp.firstName, selectedEmp.lastName].filter(Boolean).join(' ') || selectedEmp.email}</h4>
                    <span>
                      {selectedEmp.jobDetails?.designation || selectedEmp.designation || 'Staff'} · {selectedEmp.jobDetails?.department || selectedEmp.department || 'General'}
                    </span>
                  </div>
                </div>

                {/* Performance Summary Pill Grid */}
                <div className="perf-stats-grid" style={{ marginBottom: '1.25rem' }}>
                  <div className="perf-stat-card purple" style={{ padding: '0.85rem' }}>
                    <div className="perf-stat-body">
                      <span>Overall Rating</span>
                      <strong>{selectedReview?.overallRating ? `${selectedReview.overallRating} ★` : 'Not Rated'}</strong>
                    </div>
                  </div>
                  <div className="perf-stat-card blue" style={{ padding: '0.85rem' }}>
                    <div className="perf-stat-body">
                      <span>Review Cycle</span>
                      <strong>{selectedReview?.reviewCycle || 'Q1 2026'}</strong>
                    </div>
                  </div>
                  <div className="perf-stat-card green" style={{ padding: '0.85rem' }}>
                    <div className="perf-stat-body">
                      <span>Status</span>
                      <strong style={{ fontSize: '1rem' }}>{selectedReview?.status || 'Pending'}</strong>
                    </div>
                  </div>
                  <div className="perf-stat-card amber" style={{ padding: '0.85rem' }}>
                    <div className="perf-stat-body">
                      <span>Evaluated By</span>
                      <strong style={{ fontSize: '0.9rem' }}>{selectedReview?.reviewerName || 'HR'}</strong>
                    </div>
                  </div>
                </div>

                {/* 6 Competency Breakdown */}
                {selectedReview?.ratings ? (
                  <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', marginBottom: '1.25rem', border: '1px solid #e2e8f0' }}>
                    <h5 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontWeight: '700' }}>Competency Breakdown</h5>
                    {[
                      { label: 'Productivity & Output', val: selectedReview.ratings.productivity },
                      { label: 'Quality of Work', val: selectedReview.ratings.qualityOfWork },
                      { label: 'Communication Skills', val: selectedReview.ratings.communication },
                      { label: 'Teamwork & Collaboration', val: selectedReview.ratings.teamwork },
                      { label: 'Problem Solving', val: selectedReview.ratings.problemSolving },
                      { label: 'Punctuality & Discipline', val: selectedReview.ratings.punctuality },
                    ].map((cat) => (
                      <div key={cat.label} className="perf-bar-row">
                        <span className="perf-bar-label">{cat.label}</span>
                        <div className="perf-bar-track">
                          <div className="perf-bar-fill" style={{ width: `${(cat.val / 5) * 100}%` }} />
                        </div>
                        <span className="perf-bar-val">{cat.val} / 5</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '10px', textAlign: 'center', color: '#64748b', marginBottom: '1.25rem' }}>
                    No competency ratings recorded yet for this employee.
                  </div>
                )}

                {/* Qualitative Feedback */}
                {selectedReview && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {selectedReview.strengths && (
                      <div className="hr-profile-item">
                        <span>Key Strengths</span>
                        <strong>{selectedReview.strengths}</strong>
                      </div>
                    )}
                    {selectedReview.areasForImprovement && (
                      <div className="hr-profile-item">
                        <span>Areas for Improvement</span>
                        <strong>{selectedReview.areasForImprovement}</strong>
                      </div>
                    )}
                    {selectedReview.hrComments && (
                      <div className="hr-profile-item">
                        <span>HR Comments</span>
                        <strong>{selectedReview.hrComments}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="hr-modal-footer">
                <button type="button" className="hr-btn-secondary" onClick={() => setShowViewModal(false)}>Close</button>
                <button
                  type="button"
                  className="hr-btn-primary"
                  onClick={() => {
                    setShowViewModal(false);
                    handleOpenEvaluate(selectedEmp);
                  }}
                >
                  Evaluate Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── ADD GOAL MODAL ─── */}
        {showGoalModal && (
          <div className="hr-modal-overlay" onClick={() => setShowGoalModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
              <div className="hr-modal-header">
                <h3>Assign Performance Goal</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowGoalModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleSaveGoal}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid">
                    <div className="hr-form-group full-width">
                      <label>Assign to Employee *</label>
                      <select
                        required
                        value={goalForm.userId}
                        onChange={(e) => setGoalForm({ ...goalForm, userId: e.target.value })}
                      >
                        <option value="">Select Employee</option>
                        {employees.map((emp) => {
                          const name = emp.personalInfo?.fullName || [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.email;
                          return (
                            <option key={emp._id} value={emp._id}>
                              {name} ({emp.department || 'General'})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Goal Title *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Complete React Component Migration"
                        value={goalForm.title}
                        onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Description</label>
                      <textarea
                        rows={2}
                        placeholder="Key milestones and deliverable targets..."
                        value={goalForm.description}
                        onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Target / KPI Metric</label>
                      <input
                        type="text"
                        placeholder="e.g. 100% test coverage"
                        value={goalForm.target}
                        onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Deadline</label>
                      <input
                        type="date"
                        value={goalForm.deadline}
                        onChange={(e) => setGoalForm({ ...goalForm, deadline: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Priority</label>
                      <select
                        value={goalForm.priority}
                        onChange={(e) => setGoalForm({ ...goalForm, priority: e.target.value })}
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowGoalModal(false)}>Cancel</button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Assigning...' : 'Assign Goal'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
}
