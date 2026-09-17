import { useState, useEffect, useRef } from 'react';
import apiClient from '../../../../../services/apiClient';
import UserLayout from '../components/UserLayout';
import CustomSelect from '../../../../../components/common/CustomSelect';
import './HRTrainingManagement.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'programs', label: 'Programs' },
  { id: 'courses', label: 'Courses' },
  { id: 'trainers', label: 'Trainers' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'progress', label: 'Progress Tracking' },
  { id: 'assessments', label: 'Assessments' },
  { id: 'certifications', label: 'Certifications' },
  { id: 'completion', label: 'Completion Records' },
];

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

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setDisplay(value);
      return;
    }
    const end = parseInt(value, 10) || 0;
    if (end === 0) {
      setDisplay(0);
      return;
    }
    const duration = 400;
    const stepTime = 25;
    const steps = duration / stepTime;
    const increment = end / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= end) {
        setDisplay(end);
        clearInterval(timer);
      } else {
        setDisplay(Math.ceil(current));
      }
    }, stepTime);
    return () => clearInterval(timer);
  }, [value]);

  return <span>{display}</span>;
}

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

  // Skill Performance (100% Dynamic MongoDB Atlas Data)
  const [skillPerformance, setSkillPerformance] = useState([]);
  const [loadingSkillPerf, setLoadingSkillPerf] = useState(false);
  const [skillPerfError, setSkillPerfError] = useState('');

  // Search & Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterProgram, setFilterProgram] = useState('All');
  const [filterDept, setFilterDept] = useState('All');
  const [filterTrainer, setFilterTrainer] = useState('All');

  // Modals
  const [showModal, setShowModal] = useState(null); // 'program' | 'course' | 'trainer' | 'assignment' | 'attendance' | 'assessment' | 'certification' | 'feedback'
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});

  // Dedicated Certificate Generation & Preview Modals
  const [showGenCertModal, setShowGenCertModal] = useState(false);
  const [genCertForm, setGenCertForm] = useState({ employee: '', program: '', course: '', assignment: '' });
  const [modalCourses, setModalCourses] = useState([]);
  const [loadingModalCourses, setLoadingModalCourses] = useState(false);
  const [modalCourseError, setModalCourseError] = useState('');
  const [generatingCert, setGeneratingCert] = useState(false);
  const [downloadingCertId, setDownloadingCertId] = useState(null);
  const [previewCert, setPreviewCert] = useState(null);

  // Manage Program Detailed Lifecycle Modal
  const [managingProgram, setManagingProgram] = useState(null);
  const [programDetailData, setProgramDetailData] = useState(null);
  const [loadingProgramDetails, setLoadingProgramDetails] = useState(false);
  const [manageSubtab, setManageSubtab] = useState('overview'); // 'overview' | 'courses' | 'batches' | 'participants' | 'sessions'
  const [assignCourseId, setAssignCourseId] = useState('');
  const [batchForm, setBatchForm] = useState({
    batchName: '',
    startDate: '',
    endDate: '',
    capacity: 25,
    status: 'Upcoming'
  });

  // Multi-employee selection for assignment
  const [selectedEmployees, setSelectedEmployees] = useState([]);

  // Manage Course Detailed Lifecycle Modal (9-tab)
  const [managingCourse, setManagingCourse] = useState(null);
  const [courseDetailData, setCourseDetailData] = useState(null);
  const [loadingCourseDetails, setLoadingCourseDetails] = useState(false);
  const [courseManageTab, setCourseManageTab] = useState('overview');
  // Sub-forms for Manage Course
  const [moduleForm, setModuleForm] = useState({ moduleName: '', description: '', duration: 2, order: 1 });
  const [editingModuleId, setEditingModuleId] = useState(null);
  const [objectiveForm, setObjectiveForm] = useState({ objective: '', order: 1 });
  const [materialForm, setMaterialForm] = useState({ title: '', materialType: 'Document', url: '', fileName: '', notes: '' });
  const [courseLinkProgramId, setCourseLinkProgramId] = useState('');
  const [assessmentConfigForm, setAssessmentConfigForm] = useState({ isRequired: false, passingScore: 70, maxAttempts: 3 });
  const [certConfigForm, setCertConfigForm] = useState({ isEnabled: true, validForMonths: 0, certificateTemplate: 'Standard' });

  // Course Specific Filters & Search
  const [courseSearch, setCourseSearch] = useState('');
  const [courseFilterCategory, setCourseFilterCategory] = useState('All');
  const [courseFilterDept, setCourseFilterDept] = useState('All');
  const [courseFilterLevel, setCourseFilterLevel] = useState('All');
  const [courseFilterStatus, setCourseFilterStatus] = useState('All');
  const [courseFilterTrainer, setCourseFilterTrainer] = useState('All');

  // ── Consolidated Employee Assignments & Assessments Management State ──
  const [assignmentSubtab, setAssignmentSubtab] = useState('assignments'); // 'assignments' | 'assessments' | 'evaluations' | 'results'
  const [viewingAssignment, setViewingAssignment] = useState(null);

  // Filters for Consolidated Employee Assignments
  const [asgnSearch, setAsgnSearch] = useState('');
  const [asgnFilterProgram, setAsgnFilterProgram] = useState('All');
  const [asgnFilterCourse, setAsgnFilterCourse] = useState('All');
  const [asgnFilterDept, setAsgnFilterDept] = useState('All');
  const [asgnFilterTrainingStatus, setAsgnFilterTrainingStatus] = useState('All');
  const [asgnFilterAssessmentStatus, setAsgnFilterAssessmentStatus] = useState('All');
  const [asgnFilterAssessmentResult, setAsgnFilterAssessmentResult] = useState('All');
  const [asgnFilterCompletionStatus, setAsgnFilterCompletionStatus] = useState('All');

  // ── Training Assessment HR Management State ──
  const [assessmentSubtab, setAssessmentSubtab] = useState('assessments'); // 'assessments' | 'evaluations' | 'results'
  const [assessmentSubmissions, setAssessmentSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Filters for Assessment Sub-module
  const [asmtSearch, setAsmtSearch] = useState('');
  const [asmtFilterProgram, setAsmtFilterProgram] = useState('All');
  const [asmtFilterCourse, setAsmtFilterCourse] = useState('All');
  const [asmtFilterDept, setAsmtFilterDept] = useState('All');
  const [asmtFilterStatus, setAsmtFilterStatus] = useState('All');
  const [asmtFilterType, setAsmtFilterType] = useState('All');
  const [asmtFilterResult, setAsmtFilterResult] = useState('All');
  const [asmtFilterEmployee, setAsmtFilterEmployee] = useState('All');

  // Modals for Assessment HR Management
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState(null);
  const [assessmentForm, setAssessmentForm] = useState({
    name: '',
    program: '',
    course: '',
    description: '',
    instructions: '',
    assessmentType: 'Quiz',
    duration: 45,
    totalMarks: 100,
    passingMarks: 60,
    startDate: '',
    endDate: '',
    status: 'Draft',
    questions: []
  });
  const [savingAssessment, setSavingAssessment] = useState(false);
  const [viewingAssessment, setViewingAssessment] = useState(null);

  // Assign Assessment Modal
  const [assigningAssessment, setAssigningAssessment] = useState(null);
  const [assignForm, setAssignForm] = useState({
    targetType: 'individual',
    employeeId: '',
    selectedEmployeeIds: [],
    departmentId: '',
    dueDate: '',
    notes: ''
  });
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Evaluate Modal
  const [evaluatingSubmission, setEvaluatingSubmission] = useState(null);
  const [evaluateForm, setEvaluateForm] = useState({
    marksObtained: 0,
    totalMarks: 100,
    passingMarks: 60,
    percentage: 0,
    passFail: 'Pass',
    grade: 'A',
    remarks: '',
    evaluationStatus: 'Evaluated',
    answers: []
  });
  const [savingEvaluation, setSavingEvaluation] = useState(false);

  // Certification Edit State
  const [showEditCertModal, setShowEditCertModal] = useState(false);
  const [editingCert, setEditingCert] = useState(null);
  const [editCertForm, setEditCertForm] = useState({
    certificateNumber: '',
    employee: '',
    program: '',
    course: '',
    certificateType: 'Completion',
    issueDate: '',
    completionDate: '',
    expiryDate: '',
    finalScore: '',
    status: 'Active'
  });
  const [savingCert, setSavingCert] = useState(false);

  const showToastMsg = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 3500);
  };

  // Modal Body Refs for scroll reset on tab change
  const programModalBodyRef = useRef(null);
  const courseModalBodyRef = useRef(null);

  // Lock background window scroll whenever any modal is opened, with scrollbar compensation to eliminate layout shift
  useEffect(() => {
    const isAnyModalOpen = Boolean(
      showModal || showGenCertModal || previewCert || managingProgram || managingCourse ||
      showAssessmentModal || viewingAssessment || assigningAssessment || evaluatingSubmission || showEditCertModal || viewingAssignment
    );
    if (isAnyModalOpen) {
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;

      document.body.style.overflow = 'hidden';
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`;
      }
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
      };
    }
  }, [
    showModal, showGenCertModal, previewCert, managingProgram, managingCourse,
    showAssessmentModal, viewingAssessment, assigningAssessment, evaluatingSubmission, showEditCertModal
  ]);

  // Reset modal body scroll to top when changing manage tabs
  useEffect(() => {
    if (programModalBodyRef.current) {
      programModalBodyRef.current.scrollTop = 0;
    }
  }, [manageSubtab]);

  useEffect(() => {
    if (courseModalBodyRef.current) {
      courseModalBodyRef.current.scrollTop = 0;
    }
  }, [courseManageTab]);

  // Initial Load Lookups & Tab Data
  useEffect(() => {
    // Fetch departments
    apiClient.get('/admin/departments')
      .catch(() => apiClient.get('/departments'))
      .then((res) => setDepartments(res.data?.data || []))
      .catch(() => { });

    // Fetch employees
    apiClient.get('/admin/employees')
      .catch(() => apiClient.get('/users'))
      .then((res) => setEmployees(res.data?.data || []))
      .catch(() => { });

    // Fetch training programs lookup
    apiClient.get('/training/programs')
      .then((res) => setPrograms(res.data?.data || []))
      .catch(() => { });

    // Fetch training courses lookup
    apiClient.get('/training/courses')
      .then((res) => setCourses(res.data?.data || []))
      .catch(() => { });

    // Fetch training trainers lookup
    apiClient.get('/training/trainers')
      .then((res) => setTrainers(res.data?.data || []))
      .catch(() => { });

    // Fetch dynamic skill performance from MongoDB Atlas
    loadSkillPerformance();
  }, []);

  const loadSkillPerformance = () => {
    setLoadingSkillPerf(true);
    setSkillPerfError('');
    apiClient.get('/training/skill-performance')
      .then((res) => {
        setSkillPerformance(res.data?.data || []);
      })
      .catch((err) => {
        setSkillPerfError(err.response?.data?.message || 'Unable to load skill performance');
      })
      .finally(() => {
        setLoadingSkillPerf(false);
      });
  };

  // ── Training Assessment & Certification Action Handlers ──
  const loadAssessmentData = () => {
    setLoading(true);
    setLoadingSubmissions(true);
    Promise.all([
      apiClient.get('/training/assessments'),
      apiClient.get('/training/assessments/submissions?includeAssigned=true')
    ])
      .then(([asmtRes, subRes]) => {
        setAssessments(asmtRes.data?.data || []);
        setAssessmentSubmissions(subRes.data?.data || []);
      })
      .catch((err) => {
        showToastMsg(err.response?.data?.message || 'Failed to load assessments', 'error');
      })
      .finally(() => {
        setLoading(false);
        setLoadingSubmissions(false);
      });
  };

  const handleAddQuestion = () => {
    const currentQuestions = assessmentForm.questions || [];
    const newQ = {
      questionText: '',
      questionType: 'Multiple Choice',
      marks: 10,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'Option A',
      explanation: '',
      order: currentQuestions.length + 1
    };
    const updated = [...currentQuestions, newQ];
    const newTotal = updated.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
    setAssessmentForm(prev => ({
      ...prev,
      questions: updated,
      totalMarks: newTotal > 0 ? newTotal : prev.totalMarks
    }));
  };

  const handleUpdateQuestion = (index, field, value) => {
    setAssessmentForm(prev => {
      const updated = [...(prev.questions || [])];
      updated[index] = { ...updated[index], [field]: value };
      let newTotal = prev.totalMarks;
      if (field === 'marks') {
        newTotal = updated.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
      }
      return {
        ...prev,
        questions: updated,
        totalMarks: newTotal > 0 ? newTotal : prev.totalMarks
      };
    });
  };

  const handleRemoveQuestion = (index) => {
    setAssessmentForm(prev => {
      const updated = (prev.questions || []).filter((_, i) => i !== index);
      const newTotal = updated.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
      return {
        ...prev,
        questions: updated,
        totalMarks: newTotal > 0 ? newTotal : prev.totalMarks
      };
    });
  };

  const handleMoveQuestion = (index, direction) => {
    const questions = assessmentForm.questions || [];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= questions.length) return;
    const updated = [...questions];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    updated.forEach((q, i) => { q.order = i + 1; });
    setAssessmentForm(prev => ({ ...prev, questions: updated }));
  };

  const handleAddOption = (qIndex) => {
    const q = assessmentForm.questions?.[qIndex];
    if (!q) return;
    const opts = q.options || [];
    const updatedOpts = [...opts, `Option ${String.fromCharCode(65 + opts.length)}`];
    handleUpdateQuestion(qIndex, 'options', updatedOpts);
  };

  const handleUpdateOption = (qIndex, optIndex, val) => {
    const q = assessmentForm.questions?.[qIndex];
    if (!q) return;
    const updatedOpts = [...(q.options || [])];
    const oldVal = updatedOpts[optIndex];
    updatedOpts[optIndex] = val;
    let corr = q.correctAnswer;
    if (corr === oldVal) corr = val;
    setAssessmentForm(prev => {
      const updatedQuestions = [...(prev.questions || [])];
      updatedQuestions[qIndex] = { ...q, options: updatedOpts, correctAnswer: corr };
      return { ...prev, questions: updatedQuestions };
    });
  };

  const handleRemoveOption = (qIndex, optIndex) => {
    const q = assessmentForm.questions?.[qIndex];
    if (!q) return;
    const updatedOpts = (q.options || []).filter((_, i) => i !== optIndex);
    let corr = q.correctAnswer;
    if (!updatedOpts.includes(corr)) {
      corr = updatedOpts[0] || '';
    }
    setAssessmentForm(prev => {
      const updatedQuestions = [...(prev.questions || [])];
      updatedQuestions[qIndex] = { ...q, options: updatedOpts, correctAnswer: corr };
      return { ...prev, questions: updatedQuestions };
    });
  };

  const openCreateAssessmentModal = () => {
    setEditingAssessment(null);
    setAssessmentForm({
      name: '',
      program: programs[0]?._id || '',
      course: courses[0]?._id || '',
      description: '',
      instructions: '',
      assessmentType: 'Quiz',
      duration: 45,
      totalMarks: 100,
      passingMarks: 60,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: 'Draft',
      questions: []
    });
    setShowAssessmentModal(true);
  };

  const openEditAssessmentModal = (asmt) => {
    setEditingAssessment(asmt);
    setAssessmentForm({
      name: asmt.title || asmt.name || '',
      program: asmt.program?._id || asmt.program || '',
      course: asmt.course?._id || asmt.course || '',
      description: asmt.description || '',
      instructions: asmt.instructions || '',
      assessmentType: asmt.assessmentType || 'Quiz',
      duration: asmt.duration || 45,
      totalMarks: asmt.totalMarks || asmt.maxScore || 100,
      passingMarks: asmt.passingMarks || asmt.passingScore || 60,
      startDate: asmt.startDate ? new Date(asmt.startDate).toISOString().slice(0, 10) : '',
      endDate: asmt.endDate ? new Date(asmt.endDate).toISOString().slice(0, 10) : '',
      status: asmt.status || 'Draft',
      questions: Array.isArray(asmt.questions) && asmt.questions.length > 0
        ? asmt.questions.map(q => ({
            questionText: q.questionText || '',
            questionType: q.questionType || 'Multiple Choice',
            marks: q.marks !== undefined ? q.marks : 10,
            options: Array.isArray(q.options) ? [...q.options] : ['Option A', 'Option B'],
            correctAnswer: q.correctAnswer || '',
            explanation: q.explanation || '',
            order: q.order || 1
          }))
        : []
    });
    setShowAssessmentModal(true);
  };

  const handleSaveAssessment = async (e) => {
    e.preventDefault();
    if (!assessmentForm.name.trim()) {
      return showToastMsg('Assessment Name is required', 'error');
    }
    if (!assessmentForm.course) {
      return showToastMsg('Course selection is required', 'error');
    }
    setSavingAssessment(true);
    try {
      const payload = {
        name: assessmentForm.name.trim(),
        title: assessmentForm.name.trim(),
        program: assessmentForm.program || null,
        course: assessmentForm.course,
        description: assessmentForm.description || '',
        instructions: assessmentForm.instructions || '',
        assessmentType: assessmentForm.assessmentType || 'Quiz',
        duration: Number(assessmentForm.duration) || 30,
        totalMarks: Number(assessmentForm.totalMarks) || 100,
        maxScore: Number(assessmentForm.totalMarks) || 100,
        passingMarks: Number(assessmentForm.passingMarks) || 60,
        passingScore: Number(assessmentForm.passingMarks) || 60,
        startDate: assessmentForm.startDate || null,
        endDate: assessmentForm.endDate || null,
        status: assessmentForm.status || 'Draft',
        questions: assessmentForm.questions || []
      };

      if (editingAssessment) {
        await apiClient.put(`/training/assessments/${editingAssessment._id}`, payload);
        showToastMsg('Assessment updated successfully');
      } else {
        await apiClient.post('/training/assessments', payload);
        showToastMsg('Assessment created successfully');
      }
      setShowAssessmentModal(false);
      setEditingAssessment(null);
      loadAssessmentData();
      loadSkillPerformance();
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to save assessment', 'error');
    } finally {
      setSavingAssessment(false);
    }
  };

  const handleTogglePublish = async (asmt) => {
    const newStatus = asmt.status === 'Published' ? 'Closed' : 'Published';
    try {
      await apiClient.post(`/training/assessments/${asmt._id}/publish`, { status: newStatus });
      showToastMsg(`Assessment status updated to ${newStatus}`);
      loadAssessmentData();
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  const openAssignModal = (asmt) => {
    setAssigningAssessment(asmt);
    setAssignForm({
      targetType: 'individual',
      employeeId: '',
      selectedEmployeeIds: [],
      departmentId: departments[0]?._id || '',
      dueDate: asmt.endDate ? new Date(asmt.endDate).toISOString().slice(0, 10) : '',
      notes: ''
    });
  };

  const handleSaveAssignment = async (e) => {
    e.preventDefault();
    if (!assigningAssessment) return;
    setSavingAssignment(true);
    try {
      const payload = {
        dueDate: assignForm.dueDate || undefined,
        notes: assignForm.notes || ''
      };
      if (assignForm.targetType === 'individual') {
        if (!assignForm.employeeId) return showToastMsg('Please select an employee', 'error');
        payload.employeeIds = [assignForm.employeeId];
      } else if (assignForm.targetType === 'multiple') {
        if (!assignForm.selectedEmployeeIds || assignForm.selectedEmployeeIds.length === 0) {
          return showToastMsg('Please select at least one employee', 'error');
        }
        payload.employeeIds = assignForm.selectedEmployeeIds;
      } else if (assignForm.targetType === 'department') {
        if (!assignForm.departmentId) return showToastMsg('Please select a department', 'error');
        payload.departmentId = assignForm.departmentId;
      } else if (assignForm.targetType === 'course') {
        payload.courseParticipants = true;
      }

      await apiClient.post(`/training/assessments/${assigningAssessment._id}/assign`, payload);
      showToastMsg('Assessment assigned successfully');
      setAssigningAssessment(null);
      loadAssessmentData();
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to assign assessment', 'error');
    } finally {
      setSavingAssignment(false);
    }
  };

  const openEvaluateModal = (sub) => {
    setEvaluatingSubmission(sub);
    const marks = sub.marksObtained !== null && sub.marksObtained !== undefined ? sub.marksObtained : (sub.score !== undefined && sub.score !== null ? sub.score : 0);
    const total = sub.totalMarks || 100;
    const passMark = sub.passingMarks || 60;
    const pct = sub.percentage !== null && sub.percentage !== undefined ? sub.percentage : (total > 0 ? Math.round((marks / total) * 100) : 0);
    const pf = sub.passFail && sub.passFail !== 'Pending' ? sub.passFail : (marks >= passMark ? 'Pass' : 'Fail');
    const gr = sub.grade && sub.grade !== '-' ? sub.grade : (pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : 'F');

    setEvaluateForm({
      marksObtained: marks,
      totalMarks: total,
      passingMarks: passMark,
      percentage: pct,
      passFail: pf,
      grade: gr,
      remarks: sub.remarks || '',
      evaluationStatus: sub.evaluationStatus === 'Pending Submission' || sub.evaluationStatus === 'Pending' ? 'Evaluated' : (sub.evaluationStatus || 'Evaluated'),
      answers: Array.isArray(sub.answers) ? sub.answers.map(a => ({ ...a })) : []
    });
  };

  const handleSaveEvaluation = async (e) => {
    e.preventDefault();
    if (!evaluatingSubmission) return;
    setSavingEvaluation(true);
    try {
      const asmtId = evaluatingSubmission.assessmentId;
      const subId = String(evaluatingSubmission._id).startsWith('assigned_') ? undefined : evaluatingSubmission._id;
      const empId = evaluatingSubmission.employee?._id || evaluatingSubmission.employee;

      const marks = Number(evaluateForm.marksObtained) || 0;
      const total = Number(evaluateForm.totalMarks) || 100;
      const pct = total > 0 ? Math.round((marks / total) * 100) : 0;

      const payload = {
        submissionId: subId,
        employeeId: empId,
        score: marks,
        marksObtained: marks,
        percentage: pct,
        passFail: evaluateForm.passFail,
        grade: evaluateForm.grade,
        remarks: evaluateForm.remarks || '',
        evaluationStatus: evaluateForm.evaluationStatus || 'Evaluated',
        answers: evaluateForm.answers || []
      };

      await apiClient.post(`/training/assessments/${asmtId}/evaluate`, payload);
      showToastMsg('Assessment evaluation recorded successfully');
      setEvaluatingSubmission(null);
      loadAssessmentData();
      loadSkillPerformance();
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to record evaluation', 'error');
    } finally {
      setSavingEvaluation(false);
    }
  };

  const openEditCertModal = (cert) => {
    setEditingCert(cert);
    setEditCertForm({
      certificateNumber: cert.certificateNumber || '',
      employee: cert.employee?._id || cert.employee || '',
      program: cert.program?._id || cert.program || '',
      course: cert.course?._id || cert.course || '',
      certificateType: cert.certificateType || 'Completion',
      issueDate: cert.issueDate ? new Date(cert.issueDate).toISOString().slice(0, 10) : '',
      completionDate: cert.completionDate ? new Date(cert.completionDate).toISOString().slice(0, 10) : '',
      expiryDate: cert.expiryDate ? new Date(cert.expiryDate).toISOString().slice(0, 10) : '',
      finalScore: cert.finalScore !== undefined && cert.finalScore !== null ? cert.finalScore : '',
      status: cert.status || 'Active'
    });
    setShowEditCertModal(true);
  };

  const handleSaveCert = async (e) => {
    e.preventDefault();
    if (!editingCert) return;
    setSavingCert(true);
    try {
      const payload = {
        certificateNumber: editCertForm.certificateNumber.trim(),
        employee: editCertForm.employee,
        program: editCertForm.program || null,
        course: editCertForm.course,
        certificateType: editCertForm.certificateType,
        status: editCertForm.status,
        issueDate: editCertForm.issueDate || undefined,
        completionDate: editCertForm.completionDate || undefined,
        expiryDate: editCertForm.expiryDate || undefined,
        finalScore: editCertForm.finalScore !== '' ? Number(editCertForm.finalScore) : null
      };
      await apiClient.put(`/training/certifications/${editingCert._id}`, payload);
      showToastMsg('Certification updated successfully');
      setShowEditCertModal(false);
      setEditingCert(null);
      loadTabData('certifications');
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to update certification', 'error');
    } finally {
      setSavingCert(false);
    }
  };

  const loadTabData = (tab) => {
    setLoading(true);
    if (tab === 'overview') loadSkillPerformance();
    if (tab === 'assessments' || tab === 'assignments') {
      loadAssessmentData();
    }
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
        else if (tab === 'assignments') {
          setAssignments(d || []);
          apiClient.get('/training/certifications').then(cRes => setCertifications(cRes.data?.data || [])).catch(() => {});
          apiClient.get('/training/progress').then(pRes => setProgressData(pRes.data?.data || [])).catch(() => {});
        }
        else if (tab === 'attendance') setAttendance(d || []);
        else if (tab === 'progress') setProgressData(d || []);
        else if (tab === 'assessments') {
          setAssessments(d || []);
          apiClient.get('/training/assessments/submissions').then(sRes => setAssessmentSubmissions(sRes.data?.data || [])).catch(() => {});
        }
        else if (tab === 'certifications') setCertifications(d || []);
        else if (tab === 'feedback') setFeedback(d || []);
        else if (tab === 'completion') setCompletionData(d || []);
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



    setLoading(true);

    try {
      let url = `/training/${showModal}s`;
      if (showModal === 'attendance') url = '/training/attendance';
      if (showModal === 'feedback') url = '/training/feedback';

      if (editingItem) {
        url = `${url}/${editingItem._id}`;
        let payload = { ...formData };
        if (showModal === 'program') {
          if (!payload.department) delete payload.department;
          if (!payload.programOwner) delete payload.programOwner;
          if (!payload.trainer) delete payload.trainer;
          if (!payload.programCode || !payload.programCode.trim()) delete payload.programCode;
          if (payload.budget !== undefined) payload.budget = Number(payload.budget) || 0;
          if (payload.totalHours !== undefined) payload.totalHours = Number(payload.totalHours) || 0;
          if (payload.capacity !== undefined) payload.capacity = Number(payload.capacity) || 0;
        }
        if (showModal === 'course') {
          if (!payload.department) delete payload.department;
          if (!payload.trainer) delete payload.trainer;
          if (!payload.code || !payload.code.trim()) delete payload.code;
          if (payload.duration !== undefined) payload.duration = Number(payload.duration) || 0;
          if (typeof payload.prerequisites === 'string') {
            payload.prerequisites = payload.prerequisites.split(',').map(s => s.trim()).filter(Boolean);
          }
          if (typeof payload.requiredSkills === 'string') {
            payload.requiredSkills = payload.requiredSkills.split(',').map(s => s.trim()).filter(Boolean);
          }
        }

        await apiClient.put(url, payload);
        showToastMsg('Updated successfully');
      } else {
        let payload = { ...formData };
        if (showModal === 'program') {
          if (!payload.department) delete payload.department;
          if (!payload.programOwner) delete payload.programOwner;
          if (!payload.trainer) delete payload.trainer;
          if (!payload.programCode || !payload.programCode.trim()) delete payload.programCode;
          if (payload.budget !== undefined) payload.budget = Number(payload.budget) || 0;
          if (payload.totalHours !== undefined) payload.totalHours = Number(payload.totalHours) || 0;
          if (payload.capacity !== undefined) payload.capacity = Number(payload.capacity) || 0;
        }
        if (showModal === 'course') {
          if (!payload.department) delete payload.department;
          if (!payload.trainer) delete payload.trainer;
          if (!payload.code || !payload.code.trim()) delete payload.code;
          if (payload.duration !== undefined) payload.duration = Number(payload.duration) || 0;
          if (typeof payload.prerequisites === 'string') {
            payload.prerequisites = payload.prerequisites.split(',').map(s => s.trim()).filter(Boolean);
          }
          if (typeof payload.requiredSkills === 'string') {
            payload.requiredSkills = payload.requiredSkills.split(',').map(s => s.trim()).filter(Boolean);
          }
        }
        if (showModal === 'assignment' && selectedEmployees.length > 0) {
          payload.employees = selectedEmployees;
        }

        await apiClient.post(url, payload);
        showToastMsg('Created successfully');
      }

      setShowModal(null);
      setEditingItem(null);
      setFormData({});
      setSelectedEmployees([]);
      loadTabData(activeTab);
      // Refresh lookup dropdowns
      if (showModal === 'program') {
        apiClient.get('/training/programs').then(res => setPrograms(res.data?.data || [])).catch(() => { });
      }
      if (showModal === 'course') {
        apiClient.get('/training/courses').then(res => setCourses(res.data?.data || [])).catch(() => { });
      }
      if (showModal === 'assessment' || showModal === 'program' || showModal === 'course') {
        loadSkillPerformance();
      }
      loadTabData(activeTab);
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Operation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Dynamic Program Selection for Generate Certification Modal
  const handleModalProgramChange = async (programId) => {
    setGenCertForm(prev => ({ ...prev, program: programId, course: '' }));
    if (!programId) {
      setModalCourses([]);
      setModalCourseError('');
      return;
    }
    setLoadingModalCourses(true);
    setModalCourseError('');
    try {
      const res = await apiClient.get('/training/courses', { params: { program: programId } });
      const fetched = res.data?.data || [];
      setModalCourses(fetched);
      if (fetched.length === 0) {
        setModalCourseError('No courses available');
      }
    } catch (err) {
      console.error('Failed to load courses for program:', err);
      setModalCourseError('Unable to load courses');
      setModalCourses([]);
    } finally {
      setLoadingModalCourses(false);
    }
  };

  // Generate Certification Handler
  const handleGenerateCertSubmit = async (e) => {
    e.preventDefault();
    if (!genCertForm.employee || !genCertForm.course) {
      showToastMsg('Please select employee and course', 'error');
      return;
    }
    setGeneratingCert(true);
    try {
      const res = await apiClient.post('/training/certifications/generate', genCertForm);
      showToastMsg(res.data?.message || 'Certification generated successfully!');
      setShowGenCertModal(false);
      setGenCertForm({ employee: '', program: '', course: '', assignment: '' });
      setModalCourses([]);
      loadTabData('certifications');
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to generate certification', 'error');
    } finally {
      setGeneratingCert(false);
    }
  };

  // Download PDF Handler
  const handleDownloadPdf = async (cert) => {
    if (!cert || !cert._id) return;
    setDownloadingCertId(cert._id);
    showToastMsg('Generating certificate PDF...', 'info');
    try {
      const res = await apiClient.get(`/training/certifications/${cert._id}/pdf`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const empName = getEmpName(cert.employee).replace(/[^a-zA-Z0-9_-]/g, '_');
      const courseTitle = (cert.course?.title || 'Course').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.setAttribute('download', `Certificate_${empName}_${courseTitle}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToastMsg('Certificate PDF downloaded successfully!');
    } catch (err) {
      console.error('Download PDF error:', err);
      showToastMsg(err.response?.data?.message || 'Failed to download certificate PDF', 'error');
    } finally {
      setDownloadingCertId(null);
    }
  };

  // Deactivate / Revoke Certification Handler
  const handleRevokeCert = async (certId) => {
    if (!window.confirm('Are you sure you want to deactivate this certificate?')) return;
    setLoading(true);
    try {
      await apiClient.post(`/training/certifications/${certId}/revoke`);
      showToastMsg('Certificate deactivated successfully');
      loadTabData('certifications');
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to deactivate certificate', 'error');
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
      const res = await apiClient.delete(endpoint);
      showToastMsg(res.data?.message || 'Deleted successfully');
      loadTabData(activeTab);
      if (type === 'program') {
        apiClient.get('/training/programs').then(res => setPrograms(res.data?.data || [])).catch(() => { });
      }
      if (type === 'course') {
        apiClient.get('/training/courses').then(res => setCourses(res.data?.data || [])).catch(() => { });
      }
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
    if (type === 'program') {
      setFormData({
        name: '',
        programCode: '',
        description: '',
        trainingType: 'Internal',
        category: 'General',
        department: departments[0]?._id || '',
        programOwner: '',
        trainer: '',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        totalHours: 20,
        capacity: 25,
        budget: 0,
        currency: 'INR',
        status: 'Draft',
      });
    } else if (type === 'course') {
      setFormData({
        title: '',
        code: '',
        category: 'Technical',
        difficulty: 'Beginner',
        department: departments[0]?._id || '',
        trainer: '',
        trainingProvider: '',
        duration: 8,
        durationUnit: 'Hours',
        prerequisites: '',
        requiredSkills: '',
        description: '',
        status: 'Draft',
      });
    } else if (type === 'attendance') {
      if (sessions.length === 0) {
        apiClient.get('/training/sessions').then(res => setSessions(res.data?.data || [])).catch(() => { });
      }
      setFormData({
        date: new Date().toISOString().slice(0, 10),
        status: 'Present',
      });
    } else if (type === 'assignment') {
      setSelectedEmployees([]);
      setFormData({
        program: programs[0]?._id || '',
        course: courses[0]?._id || '',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        startDate: new Date().toISOString().slice(0, 10),
        isMandatory: true,
        status: 'Assigned',
      });
    } else {
      setFormData({});
    }
    setShowModal(type);
  };

  // Open Edit Modal
  const openEditModal = (type, item) => {
    setEditingItem(item);
    if (type === 'program') {
      setFormData({
        ...item,
        name: item.name || '',
        programCode: item.programCode || '',
        description: item.description || '',
        trainingType: item.trainingType || 'Internal',
        category: item.category || 'General',
        department: item.department?._id || item.department || '',
        programOwner: item.programOwner?._id || item.programOwner || '',
        trainer: item.trainer?._id || item.trainer || '',
        startDate: item.startDate ? String(item.startDate).slice(0, 10) : '',
        endDate: item.endDate ? String(item.endDate).slice(0, 10) : '',
        totalHours: item.totalHours || 0,
        capacity: item.capacity || 0,
        budget: item.budget || 0,
        currency: item.currency || 'INR',
        status: item.status || 'Draft',
      });
    } else if (type === 'course') {
      setFormData({
        ...item,
        title: item.title || '',
        code: item.code || '',
        category: item.category || 'General',
        difficulty: item.difficulty || item.level || 'Beginner',
        department: item.department?._id || item.department || '',
        trainer: item.trainer?._id || item.trainer || '',
        trainingProvider: item.trainingProvider || '',
        duration: item.duration || item.durationHours || 0,
        durationUnit: item.durationUnit || 'Hours',
        prerequisites: Array.isArray(item.prerequisites) ? item.prerequisites.join(', ') : (item.prerequisites || ''),
        requiredSkills: Array.isArray(item.requiredSkills) ? item.requiredSkills.join(', ') : (item.requiredSkills || ''),
        description: item.description || '',
        status: item.status || 'Draft',
      });
    } else if (type === 'assignment') {
      setFormData({
        ...item,
        program: item.program?._id || item.program || '',
        course: item.course?._id || item.course || '',
        employee: item.employee?._id || item.employee || '',
        status: item.status || 'Assigned',
        startDate: item.startDate ? String(item.startDate).slice(0, 10) : '',
        dueDate: item.dueDate ? String(item.dueDate).slice(0, 10) : '',
        completionDate: item.completionDate ? String(item.completionDate).slice(0, 10) : '',
        isMandatory: item.isMandatory !== undefined ? item.isMandatory : true,
      });
    } else {
      setFormData({ ...item });
    }
    setShowModal(type);
  };

  // Manage Program Lifecycle Helpers
  const openManageProgram = async (program) => {
    setManagingProgram(program);
    setManageSubtab('overview');
    setLoadingProgramDetails(true);
    try {
      const res = await apiClient.get(`/training/programs/${program._id}`);
      setProgramDetailData(res.data?.data || null);
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to load program details', 'error');
    } finally {
      setLoadingProgramDetails(false);
    }
  };

  const reloadProgramDetails = async (progId) => {
    try {
      const res = await apiClient.get(`/training/programs/${progId}`);
      setProgramDetailData(res.data?.data || null);
      loadTabData('programs');
    } catch (err) {
      console.error('Failed to reload program details:', err);
    }
  };

  const handleAssignCourseToProgram = async () => {
    if (!assignCourseId || !managingProgram) return;
    try {
      await apiClient.post(`/training/programs/${managingProgram._id}/courses`, { courseId: assignCourseId });
      showToastMsg('Course assigned to program successfully');
      setAssignCourseId('');
      reloadProgramDetails(managingProgram._id);
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to assign course', 'error');
    }
  };

  const handleRemoveCourseFromProgram = async (courseId) => {
    if (!window.confirm('Remove this course from this program?')) return;
    try {
      await apiClient.delete(`/training/programs/${managingProgram._id}/courses/${courseId}`);
      showToastMsg('Course removed from program');
      reloadProgramDetails(managingProgram._id);
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to remove course', 'error');
    }
  };

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    if (!batchForm.batchName?.trim() || !managingProgram) {
      showToastMsg('Batch name is required', 'error');
      return;
    }
    try {
      await apiClient.post(`/training/programs/${managingProgram._id}/batches`, batchForm);
      showToastMsg('Batch created successfully');
      setBatchForm({ batchName: '', startDate: '', endDate: '', capacity: 25, status: 'Upcoming' });
      reloadProgramDetails(managingProgram._id);
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to create batch', 'error');
    }
  };

  const handleDeleteBatch = async (batchId) => {
    if (!window.confirm('Are you sure you want to delete this batch?')) return;
    try {
      await apiClient.delete(`/training/programs/${managingProgram._id}/batches/${batchId}`);
      showToastMsg('Batch deleted');
      reloadProgramDetails(managingProgram._id);
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to delete batch', 'error');
    }
  };

  // Manage Course Lifecycle Helpers
  const openManageCourse = async (course) => {
    setManagingCourse(course);
    setCourseManageTab('overview');
    setLoadingCourseDetails(true);
    try {
      const res = await apiClient.get(`/training/courses/${course._id}`);
      const d = res.data?.data || null;
      setCourseDetailData(d);
      if (d?.course?.assessmentConfig) {
        setAssessmentConfigForm({
          isRequired: !!d.course.assessmentConfig.isRequired,
          passingScore: d.course.assessmentConfig.passingScore ?? 70,
          maxAttempts: d.course.assessmentConfig.maxAttempts ?? 3
        });
      }
      if (d?.course?.certificationConfig) {
        setCertConfigForm({
          isEnabled: d.course.certificationConfig.isEnabled !== false,
          validForMonths: d.course.certificationConfig.validForMonths || 0,
          certificateTemplate: d.course.certificationConfig.certificateTemplate || 'Standard'
        });
      }
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to load course details', 'error');
    } finally {
      setLoadingCourseDetails(false);
    }
  };

  const reloadCourseDetails = async (courseId) => {
    try {
      const res = await apiClient.get(`/training/courses/${courseId}`);
      const d = res.data?.data || null;
      setCourseDetailData(d);
      if (d?.course?.assessmentConfig) {
        setAssessmentConfigForm({
          isRequired: !!d.course.assessmentConfig.isRequired,
          passingScore: d.course.assessmentConfig.passingScore ?? 70,
          maxAttempts: d.course.assessmentConfig.maxAttempts ?? 3
        });
      }
      if (d?.course?.certificationConfig) {
        setCertConfigForm({
          isEnabled: d.course.certificationConfig.isEnabled !== false,
          validForMonths: d.course.certificationConfig.validForMonths || 0,
          certificateTemplate: d.course.certificationConfig.certificateTemplate || 'Standard'
        });
      }
      loadTabData('courses');
      apiClient.get('/training/courses').then(r => setCourses(r.data?.data || [])).catch(() => { });
    } catch (err) {
      console.error('Failed to reload course details:', err);
    }
  };

  const handleSaveModule = async (e) => {
    e.preventDefault();
    if (!managingCourse || !moduleForm.moduleName?.trim()) {
      showToastMsg('Module title is required', 'error');
      return;
    }
    try {
      if (editingModuleId) {
        await apiClient.put(`/training/courses/${managingCourse._id}/modules/${editingModuleId}`, moduleForm);
        showToastMsg('Module updated successfully');
      } else {
        await apiClient.post(`/training/courses/${managingCourse._id}/modules`, moduleForm);
        showToastMsg('Module added successfully');
      }
      setModuleForm({ moduleName: '', description: '', duration: 2, order: (courseDetailData?.course?.modules?.length || 0) + 1 });
      setEditingModuleId(null);
      reloadCourseDetails(managingCourse._id);
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to save module', 'error');
    }
  };

  const handleDeleteModule = async (moduleId) => {
    if (!window.confirm('Are you sure you want to delete this module?')) return;
    try {
      await apiClient.delete(`/training/courses/${managingCourse._id}/modules/${moduleId}`);
      showToastMsg('Module deleted');
      reloadCourseDetails(managingCourse._id);
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to delete module', 'error');
    }
  };

  const handleAddObjective = async (e) => {
    e.preventDefault();
    if (!managingCourse || !objectiveForm.objective?.trim()) {
      showToastMsg('Objective content is required', 'error');
      return;
    }
    try {
      await apiClient.post(`/training/courses/${managingCourse._id}/objectives`, objectiveForm);
      showToastMsg('Learning objective added');
      setObjectiveForm({ objective: '', order: (courseDetailData?.course?.learningObjectives?.length || 0) + 2 });
      reloadCourseDetails(managingCourse._id);
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to add objective', 'error');
    }
  };

  const handleDeleteObjective = async (objId) => {
    if (!window.confirm('Delete this learning objective?')) return;
    try {
      await apiClient.delete(`/training/courses/${managingCourse._id}/objectives/${objId}`);
      showToastMsg('Objective deleted');
      reloadCourseDetails(managingCourse._id);
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to delete objective', 'error');
    }
  };

  const handleAddMaterial = async (e) => {
    e.preventDefault();
    if (!managingCourse || !materialForm.title?.trim() || !materialForm.url?.trim()) {
      showToastMsg('Material title and URL are required', 'error');
      return;
    }
    try {
      await apiClient.post(`/training/courses/${managingCourse._id}/materials`, materialForm);
      showToastMsg('Material resource added');
      setMaterialForm({ title: '', materialType: 'Document', url: '', fileName: '', notes: '' });
      reloadCourseDetails(managingCourse._id);
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to add material', 'error');
    }
  };

  const handleDeleteMaterial = async (matId) => {
    if (!window.confirm('Delete this material item?')) return;
    try {
      await apiClient.delete(`/training/courses/${managingCourse._id}/materials/${matId}`);
      showToastMsg('Material removed');
      reloadCourseDetails(managingCourse._id);
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to delete material', 'error');
    }
  };

  const handleLinkProgramToCourse = async (e) => {
    e.preventDefault();
    if (!managingCourse || !courseLinkProgramId) return;
    try {
      await apiClient.post(`/training/courses/${managingCourse._id}/programs`, { programId: courseLinkProgramId });
      showToastMsg('Course linked to program');
      setCourseLinkProgramId('');
      reloadCourseDetails(managingCourse._id);
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to link program', 'error');
    }
  };

  const handleUnlinkProgramFromCourse = async (programId) => {
    if (!window.confirm('Unlink this course from this program?')) return;
    try {
      await apiClient.delete(`/training/courses/${managingCourse._id}/programs/${programId}`);
      showToastMsg('Course unlinked from program');
      reloadCourseDetails(managingCourse._id);
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to unlink program', 'error');
    }
  };

  const handleSaveAssessmentConfig = async (e) => {
    e.preventDefault();
    if (!managingCourse) return;
    try {
      await apiClient.put(`/training/courses/${managingCourse._id}/assessment-config`, assessmentConfigForm);
      showToastMsg('Assessment settings updated');
      reloadCourseDetails(managingCourse._id);
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to update assessment config', 'error');
    }
  };

  const handleSaveCertConfig = async (e) => {
    e.preventDefault();
    if (!managingCourse) return;
    try {
      await apiClient.put(`/training/courses/${managingCourse._id}/certification-config`, certConfigForm);
      showToastMsg('Certification criteria updated');
      reloadCourseDetails(managingCourse._id);
    } catch (err) {
      showToastMsg(err.response?.data?.message || 'Failed to update certification config', 'error');
    }
  };

  /* ──────────────── RENDER TAB CONTENTS ──────────────── */

  const renderOverview = () => {
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
        {/* Row 1: Training Progress | Recent Training Activity */}
        <div className="hrtm-overview-grid">
          {/* Training Progress Widget */}
          <div className="hrtm-card">
            <div className="hrtm-card-header">
              <h2 className="hrtm-section-heading">Training Progress</h2>
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

          {/* Recent Training Activity */}
          <div className="hrtm-card">
            <div className="hrtm-card-header">
              <h2 className="hrtm-section-heading">Recent Training Activity</h2>
              <button className="hrtm-btn hrtm-btn-secondary hrtm-btn-sm" onClick={() => setActiveTab('assignments')}>View All</button>
            </div>
            <div className="hrtm-table-wrap">
              <table className="hrtm-table">
                <thead>
                  <tr>
                    <th style={{ width: '28%', minWidth: '180px' }}>Employee</th>
                    <th style={{ width: '42%', minWidth: '220px' }}>Program / Course</th>
                    <th style={{ width: '15%', minWidth: '100px' }}>Status</th>
                    <th style={{ width: '15%', minWidth: '110px' }}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.length === 0 ? (
                    <tr><td colSpan="4" className="hrtm-empty">No recent training activity</td></tr>
                  ) : (
                    recentActivity.map(act => (
                      <tr key={act._id}>
                        <td><span className="hrtm-primary-title">{getEmpName(act.employee)}</span></td>
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
        </div>

        {/* Row 2: Top Performing Programs */}
        <div className="hrtm-card" style={{ marginBottom: '1.25rem' }}>
          <div className="hrtm-card-header">
            <h2 className="hrtm-section-heading">Top Performing Programs</h2>
            <button className="hrtm-btn hrtm-btn-secondary hrtm-btn-sm" onClick={() => setActiveTab('programs')}>View All</button>
          </div>
          <div className="hrtm-table-wrap">
            <table className="hrtm-table">
              <thead>
                <tr>
                  <th style={{ width: '35%', minWidth: '180px' }}>Program</th>
                  <th style={{ width: '20%', minWidth: '110px' }}>Participants</th>
                  <th style={{ width: '20%', minWidth: '110px' }}>Completion Rate</th>
                  <th style={{ width: '25%', minWidth: '140px' }}>Progress</th>
                </tr>
              </thead>
              <tbody>
                {topPrograms.length === 0 ? (
                  <tr><td colSpan="4" className="hrtm-empty">No performance data available</td></tr>
                ) : (
                  topPrograms.map(tp => (
                    <tr key={tp._id}>
                      <td><span className="hrtm-primary-title">{tp.name}</span></td>
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
    );
  };

  const renderPrograms = () => {
    const list = programs.filter(p => {
      const q = (search || '').toLowerCase();
      if (!q) return true;
      return (
        p.name?.toLowerCase().includes(q) ||
        p.programCode?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.department?.name?.toLowerCase().includes(q)
      );
    });

    return (
      <div className="hrtm-card">
        <div className="hrtm-card-header">
          <div>
            <h2 className="hrtm-section-heading">Training Programs</h2>
            <span className="hrtm-section-subtext">
              {list.length} program{list.length === 1 ? '' : 's'} managed
            </span>
          </div>
          <button className="hrtm-btn hrtm-btn-primary hrtm-btn-sm" onClick={() => openCreateModal('program')}>
            + Create Program
          </button>
        </div>
        <div className="hrtm-table-wrap">
          <table className="hrtm-table">
            <thead>
              <tr>
                <th style={{ width: '28%', minWidth: '270px' }}>Program Name & Code</th>
                <th style={{ width: '13%', minWidth: '140px' }}>Type & Category</th>
                <th style={{ width: '12%', minWidth: '130px' }}>Department</th>
                <th style={{ width: '9%', minWidth: '95px' }}>Status</th>
                <th style={{ width: '10%', minWidth: '115px' }}>Courses / Capacity</th>
                <th style={{ width: '12%', minWidth: '145px' }}>Schedule & Hours</th>
                <th style={{ width: '8%', minWidth: '90px' }}>Budget</th>
                <th style={{ width: '8%', minWidth: '160px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan="8" className="hrtm-empty">No training programs found</td></tr>
              ) : list.map(p => (
                <tr key={p._id}>
                  <td>
                    <div className="hrtm-primary-cell">
                      <div className="hrtm-primary-title-row">
                        <span className="hrtm-primary-title">{p.name}</span>
                        {p.programCode && <span className="hrtm-code-badge">{p.programCode}</span>}
                      </div>
                      <span className="hrtm-cell-subtext" title={p.description}>
                        {p.description || 'No description provided'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <span className="hrtm-badge hrtm-badge-internal">{p.trainingType || 'Internal'}</span>
                      <span className="hrtm-code-badge" style={{ background: '#f8fafc', color: '#475569' }}>
                        {p.category || 'General'}
                      </span>
                    </div>
                  </td>
                  <td>{p.department?.name || 'All Departments'}</td>
                  <td>
                    <span className={`hrtm-badge hrtm-badge-${(p.status || '').toLowerCase()}`}>
                      <span className="hrtm-badge-dot" />
                      {p.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>
                      {Array.isArray(p.courses) ? p.courses.length : 0} Courses
                    </div>
                    {p.capacity ? (
                      <span className="hrtm-cell-subtext">Max {p.capacity} seats</span>
                    ) : null}
                  </td>
                  <td>
                    <div style={{ whiteSpace: 'nowrap' }}>{formatDate(p.startDate)} – {formatDate(p.endDate)}</div>
                    {p.totalHours ? <span className="hrtm-cell-subtext">⏱️ {p.totalHours} hrs</span> : null}
                  </td>
                  <td>
                    <strong style={{ fontSize: '0.8125rem' }}>
                      {p.currency === 'USD' ? '$' : p.currency === 'EUR' ? '€' : '₹'}
                      {(p.budget || 0).toLocaleString()}
                    </strong>
                  </td>
                  <td>
                    <div className="hrtm-action-group" style={{ justifyContent: 'center' }}>
                      <button
                        type="button"
                        className="hrtm-action-btn hrtm-action-btn-view"
                        title="View & Manage Program"
                        onClick={() => openManageProgram(p)}
                      >
                        👁️ Manage
                      </button>
                      <button
                        type="button"
                        className="hrtm-action-btn hrtm-action-btn-edit"
                        title="Edit Program"
                        onClick={() => openEditModal('program', p)}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        className="hrtm-action-btn hrtm-action-btn-delete"
                        title="Delete Program"
                        onClick={() => handleDelete('program', p._id)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
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
    // 1. Insights counts
    const totalCount = courses.length;
    const activeCount = courses.filter(c => c.status === 'Active').length;
    const draftCount = courses.filter(c => c.status === 'Draft').length;
    const archivedCount = courses.filter(c => c.status === 'Archived' || c.status === 'Inactive' || c.isArchived).length;

    // 2. Filter list
    const filteredCourses = courses.filter(c => {
      const q = (courseSearch || '').toLowerCase().trim();
      if (q) {
        const match = (
          c.title?.toLowerCase().includes(q) ||
          c.code?.toLowerCase().includes(q) ||
          c.category?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          (c.department?.name || '').toLowerCase().includes(q) ||
          (c.trainer?.name || getEmpName(c.trainer?.employee) || '').toLowerCase().includes(q)
        );
        if (!match) return false;
      }
      if (courseFilterCategory !== 'All' && c.category !== courseFilterCategory) return false;
      if (courseFilterDept !== 'All' && String(c.department?._id || c.department || '') !== String(courseFilterDept)) return false;
      if (courseFilterLevel !== 'All' && (c.difficulty || c.level) !== courseFilterLevel) return false;
      if (courseFilterStatus !== 'All' && c.status !== courseFilterStatus) return false;
      if (courseFilterTrainer !== 'All' && String(c.trainer?._id || c.trainer || '') !== String(courseFilterTrainer)) return false;
      return true;
    });

    const isFiltered = !!courseSearch || courseFilterCategory !== 'All' || courseFilterDept !== 'All' || courseFilterLevel !== 'All' || courseFilterStatus !== 'All' || courseFilterTrainer !== 'All';

    const resetCourseFilters = () => {
      setCourseSearch('');
      setCourseFilterCategory('All');
      setCourseFilterDept('All');
      setCourseFilterLevel('All');
      setCourseFilterStatus('All');
      setCourseFilterTrainer('All');
    };

    return (
      <div className="hrtm-courses-module">
        {/* A. Header Section */}
        <div className="hrtm-card" style={{ marginBottom: '1.25rem' }}>
          <div className="hrtm-card-header" style={{ padding: '0.95rem 1.25rem' }}>
            <div className="hrtm-course-title-area">
              <h2 className="hrtm-section-heading">Course Management & Curriculum</h2>
              <span className="hrtm-section-subtext">Independent course catalog, structured modules, learning objectives, multi-program associations, and certifications.</span>
            </div>
            <button className="hrtm-btn hrtm-btn-primary" onClick={() => openCreateModal('course')}>
              + Create Course
            </button>
          </div>
        </div>

        {/* B. Compact Animated Summary Insights Strip */}
        <div className="hrtm-course-summary-grid">
          <div className="hrtm-course-summary-card">
            <div className="hrtm-summary-icon-box" style={{ background: '#eff6ff', color: '#2563eb' }}>
              📚
            </div>
            <div className="hrtm-summary-info">
              <div className="hrtm-summary-count">
                <AnimatedNumber value={totalCount} />
              </div>
              <div className="hrtm-summary-label">Total Courses</div>
            </div>
          </div>
          <div className="hrtm-course-summary-card">
            <div className="hrtm-summary-icon-box" style={{ background: '#f0fdf4', color: '#16a34a' }}>
              🟢
            </div>
            <div className="hrtm-summary-info">
              <div className="hrtm-summary-count">
                <AnimatedNumber value={activeCount} />
              </div>
              <div className="hrtm-summary-label">Active Courses</div>
            </div>
          </div>
          <div className="hrtm-course-summary-card">
            <div className="hrtm-summary-icon-box" style={{ background: '#fefce8', color: '#ca8a04' }}>
              📝
            </div>
            <div className="hrtm-summary-info">
              <div className="hrtm-summary-count">
                <AnimatedNumber value={draftCount} />
              </div>
              <div className="hrtm-summary-label">Draft Courses</div>
            </div>
          </div>
          <div className="hrtm-course-summary-card">
            <div className="hrtm-summary-icon-box" style={{ background: '#f1f5f9', color: '#64748b' }}>
              📁
            </div>
            <div className="hrtm-summary-info">
              <div className="hrtm-summary-count">
                <AnimatedNumber value={archivedCount} />
              </div>
              <div className="hrtm-summary-label">Inactive / Archived</div>
            </div>
          </div>
        </div>

        {/* C. Dedicated Filter / Search Toolbar */}
        <div className="hrtm-course-filter-bar">
          <div className="hrtm-course-search-field">
            <span className="hrtm-search-glass-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by course title, code, category, trainer..."
              value={courseSearch}
              onChange={e => setCourseSearch(e.target.value)}
            />
          </div>
          <div className="hrtm-course-filter-dropdown">
            <CustomSelect
              options={[
                { value: 'All', label: 'All Categories' },
                { value: 'Technical', label: 'Technical' },
                { value: 'Leadership', label: 'Leadership' },
                { value: 'Compliance', label: 'Compliance' },
                { value: 'Soft Skills', label: 'Soft Skills' },
                { value: 'Product', label: 'Product' },
                { value: 'Sales', label: 'Sales' },
                { value: 'Safety', label: 'Safety' },
                { value: 'General', label: 'General' },
              ]}
              value={courseFilterCategory}
              onChange={setCourseFilterCategory}
              placeholder="All Categories"
            />
          </div>
          <div className="hrtm-course-filter-dropdown">
            <CustomSelect
              options={[
                { value: 'All', label: 'All Departments' },
                ...departments.map(d => ({ value: d._id, label: d.name }))
              ]}
              value={courseFilterDept}
              onChange={setCourseFilterDept}
              placeholder="All Departments"
            />
          </div>
          <div className="hrtm-course-filter-dropdown">
            <CustomSelect
              options={[
                { value: 'All', label: 'All Levels' },
                { value: 'Beginner', label: 'Beginner' },
                { value: 'Intermediate', label: 'Intermediate' },
                { value: 'Advanced', label: 'Advanced' },
              ]}
              value={courseFilterLevel}
              onChange={setCourseFilterLevel}
              placeholder="All Levels"
            />
          </div>
          <div className="hrtm-course-filter-dropdown">
            <CustomSelect
              options={[
                { value: 'All', label: 'All Statuses' },
                { value: 'Active', label: 'Active' },
                { value: 'Draft', label: 'Draft' },
                { value: 'Inactive', label: 'Inactive' },
                { value: 'Archived', label: 'Archived' },
              ]}
              value={courseFilterStatus}
              onChange={setCourseFilterStatus}
              placeholder="All Statuses"
            />
          </div>
          <div className="hrtm-course-filter-dropdown">
            <CustomSelect
              options={[
                { value: 'All', label: 'All Trainers' },
                ...trainers.map(t => ({
                  value: t._id,
                  label: t.trainerType === 'Internal' ? getEmpName(t.employee) : t.name
                }))
              ]}
              value={courseFilterTrainer}
              onChange={setCourseFilterTrainer}
              placeholder="All Trainers"
            />
          </div>
          {isFiltered && (
            <button
              type="button"
              className="hrtm-filter-reset-btn"
              onClick={resetCourseFilters}
              title="Reset all filters"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* D. Professional 10-Column Course Table */}
        <div className="hrtm-card">
          <div className="hrtm-table-wrap">
            <table className="hrtm-table">
              <thead>
                <tr>
                  <th style={{ width: '25%', minWidth: '260px' }}>Course Title & Description</th>
                  <th style={{ width: '8%', minWidth: '95px' }}>Course Code</th>
                  <th style={{ width: '9%', minWidth: '105px' }}>Category</th>
                  <th style={{ width: '8%', minWidth: '90px' }}>Level</th>
                  <th style={{ width: '10%', minWidth: '120px' }}>Department</th>
                  <th style={{ width: '8%', minWidth: '85px' }}>Duration</th>
                  <th style={{ width: '11%', minWidth: '120px' }}>Trainer</th>
                  <th style={{ width: '8%', minWidth: '105px' }}>Linked Programs</th>
                  <th style={{ width: '7%', minWidth: '90px' }}>Status</th>
                  <th style={{ width: '6%', minWidth: '160px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="hrtm-empty">
                      {isFiltered ? 'No courses match current search or filters' : 'No courses registered in catalog. Click "+ Create Course" to add one.'}
                    </td>
                  </tr>
                ) : (
                  filteredCourses.map(c => {
                    const linkedProgCount = Array.isArray(c.programs) ? c.programs.length : 0;
                    const trainerName = c.trainer
                      ? (c.trainer.trainerType === 'Internal' ? getEmpName(c.trainer.employee) : c.trainer.name)
                      : (c.trainingProvider || '—');
                    const deptName = c.department?.name || 'All Departments';
                    const level = c.difficulty || c.level || 'Beginner';
                    const status = c.status || 'Draft';
                    const durHours = c.durationHours ?? c.duration ?? 0;

                    return (
                      <tr key={c._id}>
                        {/* 1. Title & Description */}
                        <td>
                          <div className="hrtm-primary-cell">
                            <span className="hrtm-primary-title">{c.title}</span>
                            <span className="hrtm-cell-subtext" title={c.description}>
                              {c.description || 'No description provided'}
                            </span>
                          </div>
                        </td>

                        {/* 2. Course Code */}
                        <td>
                          {c.code ? (
                            <span className="hrtm-code-badge">{c.code}</span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Auto</span>
                          )}
                        </td>

                        {/* 3. Category */}
                        <td>
                          <span className="hrtm-code-badge" style={{ background: '#f8fafc', color: '#334155', borderColor: '#e2e8f0' }}>
                            {c.category || 'General'}
                          </span>
                        </td>

                        {/* 4. Level */}
                        <td>
                          <span className={`hrtm-badge hrtm-badge-${level.toLowerCase()}`}>
                            {level}
                          </span>
                        </td>

                        {/* 5. Department */}
                        <td>
                          <span style={{ color: '#334155', fontSize: '0.82rem' }}>{deptName}</span>
                        </td>

                        {/* 6. Duration */}
                        <td>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>
                            {durHours} hrs
                          </span>
                          {c.durationUnit && c.durationUnit !== 'Hours' && (
                            <small style={{ display: 'block', color: '#64748b', fontSize: '0.72rem' }}>
                              ({c.duration} {c.durationUnit})
                            </small>
                          )}
                        </td>

                        {/* 7. Trainer */}
                        <td>
                          <span style={{ fontSize: '0.82rem', color: '#1e293b' }}>
                            {trainerName}
                          </span>
                        </td>

                        {/* 8. Linked Programs */}
                        <td>
                          {linkedProgCount > 0 ? (
                            <span className="hrtm-program-pill" title={c.programs.map(p => p.name || p).join(', ')}>
                              📁 {linkedProgCount} {linkedProgCount === 1 ? 'Program' : 'Programs'}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Unlinked</span>
                          )}
                        </td>

                        {/* 9. Status */}
                        <td>
                          <span className={`hrtm-badge hrtm-badge-${status.toLowerCase()}`}>
                            <span className="hrtm-badge-dot" />
                            {status}
                          </span>
                        </td>

                        {/* 10. Actions */}
                        <td>
                          <div className="hrtm-action-group" style={{ justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="hrtm-action-btn hrtm-action-btn-view"
                              title="View & Manage Course Details"
                              onClick={() => openManageCourse(c)}
                            >
                              👁️ Manage
                            </button>
                            <button
                              type="button"
                              className="hrtm-action-btn hrtm-action-btn-edit"
                              title="Edit Course"
                              onClick={() => openEditModal('course', c)}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              className="hrtm-action-btn hrtm-action-btn-delete"
                              title="Archive or Delete Course"
                              onClick={() => handleDelete('course', c._id)}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderTrainers = () => {
    const list = trainers.filter(t => (t.name || getEmpName(t.employee))?.toLowerCase().includes(search.toLowerCase()));
    return (
      <div className="hrtm-card">
        <div className="hrtm-card-header">
          <div>
            <h2 className="hrtm-section-heading">Trainer Registry</h2>
            <span className="hrtm-section-subtext">{list.length} trainer{list.length === 1 ? '' : 's'} registered</span>
          </div>
          <button className="hrtm-btn hrtm-btn-primary hrtm-btn-sm" onClick={() => openCreateModal('trainer')}>
            + Add Trainer
          </button>
        </div>
        <div className="hrtm-table-wrap">
          <table className="hrtm-table">
            <thead>
              <tr>
                <th style={{ width: '22%', minWidth: '180px' }}>Trainer</th>
                <th style={{ width: '12%', minWidth: '100px' }}>Type</th>
                <th style={{ width: '28%', minWidth: '220px' }}>Organization / Expertise</th>
                <th style={{ width: '18%', minWidth: '160px' }}>Contact</th>
                <th style={{ width: '10%', minWidth: '95px' }}>Status</th>
                <th style={{ width: '10%', minWidth: '130px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan="6" className="hrtm-empty">No trainers found</td></tr>
              ) : list.map(t => (
                <tr key={t._id}>
                  <td>
                    <span className="hrtm-primary-title">{t.trainerType === 'Internal' ? getEmpName(t.employee) : t.name}</span>
                  </td>
                  <td><span className={`hrtm-badge hrtm-badge-${(t.trainerType || '').toLowerCase()}`}>{t.trainerType}</span></td>
                  <td>{t.organization || (t.expertise || []).join(', ') || '—'}</td>
                  <td>{t.email || t.phone || '—'}</td>
                  <td><span className={`hrtm-badge hrtm-badge-${(t.status || '').toLowerCase()}`}><span className="hrtm-badge-dot" />{t.status}</span></td>
                  <td>
                    <div className="hrtm-action-group" style={{ justifyContent: 'center' }}>
                      <button type="button" className="hrtm-action-btn hrtm-action-btn-edit" onClick={() => openEditModal('trainer', t)} title="Edit Trainer">✏️ Edit</button>
                      <button type="button" className="hrtm-action-btn hrtm-action-btn-delete" onClick={() => handleDelete('trainer', t._id)} title="Delete Trainer">🗑️ Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };



  /* ──────────────── CONSOLIDATED EMPLOYEE ASSIGNMENTS & ASSESSMENTS ──────────────── */

  const getAssignmentAssessment = (assignment) => {
    if (!assignment) return null;
    const courseId = String(assignment.course?._id || assignment.course || '');
    const progId = String(assignment.program?._id || assignment.program || '');
    const empId = String(assignment.employee?._id || assignment.employee || '');

    // Check if any assessment directly assigned this employee
    let match = assessments.find(asmt => {
      const asmtCourseId = String(asmt.course?._id || asmt.course || '');
      const isAssigned = Array.isArray(asmt.assignedEmployees) && asmt.assignedEmployees.some(e => String(e._id || e) === empId);
      return isAssigned && (!courseId || asmtCourseId === courseId);
    });

    // Otherwise match by course
    if (!match && courseId) {
      match = assessments.find(asmt => String(asmt.course?._id || asmt.course || '') === courseId);
    }

    // Otherwise match by program
    if (!match && progId) {
      match = assessments.find(asmt => String(asmt.program?._id || asmt.program || '') === progId);
    }

    return match || null;
  };

  const getAssignmentSubmission = (assignment, matchedAsmt) => {
    if (!assignment) return null;
    const empId = String(assignment.employee?._id || assignment.employee || '');
    const courseId = String(assignment.course?._id || assignment.course || '');
    const asmtId = matchedAsmt ? String(matchedAsmt._id) : null;

    return assessmentSubmissions.find(sub => {
      const subEmpId = String(sub.employee?._id || sub.employee || '');
      if (subEmpId !== empId) return false;
      if (asmtId && String(sub.assessmentId || sub.assessment?._id || sub.assessment) === asmtId) return true;
      if (courseId && String(sub.course?._id || sub.course) === courseId) return true;
      return false;
    }) || null;
  };

  const getAssignmentCertification = (assignment) => {
    if (!assignment) return null;
    const empId = String(assignment.employee?._id || assignment.employee || '');
    const courseId = String(assignment.course?._id || assignment.course || '');

    return certifications.find(cert => {
      const certEmpId = String(cert.employee?._id || cert.employee || '');
      const certCourseId = String(cert.course?._id || cert.course || '');
      return certEmpId === empId && (!courseId || certCourseId === courseId);
    }) || null;
  };

  const getAssignmentProgress = (assignment) => {
    if (!assignment) return null;
    const empId = String(assignment.employee?._id || assignment.employee || '');
    const courseId = String(assignment.course?._id || assignment.course || '');

    return progressData.find(p => {
      const pEmpId = String(p.employee?._id || p.employee || '');
      const pCourseId = String(p.course?._id || p.course || '');
      return pEmpId === empId && (!courseId || pCourseId === courseId);
    }) || null;
  };

  const renderAssignments = () => {
    // Dynamic KPI Calculations from Live MongoDB Atlas Data
    const totalAssignments = assignments.length;
    const inProgressAssignments = assignments.filter(a => a.status === 'In Progress' || a.status === 'Assigned' || a.status === 'Enrolled').length;
    const completedAssignments = assignments.filter(a => a.status === 'Completed').length;
    const overdueAssignments = assignments.filter(a => a.dueDate && new Date(a.dueDate) < new Date() && a.status !== 'Completed').length;
    const pendingCompletionAssignments = assignments.filter(a => a.status !== 'Completed').length;

    // Filtered list for Assignments
    const qSearch = (asgnSearch || '').toLowerCase().trim();
    const filteredAssignments = assignments.filter(a => {
      const empName = getEmpName(a.employee).toLowerCase();
      const empId = String(a.employee?.employeeId || a.employee?._id || '').toLowerCase();
      const empEmail = String(a.employee?.email || '').toLowerCase();
      const progName = (a.program?.name || '').toLowerCase();
      const courseTitle = (a.course?.title || '').toLowerCase();

      if (qSearch) {
        const matches =
          empName.includes(qSearch) ||
          empId.includes(qSearch) ||
          empEmail.includes(qSearch) ||
          progName.includes(qSearch) ||
          courseTitle.includes(qSearch);
        if (!matches) return false;
      }

      if (asgnFilterProgram !== 'All' && String(a.program?._id || a.program) !== asgnFilterProgram) return false;
      if (asgnFilterCourse !== 'All' && String(a.course?._id || a.course) !== asgnFilterCourse) return false;
      if (asgnFilterDept !== 'All' && !(a.employee?.department || '').toLowerCase().includes(asgnFilterDept.toLowerCase())) return false;
      if (asgnFilterTrainingStatus !== 'All' && a.status !== asgnFilterTrainingStatus) return false;

      if (asgnFilterCompletionStatus !== 'All') {
        const isCompleted = a.status === 'Completed';
        if (asgnFilterCompletionStatus === 'Completed' && !isCompleted) return false;
        if (asgnFilterCompletionStatus === 'In Progress' && isCompleted) return false;
      }

      return true;
    });

    return (
      <div className="hrtm-card">
        {/* Dynamic KPIs */}
        <div className="hrtm-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div className="hrtm-kpi-card" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #2563eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="hrtm-kpi-label" style={{ fontSize: '0.72rem', color: '#64748b' }}>Total Assignments</span>
              <span style={{ fontSize: '1.1rem' }}>👥</span>
            </div>
            <div className="hrtm-kpi-value" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
              <AnimatedNumber value={totalAssignments} />
            </div>
          </div>
          <div className="hrtm-kpi-card" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #3b82f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="hrtm-kpi-label" style={{ fontSize: '0.72rem', color: '#64748b' }}>In Progress</span>
              <span style={{ fontSize: '1.1rem' }}>⏳</span>
            </div>
            <div className="hrtm-kpi-value" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>
              <AnimatedNumber value={inProgressAssignments} />
            </div>
          </div>
          <div className="hrtm-kpi-card" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #10b981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="hrtm-kpi-label" style={{ fontSize: '0.72rem', color: '#64748b' }}>Completed</span>
              <span style={{ fontSize: '1.1rem' }}>✅</span>
            </div>
            <div className="hrtm-kpi-value" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#059669', marginTop: '4px' }}>
              <AnimatedNumber value={completedAssignments} />
            </div>
          </div>
          <div className="hrtm-kpi-card" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #ef4444' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="hrtm-kpi-label" style={{ fontSize: '0.72rem', color: '#64748b' }}>Overdue</span>
              <span style={{ fontSize: '1.1rem' }}>⚠️</span>
            </div>
            <div className="hrtm-kpi-value" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#dc2626', marginTop: '4px' }}>
              <AnimatedNumber value={overdueAssignments} />
            </div>
          </div>
          <div className="hrtm-kpi-card" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="hrtm-kpi-label" style={{ fontSize: '0.72rem', color: '#64748b' }}>Pending Completion</span>
              <span style={{ fontSize: '1.1rem' }}>📋</span>
            </div>
            <div className="hrtm-kpi-value" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#7c3aed', marginTop: '4px' }}>
              <AnimatedNumber value={pendingCompletionAssignments} />
            </div>
          </div>
        </div>

        {/* Header with Title & Action Button */}
        <div className="hrtm-card-header" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div>
            <h2 className="hrtm-section-heading">Assignments</h2>
            <span className="hrtm-section-subtext">Assign and manage training programs and courses to employees</span>
          </div>
          <button
            type="button"
            className="hrtm-btn hrtm-btn-primary hrtm-btn-sm"
            onClick={() => openCreateModal('assignment')}
          >
            + Assign Employee(s)
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="hrtm-filter-toolbar" style={{ marginBottom: '1rem' }}>
          <div className="hrtm-filter-group" style={{ flexWrap: 'wrap' }}>
            <input
              type="text"
              className="hrtm-search"
              placeholder="Search Employee, ID, Course, Program..."
              value={asgnSearch}
              onChange={e => setAsgnSearch(e.target.value)}
              style={{ minWidth: '220px' }}
            />
            <div style={{ minWidth: '150px' }}>
              <CustomSelect
                options={[{ value: 'All', label: 'All Programs' }, ...programs.map(p => ({ value: p._id, label: p.name }))]}
                value={asgnFilterProgram}
                onChange={setAsgnFilterProgram}
                placeholder="All Programs"
              />
            </div>
            <div style={{ minWidth: '150px' }}>
              <CustomSelect
                options={[{ value: 'All', label: 'All Courses' }, ...courses.map(c => ({ value: c._id, label: c.title }))]}
                value={asgnFilterCourse}
                onChange={setAsgnFilterCourse}
                placeholder="All Courses"
              />
            </div>
            <div style={{ minWidth: '140px' }}>
              <CustomSelect
                options={[{ value: 'All', label: 'All Departments' }, ...departments.map(d => ({ value: d.name, label: d.name }))]}
                value={asgnFilterDept}
                onChange={setAsgnFilterDept}
                placeholder="All Departments"
              />
            </div>
            <div style={{ minWidth: '140px' }}>
              <CustomSelect
                options={[
                  { value: 'All', label: 'All Training Statuses' },
                  { value: 'Assigned', label: 'Assigned' },
                  { value: 'In Progress', label: 'In Progress' },
                  { value: 'Completed', label: 'Completed' },
                  { value: 'Overdue', label: 'Overdue' },
                  { value: 'Cancelled', label: 'Cancelled' }
                ]}
                value={asgnFilterTrainingStatus}
                onChange={setAsgnFilterTrainingStatus}
                placeholder="Training Status"
              />
            </div>
            <div style={{ minWidth: '140px' }}>
              <CustomSelect
                options={[
                  { value: 'All', label: 'All Completion' },
                  { value: 'Completed', label: 'Completed' },
                  { value: 'In Progress', label: 'In Progress' }
                ]}
                value={asgnFilterCompletionStatus}
                onChange={setAsgnFilterCompletionStatus}
                placeholder="Completion Status"
              />
            </div>
            {(asgnSearch || asgnFilterProgram !== 'All' || asgnFilterCourse !== 'All' || asgnFilterDept !== 'All' || asgnFilterTrainingStatus !== 'All' || asgnFilterCompletionStatus !== 'All') && (
              <button
                type="button"
                className="hrtm-btn hrtm-btn-secondary hrtm-btn-sm"
                onClick={() => {
                  setAsgnSearch('');
                  setAsgnFilterProgram('All');
                  setAsgnFilterCourse('All');
                  setAsgnFilterDept('All');
                  setAsgnFilterTrainingStatus('All');
                  setAsgnFilterCompletionStatus('All');
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Assignments Table */}
        <div className="hrtm-table-wrap">
          <table className="hrtm-table">
            <thead>
              <tr>
                <th style={{ width: '16%', minWidth: '150px' }}>Employee</th>
                <th style={{ width: '9%', minWidth: '95px' }}>Employee ID</th>
                <th style={{ width: '10%', minWidth: '100px' }}>Department</th>
                <th style={{ width: '11%', minWidth: '110px' }}>Designation</th>
                <th style={{ width: '12%', minWidth: '120px' }}>Program</th>
                <th style={{ width: '12%', minWidth: '120px' }}>Course</th>
                <th style={{ width: '8%', minWidth: '85px' }}>Assigned</th>
                <th style={{ width: '8%', minWidth: '85px' }}>Due Date</th>
                <th style={{ width: '9%', minWidth: '95px' }}>Progress</th>
                <th style={{ width: '8%', minWidth: '85px' }}>Training Status</th>
                <th style={{ width: '8%', minWidth: '85px' }}>Completion</th>
                <th style={{ width: '11%', minWidth: '160px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan="12" className="hrtm-empty">
                    No assignments found matching your filter criteria. Click "+ Assign Employee(s)" to create an assignment.
                  </td>
                </tr>
              ) : (
                filteredAssignments.map(a => {
                  const prog = getAssignmentProgress(a);
                  const progressPct = a.progress !== undefined && a.progress !== null
                    ? a.progress
                    : (prog?.progressPercent !== undefined ? prog.progressPercent : (a.status === 'Completed' ? 100 : (a.status === 'In Progress' ? 50 : 0)));

                  const empIdStr = a.employee?.employeeId || (a.employee?._id ? `EMP-${String(a.employee._id).slice(-6).toUpperCase()}` : 'EMP-001');
                  const isOverdue = a.dueDate && new Date(a.dueDate) < new Date() && a.status !== 'Completed';

                  return (
                    <tr key={a._id}>
                      {/* Employee */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            flexShrink: 0
                          }}>
                            {(a.employee?.firstName?.[0] || 'E').toUpperCase()}
                          </div>
                          <div>
                            <span className="hrtm-primary-title">{getEmpName(a.employee)}</span>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{a.employee?.email || '—'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Employee ID */}
                      <td>
                        <span className="hrtm-code-badge">{empIdStr}</span>
                      </td>

                      {/* Department */}
                      <td>
                        <span className="hrtm-badge hrtm-badge-secondary" style={{ fontSize: '0.72rem' }}>
                          {a.employee?.department || 'General'}
                        </span>
                      </td>

                      {/* Designation */}
                      <td>
                        <span style={{ fontSize: '0.78rem', color: '#334155' }}>
                          {a.employee?.designation || 'Staff / Specialist'}
                        </span>
                      </td>

                      {/* Program */}
                      <td>
                        <span className="hrtm-primary-title" style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                          {a.program?.name || 'General Program'}
                        </span>
                      </td>

                      {/* Course */}
                      <td>
                        <span style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: 500 }}>
                          {a.course?.title || '—'}
                        </span>
                      </td>

                      {/* Assigned Date */}
                      <td>
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          {formatDate(a.startDate || a.createdAt)}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td>
                        <span style={{ fontSize: '0.78rem', color: isOverdue ? '#dc2626' : '#64748b', fontWeight: isOverdue ? 600 : 400 }}>
                          {formatDate(a.dueDate)}
                        </span>
                      </td>

                      {/* Progress */}
                      <td>
                        <div className="hrtm-progress-cell" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div className="hrtm-progress-bar" style={{ width: '45px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div className="hrtm-progress-fill" style={{ width: `${progressPct}%`, height: '100%', background: progressPct >= 100 ? '#10b981' : '#2563eb' }} />
                          </div>
                          <span style={{ fontSize: '0.73rem', fontWeight: 600, color: '#334155' }}>{progressPct}%</span>
                        </div>
                      </td>

                      {/* Training Status */}
                      <td>
                        <span className={`hrtm-badge hrtm-badge-${(a.status || 'assigned').toLowerCase().replace(' ', '-')}`}>
                          <span className="hrtm-badge-dot" />
                          {a.status || 'Assigned'}
                        </span>
                      </td>

                      {/* Completion Status */}
                      <td>
                        {a.status === 'Completed' ? (
                          <span className="hrtm-badge hrtm-badge-completed" title={`Completed on ${formatDate(a.completionDate || a.updatedAt)}`}>
                            <span className="hrtm-badge-dot" />Completed
                          </span>
                        ) : (
                          <span className="hrtm-badge hrtm-badge-in-progress">
                            <span className="hrtm-badge-dot" />In Progress
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="hrtm-action-group" style={{ justifyContent: 'center', gap: '0.28rem' }}>
                          <button
                            type="button"
                            className="hrtm-action-btn hrtm-action-btn-view"
                            title="View Assignment Details"
                            onClick={() => setViewingAssignment(a)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="hrtm-action-btn hrtm-action-btn-edit"
                            title="Edit Assignment"
                            onClick={() => openEditModal('assignment', a)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="hrtm-action-btn hrtm-action-btn-delete"
                            title="Delete Assignment"
                            onClick={() => handleDelete('assignment', a._id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAttendance = () => (
    <div className="hrtm-card">
      <div className="hrtm-card-header">
        <div>
          <h2 className="hrtm-section-heading">Session Attendance Records</h2>
          <span className="hrtm-section-subtext">{attendance.length} attendance record{attendance.length === 1 ? '' : 's'}</span>
        </div>
        <button className="hrtm-btn hrtm-btn-primary hrtm-btn-sm" onClick={() => openCreateModal('attendance')}>+ Record Attendance</button>
      </div>
      <div className="hrtm-table-wrap">
        <table className="hrtm-table">
          <thead>
            <tr>
              <th style={{ width: '22%', minWidth: '180px' }}>Employee</th>
              <th style={{ width: '25%', minWidth: '200px' }}>Session</th>
              <th style={{ width: '14%', minWidth: '120px' }}>Date</th>
              <th style={{ width: '10%', minWidth: '95px' }}>Status</th>
              <th style={{ width: '21%', minWidth: '160px' }}>Remarks</th>
              <th style={{ width: '8%', minWidth: '80px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {attendance.length === 0 ? (
              <tr><td colSpan="6" className="hrtm-empty">No attendance records found</td></tr>
            ) : attendance.map(att => (
              <tr key={att._id}>
                <td><span className="hrtm-primary-title">{getEmpName(att.employee)}</span></td>
                <td>{att.session?.sessionTitle || '—'}</td>
                <td>{formatDate(att.date)}</td>
                <td><span className={`hrtm-badge hrtm-badge-${(att.status || '').toLowerCase()}`}><span className="hrtm-badge-dot" />{att.status}</span></td>
                <td><span className="hrtm-cell-subtext">{att.remarks || '—'}</span></td>
                <td>
                  <div className="hrtm-action-group" style={{ justifyContent: 'center' }}>
                    <button type="button" className="hrtm-action-btn hrtm-action-btn-delete" onClick={() => handleDelete('attendance', att._id)} title="Delete Record">🗑️</button>
                  </div>
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
        <div>
          <h2 className="hrtm-section-heading">Employee Progress Tracking</h2>
          <span className="hrtm-section-subtext">{progressData.length} participant progress record{progressData.length === 1 ? '' : 's'}</span>
        </div>
      </div>
      <div className="hrtm-table-wrap">
        <table className="hrtm-table">
          <thead>
            <tr>
              <th style={{ width: '20%', minWidth: '170px' }}>Employee</th>
              <th style={{ width: '24%', minWidth: '200px' }}>Program / Course</th>
              <th style={{ width: '15%', minWidth: '130px' }}>Sessions Attended</th>
              <th style={{ width: '18%', minWidth: '160px' }}>Progress</th>
              <th style={{ width: '12%', minWidth: '110px' }}>Assessment Result</th>
              <th style={{ width: '11%', minWidth: '95px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {progressData.length === 0 ? (
              <tr><td colSpan="6" className="hrtm-empty">No progress records available</td></tr>
            ) : progressData.map(p => (
              <tr key={p._id}>
                <td><span className="hrtm-primary-title">{getEmpName(p.employee)}</span></td>
                <td>
                  <div className="hrtm-primary-cell">
                    <span className="hrtm-primary-title" style={{ fontWeight: 500 }}>{p.program?.name || '—'}</span>
                    {p.course?.title && <span className="hrtm-cell-subtext">Course: {p.course.title}</span>}
                  </div>
                </td>
                <td><strong>{p.attendedSessions || 0}</strong> / {p.totalSessions || 0}</td>
                <td>
                  <div className="hrtm-progress-cell">
                    <div className="hrtm-progress-bar">
                      <div className="hrtm-progress-fill" style={{ width: `${p.progressPercent}%` }} />
                    </div>
                    <span>{p.progressPercent}%</span>
                  </div>
                </td>
                <td><span className={`hrtm-badge hrtm-badge-${(p.assessmentResult || '').toLowerCase()}`}>{p.assessmentResult || 'Pending'}</span></td>
                <td><span className={`hrtm-badge hrtm-badge-${(p.assignmentStatus || '').toLowerCase().replace(' ', '-')}`}>{p.assignmentStatus || 'Enrolled'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
  /* ──────────────── ASSESSMENTS MANAGEMENT ──────────────── */
  const renderAssessments = () => {
    // Dynamic KPIs for Assessments from Live MongoDB Atlas Data
    const totalAssessments = assessments.length;
    const publishedAssessments = assessments.filter(a => a.status === 'Published').length;
    const totalSubmissions = assessmentSubmissions.length;
    const pendingEvaluations = assessmentSubmissions.filter(s => s.evaluationStatus === 'Pending' || s.evaluationStatus === 'Needs Review' || (s.submittedAt && s.evaluationStatus !== 'Evaluated')).length;
    const passedSubmissions = assessmentSubmissions.filter(s => s.passFail === 'Pass').length;
    const failedSubmissions = assessmentSubmissions.filter(s => s.passFail === 'Fail').length;

    // Filtered Assessments for Subtab 1
    const qAsmtSearch = asmtSearch.toLowerCase().trim();
    const filteredAssessments = assessments.filter(asmt => {
      const title = (asmt.title || asmt.name || '').toLowerCase();
      const courseTitle = (asmt.course?.title || '').toLowerCase();
      const progName = (asmt.program?.name || '').toLowerCase();
      if (qAsmtSearch && !title.includes(qAsmtSearch) && !courseTitle.includes(qAsmtSearch) && !progName.includes(qAsmtSearch)) return false;
      if (asmtFilterProgram !== 'All' && String(asmt.program?._id || asmt.program) !== asmtFilterProgram) return false;
      if (asmtFilterCourse !== 'All' && String(asmt.course?._id || asmt.course) !== asmtFilterCourse) return false;
      if (asmtFilterStatus !== 'All' && asmt.status !== asmtFilterStatus) return false;
      if (asmtFilterType !== 'All' && asmt.assessmentType !== asmtFilterType) return false;
      return true;
    });

    // Filtered Submissions for Subtab 2 & 3
    const filteredSubmissions = assessmentSubmissions.filter(sub => {
      const empName = getEmpName(sub.employee).toLowerCase();
      const asmtName = (sub.assessmentName || '').toLowerCase();
      const courseName = (sub.course?.title || '').toLowerCase();
      if (qAsmtSearch && !empName.includes(qAsmtSearch) && !asmtName.includes(qAsmtSearch) && !courseName.includes(qAsmtSearch)) return false;
      if (asmtFilterProgram !== 'All' && String(sub.program?._id || sub.program) !== asmtFilterProgram) return false;
      if (asmtFilterCourse !== 'All' && String(sub.course?._id || sub.course) !== asmtFilterCourse) return false;
      if (asmtFilterDept !== 'All' && !(sub.employee?.department || '').toLowerCase().includes(asmtFilterDept.toLowerCase())) return false;
      if (asmtFilterResult !== 'All' && sub.passFail !== asmtFilterResult) return false;
      if (asmtFilterStatus !== 'All' && sub.evaluationStatus !== asmtFilterStatus) return false;
      return true;
    });

    return (
      <div className="hrtm-card">
        {/* Dynamic KPIs */}
        <div className="hrtm-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div className="hrtm-kpi-card" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #7c3aed' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="hrtm-kpi-label" style={{ fontSize: '0.72rem', color: '#64748b' }}>Total Assessments</span>
              <span style={{ fontSize: '1.1rem' }}>📋</span>
            </div>
            <div className="hrtm-kpi-value" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#7c3aed', marginTop: '4px' }}>
              <AnimatedNumber value={totalAssessments} />
            </div>
          </div>
          <div className="hrtm-kpi-card" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #10b981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="hrtm-kpi-label" style={{ fontSize: '0.72rem', color: '#64748b' }}>Published / Active</span>
              <span style={{ fontSize: '1.1rem' }}>🚀</span>
            </div>
            <div className="hrtm-kpi-value" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#059669', marginTop: '4px' }}>
              <AnimatedNumber value={publishedAssessments} />
            </div>
          </div>
          <div className="hrtm-kpi-card" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #2563eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="hrtm-kpi-label" style={{ fontSize: '0.72rem', color: '#64748b' }}>Submissions</span>
              <span style={{ fontSize: '1.1rem' }}>📥</span>
            </div>
            <div className="hrtm-kpi-value" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>
              <AnimatedNumber value={totalSubmissions} />
            </div>
          </div>
          <div className="hrtm-kpi-card" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="hrtm-kpi-label" style={{ fontSize: '0.72rem', color: '#64748b' }}>Pending Evaluation</span>
              <span style={{ fontSize: '1.1rem' }}>⏳</span>
            </div>
            <div className="hrtm-kpi-value" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#d97706', marginTop: '4px' }}>
              <AnimatedNumber value={pendingEvaluations} />
            </div>
          </div>
          <div className="hrtm-kpi-card" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #16a34a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="hrtm-kpi-label" style={{ fontSize: '0.72rem', color: '#64748b' }}>Passed</span>
              <span style={{ fontSize: '1.1rem' }}>🏆</span>
            </div>
            <div className="hrtm-kpi-value" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#16a34a', marginTop: '4px' }}>
              <AnimatedNumber value={passedSubmissions} />
            </div>
          </div>
          <div className="hrtm-kpi-card" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid #ef4444' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="hrtm-kpi-label" style={{ fontSize: '0.72rem', color: '#64748b' }}>Failed</span>
              <span style={{ fontSize: '1.1rem' }}>⚠️</span>
            </div>
            <div className="hrtm-kpi-value" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#dc2626', marginTop: '4px' }}>
              <AnimatedNumber value={failedSubmissions} />
            </div>
          </div>
        </div>

        {/* Header with Title & Action Button */}
        <div className="hrtm-card-header" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div>
            <h2 className="hrtm-section-heading">Assessments</h2>
            <span className="hrtm-section-subtext">Employee learning evaluation, testing, questions, submissions, and grading</span>
          </div>
          <button
            type="button"
            className="hrtm-btn hrtm-btn-primary hrtm-btn-sm"
            onClick={() => openCreateAssessmentModal()}
          >
            + Create Assessment
          </button>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="hrtm-asmt-nav" style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            className={`hrtm-asmt-tab ${assessmentSubtab === 'assessments' ? 'active' : ''}`}
            onClick={() => setAssessmentSubtab('assessments')}
          >
            <span>📋</span> Assessment Catalog & Builder ({assessments.length})
          </button>
          <button
            type="button"
            className={`hrtm-asmt-tab ${assessmentSubtab === 'evaluations' ? 'active' : ''}`}
            onClick={() => setAssessmentSubtab('evaluations')}
          >
            <span>📝</span> Evaluation Queue ({pendingEvaluations})
          </button>
          <button
            type="button"
            className={`hrtm-asmt-tab ${assessmentSubtab === 'results' ? 'active' : ''}`}
            onClick={() => setAssessmentSubtab('results')}
          >
            <span>📊</span> Results & Performance ({totalSubmissions})
          </button>
        </div>

        {/* ── SUBTAB 1: ASSESSMENT CATALOG & BUILDER ── */}
        {assessmentSubtab === 'assessments' && (
          <>
            <div className="hrtm-filter-toolbar" style={{ marginBottom: '1rem' }}>
              <div className="hrtm-filter-group" style={{ flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="hrtm-search"
                  placeholder="Search Assessment, Course, Program..."
                  value={asmtSearch}
                  onChange={e => setAsmtSearch(e.target.value)}
                  style={{ minWidth: '220px' }}
                />
                <div style={{ minWidth: '150px' }}>
                  <CustomSelect
                    options={[{ value: 'All', label: 'All Programs' }, ...programs.map(p => ({ value: p._id, label: p.name }))]}
                    value={asmtFilterProgram}
                    onChange={setAsmtFilterProgram}
                    placeholder="All Programs"
                  />
                </div>
                <div style={{ minWidth: '150px' }}>
                  <CustomSelect
                    options={[{ value: 'All', label: 'All Courses' }, ...courses.map(c => ({ value: c._id, label: c.title }))]}
                    value={asmtFilterCourse}
                    onChange={setAsmtFilterCourse}
                    placeholder="All Courses"
                  />
                </div>
                <div style={{ minWidth: '130px' }}>
                  <CustomSelect
                    options={[{ value: 'All', label: 'All Statuses' }, { value: 'Draft', label: 'Draft' }, { value: 'Published', label: 'Published' }, { value: 'Closed', label: 'Closed' }]}
                    value={asmtFilterStatus}
                    onChange={setAsmtFilterStatus}
                    placeholder="All Statuses"
                  />
                </div>
                <div style={{ minWidth: '130px' }}>
                  <CustomSelect
                    options={[{ value: 'All', label: 'All Types' }, { value: 'Quiz', label: 'Quiz' }, { value: 'Exam', label: 'Exam' }, { value: 'Practical', label: 'Practical' }, { value: 'Assignment', label: 'Assignment' }, { value: 'Survey', label: 'Survey' }]}
                    value={asmtFilterType}
                    onChange={setAsmtFilterType}
                    placeholder="All Types"
                  />
                </div>
                {(asmtSearch || asmtFilterProgram !== 'All' || asmtFilterCourse !== 'All' || asmtFilterStatus !== 'All' || asmtFilterType !== 'All') && (
                  <button
                    type="button"
                    className="hrtm-btn hrtm-btn-secondary hrtm-btn-sm"
                    onClick={() => {
                      setAsmtSearch('');
                      setAsmtFilterProgram('All');
                      setAsmtFilterCourse('All');
                      setAsmtFilterStatus('All');
                      setAsmtFilterType('All');
                    }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            <div className="hrtm-table-wrap">
              <table className="hrtm-table">
                <thead>
                  <tr>
                    <th style={{ width: '20%', minWidth: '180px' }}>Assessment Name</th>
                    <th style={{ width: '18%', minWidth: '170px' }}>Course & Program</th>
                    <th style={{ width: '14%', minWidth: '130px' }}>Marks & Pass</th>
                    <th style={{ width: '9%', minWidth: '85px' }}>Duration</th>
                    <th style={{ width: '13%', minWidth: '130px' }}>Schedule</th>
                    <th style={{ width: '10%', minWidth: '100px' }}>Status</th>
                    <th style={{ width: '16%', minWidth: '220px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssessments.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="hrtm-empty">
                        No assessments found matching the criteria. Click "+ Create Assessment" to create one.
                      </td>
                    </tr>
                  ) : (
                    filteredAssessments.map(asmt => {
                      const qCount = asmt.questions?.length || 0;
                      const totalMarks = asmt.totalMarks || asmt.maxScore || 100;
                      const passMarks = asmt.passingMarks || asmt.passingScore || 60;

                      return (
                        <tr key={asmt._id}>
                          <td>
                            <span className="hrtm-primary-title">{asmt.title || asmt.name || 'Untitled Assessment'}</span>
                            <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: '2px' }}>
                              <span className="hrtm-code-badge" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                                {asmt.assessmentType || 'Quiz'}
                              </span>
                              <span style={{ marginLeft: '6px' }}>{qCount} Questions</span>
                            </div>
                          </td>
                          <td>
                            <div className="hrtm-primary-cell">
                              <span className="hrtm-primary-title" style={{ fontWeight: 500 }}>
                                {asmt.course?.title || 'All / General'}
                              </span>
                              {asmt.program?.name && (
                                <span className="hrtm-cell-subtext">{asmt.program.name}</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <strong>{passMarks}</strong> / {totalMarks}
                            <span className="hrtm-cell-subtext">Pass: {Math.round((passMarks / totalMarks) * 100)}%</span>
                          </td>
                          <td>{asmt.duration ? `${asmt.duration} mins` : 'Untimed'}</td>
                          <td>
                            <div style={{ fontSize: '0.78rem' }}>
                              <div>Start: {formatDate(asmt.startDate)}</div>
                              <div style={{ color: '#64748b' }}>End: {formatDate(asmt.endDate)}</div>
                            </div>
                          </td>
                          <td>
                            <span className={`hrtm-badge hrtm-badge-${(asmt.status || 'draft').toLowerCase()}`}>
                              <span className="hrtm-badge-dot" />
                              {asmt.status || 'Draft'}
                            </span>
                          </td>
                          <td>
                            <div className="hrtm-action-group" style={{ justifyContent: 'center' }}>
                              <button
                                type="button"
                                className="hrtm-action-btn hrtm-action-btn-view"
                                title="View Assessment Details"
                                onClick={() => openViewAssessmentModal(asmt)}
                              >
                                👁️
                              </button>
                              <button
                                type="button"
                                className="hrtm-action-btn hrtm-action-btn-edit"
                                title="Edit Assessment & Questions"
                                onClick={() => openEditAssessmentModal(asmt)}
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                className={`hrtm-action-btn ${asmt.status === 'Published' ? 'hrtm-action-btn-close' : 'hrtm-action-btn-publish'}`}
                                title={asmt.status === 'Published' ? 'Close Assessment' : 'Publish Assessment'}
                                onClick={() => handleTogglePublishAssessment(asmt)}
                              >
                                {asmt.status === 'Published' ? '🔒' : '🚀'}
                              </button>
                              <button
                                type="button"
                                className="hrtm-action-btn hrtm-action-btn-assign"
                                title="Assign to Employees"
                                onClick={() => openAssignAssessmentModal(asmt)}
                              >
                                👥
                              </button>
                              <button
                                type="button"
                                className="hrtm-action-btn hrtm-action-btn-results"
                                title="View Submissions & Results"
                                onClick={() => {
                                  setAsmtSearch(asmt.title || asmt.name || '');
                                  setAssessmentSubtab('results');
                                }}
                              >
                                📊
                              </button>
                              <button
                                type="button"
                                className="hrtm-action-btn hrtm-action-btn-delete"
                                title="Delete Assessment"
                                onClick={() => handleDeleteAssessment(asmt._id)}
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── SUBTAB 2: EVALUATION QUEUE ── */}
        {assessmentSubtab === 'evaluations' && (
          <>
            <div className="hrtm-filter-toolbar" style={{ marginBottom: '1rem' }}>
              <div className="hrtm-filter-group" style={{ flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="hrtm-search"
                  placeholder="Search candidate, assessment, course..."
                  value={asmtSearch}
                  onChange={e => setAsmtSearch(e.target.value)}
                  style={{ minWidth: '220px' }}
                />
                <div style={{ minWidth: '150px' }}>
                  <CustomSelect
                    options={[{ value: 'All', label: 'All Programs' }, ...programs.map(p => ({ value: p._id, label: p.name }))]}
                    value={asmtFilterProgram}
                    onChange={setAsmtFilterProgram}
                    placeholder="All Programs"
                  />
                </div>
                <div style={{ minWidth: '150px' }}>
                  <CustomSelect
                    options={[{ value: 'All', label: 'All Courses' }, ...courses.map(c => ({ value: c._id, label: c.title }))]}
                    value={asmtFilterCourse}
                    onChange={setAsmtFilterCourse}
                    placeholder="All Courses"
                  />
                </div>
                <div style={{ minWidth: '140px' }}>
                  <CustomSelect
                    options={[{ value: 'All', label: 'All Departments' }, ...departments.map(d => ({ value: d.name, label: d.name }))]}
                    value={asmtFilterDept}
                    onChange={setAsmtFilterDept}
                    placeholder="All Departments"
                  />
                </div>
                <div style={{ minWidth: '140px' }}>
                  <CustomSelect
                    options={[
                      { value: 'All', label: 'All Evaluations' },
                      { value: 'Pending', label: 'Pending Evaluation' },
                      { value: 'Needs Review', label: 'Needs Review' },
                      { value: 'Evaluated', label: 'Evaluated' }
                    ]}
                    value={asmtFilterStatus}
                    onChange={setAsmtFilterStatus}
                    placeholder="Status"
                  />
                </div>
              </div>
            </div>

            <div className="hrtm-table-wrap">
              <table className="hrtm-table">
                <thead>
                  <tr>
                    <th style={{ width: '20%', minWidth: '170px' }}>Candidate</th>
                    <th style={{ width: '13%', minWidth: '110px' }}>Department</th>
                    <th style={{ width: '20%', minWidth: '170px' }}>Assessment</th>
                    <th style={{ width: '16%', minWidth: '140px' }}>Course</th>
                    <th style={{ width: '11%', minWidth: '100px' }}>Submitted</th>
                    <th style={{ width: '10%', minWidth: '95px' }}>Score</th>
                    <th style={{ width: '10%', minWidth: '105px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="hrtm-empty">
                        No submissions currently in queue for evaluation.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((sub, idx) => (
                      <tr key={sub._id || idx}>
                        <td>
                          <span className="hrtm-primary-title">{getEmpName(sub.employee)}</span>
                          <span className="hrtm-cell-subtext">{sub.employee?.email || ''}</span>
                        </td>
                        <td>{sub.employee?.department || 'General'}</td>
                        <td>
                          <strong style={{ color: '#0f172a' }}>{sub.assessmentName || 'Assessment'}</strong>
                        </td>
                        <td>{sub.course?.title || '—'}</td>
                        <td>{formatDate(sub.submittedAt || sub.submissionDate)}</td>
                        <td>
                          {sub.score !== null && sub.score !== undefined ? (
                            <span className="hrtm-code-badge">{sub.score} marks</span>
                          ) : (
                            <span style={{ color: '#d97706', fontWeight: 600 }}>Pending</span>
                          )}
                        </td>
                        <td>
                          <div className="hrtm-action-group" style={{ justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="hrtm-action-btn hrtm-action-btn-evaluate"
                              title="Evaluate Submission"
                              onClick={() => openEvaluateModal(sub)}
                            >
                              📝 Evaluate
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── SUBTAB 3: RESULTS & PERFORMANCE ── */}
        {assessmentSubtab === 'results' && (
          <>
            <div className="hrtm-filter-toolbar" style={{ marginBottom: '1rem' }}>
              <div className="hrtm-filter-group" style={{ flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="hrtm-search"
                  placeholder="Search candidate, assessment, course..."
                  value={asmtSearch}
                  onChange={e => setAsmtSearch(e.target.value)}
                  style={{ minWidth: '220px' }}
                />
                <div style={{ minWidth: '150px' }}>
                  <CustomSelect
                    options={[{ value: 'All', label: 'All Programs' }, ...programs.map(p => ({ value: p._id, label: p.name }))]}
                    value={asmtFilterProgram}
                    onChange={setAsmtFilterProgram}
                    placeholder="All Programs"
                  />
                </div>
                <div style={{ minWidth: '150px' }}>
                  <CustomSelect
                    options={[{ value: 'All', label: 'All Courses' }, ...courses.map(c => ({ value: c._id, label: c.title }))]}
                    value={asmtFilterCourse}
                    onChange={setAsmtFilterCourse}
                    placeholder="All Courses"
                  />
                </div>
                <div style={{ minWidth: '140px' }}>
                  <CustomSelect
                    options={[{ value: 'All', label: 'All Departments' }, ...departments.map(d => ({ value: d.name, label: d.name }))]}
                    value={asmtFilterDept}
                    onChange={setAsmtFilterDept}
                    placeholder="All Departments"
                  />
                </div>
                <div style={{ minWidth: '120px' }}>
                  <CustomSelect
                    options={[
                      { value: 'All', label: 'All Results' },
                      { value: 'Pass', label: 'Pass' },
                      { value: 'Fail', label: 'Fail' }
                    ]}
                    value={asmtFilterResult}
                    onChange={setAsmtFilterResult}
                    placeholder="Result"
                  />
                </div>
              </div>
            </div>

            <div className="hrtm-table-wrap">
              <table className="hrtm-table">
                <thead>
                  <tr>
                    <th style={{ width: '16%', minWidth: '150px' }}>Candidate</th>
                    <th style={{ width: '11%', minWidth: '100px' }}>Department</th>
                    <th style={{ width: '17%', minWidth: '150px' }}>Assessment</th>
                    <th style={{ width: '14%', minWidth: '130px' }}>Course & Program</th>
                    <th style={{ width: '7%', minWidth: '65px' }}>Total</th>
                    <th style={{ width: '8%', minWidth: '70px' }}>Marks</th>
                    <th style={{ width: '8%', minWidth: '70px' }}>%</th>
                    <th style={{ width: '7%', minWidth: '75px' }}>Result</th>
                    <th style={{ width: '6%', minWidth: '55px' }}>Grade</th>
                    <th style={{ width: '9%', minWidth: '85px' }}>Date</th>
                    <th style={{ width: '7%', minWidth: '65px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan="11" className="hrtm-empty">
                        No assessment result records found matching the criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((sub, idx) => (
                      <tr key={sub._id || idx}>
                        <td>
                          <span className="hrtm-primary-title">{getEmpName(sub.employee)}</span>
                          <span className="hrtm-cell-subtext">{sub.employee?.email || ''}</span>
                        </td>
                        <td>{sub.employee?.department || 'General'}</td>
                        <td>
                          <strong style={{ color: '#0f172a' }}>{sub.assessmentName || 'Assessment'}</strong>
                        </td>
                        <td>
                          <div className="hrtm-primary-cell">
                            <span className="hrtm-primary-title" style={{ fontWeight: 500 }}>
                              {sub.course?.title || '—'}
                            </span>
                            {sub.program?.name && (
                              <span className="hrtm-cell-subtext">{sub.program.name}</span>
                            )}
                          </div>
                        </td>
                        <td>{sub.totalMarks || 100}</td>
                        <td>
                          <strong>{sub.marksObtained !== null && sub.marksObtained !== undefined ? sub.marksObtained : (sub.score !== undefined ? sub.score : '—')}</strong>
                        </td>
                        <td>
                          <strong style={{ color: (sub.percentage || 0) >= 60 ? '#16a34a' : '#dc2626' }}>
                            {sub.percentage !== null && sub.percentage !== undefined ? `${sub.percentage}%` : '—'}
                          </strong>
                        </td>
                        <td>
                          <span className={`hrtm-badge hrtm-badge-${(sub.passFail || 'pending').toLowerCase()}`}>
                            <span className="hrtm-badge-dot" />
                            {sub.passFail || 'Pending'}
                          </span>
                        </td>
                        <td>
                          <span className="hrtm-code-badge" style={{ fontWeight: 700 }}>
                            {sub.grade || (sub.percentage >= 90 ? 'A+' : sub.percentage >= 80 ? 'A' : sub.percentage >= 70 ? 'B' : sub.percentage >= 60 ? 'C' : 'F')}
                          </span>
                        </td>
                        <td>{formatDate(sub.submittedAt || sub.submissionDate)}</td>
                        <td>
                          <div className="hrtm-action-group" style={{ justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="hrtm-action-btn hrtm-action-btn-edit"
                              title="Re-evaluate / Edit Marks"
                              onClick={() => openEvaluateModal(sub)}
                            >
                              ✏️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderCertifications = () => (
    <div className="hrtm-card">
      <div className="hrtm-card-header">
        <div>
          <h2 className="hrtm-section-heading">Certifications & Awards</h2>
          <span className="hrtm-section-subtext">{certifications.length} certification{certifications.length === 1 ? '' : 's'} awarded</span>
        </div>
        <button className="hrtm-btn hrtm-btn-primary hrtm-btn-sm" onClick={() => setShowGenCertModal(true)}>
          + Generate Certification
        </button>
      </div>
      <div className="hrtm-table-wrap">
        <table className="hrtm-table">
          <thead>
            <tr>
              <th style={{ width: '13%', minWidth: '110px' }}>Certificate #</th>
              <th style={{ width: '16%', minWidth: '140px' }}>Employee</th>
              <th style={{ width: '14%', minWidth: '120px' }}>Program</th>
              <th style={{ width: '14%', minWidth: '120px' }}>Course</th>
              <th style={{ width: '10%', minWidth: '100px' }}>Completion Date</th>
              <th style={{ width: '9%', minWidth: '95px' }}>Issue Date</th>
              <th style={{ width: '8%', minWidth: '85px' }}>Status</th>
              <th style={{ width: '16%', minWidth: '320px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {certifications.length === 0 ? (
              <tr><td colSpan="8" className="hrtm-empty">No certifications generated</td></tr>
            ) : certifications.map(cert => (
              <tr key={cert._id}>
                <td><span className="hrtm-code-badge">{cert.certificateNumber}</span></td>
                <td><span className="hrtm-primary-title">{getEmpName(cert.employee)}</span></td>
                <td>{cert.program?.name || 'General'}</td>
                <td>{cert.course?.title || '—'}</td>
                <td>{formatDate(cert.completionDate || cert.issueDate)}</td>
                <td>{formatDate(cert.issueDate)}</td>
                <td><span className={`hrtm-badge hrtm-badge-${(cert.status || '').toLowerCase().replace(' ', '-')}`}><span className="hrtm-badge-dot" />{cert.status}</span></td>
                <td>
                  <div className="hrtm-action-group" style={{ justifyContent: 'center', gap: '0.28rem' }}>
                    <button
                      type="button"
                      className="hrtm-action-btn hrtm-action-btn-view"
                      title="View / Preview Certificate"
                      onClick={() => setPreviewCert(cert)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="hrtm-action-btn hrtm-action-btn-download"
                      title="Download PDF"
                      onClick={() => handleDownloadPdf(cert)}
                      disabled={downloadingCertId === cert._id}
                    >
                      {downloadingCertId === cert._id ? 'Downloading...' : 'Download'}
                    </button>
                    <button
                      type="button"
                      className="hrtm-action-btn hrtm-action-btn-edit"
                      title="Edit Certification"
                      onClick={() => openEditCertModal(cert)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="hrtm-action-btn hrtm-action-btn-deactivate"
                      title={cert.status === 'Revoked' ? 'Certificate is already deactivated' : 'Deactivate Certificate'}
                      onClick={() => handleRevokeCert(cert._id)}
                      disabled={cert.status === 'Revoked'}
                    >
                      Deactivate
                    </button>
                    <button
                      type="button"
                      className="hrtm-action-btn hrtm-action-btn-delete"
                      title="Delete Certificate"
                      onClick={() => handleDelete('certification', cert._id)}
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
    </div>
  );

  const renderFeedback = () => (
    <div className="hrtm-card">
      <div className="hrtm-card-header">
        <div>
          <h2 className="hrtm-section-heading">Training Feedback & Ratings</h2>
          <span className="hrtm-section-subtext">{feedback.length} evaluation{feedback.length === 1 ? '' : 's'} recorded</span>
        </div>
        <button className="hrtm-btn hrtm-btn-primary hrtm-btn-sm" onClick={() => openCreateModal('feedback')}>+ Submit Feedback</button>
      </div>
      <div className="hrtm-table-wrap">
        <table className="hrtm-table">
          <thead>
            <tr>
              <th style={{ width: '20%', minWidth: '170px' }}>Employee</th>
              <th style={{ width: '24%', minWidth: '180px' }}>Course</th>
              <th style={{ width: '16%', minWidth: '120px' }}>Rating</th>
              <th style={{ width: '24%', minWidth: '180px' }}>Comments</th>
              <th style={{ width: '10%', minWidth: '105px' }}>Submitted Date</th>
              <th style={{ width: '6%', minWidth: '80px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {feedback.length === 0 ? (
              <tr><td colSpan="6" className="hrtm-empty">No feedback entries found</td></tr>
            ) : feedback.map(fb => (
              <tr key={fb._id}>
                <td><span className="hrtm-primary-title">{getEmpName(fb.employee)}</span></td>
                <td>{fb.course?.title || '—'}</td>
                <td><span className="hrtm-stars">{'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}</span> ({fb.rating}/5)</td>
                <td><span className="hrtm-cell-subtext">{fb.comments || '—'}</span></td>
                <td>{formatDate(fb.submittedAt)}</td>
                <td>
                  <div className="hrtm-action-group" style={{ justifyContent: 'center' }}>
                    <button type="button" className="hrtm-action-btn hrtm-action-btn-delete" onClick={() => handleDelete('feedback', fb._id)} title="Delete Feedback">🗑️</button>
                  </div>
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
        <div>
          <h2 className="hrtm-section-heading">Completion Records</h2>
          <span className="hrtm-section-subtext">{completionData.length} completion record{completionData.length === 1 ? '' : 's'}</span>
        </div>
      </div>
      <div className="hrtm-table-wrap">
        <table className="hrtm-table">
          <thead>
            <tr>
              <th style={{ width: '28%', minWidth: '200px' }}>Employee</th>
              <th style={{ width: '36%', minWidth: '240px' }}>Program / Course</th>
              <th style={{ width: '20%', minWidth: '140px' }}>Completion Date</th>
              <th style={{ width: '16%', minWidth: '100px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {completionData.length === 0 ? (
              <tr><td colSpan="4" className="hrtm-empty">No completion records found</td></tr>
            ) : completionData.map(c => (
              <tr key={c._id}>
                <td><span className="hrtm-primary-title">{getEmpName(c.employee)}</span></td>
                <td>
                  <div className="hrtm-primary-cell">
                    <span className="hrtm-primary-title" style={{ fontWeight: 500 }}>{c.program?.name || '—'}</span>
                    {c.course?.title && <span className="hrtm-cell-subtext">Course: {c.course.title}</span>}
                  </div>
                </td>
                <td>{formatDate(c.completionDate || c.updatedAt)}</td>
                <td><span className={`hrtm-badge hrtm-badge-${(c.status || '').toLowerCase().replace(' ', '-')}`}><span className="hrtm-badge-dot" />{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );



  /* ──────────────── EMPLOYEE ASSIGNMENT DETAIL VIEW MODAL ──────────────── */

  const renderAssignmentDetailModal = () => {
    if (!viewingAssignment) return null;
    const a = viewingAssignment;
    const matchedAsmt = getAssignmentAssessment(a);
    const matchedSub = getAssignmentSubmission(a, matchedAsmt);
    const matchedCert = getAssignmentCertification(a);
    const matchedProg = getAssignmentProgress(a);

    const progressPct = a.progress !== undefined && a.progress !== null
      ? a.progress
      : (matchedProg?.progressPercent !== undefined ? matchedProg.progressPercent : (a.status === 'Completed' ? 100 : (a.status === 'In Progress' ? 50 : 0)));

    const empIdStr = a.employee?.employeeId || (a.employee?._id ? `EMP-${String(a.employee._id).slice(-6).toUpperCase()}` : 'EMP-001');

    return (
      <div className="hrtm-modal-overlay">
        <div className="hrtm-modal hrtm-modal-lg" style={{ maxWidth: '880px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div className="hrtm-modal-header" style={{ borderBottom: '1px solid #e2e8f0', padding: '1rem 1.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>Assignment Details</h3>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Training & Progress Overview: {getEmpName(a.employee)} • {a.course?.title || 'Training Course'}
              </span>
            </div>
            <button className="hrtm-modal-close" onClick={() => setViewingAssignment(null)}>✕</button>
          </div>

          <div className="hrtm-modal-body" style={{ overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Section 1: Employee Details */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>👤</span> Employee Details
                </h4>
                <span className="hrtm-code-badge" style={{ fontWeight: 600 }}>{empIdStr}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.82rem' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Full Name</span>
                  <strong style={{ color: '#0f172a' }}>{getEmpName(a.employee)}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Employee ID</span>
                  <strong style={{ color: '#0f172a' }}>{empIdStr}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Department</span>
                  <span style={{ color: '#0f172a' }}>{a.employee?.department || 'General'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Designation</span>
                  <span style={{ color: '#0f172a' }}>{a.employee?.designation || 'Staff / Specialist'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Email Address</span>
                  <span style={{ color: '#0f172a' }}>{a.employee?.email || '—'}</span>
                </div>
              </div>
            </div>

            {/* Section 2: Training Details */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>📚</span> Training Details
                </h4>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className={`hrtm-badge hrtm-badge-${(a.status || 'assigned').toLowerCase().replace(' ', '-')}`}>
                    <span className="hrtm-badge-dot" />{a.status}
                  </span>
                  <button
                    type="button"
                    className="hrtm-btn hrtm-btn-secondary hrtm-btn-sm"
                    style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                    onClick={() => {
                      setViewingAssignment(null);
                      openEditModal('assignment', a);
                    }}
                  >
                    ✏️ Edit Assignment / Due Date
                  </button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Program</span>
                  <strong style={{ color: '#0f172a' }}>{a.program?.name || 'General Program'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Course</span>
                  <strong style={{ color: '#0f172a' }}>{a.course?.title || '—'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Assigned Date</span>
                  <span style={{ color: '#0f172a' }}>{formatDate(a.startDate || a.createdAt)}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Due Date</span>
                  <span style={{ color: '#0f172a' }}>{formatDate(a.dueDate)}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Mandatory Requirement</span>
                  <span style={{ color: a.isMandatory ? '#b91c1c' : '#64748b', fontWeight: 600 }}>{a.isMandatory ? 'Yes (Mandatory)' : 'No (Optional)'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Attendance / Sessions</span>
                  <span style={{ color: '#0f172a' }}>{matchedProg ? `${matchedProg.attendedSessions || 0} / ${matchedProg.totalSessions || 0} sessions` : 'Self-Paced'}</span>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b' }}>Training Progress</span>
                  <strong style={{ color: '#2563eb' }}>{progressPct}%</strong>
                </div>
                <div className="hrtm-progress-bar" style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div className="hrtm-progress-fill" style={{ width: `${progressPct}%`, height: '100%', background: '#2563eb', transition: 'width 0.3s' }} />
                </div>
              </div>
            </div>

            {/* Section 3: Assessment */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>📝</span> Assessment
                </h4>
                <div>
                  {matchedSub ? (
                    <span className={`hrtm-badge hrtm-badge-${(matchedSub.passFail || 'pending').toLowerCase()}`}>
                      <span className="hrtm-badge-dot" />{matchedSub.passFail || 'Pending'}
                    </span>
                  ) : matchedAsmt ? (
                    <span className="hrtm-badge hrtm-badge-scheduled">Assigned</span>
                  ) : (
                    <span className="hrtm-badge" style={{ background: '#f1f5f9', color: '#64748b' }}>Not Assigned</span>
                  )}
                </div>
              </div>

              {matchedAsmt ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Assessment Name</span>
                      <strong style={{ color: '#0f172a' }}>{matchedAsmt.title || matchedAsmt.name}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Type</span>
                      <span className="hrtm-code-badge">{matchedAsmt.assessmentType || 'Quiz'}</span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Duration</span>
                      <span>{matchedAsmt.duration || 45} mins</span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Marks & Pass</span>
                      <span>{matchedAsmt.totalMarks || 100} Total • Pass: {matchedAsmt.passingMarks || 60}</span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Questions</span>
                      <span>{matchedAsmt.questions?.length || 0} Questions</span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Assessment Status</span>
                      <span className={`hrtm-badge hrtm-badge-${(matchedAsmt.status || 'draft').toLowerCase()}`}>{matchedAsmt.status}</span>
                    </div>
                  </div>

                  {matchedSub ? (
                    <div style={{ background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>Candidate Submission</span>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          Submitted: {formatDate(matchedSub.submittedAt)} {matchedSub.attemptNumber ? `• Attempt #${matchedSub.attemptNumber}` : ''}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', fontSize: '0.8rem' }}>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Score Obtained</span>
                          <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                            {matchedSub.marksObtained !== null && matchedSub.marksObtained !== undefined ? matchedSub.marksObtained : (matchedSub.score ?? '—')} / {matchedSub.totalMarks || matchedAsmt.totalMarks || 100}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Percentage</span>
                          <strong style={{ fontSize: '0.95rem', color: (matchedSub.percentage || 0) >= (matchedAsmt.passingMarks || 60) ? '#16a34a' : '#dc2626' }}>
                            {matchedSub.percentage !== null && matchedSub.percentage !== undefined ? `${matchedSub.percentage}%` : '—'}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Result</span>
                          <span className={`hrtm-badge hrtm-badge-${(matchedSub.passFail || 'pending').toLowerCase()}`}>
                            {matchedSub.passFail || 'Pending'}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Grade</span>
                          <span className="hrtm-code-badge" style={{ fontWeight: 700 }}>
                            {matchedSub.grade || (matchedSub.percentage >= 90 ? 'A+' : matchedSub.percentage >= 80 ? 'A' : matchedSub.percentage >= 70 ? 'B' : matchedSub.percentage >= 60 ? 'C' : 'F')}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>Evaluator</span>
                          <span style={{ color: '#334155' }}>{matchedSub.evaluator ? getEmpName(matchedSub.evaluator) : 'HR Evaluator'}</span>
                        </div>
                      </div>
                      {matchedSub.remarks && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#475569', background: '#ffffff', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                          <strong>Remarks:</strong> {matchedSub.remarks}
                        </div>
                      )}
                      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="hrtm-btn hrtm-btn-primary hrtm-btn-sm"
                          onClick={() => {
                            setViewingAssignment(null);
                            openEvaluateModal(matchedSub);
                          }}
                        >
                          📝 Re-evaluate / Grade Submission
                        </button>
                        <button
                          type="button"
                          className="hrtm-btn hrtm-btn-secondary hrtm-btn-sm"
                          onClick={() => {
                            setViewingAssignment(null);
                            openViewAssessmentModal(matchedAsmt);
                          }}
                        >
                          👁️ View Assessment Questions
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        Assessment is assigned to this course. Candidate submission is currently pending.
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="hrtm-btn hrtm-btn-secondary hrtm-btn-sm"
                          onClick={() => {
                            setViewingAssignment(null);
                            openViewAssessmentModal(matchedAsmt);
                          }}
                        >
                          👁️ View Questions ({matchedAsmt.questions?.length || 0})
                        </button>
                        <button
                          type="button"
                          className="hrtm-btn hrtm-btn-primary hrtm-btn-sm"
                          onClick={() => {
                            setViewingAssignment(null);
                            openEvaluateModal({
                              assessmentId: matchedAsmt._id,
                              assessmentName: matchedAsmt.title || matchedAsmt.name,
                              course: a.course,
                              program: a.program,
                              employee: a.employee,
                              totalMarks: matchedAsmt.totalMarks || 100,
                              passingMarks: matchedAsmt.passingMarks || 60,
                            });
                          }}
                        >
                          📝 Enter Grade / Evaluate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '0.85rem', background: '#fffbeb', borderRadius: '6px', border: '1px solid #fef3c7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#92400e' }}>
                    No assessment is currently connected to <strong>{a.course?.title || 'this course'}</strong>.
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="hrtm-btn hrtm-btn-primary hrtm-btn-sm"
                      onClick={() => {
                        setViewingAssignment(null);
                        openCreateAssessmentModal(a);
                      }}
                    >
                      + Create Assessment for Course
                    </button>
                    {assessments.length > 0 && (
                      <button
                        type="button"
                        className="hrtm-btn hrtm-btn-secondary hrtm-btn-sm"
                        onClick={() => {
                          setViewingAssignment(null);
                          openAssignAssessmentModal(assessments[0]);
                        }}
                      >
                        📋 Assign Existing Assessment
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section 4: Certification */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>📜</span> Certification
                </h4>
                <div>
                  {matchedCert ? (
                    <span className="hrtm-badge hrtm-badge-active">Awarded</span>
                  ) : (a.status === 'Completed' || matchedSub?.passFail === 'Pass') ? (
                    <span className="hrtm-badge hrtm-badge-active" style={{ background: '#ecfdf5', color: '#059669', borderColor: '#a7f3d0' }}>
                      Eligible for Certification
                    </span>
                  ) : (
                    <span className="hrtm-badge" style={{ background: '#f1f5f9', color: '#64748b' }}>
                      Pending Completion
                    </span>
                  )}
                </div>
              </div>

              {matchedCert ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.82rem' }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Certificate Number</span>
                    <strong className="hrtm-code-badge">{matchedCert.certificateNumber}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Issue Date</span>
                    <span>{formatDate(matchedCert.issueDate)}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Expiry Date</span>
                    <span>{matchedCert.expiryDate ? formatDate(matchedCert.expiryDate) : 'No Expiry (Lifetime)'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Final Score</span>
                    <span>{matchedCert.finalScore !== undefined && matchedCert.finalScore !== null ? `${matchedCert.finalScore}%` : '—'}</span>
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      className="hrtm-btn hrtm-btn-secondary hrtm-btn-sm"
                      onClick={() => setPreviewCert(matchedCert)}
                    >
                      👁️ Preview Certificate
                    </button>
                    <button
                      type="button"
                      className="hrtm-btn hrtm-btn-secondary hrtm-btn-sm"
                      onClick={() => handleDownloadCert(matchedCert)}
                    >
                      ⬇️ Download PDF
                    </button>
                    <button
                      type="button"
                      className="hrtm-btn hrtm-btn-secondary hrtm-btn-sm"
                      onClick={() => openEditCertModal(matchedCert)}
                    >
                      ✏️ Edit Certification
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {(a.status === 'Completed' || matchedSub?.passFail === 'Pass')
                      ? 'This employee has satisfied course/assessment requirements and is eligible for a Certificate of Completion.'
                      : 'Candidate will become eligible for a certificate upon passing the assessment or completing the training.'}
                  </span>
                  <button
                    type="button"
                    className="hrtm-btn hrtm-btn-primary hrtm-btn-sm"
                    onClick={() => {
                      setGenCertForm({
                        employee: a.employee?._id || a.employee || '',
                        program: a.program?._id || a.program || '',
                        course: a.course?._id || a.course || '',
                        assignment: a._id
                      });
                      setShowGenCertModal(true);
                    }}
                  >
                    + Generate Certification
                  </button>
                </div>
              )}
            </div>

            {/* Section 5: Completion */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>🏁</span> Completion
                </h4>
                <span className={`hrtm-badge hrtm-badge-${(a.status === 'Completed' ? 'completed' : 'in-progress')}`}>
                  {a.status === 'Completed' ? 'Completed' : 'In Progress'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Completion Date</span>
                  <strong>{a.completionDate ? formatDate(a.completionDate) : (a.status === 'Completed' ? formatDate(a.updatedAt) : 'Pending completion')}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>Overall Lifecycle Status</span>
                  <span style={{ color: a.status === 'Completed' ? '#16a34a' : '#2563eb', fontWeight: 600 }}>
                    {a.status === 'Completed' ? '100% Finalized' : 'Active Training Track'}
                  </span>
                </div>
              </div>

              {/* Lifecycle Stepper */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.74rem', color: '#475569' }}>
                <span style={{ padding: '2px 7px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>1. Assigned ✓</span>
                <span>→</span>
                <span style={{ padding: '2px 7px', borderRadius: '4px', background: progressPct > 0 ? '#dcfce7' : '#f1f5f9', color: progressPct > 0 ? '#15803d' : '#64748b', fontWeight: 600 }}>
                  2. Progress ({progressPct}%)
                </span>
                <span>→</span>
                <span style={{ padding: '2px 7px', borderRadius: '4px', background: matchedSub ? '#dcfce7' : (matchedAsmt ? '#fef3c7' : '#f1f5f9'), color: matchedSub ? '#15803d' : (matchedAsmt ? '#b45309' : '#64748b'), fontWeight: 600 }}>
                  3. Assessment {matchedSub ? '✓' : (matchedAsmt ? '(Assigned)' : '(Pending)')}
                </span>
                <span>→</span>
                <span style={{ padding: '2px 7px', borderRadius: '4px', background: matchedSub?.evaluationStatus === 'Evaluated' ? '#dcfce7' : '#f1f5f9', color: matchedSub?.evaluationStatus === 'Evaluated' ? '#15803d' : '#64748b', fontWeight: 600 }}>
                  4. Evaluation {matchedSub?.evaluationStatus === 'Evaluated' ? '✓' : ''}
                </span>
                <span>→</span>
                <span style={{ padding: '2px 7px', borderRadius: '4px', background: matchedSub?.passFail === 'Pass' ? '#dcfce7' : (matchedSub?.passFail === 'Fail' ? '#fee2e2' : '#f1f5f9'), color: matchedSub?.passFail === 'Pass' ? '#15803d' : (matchedSub?.passFail === 'Fail' ? '#b91c1c' : '#64748b'), fontWeight: 600 }}>
                  5. Result {matchedSub?.passFail ? `(${matchedSub.passFail})` : ''}
                </span>
                <span>→</span>
                <span style={{ padding: '2px 7px', borderRadius: '4px', background: matchedCert ? '#dcfce7' : '#f1f5f9', color: matchedCert ? '#15803d' : '#64748b', fontWeight: 600 }}>
                  6. Certification {matchedCert ? '✓' : ''}
                </span>
              </div>
            </div>
          </div>

          <div className="hrtm-modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '0.85rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Assignment ID: {a._id}
            </span>
            <button
              type="button"
              className="hrtm-btn hrtm-btn-secondary"
              onClick={() => setViewingAssignment(null)}
            >
              Close
            </button>
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
        <div className={`hrtm-modal ${(showModal === 'program' || showModal === 'course') ? 'hrtm-modal-lg' : ''}`}>
          <div className="hrtm-modal-header">
            <h3>{editingItem ? 'Edit' : 'Create'} {showModal.charAt(0).toUpperCase() + showModal.slice(1)}</h3>
            <button className="hrtm-modal-close" onClick={() => setShowModal(null)}>✕</button>
          </div>
          <form onSubmit={handleFormSubmit}>
            <div className="hrtm-modal-body">
              {showModal === 'program' && (
                <>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Program Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.name || ''}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Leadership Excellence & Strategy 2026"
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Program Code</label>
                      <input
                        type="text"
                        value={formData.programCode || ''}
                        onChange={e => setFormData({ ...formData, programCode: e.target.value.toUpperCase() })}
                        placeholder="e.g. TRN-2026-001 (Auto-generated if empty)"
                      />
                    </div>
                  </div>

                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Training Type *</label>
                      <CustomSelect
                        options={['Internal', 'External', 'Online', 'Workshop', 'On-the-Job', 'Bootcamp', 'Certification']}
                        value={formData.trainingType || 'Internal'}
                        onChange={v => setFormData({ ...formData, trainingType: v })}
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Category *</label>
                      <CustomSelect
                        options={['Technical', 'Leadership', 'Compliance', 'Soft Skills', 'Onboarding', 'Safety', 'Sales', 'Product', 'General']}
                        value={formData.category || 'General'}
                        onChange={v => setFormData({ ...formData, category: v })}
                      />
                    </div>
                  </div>

                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Department *</label>
                      <CustomSelect
                        options={[{ value: '', label: 'All Departments' }, ...departments.map(d => ({ value: d._id, label: d.name }))]}
                        value={formData.department || ''}
                        onChange={v => setFormData({ ...formData, department: v })}
                        placeholder="Select Department"
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Program Owner (HR / Lead)</label>
                      <CustomSelect
                        options={[{ value: '', label: 'None (Unassigned)' }, ...employees.map(e => ({ value: e._id, label: getEmpName(e), subtitle: e.department || e.email }))]}
                        value={formData.programOwner || ''}
                        onChange={v => setFormData({ ...formData, programOwner: v })}
                        placeholder="-- Select Program Owner --"
                      />
                    </div>
                  </div>

                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Default Trainer</label>
                      <CustomSelect
                        options={[{ value: '', label: 'None (Unassigned)' }, ...trainers.map(t => ({ value: t._id, label: t.trainerType === 'Internal' ? getEmpName(t.employee) : t.name, subtitle: t.trainerType }))]}
                        value={formData.trainer || ''}
                        onChange={v => setFormData({ ...formData, trainer: v })}
                        placeholder="-- Select Trainer --"
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Status</label>
                      <CustomSelect
                        options={['Draft', 'Scheduled', 'Active', 'Completed', 'On-Hold', 'Cancelled']}
                        value={formData.status || 'Draft'}
                        onChange={v => setFormData({ ...formData, status: v })}
                      />
                    </div>
                  </div>

                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Start Date *</label>
                      <input
                        type="date"
                        required
                        value={formData.startDate ? String(formData.startDate).slice(0, 10) : ''}
                        onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>End Date *</label>
                      <input
                        type="date"
                        required
                        value={formData.endDate ? String(formData.endDate).slice(0, 10) : ''}
                        onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Total Duration (Hours)</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.totalHours || 0}
                        onChange={e => setFormData({ ...formData, totalHours: Number(e.target.value) })}
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Max Seat Capacity</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.capacity || 0}
                        onChange={e => setFormData({ ...formData, capacity: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Budget Amount</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.budget || 0}
                        onChange={e => setFormData({ ...formData, budget: Number(e.target.value) })}
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Currency</label>
                      <CustomSelect
                        options={['INR', 'USD', 'EUR', 'GBP']}
                        value={formData.currency || 'INR'}
                        onChange={v => setFormData({ ...formData, currency: v })}
                      />
                    </div>
                  </div>

                  <div className="hrtm-form-group">
                    <label>Description & Objectives</label>
                    <textarea
                      rows="3"
                      value={formData.description || ''}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Outline target skills, prerequisites, and program objectives..."
                    />
                  </div>
                </>
              )}

              {showModal === 'course' && (
                <>
                  {/* Section 1: Basic Information */}
                  <div className="hrtm-modal-section-title">
                    <span>📘</span> Basic Information
                  </div>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group" style={{ flex: 2 }}>
                      <label>Course Title *</label>
                      <input
                        type="text"
                        required
                        value={formData.title || ''}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g. Enterprise Full Stack Cloud Architecture"
                      />
                    </div>
                    <div className="hrtm-form-group" style={{ flex: 1 }}>
                      <label>Course Code</label>
                      <input
                        type="text"
                        value={formData.code || ''}
                        onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        placeholder="e.g. CRS-2026-001 (Auto if empty)"
                      />
                    </div>
                  </div>

                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Category *</label>
                      <CustomSelect
                        options={['Technical', 'Leadership', 'Compliance', 'Soft Skills', 'Product', 'Sales', 'Safety', 'General']}
                        value={formData.category || 'Technical'}
                        onChange={v => setFormData({ ...formData, category: v })}
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Difficulty / Level *</label>
                      <CustomSelect
                        options={['Beginner', 'Intermediate', 'Advanced']}
                        value={formData.difficulty || 'Beginner'}
                        onChange={v => setFormData({ ...formData, difficulty: v })}
                      />
                    </div>
                  </div>

                  <div className="hrtm-form-group">
                    <label>Course Description & Overview</label>
                    <textarea
                      rows="3"
                      value={formData.description || ''}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Comprehensive syllabus overview, core modules, learning outcomes..."
                    />
                  </div>

                  {/* Section 2: Ownership & Department */}
                  <div className="hrtm-modal-section-title">
                    <span>🏢</span> Ownership & Department
                  </div>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Target Department</label>
                      <CustomSelect
                        options={[{ value: '', label: 'All Departments' }, ...departments.map(d => ({ value: d._id, label: d.name }))]}
                        value={formData.department || ''}
                        onChange={v => setFormData({ ...formData, department: v })}
                        placeholder="Select Department"
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Primary Trainer</label>
                      <CustomSelect
                        options={[{ value: '', label: 'None (Unassigned)' }, ...trainers.map(t => ({ value: t._id, label: t.trainerType === 'Internal' ? getEmpName(t.employee) : t.name, subtitle: t.trainerType }))]}
                        value={formData.trainer || ''}
                        onChange={v => setFormData({ ...formData, trainer: v })}
                        placeholder="-- Select Trainer --"
                      />
                    </div>
                  </div>

                  <div className="hrtm-form-group">
                    <label>External Training Provider (Optional)</label>
                    <input
                      type="text"
                      value={formData.trainingProvider || ''}
                      onChange={e => setFormData({ ...formData, trainingProvider: e.target.value })}
                      placeholder="e.g. AWS Training Partner, Coursera Enterprise, Skillsoft"
                    />
                  </div>

                  {/* Section 3: Duration & Scheduling */}
                  <div className="hrtm-modal-section-title">
                    <span>⏱️</span> Duration & Unit
                  </div>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Duration Value *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.duration || 8}
                        onChange={e => setFormData({ ...formData, duration: Number(e.target.value) })}
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Duration Unit *</label>
                      <CustomSelect
                        options={['Hours', 'Days', 'Weeks', 'Self-Paced']}
                        value={formData.durationUnit || 'Hours'}
                        onChange={v => setFormData({ ...formData, durationUnit: v })}
                      />
                    </div>
                  </div>

                  {/* Section 4: Prerequisites & Skills */}
                  <div className="hrtm-modal-section-title">
                    <span>🎯</span> Prerequisites & Target Skills
                  </div>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Prerequisites (Comma-separated)</label>
                      <input
                        type="text"
                        value={formData.prerequisites || ''}
                        onChange={e => setFormData({ ...formData, prerequisites: e.target.value })}
                        placeholder="e.g. Basic JavaScript, Git, REST APIs"
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Target Skills (Comma-separated)</label>
                      <input
                        type="text"
                        value={formData.requiredSkills || ''}
                        onChange={e => setFormData({ ...formData, requiredSkills: e.target.value })}
                        placeholder="e.g. Microservices, Docker, CI/CD, React"
                      />
                    </div>
                  </div>

                  {/* Section 5: Status */}
                  <div className="hrtm-modal-section-title">
                    <span>⚙️</span> Publication Status
                  </div>
                  <div className="hrtm-form-group">
                    <label>Course Status</label>
                    <CustomSelect
                      options={['Draft', 'Active', 'Inactive', 'Archived']}
                      value={formData.status || 'Draft'}
                      onChange={v => setFormData({ ...formData, status: v })}
                    />
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
                      onChange={v => setFormData({ ...formData, trainerType: v })}
                    />
                  </div>
                  {formData.trainerType === 'Internal' ? (
                    <div className="hrtm-form-group">
                      <label>Select Employee *</label>
                      <CustomSelect
                        options={employees.map(e => ({ value: e._id, label: getEmpName(e), subtitle: e.department || 'General' }))}
                        value={formData.employee || ''}
                        onChange={v => setFormData({ ...formData, employee: v })}
                        placeholder="-- Choose Employee --"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="hrtm-form-group">
                        <label>Trainer Full Name *</label>
                        <input type="text" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                      </div>
                      <div className="hrtm-form-row">
                        <div className="hrtm-form-group">
                          <label>Email</label>
                          <input type="email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                        </div>
                        <div className="hrtm-form-group">
                          <label>Organization</label>
                          <input type="text" value={formData.organization || ''} onChange={e => setFormData({ ...formData, organization: e.target.value })} />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}



              {showModal === 'assignment' && (
                <>
                  {editingItem ? (
                    <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Assigned Employee</span>
                      <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>{getEmpName(editingItem.employee)}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                        {editingItem.employee?.department || 'General'} {editingItem.employee?.email ? `• ${editingItem.employee.email}` : ''}
                      </div>
                    </div>
                  ) : null}

                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Program *</label>
                      <CustomSelect
                        options={programs.map(p => ({ value: p._id, label: p.name }))}
                        value={formData.program || ''}
                        onChange={v => setFormData({ ...formData, program: v })}
                        placeholder="-- Choose Program --"
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Course *</label>
                      <CustomSelect
                        options={courses.map(c => ({ value: c._id, label: c.title }))}
                        value={formData.course || ''}
                        onChange={v => setFormData({ ...formData, course: v })}
                        placeholder="-- Choose Course --"
                      />
                    </div>
                  </div>

                  {!editingItem ? (
                    <div className="hrtm-form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <label style={{ margin: 0 }}>Select Employees ({selectedEmployees.length} of {employees.length} selected) *</label>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className="hrtm-btn hrtm-btn-secondary hrtm-btn-sm"
                            style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                            onClick={() => setSelectedEmployees(employees.map(e => e._id))}
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            className="hrtm-btn hrtm-btn-secondary hrtm-btn-sm"
                            style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                            onClick={() => setSelectedEmployees([])}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="hrtm-emp-pick-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {employees.map(emp => {
                          const isSel = selectedEmployees.includes(emp._id);
                          return (
                            <div key={emp._id} className="hrtm-emp-pick-row" onClick={() => {
                              if (isSel) setSelectedEmployees(selectedEmployees.filter(id => id !== emp._id));
                              else setSelectedEmployees([...selectedEmployees, emp._id]);
                            }}>
                              <input type="checkbox" checked={isSel} onChange={() => { }} />
                              <span>{getEmpName(emp)}</span>
                              <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: 'auto' }}>{emp.department || 'General'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Start Date</label>
                      <input
                        type="date"
                        value={formData.startDate || ''}
                        onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Due Date *</label>
                      <input
                        type="date"
                        required
                        value={formData.dueDate || ''}
                        onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                      />
                    </div>
                  </div>

                  {editingItem ? (
                    <div className="hrtm-form-row">
                      <div className="hrtm-form-group">
                        <label>Training Status *</label>
                        <CustomSelect
                          options={['Assigned', 'In Progress', 'Completed', 'Failed', 'Overdue']}
                          value={formData.status || 'Assigned'}
                          onChange={v => setFormData({ ...formData, status: v })}
                        />
                      </div>
                      {formData.status === 'Completed' && (
                        <div className="hrtm-form-group">
                          <label>Completion Date</label>
                          <input
                            type="date"
                            value={formData.completionDate || ''}
                            onChange={e => setFormData({ ...formData, completionDate: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div className="hrtm-form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <input
                      type="checkbox"
                      id="asgnMandatory"
                      checked={formData.isMandatory !== false}
                      onChange={e => setFormData({ ...formData, isMandatory: e.target.checked })}
                    />
                    <label htmlFor="asgnMandatory" style={{ margin: 0, cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', color: '#334155' }}>
                      Mandatory Training Assignment (Required for completion & assessment)
                    </label>
                  </div>
                </>
              )}

              {showModal === 'attendance' && (
                <>
                  <div className="hrtm-form-group">
                    <label>Session *</label>
                    <CustomSelect
                      options={sessions.map(s => ({ value: s._id, label: s.sessionTitle, subtitle: formatDate(s.sessionDate) }))}
                      value={formData.session || ''}
                      onChange={v => setFormData({ ...formData, session: v })}
                      placeholder="-- Choose Session --"
                    />
                  </div>
                  <div className="hrtm-form-group">
                    <label>Employee *</label>
                    <CustomSelect
                      options={employees.map(e => ({ value: e._id, label: getEmpName(e) }))}
                      value={formData.employee || ''}
                      onChange={v => setFormData({ ...formData, employee: v })}
                      placeholder="-- Choose Employee --"
                    />
                  </div>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Status</label>
                      <CustomSelect
                        options={['Present', 'Absent', 'Late', 'Excused']}
                        value={formData.status || 'Present'}
                        onChange={v => setFormData({ ...formData, status: v })}
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Remarks</label>
                      <input type="text" value={formData.remarks || ''} onChange={e => setFormData({ ...formData, remarks: e.target.value })} />
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
                        onChange={v => setFormData({ ...formData, course: v })}
                        placeholder="-- Choose Course --"
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Employee *</label>
                      <CustomSelect
                        options={employees.map(e => ({ value: e._id, label: getEmpName(e) }))}
                        value={formData.employee || ''}
                        onChange={v => setFormData({ ...formData, employee: v })}
                        placeholder="-- Choose Employee --"
                      />
                    </div>
                  </div>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Score Achieved *</label>
                      <input type="number" required value={formData.score || 0} onChange={e => setFormData({ ...formData, score: Number(e.target.value) })} />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Passing Score</label>
                      <input type="number" value={formData.passingScore || 70} onChange={e => setFormData({ ...formData, passingScore: Number(e.target.value) })} />
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
                        onChange={v => setFormData({ ...formData, course: v })}
                        placeholder="-- Choose Course --"
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Employee *</label>
                      <CustomSelect
                        options={employees.map(e => ({ value: e._id, label: getEmpName(e) }))}
                        value={formData.employee || ''}
                        onChange={v => setFormData({ ...formData, employee: v })}
                        placeholder="-- Choose Employee --"
                      />
                    </div>
                  </div>
                  <div className="hrtm-form-group">
                    <label>Rating *</label>
                    <CustomSelect
                      options={[{ value: 5, label: '5 - Excellent' }, { value: 4, label: '4 - Good' }, { value: 3, label: '3 - Average' }, { value: 2, label: '2 - Below Average' }, { value: 1, label: '1 - Poor' }]}
                      value={formData.rating || 5}
                      onChange={v => setFormData({ ...formData, rating: Number(v) })}
                    />
                  </div>
                  <div className="hrtm-form-group">
                    <label>Comments</label>
                    <textarea value={formData.comments || ''} onChange={e => setFormData({ ...formData, comments: e.target.value })} />
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
        <div className="hrtm-modal hrtm-modal-compact">
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
                <label>Training Program *</label>
                <CustomSelect
                  options={programs.map(p => ({ value: p._id, label: p.name }))}
                  value={genCertForm.program}
                  onChange={v => handleModalProgramChange(v)}
                  placeholder="-- Choose Program --"
                />
              </div>
              <div className="hrtm-form-group">
                <label>Course *</label>
                <CustomSelect
                  options={modalCourses.map(c => ({
                    value: c._id,
                    label: c.title,
                    subtitle: c.code ? `${c.code} • ${c.category || 'General'}` : (c.category || 'General')
                  }))}
                  value={genCertForm.course}
                  onChange={v => setGenCertForm({ ...genCertForm, course: v })}
                  placeholder={
                    loadingModalCourses
                      ? 'Loading courses...'
                      : modalCourseError
                        ? modalCourseError
                        : !genCertForm.program
                          ? '-- Select Program First --'
                          : modalCourses.length === 0
                            ? 'No courses available'
                            : '-- Choose Course --'
                  }
                  disabled={loadingModalCourses || !genCertForm.program || modalCourses.length === 0}
                />
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                Note: Eligibility validation will check if the selected employee has completed all requirements for this course.
              </p>
            </div>
            <div className="hrtm-modal-footer">
              <button type="button" className="hrtm-btn hrtm-btn-secondary" onClick={() => setShowGenCertModal(false)}>Cancel</button>
              <button
                type="submit"
                className="hrtm-btn hrtm-btn-primary"
                disabled={generatingCert || !genCertForm.employee || !genCertForm.course}
              >
                {generatingCert ? 'Generating Certification...' : 'Generate Certification'}
              </button>
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
        <div className="hrtm-modal hrtm-modal-md">
          <div className="hrtm-modal-header">
            <h3>Certificate Document Preview</h3>
            <button className="hrtm-modal-close" onClick={() => setPreviewCert(null)}>✕</button>
          </div>
          <div className="hrtm-modal-body">
            <div className="hrtm-cert-frame">
              <div className="hrtm-cert-inner-border">
                <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                  <img src="/aasha-logo-new.jpg" alt="ASHA SM TECHNOLOGIES" style={{ height: '42px', objectFit: 'contain' }} />
                </div>
                <div className="hrtm-cert-company">ASHA SM TECHNOLOGIES</div>
                <div className="hrtm-cert-main-title">Certificate of Completion</div>
                <div className="hrtm-cert-subtitle">This official certificate is proudly presented to</div>
                <div className="hrtm-cert-recipient">{getEmpName(previewCert.employee)}</div>
                <div className="hrtm-cert-text">
                  for successfully completing all requirements, assessments, and learning modules for the corporate training course:
                  <br />
                  <strong style={{ color: '#0f172a', fontSize: '1.05rem', display: 'block', marginTop: '0.4rem' }}>
                    {previewCert.course?.title || 'Professional Skills Training'}
                  </strong>
                  {previewCert.program?.name && (
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      under the program: {previewCert.program.name}
                    </span>
                  )}
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
                    <div className="hrtm-cert-sig-title">Head of Human Resources</div>
                  </div>
                  <div className="hrtm-cert-stamp">VERIFIED</div>
                  <div>
                    <div className="hrtm-cert-sig-line" />
                    <div className="hrtm-cert-sig-title">Corporate Training Director</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="hrtm-modal-footer">
            <button type="button" className="hrtm-btn hrtm-btn-secondary" onClick={() => setPreviewCert(null)}>Close</button>
            <button
              type="button"
              className="hrtm-btn hrtm-btn-primary"
              onClick={() => handleDownloadPdf(previewCert)}
              disabled={downloadingCertId === previewCert._id}
            >
              {downloadingCertId === previewCert._id ? 'Generating PDF...' : 'Download PDF Certificate'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ──────────────── MANAGE PROGRAM DETAILED LIFECYCLE MODAL ──────────────── */
  const renderManageProgramModal = () => {
    if (!managingProgram) return null;

    const prog = programDetailData?.program || managingProgram;
    const stats = programDetailData?.stats || {
      totalCourses: Array.isArray(prog.courses) ? prog.courses.length : 0,
      totalBatches: Array.isArray(prog.batches) ? prog.batches.length : 0,
      totalParticipants: 0,
      totalSessions: 0,
      totalCertifications: 0,
    };

    return (
      <div className="hrtm-modal-overlay" onClick={() => setManagingProgram(null)}>
        <div className="hrtm-modal hrtm-modal-xl" onClick={e => e.stopPropagation()}>
          <div className="hrtm-modal-header">
            <div className="hrtm-modal-header-info">
              <div className="hrtm-modal-header-title-row">
                <h3>{prog.name}</h3>
                {prog.programCode && (
                  <span className="hrtm-code-badge">{prog.programCode}</span>
                )}
                <span className="hrtm-badge hrtm-badge-internal">{prog.trainingType || 'Internal'}</span>
                <span className="hrtm-code-badge" style={{ background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}>
                  {prog.category || 'General'}
                </span>
                <span className={`hrtm-badge hrtm-badge-${(prog.status || '').toLowerCase()}`}>
                  <span className="hrtm-badge-dot" />
                  {prog.status || 'Draft'}
                </span>
              </div>
              <div className="hrtm-modal-header-meta-row">
                <span className="hrtm-modal-header-meta-item">🏢 <strong>{prog.department?.name || 'All Departments'}</strong></span>
                <span className="hrtm-modal-header-meta-item">👤 Owner: <strong>{getEmpName(prog.programOwner)}</strong></span>
                <span className="hrtm-modal-header-meta-item">👨‍🏫 Trainer: <strong>{prog.trainer ? (prog.trainer.trainerType === 'Internal' ? getEmpName(prog.trainer.employee) : prog.trainer.name) : 'Unassigned'}</strong></span>
              </div>
            </div>
            <button className="hrtm-modal-close" onClick={() => setManagingProgram(null)}>✕</button>
          </div>

          {/* Fixed Sub-tab Navigation Bar */}
          <div className="hrtm-modal-subtabs-bar">
            <div className="hrtm-mp-subtabs">
              <button
                type="button"
                className={`hrtm-mp-subtab ${manageSubtab === 'overview' ? 'active' : ''}`}
                onClick={() => setManageSubtab('overview')}
              >
                📊 Overview
              </button>
              <button
                type="button"
                className={`hrtm-mp-subtab ${manageSubtab === 'courses' ? 'active' : ''}`}
                onClick={() => setManageSubtab('courses')}
              >
                📚 Courses ({stats.totalCourses})
              </button>
              <button
                type="button"
                className={`hrtm-mp-subtab ${manageSubtab === 'batches' ? 'active' : ''}`}
                onClick={() => setManageSubtab('batches')}
              >
                👥 Batches ({stats.totalBatches})
              </button>
              <button
                type="button"
                className={`hrtm-mp-subtab ${manageSubtab === 'participants' ? 'active' : ''}`}
                onClick={() => setManageSubtab('participants')}
              >
                🎓 Participants ({stats.totalParticipants})
              </button>
              <button
                type="button"
                className={`hrtm-mp-subtab ${manageSubtab === 'sessions' ? 'active' : ''}`}
                onClick={() => setManageSubtab('sessions')}
              >
                📅 Sessions ({stats.totalSessions})
              </button>
            </div>
          </div>

          <div className="hrtm-modal-body" ref={programModalBodyRef}>
            {loadingProgramDetails ? (
              <div className="hrtm-empty">Loading program details...</div>
            ) : (
              <>
                {/* Subtab 1: Overview */}
                {manageSubtab === 'overview' && (
                  <div>
                    <div className="hrtm-mp-stats-row">
                      <div className="hrtm-mp-stat-card">
                        <span className="hrtm-mp-stat-val">{stats.totalParticipants}</span>
                        <span className="hrtm-mp-stat-lbl">Enrolled Participants</span>
                      </div>
                      <div className="hrtm-mp-stat-card">
                        <span className="hrtm-mp-stat-val">{stats.totalCourses}</span>
                        <span className="hrtm-mp-stat-lbl">Linked Courses</span>
                      </div>
                      <div className="hrtm-mp-stat-card">
                        <span className="hrtm-mp-stat-val">{stats.totalBatches}</span>
                        <span className="hrtm-mp-stat-lbl">Program Batches</span>
                      </div>
                      <div className="hrtm-mp-stat-card">
                        <span className="hrtm-mp-stat-val">{stats.totalSessions}</span>
                        <span className="hrtm-mp-stat-lbl">Scheduled Sessions</span>
                      </div>
                      <div className="hrtm-mp-stat-card">
                        <span className="hrtm-mp-stat-val">{prog.totalHours ? `${prog.totalHours}h` : '—'}</span>
                        <span className="hrtm-mp-stat-lbl">Total Hours</span>
                      </div>
                      <div className="hrtm-mp-stat-card">
                        <span className="hrtm-mp-stat-val">₹{(prog.budget || 0).toLocaleString()}</span>
                        <span className="hrtm-mp-stat-lbl">Budget ({prog.currency || 'INR'})</span>
                      </div>
                    </div>

                    <div className="hrtm-mp-grid-2">
                      <div className="hrtm-mp-card">
                        <h4>📋 Program Architecture</h4>
                        <div className="hrtm-mp-info-list">
                          <div className="hrtm-mp-info-row">
                            <span className="hrtm-mp-info-label">Program Code</span>
                            <span className="hrtm-mp-info-value">{prog.programCode || 'TRN-AUTO'}</span>
                          </div>
                          <div className="hrtm-mp-info-row">
                            <span className="hrtm-mp-info-label">Category</span>
                            <span className="hrtm-mp-info-value">{prog.category || 'General'}</span>
                          </div>
                          <div className="hrtm-mp-info-row">
                            <span className="hrtm-mp-info-label">Training Type</span>
                            <span className="hrtm-mp-info-value">{prog.trainingType || 'Internal'}</span>
                          </div>
                          <div className="hrtm-mp-info-row">
                            <span className="hrtm-mp-info-label">Target Department</span>
                            <span className="hrtm-mp-info-value">{prog.department?.name || 'All Departments'}</span>
                          </div>
                          <div className="hrtm-mp-info-row">
                            <span className="hrtm-mp-info-label">Program Owner</span>
                            <span className="hrtm-mp-info-value">{getEmpName(prog.programOwner)}</span>
                          </div>
                          <div className="hrtm-mp-info-row">
                            <span className="hrtm-mp-info-label">Default Trainer</span>
                            <span className="hrtm-mp-info-value">
                              {prog.trainer ? (prog.trainer.trainerType === 'Internal' ? getEmpName(prog.trainer.employee) : prog.trainer.name) : 'Unassigned'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="hrtm-mp-card">
                        <h4>⏱️ Schedule & Capacity</h4>
                        <div className="hrtm-mp-info-list">
                          <div className="hrtm-mp-info-row">
                            <span className="hrtm-mp-info-label">Start Date</span>
                            <span className="hrtm-mp-info-value">{formatDate(prog.startDate)}</span>
                          </div>
                          <div className="hrtm-mp-info-row">
                            <span className="hrtm-mp-info-label">End Date</span>
                            <span className="hrtm-mp-info-value">{formatDate(prog.endDate)}</span>
                          </div>
                          <div className="hrtm-mp-info-row">
                            <span className="hrtm-mp-info-label">Seat Capacity</span>
                            <span className="hrtm-mp-info-value">{prog.capacity ? `${prog.capacity} Seats` : 'Unlimited'}</span>
                          </div>
                          <div className="hrtm-mp-info-row">
                            <span className="hrtm-mp-info-label">Duration</span>
                            <span className="hrtm-mp-info-value">{prog.totalHours || 0} Hours</span>
                          </div>
                          <div className="hrtm-mp-info-row">
                            <span className="hrtm-mp-info-label">Status</span>
                            <span className="hrtm-mp-info-value">{prog.status || 'Draft'}</span>
                          </div>
                          <div className="hrtm-mp-info-row">
                            <span className="hrtm-mp-info-label">Certificates Issued</span>
                            <span className="hrtm-mp-info-value">{stats.totalCertifications || 0}</span>
                          </div>
                        </div>
                        {prog.description && (
                          <div className="hrtm-mp-desc-box">
                            <span className="hrtm-mp-desc-label">Description:</span>
                            <p className="hrtm-mp-desc-text">
                              {prog.description}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Subtab 2: Courses */}
                {manageSubtab === 'courses' && (
                  <div>
                    <div className="hrtm-mp-action-bar">
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>Assign Course to Program:</span>
                      <div style={{ minWidth: 280, flex: 1 }}>
                        <CustomSelect
                          options={courses
                            .filter(c => !programDetailData?.courses?.some(pc => String(pc._id) === String(c._id)))
                            .map(c => ({
                              value: c._id,
                              label: c.title,
                              subtitle: c.code ? `${c.code} • ${c.category || 'General'}` : (c.category || 'General')
                            }))}
                          value={assignCourseId}
                          onChange={setAssignCourseId}
                          placeholder="-- Select Course from Catalog --"
                        />
                      </div>
                      <button
                        type="button"
                        className="hrtm-btn hrtm-btn-primary hrtm-btn-sm"
                        disabled={!assignCourseId}
                        onClick={handleAssignCourseToProgram}
                      >
                        + Add to Program
                      </button>
                    </div>

                    {(!programDetailData?.courses || programDetailData.courses.length === 0) ? (
                      <div className="hrtm-empty">
                        <div className="hrtm-empty-icon">📚</div>
                        No courses linked to this program yet. Choose an existing course from the catalog above to assign it.
                      </div>
                    ) : (
                      <div className="hrtm-mp-course-grid">
                        {programDetailData.courses.map(course => (
                          <div key={course._id} className="hrtm-mp-course-card">
                            <div>
                              <div className="hrtm-mp-course-title">{course.title}</div>
                              <div className="hrtm-mp-course-meta">
                                {course.code && <span className="hrtm-code-badge">{course.code}</span>}
                                <span className={`hrtm-badge hrtm-badge-${(course.difficulty || '').toLowerCase()}`}>{course.difficulty || 'Beginner'}</span>
                                <span style={{ color: '#64748b' }}>⏱️ {course.durationHours || 0}h</span>
                                <span style={{ color: '#64748b' }}>🏷️ {course.category || 'General'}</span>
                              </div>
                              {course.description && (
                                <div className="hrtm-mp-course-desc">{course.description}</div>
                              )}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                              <button
                                type="button"
                                className="hrtm-btn hrtm-btn-sm"
                                style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca' }}
                                onClick={() => handleRemoveCourseFromProgram(course._id)}
                              >
                                Unlink Course
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Subtab 3: Batches */}
                {manageSubtab === 'batches' && (
                  <div>
                    <form onSubmit={handleCreateBatch} className="hrtm-mp-batch-create-box">
                      <h5>+ Create New Program Batch</h5>
                      <div className="hrtm-form-row">
                        <div className="hrtm-form-group">
                          <label>Batch Name *</label>
                          <input
                            type="text"
                            required
                            value={batchForm.batchName}
                            onChange={e => setBatchForm({ ...batchForm, batchName: e.target.value })}
                            placeholder="e.g. Batch A - Spring 2026"
                          />
                        </div>
                        <div className="hrtm-form-group">
                          <label>Batch Status</label>
                          <CustomSelect
                            options={['Upcoming', 'Active', 'Completed', 'Cancelled']}
                            value={batchForm.status}
                            onChange={v => setBatchForm({ ...batchForm, status: v })}
                          />
                        </div>
                      </div>
                      <div className="hrtm-form-row">
                        <div className="hrtm-form-group">
                          <label>Start Date</label>
                          <input
                            type="date"
                            value={batchForm.startDate}
                            onChange={e => setBatchForm({ ...batchForm, startDate: e.target.value })}
                          />
                        </div>
                        <div className="hrtm-form-group">
                          <label>End Date</label>
                          <input
                            type="date"
                            value={batchForm.endDate}
                            onChange={e => setBatchForm({ ...batchForm, endDate: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="hrtm-form-row">
                        <div className="hrtm-form-group">
                          <label>Seat Capacity</label>
                          <input
                            type="number"
                            min="1"
                            value={batchForm.capacity}
                            onChange={e => setBatchForm({ ...batchForm, capacity: Number(e.target.value) })}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '0.85rem' }}>
                          <button type="submit" className="hrtm-btn hrtm-btn-primary" style={{ width: '100%' }}>
                            Add Batch
                          </button>
                        </div>
                      </div>
                    </form>

                    <div className="hrtm-table-wrap">
                      <table className="hrtm-table">
                        <thead>
                          <tr>
                            <th>Batch Name</th>
                            <th>Schedule</th>
                            <th>Capacity</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(!programDetailData?.batches || programDetailData.batches.length === 0) ? (
                            <tr><td colSpan="5" className="hrtm-empty">No batches created for this program yet</td></tr>
                          ) : (
                            programDetailData.batches.map(batch => (
                              <tr key={batch._id}>
                                <td><strong>{batch.batchName}</strong></td>
                                <td>{formatDate(batch.startDate)} – {formatDate(batch.endDate)}</td>
                                <td>{batch.capacity || 0} seats</td>
                                <td>
                                  <span className={`hrtm-badge hrtm-badge-${(batch.status || '').toLowerCase()}`}>
                                    <span className="hrtm-badge-dot" />
                                    {batch.status}
                                  </span>
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className="hrtm-action-btn hrtm-action-btn-delete"
                                    onClick={() => handleDeleteBatch(batch._id)}
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Subtab 4: Participants */}
                {manageSubtab === 'participants' && (
                  <div className="hrtm-table-wrap">
                    <table className="hrtm-table">
                      <thead>
                        <tr>
                          <th>Participant</th>
                          <th>Course</th>
                          <th>Progress</th>
                          <th>Attendance</th>
                          <th>Score</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!programDetailData?.participants || programDetailData.participants.length === 0) ? (
                          <tr><td colSpan="6" className="hrtm-empty">No participants enrolled in this program yet</td></tr>
                        ) : (
                          programDetailData.participants.map(part => (
                            <tr key={part._id}>
                              <td>
                                <strong>{getEmpName(part.employee)}</strong>
                                {part.employee?.email && <small style={{ display: 'block', color: '#64748b' }}>{part.employee.email}</small>}
                              </td>
                              <td>{part.course?.title || '—'}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <div className="hrtm-progress-bar" style={{ width: 60 }}>
                                    <div className="hrtm-progress-fill" style={{ width: `${part.progressPct || 0}%` }} />
                                  </div>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{part.progressPct || 0}%</span>
                                </div>
                              </td>
                              <td>{part.attendancePct ? `${part.attendancePct}%` : '—'}</td>
                              <td>{part.assessmentScore !== undefined ? `${part.assessmentScore}%` : '—'}</td>
                              <td>
                                <span className={`hrtm-badge hrtm-badge-${(part.status || '').toLowerCase().replace(' ', '-')}`}>
                                  <span className="hrtm-badge-dot" />
                                  {part.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Subtab 5: Sessions */}
                {manageSubtab === 'sessions' && (
                  <div className="hrtm-table-wrap">
                    <table className="hrtm-table">
                      <thead>
                        <tr>
                          <th>Session Title</th>
                          <th>Date</th>
                          <th>Time</th>
                          <th>Trainer</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!programDetailData?.sessions || programDetailData.sessions.length === 0) ? (
                          <tr><td colSpan="5" className="hrtm-empty">No sessions scheduled for this program yet</td></tr>
                        ) : (
                          programDetailData.sessions.map(sess => (
                            <tr key={sess._id}>
                              <td><strong>{sess.sessionTitle}</strong></td>
                              <td>{formatDate(sess.sessionDate)}</td>
                              <td>{sess.startTime || '—'} - {sess.endTime || '—'}</td>
                              <td>{sess.trainer ? (sess.trainer.trainerType === 'Internal' ? getEmpName(sess.trainer.employee) : sess.trainer.name) : '—'}</td>
                              <td>
                                <span className={`hrtm-badge hrtm-badge-${(sess.status || '').toLowerCase()}`}>
                                  <span className="hrtm-badge-dot" />
                                  {sess.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="hrtm-modal-footer">
            <button type="button" className="hrtm-btn hrtm-btn-secondary" onClick={() => setManagingProgram(null)}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderManageCourseModal = () => {
    if (!managingCourse) return null;
    const crs = courseDetailData?.course || managingCourse;
    const stats = courseDetailData?.stats || {
      totalEnrolled: 0,
      completed: 0,
      inProgress: 0,
      completionRate: 0,
      averageScore: 0,
      totalSessions: 0,
      totalCertificates: 0,
      totalModules: crs.modules?.length || 0,
      totalObjectives: crs.learningObjectives?.length || 0,
      totalMaterials: crs.materials?.length || 0,
    };
    const modules = crs.modules || [];
    const objectives = crs.learningObjectives || [];
    const materials = crs.materials || [];
    const linkedPrograms = courseDetailData?.linkedPrograms || crs.programs || [];
    const sessionsList = courseDetailData?.sessions || [];
    const assessmentsList = courseDetailData?.assessments || [];
    const certificationsList = courseDetailData?.certifications || [];
    const participantsList = courseDetailData?.participants || [];

    const level = crs.difficulty || crs.level || 'Beginner';
    const trainerName = crs.trainer
      ? (crs.trainer.trainerType === 'Internal' ? getEmpName(crs.trainer.employee) : crs.trainer.name)
      : (crs.trainingProvider || 'Unassigned');

    return (
      <div className="hrtm-modal-overlay" onClick={() => setManagingCourse(null)}>
        <div className="hrtm-modal hrtm-modal-xl" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="hrtm-modal-header">
            <div className="hrtm-modal-header-info">
              <div className="hrtm-modal-header-title-row">
                <h3>{crs.title}</h3>
                {crs.code && (
                  <span className="hrtm-code-badge">{crs.code}</span>
                )}
                <span className={`hrtm-badge hrtm-badge-${level.toLowerCase()}`}>{level}</span>
                <span className="hrtm-code-badge" style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}>
                  {crs.category || 'General'}
                </span>
                <span className={`hrtm-badge hrtm-badge-${(crs.status || '').toLowerCase()}`}>
                  <span className="hrtm-badge-dot" />
                  {crs.status || 'Draft'}
                </span>
              </div>
              <div className="hrtm-modal-header-meta-row">
                <span className="hrtm-modal-header-meta-item">🏢 <strong>{crs.department?.name || 'All Departments'}</strong></span>
                <span className="hrtm-modal-header-meta-item">👨‍🏫 Trainer: <strong>{trainerName}</strong></span>
                <span className="hrtm-modal-header-meta-item">⏱️ Duration: <strong>{crs.durationHours || crs.duration || 0} Hours</strong></span>
              </div>
            </div>
            <button className="hrtm-modal-close" onClick={() => setManagingCourse(null)}>✕</button>
          </div>

          {/* Fixed 9 Sub-tab Navigation Bar */}
          <div className="hrtm-modal-subtabs-bar">
            <div className="hrtm-mc-subtabs">
              <button
                type="button"
                className={`hrtm-mc-subtab ${courseManageTab === 'overview' ? 'active' : ''}`}
                onClick={() => setCourseManageTab('overview')}
              >
                📊 Overview
              </button>
              <button
                type="button"
                className={`hrtm-mc-subtab ${courseManageTab === 'modules' ? 'active' : ''}`}
                onClick={() => setCourseManageTab('modules')}
              >
                📑 Modules ({modules.length})
              </button>
              <button
                type="button"
                className={`hrtm-mc-subtab ${courseManageTab === 'objectives' ? 'active' : ''}`}
                onClick={() => setCourseManageTab('objectives')}
              >
                🎯 Objectives ({objectives.length})
              </button>
              <button
                type="button"
                className={`hrtm-mc-subtab ${courseManageTab === 'materials' ? 'active' : ''}`}
                onClick={() => setCourseManageTab('materials')}
              >
                📦 Materials ({materials.length})
              </button>
              <button
                type="button"
                className={`hrtm-mc-subtab ${courseManageTab === 'programs' ? 'active' : ''}`}
                onClick={() => setCourseManageTab('programs')}
              >
                📁 Programs ({linkedPrograms.length})
              </button>
              <button
                type="button"
                className={`hrtm-mc-subtab ${courseManageTab === 'sessions' ? 'active' : ''}`}
                onClick={() => setCourseManageTab('sessions')}
              >
                📅 Sessions ({sessionsList.length})
              </button>
              <button
                type="button"
                className={`hrtm-mc-subtab ${courseManageTab === 'assessments' ? 'active' : ''}`}
                onClick={() => setCourseManageTab('assessments')}
              >
                📝 Assessments ({assessmentsList.length})
              </button>
              <button
                type="button"
                className={`hrtm-mc-subtab ${courseManageTab === 'certifications' ? 'active' : ''}`}
                onClick={() => setCourseManageTab('certifications')}
              >
                🏅 Certifications ({certificationsList.length})
              </button>
              <button
                type="button"
                className={`hrtm-mc-subtab ${courseManageTab === 'participants' ? 'active' : ''}`}
                onClick={() => setCourseManageTab('participants')}
              >
                👥 Participants ({participantsList.length})
              </button>
            </div>
          </div>

          <div className="hrtm-modal-body" ref={courseModalBodyRef}>
            {loadingCourseDetails ? (
              <div className="hrtm-empty">Loading course specifications & curriculum...</div>
            ) : (
              <>
                {/* Subtab 1: Overview */}
                {courseManageTab === 'overview' && (
                  <div>
                    <div className="hrtm-mp-stats-row">
                      <div className="hrtm-mp-stat-card">
                        <span className="hrtm-mp-stat-val">{stats.totalEnrolled}</span>
                        <span className="hrtm-mp-stat-lbl">Enrolled Learners</span>
                      </div>
                      <div className="hrtm-mp-stat-card">
                        <span className="hrtm-mp-stat-val">{stats.completionRate}%</span>
                        <span className="hrtm-mp-stat-lbl">Completion Rate</span>
                      </div>
                      <div className="hrtm-mp-stat-card">
                        <span className="hrtm-mp-stat-val">{stats.averageScore ? `${stats.averageScore}%` : '—'}</span>
                        <span className="hrtm-mp-stat-lbl">Avg Assessment Score</span>
                      </div>
                      <div className="hrtm-mp-stat-card">
                        <span className="hrtm-mp-stat-val">{modules.length}</span>
                        <span className="hrtm-mp-stat-lbl">Curriculum Modules</span>
                      </div>
                      <div className="hrtm-mp-stat-card">
                        <span className="hrtm-mp-stat-val">{crs.durationHours || crs.duration || 0}h</span>
                        <span className="hrtm-mp-stat-lbl">Duration</span>
                      </div>
                      <div className="hrtm-mp-stat-card">
                        <span className="hrtm-mp-stat-val">{linkedPrograms.length}</span>
                        <span className="hrtm-mp-stat-lbl">Linked Programs</span>
                      </div>
                    </div>

                    <div className="hrtm-mp-grid-2">
                      <div className="hrtm-mp-card">
                        <h4>📋 Course Specifications</h4>
                        <div className="hrtm-mp-info-list">
                          <div className="hrtm-mp-info-row">
                            <span className="hrtm-mp-info-label">Course Code</span>
                            <span className="hrtm-mp-info-value">{crs.code || 'CRS-AUTO'}</span>
                          </div>
                          <div className="hrtm-mp-info-row">
                            <span className="hrtm-mp-info-label">Category</span>
                            <span className="hrtm-mp-info-value">{crs.category || 'General'}</span>
                          </div>
                          <div className="hrtm-mp-info-row">
                            <span className="hrtm-mp-info-label">Difficulty / Level</span>
                            <span className="hrtm-mp-info-value">{level}</span>
                          </div>
                          <div className="hrtm-mp-info-row">
                            <span className="hrtm-mp-info-label">Department</span>
                            <span className="hrtm-mp-info-value">{crs.department?.name || 'All Departments'}</span>
                          </div>
                          <div className="hrtm-mp-info-row">
                            <span className="hrtm-mp-info-label">Trainer / Faculty</span>
                            <span className="hrtm-mp-info-value">{trainerName}</span>
                          </div>
                          <div className="hrtm-mp-info-row">
                            <span className="hrtm-mp-info-label">Training Provider</span>
                            <span className="hrtm-mp-info-value">{crs.trainingProvider || 'Internal'}</span>
                          </div>
                          <div className="hrtm-mp-info-row">
                            <span className="hrtm-mp-info-label">Status</span>
                            <span className="hrtm-mp-info-value">{crs.status || 'Draft'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="hrtm-mp-card">
                        <h4>🎯 Prerequisites & Target Skills</h4>
                        <div style={{ marginBottom: '0.45rem' }}>
                          <span className="hrtm-mp-info-label" style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.74rem', fontWeight: 600 }}>
                            Prerequisites:
                          </span>
                          {Array.isArray(crs.prerequisites) && crs.prerequisites.length > 0 ? (
                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                              {crs.prerequisites.map((p, i) => (
                                <span key={i} className="hrtm-tag-pill">✓ {p}</span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.76rem' }}>None specified</span>
                          )}
                        </div>

                        <div style={{ marginBottom: '0.45rem' }}>
                          <span className="hrtm-mp-info-label" style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.74rem', fontWeight: 600 }}>
                            Target / Acquired Skills:
                          </span>
                          {Array.isArray(crs.requiredSkills) && crs.requiredSkills.length > 0 ? (
                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                              {crs.requiredSkills.map((s, i) => (
                                <span key={i} className="hrtm-tag-pill" style={{ background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}>★ {s}</span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.76rem' }}>None specified</span>
                          )}
                        </div>

                        {crs.description && (
                          <div className="hrtm-mp-desc-box">
                            <span className="hrtm-mp-desc-label">Course Overview:</span>
                            <p className="hrtm-mp-desc-text">
                              {crs.description}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Subtab 2: Modules */}
                {courseManageTab === 'modules' && (
                  <div>
                    {/* Add / Edit Module Form */}
                    <form onSubmit={handleSaveModule} className="hrtm-mp-batch-create-box" style={{ marginBottom: '1.25rem' }}>
                      <h5>{editingModuleId ? '✏️ Edit Module' : '+ Add Curriculum Module'}</h5>
                      <div className="hrtm-form-row">
                        <div className="hrtm-form-group" style={{ flex: 2 }}>
                          <label>Module Title *</label>
                          <input
                            type="text"
                            required
                            value={moduleForm.moduleName}
                            onChange={e => setModuleForm({ ...moduleForm, moduleName: e.target.value })}
                            placeholder="e.g. Module 1: Cloud Security Fundamentals"
                          />
                        </div>
                        <div className="hrtm-form-group" style={{ flex: 1 }}>
                          <label>Duration (Hours)</label>
                          <input
                            type="number"
                            min="0"
                            value={moduleForm.duration}
                            onChange={e => setModuleForm({ ...moduleForm, duration: Number(e.target.value) })}
                          />
                        </div>
                        <div className="hrtm-form-group" style={{ flex: 1 }}>
                          <label>Display Order</label>
                          <input
                            type="number"
                            min="1"
                            value={moduleForm.order}
                            onChange={e => setModuleForm({ ...moduleForm, order: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div className="hrtm-form-group">
                        <label>Module Summary / Topics Covered</label>
                        <textarea
                          rows="2"
                          value={moduleForm.description}
                          onChange={e => setModuleForm({ ...moduleForm, description: e.target.value })}
                          placeholder="Key topics, exercises, lab work, deliverables..."
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        {editingModuleId && (
                          <button
                            type="button"
                            className="hrtm-btn hrtm-btn-secondary hrtm-btn-sm"
                            onClick={() => {
                              setEditingModuleId(null);
                              setModuleForm({ moduleName: '', description: '', duration: 2, order: (modules.length || 0) + 1 });
                            }}
                          >
                            Cancel
                          </button>
                        )}
                        <button type="submit" className="hrtm-btn hrtm-btn-primary hrtm-btn-sm">
                          {editingModuleId ? 'Update Module' : 'Save Module'}
                        </button>
                      </div>
                    </form>

                    {/* Modules List */}
                    {modules.length === 0 ? (
                      <div className="hrtm-empty">
                        <div className="hrtm-empty-icon">📑</div>
                        No modules created yet. Add course modules above to build the curriculum.
                      </div>
                    ) : (
                      modules
                        .slice()
                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                        .map((mod, idx) => (
                          <div key={mod._id || idx} className="hrtm-mc-module-card">
                            <div className="hrtm-mc-module-num">
                              {mod.order || idx + 1}
                            </div>
                            <div className="hrtm-mc-module-info">
                              <div className="hrtm-mc-module-title">{mod.moduleName}</div>
                              {mod.description && (
                                <div className="hrtm-mc-module-desc">{mod.description}</div>
                              )}
                              <div className="hrtm-mc-module-dur">⏱️ {mod.duration || 0} Hours</div>
                            </div>
                            <div className="hrtm-action-group">
                              <button
                                type="button"
                                className="hrtm-action-btn hrtm-action-btn-edit"
                                title="Edit Module"
                                onClick={() => {
                                  setEditingModuleId(mod._id);
                                  setModuleForm({
                                    moduleName: mod.moduleName || '',
                                    description: mod.description || '',
                                    duration: mod.duration || 0,
                                    order: mod.order || idx + 1
                                  });
                                }}
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                className="hrtm-action-btn hrtm-action-btn-delete"
                                title="Delete Module"
                                onClick={() => handleDeleteModule(mod._id)}
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                )}

                {/* Subtab 3: Objectives */}
                {courseManageTab === 'objectives' && (
                  <div>
                    {/* Add Objective Form */}
                    <form onSubmit={handleAddObjective} className="hrtm-mp-action-bar" style={{ marginBottom: '1.25rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>+ Add Learning Objective:</span>
                      <input
                        type="text"
                        required
                        value={objectiveForm.objective}
                        onChange={e => setObjectiveForm({ ...objectiveForm, objective: e.target.value })}
                        placeholder="e.g. Master role-based access control and token encryption in microservices"
                        style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.82rem' }}
                      />
                      <button type="submit" className="hrtm-btn hrtm-btn-primary hrtm-btn-sm">
                        Add Objective
                      </button>
                    </form>

                    {objectives.length === 0 ? (
                      <div className="hrtm-empty">
                        <div className="hrtm-empty-icon">🎯</div>
                        No learning objectives added yet. Define key outcomes above.
                      </div>
                    ) : (
                      objectives
                        .slice()
                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                        .map((obj, idx) => (
                          <div key={obj._id || idx} className="hrtm-mc-obj-row">
                            <div className="hrtm-mc-obj-text">
                              <span style={{ color: '#2563eb', fontWeight: 700 }}>#{idx + 1}</span>
                              <span>{obj.objective}</span>
                            </div>
                            <button
                              type="button"
                              className="hrtm-action-btn hrtm-action-btn-delete"
                              title="Delete Objective"
                              onClick={() => handleDeleteObjective(obj._id)}
                            >
                              🗑️
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                )}

                {/* Subtab 4: Materials */}
                {courseManageTab === 'materials' && (
                  <div>
                    {/* Add Material Form */}
                    <form onSubmit={handleAddMaterial} className="hrtm-mp-batch-create-box" style={{ marginBottom: '1.25rem' }}>
                      <h5>+ Add Training Resource or Material</h5>
                      <div className="hrtm-form-row">
                        <div className="hrtm-form-group" style={{ flex: 2 }}>
                          <label>Material Title *</label>
                          <input
                            type="text"
                            required
                            value={materialForm.title}
                            onChange={e => setMaterialForm({ ...materialForm, title: e.target.value })}
                            placeholder="e.g. Architecture Guide PDF, Cloud Lab Workbook"
                          />
                        </div>
                        <div className="hrtm-form-group" style={{ flex: 1 }}>
                          <label>Material Type</label>
                          <CustomSelect
                            options={['Document', 'Video', 'Slide', 'Link', 'Assignment', 'Exam']}
                            value={materialForm.materialType}
                            onChange={v => setMaterialForm({ ...materialForm, materialType: v })}
                          />
                        </div>
                      </div>
                      <div className="hrtm-form-row">
                        <div className="hrtm-form-group" style={{ flex: 2 }}>
                          <label>Resource URL / Download Link *</label>
                          <input
                            type="url"
                            required
                            value={materialForm.url}
                            onChange={e => setMaterialForm({ ...materialForm, url: e.target.value })}
                            placeholder="https://... or /documents/..."
                          />
                        </div>
                        <div className="hrtm-form-group" style={{ flex: 1 }}>
                          <label>File Name (Optional)</label>
                          <input
                            type="text"
                            value={materialForm.fileName}
                            onChange={e => setMaterialForm({ ...materialForm, fileName: e.target.value })}
                            placeholder="e.g. syllabus.pdf"
                          />
                        </div>
                      </div>
                      <div className="hrtm-form-group">
                        <label>Notes / Instructions for Learners</label>
                        <input
                          type="text"
                          value={materialForm.notes}
                          onChange={e => setMaterialForm({ ...materialForm, notes: e.target.value })}
                          placeholder="e.g. Review chapter 1-3 before attending Session 2"
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" className="hrtm-btn hrtm-btn-primary hrtm-btn-sm">
                          Add Material
                        </button>
                      </div>
                    </form>

                    {materials.length === 0 ? (
                      <div className="hrtm-empty">
                        <div className="hrtm-empty-icon">📦</div>
                        No learning resources or materials uploaded yet.
                      </div>
                    ) : (
                      <div className="hrtm-mc-material-grid">
                        {materials.map((mat, idx) => {
                          const icon = mat.materialType === 'Video' ? '🎥' : mat.materialType === 'Slide' ? '📊' : mat.materialType === 'Link' ? '🔗' : '📄';
                          return (
                            <div key={mat._id || idx} className="hrtm-mc-material-card">
                              <div>
                                <div className="hrtm-mc-mat-header">
                                  <span className="hrtm-mc-mat-icon">{icon}</span>
                                  <div>
                                    <div className="hrtm-mc-mat-title">{mat.title}</div>
                                    <span className="hrtm-code-badge" style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem' }}>
                                      {mat.materialType || 'Document'}
                                    </span>
                                  </div>
                                </div>
                                {mat.notes && (
                                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                    {mat.notes}
                                  </p>
                                )}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                                <a
                                  href={mat.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hrtm-btn hrtm-btn-secondary hrtm-btn-sm"
                                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                                >
                                  Open Resource ↗
                                </a>
                                <button
                                  type="button"
                                  className="hrtm-action-btn hrtm-action-btn-delete"
                                  title="Delete Material"
                                  onClick={() => handleDeleteMaterial(mat._id)}
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Subtab 5: Programs */}
                {courseManageTab === 'programs' && (
                  <div>
                    {/* Link to Program Action Bar */}
                    <form onSubmit={handleLinkProgramToCourse} className="hrtm-mp-action-bar" style={{ marginBottom: '1.25rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>Associate with Program:</span>
                      <div style={{ minWidth: 260, flex: 1 }}>
                        <CustomSelect
                          options={programs
                            .filter(p => !linkedPrograms.some(lp => String(lp._id || lp) === String(p._id)))
                            .map(p => ({
                              value: p._id,
                              label: p.name,
                              subtitle: p.programCode ? `${p.programCode} • ${p.category || 'General'}` : (p.category || 'General')
                            }))}
                          value={courseLinkProgramId}
                          onChange={setCourseLinkProgramId}
                          placeholder="-- Select Training Program --"
                        />
                      </div>
                      <button
                        type="submit"
                        className="hrtm-btn hrtm-btn-primary hrtm-btn-sm"
                        disabled={!courseLinkProgramId}
                      >
                        + Link Program
                      </button>
                    </form>

                    {linkedPrograms.length === 0 ? (
                      <div className="hrtm-empty">
                        <div className="hrtm-empty-icon">📁</div>
                        This course is currently not linked to any Training Programs. Link it above so programs can include this course in their curriculum.
                      </div>
                    ) : (
                      <div className="hrtm-mp-course-grid">
                        {linkedPrograms.map(prog => {
                          const pObj = typeof prog === 'object' ? prog : programs.find(p => String(p._id) === String(prog)) || { _id: prog, name: 'Program' };
                          return (
                            <div key={pObj._id} className="hrtm-mp-course-card">
                              <div>
                                <div className="hrtm-mp-course-title">{pObj.name}</div>
                                <div className="hrtm-mp-course-meta">
                                  {pObj.programCode && <span className="hrtm-code-badge">{pObj.programCode}</span>}
                                  <span className="hrtm-badge hrtm-badge-internal">{pObj.trainingType || 'Internal'}</span>
                                  <span className={`hrtm-badge hrtm-badge-${(pObj.status || '').toLowerCase()}`}>{pObj.status || 'Active'}</span>
                                </div>
                                {pObj.description && (
                                  <div className="hrtm-mp-course-desc">{pObj.description}</div>
                                )}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                                <button
                                  type="button"
                                  className="hrtm-btn hrtm-btn-sm"
                                  style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca' }}
                                  onClick={() => handleUnlinkProgramFromCourse(pObj._id)}
                                >
                                  Unlink Program
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Subtab 6: Sessions */}
                {courseManageTab === 'sessions' && (
                  <div className="hrtm-table-wrap">
                    <table className="hrtm-table">
                      <thead>
                        <tr>
                          <th>Session Title</th>
                          <th>Schedule Date</th>
                          <th>Timing</th>
                          <th>Trainer</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionsList.length === 0 ? (
                          <tr><td colSpan="5" className="hrtm-empty">No sessions scheduled specifically for this course yet</td></tr>
                        ) : (
                          sessionsList.map(sess => (
                            <tr key={sess._id}>
                              <td><strong>{sess.sessionTitle}</strong></td>
                              <td>{formatDate(sess.sessionDate)}</td>
                              <td>{sess.startTime || '—'} - {sess.endTime || '—'}</td>
                              <td>{sess.trainer ? (sess.trainer.trainerType === 'Internal' ? getEmpName(sess.trainer.employee) : sess.trainer.name) : '—'}</td>
                              <td>
                                <span className={`hrtm-badge hrtm-badge-${(sess.status || '').toLowerCase()}`}>
                                  <span className="hrtm-badge-dot" />
                                  {sess.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Subtab 7: Assessments */}
                {courseManageTab === 'assessments' && (
                  <div>
                    {/* Assessment Configuration Box */}
                    <form onSubmit={handleSaveAssessmentConfig} className="hrtm-mp-batch-create-box" style={{ marginBottom: '1.25rem' }}>
                      <h5>⚙️ Course Assessment & Passing Criteria</h5>
                      <div className="hrtm-form-row">
                        <div className="hrtm-form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="checkbox"
                            id="mc-assess-req"
                            checked={assessmentConfigForm.isRequired}
                            onChange={e => setAssessmentConfigForm({ ...assessmentConfigForm, isRequired: e.target.checked })}
                            style={{ width: '18px', height: '18px' }}
                          />
                          <label htmlFor="mc-assess-req" style={{ margin: 0, cursor: 'pointer', fontWeight: 600 }}>
                            Mandatory Assessment Required for Completion
                          </label>
                        </div>
                        <div className="hrtm-form-group">
                          <label>Minimum Passing Score (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={assessmentConfigForm.passingScore}
                            onChange={e => setAssessmentConfigForm({ ...assessmentConfigForm, passingScore: Number(e.target.value) })}
                          />
                        </div>
                        <div className="hrtm-form-group">
                          <label>Max Allowed Attempts</label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={assessmentConfigForm.maxAttempts}
                            onChange={e => setAssessmentConfigForm({ ...assessmentConfigForm, maxAttempts: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" className="hrtm-btn hrtm-btn-primary hrtm-btn-sm">
                          Save Assessment Criteria
                        </button>
                      </div>
                    </form>

                    {/* Linked Assessments List */}
                    <div className="hrtm-table-wrap">
                      <table className="hrtm-table">
                        <thead>
                          <tr>
                            <th>Assessment Title</th>
                            <th>Assessment Type</th>
                            <th>Total Marks</th>
                            <th>Passing Marks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assessmentsList.length === 0 ? (
                            <tr><td colSpan="4" className="hrtm-empty">No assessments registered for this course yet</td></tr>
                          ) : (
                            assessmentsList.map(a => (
                              <tr key={a._id}>
                                <td><strong>{a.title}</strong></td>
                                <td><span className="hrtm-code-badge">{a.assessmentType || 'Quiz'}</span></td>
                                <td>{a.totalMarks || 100}</td>
                                <td>{a.passingMarks || 70}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Subtab 8: Certifications */}
                {courseManageTab === 'certifications' && (
                  <div>
                    {/* Certification Configuration Box */}
                    <form onSubmit={handleSaveCertConfig} className="hrtm-mp-batch-create-box" style={{ marginBottom: '1.25rem' }}>
                      <h5>🏅 Certificate Issuance Settings</h5>
                      <div className="hrtm-form-row">
                        <div className="hrtm-form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="checkbox"
                            id="mc-cert-enabled"
                            checked={certConfigForm.isEnabled}
                            onChange={e => setCertConfigForm({ ...certConfigForm, isEnabled: e.target.checked })}
                            style={{ width: '18px', height: '18px' }}
                          />
                          <label htmlFor="mc-cert-enabled" style={{ margin: 0, cursor: 'pointer', fontWeight: 600 }}>
                            Award Completion Certificate upon Passing
                          </label>
                        </div>
                        <div className="hrtm-form-group">
                          <label>Validity (Months, 0 = Lifetime)</label>
                          <input
                            type="number"
                            min="0"
                            value={certConfigForm.validForMonths}
                            onChange={e => setCertConfigForm({ ...certConfigForm, validForMonths: Number(e.target.value) })}
                          />
                        </div>
                        <div className="hrtm-form-group">
                          <label>Certificate Template</label>
                          <CustomSelect
                            options={['Standard', 'Professional', 'Executive']}
                            value={certConfigForm.certificateTemplate}
                            onChange={v => setCertConfigForm({ ...certConfigForm, certificateTemplate: v })}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" className="hrtm-btn hrtm-btn-primary hrtm-btn-sm">
                          Save Certification Settings
                        </button>
                      </div>
                    </form>

                    {/* Issued Certificates List */}
                    <div className="hrtm-table-wrap">
                      <table className="hrtm-table">
                        <thead>
                          <tr>
                            <th>Recipient Employee</th>
                            <th>Certificate #</th>
                            <th>Issue Date</th>
                            <th>Valid Until</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {certificationsList.length === 0 ? (
                            <tr><td colSpan="5" className="hrtm-empty">No certificates issued for this course yet</td></tr>
                          ) : (
                            certificationsList.map(c => (
                              <tr key={c._id}>
                                <td><strong>{getEmpName(c.employee)}</strong></td>
                                <td><span className="hrtm-code-badge">{c.certificateNumber || '—'}</span></td>
                                <td>{formatDate(c.issueDate)}</td>
                                <td>{c.expiryDate ? formatDate(c.expiryDate) : 'Lifetime'}</td>
                                <td>
                                  <span className={`hrtm-badge hrtm-badge-${(c.status || 'Active').toLowerCase()}`}>
                                    <span className="hrtm-badge-dot" />
                                    {c.status || 'Active'}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Subtab 9: Participants & Progress */}
                {courseManageTab === 'participants' && (
                  <div className="hrtm-table-wrap">
                    <table className="hrtm-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Program Association</th>
                          <th>Status</th>
                          <th>Progress</th>
                          <th>Attendance</th>
                          <th>Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {participantsList.length === 0 ? (
                          <tr><td colSpan="6" className="hrtm-empty">No employee enrollments recorded for this course yet</td></tr>
                        ) : (
                          participantsList.map((p, idx) => (
                            <tr key={p._id || idx}>
                              <td>
                                <strong>{getEmpName(p.employee)}</strong>
                                {p.employee?.email && <small style={{ display: 'block', color: '#64748b' }}>{p.employee.email}</small>}
                              </td>
                              <td>{p.program?.name || 'Independent Course'}</td>
                              <td>
                                <span className={`hrtm-badge hrtm-badge-${(p.status || '').toLowerCase()}`}>
                                  <span className="hrtm-badge-dot" />
                                  {p.status}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div className="hrtm-progress-bar" style={{ width: '80px' }}>
                                    <div className="hrtm-progress-fill" style={{ width: `${p.progressPercentage || 0}%` }} />
                                  </div>
                                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{p.progressPercentage || 0}%</span>
                                </div>
                              </td>
                              <td>{p.attendanceRate ? `${p.attendanceRate}%` : '—'}</td>
                              <td>{p.assessmentScore ? `${p.assessmentScore}%` : '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="hrtm-modal-footer">
            <button type="button" className="hrtm-btn hrtm-btn-secondary" onClick={() => setManagingCourse(null)}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderAssessmentFormModal = () => {
    if (!showAssessmentModal) return null;

    const availableCourses = assessmentForm.program
      ? courses.filter(c => String(c.program?._id || c.program) === String(assessmentForm.program))
      : courses;

    return (
      <div className="hrtm-modal-overlay">
        <div className="hrtm-modal hrtm-modal-lg">
          <div className="hrtm-modal-header">
            <h3>{editingAssessment ? 'Edit Training Assessment' : 'Create New Training Assessment'}</h3>
            <button type="button" className="hrtm-modal-close" onClick={() => setShowAssessmentModal(false)}>✕</button>
          </div>
          <form onSubmit={handleSaveAssessment}>
            <div className="hrtm-modal-body">
              {/* Basic Info Row 1 */}
              <div className="hrtm-form-row">
                <div className="hrtm-form-group" style={{ flex: 2 }}>
                  <label>Assessment Name / Title *</label>
                  <input
                    type="text"
                    required
                    value={assessmentForm.name}
                    onChange={e => setAssessmentForm({ ...assessmentForm, name: e.target.value })}
                    placeholder="e.g. Q3 React & Node.js Core Competency Exam"
                  />
                </div>
                <div className="hrtm-form-group" style={{ flex: 1 }}>
                  <label>Assessment Type *</label>
                  <CustomSelect
                    options={['Quiz', 'Exam', 'Practical', 'Assignment', 'Survey']}
                    value={assessmentForm.assessmentType}
                    onChange={v => setAssessmentForm({ ...assessmentForm, assessmentType: v })}
                  />
                </div>
              </div>

              {/* Basic Info Row 2: Program & Course */}
              <div className="hrtm-form-row">
                <div className="hrtm-form-group">
                  <label>Training Program</label>
                  <CustomSelect
                    options={[{ value: '', label: 'Select Program (Optional)' }, ...programs.map(p => ({ value: p._id, label: p.name }))]}
                    value={assessmentForm.program}
                    onChange={v => {
                      setAssessmentForm({ ...assessmentForm, program: v, course: '' });
                    }}
                    placeholder="Select Program"
                  />
                </div>
                <div className="hrtm-form-group">
                  <label>Training Course *</label>
                  <CustomSelect
                    options={availableCourses.map(c => ({ value: c._id, label: c.title }))}
                    value={assessmentForm.course}
                    onChange={v => setAssessmentForm({ ...assessmentForm, course: v })}
                    placeholder="-- Select Course --"
                  />
                </div>
              </div>

              {/* Scoring & Duration Row */}
              <div className="hrtm-form-row">
                <div className="hrtm-form-group">
                  <label>Duration (Minutes) *</label>
                  <input
                    type="number"
                    min="5"
                    max="600"
                    required
                    value={assessmentForm.duration}
                    onChange={e => setAssessmentForm({ ...assessmentForm, duration: Number(e.target.value) })}
                  />
                </div>
                <div className="hrtm-form-group">
                  <label>Total Marks *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={assessmentForm.totalMarks}
                    onChange={e => setAssessmentForm({ ...assessmentForm, totalMarks: Number(e.target.value) })}
                  />
                </div>
                <div className="hrtm-form-group">
                  <label>Passing Marks / Score *</label>
                  <input
                    type="number"
                    min="1"
                    max={assessmentForm.totalMarks}
                    required
                    value={assessmentForm.passingMarks}
                    onChange={e => setAssessmentForm({ ...assessmentForm, passingMarks: Number(e.target.value) })}
                  />
                </div>
                <div className="hrtm-form-group">
                  <label>Initial Status *</label>
                  <CustomSelect
                    options={['Draft', 'Published', 'Closed']}
                    value={assessmentForm.status}
                    onChange={v => setAssessmentForm({ ...assessmentForm, status: v })}
                  />
                </div>
              </div>

              {/* Dates Row */}
              <div className="hrtm-form-row">
                <div className="hrtm-form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={assessmentForm.startDate}
                    onChange={e => setAssessmentForm({ ...assessmentForm, startDate: e.target.value })}
                  />
                </div>
                <div className="hrtm-form-group">
                  <label>End Date / Deadline</label>
                  <input
                    type="date"
                    value={assessmentForm.endDate}
                    onChange={e => setAssessmentForm({ ...assessmentForm, endDate: e.target.value })}
                  />
                </div>
              </div>

              {/* Description & Instructions */}
              <div className="hrtm-form-group">
                <label>Description / Assessment Overview</label>
                <textarea
                  rows="2"
                  value={assessmentForm.description}
                  onChange={e => setAssessmentForm({ ...assessmentForm, description: e.target.value })}
                  placeholder="Provide background, target skills, or objectives for this assessment..."
                />
              </div>
              <div className="hrtm-form-group">
                <label>Instructions for Candidates</label>
                <textarea
                  rows="2"
                  value={assessmentForm.instructions}
                  onChange={e => setAssessmentForm({ ...assessmentForm, instructions: e.target.value })}
                  placeholder="e.g. Attempt all questions within the allocated time. Passing threshold is 60%."
                />
              </div>

              {/* Question Management Builder */}
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                      Questions & Tasks ({assessmentForm.questions?.length || 0})
                    </h4>
                    <span style={{ fontSize: '0.73rem', color: '#64748b' }}>
                      Build multiple-choice, true/false, short answer, or practical tasks. Total question marks: {assessmentForm.questions?.reduce((s, q) => s + (Number(q.marks) || 0), 0) || 0}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="hrtm-btn hrtm-btn-secondary hrtm-btn-sm"
                    onClick={handleAddQuestion}
                  >
                    + Add Question
                  </button>
                </div>

                {(!assessmentForm.questions || assessmentForm.questions.length === 0) ? (
                  <div style={{ padding: '1.25rem', textAlign: 'center', background: '#f8fafc', borderRadius: '6px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '0.8rem' }}>
                    No questions added yet. Click <strong>"+ Add Question"</strong> above to add assessment questions or tasks.
                  </div>
                ) : (
                  assessmentForm.questions.map((q, qIdx) => (
                    <div key={qIdx} className="hrtm-question-card">
                      <div className="hrtm-question-header">
                        <div className="hrtm-question-num">
                          <span>Q{qIdx + 1}.</span>
                          <div style={{ width: '160px' }}>
                            <CustomSelect
                              options={['Multiple Choice', 'True/False', 'Short Answer', 'Task/Practical']}
                              value={q.questionType || 'Multiple Choice'}
                              onChange={v => handleUpdateQuestion(qIdx, 'questionType', v)}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Marks:</span>
                            <input
                              type="number"
                              min="1"
                              style={{ width: '65px', padding: '0.2rem 0.4rem', height: '28px', fontSize: '0.8rem' }}
                              value={q.marks || 10}
                              onChange={e => handleUpdateQuestion(qIdx, 'marks', Number(e.target.value))}
                            />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            type="button"
                            className="hrtm-btn-icon"
                            disabled={qIdx === 0}
                            title="Move Up"
                            onClick={() => handleMoveQuestion(qIdx, -1)}
                          >
                            ⬆️
                          </button>
                          <button
                            type="button"
                            className="hrtm-btn-icon"
                            disabled={qIdx === assessmentForm.questions.length - 1}
                            title="Move Down"
                            onClick={() => handleMoveQuestion(qIdx, 1)}
                          >
                            ⬇️
                          </button>
                          <button
                            type="button"
                            className="hrtm-btn-icon"
                            style={{ color: '#dc2626' }}
                            title="Delete Question"
                            onClick={() => handleRemoveQuestion(qIdx)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Question Text */}
                      <div style={{ marginBottom: '0.6rem' }}>
                        <textarea
                          rows="2"
                          placeholder="Enter question statement, scenario, or task prompt..."
                          value={q.questionText || ''}
                          onChange={e => handleUpdateQuestion(qIdx, 'questionText', e.target.value)}
                        />
                      </div>

                      {/* Question Type Specific Content */}
                      {q.questionType === 'Multiple Choice' && (
                        <div style={{ background: '#f1f5f9', padding: '0.75rem', borderRadius: '6px', marginBottom: '0.5rem' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>
                            Options (Select radio for correct answer):
                          </div>
                          {(q.options || []).map((opt, optIdx) => (
                            <div key={optIdx} className="hrtm-opt-row">
                              <input
                                type="radio"
                                name={`correct_${qIdx}`}
                                checked={q.correctAnswer === opt}
                                onChange={() => handleUpdateQuestion(qIdx, 'correctAnswer', opt)}
                                title="Mark as correct answer"
                              />
                              <input
                                type="text"
                                style={{ flex: 1, height: '28px', fontSize: '0.8rem' }}
                                value={opt}
                                onChange={e => handleUpdateOption(qIdx, optIdx, e.target.value)}
                                placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                              />
                              {(q.options?.length || 0) > 2 && (
                                <button
                                  type="button"
                                  className="hrtm-btn-icon"
                                  style={{ color: '#dc2626' }}
                                  onClick={() => handleRemoveOption(qIdx, optIdx)}
                                  title="Remove option"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            className="hrtm-btn hrtm-btn-secondary hrtm-btn-sm"
                            style={{ marginTop: '0.35rem', fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}
                            onClick={() => handleAddOption(qIdx)}
                          >
                            + Add Option
                          </button>
                        </div>
                      )}

                      {q.questionType === 'True/False' && (
                        <div style={{ display: 'flex', gap: '1.5rem', background: '#f1f5f9', padding: '0.5rem 0.75rem', borderRadius: '6px', marginBottom: '0.5rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Correct Answer:</span>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name={`tf_${qIdx}`}
                              checked={q.correctAnswer === 'True'}
                              onChange={() => handleUpdateQuestion(qIdx, 'correctAnswer', 'True')}
                            />
                            True
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name={`tf_${qIdx}`}
                              checked={q.correctAnswer === 'False'}
                              onChange={() => handleUpdateQuestion(qIdx, 'correctAnswer', 'False')}
                            />
                            False
                          </label>
                        </div>
                      )}

                      {(q.questionType === 'Short Answer' || q.questionType === 'Task/Practical') && (
                        <div style={{ marginBottom: '0.5rem' }}>
                          <label style={{ fontSize: '0.73rem', color: '#475569', fontWeight: 600 }}>
                            {q.questionType === 'Short Answer' ? 'Sample Correct Answer / Keywords:' : 'Evaluation Criteria / Expected Output:'}
                          </label>
                          <input
                            type="text"
                            placeholder="Enter model answer or grading rubric..."
                            value={q.correctAnswer || ''}
                            onChange={e => handleUpdateQuestion(qIdx, 'correctAnswer', e.target.value)}
                          />
                        </div>
                      )}

                      <div>
                        <input
                          type="text"
                          placeholder="Explanation / Grading notes (optional)..."
                          style={{ fontSize: '0.75rem', height: '26px' }}
                          value={q.explanation || ''}
                          onChange={e => handleUpdateQuestion(qIdx, 'explanation', e.target.value)}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="hrtm-modal-footer">
              <button
                type="button"
                className="hrtm-btn hrtm-btn-secondary"
                onClick={() => setShowAssessmentModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="hrtm-btn hrtm-btn-primary"
                disabled={savingAssessment}
              >
                {savingAssessment ? 'Saving to Atlas...' : (editingAssessment ? 'Update Assessment' : 'Create Assessment')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderViewAssessmentModal = () => {
    if (!viewingAssessment) return null;
    const asmt = viewingAssessment;
    const qCount = asmt.questions?.length || 0;
    const totalMarks = asmt.totalMarks || asmt.maxScore || 100;
    const passMarks = asmt.passingMarks || asmt.passingScore || 60;
    const assignedList = asmt.assignedEmployees || [];
    const submissionsList = asmt.submissions || [];

    return (
      <div className="hrtm-modal-overlay">
        <div className="hrtm-modal hrtm-modal-lg">
          <div className="hrtm-modal-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2px' }}>
                <span className="hrtm-code-badge">{asmt.assessmentType || 'Quiz'}</span>
                <span className={`hrtm-badge hrtm-badge-${(asmt.status || 'Draft').toLowerCase()}`}>
                  <span className="hrtm-badge-dot" />{asmt.status || 'Draft'}
                </span>
              </div>
              <h3 style={{ margin: 0 }}>{asmt.title || asmt.name}</h3>
            </div>
            <button type="button" className="hrtm-modal-close" onClick={() => setViewingAssessment(null)}>✕</button>
          </div>

          <div className="hrtm-modal-body">
            {/* Meta Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Course</span>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{asmt.course?.title || '—'}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Program</span>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{asmt.program?.name || 'General'}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Duration</span>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{asmt.duration ? `${asmt.duration} mins` : 'Flexible'}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Total / Passing</span>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{totalMarks} / Pass: {passMarks}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Enrolled</span>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2563eb' }}>{assignedList.length} Assigned · {submissionsList.length} Done</div>
              </div>
            </div>

            {asmt.description && (
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ fontSize: '0.8rem', color: '#334155' }}>Description:</strong>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#475569' }}>{asmt.description}</p>
              </div>
            )}
            {asmt.instructions && (
              <div style={{ marginBottom: '1rem', background: '#eff6ff', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                <strong style={{ fontSize: '0.8rem', color: '#1e40af' }}>Candidate Instructions:</strong>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#1e3a8a' }}>{asmt.instructions}</p>
              </div>
            )}

            {/* Questions List */}
            <div style={{ marginTop: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                Questions ({qCount})
              </h4>
              {qCount === 0 ? (
                <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', color: '#64748b', fontSize: '0.8rem' }}>
                  No questions defined yet.
                </div>
              ) : (
                asmt.questions.map((q, idx) => (
                  <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1e293b' }}>
                        Q{idx + 1}. ({q.marks || 10} marks)
                      </span>
                      <span className="hrtm-code-badge" style={{ fontSize: '0.7rem' }}>{q.questionType}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#334155', marginBottom: '0.4rem' }}>{q.questionText}</div>
                    {q.questionType === 'Multiple Choice' && Array.isArray(q.options) && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.35rem' }}>
                        {q.options.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.78rem',
                              border: opt === q.correctAnswer ? '1px solid #86efac' : '1px solid #e2e8f0',
                              background: opt === q.correctAnswer ? '#f0fdf4' : '#ffffff',
                              color: opt === q.correctAnswer ? '#15803d' : '#475569',
                              fontWeight: opt === q.correctAnswer ? 600 : 400
                            }}
                          >
                            {opt === q.correctAnswer ? '✓ ' : ''}{opt}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.correctAnswer && q.questionType !== 'Multiple Choice' && (
                      <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: '0.35rem' }}>
                        <strong>Correct:</strong> {q.correctAnswer}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Assigned Employees */}
            {assignedList.length > 0 && (
              <div style={{ marginTop: '1.25rem' }}>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                  Assigned Candidates ({assignedList.length})
                </h4>
                <div className="hrtm-table-wrap" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <table className="hrtm-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Department</th>
                        <th>Assigned Date</th>
                        <th>Due Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignedList.map((a, idx) => (
                        <tr key={idx}>
                          <td><strong>{getEmpName(a.employee)}</strong></td>
                          <td>{a.employee?.department || '—'}</td>
                          <td>{formatDate(a.assignedDate)}</td>
                          <td>{formatDate(a.dueDate)}</td>
                          <td>
                            <span className={`hrtm-badge hrtm-badge-${(a.status || 'Assigned').toLowerCase()}`}>
                              {a.status || 'Assigned'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="hrtm-modal-footer">
            <button
              type="button"
              className="hrtm-btn hrtm-btn-secondary"
              onClick={() => {
                setViewingAssessment(null);
                openEditAssessmentModal(asmt);
              }}
            >
              ✏️ Edit Assessment
            </button>
            <button
              type="button"
              className="hrtm-btn hrtm-btn-primary"
              onClick={() => {
                setViewingAssessment(null);
                openAssignModal(asmt);
              }}
            >
              👥 Assign to Employees
            </button>
            <button
              type="button"
              className="hrtm-btn hrtm-btn-secondary"
              onClick={() => setViewingAssessment(null)}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderAssignAssessmentModal = () => {
    if (!assigningAssessment) return null;
    const asmt = assigningAssessment;

    return (
      <div className="hrtm-modal-overlay">
        <div className="hrtm-modal hrtm-modal-md">
          <div className="hrtm-modal-header">
            <h3>Assign Assessment — {asmt.title || asmt.name}</h3>
            <button type="button" className="hrtm-modal-close" onClick={() => setAssigningAssessment(null)}>✕</button>
          </div>
          <form onSubmit={handleSaveAssignment}>
            <div className="hrtm-modal-body">
              <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1rem', fontSize: '0.8rem' }}>
                <div>Course: <strong>{asmt.course?.title || '—'}</strong></div>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Duration: {asmt.duration || 30} mins · Total Marks: {asmt.totalMarks || 100}</div>
              </div>

              {/* Assignment Target Type */}
              <div className="hrtm-form-group">
                <label>Assignment Target *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginTop: '0.25rem' }}>
                  {[
                    { id: 'individual', label: '👤 Individual Employee' },
                    { id: 'multiple', label: '👥 Multiple Employees' },
                    { id: 'department', label: '🏢 Entire Department' },
                    { id: 'course', label: '🎓 Course Participants' }
                  ].map(tgt => (
                    <label
                      key={tgt.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        border: assignForm.targetType === tgt.id ? '1px solid #2563eb' : '1px solid #e2e8f0',
                        background: assignForm.targetType === tgt.id ? '#eff6ff' : '#ffffff',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        fontWeight: assignForm.targetType === tgt.id ? 600 : 400
                      }}
                    >
                      <input
                        type="radio"
                        name="assignTarget"
                        checked={assignForm.targetType === tgt.id}
                        onChange={() => setAssignForm({ ...assignForm, targetType: tgt.id })}
                      />
                      {tgt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Target: Individual */}
              {assignForm.targetType === 'individual' && (
                <div className="hrtm-form-group">
                  <label>Select Employee *</label>
                  <CustomSelect
                    options={employees.map(e => ({ value: e._id, label: getEmpName(e), subtitle: e.department || e.email }))}
                    value={assignForm.employeeId}
                    onChange={v => setAssignForm({ ...assignForm, employeeId: v })}
                    placeholder="-- Choose Employee --"
                  />
                </div>
              )}

              {/* Target: Multiple */}
              {assignForm.targetType === 'multiple' && (
                <div className="hrtm-form-group">
                  <label>Select Multiple Employees * ({assignForm.selectedEmployeeIds?.length || 0} selected)</label>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.5rem', background: '#f8fafc' }}>
                    {employees.map(e => {
                      const isSelected = assignForm.selectedEmployeeIds?.includes(e._id);
                      return (
                        <label key={e._id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              const curr = assignForm.selectedEmployeeIds || [];
                              const updated = isSelected ? curr.filter(id => id !== e._id) : [...curr, e._id];
                              setAssignForm({ ...assignForm, selectedEmployeeIds: updated });
                            }}
                          />
                          <span>{getEmpName(e)} <small style={{ color: '#64748b' }}>({e.department || 'General'})</small></span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Target: Department */}
              {assignForm.targetType === 'department' && (
                <div className="hrtm-form-group">
                  <label>Select Department *</label>
                  <CustomSelect
                    options={departments.map(d => ({ value: d._id, label: d.name }))}
                    value={assignForm.departmentId}
                    onChange={v => setAssignForm({ ...assignForm, departmentId: v })}
                    placeholder="-- Select Department --"
                  />
                  <small style={{ color: '#64748b', display: 'block', marginTop: '4px' }}>
                    All active employees belonging to the selected department will be assigned.
                  </small>
                </div>
              )}

              {/* Target: Course Participants */}
              {assignForm.targetType === 'course' && (
                <div style={{ padding: '0.75rem', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '0.8rem', color: '#1e3a8a', marginBottom: '1rem' }}>
                  ℹ️ All employees currently enrolled or assigned to <strong>{asmt.course?.title || 'this course'}</strong> will automatically receive this assessment.
                </div>
              )}

              {/* Due Date & Notes */}
              <div className="hrtm-form-row">
                <div className="hrtm-form-group">
                  <label>Due Date / Deadline</label>
                  <input
                    type="date"
                    value={assignForm.dueDate}
                    onChange={e => setAssignForm({ ...assignForm, dueDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="hrtm-form-group">
                <label>Instructions / Notes for Candidates</label>
                <textarea
                  rows="2"
                  value={assignForm.notes}
                  onChange={e => setAssignForm({ ...assignForm, notes: e.target.value })}
                  placeholder="Optional assignment instructions, expectations, or guidance..."
                />
              </div>
            </div>

            <div className="hrtm-modal-footer">
              <button
                type="button"
                className="hrtm-btn hrtm-btn-secondary"
                onClick={() => setAssigningAssessment(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="hrtm-btn hrtm-btn-primary"
                disabled={savingAssignment}
              >
                {savingAssignment ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderEvaluateModal = () => {
    if (!evaluatingSubmission) return null;
    const sub = evaluatingSubmission;
    const total = evaluateForm.totalMarks || 100;
    const passMark = evaluateForm.passingMarks || 60;
    const marks = Number(evaluateForm.marksObtained) || 0;
    const computedPct = total > 0 ? Math.round((marks / total) * 100) : 0;

    return (
      <div className="hrtm-modal-overlay">
        <div className="hrtm-modal hrtm-modal-md">
          <div className="hrtm-modal-header">
            <div>
              <span className="hrtm-code-badge" style={{ marginBottom: '2px' }}>Evaluation & Grading</span>
              <h3 style={{ margin: 0 }}>Evaluate — {getEmpName(sub.employee)}</h3>
            </div>
            <button type="button" className="hrtm-modal-close" onClick={() => setEvaluatingSubmission(null)}>✕</button>
          </div>

          <form onSubmit={handleSaveEvaluation}>
            <div className="hrtm-modal-body">
              <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1rem', fontSize: '0.8rem' }}>
                <div>Assessment: <strong>{sub.assessmentName || 'Assessment'}</strong></div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>
                  Course: {sub.course?.title || '—'} · Candidate: {getEmpName(sub.employee)} ({sub.employee?.department || 'General'})
                </div>
              </div>

              {/* Score & Marks Entry */}
              <div className="hrtm-form-row">
                <div className="hrtm-form-group">
                  <label>Marks Obtained *</label>
                  <input
                    type="number"
                    min="0"
                    max={total}
                    required
                    value={evaluateForm.marksObtained}
                    onChange={e => {
                      const val = Number(e.target.value);
                      const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                      const pf = val >= passMark ? 'Pass' : 'Fail';
                      const gr = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : 'F';
                      setEvaluateForm({
                        ...evaluateForm,
                        marksObtained: val,
                        percentage: pct,
                        passFail: pf,
                        grade: gr
                      });
                    }}
                  />
                </div>
                <div className="hrtm-form-group">
                  <label>Total Possible Marks</label>
                  <input type="number" readOnly value={total} style={{ background: '#f1f5f9', cursor: 'not-allowed' }} />
                </div>
                <div className="hrtm-form-group">
                  <label>Percentage (%)</label>
                  <input type="number" readOnly value={computedPct} style={{ background: '#f1f5f9', cursor: 'not-allowed', fontWeight: 700 }} />
                </div>
              </div>

              <div className="hrtm-form-row">
                <div className="hrtm-form-group">
                  <label>Pass / Fail Status *</label>
                  <CustomSelect
                    options={['Pass', 'Fail']}
                    value={evaluateForm.passFail}
                    onChange={v => setEvaluateForm({ ...evaluateForm, passFail: v })}
                  />
                </div>
                <div className="hrtm-form-group">
                  <label>Grade</label>
                  <CustomSelect
                    options={['A+', 'A', 'B', 'C', 'F']}
                    value={evaluateForm.grade}
                    onChange={v => setEvaluateForm({ ...evaluateForm, grade: v })}
                  />
                </div>
                <div className="hrtm-form-group">
                  <label>Evaluation Status *</label>
                  <CustomSelect
                    options={['Evaluated', 'Needs Review', 'Pending']}
                    value={evaluateForm.evaluationStatus}
                    onChange={v => setEvaluateForm({ ...evaluateForm, evaluationStatus: v })}
                  />
                </div>
              </div>

              <div className="hrtm-form-group">
                <label>Evaluator Remarks & Feedback</label>
                <textarea
                  rows="3"
                  value={evaluateForm.remarks}
                  onChange={e => setEvaluateForm({ ...evaluateForm, remarks: e.target.value })}
                  placeholder="Enter detailed feedback, strong areas, and improvement recommendations..."
                />
              </div>
            </div>

            <div className="hrtm-modal-footer">
              <button
                type="button"
                className="hrtm-btn hrtm-btn-secondary"
                onClick={() => setEvaluatingSubmission(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="hrtm-btn hrtm-btn-primary"
                disabled={savingEvaluation}
              >
                {savingEvaluation ? 'Saving Evaluation...' : 'Save Evaluation'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderEditCertModal = () => {
    if (!showEditCertModal || !editingCert) return null;

    return (
      <div className="hrtm-modal-overlay">
        <div className="hrtm-modal hrtm-modal-md">
          <div className="hrtm-modal-header">
            <div>
              <span className="hrtm-code-badge" style={{ marginBottom: '2px' }}>Edit Certification</span>
              <h3 style={{ margin: 0 }}>Certificate #{editingCert.certificateNumber}</h3>
            </div>
            <button type="button" className="hrtm-modal-close" onClick={() => setShowEditCertModal(false)}>✕</button>
          </div>

          <form onSubmit={handleSaveCert}>
            <div className="hrtm-modal-body">
              <div className="hrtm-form-row">
                <div className="hrtm-form-group">
                  <label>Certificate Number *</label>
                  <input
                    type="text"
                    required
                    value={editCertForm.certificateNumber}
                    onChange={e => setEditCertForm({ ...editCertForm, certificateNumber: e.target.value })}
                  />
                </div>
                <div className="hrtm-form-group">
                  <label>Status *</label>
                  <CustomSelect
                    options={['Active', 'Revoked', 'Expired']}
                    value={editCertForm.status}
                    onChange={v => setEditCertForm({ ...editCertForm, status: v })}
                  />
                </div>
              </div>

              <div className="hrtm-form-row">
                <div className="hrtm-form-group">
                  <label>Employee *</label>
                  <CustomSelect
                    options={employees.map(e => ({ value: e._id, label: getEmpName(e), subtitle: e.department || e.email }))}
                    value={editCertForm.employee}
                    onChange={v => setEditCertForm({ ...editCertForm, employee: v })}
                    placeholder="-- Select Employee --"
                  />
                </div>
                <div className="hrtm-form-group">
                  <label>Certificate Type *</label>
                  <CustomSelect
                    options={['Completion', 'Excellence', 'Participation', 'Achievement']}
                    value={editCertForm.certificateType}
                    onChange={v => setEditCertForm({ ...editCertForm, certificateType: v })}
                  />
                </div>
              </div>

              <div className="hrtm-form-row">
                <div className="hrtm-form-group">
                  <label>Training Program</label>
                  <CustomSelect
                    options={[{ value: '', label: 'None (General)' }, ...programs.map(p => ({ value: p._id, label: p.name }))]}
                    value={editCertForm.program}
                    onChange={v => setEditCertForm({ ...editCertForm, program: v })}
                  />
                </div>
                <div className="hrtm-form-group">
                  <label>Training Course *</label>
                  <CustomSelect
                    options={courses.map(c => ({ value: c._id, label: c.title }))}
                    value={editCertForm.course}
                    onChange={v => setEditCertForm({ ...editCertForm, course: v })}
                    placeholder="-- Select Course --"
                  />
                </div>
              </div>

              <div className="hrtm-form-row">
                <div className="hrtm-form-group">
                  <label>Final Assessment Score (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editCertForm.finalScore}
                    onChange={e => setEditCertForm({ ...editCertForm, finalScore: e.target.value })}
                    placeholder="e.g. 85"
                  />
                </div>
                <div className="hrtm-form-group">
                  <label>Issue Date *</label>
                  <input
                    type="date"
                    required
                    value={editCertForm.issueDate}
                    onChange={e => setEditCertForm({ ...editCertForm, issueDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="hrtm-form-row">
                <div className="hrtm-form-group">
                  <label>Completion Date</label>
                  <input
                    type="date"
                    value={editCertForm.completionDate}
                    onChange={e => setEditCertForm({ ...editCertForm, completionDate: e.target.value })}
                  />
                </div>
                <div className="hrtm-form-group">
                  <label>Expiry Date (Optional)</label>
                  <input
                    type="date"
                    value={editCertForm.expiryDate}
                    onChange={e => setEditCertForm({ ...editCertForm, expiryDate: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="hrtm-modal-footer">
              <button
                type="button"
                className="hrtm-btn hrtm-btn-secondary"
                onClick={() => setShowEditCertModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="hrtm-btn hrtm-btn-primary"
                disabled={savingCert}
              >
                {savingCert ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
          </form>
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
            <p>Comprehensive corporate learning, attendance, skill tracking, and performance analytics.</p>
          </div>
        </div>

        {/* 2. 6 KPI Cards (3 × 2 Grid Layout) + Dynamic Skill Performance Card */}
        <div className="hrtm-kpi-hero-wrapper">
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
          </div>

          {/* Skill Performance Graph (100% Dynamic MongoDB Atlas Data) */}
          <div className="hrtm-skill-performance-card">
            <div className="hrtm-skill-perf-header">
              <div className="hrtm-skill-perf-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '15px', height: '15px', color: '#ea580c' }}>
                  <path d="M12 20V10" />
                  <path d="M18 20V4" />
                  <path d="M6 20v-4" />
                </svg>
                <span>Skill Performance</span>
              </div>
              <button
                type="button"
                className="hrtm-skill-refresh-btn"
                onClick={loadSkillPerformance}
                title="Refresh skill performance from Atlas"
                disabled={loadingSkillPerf}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '13px', height: '13px', animation: loadingSkillPerf ? 'spin 1s linear infinite' : 'none' }}>
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </button>
            </div>

            <div className="hrtm-skill-perf-body">
              {loadingSkillPerf ? (
                <div className="hrtm-skill-loading">
                  <div className="hrtm-skill-skeleton" />
                  <div className="hrtm-skill-skeleton" />
                  <div className="hrtm-skill-skeleton" />
                </div>
              ) : skillPerfError ? (
                <div className="hrtm-skill-error">
                  <span>{skillPerfError}</span>
                  <button type="button" onClick={loadSkillPerformance}>Retry</button>
                </div>
              ) : skillPerformance.length === 0 ? (
                <div className="hrtm-skill-empty">
                  <span className="hrtm-skill-empty-title">No skill performance data available</span>
                  <span className="hrtm-skill-empty-sub">Performance data will appear once training assessments are recorded.</span>
                </div>
              ) : (
                <div className="hrtm-skill-chart-list">
                  {skillPerformance.map((item) => (
                    <div key={item.skill} className="hrtm-skill-bar-row">
                      <div className="hrtm-skill-bar-info">
                        <span className="hrtm-skill-label" title={`${item.skill} (${item.totalAssessments || 1} assessment${item.totalAssessments === 1 ? '' : 's'})`}>
                          {item.skill}
                        </span>
                        <span className="hrtm-skill-val">{item.performance}%</span>
                      </div>
                      <div className="hrtm-skill-bar-track">
                        <div
                          className="hrtm-skill-bar-fill"
                          style={{
                            width: `${Math.min(100, Math.max(0, item.performance))}%`,
                            background: item.performance >= 75
                              ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                              : item.performance >= 50
                                ? 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)'
                                : 'linear-gradient(90deg, #f59e0b 0%, #ea580c 100%)'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
            <button className="hrtm-btn hrtm-btn-primary" onClick={() => openCreateModal('program')}>
              + Add Training
            </button>
          </div>
        </div>

        {/* 4. Training Module Navigation */}
        <div className="hrtm-tabs-container" role="tablist" aria-label="Training Management Navigation">
          <div className="hrtm-tab-row" role="row">
            {TABS.map(tab => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                title={tab.label}
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
            {activeTab === 'assignments' && renderAssignments()}
            {activeTab === 'attendance' && renderAttendance()}
            {activeTab === 'progress' && renderProgress()}
            {activeTab === 'assessments' && renderAssessments()}
            {activeTab === 'certifications' && renderCertifications()}
            {activeTab === 'feedback' && renderFeedback()}
            {activeTab === 'completion' && renderCompletion()}
          </>
        )}

        {/* Dynamic Form & Action Modals */}
        {renderModalForm()}
        {renderGenerateCertModal()}
        {renderPreviewCertModal()}
        {renderManageProgramModal()}
        {renderManageCourseModal()}
        {renderAssessmentFormModal()}
        {renderViewAssessmentModal()}
        {renderAssignAssessmentModal()}
        {renderEvaluateModal()}
        {renderEditCertModal()}
        {renderAssignmentDetailModal()}
      </div>
    </UserLayout>
  );
}
