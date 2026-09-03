import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../../../../services/apiClient';
import UserLayout from '../components/UserLayout';
import './Recruitment.css';
import '../Employees/HREmployees.css';

const formatDate = (val) => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return String(val);
  }
};

const OFFICIAL_DEPARTMENTS = ['HR', 'Finance', 'Business Development', 'Digital Marketing', 'Video Editor', 'Tech'];
const PIPELINE_STAGES = [
  'Applied',
  'Screening',
  'Shortlisted',
  'Interview',
  'Technical Round',
  'HR Round',
  'Selected',
  'Hired',
  'Rejected',
];

export default function Recruitment() {
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [summary, setSummary] = useState({
    openPositions: 0,
    totalApplicants: 0,
    newApplicants: 0,
    shortlistedCandidates: 0,
    interviewsScheduled: 0,
    selectedCandidates: 0,
    positionsFilled: 0,
    stageCounts: {},
    deptStats: {},
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState('jobs'); // 'jobs' | 'pipeline' | 'candidates' | 'interviews' | 'offers' | 'reports'

  // Search & Filter States
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedStage, setSelectedStage] = useState('All');

  // Modals
  const [showJobModal, setShowJobModal] = useState(false);
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);

  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form States
  const [jobForm, setJobForm] = useState({
    title: '',
    department: 'Tech',
    designation: '',
    openings: 1,
    employmentType: 'Full Time',
    location: 'In-Office / Hybrid',
    experience: '1-3 Years',
    salaryRange: 'Competitive',
    priority: 'Medium',
    openingDate: new Date().toISOString().slice(0, 10),
    closingDate: '',
    description: '',
    requirements: '',
    status: 'Open',
  });

  const [candidateForm, setCandidateForm] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    appliedJob: '',
    appliedPosition: '',
    department: 'Tech',
    experience: '1-2 Years',
    skills: '',
    education: 'Graduate',
    currentCompany: '',
    noticePeriod: '30 Days',
    source: 'Direct Application',
    notes: '',
  });

  const [interviewForm, setInterviewForm] = useState({
    round: 'Technical Round 1',
    interviewer: 'Tech Lead / HR',
    date: new Date().toISOString().slice(0, 10),
    time: '11:00 AM',
    type: 'Online Video',
    meetingLink: '',
    notes: '',
  });

  const [feedbackForm, setFeedbackForm] = useState({
    technicalSkills: 4,
    communication: 4,
    problemSolving: 4,
    teamwork: 4,
    overallRating: 4,
    strengths: '',
    weaknesses: '',
    comments: '',
    recommendation: 'Hire',
  });

  const [offerForm, setOfferForm] = useState({
    offeredDesignation: '',
    department: '',
    salary: '₹6,00,000 / yr',
    joiningDate: new Date().toISOString().slice(0, 10),
    status: 'Sent',
    notes: '',
  });

  // Load all recruitment data from MongoDB Atlas
  const loadRecruitmentData = async () => {
    setLoading(true);
    setError('');
    try {
      const [jobsRes, candsRes, sumRes] = await Promise.all([
        apiClient.get('/recruitment/jobs'),
        apiClient.get('/recruitment/candidates'),
        apiClient.get('/recruitment/summary').catch(() => ({ data: { data: null } })),
      ]);

      const jobsData = jobsRes.data?.data || [];
      const candsData = candsRes.data?.data || [];
      setJobs(jobsData);
      setCandidates(candsData);

      if (sumRes.data?.data) {
        setSummary(sumRes.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load recruitment data from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecruitmentData();
  }, []);

  // Filtered Jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      const matchesSearch =
        j.title.toLowerCase().includes(search.toLowerCase()) ||
        j.jobId.toLowerCase().includes(search.toLowerCase()) ||
        j.designation.toLowerCase().includes(search.toLowerCase());
      const matchesDept = selectedDept === 'All' || j.department === selectedDept;
      const matchesStatus = selectedStatus === 'All' || j.status === selectedStatus;
      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [jobs, search, selectedDept, selectedStatus]);

  // Filtered Candidates
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        c.candidateId.toLowerCase().includes(search.toLowerCase()) ||
        c.appliedPosition.toLowerCase().includes(search.toLowerCase());
      const matchesDept = selectedDept === 'All' || c.department === selectedDept;
      const matchesStage = selectedStage === 'All' || c.stage === selectedStage;
      const matchesStatus = selectedStatus === 'All' || c.status === selectedStatus;
      return matchesSearch && matchesDept && matchesStage && matchesStatus;
    });
  }, [candidates, search, selectedDept, selectedStage, selectedStatus]);

  // All Scheduled/Completed Interviews across candidates
  const allInterviews = useMemo(() => {
    const list = [];
    candidates.forEach((c) => {
      (c.interviews || []).forEach((inv) => {
        list.push({
          ...inv,
          candidateId: c._id,
          candidateName: c.name,
          candidateEmail: c.email,
          appliedPosition: c.appliedPosition,
          department: c.department,
        });
      });
    });
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [candidates]);

  // All Offered/Selected Candidates
  const offeredCandidates = useMemo(() => {
    return candidates.filter((c) => c.offer || c.stage === 'Selected' || c.stage === 'Hired' || c.status === 'Offered');
  }, [candidates]);

  // ─── HANDLERS ─────────────────────────────────────────────────────────────

  // Open Create Job Modal
  const handleOpenCreateJob = (job = null) => {
    setSelectedJob(job);
    if (job) {
      setJobForm({
        title: job.title || '',
        department: job.department || 'Tech',
        designation: job.designation || '',
        openings: job.openings || 1,
        employmentType: job.employmentType || 'Full Time',
        location: job.location || 'In-Office / Hybrid',
        experience: job.experience || '1-3 Years',
        salaryRange: job.salaryRange || 'Competitive',
        priority: job.priority || 'Medium',
        openingDate: job.openingDate ? job.openingDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
        closingDate: job.closingDate ? job.closingDate.slice(0, 10) : '',
        description: job.description || '',
        requirements: job.requirements || '',
        status: job.status || 'Open',
      });
    } else {
      setJobForm({
        title: '',
        department: 'Tech',
        designation: '',
        openings: 1,
        employmentType: 'Full Time',
        location: 'In-Office / Hybrid',
        experience: '1-3 Years',
        salaryRange: 'Competitive',
        priority: 'Medium',
        openingDate: new Date().toISOString().slice(0, 10),
        closingDate: '',
        description: '',
        requirements: '',
        status: 'Open',
      });
    }
    setShowJobModal(true);
  };

  // Save Job Requisition
  const handleSaveJob = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (selectedJob) {
        await apiClient.put(`/recruitment/jobs/${selectedJob._id}`, jobForm);
        setSuccess('Job requisition updated successfully!');
      } else {
        await apiClient.post('/recruitment/jobs', jobForm);
        setSuccess('Job requisition published successfully!');
      }
      setShowJobModal(false);
      await loadRecruitmentData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save job requisition.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Add Candidate Modal
  const handleOpenAddCandidate = () => {
    setCandidateForm({
      name: '',
      email: '',
      phone: '',
      location: '',
      appliedJob: jobs[0]?._id || '',
      appliedPosition: jobs[0]?.title || 'Software Engineer',
      department: jobs[0]?.department || 'Tech',
      experience: '1-2 Years',
      skills: '',
      education: 'Graduate',
      currentCompany: '',
      noticePeriod: '30 Days',
      source: 'Direct Application',
      notes: '',
    });
    setShowCandidateModal(true);
  };

  // Save Candidate
  const handleSaveCandidate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post('/recruitment/candidates', candidateForm);
      setShowCandidateModal(false);
      setSuccess('Candidate profile created successfully!');
      await loadRecruitmentData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register candidate.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Candidate Profile
  const handleOpenProfile = (candidate) => {
    setSelectedCandidate(candidate);
    setShowProfileModal(true);
  };

  // Update Candidate Stage
  const handleUpdateStage = async (candidateId, newStage) => {
    try {
      await apiClient.patch(`/recruitment/candidates/${candidateId}/stage`, { stage: newStage });
      setSuccess(`Candidate moved to stage: ${newStage}`);
      await loadRecruitmentData();
      if (selectedCandidate && selectedCandidate._id === candidateId) {
        const updated = await apiClient.get(`/recruitment/candidates/${candidateId}`);
        setSelectedCandidate(updated.data?.data);
      }
    } catch (err) {
      setError('Failed to update candidate stage.');
    }
  };

  // Shortlist Candidate
  const handleShortlist = async (candidateId) => {
    try {
      await apiClient.patch(`/recruitment/candidates/${candidateId}/shortlist`);
      setSuccess('Candidate successfully shortlisted for interview rounds!');
      await loadRecruitmentData();
      if (selectedCandidate && selectedCandidate._id === candidateId) {
        const updated = await apiClient.get(`/recruitment/candidates/${candidateId}`);
        setSelectedCandidate(updated.data?.data);
      }
    } catch (err) {
      setError('Failed to shortlist candidate.');
    }
  };

  // Reject Candidate
  const handleReject = async (candidateId) => {
    try {
      await apiClient.patch(`/recruitment/candidates/${candidateId}/reject`);
      setSuccess('Candidate marked as Rejected.');
      await loadRecruitmentData();
      if (selectedCandidate && selectedCandidate._id === candidateId) {
        const updated = await apiClient.get(`/recruitment/candidates/${candidateId}`);
        setSelectedCandidate(updated.data?.data);
      }
    } catch (err) {
      setError('Failed to reject candidate.');
    }
  };

  // Open Schedule Interview Modal
  const handleOpenSchedule = (cand) => {
    setSelectedCandidate(cand);
    setInterviewForm({
      round: 'Technical Round 1',
      interviewer: 'Tech Lead / HR Manager',
      date: new Date().toISOString().slice(0, 10),
      time: '11:00 AM',
      type: 'Online Video',
      meetingLink: 'https://meet.google.com/xyz-abcd-efg',
      notes: '',
    });
    setShowInterviewModal(true);
  };

  // Submit Interview Schedule
  const handleSaveInterview = async (e) => {
    e.preventDefault();
    if (!selectedCandidate) return;
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post(`/recruitment/candidates/${selectedCandidate._id}/interviews`, interviewForm);
      setShowInterviewModal(false);
      setSuccess('Interview scheduled successfully!');
      await loadRecruitmentData();
      const updated = await apiClient.get(`/recruitment/candidates/${selectedCandidate._id}`);
      setSelectedCandidate(updated.data?.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to schedule interview.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Interview Feedback Modal
  const handleOpenFeedback = (cand, inv) => {
    setSelectedCandidate(cand);
    setSelectedInterview(inv);
    setFeedbackForm({
      technicalSkills: inv.feedback?.technicalSkills || 4,
      communication: inv.feedback?.communication || 4,
      problemSolving: inv.feedback?.problemSolving || 4,
      teamwork: inv.feedback?.teamwork || 4,
      overallRating: inv.feedback?.overallRating || 4,
      strengths: inv.feedback?.strengths || '',
      weaknesses: inv.feedback?.weaknesses || '',
      comments: inv.feedback?.comments || '',
      recommendation: inv.feedback?.recommendation || 'Hire',
    });
    setShowFeedbackModal(true);
  };

  // Submit Interview Feedback
  const handleSaveFeedback = async (e) => {
    e.preventDefault();
    if (!selectedCandidate || !selectedInterview) return;
    setSubmitting(true);
    setError('');
    try {
      await apiClient.patch(
        `/recruitment/candidates/${selectedCandidate._id}/interviews/${selectedInterview._id}`,
        {
          feedback: feedbackForm,
          status: 'Completed',
        }
      );
      setShowFeedbackModal(false);
      setSuccess('Interview feedback and rating submitted!');
      await loadRecruitmentData();
      const updated = await apiClient.get(`/recruitment/candidates/${selectedCandidate._id}`);
      setSelectedCandidate(updated.data?.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit interview feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Create Offer Modal
  const handleOpenOffer = (cand) => {
    setSelectedCandidate(cand);
    setOfferForm({
      offeredDesignation: cand.appliedPosition || 'Software Engineer',
      department: cand.department || 'Tech',
      salary: cand.offer?.salary || '₹6,50,000 / yr',
      joiningDate: cand.offer?.joiningDate ? cand.offer.joiningDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      status: cand.offer?.status || 'Sent',
      notes: cand.offer?.notes || '',
    });
    setShowOfferModal(true);
  };

  // Save Offer
  const handleSaveOffer = async (e) => {
    e.preventDefault();
    if (!selectedCandidate) return;
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post(`/recruitment/candidates/${selectedCandidate._id}/offer`, offerForm);
      setShowOfferModal(false);
      setSuccess('Job offer generated and saved successfully!');
      await loadRecruitmentData();
      const updated = await apiClient.get(`/recruitment/candidates/${selectedCandidate._id}`);
      setSelectedCandidate(updated.data?.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create offer.');
    } finally {
      setSubmitting(false);
    }
  };

  // Convert Candidate to Employee
  const handleConvertEmployee = async () => {
    if (!selectedCandidate) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await apiClient.post(`/recruitment/candidates/${selectedCandidate._id}/convert-employee`);
      setShowConvertModal(false);
      if (showProfileModal) setShowProfileModal(false);
      setSuccess(`Candidate successfully converted & onboarded as Employee in the live users directory!`);
      await loadRecruitmentData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to convert candidate to employee.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <UserLayout pageTitle="Recruitment & Hiring">
      <div className="rec-container">
        {/* Header */}
        <div className="rec-header">
          <div className="rec-title-area">
            <h2>Recruitment & Hiring Management</h2>
            <p>Manage job requisitions, candidate pipelines, interviews, offers, and employee conversions.</p>
          </div>
          <div className="rec-header-actions">
            <button type="button" className="rec-secondary-btn" onClick={() => handleOpenAddCandidate()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="16" y1="11" x2="22" y2="11" />
              </svg>
              Add Candidate
            </button>
            <button type="button" className="rec-primary-btn" onClick={() => handleOpenCreateJob()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create Job Requisition
            </button>
          </div>
        </div>

        {/* Real-time KPI Metric Cards */}
        <div className="rec-kpi-grid">
          <div className="rec-kpi-card accent">
            <span className="rec-kpi-label">Open Positions</span>
            <strong className="rec-kpi-value">{summary.openPositions}</strong>
          </div>
          <div className="rec-kpi-card">
            <span className="rec-kpi-label">Total Applicants</span>
            <strong className="rec-kpi-value">{summary.totalApplicants}</strong>
          </div>
          <div className="rec-kpi-card">
            <span className="rec-kpi-label">New Applicants</span>
            <strong className="rec-kpi-value">{summary.newApplicants}</strong>
          </div>
          <div className="rec-kpi-card">
            <span className="rec-kpi-label">Shortlisted</span>
            <strong className="rec-kpi-value">{summary.shortlistedCandidates}</strong>
          </div>
          <div className="rec-kpi-card">
            <span className="rec-kpi-label">Interviews</span>
            <strong className="rec-kpi-value">{summary.interviewsScheduled}</strong>
          </div>
          <div className="rec-kpi-card">
            <span className="rec-kpi-label">Selected</span>
            <strong className="rec-kpi-value">{summary.selectedCandidates}</strong>
          </div>
          <div className="rec-kpi-card">
            <span className="rec-kpi-label">Positions Filled</span>
            <strong className="rec-kpi-value">{summary.positionsFilled}</strong>
          </div>
        </div>

        {/* Alerts */}
        {error && <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
        {success && <div style={{ background: '#DCFCE7', color: '#15803D', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>{success}</div>}

        {/* Workspace Tabs */}
        <div className="rec-nav-tabs-wrap">
          <div className="rec-nav-tabs">
            <button
              type="button"
              className={`rec-tab-btn ${activeTab === 'jobs' ? 'active' : ''}`}
              onClick={() => setActiveTab('jobs')}
            >
              Job Requisitions ({jobs.length})
            </button>
            <button
              type="button"
              className={`rec-tab-btn ${activeTab === 'pipeline' ? 'active' : ''}`}
              onClick={() => setActiveTab('pipeline')}
            >
              Recruitment Pipeline Board
            </button>
            <button
              type="button"
              className={`rec-tab-btn ${activeTab === 'candidates' ? 'active' : ''}`}
              onClick={() => setActiveTab('candidates')}
            >
              Candidate Directory ({candidates.length})
            </button>
            <button
              type="button"
              className={`rec-tab-btn ${activeTab === 'interviews' ? 'active' : ''}`}
              onClick={() => setActiveTab('interviews')}
            >
              Interviews Schedule ({allInterviews.length})
            </button>
            <button
              type="button"
              className={`rec-tab-btn ${activeTab === 'offers' ? 'active' : ''}`}
              onClick={() => setActiveTab('offers')}
            >
              Offers & Conversions ({offeredCandidates.length})
            </button>
            <button
              type="button"
              className={`rec-tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              Hiring Analytics
            </button>
          </div>
        </div>

        {/* ─── TAB 1: JOB REQUISITIONS ─── */}
        {activeTab === 'jobs' && (
          <div>
            <div className="rec-toolbar">
              <div className="rec-search-wrap">
                <svg className="rec-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search jobs by title, ID, or designation..."
                  className="rec-search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select className="rec-filter-select" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
                <option value="All">All Departments</option>
                {OFFICIAL_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select className="rec-filter-select" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                <option value="All">All Statuses</option>
                <option value="Open">Open</option>
                <option value="On Hold">On Hold</option>
                <option value="Closed">Closed</option>
                <option value="Draft">Draft</option>
              </select>
            </div>

            <div className="rec-table-card">
              {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading job requisitions...</div>
              ) : filteredJobs.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  No job requisitions found. Click "Create Job Requisition" to publish an opening.
                </div>
              ) : (
                <div className="rec-table-wrap">
                  <table className="rec-table">
                    <thead>
                      <tr>
                        <th>Job ID</th>
                        <th>Job Title</th>
                        <th>Department</th>
                        <th>Designation</th>
                        <th>Openings</th>
                        <th>Type</th>
                        <th>Experience</th>
                        <th>Applicants</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredJobs.map((job) => (
                        <tr key={job._id}>
                          <td><strong>{job.jobId}</strong></td>
                          <td>
                            <strong>{job.title}</strong>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>{job.location}</span>
                          </td>
                          <td><span className="hr-emp-dept-pill">{job.department}</span></td>
                          <td>{job.designation}</td>
                          <td><strong>{job.openings}</strong> vacancy</td>
                          <td>{job.employmentType}</td>
                          <td>{job.experience}</td>
                          <td>
                            <span style={{ fontWeight: '700', color: '#EA580C' }}>{job.applicantCount}</span> applicants
                          </td>
                          <td>
                            <span className={`rec-badge ${job.status.toLowerCase().replace(' ', '_')}`}>
                              {job.status}
                            </span>
                          </td>
                          <td>
                            <div className="rec-actions-wrap">
                              <button
                                type="button"
                                className="rec-btn-sm view"
                                onClick={() => handleOpenCreateJob(job)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="rec-btn-sm interview"
                                onClick={() => {
                                  setSelectedDept(job.department);
                                  setActiveTab('candidates');
                                }}
                              >
                                View Candidates
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 2: VISUAL RECRUITMENT PIPELINE BOARD ─── */}
        {activeTab === 'pipeline' && (
          <div className="rec-pipeline-board">
            {PIPELINE_STAGES.map((stage) => {
              const stageCandidates = candidates.filter((c) => c.stage === stage);
              return (
                <div key={stage} className="rec-pipeline-column">
                  <div className="rec-col-header">
                    <h4>{stage}</h4>
                    <span className="rec-col-count">{stageCandidates.length}</span>
                  </div>

                  <div className="rec-col-cards">
                    {stageCandidates.length === 0 ? (
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center', padding: '1.5rem 0' }}>
                        No candidates
                      </div>
                    ) : (
                      stageCandidates.map((cand) => (
                        <div
                          key={cand._id}
                          className="rec-cand-card"
                          onClick={() => handleOpenProfile(cand)}
                        >
                          <h5 className="rec-cand-card-name">{cand.name}</h5>
                          <p className="rec-cand-card-pos">{cand.appliedPosition} · {cand.department}</p>
                          <div className="rec-cand-card-footer">
                            <span>{cand.experience}</span>
                            <span>{cand.candidateId}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── TAB 3: CANDIDATE DIRECTORY ─── */}
        {activeTab === 'candidates' && (
          <div>
            <div className="rec-toolbar">
              <div className="rec-search-wrap">
                <svg className="rec-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search candidates by name, email, ID, or position..."
                  className="rec-search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select className="rec-filter-select" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
                <option value="All">All Departments</option>
                {OFFICIAL_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select className="rec-filter-select" value={selectedStage} onChange={(e) => setSelectedStage(e.target.value)}>
                <option value="All">All Stages</option>
                {PIPELINE_STAGES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="rec-table-card">
              {filteredCandidates.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  No candidates found matching the filters. Click "Add Candidate" to register an applicant.
                </div>
              ) : (
                <div className="rec-table-wrap">
                  <table className="rec-table">
                    <thead>
                      <tr>
                        <th>Candidate Name</th>
                        <th>Email & Phone</th>
                        <th>Applied Position</th>
                        <th>Department</th>
                        <th>Experience</th>
                        <th>Pipeline Stage</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCandidates.map((cand) => (
                        <tr key={cand._id}>
                          <td>
                            <strong>{cand.name}</strong>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>{cand.candidateId}</span>
                          </td>
                          <td>
                            <div>{cand.email}</div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{cand.phone}</span>
                          </td>
                          <td>{cand.appliedPosition}</td>
                          <td><span className="hr-emp-dept-pill">{cand.department}</span></td>
                          <td>{cand.experience}</td>
                          <td>
                            <span className={`rec-badge ${cand.stage.toLowerCase().replace(' ', '_')}`}>
                              {cand.stage}
                            </span>
                          </td>
                          <td>
                            <span className={`rec-badge ${cand.status.toLowerCase().replace(' ', '_')}`}>
                              {cand.status}
                            </span>
                          </td>
                          <td>
                            <div className="rec-actions-wrap">
                              <button type="button" className="rec-btn-sm view" onClick={() => handleOpenProfile(cand)}>
                                Profile
                              </button>
                              {cand.stage === 'Applied' && (
                                <button type="button" className="rec-btn-sm shortlist" onClick={() => handleShortlist(cand._id)}>
                                  Shortlist
                                </button>
                              )}
                              {['Shortlisted', 'Interview', 'Technical Round', 'HR Round'].includes(cand.stage) && (
                                <button type="button" className="rec-btn-sm interview" onClick={() => handleOpenSchedule(cand)}>
                                  Interview
                                </button>
                              )}
                              {cand.stage === 'Selected' && !cand.convertedEmployeeId && (
                                <button
                                  type="button"
                                  className="rec-btn-sm convert"
                                  onClick={() => {
                                    setSelectedCandidate(cand);
                                    setShowConvertModal(true);
                                  }}
                                >
                                  Hire
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 4: INTERVIEWS SCHEDULE ─── */}
        {activeTab === 'interviews' && (
          <div>
            <div className="rec-table-card">
              {allInterviews.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  No interviews scheduled. Select a candidate to schedule an interview round.
                </div>
              ) : (
                <div className="rec-table-wrap">
                  <table className="rec-table">
                    <thead>
                      <tr>
                        <th>Candidate</th>
                        <th>Position & Dept</th>
                        <th>Interview Round</th>
                        <th>Interviewer</th>
                        <th>Date & Time</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allInterviews.map((inv) => (
                        <tr key={inv._id}>
                          <td>
                            <strong>{inv.candidateName}</strong>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>{inv.candidateEmail}</span>
                          </td>
                          <td>
                            <div>{inv.appliedPosition}</div>
                            <span className="hr-emp-dept-pill">{inv.department}</span>
                          </td>
                          <td><strong>{inv.round}</strong></td>
                          <td>{inv.interviewer}</td>
                          <td>
                            <div>{formatDate(inv.date)}</div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{inv.time}</span>
                          </td>
                          <td>{inv.type}</td>
                          <td>
                            <span className={`rec-badge ${inv.status.toLowerCase()}`}>
                              {inv.status}
                            </span>
                          </td>
                          <td>
                            <div className="rec-actions-wrap">
                              {inv.status !== 'Completed' && (
                                <button
                                  type="button"
                                  className="rec-btn-sm shortlist"
                                  onClick={() => {
                                    const cand = candidates.find((c) => c._id === inv.candidateId);
                                    handleOpenFeedback(cand, inv);
                                  }}
                                >
                                  Submit Feedback
                                </button>
                              )}
                              {inv.feedback && (
                                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#15803D' }}>
                                  ⭐ {inv.feedback.overallRating}/5 ({inv.feedback.recommendation})
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 5: OFFERS & EMPLOYEE CONVERSIONS ─── */}
        {activeTab === 'offers' && (
          <div>
            <div className="rec-table-card">
              {offeredCandidates.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  No job offers recorded yet. Select candidates from the directory to generate offer letters.
                </div>
              ) : (
                <div className="rec-table-wrap">
                  <table className="rec-table">
                    <thead>
                      <tr>
                        <th>Candidate</th>
                        <th>Offered Designation</th>
                        <th>Department</th>
                        <th>Offered Salary</th>
                        <th>Joining Date</th>
                        <th>Offer Status</th>
                        <th>Employee Onboarding</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {offeredCandidates.map((cand) => (
                        <tr key={cand._id}>
                          <td>
                            <strong>{cand.name}</strong>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>{cand.email}</span>
                          </td>
                          <td>{cand.offer?.offeredDesignation || cand.appliedPosition}</td>
                          <td><span className="hr-emp-dept-pill">{cand.offer?.department || cand.department}</span></td>
                          <td><strong>{cand.offer?.salary || 'Competitive'}</strong></td>
                          <td>{formatDate(cand.offer?.joiningDate)}</td>
                          <td>
                            <span className={`rec-badge ${cand.offer?.status?.toLowerCase() || 'sent'}`}>
                              {cand.offer?.status || 'Sent'}
                            </span>
                          </td>
                          <td>
                            {cand.convertedEmployeeId || cand.status === 'Hired' ? (
                              <span className="rec-badge hired">✅ Onboarded Employee</span>
                            ) : (
                              <button
                                type="button"
                                className="rec-btn-sm convert"
                                onClick={() => {
                                  setSelectedCandidate(cand);
                                  setShowConvertModal(true);
                                }}
                              >
                                Convert to Employee
                              </button>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="rec-btn-sm view"
                              onClick={() => handleOpenOffer(cand)}
                            >
                              Edit Offer
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 6: HIRING ANALYTICS & REPORTS ─── */}
        {activeTab === 'reports' && (
          <div className="rec-analytics-grid">
            <div className="rec-analytics-card">
              <h4>Open Positions & Applicants by Department</h4>
              {OFFICIAL_DEPARTMENTS.map((dept) => {
                const st = summary.deptStats?.[dept] || { openJobs: 0, applicants: 0, hired: 0 };
                return (
                  <div key={dept} style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                      <span>{dept}</span>
                      <span>{st.openJobs} vacancies · {st.applicants} applicants</span>
                    </div>
                    <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, st.applicants * 15)}%`, height: '100%', background: '#EA580C', borderRadius: '4px' }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rec-analytics-card">
              <h4>Recruitment Pipeline Conversion Distribution</h4>
              {PIPELINE_STAGES.map((st) => {
                const cnt = summary.stageCounts?.[st] || 0;
                const pct = summary.totalApplicants > 0 ? ((cnt / summary.totalApplicants) * 100).toFixed(1) : 0;
                return (
                  <div key={st} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: '600', color: '#334155' }}>{st}</span>
                    <div>
                      <strong style={{ color: '#0f172a', marginRight: '0.5rem' }}>{cnt}</strong>
                      <span style={{ color: '#64748b', fontSize: '0.78rem' }}>({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── CREATE/EDIT JOB REQUISITION MODAL ─── */}
        {showJobModal && (
          <div className="hr-modal-overlay" onClick={() => setShowJobModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
              <div className="hr-modal-header">
                <h3>{selectedJob ? 'Edit Job Requisition' : 'Create Job Requisition'}</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowJobModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleSaveJob}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid">
                    <div className="hr-form-group">
                      <label>Job Title *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Senior Frontend Engineer"
                        value={jobForm.title}
                        onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Department *</label>
                      <select
                        required
                        value={jobForm.department}
                        onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })}
                      >
                        {OFFICIAL_DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Designation *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. React Developer"
                        value={jobForm.designation}
                        onChange={(e) => setJobForm({ ...jobForm, designation: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Number of Openings *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={jobForm.openings}
                        onChange={(e) => setJobForm({ ...jobForm, openings: Number(e.target.value) })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Employment Type</label>
                      <select
                        value={jobForm.employmentType}
                        onChange={(e) => setJobForm({ ...jobForm, employmentType: e.target.value })}
                      >
                        <option value="Full Time">Full Time</option>
                        <option value="Part Time">Part Time</option>
                        <option value="Intern">Intern</option>
                        <option value="Contract">Contract</option>
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Priority</label>
                      <select
                        value={jobForm.priority}
                        onChange={(e) => setJobForm({ ...jobForm, priority: e.target.value })}
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Salary Range / CTC</label>
                      <input
                        type="text"
                        placeholder="e.g. ₹8,00,000 - ₹12,00,000 / yr"
                        value={jobForm.salaryRange}
                        onChange={(e) => setJobForm({ ...jobForm, salaryRange: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Experience Required</label>
                      <input
                        type="text"
                        placeholder="e.g. 2-4 Years"
                        value={jobForm.experience}
                        onChange={(e) => setJobForm({ ...jobForm, experience: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Job Description & Responsibilities</label>
                      <textarea
                        rows={3}
                        placeholder="Key responsibilities and day-to-day deliverables..."
                        value={jobForm.description}
                        onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Requirements & Required Skills</label>
                      <textarea
                        rows={2}
                        placeholder="Required technical skills, education, certifications..."
                        value={jobForm.requirements}
                        onChange={(e) => setJobForm({ ...jobForm, requirements: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Status</label>
                      <select
                        value={jobForm.status}
                        onChange={(e) => setJobForm({ ...jobForm, status: e.target.value })}
                      >
                        <option value="Open">Open</option>
                        <option value="Draft">Draft</option>
                        <option value="On Hold">On Hold</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowJobModal(false)}>Cancel</button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : selectedJob ? 'Save Changes' : 'Publish Job'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── ADD CANDIDATE MODAL ─── */}
        {showCandidateModal && (
          <div className="hr-modal-overlay" onClick={() => setShowCandidateModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
              <div className="hr-modal-header">
                <h3>Register Candidate</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowCandidateModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleSaveCandidate}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid">
                    <div className="hr-form-group">
                      <label>Candidate Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Sameer Kulkarni"
                        value={candidateForm.name}
                        onChange={(e) => setCandidateForm({ ...candidateForm, name: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Email Address *</label>
                      <input
                        type="email"
                        required
                        placeholder="sameer.k@example.com"
                        value={candidateForm.email}
                        onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Phone Number *</label>
                      <input
                        type="tel"
                        required
                        placeholder="+91 9876543210"
                        value={candidateForm.phone}
                        onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Department *</label>
                      <select
                        required
                        value={candidateForm.department}
                        onChange={(e) => setCandidateForm({ ...candidateForm, department: e.target.value })}
                      >
                        {OFFICIAL_DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Applied Position *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Software Engineer"
                        value={candidateForm.appliedPosition}
                        onChange={(e) => setCandidateForm({ ...candidateForm, appliedPosition: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Experience</label>
                      <input
                        type="text"
                        placeholder="e.g. 3 Years"
                        value={candidateForm.experience}
                        onChange={(e) => setCandidateForm({ ...candidateForm, experience: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Key Skills (comma separated)</label>
                      <input
                        type="text"
                        placeholder="e.g. React, Node.js, TypeScript, MongoDB"
                        value={candidateForm.skills}
                        onChange={(e) => setCandidateForm({ ...candidateForm, skills: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Current Company</label>
                      <input
                        type="text"
                        placeholder="e.g. Acme Tech Ltd"
                        value={candidateForm.currentCompany}
                        onChange={(e) => setCandidateForm({ ...candidateForm, currentCompany: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Notice Period</label>
                      <input
                        type="text"
                        placeholder="e.g. 15 Days / Immediate"
                        value={candidateForm.noticePeriod}
                        onChange={(e) => setCandidateForm({ ...candidateForm, noticePeriod: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowCandidateModal(false)}>Cancel</button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Registering...' : 'Save Candidate'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── CANDIDATE PROFILE MODAL ─── */}
        {showProfileModal && selectedCandidate && (
          <div className="hr-modal-overlay" onClick={() => setShowProfileModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
              <div className="hr-modal-header">
                <h3>Candidate Profile: {selectedCandidate.name}</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowProfileModal(false)}>&times;</button>
              </div>

              <div className="hr-modal-body">
                {/* Banner */}
                <div className="hr-profile-header-banner">
                  <div className="hr-profile-avatar-lg">
                    {selectedCandidate.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="hr-profile-main-info">
                    <h4>{selectedCandidate.name}</h4>
                    <span>{selectedCandidate.appliedPosition} · {selectedCandidate.department}</span>
                  </div>
                  <div>
                    <span className={`rec-badge ${selectedCandidate.stage.toLowerCase().replace(' ', '_')}`}>
                      {selectedCandidate.stage}
                    </span>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="hr-profile-details-grid" style={{ marginBottom: '1.25rem' }}>
                  <div className="hr-profile-item">
                    <span>Email Address</span>
                    <strong>{selectedCandidate.email}</strong>
                  </div>
                  <div className="hr-profile-item">
                    <span>Phone Number</span>
                    <strong>{selectedCandidate.phone}</strong>
                  </div>
                  <div className="hr-profile-item">
                    <span>Total Experience</span>
                    <strong>{selectedCandidate.experience}</strong>
                  </div>
                  <div className="hr-profile-item">
                    <span>Current Company</span>
                    <strong>{selectedCandidate.currentCompany || 'Not specified'}</strong>
                  </div>
                  <div className="hr-profile-item">
                    <span>Notice Period</span>
                    <strong>{selectedCandidate.noticePeriod}</strong>
                  </div>
                  <div className="hr-profile-item">
                    <span>Candidate ID</span>
                    <strong>{selectedCandidate.candidateId}</strong>
                  </div>
                </div>

                {/* Skills */}
                {selectedCandidate.skills?.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>Skills:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.35rem' }}>
                      {selectedCandidate.skills.map((s, i) => (
                        <span key={i} style={{ background: '#f1f5f9', color: '#334155', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: '600' }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scheduled Interviews */}
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h5 style={{ margin: 0, fontWeight: '700', color: '#0f172a' }}>Interview History</h5>
                    <button type="button" className="rec-btn-sm interview" onClick={() => handleOpenSchedule(selectedCandidate)}>
                      + Schedule Round
                    </button>
                  </div>
                  {selectedCandidate.interviews?.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b' }}>No interview rounds recorded yet.</p>
                  ) : (
                    selectedCandidate.interviews?.map((inv) => (
                      <div key={inv._id} style={{ padding: '0.65rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>{inv.round}</strong> ({formatDate(inv.date)} at {inv.time})
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Interviewer: {inv.interviewer} · {inv.type}</div>
                        </div>
                        <div>
                          <span className={`rec-badge ${inv.status.toLowerCase()}`}>{inv.status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Offer Section */}
                {selectedCandidate.offer && (
                  <div style={{ background: '#ECFDF5', padding: '1rem', borderRadius: '8px', border: '1px solid #A7F3D0', marginBottom: '1rem' }}>
                    <h5 style={{ margin: '0 0 0.35rem 0', fontWeight: '700', color: '#065F46' }}>Job Offer Details</h5>
                    <div style={{ fontSize: '0.85rem', color: '#047857' }}>
                      Designation: <strong>{selectedCandidate.offer.offeredDesignation}</strong> · Salary: <strong>{selectedCandidate.offer.salary}</strong> · Joining Date: <strong>{formatDate(selectedCandidate.offer.joiningDate)}</strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="hr-modal-footer">
                <button type="button" className="hr-btn-secondary" onClick={() => setShowProfileModal(false)}>Close</button>
                {selectedCandidate.stage !== 'Shortlisted' && selectedCandidate.stage !== 'Hired' && (
                  <button type="button" className="rec-btn-sm shortlist" onClick={() => handleShortlist(selectedCandidate._id)}>
                    Shortlist
                  </button>
                )}
                <button type="button" className="rec-btn-sm interview" onClick={() => handleOpenOffer(selectedCandidate)}>
                  Create / View Offer
                </button>
                {!selectedCandidate.convertedEmployeeId && selectedCandidate.status !== 'Hired' && (
                  <button
                    type="button"
                    className="rec-btn-sm convert"
                    onClick={() => setShowConvertModal(true)}
                  >
                    Convert to Employee
                  </button>
                )}
                {selectedCandidate.stage !== 'Rejected' && (
                  <button type="button" className="rec-btn-sm reject" onClick={() => handleReject(selectedCandidate._id)}>
                    Reject
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── SCHEDULE INTERVIEW MODAL ─── */}
        {showInterviewModal && selectedCandidate && (
          <div className="hr-modal-overlay" onClick={() => setShowInterviewModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
              <div className="hr-modal-header">
                <h3>Schedule Interview: {selectedCandidate.name}</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowInterviewModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleSaveInterview}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid">
                    <div className="hr-form-group full-width">
                      <label>Interview Round *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Technical Round 1 / System Design"
                        value={interviewForm.round}
                        onChange={(e) => setInterviewForm({ ...interviewForm, round: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Interviewer Name / Lead *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rohit Sharma"
                        value={interviewForm.interviewer}
                        onChange={(e) => setInterviewForm({ ...interviewForm, interviewer: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Interview Type</label>
                      <select
                        value={interviewForm.type}
                        onChange={(e) => setInterviewForm({ ...interviewForm, type: e.target.value })}
                      >
                        <option value="Online Video">Online Video</option>
                        <option value="In-Person">In-Person</option>
                        <option value="Telephonic">Telephonic</option>
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Interview Date *</label>
                      <input
                        type="date"
                        required
                        value={interviewForm.date}
                        onChange={(e) => setInterviewForm({ ...interviewForm, date: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Interview Time</label>
                      <input
                        type="text"
                        placeholder="e.g. 02:30 PM"
                        value={interviewForm.time}
                        onChange={(e) => setInterviewForm({ ...interviewForm, time: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Meeting Link / Location</label>
                      <input
                        type="text"
                        placeholder="https://meet.google.com/..."
                        value={interviewForm.meetingLink}
                        onChange={(e) => setInterviewForm({ ...interviewForm, meetingLink: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowInterviewModal(false)}>Cancel</button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Scheduling...' : 'Schedule Interview'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── INTERVIEW FEEDBACK MODAL ─── */}
        {showFeedbackModal && selectedCandidate && (
          <div className="hr-modal-overlay" onClick={() => setShowFeedbackModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
              <div className="hr-modal-header">
                <h3>Submit Interview Feedback</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowFeedbackModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleSaveFeedback}>
                <div className="hr-modal-body">
                  <div className="perf-rating-grid">
                    {[
                      { key: 'technicalSkills', label: 'Technical Competency' },
                      { key: 'communication', label: 'Communication Skills' },
                      { key: 'problemSolving', label: 'Problem Solving' },
                      { key: 'teamwork', label: 'Cultural & Team Fit' },
                      { key: 'overallRating', label: 'Overall Candidate Score' },
                    ].map((cat) => (
                      <div key={cat.key} className="perf-rating-item">
                        <div className="perf-rating-header">
                          <span>{cat.label}</span>
                          <strong>{feedbackForm[cat.key]} / 5 ⭐</strong>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          step="1"
                          className="perf-rating-slider"
                          value={feedbackForm[cat.key]}
                          onChange={(e) => setFeedbackForm({ ...feedbackForm, [cat.key]: Number(e.target.value) })}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="hr-form-grid">
                    <div className="hr-form-group full-width">
                      <label>Hiring Recommendation *</label>
                      <select
                        required
                        value={feedbackForm.recommendation}
                        onChange={(e) => setFeedbackForm({ ...feedbackForm, recommendation: e.target.value })}
                      >
                        <option value="Strong Hire">Strong Hire</option>
                        <option value="Hire">Hire</option>
                        <option value="Hold">Hold</option>
                        <option value="Reject">Reject</option>
                      </select>
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Strengths & Observations</label>
                      <textarea
                        rows={2}
                        placeholder="Key technical and interpersonal strengths..."
                        value={feedbackForm.strengths}
                        onChange={(e) => setFeedbackForm({ ...feedbackForm, strengths: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Evaluation Comments</label>
                      <textarea
                        rows={2}
                        placeholder="Interviewer notes and next round recommendations..."
                        value={feedbackForm.comments}
                        onChange={(e) => setFeedbackForm({ ...feedbackForm, comments: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowFeedbackModal(false)}>Cancel</button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Save Feedback'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── CREATE OFFER MODAL ─── */}
        {showOfferModal && selectedCandidate && (
          <div className="hr-modal-overlay" onClick={() => setShowOfferModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
              <div className="hr-modal-header">
                <h3>Job Offer: {selectedCandidate.name}</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowOfferModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleSaveOffer}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid">
                    <div className="hr-form-group full-width">
                      <label>Offered Designation *</label>
                      <input
                        type="text"
                        required
                        value={offerForm.offeredDesignation}
                        onChange={(e) => setOfferForm({ ...offerForm, offeredDesignation: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Department *</label>
                      <select
                        required
                        value={offerForm.department}
                        onChange={(e) => setOfferForm({ ...offerForm, department: e.target.value })}
                      >
                        {OFFICIAL_DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Salary / CTC (Annual) *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. ₹7,50,000 / yr"
                        value={offerForm.salary}
                        onChange={(e) => setOfferForm({ ...offerForm, salary: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Target Joining Date *</label>
                      <input
                        type="date"
                        required
                        value={offerForm.joiningDate}
                        onChange={(e) => setOfferForm({ ...offerForm, joiningDate: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Offer Status</label>
                      <select
                        value={offerForm.status}
                        onChange={(e) => setOfferForm({ ...offerForm, status: e.target.value })}
                      >
                        <option value="Sent">Sent</option>
                        <option value="Draft">Draft</option>
                        <option value="Accepted">Accepted</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowOfferModal(false)}>Cancel</button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Saving Offer...' : 'Save & Send Offer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── CONVERT TO EMPLOYEE CONFIRMATION MODAL ─── */}
        {showConvertModal && selectedCandidate && (
          <div className="hr-modal-overlay" onClick={() => setShowConvertModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="hr-modal-header">
                <h3>Onboard Candidate to Workforce</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowConvertModal(false)}>&times;</button>
              </div>

              <div className="hr-modal-body">
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎉</div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>Convert {selectedCandidate.name} to Active Employee?</h4>
                  <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: '1.5' }}>
                    This action will create an official employee record in the live <strong>users</strong> collection, generate an Employee ID, link the candidate profile, and mark their status as <strong>Hired</strong>.
                  </p>
                </div>
              </div>

              <div className="hr-modal-footer">
                <button type="button" className="hr-btn-secondary" onClick={() => setShowConvertModal(false)}>Cancel</button>
                <button
                  type="button"
                  className="rec-btn-sm convert"
                  style={{ padding: '0.65rem 1.25rem', fontSize: '0.875rem' }}
                  disabled={submitting}
                  onClick={handleConvertEmployee}
                >
                  {submitting ? 'Onboarding...' : 'Confirm & Convert'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
}
