import React, { useContext, useEffect, useMemo, useState } from 'react';
import apiClient from '../../../../../services/apiClient';
import { AppContext } from '../../../../../context/AppContext';
import UserLayout from '../components/UserLayout';
import './Payroll.css';
import '../Employees/HREmployees.css';

/* ─── Helpers ─── */
const formatMoney = (val) => {
  if (val == null || isNaN(val)) return '₹0';
  return `₹${Number(val).toLocaleString('en-IN')}`;
};

const formatDate = (val) => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return String(val);
  }
};

const formatMonthName = (periodStr) => {
  if (!periodStr) return '—';
  if (/^\d{4}-\d{2}$/.test(periodStr)) {
    const [year, month] = periodStr.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  return periodStr;
};

const getInitials = (firstName, lastName, email) => {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return 'EM';
};

const getEmployeeName = (u) => {
  if (!u) return 'Employee';
  if (u.personalInfo?.fullName) return u.personalInfo.fullName;
  const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return full || u.email || 'Employee';
};

// Normalize string for case/whitespace-insensitive matching
const normalizeDeptKey = (val) => String(val || '').trim().toLowerCase();

/**
 * Resolves canonical department name from a User or Payroll record
 * against the list of database Department objects.
 * Supports:
 * - user.department (string, ObjectId, or populated object)
 * - user.jobDetails.department (string or populated object)
 * - casing/whitespace differences ("Tech", " tech ", "TECH")
 */
const resolveDepartmentName = (u, deptList = []) => {
  if (!u) return '—';

  let raw = u.department || u.jobDetails?.department;
  if (!raw) return '—';

  // If populated object with name
  if (typeof raw === 'object' && raw !== null) {
    if (raw.name) return String(raw.name).trim();
    raw = raw._id;
  }

  const str = String(raw).trim();
  if (!str) return '—';

  // Check if str is an ObjectId matching a department's _id
  if (deptList && deptList.length > 0) {
    const byId = deptList.find((d) => d && String(d._id) === str);
    if (byId && byId.name) return String(byId.name).trim();

    // Check case-insensitive match against department name in deptList
    const byName = deptList.find((d) => d && d.name && normalizeDeptKey(d.name) === normalizeDeptKey(str));
    if (byName && byName.name) return String(byName.name).trim();
  }

  return str;
};

const getEmployeeDepartment = (u, deptList = []) => {
  return resolveDepartmentName(u, deptList);
};

const getEmployeeDesignation = (u) => {
  if (!u) return 'Staff';
  return u.designation || u.jobDetails?.designation || 'Staff';
};

const getEmployeeId = (u) => {
  if (!u) return '—';
  return u.jobDetails?.employeeId || (u._id ? `EMP-${String(u._id).slice(-5).toUpperCase()}` : '—');
};

export default function Payroll() {
  const { user } = useContext(AppContext);
  const isHR = ['admin', 'super_admin'].includes(user?.role) || user?.department === 'HR';

  // Data States
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Active Workspace Tab
  const [activeTab, setActiveTab] = useState('records'); // 'records' | 'generate' | 'salaries' | 'departments' | 'history'

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedPeriod, setSelectedPeriod] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Modals
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [selectedSalaryEmployee, setSelectedSalaryEmployee] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [generatePeriod, setGeneratePeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [generateEffectiveDate, setGenerateEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [generateDept, setGenerateDept] = useState('All');
  const [generateEmployee, setGenerateEmployee] = useState('All');

  const [editForm, setEditForm] = useState({
    basicSalary: 0,
    allowances: 0,
    bonus: 0,
    incentive: 0,
    overtime: 0,
    deductions: 0,
    salaryAdvance: 0,
    lopDeductions: 0,
    notes: '',
  });

  const [payForm, setPayForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'Bank Transfer',
    paymentReference: '',
    notes: '',
  });

  const [createForm, setCreateForm] = useState({
    user: '',
    payPeriod: new Date().toISOString().slice(0, 7),
    effectiveDate: new Date().toISOString().slice(0, 10),
    basicSalary: 35000,
    allowances: 5000,
    bonus: 0,
    incentive: 0,
    overtime: 0,
    deductions: 0,
    salaryAdvance: 0,
    notes: '',
  });

  const [salaryForm, setSalaryForm] = useState({
    basicSalary: 0,
    allowances: 0,
    bonus: 0,
    deductions: 0,
    currency: 'INR',
  });

  // History selected period
  const [historySelectedPeriod, setHistorySelectedPeriod] = useState('All');

  // Attendance Summary for detail modal
  const [attSummary, setAttSummary] = useState(null);
  const [attSummaryLoading, setAttSummaryLoading] = useState(false);

  // Load Real Data from MongoDB Atlas
  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [payrollRes, usersRes, deptRes] = await Promise.all([
        apiClient.get('/payroll'),
        isHR ? apiClient.get('/users').catch(() => ({ data: { data: [] } })) : Promise.resolve({ data: { data: [] } }),
        apiClient.get('/admin/departments').catch(() => apiClient.get('/departments')).catch(() => ({ data: { data: [] } })),
      ]);

      const payData = payrollRes.data?.data || [];
      setPayrollRecords(payData);

      const deptData = deptRes.data?.data || [];
      setDepartments(deptData);

      if (isHR) {
        const allUsers = (usersRes.data?.data || []).filter(
          (u) => u.role === 'employee' && u.isActive !== false && u.employmentStatus !== 'Exited' && u.employmentStatus !== 'Terminated'
        );
        setEmployees(allUsers);
        if (allUsers.length > 0 && !createForm.user) {
          setCreateForm((prev) => ({ ...prev, user: allUsers[0]._id }));
        }
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to load payroll records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch attendance summary whenever the detail modal opens
  useEffect(() => {
    if (!showDetailModal || !selectedRecord) {
      setAttSummary(null);
      return;
    }
    const userId    = selectedRecord.user?._id || selectedRecord.user;
    const payPeriod = selectedRecord.payPeriod || selectedRecord.month;
    if (!userId || !payPeriod) return;
    setAttSummaryLoading(true);
    apiClient
      .get('/payroll/attendance-summary', { params: { userId, payPeriod } })
      .then((r) => setAttSummary(r.data?.data || null))
      .catch(() => setAttSummary(null))
      .finally(() => setAttSummaryLoading(false));
  }, [showDetailModal, selectedRecord]);

  // 1. Dynamic KPI Calculations directly from real database records
  const kpiStats = useMemo(() => {
    const totalEmployees = employees.length || (payrollRecords.length > 0 ? new Set(payrollRecords.map((r) => String(r.user?._id || r.user))).size : 0);
    const pendingCount = payrollRecords.filter((r) => r.status === 'Pending').length;
    const processedCount = payrollRecords.filter((r) => r.status === 'Processed' || r.status === 'Processing').length;
    const paidCount = payrollRecords.filter((r) => r.status === 'Paid').length;
    const totalNet = payrollRecords.reduce((sum, r) => sum + (Number(r.net) || 0), 0);
    const totalDeductions = payrollRecords.reduce((sum, r) => sum + (Number(r.totalDeduction || r.deductions) || 0), 0);

    return {
      totalEmployees,
      pendingCount,
      processedCount,
      paidCount,
      totalNet,
      totalDeductions,
      totalRecords: payrollRecords.length,
    };
  }, [payrollRecords, employees]);

  // Available Pay Periods from records
  const availablePeriods = useMemo(() => {
    const set = new Set();
    payrollRecords.forEach((r) => {
      if (r.payPeriod) set.add(r.payPeriod);
      else if (r.month) set.add(r.month);
    });
    return Array.from(set).sort().reverse();
  }, [payrollRecords]);

  // 2. Filtered Records
  // Canonical list of all real database departments from MongoDB
  const canonicalDepartments = useMemo(() => {
    const list = [];
    const seen = new Set();

    // 1. All departments from database API
    departments.forEach((dept) => {
      // Respect status if status field exists (only active departments)
      if (dept && dept.status && dept.status !== 'Active') return;
      const name = dept?.name ? String(dept.name).trim() : '';
      if (!name) return;
      const key = normalizeDeptKey(name);
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ id: dept._id || key, name });
      }
    });

    // 2. Any active employee whose assigned department might not be in the departments collection
    employees.forEach((emp) => {
      const name = resolveDepartmentName(emp, departments);
      if (!name || name === '—' || name.toLowerCase() === 'all') return;
      const key = normalizeDeptKey(name);
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ id: key, name });
      }
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [departments, employees]);

  const filteredRecords = useMemo(() => {
    return payrollRecords.filter((r) => {
      const name = getEmployeeName(r.user).toLowerCase();
      const email = (r.user?.email || '').toLowerCase();
      const empId = getEmployeeId(r.user).toLowerCase();
      const q = search.toLowerCase();
      const matchesSearch = !q || name.includes(q) || email.includes(q) || empId.includes(q);

      const dept = resolveDepartmentName(r.user, departments);
      const matchesDept = selectedDept === 'All' || dept.toLowerCase() === selectedDept.toLowerCase();

      const period = r.payPeriod || r.month;
      const matchesPeriod = selectedPeriod === 'All' || period === selectedPeriod;

      const matchesStatus = selectedStatus === 'All' || r.status === selectedStatus;

      return matchesSearch && matchesDept && matchesPeriod && matchesStatus;
    });
  }, [payrollRecords, search, selectedDept, selectedPeriod, selectedStatus, departments]);

  // 3. Department Breakdown Calculations (Filtered strictly by selectedPeriod)
  const departmentSummaries = useMemo(() => {
    // Filter payroll records strictly by the currently selected payroll period
    const periodRecords = selectedPeriod && selectedPeriod !== 'All'
      ? payrollRecords.filter((r) => (r.payPeriod || r.month) === selectedPeriod)
      : payrollRecords;

    // Map each canonical department to its real metrics
    const map = new Map();
    canonicalDepartments.forEach((dept) => {
      const key = normalizeDeptKey(dept.name);
      map.set(key, {
        name: dept.name,
        totalEmployees: 0,
        payrollCount: 0,
        totalNet: 0,
        pendingCount: 0,
        processedCount: 0,
        paidCount: 0,
      });
    });

    // 1. Real Active Employee count per department
    employees.forEach((emp) => {
      const deptName = resolveDepartmentName(emp, departments);
      const key = normalizeDeptKey(deptName);
      if (map.has(key)) {
        map.get(key).totalEmployees += 1;
      }
    });

    // 2. Real Payroll Metrics for the selected period
    periodRecords.forEach((r) => {
      const deptName = resolveDepartmentName(r.user, departments);
      const key = normalizeDeptKey(deptName);
      if (!map.has(key)) return;

      const entry = map.get(key);
      entry.payrollCount += 1;
      entry.totalNet += Number(r.net) || 0;

      const status = r.status || '';
      if (status === 'Pending') {
        entry.pendingCount += 1;
      } else if (status === 'Processed' || status === 'Processing') {
        entry.processedCount += 1;
      } else if (status === 'Paid') {
        entry.paidCount += 1;
      }
    });

    return Array.from(map.values());
  }, [canonicalDepartments, employees, payrollRecords, selectedPeriod, departments]);

  // Total Net Payroll for displayed departments in the selected period (used for % of spend)
  const periodTotalNet = useMemo(() => {
    return departmentSummaries.reduce((sum, d) => sum + (Number(d.totalNet) || 0), 0);
  }, [departmentSummaries]);

  // Eligible employees for Generate Payroll based on selected Department
  const generateEligibleEmployees = useMemo(() => {
    if (generateDept === 'All') return employees;
    return employees.filter((emp) => {
      const deptName = resolveDepartmentName(emp, departments);
      return normalizeDeptKey(deptName) === normalizeDeptKey(generateDept);
    });
  }, [employees, generateDept, departments]);

  // Target employees list in scope based on department & employee selection
  const targetEmployeesInScope = useMemo(() => {
    if (generateEmployee !== 'All') {
      const found = generateEligibleEmployees.find((e) => String(e._id) === String(generateEmployee));
      return found ? [found] : [];
    }
    return generateEligibleEmployees;
  }, [generateEligibleEmployees, generateEmployee]);

  // Already generated records count for the selected payPeriod among employees in scope
  const alreadyGeneratedCount = useMemo(() => {
    if (!generatePeriod || targetEmployeesInScope.length === 0) return 0;
    const existingUserIds = new Set(
      payrollRecords
        .filter((r) => (r.payPeriod === generatePeriod || r.month === generatePeriod))
        .map((r) => String(r.user?._id || r.user))
    );
    return targetEmployeesInScope.filter((emp) => existingUserIds.has(String(emp._id))).length;
  }, [payrollRecords, generatePeriod, targetEmployeesInScope]);

  const pendingToGenerateCount = useMemo(() => {
    return Math.max(0, targetEmployeesInScope.length - alreadyGeneratedCount);
  }, [targetEmployeesInScope, alreadyGeneratedCount]);

  // Dynamic Status string and styling
  const generateStatusInfo = useMemo(() => {
    if (submitting) {
      return { label: 'Generating in MongoDB Atlas...', color: '#ea580c' };
    }
    if (targetEmployeesInScope.length === 0) {
      return { label: 'No Eligible Employees', color: '#64748b' };
    }
    if (pendingToGenerateCount === 0) {
      return { label: `Already Generated (${alreadyGeneratedCount} of ${targetEmployeesInScope.length} records exist)`, color: '#6b21a8' };
    }
    if (alreadyGeneratedCount > 0) {
      return { label: `Ready to Generate (${pendingToGenerateCount} new, ${alreadyGeneratedCount} already generated)`, color: '#15803d' };
    }
    return { label: 'Ready to Generate', color: '#15803d' };
  }, [submitting, targetEmployeesInScope.length, pendingToGenerateCount, alreadyGeneratedCount]);

  // Handle month picker change and update default effective date to end of month
  const handlePeriodChange = (val) => {
    setGeneratePeriod(val);
    if (/^\d{4}-\d{2}$/.test(val)) {
      const [year, month] = val.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      setGenerateEffectiveDate(`${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
    }
  };

  // 4. Modal Triggers
  const handleOpenDetail = (record) => {
    setSelectedRecord(record);
    setShowDetailModal(true);
  };

  const handleOpenEdit = (record) => {
    setSelectedRecord(record);
    setEditForm({
      basicSalary: record.basicSalary || 0,
      allowances: record.allowances || 0,
      bonus: record.bonus || 0,
      incentive: record.incentive || 0,
      overtime: record.overtime || 0,
      deductions: record.deductions || 0,
      salaryAdvance: record.salaryAdvance || 0,
      lopDeductions: record.lopDeductions || 0,
      notes: record.notes || '',
    });
    setShowDetailModal(false);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await apiClient.put(`/payroll/${selectedRecord._id}`, editForm);
      const updated = res.data?.data || { ...selectedRecord, ...editForm };
      setShowEditModal(false);
      setSelectedRecord(updated);
      setSuccess(`Payroll for ${getEmployeeName(selectedRecord.user)} updated successfully.`);
      await loadData();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update payroll.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenProcess = (record) => {
    setSelectedRecord(record);
    setShowProcessModal(true);
  };

  const handleConfirmProcess = async () => {
    if (!selectedRecord) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await apiClient.patch(`/payroll/${selectedRecord._id}/process`, {});
      const updated = res.data?.data || { ...selectedRecord, status: 'Processed' };
      setShowProcessModal(false);
      setSelectedRecord(updated);
      setSuccess(`Payroll for ${getEmployeeName(selectedRecord.user)} marked as Processed.`);
      await loadData();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to process payroll.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPay = (record) => {
    setSelectedRecord(record);
    setPayForm({
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'Bank Transfer',
      paymentReference: '',
      notes: record.notes || '',
    });
    setShowPayModal(true);
  };

  const handleConfirmPay = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await apiClient.patch(`/payroll/${selectedRecord._id}/pay`, payForm);
      const updated = res.data?.data || { ...selectedRecord, status: 'Paid', ...payForm };
      setShowPayModal(false);
      setSelectedRecord(updated);
      setSuccess(`Salary for ${getEmployeeName(selectedRecord.user)} marked as Paid.`);
      await loadData();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to record payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGeneratePayroll = async (e) => {
    e.preventDefault();
    if (!generatePeriod) {
      setError('Please select a valid pay period (e.g. 2026-09).');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const res = await apiClient.post('/payroll/generate', {
        payPeriod: generatePeriod,
        month: generatePeriod,
        effectiveDate: generateEffectiveDate,
        department: generateDept,
        employeeId: generateEmployee !== 'All' ? generateEmployee : undefined,
      });

      const { generatedCount, skippedCount } = res.data?.data || {};
      setSuccess(`Successfully generated ${generatedCount} payroll records for ${formatMonthName(generatePeriod)}! (${skippedCount} skipped/already existing)`);
      setShowGenerateModal(false);
      await loadData();
      setActiveTab('records');
      setSelectedPeriod(generatePeriod);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to generate payroll.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSingle = async (e) => {
    e.preventDefault();
    if (!createForm.user || !createForm.payPeriod) {
      setError('Please select employee and pay period.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await apiClient.post('/payroll', createForm);
      setShowCreateModal(false);
      setSuccess('Payroll record created successfully as Pending.');
      await loadData();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create payroll record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenSalaryModal = (emp) => {
    setSelectedSalaryEmployee(emp);
    const sal = emp.salaryDetails || {};
    setSalaryForm({
      basicSalary: sal.basicSalary || 35000,
      allowances: sal.allowances || 5000,
      bonus: sal.bonus || 0,
      deductions: sal.deductions || 0,
      currency: sal.currency || 'INR',
    });
    setShowSalaryModal(true);
  };

  const handleSaveSalary = async (e) => {
    e.preventDefault();
    if (!selectedSalaryEmployee) return;

    setSubmitting(true);
    setError('');
    try {
      await apiClient.put(`/payroll/employee-salary/${selectedSalaryEmployee._id}`, salaryForm);
      setShowSalaryModal(false);
      setSuccess(`Salary structure for ${getEmployeeName(selectedSalaryEmployee)} updated successfully.`);
      await loadData();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update salary structure.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPayslip = async (record) => {
    try {
      const res = await apiClient.get(`/payroll/${record._id}/payslip`, { responseType: 'text' });
      const popup = window.open('', '_blank');
      if (popup) {
        popup.document.write(res.data);
        popup.document.close();
      } else {
        alert('Popup blocker prevented opening the payslip. Please allow popups for this site.');
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to generate payslip.');
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setSelectedDept('All');
    setSelectedPeriod('All');
    setSelectedStatus('All');
  };

  // Real-time edited calculations for Edit Modal
  const editCalculations = useMemo(() => {
    const gross = (Number(editForm.basicSalary) || 0) + (Number(editForm.allowances) || 0) + (Number(editForm.bonus) || 0) + (Number(editForm.incentive) || 0) + (Number(editForm.overtime) || 0);
    const totalDeduction = (Number(editForm.deductions) || 0) + (Number(editForm.salaryAdvance) || 0) + (Number(editForm.lopDeductions) || 0);
    const net = Math.max(0, gross - totalDeduction);
    return { gross, totalDeduction, net };
  }, [editForm]);

  return (
    <UserLayout pageTitle="Payroll Management">
      <div className="payroll-container">
        {/* Header */}
        <div className="payroll-header-area">
          <div className="payroll-title-meta">
            <h2>Payroll Management</h2>
            <p>Centrally generate, process, monitor, and disburse monthly employee payroll across all departments.</p>
          </div>
          {isHR && (
            <div className="payroll-header-actions">
              <button
                type="button"
                className="payroll-secondary-btn"
                onClick={loadData}
                disabled={loading}
                title="Refresh Payroll Data"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Refresh
              </button>
              <button
                type="button"
                className="payroll-secondary-btn"
                onClick={() => {
                  setError('');
                  setSuccess('');
                  setShowCreateModal(true);
                }}
              >
                + Create Single Record
              </button>
              <button
                type="button"
                className="payroll-primary-btn"
                onClick={() => {
                  setError('');
                  setSuccess('');
                  setShowGenerateModal(true);
                }}
              >
                + Generate Payroll
              </button>
            </div>
          )}
        </div>

        {/* 6 Dynamic Real KPI Cards */}
        <div className="payroll-kpi-grid">
          <div className="payroll-kpi-card blue">
            <div className="payroll-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="payroll-kpi-body">
              <span className="payroll-kpi-label">Active Employees</span>
              <strong className="payroll-kpi-value">{kpiStats.totalEmployees}</strong>
            </div>
          </div>

          <div className="payroll-kpi-card amber">
            <div className="payroll-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="payroll-kpi-body">
              <span className="payroll-kpi-label">Pending Payroll</span>
              <strong className="payroll-kpi-value">{kpiStats.pendingCount}</strong>
            </div>
          </div>

          <div className="payroll-kpi-card purple">
            <div className="payroll-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div className="payroll-kpi-body">
              <span className="payroll-kpi-label">Processed Payroll</span>
              <strong className="payroll-kpi-value">{kpiStats.processedCount}</strong>
            </div>
          </div>

          <div className="payroll-kpi-card green">
            <div className="payroll-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="payroll-kpi-body">
              <span className="payroll-kpi-label">Paid Payroll</span>
              <strong className="payroll-kpi-value">{kpiStats.paidCount}</strong>
            </div>
          </div>

          <div className="payroll-kpi-card emerald">
            <div className="payroll-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
            <div className="payroll-kpi-body">
              <span className="payroll-kpi-label">Total Net Payroll</span>
              <strong className="payroll-kpi-value">{formatMoney(kpiStats.totalNet)}</strong>
            </div>
          </div>

          <div className="payroll-kpi-card rose">
            <div className="payroll-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div className="payroll-kpi-body">
              <span className="payroll-kpi-label">Total Deductions</span>
              <strong className="payroll-kpi-value">{formatMoney(kpiStats.totalDeductions)}</strong>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && <div className="payroll-alert error">{error}</div>}
        {success && <div className="payroll-alert success">{success}</div>}

        {/* Workspace Navigation Tabs */}
        {isHR && (
          <div className="payroll-nav-tabs-wrap">
            <div className="payroll-nav-tabs">
              <button
                type="button"
                className={`payroll-tab-btn ${activeTab === 'records' ? 'active' : ''}`}
                onClick={() => setActiveTab('records')}
              >
                Payroll Records <span className="payroll-tab-badge">{payrollRecords.length}</span>
              </button>
              <button
                type="button"
                className={`payroll-tab-btn ${activeTab === 'salaries' ? 'active' : ''}`}
                onClick={() => setActiveTab('salaries')}
              >
                Salary Structure
              </button>
              <button
                type="button"
                className={`payroll-tab-btn ${activeTab === 'departments' ? 'active' : ''}`}
                onClick={() => setActiveTab('departments')}
              >
                Department Breakdown
              </button>
              <button
                type="button"
                className={`payroll-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                Payroll History
              </button>
            </div>
          </div>
        )}

        {/* ─── TAB 1: PAYROLL RECORDS TABLE ─── */}
        {activeTab === 'records' && (
          <div>
            {/* Filter Toolbar */}
            <div className="payroll-toolbar">
              <div className="payroll-search-wrap">
                <svg className="payroll-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by employee name, email or ID..."
                  className="payroll-search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {isHR && (
                <select className="payroll-filter-select" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
                  <option value="All">All Departments</option>
                  {canonicalDepartments.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              )}

              {availablePeriods.length > 0 && (
                <select className="payroll-filter-select" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
                  <option value="All">All Pay Periods</option>
                  {availablePeriods.map((p) => (
                    <option key={p} value={p}>{formatMonthName(p)}</option>
                  ))}
                </select>
              )}

              <select className="payroll-filter-select" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Processed">Processed</option>
                <option value="Paid">Paid</option>
              </select>

              {(search || selectedDept !== 'All' || selectedPeriod !== 'All' || selectedStatus !== 'All') && (
                <button type="button" className="payroll-secondary-btn" onClick={handleClearFilters} style={{ padding: '0.55rem 0.8rem' }}>
                  Clear Filters
                </button>
              )}
            </div>

            {/* Main Table */}
            <div className="payroll-table-card">
              {loading ? (
                <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>Loading payroll records from MongoDB Atlas...</div>
              ) : filteredRecords.length === 0 ? (
                <div className="payroll-empty-state">
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💳</div>
                  <h3>No Payroll Records Found</h3>
                  <p>
                    {payrollRecords.length === 0
                      ? 'No payroll records have been generated yet in MongoDB Atlas.'
                      : 'No payroll records match your current search and filter criteria.'}
                  </p>
                </div>
              ) : (
                <div className="payroll-table-wrap">
                  <table className="payroll-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Department</th>
                        <th>Pay Period</th>
                        <th>Basic Salary</th>
                        <th>Allowances</th>
                        <th>Bonus</th>
                        <th>Gross Salary</th>
                        <th>Deductions</th>
                        <th>Net Salary</th>
                        <th>Status</th>
                        <th style={{ minWidth: '200px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((r) => {
                        const name = getEmployeeName(r.user);
                        const initials = getInitials(r.user?.firstName, r.user?.lastName, r.user?.email);
                        const dept = getEmployeeDepartment(r.user);

                        return (
                          <tr key={r._id}>
                            <td>
                              <div className="payroll-emp-cell">
                                <div className="payroll-emp-avatar">{initials}</div>
                                <div className="payroll-emp-meta">
                                  <span className="payroll-emp-name">{name}</span>
                                  <span className="payroll-emp-email">{r.user?.email}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="hr-emp-dept-pill">{dept}</span>
                            </td>
                            <td>
                              <strong>{formatMonthName(r.payPeriod || r.month)}</strong>
                            </td>
                            <td>{formatMoney(r.basicSalary)}</td>
                            <td>{formatMoney(r.allowances)}</td>
                            <td>{formatMoney(r.bonus)}</td>
                            <td>
                              <strong style={{ color: '#0f172a' }}>{formatMoney(r.gross)}</strong>
                            </td>
                            <td>
                              <span style={{ color: '#dc2626' }}>- {formatMoney(r.totalDeduction || r.deductions)}</span>
                            </td>
                            <td>
                              <strong style={{ color: '#15803d', fontSize: '0.95rem' }}>{formatMoney(r.net)}</strong>
                            </td>
                            <td>
                              <span className={`payroll-status-pill ${(r.status || '').toLowerCase()}`}>
                                {r.status}
                              </span>
                            </td>
                            <td>
                              <div className="payroll-actions-wrap">
                                <button type="button" className="payroll-btn-sm view" onClick={() => handleOpenDetail(r)}>
                                  View
                                </button>

                                {isHR && r.status === 'Pending' && (
                                  <>
                                    <button type="button" className="payroll-btn-sm edit" onClick={() => handleOpenEdit(r)}>
                                      Edit
                                    </button>
                                    <button type="button" className="payroll-btn-sm process" onClick={() => handleOpenProcess(r)}>
                                      Process
                                    </button>
                                  </>
                                )}

                                {isHR && (r.status === 'Processed' || r.status === 'Processing') && (
                                  <>
                                    <button type="button" className="payroll-btn-sm edit" onClick={() => handleOpenEdit(r)}>
                                      Edit
                                    </button>
                                    <button type="button" className="payroll-btn-sm pay" onClick={() => handleOpenPay(r)}>
                                      Mark as Paid
                                    </button>
                                    <button type="button" className="payroll-btn-sm payslip" onClick={() => handleDownloadPayslip(r)}>
                                      Payslip
                                    </button>
                                  </>
                                )}

                                {r.status === 'Paid' && (
                                  <button type="button" className="payroll-btn-sm payslip" onClick={() => handleDownloadPayslip(r)}>
                                    Payslip
                                  </button>
                                )}
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

        {/* ─── TAB 2: SALARY STRUCTURE ─── */}
        {activeTab === 'salaries' && isHR && (
          <div className="payroll-table-card">
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0, color: '#0f172a' }}>Employee Salary Structures</h4>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Configure base salary, allowances, and standard deductions stored in MongoDB for each active employee.
                </p>
              </div>
            </div>

            <div className="payroll-table-wrap">
              <table className="payroll-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Basic Salary</th>
                    <th>Allowances</th>
                    <th>Bonus (Std)</th>
                    <th>Deductions (Std)</th>
                    <th>Gross Salary</th>
                    <th>Net Salary</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const name = getEmployeeName(emp);
                    const initials = getInitials(emp.firstName, emp.lastName, emp.email);
                    const dept = getEmployeeDepartment(emp);
                    const desig = getEmployeeDesignation(emp);
                    const sal = emp.salaryDetails || {};
                    const basic = sal.basicSalary || 35000;
                    const allow = sal.allowances || 5000;
                    const bonus = sal.bonus || 0;
                    const ded = sal.deductions || 0;
                    const gross = basic + allow + bonus;
                    const net = gross - ded;

                    return (
                      <tr key={emp._id}>
                        <td>
                          <div className="payroll-emp-cell">
                            <div className="payroll-emp-avatar">{initials}</div>
                            <div className="payroll-emp-meta">
                              <span className="payroll-emp-name">{name}</span>
                              <span className="payroll-emp-email">{emp.email}</span>
                            </div>
                          </div>
                        </td>
                        <td><span className="hr-emp-dept-pill">{dept}</span></td>
                        <td>{desig}</td>
                        <td>{formatMoney(basic)}</td>
                        <td>{formatMoney(allow)}</td>
                        <td>{formatMoney(bonus)}</td>
                        <td>{formatMoney(ded)}</td>
                        <td><strong>{formatMoney(gross)}</strong></td>
                        <td><strong style={{ color: '#15803d' }}>{formatMoney(net)}</strong></td>
                        <td>
                          <button
                            type="button"
                            className="payroll-btn-sm edit"
                            onClick={() => handleOpenSalaryModal(emp)}
                          >
                            ✏️ Edit Salary
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── TAB 3: DEPARTMENT-WISE BREAKDOWN ─── */}
        {activeTab === 'departments' && isHR && (
          <div>
            {/* Period Filter Toolbar */}
            <div className="payroll-toolbar" style={{ justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <label style={{ fontWeight: '600', fontSize: '0.85rem', color: '#0f172a' }}>Payroll Period:</label>
                {availablePeriods.length > 0 ? (
                  <select
                    className="payroll-filter-select"
                    style={{ minWidth: '220px' }}
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                  >
                    <option value="All">All Pay Periods</option>
                    {availablePeriods.map((p) => (
                      <option key={p} value={p}>{formatMonthName(p)}</option>
                    ))}
                  </select>
                ) : (
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>No periods generated yet</span>
                )}
                {selectedPeriod !== 'All' && (
                  <button
                    type="button"
                    className="payroll-secondary-btn"
                    onClick={() => setSelectedPeriod('All')}
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                  >
                    Show All Periods
                  </button>
                )}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Showing <strong>{departmentSummaries.length}</strong> department{departmentSummaries.length !== 1 ? 's' : ''}
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
                Loading department breakdown from MongoDB Atlas...
              </div>
            ) : departmentSummaries.length === 0 ? (
              <div className="payroll-empty-state">
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🏢</div>
                <h3>No Departments Found</h3>
                <p>No active departments were found in MongoDB.</p>
              </div>
            ) : (
              <div className="payroll-dept-grid">
                {departmentSummaries.map((dept) => {
                  const pct = periodTotalNet > 0 ? ((dept.totalNet / periodTotalNet) * 100).toFixed(1) : '0';
                  return (
                    <div key={dept.name} className="payroll-dept-card">
                      <div className="payroll-dept-card-header">
                        <div>
                          <span className="payroll-dept-name">{dept.name}</span>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                            {dept.totalEmployees} Active Employee{dept.totalEmployees !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <span className="payroll-dept-spend-pill">{pct}% of spend</span>
                      </div>

                      <div style={{ margin: '1rem 0' }}>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Total Payroll Amount</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#ea580c', marginTop: '2px' }}>
                          {formatMoney(dept.totalNet)}
                        </div>
                      </div>

                      <div className="payroll-dept-metrics">
                        <div className="payroll-dept-metric-col">
                          <span>Pending</span>
                          <strong style={{ color: dept.pendingCount > 0 ? '#f59e0b' : '#0f172a' }}>{dept.pendingCount}</strong>
                        </div>
                        <div className="payroll-dept-metric-col">
                          <span>Processed</span>
                          <strong style={{ color: '#8b5cf6' }}>{dept.processedCount}</strong>
                        </div>
                        <div className="payroll-dept-metric-col">
                          <span>Paid</span>
                          <strong style={{ color: '#10b981' }}>{dept.paidCount}</strong>
                        </div>
                        <div className="payroll-dept-metric-col">
                          <span>Records</span>
                          <strong>{dept.payrollCount}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 4: PAYROLL HISTORY ─── */}
        {activeTab === 'history' && isHR && (
          <div>
            <div className="payroll-toolbar" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label style={{ fontWeight: '600', fontSize: '0.85rem', color: '#0f172a' }}>Historical Period:</label>
                <select
                  className="payroll-filter-select"
                  style={{ minWidth: '220px' }}
                  value={historySelectedPeriod}
                  onChange={(e) => setHistorySelectedPeriod(e.target.value)}
                >
                  <option value="All">All History</option>
                  {availablePeriods.map((p) => (
                    <option key={p} value={p}>{formatMonthName(p)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="payroll-table-card">
              <div className="payroll-table-wrap">
                <table className="payroll-table">
                  <thead>
                    <tr>
                      <th>Pay Period</th>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Gross Salary</th>
                      <th>Deductions</th>
                      <th>Net Disbursed</th>
                      <th>Status</th>
                      <th>Payment Date</th>
                      <th>Payslip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollRecords
                      .filter((r) => historySelectedPeriod === 'All' || (r.payPeriod || r.month) === historySelectedPeriod)
                      .map((r) => (
                        <tr key={r._id}>
                          <td><strong>{formatMonthName(r.payPeriod || r.month)}</strong></td>
                          <td>{getEmployeeName(r.user)}</td>
                          <td><span className="hr-emp-dept-pill">{getEmployeeDepartment(r.user)}</span></td>
                          <td>{formatMoney(r.gross)}</td>
                          <td style={{ color: '#dc2626' }}>- {formatMoney(r.totalDeduction || r.deductions)}</td>
                          <td><strong style={{ color: '#15803d' }}>{formatMoney(r.net)}</strong></td>
                          <td><span className={`payroll-status-pill ${(r.status || '').toLowerCase()}`}>{r.status}</span></td>
                          <td>{formatDate(r.paymentDate)}</td>
                          <td>
                            <button type="button" className="payroll-btn-sm payslip" onClick={() => handleDownloadPayslip(r)}>
                              Payslip
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── VIEW PAYROLL DETAILS MODAL ─── */}
        {showDetailModal && selectedRecord && (
          <div className="hr-modal-overlay" onClick={() => setShowDetailModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
              <div className="hr-modal-header">
                <h3>Payroll Statement Details</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowDetailModal(false)}>&times;</button>
              </div>

              <div className="hr-modal-body">
                {/* Employee Section */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <h5 style={{ margin: '0 0 0.6rem 0', color: '#0f172a', fontWeight: '700' }}>Employee Information</h5>
                  <div className="hr-profile-details-grid">
                    <div className="hr-profile-item">
                      <span>Employee Name</span>
                      <strong>{getEmployeeName(selectedRecord.user)}</strong>
                    </div>
                    <div className="hr-profile-item">
                      <span>Department</span>
                      <strong>{getEmployeeDepartment(selectedRecord.user)}</strong>
                    </div>
                    <div className="hr-profile-item">
                      <span>Designation</span>
                      <strong>{getEmployeeDesignation(selectedRecord.user)}</strong>
                    </div>
                    <div className="hr-profile-item">
                      <span>Email Address</span>
                      <strong>{selectedRecord.user?.email || '—'}</strong>
                    </div>
                  </div>
                </div>

                {/* Attendance Summary Section */}
                {(attSummaryLoading || attSummary) && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <h5 style={{ margin: '0 0 0.6rem 0', color: '#0f172a', fontWeight: '700' }}>Attendance Summary</h5>
                    {attSummaryLoading ? (
                      <div style={{ fontSize: '0.825rem', color: '#94a3b8', padding: '0.5rem 0' }}>Loading attendance data…</div>
                    ) : (
                      <div className="hr-profile-details-grid">
                        {attSummary.totalWorkingDays > 0 && (
                          <div className="hr-profile-item">
                            <span>Working Days</span>
                            <strong>{attSummary.totalWorkingDays}</strong>
                          </div>
                        )}
                        {attSummary.presentCount > 0 && (
                          <div className="hr-profile-item">
                            <span>Present</span>
                            <strong style={{ color: '#15803d' }}>{attSummary.presentCount}</strong>
                          </div>
                        )}
                        {attSummary.lateCount > 0 && (
                          <div className="hr-profile-item">
                            <span>Late</span>
                            <strong style={{ color: '#d97706' }}>{attSummary.lateCount}</strong>
                          </div>
                        )}
                        {attSummary.halfDayCount > 0 && (
                          <div className="hr-profile-item">
                            <span>Half Day</span>
                            <strong style={{ color: '#7c3aed' }}>{attSummary.halfDayCount}</strong>
                          </div>
                        )}
                        {attSummary.absentCount > 0 && (
                          <div className="hr-profile-item">
                            <span>Absent (Att.)</span>
                            <strong style={{ color: '#dc2626' }}>{attSummary.absentCount}</strong>
                          </div>
                        )}
                        {attSummary.unpaidApprovedDays > 0 && (
                          <div className="hr-profile-item">
                            <span>Unpaid Leave</span>
                            <strong style={{ color: '#dc2626' }}>{attSummary.unpaidApprovedDays} days</strong>
                          </div>
                        )}
                        {attSummary.lopDays > 0 && (
                          <div className="hr-profile-item" style={{ background: '#fef2f2', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                            <span style={{ color: '#991b1b' }}>LOP Days (Total)</span>
                            <strong style={{ color: '#dc2626' }}>{attSummary.lopDays} days</strong>
                          </div>
                        )}
                        {(attSummary.leaveByType?.Casual?.approved > 0 || attSummary.leaveByType?.Sick?.approved > 0 || attSummary.leaveByType?.Annual?.approved > 0) && (
                          <div className="hr-profile-item full-width" style={{ background: '#f0fdf4', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                            <span style={{ color: '#166534' }}>Paid Leave (Approved)</span>
                            <strong style={{ color: '#15803d' }}>
                              {[
                                attSummary.leaveByType?.Casual?.approved > 0 && `Casual: ${attSummary.leaveByType.Casual.approved}d`,
                                attSummary.leaveByType?.Sick?.approved > 0 && `Sick: ${attSummary.leaveByType.Sick.approved}d`,
                                attSummary.leaveByType?.Annual?.approved > 0 && `Annual: ${attSummary.leaveByType.Annual.approved}d`,
                              ].filter(Boolean).join(' · ')}
                            </strong>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Salary Section */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <h5 style={{ margin: 0, color: '#0f172a', fontWeight: '700' }}>
                      Earnings & Deductions ({formatMonthName(selectedRecord.payPeriod || selectedRecord.month)})
                    </h5>
                    {isHR && selectedRecord.status !== 'Paid' && (
                      <button
                        type="button"
                        className="payroll-secondary-btn"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                        onClick={() => handleOpenEdit(selectedRecord)}
                      >
                        ✏️ Edit Statement
                      </button>
                    )}
                  </div>

                  <div className="hr-profile-details-grid">
                    <div className="hr-profile-item">
                      <span>Basic Salary</span>
                      <strong>{formatMoney(selectedRecord.basicSalary)}</strong>
                    </div>
                    <div className="hr-profile-item">
                      <span>Allowances</span>
                      <strong>{formatMoney(selectedRecord.allowances)}</strong>
                    </div>
                    <div className="hr-profile-item">
                      <span>Bonus / Incentives</span>
                      <strong>{formatMoney((selectedRecord.bonus || 0) + (selectedRecord.incentive || 0))}</strong>
                    </div>
                    <div className="hr-profile-item">
                      <span>Gross Earnings</span>
                      <strong style={{ color: '#0f172a' }}>{formatMoney(selectedRecord.gross)}</strong>
                    </div>
                    <div className="hr-profile-item">
                      <span>Standard Deductions</span>
                      <strong style={{ color: '#dc2626' }}>- {formatMoney(selectedRecord.deductions)}</strong>
                    </div>
                    {selectedRecord.lopDeductions > 0 && (
                      <div className="hr-profile-item">
                        <span>Loss of Pay ({selectedRecord.lopDays} days)</span>
                        <strong style={{ color: '#dc2626' }}>- {formatMoney(selectedRecord.lopDeductions)}</strong>
                      </div>
                    )}
                    <div className="hr-profile-item" style={{ background: '#f0fdf4', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
                      <span style={{ color: '#166534' }}>Net Salary</span>
                      <strong style={{ color: '#15803d', fontSize: '1.1rem' }}>{formatMoney(selectedRecord.net)}</strong>
                    </div>
                    <div className="hr-profile-item">
                      <span>Current Status</span>
                      <span className={`payroll-status-pill ${(selectedRecord.status || '').toLowerCase()}`}>
                        {selectedRecord.status}
                      </span>
                    </div>

                    {selectedRecord.paymentDate && (
                      <div className="hr-profile-item full-width" style={{ background: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
                        <span>Payment Information</span>
                        <strong>
                          Disbursed on {formatDate(selectedRecord.paymentDate)} via {selectedRecord.paymentMethod || 'Bank Transfer'}
                          {selectedRecord.paymentReference ? ` (Ref: ${selectedRecord.paymentReference})` : ''}
                        </strong>
                      </div>
                    )}

                    {selectedRecord.processedBy && (
                      <div className="hr-profile-item full-width">
                        <span>Processed By</span>
                        <strong>
                          {getEmployeeName(selectedRecord.processedBy)} on {formatDate(selectedRecord.processedAt)}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="hr-modal-footer">
                <button type="button" className="hr-btn-secondary" onClick={() => setShowDetailModal(false)}>Close</button>
                <button
                  type="button"
                  className="payroll-btn-sm payslip"
                  style={{ padding: '0.6rem 1.2rem' }}
                  onClick={() => handleDownloadPayslip(selectedRecord)}
                >
                  📄 View / Print Payslip
                </button>
                {isHR && selectedRecord.status === 'Pending' && (
                  <button
                    type="button"
                    className="payroll-btn-sm process"
                    style={{ padding: '0.6rem 1.2rem' }}
                    onClick={() => {
                      setShowDetailModal(false);
                      handleOpenProcess(selectedRecord);
                    }}
                  >
                    Process Payroll
                  </button>
                )}
                {isHR && (selectedRecord.status === 'Processed' || selectedRecord.status === 'Processing') && (
                  <button
                    type="button"
                    className="payroll-btn-sm pay"
                    style={{ padding: '0.6rem 1.2rem' }}
                    onClick={() => {
                      setShowDetailModal(false);
                      handleOpenPay(selectedRecord);
                    }}
                  >
                    Mark as Paid
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── EDIT PAYROLL MODAL ─── */}
        {showEditModal && selectedRecord && (
          <div className="hr-modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px' }}>
              <div className="hr-modal-header">
                <h3>Edit Payroll Statement</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowEditModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleSaveEdit}>
                <div className="hr-modal-body">
                  <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.725rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Employee & Pay Period</div>
                    <div style={{ fontWeight: '700', color: '#0f172a' }}>{getEmployeeName(selectedRecord.user)} ({getEmployeeDepartment(selectedRecord.user)})</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Period: {formatMonthName(selectedRecord.payPeriod || selectedRecord.month)} • Status: {selectedRecord.status}</div>
                  </div>

                  <div className="hr-form-grid">
                    <div className="hr-form-group">
                      <label>Basic Salary (₹) *</label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={editForm.basicSalary}
                        onChange={(e) => setEditForm({ ...editForm, basicSalary: Number(e.target.value) })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Allowances (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.allowances}
                        onChange={(e) => setEditForm({ ...editForm, allowances: Number(e.target.value) })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Bonus (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.bonus}
                        onChange={(e) => setEditForm({ ...editForm, bonus: Number(e.target.value) })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Incentives / Overtime (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.incentive}
                        onChange={(e) => setEditForm({ ...editForm, incentive: Number(e.target.value) })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Standard Deductions (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.deductions}
                        onChange={(e) => setEditForm({ ...editForm, deductions: Number(e.target.value) })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Salary Advance Recovery (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.salaryAdvance}
                        onChange={(e) => setEditForm({ ...editForm, salaryAdvance: Number(e.target.value) })}
                      />
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Notes</label>
                      <textarea
                        rows={2}
                        placeholder="Internal HR note regarding this payroll item..."
                        value={editForm.notes}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Real-time Calculation Summary */}
                  <div style={{ background: '#f0fdf4', padding: '0.85rem 1rem', borderRadius: '8px', marginTop: '0.75rem', border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#166534' }}>Calculated Net Pay</div>
                      <strong style={{ fontSize: '1.25rem', color: '#15803d' }}>{formatMoney(editCalculations.net)}</strong>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#475569' }}>
                      <div>Gross: {formatMoney(editCalculations.gross)}</div>
                      <div style={{ color: '#dc2626' }}>Deductions: - {formatMoney(editCalculations.totalDeduction)}</div>
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Saving Changes...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── PROCESS CONFIRMATION MODAL ─── */}
        {showProcessModal && selectedRecord && (
          <div className="hr-modal-overlay" onClick={() => setShowProcessModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
              <div className="hr-modal-header">
                <h3 style={{ color: '#8b5cf6' }}>Confirm Payroll Processing</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowProcessModal(false)}>&times;</button>
              </div>

              <div className="hr-modal-body">
                <div style={{ background: '#f5f3ff', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #ddd6fe' }}>
                  <div style={{ color: '#6d28d9', fontWeight: '700', marginBottom: '0.35rem' }}>
                    Are you sure you want to process this payroll?
                  </div>
                  <div style={{ fontWeight: '700', color: '#0f172a' }}>{getEmployeeName(selectedRecord.user)} ({getEmployeeDepartment(selectedRecord.user)})</div>
                  <div style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Period: {formatMonthName(selectedRecord.payPeriod || selectedRecord.month)} • Net Salary: <strong style={{ color: '#15803d' }}>{formatMoney(selectedRecord.net)}</strong>
                  </div>
                </div>
                <p style={{ fontSize: '0.825rem', color: '#64748b', margin: 0 }}>
                  Processing locks in the salary figures and changes status to <strong>Processed</strong>, preparing it for salary disbursement.
                </p>
              </div>

              <div className="hr-modal-footer">
                <button type="button" className="hr-btn-secondary" onClick={() => setShowProcessModal(false)}>Cancel</button>
                <button
                  type="button"
                  className="payroll-btn-sm process"
                  style={{ padding: '0.65rem 1.3rem' }}
                  disabled={submitting}
                  onClick={handleConfirmProcess}
                >
                  {submitting ? 'Processing...' : 'Confirm & Process'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MARK AS PAID MODAL ─── */}
        {showPayModal && selectedRecord && (
          <div className="hr-modal-overlay" onClick={() => setShowPayModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
              <div className="hr-modal-header">
                <h3 style={{ color: '#15803d' }}>Record Salary Payment</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowPayModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleConfirmPay}>
                <div className="hr-modal-body">
                  <div style={{ background: '#f0fdf4', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #bbf7d0' }}>
                    <div style={{ color: '#166534', fontWeight: '700', marginBottom: '0.35rem' }}>
                      Disbursing Salary Payment
                    </div>
                    <div style={{ fontWeight: '700', color: '#0f172a' }}>{getEmployeeName(selectedRecord.user)}</div>
                    <div style={{ fontSize: '0.825rem', color: '#64748b' }}>
                      Net Payable: <strong style={{ color: '#15803d', fontSize: '1rem' }}>{formatMoney(selectedRecord.net)}</strong>
                    </div>
                  </div>

                  <div className="hr-form-grid">
                    <div className="hr-form-group">
                      <label>Payment Date *</label>
                      <input
                        type="date"
                        required
                        value={payForm.paymentDate}
                        onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Payment Method *</label>
                      <select
                        required
                        value={payForm.paymentMethod}
                        onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                      >
                        <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                        <option value="UPI">UPI</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Cash">Cash</option>
                        <option value="Direct Deposit">Direct Deposit</option>
                      </select>
                    </div>

                    <div className="hr-form-group full-width">
                      <label>Transaction Reference / UTR Number</label>
                      <input
                        type="text"
                        placeholder="e.g. UTR1234567890 / Bank Reference"
                        value={payForm.paymentReference}
                        onChange={(e) => setPayForm({ ...payForm, paymentReference: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowPayModal(false)}>Cancel</button>
                  <button type="submit" className="payroll-btn-sm pay" style={{ padding: '0.65rem 1.3rem' }} disabled={submitting}>
                    {submitting ? 'Recording...' : 'Confirm & Mark as Paid'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── CREATE SINGLE PAYROLL RECORD MODAL ─── */}
        {showCreateModal && (
          <div className="hr-modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
              <div className="hr-modal-header">
                <h3>Create Single Payroll Record</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowCreateModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleCreateSingle}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid">
                    <div className="hr-form-group full-width">
                      <label>Select Employee *</label>
                      <select
                        required
                        value={createForm.user}
                        onChange={(e) => setCreateForm({ ...createForm, user: e.target.value })}
                      >
                        {employees.map((emp) => (
                          <option key={emp._id} value={emp._id}>
                            {getEmployeeName(emp)} ({getEmployeeDepartment(emp)}) — {emp.email}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Pay Period (YYYY-MM) *</label>
                      <input
                        type="month"
                        required
                        value={createForm.payPeriod}
                        onChange={(e) => setCreateForm({ ...createForm, payPeriod: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Effective Date *</label>
                      <input
                        type="date"
                        required
                        value={createForm.effectiveDate}
                        onChange={(e) => setCreateForm({ ...createForm, effectiveDate: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Basic Salary (₹) *</label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={createForm.basicSalary}
                        onChange={(e) => setCreateForm({ ...createForm, basicSalary: Number(e.target.value) })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Allowances (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={createForm.allowances}
                        onChange={(e) => setCreateForm({ ...createForm, allowances: Number(e.target.value) })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Bonus (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={createForm.bonus}
                        onChange={(e) => setCreateForm({ ...createForm, bonus: Number(e.target.value) })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Deductions (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={createForm.deductions}
                        onChange={(e) => setCreateForm({ ...createForm, deductions: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Creating...' : 'Create Payroll Record'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── EDIT EMPLOYEE SALARY STRUCTURE MODAL ─── */}
        {showSalaryModal && selectedSalaryEmployee && (
          <div className="hr-modal-overlay" onClick={() => setShowSalaryModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
              <div className="hr-modal-header">
                <h3>Configure Base Salary Structure</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowSalaryModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleSaveSalary}>
                <div className="hr-modal-body">
                  <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.725rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Employee</div>
                    <div style={{ fontWeight: '700', color: '#0f172a' }}>{getEmployeeName(selectedSalaryEmployee)}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{getEmployeeDepartment(selectedSalaryEmployee)} • {selectedSalaryEmployee.email}</div>
                  </div>

                  <div className="hr-form-grid">
                    <div className="hr-form-group">
                      <label>Monthly Basic Salary (₹) *</label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={salaryForm.basicSalary}
                        onChange={(e) => setSalaryForm({ ...salaryForm, basicSalary: Number(e.target.value) })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Monthly Allowances (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={salaryForm.allowances}
                        onChange={(e) => setSalaryForm({ ...salaryForm, allowances: Number(e.target.value) })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Performance Bonus (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={salaryForm.bonus}
                        onChange={(e) => setSalaryForm({ ...salaryForm, bonus: Number(e.target.value) })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Standard Deductions (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={salaryForm.deductions}
                        onChange={(e) => setSalaryForm({ ...salaryForm, deductions: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowSalaryModal(false)}>Cancel</button>
                  <button type="submit" className="hr-btn-primary" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save Salary Structure'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── GENERATE PAYROLL MODAL ─── */}
        {showGenerateModal && (
          <div className="hr-modal-overlay" onClick={() => !submitting && setShowGenerateModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
              <div className="hr-modal-header">
                <div>
                  <h3 style={{ fontSize: '1.2rem', margin: 0, color: '#0f172a' }}>Generate Payroll</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Generate payroll for the selected period
                  </p>
                </div>
                <button
                  type="button"
                  className="hr-modal-close"
                  disabled={submitting}
                  onClick={() => setShowGenerateModal(false)}
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleGeneratePayroll}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid">
                    <div className="hr-form-group">
                      <label>Pay Period / Month *</label>
                      <input
                        type="month"
                        required
                        value={generatePeriod}
                        onChange={(e) => handlePeriodChange(e.target.value)}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Effective / Payroll Date *</label>
                      <input
                        type="date"
                        required
                        value={generateEffectiveDate}
                        onChange={(e) => setGenerateEffectiveDate(e.target.value)}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Department</label>
                      <select
                        value={generateDept}
                        onChange={(e) => {
                          setGenerateDept(e.target.value);
                          setGenerateEmployee('All');
                        }}
                      >
                        <option value="All">All Departments</option>
                        {canonicalDepartments.map((d) => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Employees</label>
                      <select
                        value={generateEmployee}
                        onChange={(e) => setGenerateEmployee(e.target.value)}
                      >
                        <option value="All">All Active Employees ({generateEligibleEmployees.length})</option>
                        {generateEligibleEmployees.map((emp) => (
                          <option key={emp._id} value={emp._id}>
                            {getEmployeeName(emp)} ({getEmployeeDepartment(emp)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Read-Only Payroll Calculation Information Section */}
                  <div className="payroll-calc-info-box">
                    <div className="payroll-calc-info-title">Payroll Calculation</div>
                    <ul className="payroll-calc-checklist">
                      <li><span className="check-icon">✓</span> Employee salary structure</li>
                      <li><span className="check-icon">✓</span> Attendance — Present / Absent</li>
                      <li><span className="check-icon">✓</span> Approved Paid Leave</li>
                      <li><span className="check-icon">✓</span> Approved Unpaid Leave / LOP</li>
                      <li><span className="check-icon">✓</span> Existing deductions</li>
                      <li><span className="check-icon">✓</span> Allowances / Bonus / Incentives</li>
                      <li><span className="check-icon">✓</span> Overtime</li>
                    </ul>
                  </div>

                  {/* Dynamic Payroll Preview / Summary Section */}
                  <div className="payroll-summary-box">
                    <div className="payroll-summary-title">Payroll Summary</div>
                    <div className="payroll-summary-grid">
                      <div className="payroll-summary-row">
                        <span>Employees to Process</span>
                        <strong>{targetEmployeesInScope.length}</strong>
                      </div>
                      <div className="payroll-summary-row">
                        <span>Payroll Period</span>
                        <strong>{formatMonthName(generatePeriod)}</strong>
                      </div>
                      <div className="payroll-summary-row">
                        <span>LOP Calculation</span>
                        <strong>Attendance + Approved Unpaid Leave</strong>
                      </div>
                      <div className="payroll-summary-row">
                        <span>Status</span>
                        <strong style={{ color: generateStatusInfo.color }}>{generateStatusInfo.label}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="hr-modal-footer">
                  <button
                    type="button"
                    className="hr-btn-secondary"
                    disabled={submitting}
                    onClick={() => setShowGenerateModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="payroll-primary-btn"
                    disabled={submitting || targetEmployeesInScope.length === 0 || pendingToGenerateCount === 0}
                  >
                    {submitting ? 'Generating...' : pendingToGenerateCount === 0 && targetEmployeesInScope.length > 0 ? 'Already Generated' : 'Generate Payroll'}
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
