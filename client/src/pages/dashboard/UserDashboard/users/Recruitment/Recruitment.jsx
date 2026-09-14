import React, { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import apiClient from '../../../../../services/apiClient';
import UserLayout from '../components/UserLayout';
import './Recruitment.css';
import '../Employees/HREmployees.css';

const formatDate = (val) => {
  if (!val) return 'N/A';
  try { return new Date(val).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch (e) { return String(val); }
};

const computeDurationText = (startDate, endDate) => {
  if (!startDate || !endDate) return '';
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return '';
  let months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (e.getDate() < s.getDate()) months -= 1;
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  const parts = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'Year' : 'Years'}`);
  if (remMonths > 0 || years === 0) parts.push(`${remMonths} ${remMonths === 1 ? 'Month' : 'Months'}`);
  return parts.join(', ');
};

const expBadgeCls = (s) => {
  const m = { Issued: 'rec-badge-accepted', Draft: 'rec-badge-draft', Revoked: 'rec-badge-rejected' };
  return 'rec-badge ' + (m[s] || '');
};

const getBase64ImageFromUrl = (url) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

const OFFICIAL_DEPARTMENTS = ['HR', 'Finance', 'Business Development', 'Digital Marketing', 'Video Editor', 'Tech'];
const PIPELINE_MAIN_STAGES = ['Applied', 'Screening', 'Shortlisted', 'Assessment', 'Interview', 'Technical Round', 'Final / HR Round', 'Selected', 'Offer', 'Hired'];
const PIPELINE_TERMINAL_STAGES = ['Rejected', 'Withdrawn', 'On Hold'];
const ALL_PIPELINE_STAGES = [...PIPELINE_MAIN_STAGES, ...PIPELINE_TERMINAL_STAGES];
const PIPELINE_STAGES = ALL_PIPELINE_STAGES;

const VALID_TRANSITIONS = {
  'Applied': ['Screening', 'Shortlisted', 'Rejected', 'Withdrawn', 'On Hold'],
  'Screening': ['Applied', 'Shortlisted', 'Assessment', 'Interview', 'Technical Round', 'Rejected', 'Withdrawn', 'On Hold'],
  'Shortlisted': ['Screening', 'Assessment', 'Interview', 'Technical Round', 'Rejected', 'Withdrawn', 'On Hold'],
  'Assessment': ['Shortlisted', 'Interview', 'Technical Round', 'Final / HR Round', 'Selected', 'Rejected', 'Withdrawn', 'On Hold'],
  'Interview': ['Shortlisted', 'Assessment', 'Technical Round', 'HR Round', 'Final / HR Round', 'Selected', 'Rejected', 'Withdrawn', 'On Hold'],
  'Technical Round': ['Assessment', 'Interview', 'HR Round', 'Final / HR Round', 'Selected', 'Rejected', 'Withdrawn', 'On Hold'],
  'HR Round': ['Technical Round', 'Interview', 'Final / HR Round', 'Selected', 'Rejected', 'Withdrawn', 'On Hold'],
  'Final / HR Round': ['Technical Round', 'Interview', 'Selected', 'Rejected', 'Withdrawn', 'On Hold'],
  'Selected': ['Offer', 'Interview', 'Final / HR Round', 'Technical Round', 'Rejected', 'Withdrawn', 'On Hold'],
  'Offer': ['Hired', 'Selected', 'Rejected', 'Withdrawn', 'On Hold'],
  'Hired': ['Offer', 'Selected', 'Withdrawn'],
  'On Hold': ['Applied', 'Screening', 'Shortlisted', 'Assessment', 'Interview', 'Technical Round', 'Final / HR Round', 'Selected', 'Offer', 'Rejected', 'Withdrawn'],
  'Rejected': ['Applied', 'Screening', 'Shortlisted', 'Assessment', 'Interview', 'Technical Round', 'Selected'],
  'Withdrawn': ['Applied', 'Screening', 'Shortlisted', 'Assessment', 'Interview', 'Selected'],
};

const extractCandidateArray = (res) => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data?.data)) return res.data.data;
  if (Array.isArray(res.data?.candidates)) return res.data.candidates;
  if (Array.isArray(res.data?.data?.candidates)) return res.data.data.candidates;
  if (Array.isArray(res.data)) return res.data;
  return [];
};

const DEFAULT_OFFER_FORM = {
  candidateId: '', offeredDesignation: '', department: 'Tech', employmentType: 'Full Time',
  salary: '', joiningDate: new Date(Date.now() + 30*86400000).toISOString().slice(0,10),
  offerDate: new Date().toISOString().slice(0,10),
  expiresAt: new Date(Date.now() + 14*86400000).toISOString().slice(0,10),
  probationPeriod: '6 Months', workLocation: '', reportingManager: '',
  workingHours: '9:00 AM - 6:00 PM (Mon-Sat)', noticePeriod: '30 Days',
  termsAndConditions: '', additionalNotes: '',
};

export default function Recruitment() {
  // ── Core state ──────────────────────────────────────────────────────
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState('');
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [summary, setSummary] = useState({ openPositions:0, totalApplicants:0, newApplicants:0, shortlistedCandidates:0, interviewsScheduled:0, selectedCandidates:0, positionsFilled:0, stageCounts:{}, deptStats:{} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('jobs');
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedStage, setSelectedStage] = useState('All');

  // ── Existing modal states (UNCHANGED) ───────────────────────────────
  const [showJobModal, setShowJobModal] = useState(false);
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Offer Letter system state (INDEPENDENT) ─────────────────────────
  const [offers, setOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offerSummary, setOfferSummary] = useState({ total:0, draft:0, sent:0, accepted:0, rejected:0, pendingConversion:0 });
  const [offerSearch, setOfferSearch] = useState('');
  const [offerStatusFilter, setOfferStatusFilter] = useState('All');
  const [offerDeptFilter, setOfferDeptFilter] = useState('All');
  const [offerEmpTypeFilter, setOfferEmpTypeFilter] = useState('All');
  const [offerSortDir, setOfferSortDir] = useState('newest');

  // -- Independent modal states -- DO NOT conflate with general candidate modal
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showOfferNewCandidateModal, setShowOfferNewCandidateModal] = useState(false);
  const [showOfferPreviewModal, setShowOfferPreviewModal] = useState(false);
  const [showOfferSendModal, setShowOfferSendModal] = useState(false);
  const [showOfferDeleteModal, setShowOfferDeleteModal] = useState(false);
  const [showOfferConvertModal, setShowOfferConvertModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [viewingOffer, setViewingOffer] = useState(null);
  const [offerForm, setOfferForm] = useState(DEFAULT_OFFER_FORM);
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [offerError, setOfferError] = useState('');
  const [offerSuccess, setOfferSuccess] = useState('');
  const [offerNewCandidateForm, setOfferNewCandidateForm] = useState({ name:'', email:'', phone:'', location:'', appliedJob:'', appliedPosition:'', department:'Tech', experience:'0-1 Years', skills:'', education:'Graduate', currentCompany:'', noticePeriod:'30 Days', source:'Direct Application', notes:'' });
  const [offerNewCandidateSubmitting, setOfferNewCandidateSubmitting] = useState(false);
  const [offerNewCandidateError, setOfferNewCandidateError] = useState('');
  const [companyInfo, setCompanyInfo] = useState({ companyName: 'Aasha SM Technologies', officeAddress: '' });

  // ── Experience Letter system state (INDEPENDENT) ─────────────────────
  const [experienceLetters, setExperienceLetters] = useState([]);
  const [experienceLoading, setExperienceLoading] = useState(false);
  const [experienceSummary, setExperienceSummary] = useState({ total: 0, issued: 0, draft: 0, revoked: 0 });
  const [experienceSearch, setExperienceSearch] = useState('');
  const [experienceStatusFilter, setExperienceStatusFilter] = useState('All');
  const [experienceDeptFilter, setExperienceDeptFilter] = useState('All');
  const [experienceSortDir, setExperienceSortDir] = useState('newest');
  const [showExperienceModal, setShowExperienceModal] = useState(false);
  const [showExperiencePreviewModal, setShowExperiencePreviewModal] = useState(false);
  const [showExperienceDeleteModal, setShowExperienceDeleteModal] = useState(false);
  const [editingExperienceLetter, setEditingExperienceLetter] = useState(null);
  const [viewingExperienceLetter, setViewingExperienceLetter] = useState(null);
  const [experienceSubmitting, setExperienceSubmitting] = useState(false);
  const [experienceError, setExperienceError] = useState('');
  const [experienceSuccess, setExperienceSuccess] = useState('');
  const [hrEmployees, setHrEmployees] = useState([]);
  const [hrEmployeesLoading, setHrEmployeesLoading] = useState(false);
  const [experienceForm, setExperienceForm] = useState({
    employeeId: '',
    employeeName: '',
    empCode: '',
    designation: '',
    department: 'Tech',
    joiningDate: '',
    relievingDate: new Date().toISOString().slice(0, 10),
    employmentDuration: '',
    letterDate: new Date().toISOString().slice(0, 10),
    workLocation: 'Mumbai / Head Office',
    conduct: 'Exemplary',
    reasonForLeaving: 'Resignation / Personal Aspirations',
    authorizedSignatory: 'Human Resources Manager',
    authorizedSignatoryTitle: 'Head of Human Resources',
    notes: '',
    status: 'Issued',
  });

  // ── Existing form states ─────────────────────────────────────────────
  const [jobForm, setJobForm] = useState({ title:'', department:'Tech', designation:'', openings:1, employmentType:'Full Time', location:'In-Office / Hybrid', experience:'1-3 Years', salaryRange:'Competitive', priority:'Medium', openingDate: new Date().toISOString().slice(0,10), closingDate:'', description:'', requirements:'', status:'Open' });
  const [candidateForm, setCandidateForm] = useState({ name:'', email:'', phone:'', location:'', appliedJob:'', appliedPosition:'', department:'Tech', experience:'1-2 Years', skills:'', education:'Graduate', currentCompany:'', noticePeriod:'30 Days', source:'Direct Application', notes:'' });
  const [interviewForm, setInterviewForm] = useState({ round:'Technical Round 1', interviewer:'Tech Lead / HR', date: new Date().toISOString().slice(0,10), time:'11:00 AM', type:'Online Video', meetingLink:'', notes:'' });
  const [feedbackForm, setFeedbackForm] = useState({ technicalSkills:4, communication:4, problemSolving:4, teamwork:4, overallRating:4, strengths:'', weaknesses:'', comments:'', recommendation:'Hire' });

  // ── Pipeline Board States (DYNAMIC & ATLAS BACKED) ───────────────────
  const [pipelineJobFilter, setPipelineJobFilter] = useState('All');
  const [pipelineDeptFilter, setPipelineDeptFilter] = useState('All');
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [showTerminalStages, setShowTerminalStages] = useState(false);
  const [draggedCandidate, setDraggedCandidate] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  // ── Candidate Profile Drawer/Modal Tabs & Timeline ───────────────────
  const [candidateDetailTab, setCandidateDetailTab] = useState('overview');
  const [candidateTimeline, setCandidateTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // ── Screening Modal Form ─────────────────────────────────────────────
  const [showScreeningModal, setShowScreeningModal] = useState(false);
  const [screeningForm, setScreeningForm] = useState({
    skillsMatch: 4,
    experienceMatch: 4,
    communication: 4,
    assessmentScore: 4,
    recruiter: 'HR Talent Acquisition',
    notes: '',
    decision: 'Pass',
  });

  // ── Assessment Modal Form ────────────────────────────────────────────
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [assessmentForm, setAssessmentForm] = useState({
    name: 'Technical Assessment',
    score: 85,
    maxScore: 100,
    result: 'Passed',
    evaluator: 'Technical Lead',
    dueDate: '',
    feedback: '',
  });

  // ── Rejection Modal Form ─────────────────────────────────────────────
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionForm, setRejectionForm] = useState({
    reason: 'Skills mismatch',
    notes: '',
  });

  // ── Withdrawal Modal Form ────────────────────────────────────────────
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [withdrawalForm, setWithdrawalForm] = useState({
    reason: 'Accepted another offer',
    notes: '',
  });

  // ── Move Stage Modal Form ────────────────────────────────────────────
  const [showMoveStageModal, setShowMoveStageModal] = useState(false);
  const [moveStageForm, setMoveStageForm] = useState({
    toStage: 'Screening',
    reason: '',
    notes: '',
  });

  // ── Data loaders ─────────────────────────────────────────────────────
  const fetchCandidates = async () => {
    setCandidatesLoading(true);
    setCandidatesError('');
    try {
      const res = await apiClient.get('/recruitment/candidates');
      const list = extractCandidateArray(res);
      setCandidates(list);
      return list;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load candidates.';
      setCandidatesError(msg);
      return [];
    } finally {
      setCandidatesLoading(false);
    }
  };

  const loadRecruitmentData = async (jobFilter = pipelineJobFilter) => {
    setLoading(true); setError('');
    try {
      const summaryParams = {};
      if (jobFilter && jobFilter !== 'All') {
        summaryParams.appliedJob = jobFilter;
      }
      const [jr, cr, sr] = await Promise.all([
        apiClient.get('/recruitment/jobs'),
        apiClient.get('/recruitment/candidates'),
        apiClient.get('/recruitment/summary', { params: summaryParams }).catch(() => ({ data: { data: null } })),
      ]);
      setJobs(jr.data?.data || []);
      setCandidates(extractCandidateArray(cr));
      if (sr.data?.data) setSummary(sr.data.data);
    } catch (err) { setError(err.response?.data?.message || 'Unable to load recruitment data.'); }
    finally { setLoading(false); }
  };

  const loadOfferLetters = async () => {
    setOffersLoading(true);
    try {
      const params = {};
      if (offerStatusFilter !== 'All') params.status = offerStatusFilter;
      if (offerDeptFilter !== 'All') params.department = offerDeptFilter;
      if (offerEmpTypeFilter !== 'All') params.employmentType = offerEmpTypeFilter;
      if (offerSearch) params.search = offerSearch;
      params.sort = offerSortDir;
      const [or, sr] = await Promise.all([
        apiClient.get('/recruitment/offer-letters', { params }),
        apiClient.get('/recruitment/offer-letters/summary').catch(() => ({ data: { data: {} } })),
      ]);
      setOffers(or.data?.data || []);
      if (sr.data?.data) setOfferSummary(sr.data.data);
    } catch (err) { setOfferError(err.response?.data?.message || 'Unable to load offer letters.'); }
    finally { setOffersLoading(false); }
  };

  const loadExperienceLetters = async () => {
    setExperienceLoading(true);
    setExperienceError('');
    try {
      const params = {};
      if (experienceStatusFilter !== 'All') params.status = experienceStatusFilter;
      if (experienceDeptFilter !== 'All') params.department = experienceDeptFilter;
      if (experienceSearch) params.search = experienceSearch;
      params.sort = experienceSortDir;
      const [lr, sr] = await Promise.all([
        apiClient.get('/recruitment/experience-letters', { params }),
        apiClient.get('/recruitment/experience-letters/summary').catch(() => ({ data: { data: {} } })),
      ]);
      setExperienceLetters(lr.data?.data || []);
      if (sr.data?.data) setExperienceSummary(sr.data.data);
    } catch (err) {
      setExperienceError(err.response?.data?.message || 'Unable to load experience letters.');
    } finally {
      setExperienceLoading(false);
    }
  };

  const loadHrEmployees = async () => {
    setHrEmployeesLoading(true);
    try {
      const res = await apiClient.get('/recruitment/experience-letters/employees');
      setHrEmployees(res.data?.data || []);
    } catch (_e) {
      try {
        const uRes = await apiClient.get('/users');
        const list = (uRes.data?.data || [])
          .filter((u) => u.role === 'employee')
          .map((u) => ({
            _id: u._id,
            name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
            email: u.email,
            employeeId: u.jobDetails?.employeeId || '',
            department: u.department || u.jobDetails?.department || 'Tech',
            designation: u.designation || u.jobDetails?.designation || 'Associate',
            joiningDate: u.jobDetails?.joiningDate || '',
            relievingDate: u.exitDate ? new Date(u.exitDate).toISOString().slice(0, 10) : '',
          }));
        setHrEmployees(list);
      } catch (_e2) {}
    } finally {
      setHrEmployeesLoading(false);
    }
  };

  const loadCompanyInfo = async () => {
    try {
      const res = await apiClient.get('/company-settings').catch(() => null);
      if (res?.data?.data) setCompanyInfo({ companyName: res.data.data.companyName || 'Aasha SM Technologies', officeAddress: res.data.data.officeAddress || '' });
    } catch (_e) {}
  };

  useEffect(() => {
    loadRecruitmentData();
    loadCompanyInfo();
    apiClient.get('/recruitment/experience-letters/summary')
      .then((r) => { if (r.data?.data) setExperienceSummary(r.data.data); })
      .catch(() => {});
    loadHrEmployees();
  }, []);
  useEffect(() => { if (activeTab === 'pipeline') loadRecruitmentData(pipelineJobFilter); }, [activeTab, pipelineJobFilter]);
  useEffect(() => { if (activeTab === 'offers') loadOfferLetters(); }, [activeTab, offerStatusFilter, offerDeptFilter, offerEmpTypeFilter, offerSortDir]);
  useEffect(() => {
    if (activeTab === 'experience') {
      loadExperienceLetters();
      if (hrEmployees.length === 0) loadHrEmployees();
    }
  }, [activeTab, experienceStatusFilter, experienceDeptFilter, experienceSortDir]);

  // ── Computed ─────────────────────────────────────────────────────────
  const filteredJobs = useMemo(() => jobs.filter((j) => {
    const s = j.title.toLowerCase().includes(search.toLowerCase()) || j.jobId.toLowerCase().includes(search.toLowerCase()) || j.designation.toLowerCase().includes(search.toLowerCase());
    return s && (selectedDept === 'All' || j.department === selectedDept) && (selectedStatus === 'All' || j.status === selectedStatus);
  }), [jobs, search, selectedDept, selectedStatus]);

  const filteredCandidates = useMemo(() => candidates.filter((c) => {
    const s = c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()) || c.candidateId.toLowerCase().includes(search.toLowerCase()) || c.appliedPosition.toLowerCase().includes(search.toLowerCase());
    return s && (selectedDept === 'All' || c.department === selectedDept) && (selectedStage === 'All' || c.stage === selectedStage) && (selectedStatus === 'All' || c.status === selectedStatus);
  }), [candidates, search, selectedDept, selectedStage, selectedStatus]);

  // Pipeline-specific candidates filtered by job requisition, dept, and search
  const pipelineCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (pipelineJobFilter !== 'All') {
        const cJobId = c.appliedJob?._id || c.appliedJob;
        if (String(cJobId) !== String(pipelineJobFilter)) return false;
      }
      if (pipelineDeptFilter !== 'All' && c.department !== pipelineDeptFilter) {
        return false;
      }
      if (pipelineSearch.trim()) {
        const q = pipelineSearch.toLowerCase();
        const matches =
          (c.name || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.candidateId || '').toLowerCase().includes(q) ||
          (c.appliedPosition || '').toLowerCase().includes(q) ||
          (c.department || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [candidates, pipelineJobFilter, pipelineDeptFilter, pipelineSearch]);

  const pipelineDepartments = useMemo(() => {
    const set = new Set();
    jobs.forEach((j) => { if (j.department) set.add(j.department); });
    candidates.forEach((c) => { if (c.department) set.add(c.department); });
    if (set.size === 0) OFFICIAL_DEPARTMENTS.forEach((d) => set.add(d));
    return Array.from(set);
  }, [jobs, candidates]);

  const allInterviews = useMemo(() => {
    const list = [];
    candidates.forEach((c) => (c.interviews || []).forEach((inv) => list.push({ ...inv, candidateId: c._id, candidateName: c.name, candidateEmail: c.email, appliedPosition: c.appliedPosition, department: c.department })));
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [candidates]);

  const filteredOffers = useMemo(() => {
    let list = offers;
    if (offerStatusFilter === 'PendingConversion') {
      list = list.filter((o) => o.status === 'Accepted' && !o.convertedEmployee);
    }
    if (!offerSearch) return list;
    const q = offerSearch.toLowerCase();
    return list.filter((o) => (o.offerNumber || '').toLowerCase().includes(q) || (o.offeredDesignation || '').toLowerCase().includes(q) || (o.candidate?.name || '').toLowerCase().includes(q) || (o.candidate?.email || '').toLowerCase().includes(q));
  }, [offers, offerSearch, offerStatusFilter]);

  const filteredExperienceLetters = useMemo(() => {
    let list = experienceLetters;
    if (experienceStatusFilter !== 'All') {
      list = list.filter((l) => l.status === experienceStatusFilter);
    }
    if (experienceDeptFilter !== 'All') {
      list = list.filter((l) => l.department === experienceDeptFilter);
    }
    if (experienceSearch && experienceSearch.trim()) {
      const q = experienceSearch.toLowerCase().trim();
      list = list.filter((l) =>
        (l.letterNumber || '').toLowerCase().includes(q) ||
        (l.employeeName || '').toLowerCase().includes(q) ||
        (l.employeeId || '').toLowerCase().includes(q) ||
        (l.designation || '').toLowerCase().includes(q) ||
        (l.department || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [experienceLetters, experienceStatusFilter, experienceDeptFilter, experienceSearch]);

  // ── Existing handlers ────────────────────────────────────────────────
  const handleOpenCreateJob = (job = null) => {
    setSelectedJob(job);
    if (job) setJobForm({ title:job.title||'', department:job.department||'Tech', designation:job.designation||'', openings:job.openings||1, employmentType:job.employmentType||'Full Time', location:job.location||'In-Office / Hybrid', experience:job.experience||'1-3 Years', salaryRange:job.salaryRange||'Competitive', priority:job.priority||'Medium', openingDate:job.openingDate?job.openingDate.slice(0,10):new Date().toISOString().slice(0,10), closingDate:job.closingDate?job.closingDate.slice(0,10):'', description:job.description||'', requirements:job.requirements||'', status:job.status||'Open' });
    else setJobForm({ title:'', department:'Tech', designation:'', openings:1, employmentType:'Full Time', location:'In-Office / Hybrid', experience:'1-3 Years', salaryRange:'Competitive', priority:'Medium', openingDate:new Date().toISOString().slice(0,10), closingDate:'', description:'', requirements:'', status:'Open' });
    setShowJobModal(true);
  };

  const handleSaveJob = async (e) => {
    e.preventDefault(); setSubmitting(true); setError('');
    try {
      if (selectedJob) { await apiClient.put('/recruitment/jobs/'+selectedJob._id, jobForm); setSuccess('Job updated!'); }
      else { await apiClient.post('/recruitment/jobs', jobForm); setSuccess('Job published!'); }
      setShowJobModal(false); await loadRecruitmentData();
    } catch (err) { setError(err.response?.data?.message || 'Failed to save job.'); }
    finally { setSubmitting(false); }
  };

  // GENERAL + Add Candidate (unchanged, independent of offer modal)
  const handleOpenAddCandidate = () => {
    setCandidateForm({ name:'', email:'', phone:'', location:'', appliedJob:jobs[0]?._id||'', appliedPosition:jobs[0]?.title||'Software Engineer', department:jobs[0]?.department||'Tech', experience:'1-2 Years', skills:'', education:'Graduate', currentCompany:'', noticePeriod:'30 Days', source:'Direct Application', notes:'' });
    setShowCandidateModal(true);
  };

  const handleSaveCandidate = async (e) => {
    e.preventDefault(); setSubmitting(true); setError('');
    try {
      await apiClient.post('/recruitment/candidates', candidateForm);
      setShowCandidateModal(false); setSuccess('Candidate created!'); await loadRecruitmentData();
    } catch (err) { setError(err.response?.data?.message || 'Failed to register candidate.'); }
    finally { setSubmitting(false); }
  };

  const loadTimeline = async (candId) => {
    setTimelineLoading(true);
    try {
      const res = await apiClient.get(`/recruitment/candidates/${candId}/timeline`);
      const list = Array.isArray(res.data?.data) ? res.data.data : (res.data?.data?.history || []);
      setCandidateTimeline(list);
    } catch (_e) {
      setCandidateTimeline([]);
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleOpenProfile = async (c) => {
    setSelectedCandidate(c);
    setCandidateDetailTab('overview');
    setShowProfileModal(true);
    await loadTimeline(c._id);
  };

  const performStageUpdate = async (candidateId, newStage, notes = '', reason = '') => {
    setError('');
    try {
      await apiClient.patch(`/recruitment/candidates/${candidateId}/stage`, {
        stage: newStage,
        notes: notes || `Stage updated to ${newStage}`,
        reason: reason || undefined,
      });
      setSuccess(`Candidate stage updated to ${newStage}`);
      await loadRecruitmentData(pipelineJobFilter);
      if (selectedCandidate?._id === candidateId) {
        const u = await apiClient.get(`/recruitment/candidates/${candidateId}`);
        setSelectedCandidate(u.data?.data);
        await loadTimeline(candidateId);
      }
      return true;
    } catch (err) {
      setError(err.response?.data?.message || `Failed to update candidate stage to ${newStage}. Rollback applied.`);
      return false;
    }
  };

  const handleDragStart = (e, cand) => {
    setDraggedCandidate(cand);
    e.dataTransfer.setData('text/plain', cand._id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedCandidate(null);
    setDragOverStage(null);
  };

  const handleDragOver = (e, stage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== stage) setDragOverStage(stage);
  };

  const handleDragLeave = (e, stage) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    if (dragOverStage === stage) setDragOverStage(null);
  };

  const handleDrop = async (e, targetStage) => {
    e.preventDefault();
    setDragOverStage(null);
    const cand = draggedCandidate;
    setDraggedCandidate(null);
    if (!cand) return;

    const currentNorm = cand.stage === 'HR Round' ? 'Final / HR Round' : cand.stage;
    if (currentNorm === targetStage) return;

    const allowed = VALID_TRANSITIONS[currentNorm] || [];
    if (!allowed.includes(targetStage)) {
      setError(`Invalid stage transition: Cannot move candidate directly from "${currentNorm}" to "${targetStage}". Valid progression required.`);
      return;
    }

    if (targetStage === 'Screening') {
      handleOpenScreening(cand);
      return;
    }
    if (targetStage === 'Assessment') {
      handleOpenAssessment(cand);
      return;
    }
    if (targetStage === 'Rejected') {
      handleOpenRejection(cand);
      return;
    }
    if (targetStage === 'Withdrawn') {
      handleOpenWithdrawal(cand);
      return;
    }

    await performStageUpdate(cand._id, targetStage, `Moved via drag and drop to ${targetStage}`, 'Drag and drop progression');
  };

  const handleOpenScreening = (cand) => {
    setSelectedCandidate(cand);
    const s = cand.screening || {};
    setScreeningForm({
      skillsMatch: s.skillsMatch || 4,
      experienceMatch: s.experienceMatch || 4,
      communication: s.communication || 4,
      assessmentScore: s.assessmentScore || 4,
      recruiter: s.recruiter || 'HR Talent Acquisition',
      notes: s.notes || '',
      decision: s.decision || 'Pass',
    });
    setShowScreeningModal(true);
  };

  const handleSaveScreening = async (e) => {
    e.preventDefault();
    if (!selectedCandidate) return;
    setSubmitting(true); setError('');
    try {
      await apiClient.post(`/recruitment/candidates/${selectedCandidate._id}/screening`, screeningForm);
      setShowScreeningModal(false);
      setSuccess(`Screening recorded! Decision: ${screeningForm.decision}`);
      await loadRecruitmentData(pipelineJobFilter);
      const u = await apiClient.get(`/recruitment/candidates/${selectedCandidate._id}`);
      setSelectedCandidate(u.data?.data);
      await loadTimeline(selectedCandidate._id);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record screening assessment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAssessment = (cand) => {
    setSelectedCandidate(cand);
    const a = cand.assessment || {};
    setAssessmentForm({
      name: a.name || 'Technical Assessment',
      score: a.score !== undefined ? a.score : 80,
      maxScore: a.maxScore || 100,
      result: a.result || 'Passed',
      evaluator: a.evaluator || 'Technical Lead',
      dueDate: a.dueDate ? a.dueDate.slice(0, 10) : '',
      feedback: a.feedback || '',
    });
    setShowAssessmentModal(true);
  };

  const handleSaveAssessment = async (e) => {
    e.preventDefault();
    if (!selectedCandidate) return;
    setSubmitting(true); setError('');
    try {
      await apiClient.post(`/recruitment/candidates/${selectedCandidate._id}/assessment`, assessmentForm);
      setShowAssessmentModal(false);
      setSuccess(`Assessment recorded for ${selectedCandidate.name}! Result: ${assessmentForm.result}`);
      await loadRecruitmentData(pipelineJobFilter);
      const u = await apiClient.get(`/recruitment/candidates/${selectedCandidate._id}`);
      setSelectedCandidate(u.data?.data);
      await loadTimeline(selectedCandidate._id);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record technical assessment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenRejection = (cand) => {
    setSelectedCandidate(cand);
    setRejectionForm({ reason: 'Skills mismatch', notes: '' });
    setShowRejectionModal(true);
  };

  const handleSaveRejection = async (e) => {
    e.preventDefault();
    if (!selectedCandidate) return;
    setSubmitting(true); setError('');
    try {
      await apiClient.patch(`/recruitment/candidates/${selectedCandidate._id}/reject`, rejectionForm);
      setShowRejectionModal(false);
      setSuccess('Candidate moved to Rejected stage.');
      await loadRecruitmentData(pipelineJobFilter);
      const u = await apiClient.get(`/recruitment/candidates/${selectedCandidate._id}`);
      setSelectedCandidate(u.data?.data);
      await loadTimeline(selectedCandidate._id);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject candidate.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenWithdrawal = (cand) => {
    setSelectedCandidate(cand);
    setWithdrawalForm({ reason: 'Accepted another offer', notes: '' });
    setShowWithdrawalModal(true);
  };

  const handleSaveWithdrawal = async (e) => {
    e.preventDefault();
    if (!selectedCandidate) return;
    setSubmitting(true); setError('');
    try {
      await apiClient.patch(`/recruitment/candidates/${selectedCandidate._id}/withdraw`, withdrawalForm);
      setShowWithdrawalModal(false);
      setSuccess('Candidate moved to Withdrawn stage.');
      await loadRecruitmentData(pipelineJobFilter);
      const u = await apiClient.get(`/recruitment/candidates/${selectedCandidate._id}`);
      setSelectedCandidate(u.data?.data);
      await loadTimeline(selectedCandidate._id);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record candidate withdrawal.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenMoveStage = (cand) => {
    setSelectedCandidate(cand);
    const currentNorm = cand.stage === 'HR Round' ? 'Final / HR Round' : (cand.stage || 'Applied');
    const allowed = VALID_TRANSITIONS[currentNorm] || ALL_PIPELINE_STAGES;
    setMoveStageForm({
      toStage: allowed[0] || currentNorm,
      reason: '',
      notes: '',
    });
    setShowMoveStageModal(true);
  };

  const handleSaveMoveStage = async (e) => {
    e.preventDefault();
    if (!selectedCandidate) return;
    const { toStage, notes, reason } = moveStageForm;
    const currentNorm = selectedCandidate.stage === 'HR Round' ? 'Final / HR Round' : selectedCandidate.stage;
    if (toStage === currentNorm) {
      setShowMoveStageModal(false);
      return;
    }
    const allowed = VALID_TRANSITIONS[currentNorm] || ALL_PIPELINE_STAGES;
    if (!allowed.includes(toStage)) {
      setError(`Invalid stage transition: Cannot move candidate directly from "${currentNorm}" to "${toStage}". Valid progression required.`);
      setShowMoveStageModal(false);
      return;
    }
    if (toStage === 'Screening') {
      setShowMoveStageModal(false);
      handleOpenScreening(selectedCandidate);
      return;
    }
    if (toStage === 'Assessment') {
      setShowMoveStageModal(false);
      handleOpenAssessment(selectedCandidate);
      return;
    }
    if (toStage === 'Rejected') {
      setShowMoveStageModal(false);
      handleOpenRejection(selectedCandidate);
      return;
    }
    if (toStage === 'Withdrawn') {
      setShowMoveStageModal(false);
      handleOpenWithdrawal(selectedCandidate);
      return;
    }
    setSubmitting(true);
    setShowMoveStageModal(false);
    await performStageUpdate(selectedCandidate._id, toStage, notes, reason);
    setSubmitting(false);
  };

  const handleShortlist = async (id) => {
    try { await apiClient.patch('/recruitment/candidates/'+id+'/shortlist'); setSuccess('Candidate shortlisted!'); await loadRecruitmentData(); if (selectedCandidate?._id===id) { const u=await apiClient.get('/recruitment/candidates/'+id); setSelectedCandidate(u.data?.data); } }
    catch { setError('Failed to shortlist.'); }
  };

  const handleReject = async (id) => {
    try { await apiClient.patch('/recruitment/candidates/'+id+'/reject'); setSuccess('Candidate rejected.'); await loadRecruitmentData(); if (selectedCandidate?._id===id) { const u=await apiClient.get('/recruitment/candidates/'+id); setSelectedCandidate(u.data?.data); } }
    catch { setError('Failed to reject.'); }
  };

  const handleOpenSchedule = (c) => {
    setSelectedCandidate(c);
    setInterviewForm({ round:'Technical Round 1', interviewer:'Tech Lead / HR Manager', date:new Date().toISOString().slice(0,10), time:'11:00 AM', type:'Online Video', meetingLink:'https://meet.google.com/xyz-abcd-efg', notes:'' });
    setShowInterviewModal(true);
  };

  const handleSaveInterview = async (e) => {
    e.preventDefault(); if (!selectedCandidate) return; setSubmitting(true); setError('');
    try {
      await apiClient.post('/recruitment/candidates/'+selectedCandidate._id+'/interviews', interviewForm);
      setShowInterviewModal(false); setSuccess('Interview scheduled!'); await loadRecruitmentData();
      const u=await apiClient.get('/recruitment/candidates/'+selectedCandidate._id); setSelectedCandidate(u.data?.data);
      await loadTimeline(selectedCandidate._id);
    } catch (err) { setError(err.response?.data?.message || 'Failed to schedule interview.'); }
    finally { setSubmitting(false); }
  };

  const handleOpenFeedback = (cand, inv) => {
    setSelectedCandidate(cand); setSelectedInterview(inv);
    setFeedbackForm({ technicalSkills:inv.feedback?.technicalSkills||4, communication:inv.feedback?.communication||4, problemSolving:inv.feedback?.problemSolving||4, teamwork:inv.feedback?.teamwork||4, overallRating:inv.feedback?.overallRating||4, strengths:inv.feedback?.strengths||'', weaknesses:inv.feedback?.weaknesses||'', comments:inv.feedback?.comments||'', recommendation:inv.feedback?.recommendation||'Hire' });
    setShowFeedbackModal(true);
  };

  const handleSaveFeedback = async (e) => {
    e.preventDefault(); if (!selectedCandidate||!selectedInterview) return; setSubmitting(true); setError('');
    try {
      await apiClient.patch('/recruitment/candidates/'+selectedCandidate._id+'/interviews/'+selectedInterview._id, { feedback:feedbackForm, status:'Completed' });
      setShowFeedbackModal(false); setSuccess('Feedback submitted!'); await loadRecruitmentData();
      const u=await apiClient.get('/recruitment/candidates/'+selectedCandidate._id); setSelectedCandidate(u.data?.data);
      await loadTimeline(selectedCandidate._id);
    } catch (err) { setError(err.response?.data?.message||'Failed to submit feedback.'); }
    finally { setSubmitting(false); }
  };

  const handleConvertEmployee = async () => {
    if (!selectedCandidate) return; setSubmitting(true); setError('');
    try {
      await apiClient.post('/recruitment/candidates/'+selectedCandidate._id+'/convert-employee');
      setShowConvertModal(false); if (showProfileModal) setShowProfileModal(false);
      setSuccess('Candidate onboarded as Employee!'); await loadRecruitmentData();
      const u=await apiClient.get('/recruitment/candidates/'+selectedCandidate._id); setSelectedCandidate(u.data?.data);
      await loadTimeline(selectedCandidate._id);
    } catch (err) { setError(err.response?.data?.message||'Conversion failed.'); }
    finally { setSubmitting(false); }
  };

  // ── Offer Letter handlers ────────────────────────────────────────────
  const handleOpenCreateOffer = (existing = null, presetCandidate = null) => {
    setOfferError(''); setOfferSuccess('');
    // Refresh real candidates from MongoDB on modal open so dropdown is always populated
    fetchCandidates();

    if (existing) {
      const existingCandId = existing.candidate?._id || existing.candidate || '';
      setSelectedCandidateId(existingCandId);
      setEditingOffer(existing);
      setOfferForm({
        candidateId: existingCandId,
        offeredDesignation: existing.offeredDesignation || '',
        department: existing.department || 'Tech',
        employmentType: existing.employmentType || 'Full Time',
        salary: existing.salary || '',
        joiningDate: existing.joiningDate ? existing.joiningDate.slice(0,10) : DEFAULT_OFFER_FORM.joiningDate,
        offerDate: existing.offerDate ? existing.offerDate.slice(0,10) : DEFAULT_OFFER_FORM.offerDate,
        expiresAt: existing.expiresAt ? existing.expiresAt.slice(0,10) : DEFAULT_OFFER_FORM.expiresAt,
        probationPeriod: existing.probationPeriod || '6 Months',
        workLocation: existing.workLocation || '',
        reportingManager: existing.reportingManager || '',
        workingHours: existing.workingHours || '9:00 AM - 6:00 PM (Mon-Sat)',
        noticePeriod: existing.noticePeriod || '30 Days',
        termsAndConditions: existing.termsAndConditions || '',
        additionalNotes: existing.additionalNotes || '',
      });
    } else if (presetCandidate) {
      setSelectedCandidateId(presetCandidate._id);
      setEditingOffer(null);
      setOfferForm({
        ...DEFAULT_OFFER_FORM,
        candidateId: presetCandidate._id,
        offeredDesignation: presetCandidate.appliedPosition || '',
        department: presetCandidate.department || 'Tech',
        salary: presetCandidate.expectedSalary || '',
        workLocation: presetCandidate.location || 'In-Office / Hybrid',
        noticePeriod: presetCandidate.noticePeriod || '30 Days',
      });
    } else {
      setSelectedCandidateId('');
      setEditingOffer(null);
      setOfferForm({ ...DEFAULT_OFFER_FORM });
    }
    setShowOfferModal(true);
  };

  const handleSaveOffer = async (e) => {
    e.preventDefault();
    if (!offerForm.candidateId) { setOfferError('Please select a candidate.'); return; }
    setOfferSubmitting(true); setOfferError('');
    try {
      if (editingOffer) {
        await apiClient.put('/recruitment/offer-letters/' + editingOffer._id, offerForm);
        setOfferSuccess('Offer updated successfully in MongoDB!');
      } else {
        await apiClient.post('/recruitment/offer-letters', offerForm);
        setOfferSuccess('Offer saved as Draft in MongoDB!');
      }
      setShowOfferModal(false);
      await Promise.all([loadOfferLetters(), loadRecruitmentData()]);
    } catch (err) { setOfferError(err.response?.data?.message || 'Failed to save offer.'); }
    finally { setOfferSubmitting(false); }
  };

  const handleDeleteOffer = async () => {
    if (!viewingOffer) return; setOfferSubmitting(true); setOfferError('');
    try {
      await apiClient.delete('/recruitment/offer-letters/' + viewingOffer._id);
      setShowOfferDeleteModal(false);
      setViewingOffer(null);
      setOfferSuccess('Offer deleted from system.');
      await loadOfferLetters();
    } catch (err) { setOfferError(err.response?.data?.message || 'Delete failed.'); }
    finally { setOfferSubmitting(false); }
  };

  const handleSendOffer = async () => {
    if (!viewingOffer) return; setOfferSubmitting(true); setOfferError('');
    try {
      await apiClient.post('/recruitment/offer-letters/' + viewingOffer._id + '/send');
      setShowOfferSendModal(false);
      setOfferSuccess('Offer sent successfully to ' + viewingOffer.candidate?.email);
      await loadOfferLetters();
    } catch (err) {
      setOfferError(err.response?.data?.message || 'Send failed. Check SMTP configuration. Offer was NOT marked as Sent.');
    } finally { setOfferSubmitting(false); }
  };

  const handleStatusAction = async (offerId, action, payload = {}) => {
    setOfferSubmitting(true); setOfferError('');
    try {
      await apiClient.post('/recruitment/offer-letters/' + offerId + '/' + action, payload);
      setOfferSuccess('Offer status updated to ' + action.charAt(0).toUpperCase() + action.slice(1) + '!');
      await loadOfferLetters();
    } catch (err) { setOfferError(err.response?.data?.message || 'Action failed.'); }
    finally { setOfferSubmitting(false); }
  };

  const handleConvertFromOffer = async () => {
    if (!viewingOffer) return; setOfferSubmitting(true); setOfferError('');
    try {
      const res = await apiClient.post('/recruitment/offer-letters/' + viewingOffer._id + '/convert-employee');
      setShowOfferConvertModal(false);
      setOfferSuccess(res.data?.message || 'Candidate converted to Employee successfully!');
      await Promise.all([loadOfferLetters(), loadRecruitmentData()]);
    } catch (err) { setOfferError(err.response?.data?.message || 'Conversion failed.'); }
    finally { setOfferSubmitting(false); }
  };

  // Contextual Add New Candidate (INSIDE offer modal — INDEPENDENT of general candidate modal)
  const handleOpenOfferNewCandidate = () => {
    // CRITICAL: DO NOT close offer modal! DO NOT touch showCandidateModal!
    setOfferNewCandidateForm({
      name: '',
      email: '',
      phone: '',
      location: offerForm.workLocation || '',
      appliedJob: '',
      appliedPosition: offerForm.offeredDesignation || '',
      department: offerForm.department || 'Tech',
      experience: '0-1 Years',
      skills: '',
      education: 'Graduate',
      currentCompany: '',
      noticePeriod: offerForm.noticePeriod || '30 Days',
      source: 'Direct Application',
      notes: '',
    });
    setOfferNewCandidateError('');
    setShowOfferNewCandidateModal(true);
  };

  const handleSaveOfferNewCandidate = async (e) => {
    e.preventDefault();
    setOfferNewCandidateSubmitting(true);
    setOfferNewCandidateError('');
    try {
      const res = await apiClient.post('/recruitment/candidates', offerNewCandidateForm);
      const newCand = res.data?.data || res.data?.candidate || res.data;
      // Refresh candidate list from MongoDB using existing API
      await fetchCandidates();

      // Auto-select in offerForm while strictly preserving every already entered offer field
      if (newCand?._id) {
        setSelectedCandidateId(newCand._id);
        setOfferForm((prev) => ({
          ...prev,
          candidateId: newCand._id,
          offeredDesignation: (prev.offeredDesignation && prev.offeredDesignation.trim())
            ? prev.offeredDesignation
            : (newCand.appliedPosition || ''),
          department: (prev.department && prev.department !== 'Tech')
            ? prev.department
            : (newCand.department || prev.department || 'Tech'),
        }));
      }

      // ONLY close contextual modal — offer modal remains alive and mounted!
      setShowOfferNewCandidateModal(false);
      setOfferSuccess(`Candidate "${newCand?.name || 'New Candidate'}" created and selected!`);
    } catch (err) {
      setOfferNewCandidateError(err.response?.data?.message || 'Failed to create candidate.');
    } finally {
      setOfferNewCandidateSubmitting(false);
    }
  };

  // PDF generation using jsPDF
  const handleDownloadPDF = async (offer) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const cand = offer.candidate || {};
    const companyName = 'AASHA SM TECHNOLOGIES PRIVATE LIMITED';
    const fd = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'As mutually agreed';
    const pageW = 210;
    const m = 18;
    let y = 14;

    // 1. Header with Dashboard Logo
    try {
      const logoData = await getBase64ImageFromUrl('/aasha-logo-new.jpg');
      if (logoData) {
        doc.addImage(logoData, 'JPEG', m, y - 2, 42, 13);
      }
    } catch (_e) {}

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(companyName, pageW - m, y + 3, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Corporate HR & Talent Acquisition', pageW - m, y + 8, { align: 'right' });
    doc.text('Aasha SM Technologies · IT Services & Solutions', pageW - m, y + 12, { align: 'right' });

    y += 18;
    // Orange brand accent divider
    doc.setDrawColor(234, 88, 12);
    doc.setLineWidth(0.8);
    doc.line(m, y, pageW - m, y);
    y += 8;

    // 2. Meta & Recipient
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Offer No:', pageW - m - 45, y);
    doc.setTextColor(15, 23, 42);
    doc.text(offer.offerNumber || 'OFR-00000', pageW - m, y, { align: 'right' });
    y += 4.5;

    doc.setTextColor(100, 116, 139);
    doc.text('Offer Date:', pageW - m - 45, y);
    doc.setTextColor(15, 23, 42);
    doc.text(fd(offer.offerDate), pageW - m, y, { align: 'right' });
    y += 4.5;

    if (offer.expiresAt) {
      doc.setTextColor(100, 116, 139);
      doc.text('Valid Until:', pageW - m - 45, y);
      doc.setTextColor(15, 23, 42);
      doc.text(fd(offer.expiresAt), pageW - m, y, { align: 'right' });
      y += 4.5;
    }

    const recY = y - (offer.expiresAt ? 13.5 : 9);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('To,', m, recY);
    doc.text(cand.name || 'Candidate Name', m, recY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    if (cand.email) doc.text(`Email: ${cand.email}`, m, recY + 9);
    if (cand.phone) doc.text(`Mobile: ${cand.phone}`, m, recY + 13);

    y = Math.max(y, recY + 18) + 4;

    // 3. Subject
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(234, 88, 12);
    doc.text(`Sub: Formal Employment Offer — ${offer.offeredDesignation || 'Position'}`, m, y);
    y += 6;

    // 4. Salutation & Introduction
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Dear ${cand.name || 'Candidate'},`, m, y);
    y += 5.5;

    const introText = `We are pleased to extend this formal offer of employment with ${companyName}. Following our interview rounds and assessment, we are impressed with your qualifications and enthusiastic about the value and expertise you will bring to our team.`;
    const introLines = doc.splitTextToSize(introText, pageW - 2 * m);
    doc.text(introLines, m, y);
    y += introLines.length * 4.5 + 4;

    // 5. Key Employment Details Table Box
    const tableRows = [
      ['Offered Designation:', offer.offeredDesignation || '—'],
      ['Department:', offer.department || '—'],
      ['Employment Type:', offer.employmentType || 'Full Time'],
      ['Annual CTC / Salary:', offer.salary || 'As discussed'],
      ['Joining Date:', fd(offer.joiningDate)],
      ['Work Location:', offer.workLocation || 'Office / Hybrid'],
      ['Probation Period:', offer.probationPeriod || '6 Months'],
      ['Reporting Manager:', offer.reportingManager || 'Management'],
      ['Working Hours:', offer.workingHours || '9:00 AM - 6:00 PM (Mon-Sat)'],
      ['Notice Period:', offer.noticePeriod || '30 Days'],
    ];

    const boxH = tableRows.length * 5.2 + 6;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(m, y, pageW - 2 * m, boxH, 2, 2, 'FD');
    y += 5;

    tableRows.forEach(([lbl, val]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(lbl, m + 4, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(String(val), m + 50, y);
      y += 5.2;
    });
    y += 5;

    // 6. Numbered Terms & Conditions
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('TERMS & CONDITIONS:', m, y);
    y += 5;

    const termsList = [
      `1. Offer Acceptance: Please sign and return a duplicate copy of this letter prior to ${fd(offer.expiresAt)} to confirm your acceptance.`,
      `2. Probation & Confirmation: You will serve a probation of ${offer.probationPeriod || '6 Months'}, post which employment will be confirmed in writing subject to performance.`,
      `3. Confidentiality & Code of Conduct: You agree to uphold company data confidentiality, non-disclosure (NDA), and IP security policies at all times.`,
      `4. Notice Period: Either party may terminate employment by providing ${offer.noticePeriod || '30 Days'} written notice or equivalent compensation in lieu thereof.`,
    ];

    if (offer.termsAndConditions && offer.termsAndConditions.trim()) {
      termsList.push(`5. Additional Terms: ${offer.termsAndConditions.trim()}`);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    termsList.forEach((t) => {
      const tLines = doc.splitTextToSize(t, pageW - 2 * m);
      doc.text(tLines, m, y);
      y += tLines.length * 3.8 + 1.5;
    });

    if (offer.additionalNotes && offer.additionalNotes.trim()) {
      y += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('ADDITIONAL NOTES:', m, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const noteLines = doc.splitTextToSize(offer.additionalNotes.trim(), pageW - 2 * m);
      doc.text(noteLines, m, y);
      y += noteLines.length * 3.8 + 2;
    }

    // 7. Closing & Sign-off
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text('We look forward to welcoming you to the team!', m, y);
    y += 6;
    doc.text('Warm regards,', m, y);
    y += 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Human Resources & Talent Acquisition', m, y);
    y += 4;
    doc.setTextColor(234, 88, 12);
    doc.text(companyName, m, y);

    // 8. Footer (at bottom of A4)
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 282, pageW, 15, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(0, 282, pageW, 282);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`${companyName} · Confidential Employment Document · Generated via HRMS`, pageW / 2, 290, { align: 'center' });

    const safeName = (cand.name || 'Candidate').trim().replace(/[^a-zA-Z0-9]/g, '_');
    const safeOfr = (offer.offerNumber || 'OFR').trim().replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Offer_Letter_${safeName}_${safeOfr}.pdf`);
  };

  // ── Experience Letter Handlers ─────────────────────────────────────────
  const handleOpenCreateExperience = (letter = null) => {
    if (hrEmployees.length === 0) loadHrEmployees();
    setExperienceError('');
    if (letter) {
      setEditingExperienceLetter(letter);
      setExperienceForm({
        employeeId: letter.employee?._id || letter.employee || '',
        employeeName: letter.employeeName || '',
        empCode: letter.employeeId || '',
        designation: letter.designation || '',
        department: letter.department || 'Tech',
        joiningDate: letter.joiningDate ? new Date(letter.joiningDate).toISOString().slice(0, 10) : '',
        relievingDate: letter.relievingDate ? new Date(letter.relievingDate).toISOString().slice(0, 10) : '',
        employmentDuration: letter.employmentDuration || '',
        letterDate: letter.letterDate ? new Date(letter.letterDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        workLocation: letter.workLocation || 'Mumbai / Head Office',
        conduct: letter.conduct || 'Exemplary',
        reasonForLeaving: letter.reasonForLeaving || 'Resignation / Personal Aspirations',
        authorizedSignatory: letter.authorizedSignatory || 'Human Resources Manager',
        authorizedSignatoryTitle: letter.authorizedSignatoryTitle || 'Head of Human Resources',
        notes: letter.notes || '',
        status: letter.status || 'Issued',
      });
    } else {
      setEditingExperienceLetter(null);
      setExperienceForm({
        employeeId: '',
        employeeName: '',
        empCode: '',
        designation: '',
        department: 'Tech',
        joiningDate: '',
        relievingDate: new Date().toISOString().slice(0, 10),
        employmentDuration: '',
        letterDate: new Date().toISOString().slice(0, 10),
        workLocation: 'Mumbai / Head Office',
        conduct: 'Exemplary',
        reasonForLeaving: 'Resignation / Personal Aspirations',
        authorizedSignatory: 'Human Resources Manager',
        authorizedSignatoryTitle: 'Head of Human Resources',
        notes: '',
        status: 'Issued',
      });
    }
    setShowExperienceModal(true);
  };

  const handleSelectEmployeeForExp = (selectedEmpId) => {
    const emp = hrEmployees.find((e) => String(e._id) === String(selectedEmpId));
    if (!emp) {
      setExperienceForm((prev) => ({ ...prev, employeeId: selectedEmpId }));
      return;
    }
    const jDate = emp.joiningDate ? new Date(emp.joiningDate).toISOString().slice(0, 10) : '';
    const rDate = emp.relievingDate || experienceForm.relievingDate || new Date().toISOString().slice(0, 10);
    const duration = computeDurationText(jDate, rDate);

    setExperienceForm((prev) => ({
      ...prev,
      employeeId: emp._id,
      employeeName: emp.name,
      empCode: emp.employeeId || '',
      designation: emp.designation || 'Software Engineer',
      department: emp.department || 'Tech',
      joiningDate: jDate,
      relievingDate: rDate,
      employmentDuration: duration,
      workLocation: emp.location || prev.workLocation || 'Mumbai / Head Office',
    }));
  };

  const handleDateChangeForExp = (field, val) => {
    setExperienceForm((prev) => {
      const updated = { ...prev, [field]: val };
      const j = field === 'joiningDate' ? val : prev.joiningDate;
      const r = field === 'relievingDate' ? val : prev.relievingDate;
      if (j && r) {
        updated.employmentDuration = computeDurationText(j, r);
      }
      return updated;
    });
  };

  const handleSaveExperience = async (e) => {
    e.preventDefault();
    setExperienceSubmitting(true);
    setExperienceError('');
    try {
      if (!experienceForm.employeeId) throw new Error('Please select an employee');
      if (!experienceForm.joiningDate) throw new Error('Joining date is required');
      if (!experienceForm.relievingDate) throw new Error('Relieving date is required');

      let res;
      if (editingExperienceLetter) {
        res = await apiClient.put(`/recruitment/experience-letters/${editingExperienceLetter._id}`, experienceForm);
        setExperienceSuccess(`Experience Letter ${res.data?.data?.letterNumber || ''} updated successfully!`);
      } else {
        res = await apiClient.post('/recruitment/experience-letters', experienceForm);
        setExperienceSuccess(`Experience Letter ${res.data?.data?.letterNumber || ''} generated successfully!`);
      }
      setShowExperienceModal(false);
      loadExperienceLetters();
      setTimeout(() => setExperienceSuccess(''), 5000);
    } catch (err) {
      setExperienceError(err.response?.data?.message || err.message || 'Failed to save experience letter.');
    } finally {
      setExperienceSubmitting(false);
    }
  };

  const handleDeleteExperience = async () => {
    if (!viewingExperienceLetter) return;
    setExperienceSubmitting(true);
    try {
      await apiClient.delete(`/recruitment/experience-letters/${viewingExperienceLetter._id}`);
      setShowExperienceDeleteModal(false);
      setViewingExperienceLetter(null);
      setExperienceSuccess('Experience letter deleted successfully.');
      loadExperienceLetters();
      setTimeout(() => setExperienceSuccess(''), 5000);
    } catch (err) {
      setExperienceError(err.response?.data?.message || 'Failed to delete experience letter.');
    } finally {
      setExperienceSubmitting(false);
    }
  };

  const handleDownloadExperiencePDF = async (letter) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const companyName = 'AASHA SM TECHNOLOGIES PRIVATE LIMITED';
    const fd = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
    const pageW = 210;
    const m = 20;
    let y = 16;

    // 1. Corporate Header with Logo
    try {
      const logoData = await getBase64ImageFromUrl('/aasha-logo-new.jpg');
      if (logoData) {
        doc.addImage(logoData, 'JPEG', m, y - 2, 42, 13);
      }
    } catch (_e) {}

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(15, 23, 42);
    doc.text(companyName, pageW - m, y + 2, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Corporate Human Resources & Operations', pageW - m, y + 7, { align: 'right' });
    doc.text('Aasha SM Technologies · IT Services & Solutions', pageW - m, y + 11, { align: 'right' });

    y += 17;
    // Orange brand accent divider
    doc.setDrawColor(234, 88, 12);
    doc.setLineWidth(0.8);
    doc.line(m, y, pageW - m, y);
    y += 9;

    // Reference number and Date
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Ref No:', m, y);
    doc.setTextColor(15, 23, 42);
    doc.text(letter.letterNumber || 'EXP-00000', m + 15, y);

    doc.setTextColor(100, 116, 139);
    doc.text('Date:', pageW - m - 45, y);
    doc.setTextColor(15, 23, 42);
    doc.text(fd(letter.letterDate), pageW - m, y, { align: 'right' });

    y += 13;

    // Centered Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(234, 88, 12);
    doc.text('TO WHOMSOEVER IT MAY CONCERN', pageW / 2, y, { align: 'center' });

    const titleW = doc.getTextWidth('TO WHOMSOEVER IT MAY CONCERN');
    doc.setDrawColor(234, 88, 12);
    doc.setLineWidth(0.5);
    doc.line(pageW / 2 - titleW / 2, y + 1.5, pageW / 2 + titleW / 2, y + 1.5);

    y += 13;

    // Body Paragraph 1: Certification of Employment
    const empName = letter.employeeName || letter.employee?.firstName || 'Employee';
    const empId = letter.employeeId || letter.employee?.jobDetails?.employeeId || '';
    const desig = letter.designation || 'Software Engineer';
    const dept = letter.department || 'Tech';
    const jDate = fd(letter.joiningDate);
    const rDate = fd(letter.relievingDate);
    const tenure = letter.employmentDuration || computeDurationText(letter.joiningDate, letter.relievingDate) || 'the tenure';

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);

    const empIdText = empId ? ` (Employee ID: ${empId})` : '';
    const para1 = `This is to certify that ${empName}${empIdText} was in formal employment with ${companyName} from ${jDate} to ${rDate}, serving a cumulative tenure of ${tenure}.`;
    const para1Lines = doc.splitTextToSize(para1, pageW - 2 * m);
    doc.text(para1Lines, m, y);
    y += para1Lines.length * 5.2 + 3;

    const para2 = `During the tenure of employment, they rendered dedicated service in the role of ${desig} within the ${dept} department at our ${letter.workLocation || 'Mumbai'} office.`;
    const para2Lines = doc.splitTextToSize(para2, pageW - 2 * m);
    doc.text(para2Lines, m, y);
    y += para2Lines.length * 5.2 + 4;

    // Key Employment Verification Card Box
    const infoRows = [
      ['Employee Name:', empName],
      ['Employee ID:', empId || '—'],
      ['Designation:', desig],
      ['Department:', dept],
      ['Date of Joining:', jDate],
      ['Date of Relieving:', rDate],
      ['Employment Duration:', tenure],
      ['Work Location:', letter.workLocation || 'Head Office, Mumbai'],
    ];

    const boxH = infoRows.length * 5.4 + 6;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(m, y, pageW - 2 * m, boxH, 2, 2, 'FD');
    y += 5;

    infoRows.forEach(([lbl, val]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(lbl, m + 4, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(String(val), m + 52, y);
      y += 5.4;
    });
    y += 7;

    // Body Paragraph 3: Professional Conduct & Performance
    const conduct = letter.conduct || 'Exemplary';
    const para3 = `During their tenure with AASHA SM TECHNOLOGIES PRIVATE LIMITED, we found them to be sincere, hard-working, and result-oriented. Their character, professional demeanor, and conduct were observed to be ${conduct.toLowerCase()}.`;
    const para3Lines = doc.splitTextToSize(para3, pageW - 2 * m);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(para3Lines, m, y);
    y += para3Lines.length * 5.2 + 3.5;

    // Body Paragraph 4: Separation & Good Wishes
    const reason = letter.reasonForLeaving || 'resignation';
    const para4 = `They have been formally relieved from all duties on ${rDate} upon ${reason.toLowerCase()}. All company assets, clearances, and financial accounts have been satisfactorily settled. We extend our sincere appreciation for their contributions and wish them success in all their future endeavors.`;
    const para4Lines = doc.splitTextToSize(para4, pageW - 2 * m);
    doc.text(para4Lines, m, y);
    y += para4Lines.length * 5.2 + 9;

    // Signatory Block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`For ${companyName}`, m, y);
    y += 18; // Space for signature & stamp

    doc.text(letter.authorizedSignatory || 'Authorized Signatory', m, y);
    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(letter.authorizedSignatoryTitle || 'Head of Human Resources', m, y);
    y += 4;
    doc.text('Corporate Human Resources & People Operations', m, y);

    // Footer banner (A4 bottom)
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 282, pageW, 15, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(0, 282, pageW, 282);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`${companyName} · Official Experience Certification · Document Ref: ${letter.letterNumber || 'EXP'}`, pageW / 2, 290, { align: 'center' });

    const safeName = (empName || 'Employee').trim().replace(/[^a-zA-Z0-9]/g, '_');
    const safeNum = (letter.letterNumber || 'EXP').trim().replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Experience_Letter_${safeName}_${safeNum}.pdf`);
  };

  const sbCls = (s) => { const m={Draft:'rec-badge-draft',Sent:'rec-badge-sent',Accepted:'rec-badge-accepted',Rejected:'rec-badge-rejected',Expired:'rec-badge-expired',Withdrawn:'rec-badge-withdrawn',Hired:'hired'}; return 'rec-badge '+(m[s]||''); };

  return (
    <UserLayout pageTitle="Recruitment & Hiring">
      <div className="rec-container">
        {/* Header */}
        <div className="rec-header">
          <div className="rec-title-area"><h2>Recruitment &amp; Hiring Management</h2><p>Manage job requisitions, candidate pipelines, interviews, offers, and employee conversions.</p></div>
          <div className="rec-header-actions">
            <button type="button" className="rec-secondary-btn" onClick={handleOpenAddCandidate}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:'16px',height:'16px'}}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
              + Add Candidate
            </button>
            <button type="button" className="rec-primary-btn" onClick={() => handleOpenCreateJob()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:'16px',height:'16px'}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Create Job Requisition
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="rec-kpi-grid">
          <div className="rec-kpi-card accent"><span className="rec-kpi-label">Open Positions</span><strong className="rec-kpi-value">{summary.openPositions}</strong></div>
          <div className="rec-kpi-card"><span className="rec-kpi-label">Total Applicants</span><strong className="rec-kpi-value">{summary.totalApplicants}</strong></div>
          <div className="rec-kpi-card"><span className="rec-kpi-label">New Applicants</span><strong className="rec-kpi-value">{summary.newApplicants}</strong></div>
          <div className="rec-kpi-card"><span className="rec-kpi-label">Shortlisted</span><strong className="rec-kpi-value">{summary.shortlistedCandidates}</strong></div>
          <div className="rec-kpi-card"><span className="rec-kpi-label">Interviews</span><strong className="rec-kpi-value">{summary.interviewsScheduled}</strong></div>
          <div className="rec-kpi-card"><span className="rec-kpi-label">Selected</span><strong className="rec-kpi-value">{summary.selectedCandidates}</strong></div>
          <div className="rec-kpi-card"><span className="rec-kpi-label">Positions Filled</span><strong className="rec-kpi-value">{summary.positionsFilled}</strong></div>
        </div>

        {error && <div style={{background:'#FEE2E2',color:'#B91C1C',padding:'0.75rem 1rem',borderRadius:'8px',marginBottom:'1rem',fontSize:'0.875rem'}}>{error}</div>}
        {success && <div style={{background:'#DCFCE7',color:'#15803D',padding:'0.75rem 1rem',borderRadius:'8px',marginBottom:'1rem',fontSize:'0.875rem'}}>{success}</div>}

        {/* Tabs */}
        <div className="rec-nav-tabs-wrap"><div className="rec-nav-tabs">
          {[['jobs','Job Requisitions ('+jobs.length+')'],['pipeline','Recruitment Pipeline Board'],['candidates','Candidate Directory ('+candidates.length+')'],['interviews','Interviews ('+allInterviews.length+')'],['offers','Offer Letters ('+(offerSummary.total||0)+')'],['experience','Experience Letters ('+(experienceSummary.total||0)+')'],['reports','Hiring Analytics']].map(([t,l])=>(
            <button key={t} type="button" className={'rec-tab-btn '+(activeTab===t?'active':'')} onClick={()=>setActiveTab(t)}>{l}</button>
          ))}
        </div></div>

        {/* TAB 1: JOB REQUISITIONS */}
        {activeTab==='jobs' && (
          <div>
            <div className="rec-toolbar">
              <div className="rec-search-wrap"><svg className="rec-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" placeholder="Search jobs by title, ID, or designation..." className="rec-search-input" value={search} onChange={(e)=>setSearch(e.target.value)}/></div>
              <select className="rec-filter-select" value={selectedDept} onChange={(e)=>setSelectedDept(e.target.value)}><option value="All">All Departments</option>{OFFICIAL_DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}</select>
              <select className="rec-filter-select" value={selectedStatus} onChange={(e)=>setSelectedStatus(e.target.value)}><option value="All">All Statuses</option><option value="Open">Open</option><option value="On Hold">On Hold</option><option value="Closed">Closed</option><option value="Draft">Draft</option></select>
            </div>
            <div className="rec-table-card">
              {loading ? <div style={{padding:'3rem',textAlign:'center',color:'#64748b'}}>Loading...</div>
              : filteredJobs.length===0 ? <div style={{padding:'3rem',textAlign:'center',color:'#64748b'}}>No job requisitions found.</div>
              : <div className="rec-table-wrap"><table className="rec-table"><thead><tr><th>Job ID</th><th>Job Title</th><th>Department</th><th>Designation</th><th>Openings</th><th>Type</th><th>Experience</th><th>Applicants</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{filteredJobs.map(j=><tr key={j._id}><td><strong>{j.jobId}</strong></td><td><strong>{j.title}</strong><span style={{display:'block',fontSize:'0.75rem',color:'#64748b'}}>{j.location}</span></td><td><span className="hr-emp-dept-pill">{j.department}</span></td><td>{j.designation}</td><td><strong>{j.openings}</strong> vacancy</td><td>{j.employmentType}</td><td>{j.experience}</td><td><span style={{fontWeight:'700',color:'#EA580C'}}>{j.applicantCount}</span> applicants</td><td><span className={'rec-badge '+j.status.toLowerCase().replace(' ','_')}>{j.status}</span></td><td><div className="rec-actions-wrap"><button type="button" className="rec-btn-sm view" onClick={()=>handleOpenCreateJob(j)}>Edit</button><button type="button" className="rec-btn-sm interview" onClick={()=>{setSelectedDept(j.department);setActiveTab('candidates');}}>Candidates</button></div></td></tr>)}</tbody></table></div>}
            </div>
          </div>
        )}

        {/* TAB 2: PIPELINE BOARD */}
        {activeTab==='pipeline' && (
          <div>
            <div className="rec-pipeline-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
                <select
                  className="rec-filter-select rec-job-select"
                  value={pipelineJobFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPipelineJobFilter(val);
                    loadRecruitmentData(val);
                  }}
                  title="Filter candidates and KPIs by Job Requisition"
                >
                  <option value="All">All Job Requisitions ({jobs.length})</option>
                  {jobs.map((j) => (
                    <option key={j._id} value={j._id}>
                      {j.jobId} &middot; {j.title} ({j.department})
                    </option>
                  ))}
                </select>

                <select
                  className="rec-filter-select"
                  value={pipelineDeptFilter}
                  onChange={(e) => setPipelineDeptFilter(e.target.value)}
                >
                  <option value="All">All Departments</option>
                  {pipelineDepartments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <div className="rec-search-wrap" style={{ flex: 1, minWidth: '220px', maxWidth: '360px' }}>
                  <svg className="rec-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search candidate name, ID, position..."
                    className="rec-search-input"
                    value={pipelineSearch}
                    onChange={(e) => setPipelineSearch(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={`rec-terminal-toggle ${showTerminalStages ? 'active' : ''}`}
                  onClick={() => setShowTerminalStages(!showTerminalStages)}
                >
                  {showTerminalStages ? 'Hide Rejected/Withdrawn/On Hold' : 'Show Rejected/Withdrawn/On Hold'}
                </button>
                <button
                  type="button"
                  className="rec-btn-sm view"
                  onClick={() => loadRecruitmentData(pipelineJobFilter)}
                  title="Reload from MongoDB Atlas"
                  disabled={loading}
                >
                  {loading ? 'Refreshing...' : '↻ Refresh'}
                </button>
              </div>
            </div>

            {/* Loading / Error / Empty States */}
            {loading ? (
              <div className="rec-table-card" style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#64748b' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: '700', fontSize: '1rem', color: '#0f172a' }}>Loading Candidate Pipeline from MongoDB Atlas...</p>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Fetching live candidate records and stage counts.</p>
              </div>
            ) : error ? (
              <div className="rec-table-card" style={{ padding: '2.5rem 1rem', textAlign: 'center', background: '#fef2f2', border: '1px solid #fecaca' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: '700', color: '#b91c1c' }}>Unable to load recruitment data</p>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#991b1b' }}>{error}</p>
                <button type="button" className="rec-btn-sm view" onClick={() => loadRecruitmentData(pipelineJobFilter)}>Retry</button>
              </div>
            ) : candidates.length === 0 ? (
              <div className="rec-table-card" style={{ padding: '3.5rem 1rem', textAlign: 'center', color: '#64748b' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: '700', fontSize: '1.05rem', color: '#334155' }}>No candidates found</p>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem' }}>Candidates will appear here once they apply or are registered in the recruitment system.</p>
                <button type="button" className="rec-btn-sm shortlist" onClick={handleOpenAddCandidate}>+ Register First Candidate</button>
              </div>
            ) : (
              <div className="rec-pipeline-board">
                {(showTerminalStages ? ALL_PIPELINE_STAGES : PIPELINE_MAIN_STAGES).map((stage) => {
                  const stageCands = pipelineCandidates.filter((c) => {
                    if (stage === 'Final / HR Round') {
                      return c.stage === 'Final / HR Round' || c.stage === 'HR Round';
                    }
                    return c.stage === stage;
                  });
                  const isOver = dragOverStage === stage;
                  const isTerminal = PIPELINE_TERMINAL_STAGES.includes(stage);

                  return (
                    <div
                      key={stage}
                      className={`rec-pipeline-column ${isOver ? 'drag-over' : ''} ${isTerminal ? 'terminal' : ''}`}
                      onDragOver={(e) => handleDragOver(e, stage)}
                      onDragLeave={(e) => handleDragLeave(e, stage)}
                      onDrop={(e) => handleDrop(e, stage)}
                    >
                      <div className="rec-col-header">
                        <h4>{stage}</h4>
                        <span className="rec-col-count">{stageCands.length}</span>
                      </div>
                      <div className="rec-col-cards">
                        {stageCands.length === 0 ? (
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center', padding: '2rem 0' }}>
                            No candidates
                          </div>
                        ) : (
                          stageCands.map((c) => {
                            const isDragging = draggedCandidate?._id === c._id;
                            const initials = (c.name || 'NA').slice(0, 2).toUpperCase();
                            const lastInv = (c.interviews || []).slice(-1)[0];
                            return (
                              <div
                                key={c._id}
                                className={`rec-cand-card ${isDragging ? 'dragging' : ''}`}
                                draggable={true}
                                onDragStart={(e) => handleDragStart(e, c)}
                                onDragEnd={handleDragEnd}
                              >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', marginBottom: '0.45rem' }}>
                                  <div className="rec-cand-card-avatar">{initials}</div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <h5 className="rec-cand-card-name" title={c.name}>{c.name || 'Unnamed Candidate'}</h5>
                                    <p className="rec-cand-card-pos" title={`${c.appliedPosition || 'Position'} · ${c.department || 'Department'}`}>
                                      {c.appliedPosition || 'Not specified'} &middot; {c.department || 'Not specified'}
                                    </p>
                                  </div>
                                </div>

                                <div className="rec-cand-card-tags">
                                  <span className="rec-cand-tag-exp">{c.candidateId || 'No ID'}</span>
                                  <span className="rec-cand-tag-exp">{c.experience || 'Not provided'}</span>
                                  {c.atsScore ? (
                                    <span
                                      className="rec-cand-tag-exp"
                                      style={{ background: '#e0e7ff', color: '#3730a3', fontWeight: '700' }}
                                      title={`ATS Match Score: ${c.atsScore}%`}
                                    >
                                      ATS: {c.atsScore}%
                                    </span>
                                  ) : null}
                                  {c.assessment?.result && (
                                    <span
                                      className="rec-cand-tag-inv"
                                      style={{
                                        background: c.assessment.result === 'Passed' ? '#ecfdf5' : c.assessment.result === 'Failed' ? '#fef2f2' : '#f0f9ff',
                                        color: c.assessment.result === 'Passed' ? '#059669' : c.assessment.result === 'Failed' ? '#dc2626' : '#0284c7',
                                      }}
                                      title={`Assessment: ${c.assessment.name} (${c.assessment.score}/${c.assessment.maxScore})`}
                                    >
                                      📝 {c.assessment.result}
                                    </span>
                                  )}
                                  {lastInv && (
                                    <span className="rec-cand-tag-inv" title={`Latest: ${lastInv.round} (${lastInv.status})`}>
                                      {lastInv.status === 'Completed' ? '✓ ' + lastInv.round : '📅 ' + lastInv.round}
                                    </span>
                                  )}
                                  {c.screening?.decision && (
                                    <span
                                      className="rec-cand-tag-exp"
                                      style={{
                                        background: c.screening.decision === 'Pass' ? '#ecfdf5' : c.screening.decision === 'Hold' ? '#fef3c7' : '#fef2f2',
                                        color: c.screening.decision === 'Pass' ? '#059669' : c.screening.decision === 'Hold' ? '#b45309' : '#dc2626',
                                      }}
                                    >
                                      Screening: {c.screening.decision}
                                    </span>
                                  )}
                                </div>

                                <div className="rec-cand-card-actions">
                                  <button
                                    type="button"
                                    className="rec-btn-xs view"
                                    onClick={() => handleOpenProfile(c)}
                                    title="View Candidate Profile & Timeline"
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    className="rec-btn-xs move"
                                    onClick={() => handleOpenMoveStage(c)}
                                    title="Change stage manually"
                                  >
                                    Move
                                  </button>
                                  <button
                                    type="button"
                                    className="rec-btn-xs interview"
                                    onClick={() => handleOpenSchedule(c)}
                                    title="Schedule Interview Round"
                                  >
                                    Schedule
                                  </button>
                                  {c.stage === 'Applied' && (
                                    <button
                                      type="button"
                                      className="rec-btn-xs screen"
                                      onClick={() => handleOpenScreening(c)}
                                      title="Evaluate Screening"
                                    >
                                      Screen
                                    </button>
                                  )}
                                  {(c.stage === 'Shortlisted' || c.stage === 'Assessment') && (
                                    <button
                                      type="button"
                                      className="rec-btn-xs shortlist"
                                      onClick={() => handleOpenAssessment(c)}
                                      title="Record Technical Assessment"
                                    >
                                      Assess
                                    </button>
                                  )}
                                  {c.stage === 'Selected' && (
                                    <button
                                      type="button"
                                      className="rec-btn-xs offer"
                                      onClick={() => handleOpenCreateOffer(null, c)}
                                      title="Create Offer Letter in MongoDB"
                                    >
                                      Offer
                                    </button>
                                  )}
                                  {(c.stage === 'Offer' || c.stage === 'Selected') && !c.convertedEmployeeId && (
                                    <button
                                      type="button"
                                      className="rec-btn-xs convert"
                                      onClick={() => {
                                        setSelectedCandidate(c);
                                        setShowConvertModal(true);
                                      }}
                                      title="Convert Candidate to Active Employee"
                                    >
                                      Hire
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}

        {/* TAB 3: CANDIDATE DIRECTORY */}
        {activeTab==='candidates' && (
          <div>
            <div className="rec-toolbar">
              <div className="rec-search-wrap"><svg className="rec-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" placeholder="Search candidates..." className="rec-search-input" value={search} onChange={(e)=>setSearch(e.target.value)}/></div>
              <select className="rec-filter-select" value={selectedDept} onChange={(e)=>setSelectedDept(e.target.value)}><option value="All">All Departments</option>{OFFICIAL_DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}</select>
              <select className="rec-filter-select" value={selectedStage} onChange={(e)=>setSelectedStage(e.target.value)}><option value="All">All Stages</option>{PIPELINE_STAGES.map(s=><option key={s} value={s}>{s}</option>)}</select>
            </div>
            <div className="rec-table-card">
              {filteredCandidates.length===0?<div style={{padding:'3rem',textAlign:'center',color:'#64748b'}}>No candidates found.</div>
              :<div className="rec-table-wrap"><table className="rec-table"><thead><tr><th>Candidate Name</th><th>Email &amp; Phone</th><th>Applied Position</th><th>Department</th><th>Experience</th><th>Pipeline Stage</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{filteredCandidates.map(c=><tr key={c._id}><td><strong>{c.name}</strong><span style={{display:'block',fontSize:'0.75rem',color:'#64748b'}}>{c.candidateId}</span></td><td><div>{c.email}</div><span style={{fontSize:'0.75rem',color:'#64748b'}}>{c.phone}</span></td><td>{c.appliedPosition}</td><td><span className="hr-emp-dept-pill">{c.department}</span></td><td>{c.experience}</td><td><span className={'rec-badge '+c.stage.toLowerCase().replace(' ','_')}>{c.stage}</span></td><td><span className={'rec-badge '+c.status.toLowerCase().replace(' ','_')}>{c.status}</span></td>
              <td><div className="rec-actions-wrap"><button type="button" className="rec-btn-sm view" onClick={()=>handleOpenProfile(c)}>Profile</button>{c.stage==='Applied'&&<button type="button" className="rec-btn-sm shortlist" onClick={()=>handleShortlist(c._id)}>Shortlist</button>}{['Shortlisted','Interview','Technical Round','HR Round'].includes(c.stage)&&<button type="button" className="rec-btn-sm interview" onClick={()=>handleOpenSchedule(c)}>Interview</button>}{c.stage==='Selected'&&!c.convertedEmployeeId&&<button type="button" className="rec-btn-sm convert" onClick={()=>{setSelectedCandidate(c);setShowConvertModal(true);}}>Hire</button>}</div></td></tr>)}</tbody></table></div>}
            </div>
          </div>
        )}

        {/* TAB 4: INTERVIEWS */}
        {activeTab==='interviews' && (
          <div className="rec-table-card">
            {allInterviews.length===0?<div style={{padding:'3rem',textAlign:'center',color:'#64748b'}}>No interviews scheduled.</div>
            :<div className="rec-table-wrap"><table className="rec-table"><thead><tr><th>Candidate</th><th>Position &amp; Dept</th><th>Interview Round</th><th>Interviewer</th><th>Date &amp; Time</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{allInterviews.map(inv=><tr key={inv._id}><td><strong>{inv.candidateName}</strong><span style={{display:'block',fontSize:'0.75rem',color:'#64748b'}}>{inv.candidateEmail}</span></td><td><div>{inv.appliedPosition}</div><span className="hr-emp-dept-pill">{inv.department}</span></td><td><strong>{inv.round}</strong></td><td>{inv.interviewer}</td><td><div>{formatDate(inv.date)}</div><span style={{fontSize:'0.75rem',color:'#64748b'}}>{inv.time}</span></td><td>{inv.type}</td><td><span className={'rec-badge '+inv.status.toLowerCase()}>{inv.status}</span></td>
            <td><div className="rec-actions-wrap">{inv.status!=='Completed'&&<button type="button" className="rec-btn-sm shortlist" onClick={()=>{const c=candidates.find(x=>x._id===inv.candidateId);handleOpenFeedback(c,inv);}}>Feedback</button>}{inv.feedback&&<span style={{fontSize:'0.8rem',fontWeight:'700',color:'#15803D'}}>&#9733; {inv.feedback.overallRating}/5</span>}</div></td></tr>)}</tbody></table></div>}
          </div>
        )}

        {/* TAB 5: OFFER LETTERS & CONVERSIONS */}
        {activeTab==='offers' && (
          <div>
            {/* Premium Offer Header */}
            <div className="rec-offer-header">
              <div className="rec-offer-header-info">
                <h3>Offer Letters &amp; Conversions</h3>
                <p>Manage offer letters, track real-time candidate status, and convert accepted candidates to official employees.</p>
              </div>
              <button type="button" className="rec-primary-btn" onClick={() => handleOpenCreateOffer()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Create Offer Letter
              </button>
            </div>

            {offerError && <div className="rec-form-error"><span>⚠️</span><span>{offerError}</span></div>}
            {offerSuccess && <div className="rec-form-success"><span>✓</span><span>{offerSuccess}</span></div>}

            {/* 6 Luxury KPI Cards */}
            <div className="rec-offer-kpi-grid">
              {[
                { key: 'total', label: 'Total Offers', value: offerSummary.total, filter: 'All', helper: 'All offer letters', icon: '📄', color: '#0f172a', bg: '#f8fafc' },
                { key: 'draft', label: 'Draft', value: offerSummary.draft, filter: 'Draft', helper: 'Saved drafts', icon: '📝', color: '#64748b', bg: '#f1f5f9' },
                { key: 'sent', label: 'Sent', value: offerSummary.sent, filter: 'Sent', helper: 'Awaiting candidate reply', icon: '✉️', color: '#2563eb', bg: '#eff6ff' },
                { key: 'accepted', label: 'Accepted', value: offerSummary.accepted, filter: 'Accepted', helper: 'Approved by candidate', icon: '✓', color: '#15803d', bg: '#ecfdf5' },
                { key: 'rejected', label: 'Rejected', value: offerSummary.rejected, filter: 'Rejected', helper: 'Declined offers', icon: '✕', color: '#dc2626', bg: '#fef2f2' },
                { key: 'pending', label: 'Pending Conversion', value: offerSummary.pendingConversion, filter: 'PendingConversion', helper: 'Ready for onboarding', icon: '👤', color: '#ea580c', bg: '#fff7ed' },
              ].map((k) => {
                const isActive = (k.filter === 'PendingConversion')
                  ? offerStatusFilter === 'PendingConversion'
                  : offerStatusFilter === k.filter;
                return (
                  <div
                    key={k.key}
                    className={`rec-offer-kpi-card ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setOfferStatusFilter(k.filter);
                    }}
                  >
                    <div className="rec-kpi-card-top">
                      <span className="rec-kpi-card-label">{k.label}</span>
                      <div className="rec-kpi-card-icon" style={{ background: k.bg, color: k.color }}>{k.icon}</div>
                    </div>
                    <div className="rec-kpi-card-val" style={{ color: k.color }}>
                      {offersLoading ? '...' : (k.value ?? 0)}
                    </div>
                    <p className="rec-kpi-card-helper">{k.helper}</p>
                  </div>
                );
              })}
            </div>

            {/* Offer Toolbar */}
            <div className="rec-toolbar" style={{ marginTop: '1rem' }}>
              <div className="rec-search-wrap">
                <svg className="rec-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search offer number, candidate, designation..."
                  className="rec-search-input"
                  value={offerSearch}
                  onChange={(e) => setOfferSearch(e.target.value)}
                />
              </div>
              <select className="rec-filter-select" value={offerStatusFilter} onChange={(e) => setOfferStatusFilter(e.target.value)}>
                <option value="All">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Accepted">Accepted</option>
                <option value="PendingConversion">Pending Conversion</option>
                <option value="Rejected">Rejected</option>
                <option value="Expired">Expired</option>
                <option value="Withdrawn">Withdrawn</option>
              </select>
              <select className="rec-filter-select" value={offerDeptFilter} onChange={(e) => setOfferDeptFilter(e.target.value)}>
                <option value="All">All Departments</option>
                {OFFICIAL_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select className="rec-filter-select" value={offerEmpTypeFilter} onChange={(e) => setOfferEmpTypeFilter(e.target.value)}>
                <option value="All">All Employment Types</option>
                <option value="Full Time">Full Time</option>
                <option value="Part Time">Part Time</option>
                <option value="Contract">Contract</option>
                <option value="Intern">Intern</option>
              </select>
              <select className="rec-filter-select" value={offerSortDir} onChange={(e) => setOfferSortDir(e.target.value)}>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
              {(offerSearch || offerStatusFilter !== 'All' || offerDeptFilter !== 'All' || offerEmpTypeFilter !== 'All') && (
                <button
                  type="button"
                  className="rec-btn-sm view"
                  onClick={() => {
                    setOfferSearch('');
                    setOfferStatusFilter('All');
                    setOfferDeptFilter('All');
                    setOfferEmpTypeFilter('All');
                  }}
                >
                  Reset Filters
                </button>
              )}
            </div>

            {/* Offers Table */}
            <div className="rec-table-card" style={{ marginTop: '1rem' }}>
              {offersLoading ? (
                <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>Loading offer letters from database...</div>
              ) : filteredOffers.length === 0 ? (
                <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600', color: '#334155' }}>No offer letters found.</p>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>Click &quot;Create Offer Letter&quot; to prepare a new offer.</p>
                </div>
              ) : (
                <div className="rec-table-wrap">
                  <table className="rec-table">
                    <thead>
                      <tr>
                        <th>Offer No.</th>
                        <th>Candidate</th>
                        <th>Designation</th>
                        <th>Department</th>
                        <th>Salary</th>
                        <th>Joining Date</th>
                        <th>Status</th>
                        <th>Offer Date</th>
                        <th className="rec-offer-actions-col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOffers.map((o) => (
                        <tr key={o._id}>
                          <td>
                            <strong style={{ color: '#ea580c', fontFamily: 'monospace', fontSize: '0.85rem' }}>{o.offerNumber}</strong>
                          </td>
                          <td>
                            <div className="rec-cand-cell">
                              <div className="rec-cand-avatar">
                                {(o.candidate?.name || 'C').slice(0, 2).toUpperCase()}
                              </div>
                              <div className="rec-cand-info">
                                <span className="rec-cand-name">{o.candidate?.name || 'Candidate'}</span>
                                <span className="rec-cand-email">{o.candidate?.email || 'No email'}</span>
                              </div>
                            </div>
                          </td>
                          <td>{o.offeredDesignation}</td>
                          <td><span className="hr-emp-dept-pill">{o.department}</span></td>
                          <td><strong>{o.salary || 'Competitive'}</strong></td>
                          <td>{formatDate(o.joiningDate)}</td>
                          <td><span className={sbCls(o.status)}>{o.status}</span></td>
                          <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{formatDate(o.offerDate)}</td>
                          <td className="rec-offer-actions-col">
                            <div className="rec-actions-wrap rec-offer-actions-wrap">
                              <button
                                type="button"
                                className="rec-btn-sm view"
                                onClick={() => {
                                  setViewingOffer(o);
                                  setShowOfferPreviewModal(true);
                                }}
                              >
                                Preview
                              </button>
                              <button
                                type="button"
                                className="rec-btn-sm shortlist"
                                onClick={() => handleOpenCreateOffer(o)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="rec-btn-sm convert"
                                disabled={offerSubmitting}
                                onClick={() => {
                                  if (o.status === 'Sent') {
                                    handleStatusAction(o._id, 'resend');
                                  } else {
                                    setViewingOffer(o);
                                    setShowOfferSendModal(true);
                                  }
                                }}
                              >
                                {offerSubmitting ? 'Sending...' : o.status === 'Sent' ? 'Resend' : 'Send'}
                              </button>
                              <button
                                type="button"
                                className="rec-btn-sm reject"
                                disabled={offerSubmitting}
                                onClick={() => {
                                  setViewingOffer(o);
                                  setShowOfferDeleteModal(true);
                                }}
                              >
                                Delete
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

        {/* TAB 6: EXPERIENCE LETTERS */}
        {activeTab==='experience' && (
          <div>
            {/* Experience Letter Header */}
            <div className="rec-offer-header">
              <div className="rec-offer-header-info">
                <h3>Experience Letters</h3>
                <p>Generate, issue, and manage verified corporate experience certification letters for employees.</p>
              </div>
              <button type="button" className="rec-primary-btn" onClick={() => handleOpenCreateExperience()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                + Generate Experience Letter
              </button>
            </div>

            {experienceError && <div className="rec-form-error"><span>⚠️</span><span>{experienceError}</span></div>}
            {experienceSuccess && <div className="rec-form-success"><span>✓</span><span>{experienceSuccess}</span></div>}

            {/* Experience KPI Grid */}
            <div className="rec-offer-kpi-grid">
              {[
                { key: 'total', label: 'Total Letters', value: experienceSummary.total, filter: 'All', helper: 'All generated letters', icon: '📄', color: '#0f172a', bg: '#f8fafc' },
                { key: 'issued', label: 'Issued', value: experienceSummary.issued, filter: 'Issued', helper: 'Formally issued certificates', icon: '✓', color: '#15803d', bg: '#ecfdf5' },
                { key: 'draft', label: 'Draft', value: experienceSummary.draft, filter: 'Draft', helper: 'Pending drafts', icon: '📝', color: '#64748b', bg: '#f1f5f9' },
                { key: 'revoked', label: 'Revoked', value: experienceSummary.revoked, filter: 'Revoked', helper: 'Revoked / cancelled', icon: '✕', color: '#dc2626', bg: '#fef2f2' },
              ].map((k) => {
                const isActive = experienceStatusFilter === k.filter;
                return (
                  <div
                    key={k.key}
                    className={`rec-offer-kpi-card ${isActive ? 'active' : ''}`}
                    onClick={() => setExperienceStatusFilter(k.filter)}
                  >
                    <div className="rec-kpi-card-top">
                      <span className="rec-kpi-card-label">{k.label}</span>
                      <div className="rec-kpi-card-icon" style={{ background: k.bg, color: k.color }}>{k.icon}</div>
                    </div>
                    <div className="rec-kpi-card-val" style={{ color: k.color }}>
                      {experienceLoading ? '...' : (k.value ?? 0)}
                    </div>
                    <p className="rec-kpi-card-helper">{k.helper}</p>
                  </div>
                );
              })}
            </div>

            {/* Experience Toolbar */}
            <div className="rec-toolbar" style={{ marginTop: '1rem' }}>
              <div className="rec-search-wrap">
                <svg className="rec-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search letter number, employee, designation..."
                  className="rec-search-input"
                  value={experienceSearch}
                  onChange={(e) => setExperienceSearch(e.target.value)}
                />
              </div>
              <select className="rec-filter-select" value={experienceStatusFilter} onChange={(e) => setExperienceStatusFilter(e.target.value)}>
                <option value="All">All Statuses</option>
                <option value="Issued">Issued</option>
                <option value="Draft">Draft</option>
                <option value="Revoked">Revoked</option>
              </select>
              <select className="rec-filter-select" value={experienceDeptFilter} onChange={(e) => setExperienceDeptFilter(e.target.value)}>
                <option value="All">All Departments</option>
                {OFFICIAL_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select className="rec-filter-select" value={experienceSortDir} onChange={(e) => setExperienceSortDir(e.target.value)}>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
              {(experienceSearch || experienceStatusFilter !== 'All' || experienceDeptFilter !== 'All') && (
                <button
                  type="button"
                  className="rec-btn-sm view"
                  onClick={() => {
                    setExperienceSearch('');
                    setExperienceStatusFilter('All');
                    setExperienceDeptFilter('All');
                  }}
                >
                  Reset Filters
                </button>
              )}
            </div>

            {/* Experience Letters Table */}
            <div className="rec-table-card" style={{ marginTop: '1rem' }}>
              {experienceLoading ? (
                <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>Loading experience letters from database...</div>
              ) : filteredExperienceLetters.length === 0 ? (
                <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600', color: '#334155' }}>No experience letters generated yet.</p>
                  <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem' }}>Click &quot;+ Generate Experience Letter&quot; to issue an official experience certificate.</p>
                  <button type="button" className="rec-primary-btn" onClick={() => handleOpenCreateExperience()} style={{ margin: '0 auto' }}>
                    + Generate Experience Letter
                  </button>
                </div>
              ) : (
                <div className="rec-table-wrap">
                  <table className="rec-table">
                    <thead>
                      <tr>
                        <th>Letter No.</th>
                        <th>Employee</th>
                        <th>Designation</th>
                        <th>Department</th>
                        <th>Tenure Period</th>
                        <th>Duration</th>
                        <th>Status</th>
                        <th>Letter Date</th>
                        <th className="rec-offer-actions-col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExperienceLetters.map((l) => (
                        <tr key={l._id}>
                          <td>
                            <strong style={{ color: '#ea580c', fontFamily: 'monospace', fontSize: '0.85rem' }}>{l.letterNumber}</strong>
                          </td>
                          <td>
                            <div className="rec-cand-cell">
                              <div className="rec-cand-avatar">
                                {(l.employeeName || 'E').slice(0, 2).toUpperCase()}
                              </div>
                              <div className="rec-cand-info">
                                <span className="rec-cand-name">{l.employeeName || 'Employee'}</span>
                                <span className="rec-cand-email">{l.employeeId ? `ID: ${l.employeeId}` : (l.employee?.email || '')}</span>
                              </div>
                            </div>
                          </td>
                          <td>{l.designation}</td>
                          <td><span className="hr-emp-dept-pill">{l.department}</span></td>
                          <td style={{ fontSize: '0.82rem' }}>{formatDate(l.joiningDate)} &mdash; {formatDate(l.relievingDate)}</td>
                          <td><strong>{l.employmentDuration || computeDurationText(l.joiningDate, l.relievingDate) || '—'}</strong></td>
                          <td><span className={expBadgeCls(l.status)}>{l.status}</span></td>
                          <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{formatDate(l.letterDate)}</td>
                          <td className="rec-offer-actions-col">
                            <div className="rec-actions-wrap rec-offer-actions-wrap">
                              <button
                                type="button"
                                className="rec-btn-sm view"
                                onClick={() => {
                                  setViewingExperienceLetter(l);
                                  setShowExperiencePreviewModal(true);
                                }}
                              >
                                Preview
                              </button>
                              <button
                                type="button"
                                className="rec-btn-sm shortlist"
                                onClick={() => handleOpenCreateExperience(l)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="rec-btn-sm convert"
                                onClick={() => handleDownloadExperiencePDF(l)}
                              >
                                Download
                              </button>
                              <button
                                type="button"
                                className="rec-btn-sm reject"
                                disabled={experienceSubmitting}
                                onClick={() => {
                                  setViewingExperienceLetter(l);
                                  setShowExperienceDeleteModal(true);
                                }}
                              >
                                Delete
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

        {/* TAB 7: HIRING ANALYTICS */}
        {activeTab==='reports' && (
          <div className="rec-analytics-grid">
            <div className="rec-analytics-card"><h4>Open Positions &amp; Applicants by Department</h4>
              {OFFICIAL_DEPARTMENTS.map(dept=>{const st=summary.deptStats?.[dept]||{openJobs:0,applicants:0};return(<div key={dept} style={{marginBottom:'1rem'}}><div style={{display:'flex',justifyContent:'space-between',fontSize:'0.85rem',fontWeight:'600',marginBottom:'0.25rem'}}><span>{dept}</span><span>{st.openJobs} vacancies &middot; {st.applicants} applicants</span></div><div style={{height:'8px',background:'#f1f5f9',borderRadius:'4px',overflow:'hidden'}}><div style={{width:Math.min(100,st.applicants*15)+'%',height:'100%',background:'#EA580C',borderRadius:'4px'}}/></div></div>);})}
            </div>
            <div className="rec-analytics-card"><h4>Recruitment Pipeline Conversion Distribution</h4>
              {PIPELINE_STAGES.map(st=>{const cnt=summary.stageCounts?.[st]||0;const pct=summary.totalApplicants>0?((cnt/summary.totalApplicants)*100).toFixed(1):0;return(<div key={st} style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.75rem',fontSize:'0.85rem'}}><span style={{fontWeight:'600',color:'#334155'}}>{st}</span><div><strong style={{color:'#0f172a',marginRight:'0.5rem'}}>{cnt}</strong><span style={{color:'#64748b',fontSize:'0.78rem'}}>({pct}%)</span></div></div>);})}
            </div>
          </div>
        )}

        {/* ==================== MODALS ==================== */}

        {/* Create/Edit Job Modal */}
        {showJobModal&&(
          <div className="hr-modal-overlay" onClick={()=>setShowJobModal(false)}>
            <div className="hr-modal-card" onClick={e=>e.stopPropagation()} style={{maxWidth:'680px'}}>
              <div className="hr-modal-header"><h3>{selectedJob?'Edit Job Requisition':'Create Job Requisition'}</h3><button type="button" className="hr-modal-close" onClick={()=>setShowJobModal(false)}>&times;</button></div>
              <form onSubmit={handleSaveJob}><div className="hr-modal-body"><div className="hr-form-grid">
                <div className="hr-form-group"><label>Job Title *</label><input type="text" required placeholder="e.g. Senior Frontend Engineer" value={jobForm.title} onChange={e=>setJobForm({...jobForm,title:e.target.value})}/></div>
                <div className="hr-form-group"><label>Department *</label><select required value={jobForm.department} onChange={e=>setJobForm({...jobForm,department:e.target.value})}>{OFFICIAL_DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}</select></div>
                <div className="hr-form-group"><label>Designation *</label><input type="text" required placeholder="e.g. React Developer" value={jobForm.designation} onChange={e=>setJobForm({...jobForm,designation:e.target.value})}/></div>
                <div className="hr-form-group"><label>Number of Openings *</label><input type="number" min="1" required value={jobForm.openings} onChange={e=>setJobForm({...jobForm,openings:Number(e.target.value)})}/></div>
                <div className="hr-form-group"><label>Employment Type</label><select value={jobForm.employmentType} onChange={e=>setJobForm({...jobForm,employmentType:e.target.value})}><option>Full Time</option><option>Part Time</option><option>Intern</option><option>Contract</option></select></div>
                <div className="hr-form-group"><label>Priority</label><select value={jobForm.priority} onChange={e=>setJobForm({...jobForm,priority:e.target.value})}><option>Low</option><option>Medium</option><option>High</option><option>Urgent</option></select></div>
                <div className="hr-form-group"><label>Salary Range / CTC</label><input type="text" placeholder="e.g. 8-12 LPA" value={jobForm.salaryRange} onChange={e=>setJobForm({...jobForm,salaryRange:e.target.value})}/></div>
                <div className="hr-form-group"><label>Experience Required</label><input type="text" placeholder="e.g. 2-4 Years" value={jobForm.experience} onChange={e=>setJobForm({...jobForm,experience:e.target.value})}/></div>
                <div className="hr-form-group full-width"><label>Job Description &amp; Responsibilities</label><textarea rows={3} value={jobForm.description} onChange={e=>setJobForm({...jobForm,description:e.target.value})}/></div>
                <div className="hr-form-group full-width"><label>Requirements &amp; Skills</label><textarea rows={2} value={jobForm.requirements} onChange={e=>setJobForm({...jobForm,requirements:e.target.value})}/></div>
                <div className="hr-form-group"><label>Status</label><select value={jobForm.status} onChange={e=>setJobForm({...jobForm,status:e.target.value})}><option>Open</option><option>Draft</option><option>On Hold</option><option>Closed</option></select></div>
              </div></div>
              <div className="hr-modal-footer"><button type="button" className="hr-btn-secondary" onClick={()=>setShowJobModal(false)}>Cancel</button><button type="submit" className="hr-btn-primary" disabled={submitting}>{submitting?'Saving...':selectedJob?'Save Changes':'Publish Job'}</button></div>
              </form>
            </div>
          </div>
        )}

        {/* General Add Candidate Modal — INDEPENDENT of offer letter modal */}
        {showCandidateModal&&(
          <div className="hr-modal-overlay" onClick={()=>setShowCandidateModal(false)}>
            <div className="hr-modal-card" onClick={e=>e.stopPropagation()} style={{maxWidth:'640px'}}>
              <div className="hr-modal-header"><h3>Register Candidate</h3><button type="button" className="hr-modal-close" onClick={()=>setShowCandidateModal(false)}>&times;</button></div>
              <form onSubmit={handleSaveCandidate}><div className="hr-modal-body"><div className="hr-form-grid">
                <div className="hr-form-group"><label>Candidate Name *</label><input type="text" required placeholder="Full Name" value={candidateForm.name} onChange={e=>setCandidateForm({...candidateForm,name:e.target.value})}/></div>
                <div className="hr-form-group"><label>Email Address *</label><input type="email" required value={candidateForm.email} onChange={e=>setCandidateForm({...candidateForm,email:e.target.value})}/></div>
                <div className="hr-form-group"><label>Phone Number *</label><input type="tel" required value={candidateForm.phone} onChange={e=>setCandidateForm({...candidateForm,phone:e.target.value})}/></div>
                <div className="hr-form-group"><label>Department *</label><select required value={candidateForm.department} onChange={e=>setCandidateForm({...candidateForm,department:e.target.value})}>{OFFICIAL_DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}</select></div>
                <div className="hr-form-group"><label>Applied Position *</label><input type="text" required value={candidateForm.appliedPosition} onChange={e=>setCandidateForm({...candidateForm,appliedPosition:e.target.value})}/></div>
                <div className="hr-form-group"><label>Experience</label><input type="text" placeholder="e.g. 3 Years" value={candidateForm.experience} onChange={e=>setCandidateForm({...candidateForm,experience:e.target.value})}/></div>
                <div className="hr-form-group full-width"><label>Key Skills (comma separated)</label><input type="text" value={candidateForm.skills} onChange={e=>setCandidateForm({...candidateForm,skills:e.target.value})}/></div>
                <div className="hr-form-group"><label>Current Company</label><input type="text" value={candidateForm.currentCompany} onChange={e=>setCandidateForm({...candidateForm,currentCompany:e.target.value})}/></div>
                <div className="hr-form-group"><label>Notice Period</label><input type="text" value={candidateForm.noticePeriod} onChange={e=>setCandidateForm({...candidateForm,noticePeriod:e.target.value})}/></div>
              </div></div>
              <div className="hr-modal-footer"><button type="button" className="hr-btn-secondary" onClick={()=>setShowCandidateModal(false)}>Cancel</button><button type="submit" className="hr-btn-primary" disabled={submitting}>{submitting?'Registering...':'Save Candidate'}</button></div>
              </form>
            </div>
          </div>
        )}

        {/* Candidate Profile Modal with Multi-tab Details & History */}
        {showProfileModal && selectedCandidate && (
          <div className="hr-modal-overlay" onClick={() => setShowProfileModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '780px' }}>
              <div className="hr-modal-header">
                <h3>Candidate Profile: {selectedCandidate.name}</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowProfileModal(false)}>&times;</button>
              </div>
              <div className="hr-modal-body">
                {/* Profile Header Banner */}
                <div className="hr-profile-header-banner">
                  <div className="hr-profile-avatar-lg">
                    {(selectedCandidate.name || 'C').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="hr-profile-main-info">
                    <h4>{selectedCandidate.name}</h4>
                    <span>{selectedCandidate.appliedPosition} &middot; {selectedCandidate.department}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span className={'rec-badge ' + selectedCandidate.stage.toLowerCase().replace(/[^a-z0-9]/g, '_')}>
                      {selectedCandidate.stage}
                    </span>
                    <button
                      type="button"
                      className="rec-btn-xs move"
                      onClick={() => handleOpenMoveStage(selectedCandidate)}
                    >
                      Move Stage
                    </button>
                  </div>
                </div>

                {/* Sub-Tabs */}
                <div className="rec-details-tabs">
                  {[
                    ['overview', 'Overview'],
                    ['timeline', `Timeline (${(candidateTimeline.length || selectedCandidate.history?.length || 0)})`],
                    ['screening', 'Screening'],
                    ['assessment', 'Assessment'],
                    ['interviews', `Interviews (${(selectedCandidate.interviews?.length || 0)})`],
                    ['offer', 'Offer & Conversion'],
                  ].map(([tabKey, tabLabel]) => (
                    <button
                      key={tabKey}
                      type="button"
                      className={`rec-details-tab-btn ${candidateDetailTab === tabKey ? 'active' : ''}`}
                      onClick={() => setCandidateDetailTab(tabKey)}
                    >
                      {tabLabel}
                    </button>
                  ))}
                </div>

                {/* TAB 1: OVERVIEW */}
                {candidateDetailTab === 'overview' && (
                  <div>
                    <div className="hr-profile-details-grid" style={{ marginBottom: '1.25rem' }}>
                      <div className="hr-profile-item"><span>Email</span><strong>{selectedCandidate.email}</strong></div>
                      <div className="hr-profile-item"><span>Phone</span><strong>{selectedCandidate.phone}</strong></div>
                      <div className="hr-profile-item"><span>Candidate ID</span><strong>{selectedCandidate.candidateId}</strong></div>
                      <div className="hr-profile-item"><span>Experience</span><strong>{selectedCandidate.experience || 'Not provided'}</strong></div>
                      <div className="hr-profile-item"><span>Current Company</span><strong>{selectedCandidate.currentCompany || 'Not specified'}</strong></div>
                      <div className="hr-profile-item"><span>Current CTC</span><strong>{selectedCandidate.currentCTC || 'Not specified'}</strong></div>
                      <div className="hr-profile-item"><span>Expected CTC</span><strong>{selectedCandidate.expectedCTC || 'Not specified'}</strong></div>
                      <div className="hr-profile-item"><span>Notice Period</span><strong>{selectedCandidate.noticePeriod}</strong></div>
                      <div className="hr-profile-item"><span>Location</span><strong>{selectedCandidate.location || 'In-Office / Hybrid'}</strong></div>
                      <div className="hr-profile-item"><span>Education</span><strong>{selectedCandidate.education || 'Graduate'}</strong></div>
                      <div className="hr-profile-item"><span>ATS Match Score</span><strong>{selectedCandidate.atsScore ? `${selectedCandidate.atsScore}%` : 'Not evaluated'}</strong></div>
                      <div className="hr-profile-item"><span>Source</span><strong>{selectedCandidate.source || 'Direct Application'}</strong></div>
                      <div className="hr-profile-item"><span>Applied Date</span><strong>{formatDate(selectedCandidate.createdAt)}</strong></div>
                      <div className="hr-profile-item"><span>Applied Requisition</span><strong>{selectedCandidate.appliedJob?.title || selectedCandidate.appliedPosition}</strong></div>
                      <div className="hr-profile-item">
                        <span>Resume / CV</span>
                        {selectedCandidate.resumeUrl ? (
                          <a href={selectedCandidate.resumeUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: '600' }}>
                            📄 View Resume
                          </a>
                        ) : (
                          <strong>Not uploaded</strong>
                        )}
                      </div>
                    </div>
                    {selectedCandidate.skills?.length > 0 && (
                      <div style={{ marginBottom: '1.25rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>Key Skills:</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.35rem' }}>
                          {selectedCandidate.skills.map((s, i) => (
                            <span key={i} style={{ background: '#f1f5f9', color: '#334155', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: '600' }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: TIMELINE (STAGE HISTORY) */}
                {candidateDetailTab === 'timeline' && (
                  <div>
                    {timelineLoading ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading timeline...</div>
                    ) : (candidateTimeline.length > 0 ? candidateTimeline : (selectedCandidate.history || [])).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                        No stage transitions recorded yet.
                      </div>
                    ) : (
                      <div className="rec-timeline-list">
                        {(candidateTimeline.length > 0 ? candidateTimeline : (selectedCandidate.history || [])).map((item, idx) => (
                          <div key={idx} className="rec-timeline-item">
                            <div className="rec-timeline-header">
                              <span className="rec-timeline-stages">
                                {item.fromStage ? `${item.fromStage} → ${item.toStage || item.stage}` : (item.toStage || item.stage)}
                              </span>
                              <span className="rec-timeline-time">{formatDate(item.changedAt || item.updatedAt)}</span>
                            </div>
                            <div className="rec-timeline-actor">
                              Recorded by: <strong>{item.changedByName || item.changedBy?.name || 'Recruiter'}</strong>
                              {item.reason && <span> &middot; Reason: <em>{item.reason}</em></span>}
                            </div>
                            {item.notes && <div className="rec-timeline-notes">{item.notes}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: SCREENING */}
                {candidateDetailTab === 'screening' && (
                  <div>
                    {selectedCandidate.screening?.decision ? (
                      <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#0f172a' }}>Screening Assessment</h4>
                          <span
                            className="rec-badge"
                            style={{
                              background: selectedCandidate.screening.decision === 'Pass' ? '#dcfce7' : selectedCandidate.screening.decision === 'Hold' ? '#fef3c7' : '#fee2e2',
                              color: selectedCandidate.screening.decision === 'Pass' ? '#15803d' : selectedCandidate.screening.decision === 'Hold' ? '#b45309' : '#b91c1c',
                            }}
                          >
                            Decision: {selectedCandidate.screening.decision}
                          </span>
                        </div>
                        <div className="hr-profile-details-grid" style={{ marginBottom: '1rem' }}>
                          <div className="hr-profile-item"><span>Recruiter</span><strong>{selectedCandidate.screening.recruiter || 'HR'}</strong></div>
                          <div className="hr-profile-item"><span>Screening Date</span><strong>{formatDate(selectedCandidate.screening.screenedAt)}</strong></div>
                          <div className="hr-profile-item"><span>Skills Match</span><strong>{selectedCandidate.screening.skillsMatch || '—'}/5 &#9733;</strong></div>
                          <div className="hr-profile-item"><span>Experience Match</span><strong>{selectedCandidate.screening.experienceMatch || '—'}/5 &#9733;</strong></div>
                          <div className="hr-profile-item"><span>Communication</span><strong>{selectedCandidate.screening.communication || '—'}/5 &#9733;</strong></div>
                          <div className="hr-profile-item"><span>Overall Assessment</span><strong>{selectedCandidate.screening.assessmentScore || '—'}/5 &#9733;</strong></div>
                        </div>
                        {selectedCandidate.screening.notes && (
                          <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                            <strong>Screening Notes:</strong> {selectedCandidate.screening.notes}
                          </div>
                        )}
                        <div style={{ marginTop: '1rem' }}>
                          <button
                            type="button"
                            className="rec-btn-sm shortlist"
                            onClick={() => handleOpenScreening(selectedCandidate)}
                          >
                            Re-evaluate Screening
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                        <p style={{ margin: '0 0 0.75rem 0', color: '#64748b', fontSize: '0.875rem' }}>
                          No screening assessment recorded for {selectedCandidate.name} yet.
                        </p>
                        <button
                          type="button"
                          className="rec-btn-sm convert"
                          onClick={() => handleOpenScreening(selectedCandidate)}
                        >
                          + Record Screening Assessment
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: TECHNICAL ASSESSMENT */}
                {candidateDetailTab === 'assessment' && (
                  <div>
                    {selectedCandidate.assessment?.result ? (
                      <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#0f172a' }}>{selectedCandidate.assessment.name || 'Technical Assessment'}</h4>
                          <span
                            className="rec-badge"
                            style={{
                              background: selectedCandidate.assessment.result === 'Passed' ? '#dcfce7' : selectedCandidate.assessment.result === 'Failed' ? '#fee2e2' : '#fef3c7',
                              color: selectedCandidate.assessment.result === 'Passed' ? '#15803d' : selectedCandidate.assessment.result === 'Failed' ? '#b91c1c' : '#b45309',
                            }}
                          >
                            Result: {selectedCandidate.assessment.result}
                          </span>
                        </div>
                        <div className="hr-profile-details-grid" style={{ marginBottom: '1rem' }}>
                          <div className="hr-profile-item"><span>Score</span><strong>{selectedCandidate.assessment.score} / {selectedCandidate.assessment.maxScore || 100}</strong></div>
                          <div className="hr-profile-item"><span>Percentage</span><strong>{Math.round(((selectedCandidate.assessment.score || 0) / (selectedCandidate.assessment.maxScore || 100)) * 100)}%</strong></div>
                          <div className="hr-profile-item"><span>Evaluator</span><strong>{selectedCandidate.assessment.evaluator || 'Tech Lead'}</strong></div>
                          <div className="hr-profile-item"><span>Submitted Date</span><strong>{formatDate(selectedCandidate.assessment.submittedAt)}</strong></div>
                        </div>
                        {selectedCandidate.assessment.feedback && (
                          <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem', marginBottom: '1rem' }}>
                            <strong>Evaluator Feedback:</strong> {selectedCandidate.assessment.feedback}
                          </div>
                        )}
                        <button
                          type="button"
                          className="rec-btn-sm shortlist"
                          onClick={() => handleOpenAssessment(selectedCandidate)}
                        >
                          Re-evaluate / Update Assessment
                        </button>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                        <p style={{ margin: '0 0 0.75rem 0', color: '#64748b', fontSize: '0.875rem' }}>
                          No technical assessment recorded for {selectedCandidate.name} yet.
                        </p>
                        <button
                          type="button"
                          className="rec-btn-sm convert"
                          onClick={() => handleOpenAssessment(selectedCandidate)}
                        >
                          + Record Technical Assessment
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: INTERVIEWS */}
                {candidateDetailTab === 'interviews' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h5 style={{ margin: 0, fontWeight: '700', color: '#0f172a' }}>Interview Rounds</h5>
                      <button
                        type="button"
                        className="rec-btn-sm interview"
                        onClick={() => handleOpenSchedule(selectedCandidate)}
                      >
                        + Schedule Round
                      </button>
                    </div>
                    {selectedCandidate.interviews?.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b', textAlign: 'center', padding: '2rem 0' }}>
                        No interview rounds scheduled yet.
                      </p>
                    ) : (
                      selectedCandidate.interviews?.map((inv) => (
                        <div
                          key={inv._id}
                          style={{
                            padding: '0.75rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            marginBottom: '0.65rem',
                            background: '#ffffff',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <strong style={{ fontSize: '0.875rem', color: '#0f172a' }}>{inv.round}</strong>
                              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                                {formatDate(inv.date)} at {inv.time} &middot; {inv.type} &middot; Interviewer: <strong>{inv.interviewer}</strong>
                              </div>
                              {inv.meetingLink && (
                                <a
                                  href={inv.meetingLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontSize: '0.75rem', color: '#2563eb', display: 'inline-block', marginTop: '0.25rem' }}
                                >
                                  🔗 Join Meeting
                                </a>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span className={'rec-badge ' + inv.status.toLowerCase()}>{inv.status}</span>
                              {inv.status !== 'Completed' && (
                                <button
                                  type="button"
                                  className="rec-btn-sm shortlist"
                                  onClick={() => handleOpenFeedback(selectedCandidate, inv)}
                                >
                                  Feedback
                                </button>
                              )}
                            </div>
                          </div>
                          {inv.feedback && (
                            <div style={{ marginTop: '0.5rem', background: '#f8fafc', padding: '0.5rem', borderRadius: '6px', fontSize: '0.78rem', borderLeft: '3px solid #10b981' }}>
                              <strong>Score: {inv.feedback.overallRating}/5 &#9733;</strong> &middot; Recommendation: <strong>{inv.feedback.recommendation}</strong>
                              {inv.feedback.comments && <div>{inv.feedback.comments}</div>}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TAB 5: OFFER & CONVERSION */}
                {candidateDetailTab === 'offer' && (
                  <div>
                    {selectedCandidate.offer ? (
                      <div style={{ background: '#ECFDF5', padding: '1.25rem', borderRadius: '8px', border: '1px solid #A7F3D0', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <h4 style={{ margin: 0, color: '#065F46', fontSize: '0.95rem' }}>Job Offer Details</h4>
                          <span className="rec-badge rec-badge-accepted">Active Offer</span>
                        </div>
                        <div className="hr-profile-details-grid">
                          <div className="hr-profile-item"><span>Designation</span><strong>{selectedCandidate.offer.offeredDesignation}</strong></div>
                          <div className="hr-profile-item"><span>Annual CTC / Salary</span><strong>{selectedCandidate.offer.salary}</strong></div>
                          <div className="hr-profile-item"><span>Joining Date</span><strong>{formatDate(selectedCandidate.offer.joiningDate)}</strong></div>
                          <div className="hr-profile-item"><span>Offer Date</span><strong>{formatDate(selectedCandidate.offer.offerDate)}</strong></div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '1.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', marginBottom: '1rem' }}>
                        <p style={{ margin: '0 0 0.65rem 0', color: '#64748b', fontSize: '0.85rem' }}>
                          No formal offer letter created yet.
                        </p>
                        <button
                          type="button"
                          className="rec-btn-sm shortlist"
                          onClick={() => handleOpenCreateOffer(null, selectedCandidate)}
                        >
                          + Create Offer Letter
                        </button>
                      </div>
                    )}

                    {selectedCandidate.convertedEmployeeId ? (
                      <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                        <h5 style={{ margin: '0 0 0.35rem 0', color: '#1e40af' }}>✓ Onboarded to Workforce</h5>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#1d4ed8' }}>
                          Employee ID: <strong>{selectedCandidate.convertedEmployeeId}</strong> &middot; Status: <strong>Hired</strong>
                        </p>
                      </div>
                    ) : (
                      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        {['Selected', 'Offer', 'Final / HR Round'].includes(selectedCandidate.stage) && (
                          <button
                            type="button"
                            className="rec-btn-sm convert"
                            style={{ padding: '0.5rem 1rem' }}
                            onClick={() => setShowConvertModal(true)}
                          >
                            Convert to Active Employee
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="hr-modal-footer">
                <button type="button" className="hr-btn-secondary" onClick={() => setShowProfileModal(false)}>Close</button>
                <button type="button" className="rec-btn-sm move" onClick={() => handleOpenMoveStage(selectedCandidate)}>Move Stage</button>
                {selectedCandidate.stage !== 'Shortlisted' && selectedCandidate.stage !== 'Hired' && (
                  <button type="button" className="rec-btn-sm shortlist" onClick={() => handleShortlist(selectedCandidate._id)}>Shortlist</button>
                )}
                {!selectedCandidate.convertedEmployeeId && selectedCandidate.status !== 'Hired' && (
                  <button type="button" className="rec-btn-sm convert" onClick={() => setShowConvertModal(true)}>Hire / Onboard</button>
                )}
                {selectedCandidate.stage !== 'Rejected' && (
                  <button type="button" className="rec-btn-sm reject" onClick={() => handleOpenRejection(selectedCandidate)}>Reject</button>
                )}
                {selectedCandidate.stage !== 'Withdrawn' && (
                  <button type="button" className="rec-btn-sm reject" style={{ background: '#f8fafc', color: '#64748b' }} onClick={() => handleOpenWithdrawal(selectedCandidate)}>Withdraw</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Screening Assessment Modal */}
        {showScreeningModal && selectedCandidate && (
          <div className="hr-modal-overlay" onClick={() => setShowScreeningModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
              <div className="hr-modal-header">
                <h3>Candidate Screening: {selectedCandidate.name}</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowScreeningModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleSaveScreening}>
                <div className="hr-modal-body">
                  <div style={{ marginBottom: '1rem' }}>
                    <div className="rec-rating-row">
                      <label>Skills Match</label>
                      <div className="rec-rating-group">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            type="button"
                            className={`rec-rating-btn ${screeningForm.skillsMatch === num ? 'active' : ''}`}
                            onClick={() => setScreeningForm({ ...screeningForm, skillsMatch: num })}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="rec-rating-row">
                      <label>Experience Match</label>
                      <div className="rec-rating-group">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            type="button"
                            className={`rec-rating-btn ${screeningForm.experienceMatch === num ? 'active' : ''}`}
                            onClick={() => setScreeningForm({ ...screeningForm, experienceMatch: num })}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="rec-rating-row">
                      <label>Communication Assessment</label>
                      <div className="rec-rating-group">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            type="button"
                            className={`rec-rating-btn ${screeningForm.communication === num ? 'active' : ''}`}
                            onClick={() => setScreeningForm({ ...screeningForm, communication: num })}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="rec-rating-row">
                      <label>Overall Candidate Fit</label>
                      <div className="rec-rating-group">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            type="button"
                            className={`rec-rating-btn ${screeningForm.assessmentScore === num ? 'active' : ''}`}
                            onClick={() => setScreeningForm({ ...screeningForm, assessmentScore: num })}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="hr-form-grid">
                    <div className="hr-form-group">
                      <label>Recruiter Name *</label>
                      <input
                        type="text"
                        required
                        value={screeningForm.recruiter}
                        onChange={(e) => setScreeningForm({ ...screeningForm, recruiter: e.target.value })}
                      />
                    </div>
                    <div className="hr-form-group">
                      <label>Screening Decision *</label>
                      <select
                        required
                        value={screeningForm.decision}
                        onChange={(e) => setScreeningForm({ ...screeningForm, decision: e.target.value })}
                      >
                        <option value="Pass">Pass → Advance to Shortlisted</option>
                        <option value="Hold">Hold → Keep in Screening</option>
                        <option value="Fail">Fail → Move to Rejected</option>
                      </select>
                    </div>
                    <div className="hr-form-group full-width">
                      <label>Screening Notes &amp; Observations</label>
                      <textarea
                        rows={3}
                        placeholder="Candidate communication skills, salary discussion, notice period verification..."
                        value={screeningForm.notes}
                        onChange={(e) => setScreeningForm({ ...screeningForm, notes: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowScreeningModal(false)}>Cancel</button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save Screening Assessment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Rejection Modal */}
        {showRejectionModal && selectedCandidate && (
          <div className="hr-modal-overlay" onClick={() => setShowRejectionModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
              <div className="hr-modal-header">
                <h3>Reject Candidate: {selectedCandidate.name}</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowRejectionModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleSaveRejection}>
                <div className="hr-modal-body">
                  <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    Record structured rejection data and persist the reason to MongoDB Atlas.
                  </p>
                  <div className="hr-form-grid">
                    <div className="hr-form-group full-width">
                      <label>Rejection Reason *</label>
                      <select
                        required
                        value={rejectionForm.reason}
                        onChange={(e) => setRejectionForm({ ...rejectionForm, reason: e.target.value })}
                      >
                        <option>Skills mismatch</option>
                        <option>Experience mismatch</option>
                        <option>Salary mismatch</option>
                        <option>Interview failed</option>
                        <option>Position filled</option>
                        <option>Candidate not suitable</option>
                        <option>Candidate withdrew</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div className="hr-form-group full-width">
                      <label>Rejection Notes</label>
                      <textarea
                        rows={3}
                        placeholder="Detailed explanation for audit log..."
                        value={rejectionForm.notes}
                        onChange={(e) => setRejectionForm({ ...rejectionForm, notes: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowRejectionModal(false)}>Cancel</button>
                  <button type="submit" className="rec-btn-sm reject" style={{ padding: '0.5rem 1rem' }} disabled={submitting}>
                    {submitting ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Withdrawal Modal */}
        {showWithdrawalModal && selectedCandidate && (
          <div className="hr-modal-overlay" onClick={() => setShowWithdrawalModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
              <div className="hr-modal-header">
                <h3>Candidate Withdrawal: {selectedCandidate.name}</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowWithdrawalModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleSaveWithdrawal}>
                <div className="hr-modal-body">
                  <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    Record that the candidate has voluntarily withdrawn from the hiring process.
                  </p>
                  <div className="hr-form-grid">
                    <div className="hr-form-group full-width">
                      <label>Withdrawal Reason *</label>
                      <select
                        required
                        value={withdrawalForm.reason}
                        onChange={(e) => setWithdrawalForm({ ...withdrawalForm, reason: e.target.value })}
                      >
                        <option>Accepted another offer</option>
                        <option>Compensation expectations</option>
                        <option>Relocation / Location mismatch</option>
                        <option>Personal reasons</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div className="hr-form-group full-width">
                      <label>Withdrawal Notes</label>
                      <textarea
                        rows={3}
                        placeholder="Additional details regarding withdrawal..."
                        value={withdrawalForm.notes}
                        onChange={(e) => setWithdrawalForm({ ...withdrawalForm, notes: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowWithdrawalModal(false)}>Cancel</button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Recording...' : 'Record Withdrawal'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Technical Assessment Modal */}
        {showAssessmentModal && selectedCandidate && (
          <div className="hr-modal-overlay" onClick={() => setShowAssessmentModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
              <div className="hr-modal-header">
                <h3>Technical Assessment: {selectedCandidate.name}</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowAssessmentModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleSaveAssessment}>
                <div className="hr-modal-body">
                  <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    Record structured skill assessment results. Passing automatically advances the candidate to the Interview round.
                  </p>
                  <div className="hr-form-grid">
                    <div className="hr-form-group full-width">
                      <label>Assessment / Test Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. React & Node.js Coding Challenge"
                        value={assessmentForm.name}
                        onChange={(e) => setAssessmentForm({ ...assessmentForm, name: e.target.value })}
                      />
                    </div>
                    <div className="hr-form-group">
                      <label>Score Achieved *</label>
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        required
                        value={assessmentForm.score}
                        onChange={(e) => setAssessmentForm({ ...assessmentForm, score: e.target.value })}
                      />
                    </div>
                    <div className="hr-form-group">
                      <label>Maximum Score *</label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        required
                        value={assessmentForm.maxScore}
                        onChange={(e) => setAssessmentForm({ ...assessmentForm, maxScore: e.target.value })}
                      />
                    </div>
                    <div className="hr-form-group">
                      <label>Result / Outcome *</label>
                      <select
                        required
                        value={assessmentForm.result}
                        onChange={(e) => setAssessmentForm({ ...assessmentForm, result: e.target.value })}
                      >
                        <option value="Passed">Passed → Advance to Interview</option>
                        <option value="Pending">Pending → In Review</option>
                        <option value="In Review">In Review</option>
                        <option value="Failed">Failed → Move to Rejected</option>
                      </select>
                    </div>
                    <div className="hr-form-group">
                      <label>Evaluator / Reviewer</label>
                      <input
                        type="text"
                        placeholder="e.g. Tech Lead / Senior Architect"
                        value={assessmentForm.evaluator}
                        onChange={(e) => setAssessmentForm({ ...assessmentForm, evaluator: e.target.value })}
                      />
                    </div>
                    <div className="hr-form-group full-width">
                      <label>Due Date / Target Date</label>
                      <input
                        type="date"
                        value={assessmentForm.dueDate}
                        onChange={(e) => setAssessmentForm({ ...assessmentForm, dueDate: e.target.value })}
                      />
                    </div>
                    <div className="hr-form-group full-width">
                      <label>Feedback &amp; Code Review Notes</label>
                      <textarea
                        rows={3}
                        placeholder="Detailed technical feedback, architecture understanding, problem-solving ability..."
                        value={assessmentForm.feedback}
                        onChange={(e) => setAssessmentForm({ ...assessmentForm, feedback: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowAssessmentModal(false)}>Cancel</button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save Assessment Result'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Move Stage Modal */}
        {showMoveStageModal && selectedCandidate && (() => {
          const currentNorm = selectedCandidate.stage === 'HR Round' ? 'Final / HR Round' : selectedCandidate.stage;
          const allowedTargets = VALID_TRANSITIONS[currentNorm] || ALL_PIPELINE_STAGES;
          return (
            <div className="hr-modal-overlay" onClick={() => setShowMoveStageModal(false)}>
              <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="hr-modal-header">
                  <h3>Move Candidate: {selectedCandidate.name}</h3>
                  <button type="button" className="hr-modal-close" onClick={() => setShowMoveStageModal(false)}>&times;</button>
                </div>
                <form onSubmit={handleSaveMoveStage}>
                  <div className="hr-modal-body">
                    <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Current Stage:</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' }}>{currentNorm}</div>
                    </div>
                    <div className="hr-form-grid">
                      <div className="hr-form-group full-width">
                        <label>Select Target Stage *</label>
                        <select
                          required
                          value={moveStageForm.toStage}
                          onChange={(e) => setMoveStageForm({ ...moveStageForm, toStage: e.target.value })}
                        >
                          {allowedTargets.map((st) => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                          Displaying authorized recruitment progression targets for this candidate.
                        </span>
                      </div>
                      <div className="hr-form-group full-width">
                        <label>Reason / Justification *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Cleared technical interview round"
                          value={moveStageForm.reason}
                          onChange={(e) => setMoveStageForm({ ...moveStageForm, reason: e.target.value })}
                        />
                      </div>
                      <div className="hr-form-group full-width">
                        <label>Audit Notes</label>
                        <textarea
                          rows={2}
                          placeholder="Optional audit notes for candidate history..."
                          value={moveStageForm.notes}
                          onChange={(e) => setMoveStageForm({ ...moveStageForm, notes: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="hr-modal-footer">
                    <button type="button" className="hr-btn-secondary" onClick={() => setShowMoveStageModal(false)}>Cancel</button>
                    <button type="submit" className="hr-btn-primary" disabled={submitting}>
                      {submitting ? 'Moving...' : 'Move Stage'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

        {/* Schedule Interview Modal */}
        {showInterviewModal&&selectedCandidate&&(
          <div className="hr-modal-overlay" onClick={()=>setShowInterviewModal(false)}>
            <div className="hr-modal-card" onClick={e=>e.stopPropagation()} style={{maxWidth:'540px'}}>
              <div className="hr-modal-header"><h3>Schedule Interview: {selectedCandidate.name}</h3><button type="button" className="hr-modal-close" onClick={()=>setShowInterviewModal(false)}>&times;</button></div>
              <form onSubmit={handleSaveInterview}><div className="hr-modal-body"><div className="hr-form-grid">
                <div className="hr-form-group full-width"><label>Interview Round *</label><input type="text" required value={interviewForm.round} onChange={e=>setInterviewForm({...interviewForm,round:e.target.value})}/></div>
                <div className="hr-form-group"><label>Interviewer *</label><input type="text" required value={interviewForm.interviewer} onChange={e=>setInterviewForm({...interviewForm,interviewer:e.target.value})}/></div>
                <div className="hr-form-group"><label>Type</label><select value={interviewForm.type} onChange={e=>setInterviewForm({...interviewForm,type:e.target.value})}><option>Online Video</option><option>In-Person</option><option>Telephonic</option></select></div>
                <div className="hr-form-group"><label>Date *</label><input type="date" required value={interviewForm.date} onChange={e=>setInterviewForm({...interviewForm,date:e.target.value})}/></div>
                <div className="hr-form-group"><label>Time</label><input type="text" placeholder="02:30 PM" value={interviewForm.time} onChange={e=>setInterviewForm({...interviewForm,time:e.target.value})}/></div>
                <div className="hr-form-group full-width"><label>Meeting Link / Location</label><input type="text" value={interviewForm.meetingLink} onChange={e=>setInterviewForm({...interviewForm,meetingLink:e.target.value})}/></div>
              </div></div>
              <div className="hr-modal-footer"><button type="button" className="hr-btn-secondary" onClick={()=>setShowInterviewModal(false)}>Cancel</button><button type="submit" className="hr-btn-primary" disabled={submitting}>{submitting?'Scheduling...':'Schedule Interview'}</button></div>
              </form>
            </div>
          </div>
        )}

        {/* Interview Feedback Modal */}
        {showFeedbackModal&&selectedCandidate&&(
          <div className="hr-modal-overlay" onClick={()=>setShowFeedbackModal(false)}>
            <div className="hr-modal-card" onClick={e=>e.stopPropagation()} style={{maxWidth:'600px'}}>
              <div className="hr-modal-header"><h3>Submit Interview Feedback</h3><button type="button" className="hr-modal-close" onClick={()=>setShowFeedbackModal(false)}>&times;</button></div>
              <form onSubmit={handleSaveFeedback}><div className="hr-modal-body">
                <div className="perf-rating-grid">
                  {[{key:'technicalSkills',label:'Technical Competency'},{key:'communication',label:'Communication Skills'},{key:'problemSolving',label:'Problem Solving'},{key:'teamwork',label:'Cultural & Team Fit'},{key:'overallRating',label:'Overall Score'}].map(cat=><div key={cat.key} className="perf-rating-item"><div className="perf-rating-header"><span>{cat.label}</span><strong>{feedbackForm[cat.key]} / 5 &#9733;</strong></div><input type="range" min="1" max="5" step="1" className="perf-rating-slider" value={feedbackForm[cat.key]} onChange={e=>setFeedbackForm({...feedbackForm,[cat.key]:Number(e.target.value)})}/></div>)}
                </div>
                <div className="hr-form-grid">
                  <div className="hr-form-group full-width"><label>Hiring Recommendation *</label><select required value={feedbackForm.recommendation} onChange={e=>setFeedbackForm({...feedbackForm,recommendation:e.target.value})}><option>Strong Hire</option><option>Hire</option><option>Hold</option><option>Reject</option></select></div>
                  <div className="hr-form-group full-width"><label>Strengths &amp; Observations</label><textarea rows={2} value={feedbackForm.strengths} onChange={e=>setFeedbackForm({...feedbackForm,strengths:e.target.value})}/></div>
                  <div className="hr-form-group full-width"><label>Evaluation Comments</label><textarea rows={2} value={feedbackForm.comments} onChange={e=>setFeedbackForm({...feedbackForm,comments:e.target.value})}/></div>
                </div>
              </div>
              <div className="hr-modal-footer"><button type="button" className="hr-btn-secondary" onClick={()=>setShowFeedbackModal(false)}>Cancel</button><button type="submit" className="hr-btn-primary" disabled={submitting}>{submitting?'Submitting...':'Save Feedback'}</button></div>
              </form>
            </div>
          </div>
        )}

        {/* Convert to Employee Modal (from candidate profile) */}
        {showConvertModal&&selectedCandidate&&(
          <div className="hr-modal-overlay" onClick={()=>setShowConvertModal(false)}>
            <div className="hr-modal-card" onClick={e=>e.stopPropagation()} style={{maxWidth:'500px'}}>
              <div className="hr-modal-header"><h3>Onboard Candidate to Workforce</h3><button type="button" className="hr-modal-close" onClick={()=>setShowConvertModal(false)}>&times;</button></div>
              <div className="hr-modal-body"><div style={{textAlign:'center',padding:'1rem 0'}}><div style={{fontSize:'3rem',marginBottom:'0.5rem'}}>&#127881;</div><h4 style={{margin:'0 0 0.5rem 0',color:'#0f172a'}}>Convert {selectedCandidate.name} to Active Employee?</h4><p style={{color:'#64748b',fontSize:'0.875rem',lineHeight:'1.5'}}>This action will create an official employee record, generate an Employee ID, and mark their status as <strong>Hired</strong>.</p></div></div>
              <div className="hr-modal-footer"><button type="button" className="hr-btn-secondary" onClick={()=>setShowConvertModal(false)}>Cancel</button><button type="button" className="rec-btn-sm convert" style={{padding:'0.65rem 1.25rem',fontSize:'0.875rem'}} disabled={submitting} onClick={handleConvertEmployee}>{submitting?'Onboarding...':'Confirm & Convert'}</button></div>
            </div>
          </div>
        )}

        {/* ============= OFFER LETTER MODALS ============= */}

        {/* Create/Edit Offer Letter Modal */}
        {showOfferModal&&(
          <div className="hr-modal-overlay" style={{zIndex:1100}} onClick={()=>setShowOfferModal(false)}>
            <div className="hr-modal-card" onClick={e=>e.stopPropagation()} style={{maxWidth:'720px',zIndex:1101}}>
              <div className="hr-modal-header"><h3>{editingOffer?'Edit Offer: '+editingOffer.offerNumber:'Create New Offer Letter'}</h3><button type="button" className="hr-modal-close" onClick={()=>setShowOfferModal(false)}>&times;</button></div>
              {offerError&&<div style={{margin:'0 1.5rem',padding:'0.65rem 1rem',background:'#FEE2E2',color:'#B91C1C',borderRadius:'8px',fontSize:'0.85rem'}}>{offerError}</div>}
              <form onSubmit={handleSaveOffer}><div className="hr-modal-body"><div className="hr-form-grid">

                {/* Candidate selector + EXACTLY ONE contextual + Add New Candidate */}
                <div className="hr-form-group full-width"><label>Candidate *</label>
                  <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
                    <select
                      required
                      value={offerForm.candidateId || selectedCandidateId}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        setSelectedCandidateId(selectedId);
                        const c = candidates.find((x) => String(x._id) === String(selectedId));
                        setOfferForm((prev) => ({
                          ...prev,
                          candidateId: selectedId,
                          offeredDesignation: (prev.offeredDesignation && prev.offeredDesignation.trim())
                            ? prev.offeredDesignation
                            : (c?.appliedPosition || ''),
                          department: (prev.department && prev.department !== 'Tech')
                            ? prev.department
                            : (c?.department || prev.department || 'Tech'),
                        }));
                      }}
                      style={{flex:1}}
                    >
                      <option value="">-- Select Candidate --</option>
                      {candidatesLoading ? (
                        <option disabled value="">Loading candidates...</option>
                      ) : candidatesError ? (
                        <option disabled value="">Error: {candidatesError}</option>
                      ) : candidates.length === 0 ? (
                        <option disabled value="">No candidates found. Use + Add New Candidate</option>
                      ) : (
                        candidates.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name} — {c.appliedPosition || ''}
                          </option>
                        ))
                      )}
                    </select>
                    {/* EXACTLY ONE CONTEXTUAL button — does NOT close/affect offer modal */}
                    <button
                      type="button"
                      className="rec-secondary-btn"
                      style={{whiteSpace:'nowrap',fontSize:'0.8rem',flexShrink:0}}
                      onClick={handleOpenOfferNewCandidate}
                    >
                      + Add New Candidate
                    </button>
                  </div>
                  {candidatesError && (
                    <span style={{fontSize:'0.78rem',color:'#dc2626',marginTop:'0.25rem',display:'block'}}>
                      {candidatesError}
                    </span>
                  )}
                  {(offerForm.candidateId || selectedCandidateId) && (() => {
                    const currentId = offerForm.candidateId || selectedCandidateId;
                    const c = candidates.find((x) => String(x._id) === String(currentId));
                    return c ? (
                      <span style={{fontSize:'0.78rem',color:'#64748b',marginTop:'0.25rem',display:'block'}}>
                        {c.email} &middot; {c.phone} {c.location ? `· ${c.location}` : ''}
                      </span>
                    ) : null;
                  })()}
                </div>

                <div className="hr-form-group"><label>Offered Designation *</label><input type="text" required placeholder="e.g. Software Engineer" value={offerForm.offeredDesignation} onChange={e=>setOfferForm({...offerForm,offeredDesignation:e.target.value})}/></div>
                <div className="hr-form-group"><label>Department *</label><select required value={offerForm.department} onChange={e=>setOfferForm({...offerForm,department:e.target.value})}>{OFFICIAL_DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}</select></div>
                <div className="hr-form-group"><label>Employment Type</label><select value={offerForm.employmentType} onChange={e=>setOfferForm({...offerForm,employmentType:e.target.value})}><option>Full Time</option><option>Part Time</option><option>Contract</option><option>Intern</option></select></div>
                <div className="hr-form-group"><label>Salary / CTC (Annual) *</label><input type="text" required placeholder="e.g. 7,50,000 / yr" value={offerForm.salary} onChange={e=>setOfferForm({...offerForm,salary:e.target.value})}/></div>
                <div className="hr-form-group"><label>Offer Date</label><input type="date" value={offerForm.offerDate} onChange={e=>setOfferForm({...offerForm,offerDate:e.target.value})}/></div>
                <div className="hr-form-group"><label>Joining Date</label><input type="date" value={offerForm.joiningDate} onChange={e=>setOfferForm({...offerForm,joiningDate:e.target.value})}/></div>
                <div className="hr-form-group"><label>Offer Expiry Date</label><input type="date" value={offerForm.expiresAt} onChange={e=>setOfferForm({...offerForm,expiresAt:e.target.value})}/></div>
                <div className="hr-form-group"><label>Probation Period</label><input type="text" placeholder="6 Months" value={offerForm.probationPeriod} onChange={e=>setOfferForm({...offerForm,probationPeriod:e.target.value})}/></div>
                <div className="hr-form-group"><label>Work Location</label><input type="text" placeholder="Mumbai / Remote / Hybrid" value={offerForm.workLocation} onChange={e=>setOfferForm({...offerForm,workLocation:e.target.value})}/></div>
                <div className="hr-form-group"><label>Reporting Manager</label><input type="text" placeholder="e.g. Priya Sharma" value={offerForm.reportingManager} onChange={e=>setOfferForm({...offerForm,reportingManager:e.target.value})}/></div>
                <div className="hr-form-group"><label>Working Hours</label><input type="text" placeholder="9:00 AM - 6:00 PM" value={offerForm.workingHours} onChange={e=>setOfferForm({...offerForm,workingHours:e.target.value})}/></div>
                <div className="hr-form-group"><label>Notice Period</label><input type="text" placeholder="30 Days" value={offerForm.noticePeriod} onChange={e=>setOfferForm({...offerForm,noticePeriod:e.target.value})}/></div>
                <div className="hr-form-group full-width"><label>Terms &amp; Conditions</label><textarea rows={3} placeholder="Employment terms, confidentiality clause, etc." value={offerForm.termsAndConditions} onChange={e=>setOfferForm({...offerForm,termsAndConditions:e.target.value})}/></div>
                <div className="hr-form-group full-width"><label>Additional Notes</label><textarea rows={2} value={offerForm.additionalNotes} onChange={e=>setOfferForm({...offerForm,additionalNotes:e.target.value})}/></div>
              </div></div>
              <div className="hr-modal-footer"><button type="button" className="hr-btn-secondary" onClick={()=>setShowOfferModal(false)}>Cancel</button><button type="submit" className="hr-btn-primary" disabled={offerSubmitting}>{offerSubmitting?'Saving...':editingOffer?'Update Offer':'Save as Draft'}</button></div>
              </form>
            </div>
          </div>
        )}

        {/* Contextual Add New Candidate Modal (z-index above offer modal) — offer modal stays alive */}
        {showOfferNewCandidateModal && (
          <div className="hr-modal-overlay" style={{ zIndex: 1200 }} onClick={(e) => { e.stopPropagation(); setOfferNewCandidateError(''); setShowOfferNewCandidateModal(false); }}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', zIndex: 1201 }}>
              <div className="hr-modal-header">
                <h3>Add New Candidate</h3>
                <button type="button" className="hr-modal-close" onClick={() => { setOfferNewCandidateError(''); setShowOfferNewCandidateModal(false); }}>&times;</button>
              </div>
              {offerNewCandidateError && <div className="rec-form-error" style={{ margin: '0 1.5rem 0.5rem' }}><span>⚠️</span><span>{offerNewCandidateError}</span></div>}
              <form onSubmit={handleSaveOfferNewCandidate}>
                <div className="hr-modal-body">
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '6px', borderLeft: '3px solid #ea580c' }}>
                    After saving, this candidate will be registered in MongoDB and automatically selected in the Offer Letter form above.
                  </div>
                  <div className="hr-form-grid">
                    <div className="hr-form-group"><label>Candidate Name *</label><input type="text" required placeholder="Full Name" value={offerNewCandidateForm.name} onChange={(e) => setOfferNewCandidateForm({ ...offerNewCandidateForm, name: e.target.value })} /></div>
                    <div className="hr-form-group"><label>Email *</label><input type="email" required placeholder="candidate@example.com" value={offerNewCandidateForm.email} onChange={(e) => setOfferNewCandidateForm({ ...offerNewCandidateForm, email: e.target.value })} /></div>
                    <div className="hr-form-group"><label>Phone *</label><input type="tel" required placeholder="+91 9876543210" value={offerNewCandidateForm.phone} onChange={(e) => setOfferNewCandidateForm({ ...offerNewCandidateForm, phone: e.target.value })} /></div>
                    <div className="hr-form-group"><label>Department *</label><select required value={offerNewCandidateForm.department} onChange={(e) => setOfferNewCandidateForm({ ...offerNewCandidateForm, department: e.target.value })}>{OFFICIAL_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
                    <div className="hr-form-group"><label>Applied Position *</label><input type="text" required placeholder="e.g. Software Engineer" value={offerNewCandidateForm.appliedPosition} onChange={(e) => setOfferNewCandidateForm({ ...offerNewCandidateForm, appliedPosition: e.target.value })} /></div>
                    <div className="hr-form-group"><label>Experience</label><input type="text" placeholder="e.g. 2 Years" value={offerNewCandidateForm.experience} onChange={(e) => setOfferNewCandidateForm({ ...offerNewCandidateForm, experience: e.target.value })} /></div>
                    <div className="hr-form-group full-width"><label>Key Skills</label><input type="text" placeholder="React, Node.js, MongoDB..." value={offerNewCandidateForm.skills} onChange={(e) => setOfferNewCandidateForm({ ...offerNewCandidateForm, skills: e.target.value })} /></div>
                    <div className="hr-form-group"><label>Notice Period</label><input type="text" placeholder="30 Days" value={offerNewCandidateForm.noticePeriod} onChange={(e) => setOfferNewCandidateForm({ ...offerNewCandidateForm, noticePeriod: e.target.value })} /></div>
                    <div className="hr-form-group"><label>Current Company</label><input type="text" placeholder="Previous Employer" value={offerNewCandidateForm.currentCompany} onChange={(e) => setOfferNewCandidateForm({ ...offerNewCandidateForm, currentCompany: e.target.value })} /></div>
                    <div className="hr-form-group"><label>Location</label><input type="text" placeholder="City / State" value={offerNewCandidateForm.location} onChange={(e) => setOfferNewCandidateForm({ ...offerNewCandidateForm, location: e.target.value })} /></div>
                  </div>
                </div>
                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => { setOfferNewCandidateError(''); setShowOfferNewCandidateModal(false); }}>Cancel</button>
                  <button type="submit" className="hr-btn-primary" disabled={offerNewCandidateSubmitting}>{offerNewCandidateSubmitting ? 'Creating in MongoDB...' : 'Save & Select Candidate'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Preview Offer Letter Modal */}
        {showOfferPreviewModal && viewingOffer && (
          <div className="hr-modal-overlay" style={{ zIndex: 1100 }} onClick={() => setShowOfferPreviewModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '820px', zIndex: 1101, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
              <div className="hr-modal-header" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <img src="/aasha-logo-new.jpg" alt="AASHA SM" style={{ height: '32px', objectFit: 'contain' }} />
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0, color: '#0f172a' }}>
                      Offer Letter &mdash; {viewingOffer.offerNumber}
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>AASHA SM TECHNOLOGIES PRIVATE LIMITED</span>
                  </div>
                </div>
                <button type="button" className="hr-modal-close" onClick={() => setShowOfferPreviewModal(false)}>&times;</button>
              </div>

              <div className="hr-modal-body" style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
                <div className="offer-preview-paper" style={{ background: '#fff', borderRadius: '12px', padding: '2.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', maxWidth: '750px', margin: '0 auto' }}>
                  
                  {/* Corporate Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #ea580c', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <img src="/aasha-logo-new.jpg" alt="AASHA SM TECHNOLOGIES" style={{ height: '48px', objectFit: 'contain' }} />
                      <div>
                        <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.01em' }}>AASHA SM TECHNOLOGIES PRIVATE LIMITED</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Corporate HR &amp; Talent Acquisition · IT Services &amp; Consulting</div>
                      </div>
                    </div>
                    <span className="rec-badge" style={{ background: '#ffedd5', color: '#c2410c', fontWeight: '700', fontSize: '0.75rem', padding: '0.35rem 0.75rem', letterSpacing: '0.05em' }}>OFFER LETTER</span>
                  </div>

                  {/* Meta Details Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: '8px', border: '1px solid #f1f5f9', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '700', display: 'block', marginBottom: '0.25rem' }}>To (Candidate)</span>
                      <strong style={{ fontSize: '1rem', color: '#0f172a', display: 'block' }}>{viewingOffer.candidate?.name || 'Candidate'}</strong>
                      <div style={{ color: '#475569', fontSize: '0.82rem', marginTop: '0.2rem' }}>{viewingOffer.candidate?.email || '—'}</div>
                      <div style={{ color: '#475569', fontSize: '0.82rem' }}>{viewingOffer.candidate?.phone || ''}</div>
                      {viewingOffer.candidate?.location && <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{viewingOffer.candidate.location}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ marginBottom: '0.35rem' }}><span style={{ color: '#64748b', fontSize: '0.8rem' }}>Offer Number: </span><strong style={{ color: '#0f172a' }}>{viewingOffer.offerNumber}</strong></div>
                      <div style={{ marginBottom: '0.35rem' }}><span style={{ color: '#64748b', fontSize: '0.8rem' }}>Offer Date: </span><span style={{ fontWeight: '600', color: '#0f172a' }}>{formatDate(viewingOffer.offerDate)}</span></div>
                      {viewingOffer.expiresAt && <div><span style={{ color: '#64748b', fontSize: '0.8rem' }}>Valid Until: </span><span style={{ fontWeight: '600', color: '#ea580c' }}>{formatDate(viewingOffer.expiresAt)}</span></div>}
                    </div>
                  </div>

                  {/* Subject */}
                  <div style={{ fontSize: '0.92rem', fontWeight: '700', color: '#ea580c', marginBottom: '0.75rem' }}>
                    Sub: Formal Employment Offer for the position of &ldquo;{viewingOffer.offeredDesignation}&rdquo;
                  </div>

                  {/* Salutation & Intro */}
                  <div style={{ fontSize: '0.9rem', color: '#0f172a', marginBottom: '0.5rem' }}>
                    Dear <strong>{viewingOffer.candidate?.name || 'Candidate'}</strong>,
                  </div>
                  <p style={{ fontSize: '0.85rem', lineHeight: '1.6', color: '#334155', margin: '0 0 1.25rem' }}>
                    We are pleased to extend this formal offer of employment to you on behalf of <strong>AASHA SM TECHNOLOGIES PRIVATE LIMITED</strong>. Following our evaluation and interview discussions, we are confident that your background and capabilities will make a significant contribution to our organization.
                  </p>

                  {/* Employment Details Grid */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                      Key Employment Details
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem 1.5rem', fontSize: '0.84rem' }}>
                      <div><span style={{ color: '#64748b' }}>Offered Designation: </span><strong style={{ color: '#0f172a' }}>{viewingOffer.offeredDesignation || '—'}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Department: </span><strong style={{ color: '#0f172a' }}>{viewingOffer.department || '—'}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Employment Type: </span><strong style={{ color: '#0f172a' }}>{viewingOffer.employmentType || 'Full Time'}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Annual CTC / Salary: </span><strong style={{ color: '#16a34a' }}>{viewingOffer.salary || 'Competitive'}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Date of Joining: </span><strong style={{ color: '#0f172a' }}>{formatDate(viewingOffer.joiningDate)}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Work Location: </span><strong style={{ color: '#0f172a' }}>{viewingOffer.workLocation || 'Office / Hybrid'}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Probation Period: </span><strong style={{ color: '#0f172a' }}>{viewingOffer.probationPeriod || '6 Months'}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Reporting Manager: </span><strong style={{ color: '#0f172a' }}>{viewingOffer.reportingManager || 'Management'}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Working Hours: </span><strong style={{ color: '#0f172a' }}>{viewingOffer.workingHours || '9:00 AM - 6:00 PM (Mon-Sat)'}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Notice Period: </span><strong style={{ color: '#0f172a' }}>{viewingOffer.noticePeriod || '30 Days'}</strong></div>
                    </div>
                  </div>

                  {/* Terms & Conditions */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                      Terms &amp; Conditions
                    </div>
                    <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', lineHeight: '1.6', color: '#475569' }}>
                      <li><strong>Acceptance of Offer:</strong> Please sign and return a duplicate copy of this letter on or before {viewingOffer.expiresAt ? formatDate(viewingOffer.expiresAt) : 'the validity date'} to signify your acceptance.</li>
                      <li><strong>Probation &amp; Confirmation:</strong> You will serve a probation of {viewingOffer.probationPeriod || '6 Months'}. Upon successful completion and performance review, employment will be confirmed in writing.</li>
                      <li><strong>Confidentiality &amp; IP:</strong> You shall strictly protect all proprietary software, client data, intellectual property, and trade secrets of AASHA SM Technologies.</li>
                      <li><strong>Notice Period:</strong> Either party may initiate separation by serving {viewingOffer.noticePeriod || '30 Days'} notice or basic salary equivalent in lieu of notice.</li>
                      {viewingOffer.termsAndConditions && <li>{viewingOffer.termsAndConditions}</li>}
                    </ol>
                  </div>

                  {/* Additional Notes */}
                  {viewingOffer.additionalNotes && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#92400e' }}>
                      <strong>Additional Notes:</strong> {viewingOffer.additionalNotes}
                    </div>
                  )}

                  {/* Closing & Sign-off */}
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '0.85rem' }}>
                    <div>
                      <p style={{ margin: '0 0 0.25rem', color: '#475569' }}>Warm regards,</p>
                      <strong style={{ display: 'block', color: '#0f172a' }}>Human Resources &amp; Talent Acquisition</strong>
                      <span style={{ color: '#ea580c', fontWeight: '700', fontSize: '0.82rem' }}>AASHA SM TECHNOLOGIES PRIVATE LIMITED</span>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#94a3b8' }}>
                      Confidential · Authorized Document
                    </div>
                  </div>

                </div>
              </div>

              <div className="hr-modal-footer" style={{ position: 'sticky', bottom: 0, zIndex: 10, background: '#fff', borderTop: '1px solid #e2e8f0', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="hr-btn-secondary" onClick={() => setShowOfferPreviewModal(false)}>Close</button>
                <button type="button" className="rec-primary-btn" onClick={() => handleDownloadPDF(viewingOffer)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '15px', height: '15px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Send Offer Confirmation Modal */}
        {showOfferSendModal&&viewingOffer&&(
          <div className="hr-modal-overlay" style={{zIndex:1100}} onClick={()=>setShowOfferSendModal(false)}>
            <div className="hr-modal-card" onClick={e=>e.stopPropagation()} style={{maxWidth:'480px',zIndex:1101}}>
              <div className="hr-modal-header"><h3>Send Offer Letter</h3><button type="button" className="hr-modal-close" onClick={()=>setShowOfferSendModal(false)}>&times;</button></div>
              <div className="hr-modal-body">
                <div style={{background:'#f8fafc',padding:'1.25rem',borderRadius:'10px',border:'1px solid #e2e8f0'}}>
                  <p style={{margin:'0 0 0.5rem',fontSize:'0.9rem',color:'#374151'}}>You are about to send offer letter <strong>{viewingOffer.offerNumber}</strong> to:</p>
                  <div style={{margin:'0.75rem 0',padding:'0.75rem',background:'#fff',borderRadius:'8px',border:'1px solid #e2e8f0'}}><div style={{fontWeight:'700',color:'#0f172a'}}>{viewingOffer.candidate?.name||'—'}</div><div style={{fontSize:'0.85rem',color:'#64748b'}}>{viewingOffer.candidate?.email||'No email on record'}</div></div>
                  {!viewingOffer.candidate?.email&&<div style={{color:'#dc2626',fontSize:'0.85rem',marginTop:'0.5rem'}}>&#9888;&#65039; No email address found. Cannot send offer.</div>}
                  <p style={{margin:'0.5rem 0 0',fontSize:'0.82rem',color:'#64748b'}}>Note: Status will only change to "Sent" if SMTP email delivery succeeds.</p>
                </div>
              </div>
              <div className="hr-modal-footer"><button type="button" className="hr-btn-secondary" onClick={()=>setShowOfferSendModal(false)}>Cancel</button><button type="button" className="hr-btn-primary" disabled={offerSubmitting||!viewingOffer.candidate?.email} onClick={handleSendOffer}>{offerSubmitting?'Sending...':'Send Offer Letter'}</button></div>
            </div>
          </div>
        )}

        {/* Delete Offer Confirmation */}
        {showOfferDeleteModal&&viewingOffer&&(
          <div className="hr-modal-overlay" style={{zIndex:1100}} onClick={()=>setShowOfferDeleteModal(false)}>
            <div className="hr-modal-card" onClick={e=>e.stopPropagation()} style={{maxWidth:'440px',zIndex:1101}}>
              <div className="hr-modal-header"><h3>Delete Offer Letter</h3><button type="button" className="hr-modal-close" onClick={()=>setShowOfferDeleteModal(false)}>&times;</button></div>
              <div className="hr-modal-body"><div style={{textAlign:'center',padding:'0.5rem 0'}}><div style={{fontSize:'2.5rem',marginBottom:'0.5rem'}}>&#128465;&#65039;</div><h4 style={{margin:'0 0 0.5rem',color:'#0f172a'}}>Delete {viewingOffer.offerNumber}?</h4><p style={{color:'#64748b',fontSize:'0.875rem'}}>This will remove the offer letter for <strong>{viewingOffer.candidate?.name}</strong>. This cannot be undone.</p></div></div>
              <div className="hr-modal-footer"><button type="button" className="hr-btn-secondary" onClick={()=>setShowOfferDeleteModal(false)}>Cancel</button><button type="button" className="rec-btn-sm reject" style={{padding:'0.65rem 1.25rem',fontSize:'0.875rem'}} disabled={offerSubmitting} onClick={handleDeleteOffer}>{offerSubmitting?'Deleting...':'Yes, Delete'}</button></div>
            </div>
          </div>
        )}

        {/* Convert From Offer Modal */}
        {showOfferConvertModal&&viewingOffer&&(
          <div className="hr-modal-overlay" style={{zIndex:1100}} onClick={()=>setShowOfferConvertModal(false)}>
            <div className="hr-modal-card" onClick={e=>e.stopPropagation()} style={{maxWidth:'520px',zIndex:1101}}>
              <div className="hr-modal-header"><h3>Convert to Employee</h3><button type="button" className="hr-modal-close" onClick={()=>setShowOfferConvertModal(false)}>&times;</button></div>
              <div className="hr-modal-body">
                <div style={{textAlign:'center',padding:'0.75rem 0'}}><div style={{fontSize:'2.5rem',marginBottom:'0.5rem'}}>&#127881;</div><h4 style={{margin:'0 0 0.5rem',color:'#0f172a'}}>Onboard as Employee?</h4></div>
                <div style={{background:'#f8fafc',padding:'1rem',borderRadius:'10px',border:'1px solid #e2e8f0'}}>
                  {[['Offer No',viewingOffer.offerNumber],['Candidate',viewingOffer.candidate?.name],['Email',viewingOffer.candidate?.email],['Designation',viewingOffer.offeredDesignation],['Department',viewingOffer.department],['Salary',viewingOffer.salary],['Joining Date',formatDate(viewingOffer.joiningDate)],['Employment Type',viewingOffer.employmentType]].map(([l,v])=>(
                    <div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:'0.85rem',padding:'0.3rem 0',borderBottom:'1px solid #e2e8f0'}}><span style={{color:'#64748b'}}>{l}</span><strong style={{color:'#0f172a'}}>{v||'—'}</strong></div>
                  ))}
                </div>
                <p style={{color:'#64748b',fontSize:'0.82rem',marginTop:'0.75rem'}}>This will create an employee record, generate an Employee ID, and link the candidate.</p>
              </div>
              <div className="hr-modal-footer"><button type="button" className="hr-btn-secondary" onClick={()=>setShowOfferConvertModal(false)}>Cancel</button><button type="button" className="rec-btn-sm convert" style={{padding:'0.65rem 1.25rem',fontSize:'0.875rem'}} disabled={offerSubmitting} onClick={handleConvertFromOffer}>{offerSubmitting?'Converting...':'Confirm & Onboard Employee'}</button></div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* EXPERIENCE LETTER GENERATE / EDIT MODAL */}
        {/* ========================================================= */}
        {showExperienceModal && (
          <div className="hr-modal-overlay" style={{ zIndex: 1100 }} onClick={() => setShowExperienceModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '740px', zIndex: 1101, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
              <div className="hr-modal-header" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <img src="/aasha-logo-new.jpg" alt="Aasha SM" style={{ height: '30px', objectFit: 'contain' }} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                      {editingExperienceLetter ? `Edit Experience Letter: ${editingExperienceLetter.letterNumber}` : 'Generate Experience Letter'}
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>AASHA SM TECHNOLOGIES PRIVATE LIMITED</span>
                  </div>
                </div>
                <button type="button" className="hr-modal-close" onClick={() => setShowExperienceModal(false)}>&times;</button>
              </div>

              {experienceError && (
                <div style={{ margin: '0.75rem 1.5rem 0', padding: '0.65rem 1rem', background: '#FEE2E2', color: '#B91C1C', borderRadius: '8px', fontSize: '0.85rem' }}>
                  ⚠️ {experienceError}
                </div>
              )}

              <form onSubmit={handleSaveExperience} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <div className="hr-modal-body" style={{ overflowY: 'auto', flex: 1, padding: '1.25rem 1.5rem' }}>
                  <div className="hr-form-grid">

                    {/* Employee Selector (Real Data from Atlas) */}
                    <div className="hr-form-group full-width">
                      <label>Select Real Employee *</label>
                      <select
                        required
                        value={experienceForm.employeeId}
                        onChange={(e) => handleSelectEmployeeForExp(e.target.value)}
                        disabled={!!editingExperienceLetter}
                      >
                        <option value="">-- Choose Employee from Database --</option>
                        {hrEmployeesLoading ? (
                          <option disabled value="">Loading employees from database...</option>
                        ) : hrEmployees.length === 0 ? (
                          <option disabled value="">No employees found</option>
                        ) : (
                          hrEmployees.map((emp) => (
                            <option key={emp._id} value={emp._id}>
                              {emp.name} {emp.employeeId ? `(${emp.employeeId})` : ''} &mdash; {emp.designation || 'Staff'} ({emp.department || 'Tech'})
                            </option>
                          ))
                        )}
                      </select>
                      {experienceForm.employeeId && (
                        <div style={{ fontSize: '0.78rem', color: '#15803d', marginTop: '0.35rem', background: '#f0fdf4', padding: '0.4rem 0.65rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                          ✓ Employee verified from database. Pre-filled details loaded automatically.
                        </div>
                      )}
                    </div>

                    <div className="hr-form-group">
                      <label>Employee Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Full Name"
                        value={experienceForm.employeeName}
                        onChange={(e) => setExperienceForm({ ...experienceForm, employeeName: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Employee ID</label>
                      <input
                        type="text"
                        placeholder="e.g. EMP-10482"
                        value={experienceForm.empCode}
                        onChange={(e) => setExperienceForm({ ...experienceForm, empCode: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Designation *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Senior Full Stack Developer"
                        value={experienceForm.designation}
                        onChange={(e) => setExperienceForm({ ...experienceForm, designation: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Department *</label>
                      <select
                        required
                        value={experienceForm.department}
                        onChange={(e) => setExperienceForm({ ...experienceForm, department: e.target.value })}
                      >
                        {OFFICIAL_DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Date of Joining *</label>
                      <input
                        type="date"
                        required
                        value={experienceForm.joiningDate}
                        onChange={(e) => handleDateChangeForExp('joiningDate', e.target.value)}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Date of Relieving *</label>
                      <input
                        type="date"
                        required
                        value={experienceForm.relievingDate}
                        onChange={(e) => handleDateChangeForExp('relievingDate', e.target.value)}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Employment Duration (Calculated)</label>
                      <input
                        type="text"
                        placeholder="e.g. 2 Years, 4 Months"
                        value={experienceForm.employmentDuration}
                        onChange={(e) => setExperienceForm({ ...experienceForm, employmentDuration: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Letter Issue Date</label>
                      <input
                        type="date"
                        value={experienceForm.letterDate}
                        onChange={(e) => setExperienceForm({ ...experienceForm, letterDate: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Work Location</label>
                      <input
                        type="text"
                        placeholder="e.g. Mumbai / Head Office"
                        value={experienceForm.workLocation}
                        onChange={(e) => setExperienceForm({ ...experienceForm, workLocation: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Conduct &amp; Character</label>
                      <select
                        value={experienceForm.conduct}
                        onChange={(e) => setExperienceForm({ ...experienceForm, conduct: e.target.value })}
                      >
                        <option value="Exemplary">Exemplary</option>
                        <option value="Very Good">Very Good</option>
                        <option value="Good">Good</option>
                        <option value="Satisfactory">Satisfactory</option>
                      </select>
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Reason for Relieving</label>
                      <input
                        type="text"
                        placeholder="e.g. Resignation / Personal Aspirations / Higher Studies"
                        value={experienceForm.reasonForLeaving}
                        onChange={(e) => setExperienceForm({ ...experienceForm, reasonForLeaving: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Authorized Signatory</label>
                      <input
                        type="text"
                        placeholder="Authorized Signatory Name"
                        value={experienceForm.authorizedSignatory}
                        onChange={(e) => setExperienceForm({ ...experienceForm, authorizedSignatory: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Signatory Designation / Title</label>
                      <input
                        type="text"
                        placeholder="Head of Human Resources"
                        value={experienceForm.authorizedSignatoryTitle}
                        onChange={(e) => setExperienceForm({ ...experienceForm, authorizedSignatoryTitle: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Document Status</label>
                      <select
                        value={experienceForm.status}
                        onChange={(e) => setExperienceForm({ ...experienceForm, status: e.target.value })}
                      >
                        <option value="Issued">Issued</option>
                        <option value="Draft">Draft</option>
                        <option value="Revoked">Revoked</option>
                      </select>
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Internal HR Remarks / Notes</label>
                      <textarea
                        rows={2}
                        placeholder="Optional remarks, exit clearance status, notes..."
                        value={experienceForm.notes}
                        onChange={(e) => setExperienceForm({ ...experienceForm, notes: e.target.value })}
                      />
                    </div>

                  </div>
                </div>

                <div className="hr-modal-footer" style={{ position: 'sticky', bottom: 0, zIndex: 10, background: '#fff', borderTop: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}>
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowExperienceModal(false)}>Cancel</button>
                  <button type="submit" className="hr-btn-primary" disabled={experienceSubmitting}>
                    {experienceSubmitting ? 'Saving to Database...' : editingExperienceLetter ? 'Update Letter' : 'Generate Experience Letter'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* EXPERIENCE LETTER PREVIEW MODAL */}
        {/* ========================================================= */}
        {showExperiencePreviewModal && viewingExperienceLetter && (
          <div className="hr-modal-overlay" style={{ zIndex: 1100 }} onClick={() => setShowExperiencePreviewModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '820px', zIndex: 1101, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
              <div className="hr-modal-header" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <img src="/aasha-logo-new.jpg" alt="AASHA SM" style={{ height: '32px', objectFit: 'contain' }} />
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0, color: '#0f172a' }}>
                      Experience Letter &mdash; {viewingExperienceLetter.letterNumber}
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>AASHA SM TECHNOLOGIES PRIVATE LIMITED</span>
                  </div>
                </div>
                <button type="button" className="hr-modal-close" onClick={() => setShowExperiencePreviewModal(false)}>&times;</button>
              </div>

              <div className="hr-modal-body" style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
                <div className="offer-preview-paper" style={{ background: '#fff', borderRadius: '12px', padding: '2.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', maxWidth: '750px', margin: '0 auto' }}>
                  
                  {/* Corporate Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #ea580c', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <img src="/aasha-logo-new.jpg" alt="AASHA SM TECHNOLOGIES" style={{ height: '48px', objectFit: 'contain' }} />
                      <div>
                        <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.01em' }}>AASHA SM TECHNOLOGIES PRIVATE LIMITED</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Corporate HR &amp; People Operations · IT Services &amp; Consulting</div>
                      </div>
                    </div>
                    <span className="rec-badge" style={{ background: '#ffedd5', color: '#c2410c', fontWeight: '700', fontSize: '0.75rem', padding: '0.35rem 0.75rem', letterSpacing: '0.05em' }}>
                      EXPERIENCE CERTIFICATE
                    </span>
                  </div>

                  {/* Ref & Date */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Ref No: </span>
                      <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{viewingExperienceLetter.letterNumber}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Date: </span>
                      <strong style={{ color: '#0f172a' }}>{formatDate(viewingExperienceLetter.letterDate)}</strong>
                    </div>
                  </div>

                  {/* Centered Title */}
                  <div style={{ textAlign: 'center', margin: '1.75rem 0 1.5rem' }}>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#ea580c', letterSpacing: '0.04em', margin: 0, textTransform: 'uppercase', textDecoration: 'underline' }}>
                      TO WHOMSOEVER IT MAY CONCERN
                    </h2>
                  </div>

                  {/* Body Paragraphs */}
                  <div style={{ fontSize: '0.92rem', lineHeight: '1.75', color: '#334155' }}>
                    <p style={{ margin: '0 0 1rem' }}>
                      This is to certify that <strong>{viewingExperienceLetter.employeeName}</strong>
                      {viewingExperienceLetter.employeeId ? ` (Employee ID: ${viewingExperienceLetter.employeeId})` : ''} was in formal employment with <strong>AASHA SM TECHNOLOGIES PRIVATE LIMITED</strong> from <strong>{formatDate(viewingExperienceLetter.joiningDate)}</strong> to <strong>{formatDate(viewingExperienceLetter.relievingDate)}</strong>, serving a cumulative tenure of <strong>{viewingExperienceLetter.employmentDuration || computeDurationText(viewingExperienceLetter.joiningDate, viewingExperienceLetter.relievingDate)}</strong>.
                    </p>
                    <p style={{ margin: '0 0 1.25rem' }}>
                      During their tenure of employment, they rendered dedicated service in the role of <strong>{viewingExperienceLetter.designation}</strong> within the <strong>{viewingExperienceLetter.department}</strong> department at our <strong>{viewingExperienceLetter.workLocation || 'Mumbai'}</strong> facility.
                    </p>
                  </div>

                  {/* Key Details Summary Box */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                      Employment Certification Summary
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem 1.5rem', fontSize: '0.84rem' }}>
                      <div><span style={{ color: '#64748b' }}>Employee Name: </span><strong style={{ color: '#0f172a' }}>{viewingExperienceLetter.employeeName}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Employee ID: </span><strong style={{ color: '#0f172a' }}>{viewingExperienceLetter.employeeId || '—'}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Designation: </span><strong style={{ color: '#0f172a' }}>{viewingExperienceLetter.designation}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Department: </span><strong style={{ color: '#0f172a' }}>{viewingExperienceLetter.department}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Date of Joining: </span><strong style={{ color: '#0f172a' }}>{formatDate(viewingExperienceLetter.joiningDate)}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Date of Relieving: </span><strong style={{ color: '#0f172a' }}>{formatDate(viewingExperienceLetter.relievingDate)}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Total Duration: </span><strong style={{ color: '#16a34a' }}>{viewingExperienceLetter.employmentDuration || computeDurationText(viewingExperienceLetter.joiningDate, viewingExperienceLetter.relievingDate)}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Work Location: </span><strong style={{ color: '#0f172a' }}>{viewingExperienceLetter.workLocation || 'Head Office, Mumbai'}</strong></div>
                    </div>
                  </div>

                  {/* Conduct and Separation text */}
                  <div style={{ fontSize: '0.92rem', lineHeight: '1.75', color: '#334155' }}>
                    <p style={{ margin: '0 0 1rem' }}>
                      During their association with AASHA SM TECHNOLOGIES PRIVATE LIMITED, we found them to be sincere, diligent, and result-oriented in discharging their professional responsibilities. Their conduct, character, and professional demeanor were observed to be <strong>{viewingExperienceLetter.conduct?.toLowerCase() || 'exemplary'}</strong>.
                    </p>
                    <p style={{ margin: '0 0 1.5rem' }}>
                      They have been formally relieved from all duties upon {viewingExperienceLetter.reasonForLeaving?.toLowerCase() || 'resignation'}. All company clearances, assets, and accounts have been amicably and satisfactorily settled in full. We thank them for their contributions and wish them every success in all their future endeavors.
                    </p>
                  </div>

                  {/* Signatory Block */}
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '0.85rem' }}>
                    <div>
                      <p style={{ margin: '0 0 0.25rem', color: '#475569' }}>For <strong>AASHA SM TECHNOLOGIES PRIVATE LIMITED</strong></p>
                      <div style={{ height: '38px' }} />
                      <strong style={{ display: 'block', color: '#0f172a' }}>{viewingExperienceLetter.authorizedSignatory || 'Human Resources Manager'}</strong>
                      <span style={{ color: '#64748b', fontSize: '0.82rem' }}>{viewingExperienceLetter.authorizedSignatoryTitle || 'Head of Human Resources'}</span>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#94a3b8' }}>
                      Official Experience Certification · Confidential
                    </div>
                  </div>

                </div>
              </div>

              <div className="hr-modal-footer" style={{ position: 'sticky', bottom: 0, zIndex: 10, background: '#fff', borderTop: '1px solid #e2e8f0', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="hr-btn-secondary" onClick={() => setShowExperiencePreviewModal(false)}>Close</button>
                <button type="button" className="rec-primary-btn" onClick={() => handleDownloadExperiencePDF(viewingExperienceLetter)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '15px', height: '15px' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* DELETE EXPERIENCE LETTER MODAL */}
        {/* ========================================================= */}
        {showExperienceDeleteModal && viewingExperienceLetter && (
          <div className="hr-modal-overlay" style={{ zIndex: 1100 }} onClick={() => setShowExperienceDeleteModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', zIndex: 1101 }}>
              <div className="hr-modal-header">
                <h3>Delete Experience Letter</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowExperienceDeleteModal(false)}>&times;</button>
              </div>
              <div className="hr-modal-body">
                <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🗑️</div>
                  <h4 style={{ margin: '0 0 0.5rem', color: '#0f172a' }}>Delete {viewingExperienceLetter.letterNumber}?</h4>
                  <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                    This will remove the experience letter for <strong>{viewingExperienceLetter.employeeName}</strong>. This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="hr-modal-footer">
                <button type="button" className="hr-btn-secondary" onClick={() => setShowExperienceDeleteModal(false)}>Cancel</button>
                <button
                  type="button"
                  className="rec-btn-sm reject"
                  style={{ padding: '0.65rem 1.25rem', fontSize: '0.875rem' }}
                  disabled={experienceSubmitting}
                  onClick={handleDeleteExperience}
                >
                  {experienceSubmitting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </UserLayout>
  );
}
