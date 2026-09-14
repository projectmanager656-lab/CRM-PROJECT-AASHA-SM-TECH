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
  const [costs, setCosts] = useState([]);
  const [costReports, setCostReports] = useState({});

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
  const [showModal, setShowModal] = useState(null); // 'program' | 'course' | 'trainer' | 'session' | 'assignment' | 'attendance' | 'assessment' | 'certification' | 'feedback' | 'cost'
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

  const showToastMsg = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 3500);
  };

  // Modal Body Refs for scroll reset on tab change
  const programModalBodyRef = useRef(null);
  const courseModalBodyRef = useRef(null);

  // Lock background window scroll whenever any modal is opened, with scrollbar compensation to eliminate layout shift
  useEffect(() => {
    const isAnyModalOpen = Boolean(showModal || showGenCertModal || previewCert || managingProgram || managingCourse);
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
  }, [showModal, showGenCertModal, previewCert, managingProgram, managingCourse]);

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

  const loadTabData = (tab) => {
    setLoading(true);
    if (tab === 'overview') loadSkillPerformance();
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
    } else if (type === 'cost') {
      if (programs.length === 0) apiClient.get('/training/programs').then(res => setPrograms(res.data?.data || [])).catch(() => { });
      if (courses.length === 0) apiClient.get('/training/courses').then(res => setCourses(res.data?.data || [])).catch(() => { });
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
    } else if (type === 'cost') {
      if (programs.length === 0) apiClient.get('/training/programs').then(res => setPrograms(res.data?.data || [])).catch(() => { });
      if (courses.length === 0) apiClient.get('/training/courses').then(res => setCourses(res.data?.data || [])).catch(() => { });
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
              <h2 className="hrtm-section-heading">Upcoming Sessions</h2>
              <button className="hrtm-btn hrtm-btn-secondary hrtm-btn-sm" onClick={() => setActiveTab('sessions')}>View All</button>
            </div>
            <div className="hrtm-table-wrap">
              <table className="hrtm-table">
                <thead>
                  <tr>
                    <th style={{ width: '25%', minWidth: '170px' }}>Session & Date</th>
                    <th style={{ width: '25%', minWidth: '170px' }}>Program / Course</th>
                    <th style={{ width: '20%', minWidth: '130px' }}>Trainer</th>
                    <th style={{ width: '10%', minWidth: '80px' }}>Enrolled</th>
                    <th style={{ width: '10%', minWidth: '95px' }}>Status</th>
                    <th style={{ width: '10%', minWidth: '100px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingSessionsList.length === 0 ? (
                    <tr><td colSpan="6" className="hrtm-empty">No upcoming training sessions</td></tr>
                  ) : (
                    upcomingSessionsList.map(s => (
                      <tr key={s._id}>
                        <td>
                          <span className="hrtm-primary-title">{s.sessionTitle}</span>
                          <span className="hrtm-cell-subtext">{formatDate(s.sessionDate)} ({s.startTime || 'TBD'})</span>
                        </td>
                        <td>{s.program?.name} / {s.course?.title}</td>
                        <td>{s.trainer ? (s.trainer.trainerType === 'Internal' ? getEmpName(s.trainer.employee) : s.trainer.name) : '—'}</td>
                        <td><strong>{s.enrolledCount || 0}</strong></td>
                        <td><span className={`hrtm-badge hrtm-badge-${(s.status || '').toLowerCase()}`}><span className="hrtm-badge-dot" />{s.status}</span></td>
                        <td>
                          <div className="hrtm-action-group" style={{ justifyContent: 'center' }}>
                            <button type="button" className="hrtm-action-btn hrtm-action-btn-edit" title="Edit" onClick={() => openEditModal('session', s)}>✏️</button>
                            <button type="button" className="hrtm-action-btn hrtm-action-btn-delete" title="Cancel" onClick={() => handleDelete('session', s._id)}>🗑️</button>
                          </div>
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
        </div>

        {/* Row 2: Recent Training Activity | Top Performing Programs */}
        <div className="hrtm-overview-grid">
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

          {/* Top Performing Programs */}
          <div className="hrtm-card">
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

  const renderSessions = () => {
    const list = sessions.filter(s => s.sessionTitle?.toLowerCase().includes(search.toLowerCase()));
    return (
      <div className="hrtm-card">
        <div className="hrtm-card-header">
          <div>
            <h2 className="hrtm-section-heading">Training Sessions & Schedule</h2>
            <span className="hrtm-section-subtext">{list.length} session{list.length === 1 ? '' : 's'} scheduled</span>
          </div>
          <button className="hrtm-btn hrtm-btn-primary hrtm-btn-sm" onClick={() => openCreateModal('session')}>+ Schedule Session</button>
        </div>
        <div className="hrtm-table-wrap">
          <table className="hrtm-table">
            <thead>
              <tr>
                <th style={{ width: '22%', minWidth: '200px' }}>Session Title</th>
                <th style={{ width: '22%', minWidth: '200px' }}>Program / Course</th>
                <th style={{ width: '14%', minWidth: '135px' }}>Trainer</th>
                <th style={{ width: '18%', minWidth: '165px' }}>Date & Time</th>
                <th style={{ width: '11%', minWidth: '120px' }}>Location</th>
                <th style={{ width: '7%', minWidth: '95px' }}>Status</th>
                <th style={{ width: '6%', minWidth: '130px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan="7" className="hrtm-empty">No sessions scheduled</td></tr>
              ) : list.map(s => (
                <tr key={s._id}>
                  <td>
                    <span className="hrtm-primary-title">{s.sessionTitle}</span>
                  </td>
                  <td>
                    <div className="hrtm-primary-cell">
                      <span className="hrtm-primary-title" style={{ fontWeight: 500 }}>{s.program?.name || '—'}</span>
                      {s.course?.title && <span className="hrtm-cell-subtext">Course: {s.course.title}</span>}
                    </div>
                  </td>
                  <td>{s.trainer ? (s.trainer.trainerType === 'Internal' ? getEmpName(s.trainer.employee) : s.trainer.name) : '—'}</td>
                  <td>
                    <div style={{ whiteSpace: 'nowrap' }}>{formatDate(s.sessionDate)}</div>
                    <span className="hrtm-cell-subtext">{s.startTime || 'TBD'} - {s.endTime || 'TBD'}</span>
                  </td>
                  <td>{s.location || '—'}</td>
                  <td><span className={`hrtm-badge hrtm-badge-${(s.status || '').toLowerCase()}`}><span className="hrtm-badge-dot" />{s.status}</span></td>
                  <td>
                    <div className="hrtm-action-group" style={{ justifyContent: 'center' }}>
                      <button type="button" className="hrtm-action-btn hrtm-action-btn-edit" onClick={() => openEditModal('session', s)} title="Edit Session">✏️ Edit</button>
                      <button type="button" className="hrtm-action-btn hrtm-action-btn-delete" onClick={() => handleDelete('session', s._id)} title="Delete Session">🗑️ Delete</button>
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

  const renderAssignments = () => {
    const list = assignments.filter(a => getEmpName(a.employee)?.toLowerCase().includes(search.toLowerCase()));
    return (
      <div className="hrtm-card">
        <div className="hrtm-card-header">
          <div>
            <h2 className="hrtm-section-heading">Employee Assignments</h2>
            <span className="hrtm-section-subtext">{list.length} assignment{list.length === 1 ? '' : 's'} active</span>
          </div>
          <button className="hrtm-btn hrtm-btn-primary hrtm-btn-sm" onClick={() => openCreateModal('assignment')}>+ Assign Employee(s)</button>
        </div>
        <div className="hrtm-table-wrap">
          <table className="hrtm-table">
            <thead>
              <tr>
                <th style={{ width: '20%', minWidth: '170px' }}>Employee</th>
                <th style={{ width: '22%', minWidth: '180px' }}>Program</th>
                <th style={{ width: '22%', minWidth: '180px' }}>Course</th>
                <th style={{ width: '9%', minWidth: '90px' }}>Mandatory</th>
                <th style={{ width: '11%', minWidth: '110px' }}>Due Date</th>
                <th style={{ width: '8%', minWidth: '95px' }}>Status</th>
                <th style={{ width: '8%', minWidth: '130px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan="7" className="hrtm-empty">No employee assignments found</td></tr>
              ) : list.map(a => (
                <tr key={a._id}>
                  <td>
                    <span className="hrtm-primary-title">{getEmpName(a.employee)}</span>
                  </td>
                  <td>{a.program?.name || '—'}</td>
                  <td>{a.course?.title || '—'}</td>
                  <td>
                    <span className={`hrtm-badge ${a.isMandatory ? 'hrtm-badge-internal' : ''}`} style={!a.isMandatory ? { background: '#f1f5f9', color: '#64748b' } : {}}>
                      {a.isMandatory ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>{formatDate(a.dueDate)}</td>
                  <td><span className={`hrtm-badge hrtm-badge-${(a.status || '').toLowerCase().replace(' ', '-')}`}><span className="hrtm-badge-dot" />{a.status}</span></td>
                  <td>
                    <div className="hrtm-action-group" style={{ justifyContent: 'center' }}>
                      <button type="button" className="hrtm-action-btn hrtm-action-btn-edit" onClick={() => openEditModal('assignment', a)} title="Edit Assignment">✏️ Edit</button>
                      <button type="button" className="hrtm-action-btn hrtm-action-btn-delete" onClick={() => handleDelete('assignment', a._id)} title="Delete Assignment">🗑️ Delete</button>
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

  const renderAssessments = () => (
    <div className="hrtm-card">
      <div className="hrtm-card-header">
        <div>
          <h2 className="hrtm-section-heading">Training Assessments</h2>
          <span className="hrtm-section-subtext">{assessments.length} assessment record{assessments.length === 1 ? '' : 's'}</span>
        </div>
        <button className="hrtm-btn hrtm-btn-primary hrtm-btn-sm" onClick={() => openCreateModal('assessment')}>+ Record Assessment</button>
      </div>
      <div className="hrtm-table-wrap">
        <table className="hrtm-table">
          <thead>
            <tr>
              <th style={{ width: '22%', minWidth: '180px' }}>Employee</th>
              <th style={{ width: '25%', minWidth: '200px' }}>Course</th>
              <th style={{ width: '12%', minWidth: '100px' }}>Score</th>
              <th style={{ width: '12%', minWidth: '100px' }}>Passing Score</th>
              <th style={{ width: '10%', minWidth: '95px' }}>Result</th>
              <th style={{ width: '13%', minWidth: '120px' }}>Assessment Date</th>
              <th style={{ width: '6%', minWidth: '80px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {assessments.length === 0 ? (
              <tr><td colSpan="7" className="hrtm-empty">No assessment records found</td></tr>
            ) : assessments.map(ass => (
              <tr key={ass._id}>
                <td><span className="hrtm-primary-title">{getEmpName(ass.employee)}</span></td>
                <td>{ass.course?.title || '—'}</td>
                <td><strong>{ass.score}</strong> / {ass.maxScore}</td>
                <td>{ass.passingScore}</td>
                <td><span className={`hrtm-badge hrtm-badge-${(ass.result || '').toLowerCase()}`}><span className="hrtm-badge-dot" />{ass.result}</span></td>
                <td>{formatDate(ass.assessmentDate)}</td>
                <td>
                  <div className="hrtm-action-group" style={{ justifyContent: 'center' }}>
                    <button type="button" className="hrtm-action-btn hrtm-action-btn-delete" onClick={() => handleDelete('assessment', ass._id)} title="Delete Assessment">🗑️</button>
                  </div>
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
              <th style={{ width: '14%', minWidth: '120px' }}>Certificate #</th>
              <th style={{ width: '18%', minWidth: '160px' }}>Employee</th>
              <th style={{ width: '16%', minWidth: '150px' }}>Program</th>
              <th style={{ width: '16%', minWidth: '150px' }}>Course</th>
              <th style={{ width: '11%', minWidth: '110px' }}>Completion Date</th>
              <th style={{ width: '10%', minWidth: '105px' }}>Issue Date</th>
              <th style={{ width: '8%', minWidth: '95px' }}>Status</th>
              <th style={{ width: '7%', minWidth: '150px', textAlign: 'center' }}>Actions</th>
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
                  <div className="hrtm-action-group" style={{ justifyContent: 'center' }}>
                    <button type="button" className="hrtm-action-btn hrtm-action-btn-view" title="View / Preview Certificate" onClick={() => setPreviewCert(cert)}>👁️</button>
                    <button
                      type="button"
                      className="hrtm-action-btn hrtm-action-btn-view"
                      title="Download PDF"
                      onClick={() => handleDownloadPdf(cert)}
                      disabled={downloadingCertId === cert._id}
                    >
                      {downloadingCertId === cert._id ? '⏳' : '📥'}
                    </button>
                    {cert.status !== 'Revoked' && (
                      <button type="button" className="hrtm-action-btn hrtm-action-btn-edit" title="Revoke Certificate" onClick={() => handleRevokeCert(cert._id)}>🚫</button>
                    )}
                    <button type="button" className="hrtm-action-btn hrtm-action-btn-delete" title="Delete" onClick={() => handleDelete('certification', cert._id)}>🗑️</button>
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

  const renderCosts = () => (
    <div className="hrtm-card">
      <div className="hrtm-card-header">
        <div>
          <h2 className="hrtm-section-heading">Cost & Expense Management</h2>
          <span className="hrtm-section-subtext">{costs.length} expense item{costs.length === 1 ? '' : 's'}</span>
        </div>
        <button className="hrtm-btn hrtm-btn-primary hrtm-btn-sm" onClick={() => openCreateModal('cost')}>+ Record Cost</button>
      </div>
      <div className="hrtm-table-wrap">
        <table className="hrtm-table">
          <thead>
            <tr>
              <th style={{ width: '24%', minWidth: '200px' }}>Expense Title</th>
              <th style={{ width: '22%', minWidth: '190px' }}>Program / Course</th>
              <th style={{ width: '24%', minWidth: '200px' }}>Breakdown</th>
              <th style={{ width: '12%', minWidth: '100px' }}>Total Cost</th>
              <th style={{ width: '11%', minWidth: '105px' }}>Date Incurred</th>
              <th style={{ width: '7%', minWidth: '130px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {costs.length === 0 ? (
              <tr><td colSpan="6" className="hrtm-empty">No training costs recorded</td></tr>
            ) : costs.map(c => (
              <tr key={c._id}>
                <td><span className="hrtm-primary-title">{c.title}</span></td>
                <td>{c.program?.name || c.course?.title || 'General'}</td>
                <td><span className="hrtm-cell-subtext">Fee: ₹{c.courseFee || 0} | Trainer: ₹{c.trainerFee || 0} | Venue: ₹{c.venueCost || 0}</span></td>
                <td><strong>₹{(c.totalCost || 0).toLocaleString()}</strong></td>
                <td>{formatDate(c.dateIncurred)}</td>
                <td>
                  <div className="hrtm-action-group" style={{ justifyContent: 'center' }}>
                    <button type="button" className="hrtm-action-btn hrtm-action-btn-edit" onClick={() => openEditModal('cost', c)} title="Edit Cost">✏️ Edit</button>
                    <button type="button" className="hrtm-action-btn hrtm-action-btn-delete" onClick={() => handleDelete('cost', c._id)} title="Delete Cost">🗑️ Delete</button>
                  </div>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <div className="hrtm-card">
            <div className="hrtm-card-header">
              <h2 className="hrtm-section-heading">Cost by Program</h2>
            </div>
            <div className="hrtm-table-wrap">
              <table className="hrtm-table">
                <thead>
                  <tr>
                    <th style={{ width: '65%', minWidth: '200px' }}>Program</th>
                    <th style={{ width: '35%', minWidth: '120px' }}>Expenses</th>
                  </tr>
                </thead>
                <tbody>
                  {(costReports.byProgram || []).map(p => (
                    <tr key={p._id}>
                      <td><span className="hrtm-primary-title">{p.programName || 'Unlinked'}</span></td>
                      <td><strong>₹{(p.totalCost || 0).toLocaleString()}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="hrtm-card">
            <div className="hrtm-card-header">
              <h2 className="hrtm-section-heading">Cost by Course</h2>
            </div>
            <div className="hrtm-table-wrap">
              <table className="hrtm-table">
                <thead>
                  <tr>
                    <th style={{ width: '65%', minWidth: '200px' }}>Course</th>
                    <th style={{ width: '35%', minWidth: '120px' }}>Expenses</th>
                  </tr>
                </thead>
                <tbody>
                  {(costReports.byCourse || []).map(c => (
                    <tr key={c._id}>
                      <td><span className="hrtm-primary-title">{c.courseTitle || 'Unlinked'}</span></td>
                      <td><strong>₹{(c.totalCost || 0).toLocaleString()}</strong></td>
                    </tr>
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

              {showModal === 'session' && (
                <>
                  <div className="hrtm-form-group">
                    <label>Session Title *</label>
                    <input type="text" required value={formData.sessionTitle || ''} onChange={e => setFormData({ ...formData, sessionTitle: e.target.value })} placeholder="e.g. Session 1: Fundamentals" />
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
                        onChange={v => setFormData({ ...formData, course: v })}
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
                        onChange={v => setFormData({ ...formData, trainer: v })}
                        placeholder="-- Choose Trainer --"
                      />
                    </div>
                    <div className="hrtm-form-group">
                      <label>Date *</label>
                      <input type="date" required value={formData.sessionDate ? formData.sessionDate.slice(0, 10) : ''} onChange={e => setFormData({ ...formData, sessionDate: e.target.value })} />
                    </div>
                  </div>
                  <div className="hrtm-form-row">
                    <div className="hrtm-form-group">
                      <label>Start Time</label>
                      <input type="time" value={formData.startTime || ''} onChange={e => setFormData({ ...formData, startTime: e.target.value })} />
                    </div>
                    <div className="hrtm-form-group">
                      <label>End Time</label>
                      <input type="time" value={formData.endTime || ''} onChange={e => setFormData({ ...formData, endTime: e.target.value })} />
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
                      <label>Select Employees ({selectedEmployees.length} selected)</label>
                      <div className="hrtm-emp-pick-list">
                        {employees.map(emp => {
                          const isSel = selectedEmployees.includes(emp._id);
                          return (
                            <div key={emp._id} className="hrtm-emp-pick-row" onClick={() => {
                              if (isSel) setSelectedEmployees(selectedEmployees.filter(id => id !== emp._id));
                              else setSelectedEmployees([...selectedEmployees, emp._id]);
                            }}>
                              <input type="checkbox" checked={isSel} onChange={() => { }} />
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
                        onChange={v => setFormData({ ...formData, status: v })}
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

        {/* 2. 8 KPI Cards (4 × 2 Grid Layout) + Dynamic Skill Performance Card */}
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

        {/* 4. Training Module Navigation (Unified 6 + 6 Two-Row Grid) */}
        <div className="hrtm-tabs-container" role="tablist" aria-label="Training Management Navigation">
          <div className="hrtm-tab-row" role="row">
            {ROW1_TABS.map(tab => (
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
          <div className="hrtm-tab-row" role="row">
            {ROW2_TABS.map(tab => (
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
        {renderManageProgramModal()}
        {renderManageCourseModal()}
      </div>
    </UserLayout>
  );
}
