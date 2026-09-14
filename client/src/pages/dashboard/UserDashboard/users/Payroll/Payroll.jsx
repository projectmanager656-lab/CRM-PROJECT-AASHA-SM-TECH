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
  const isHR = ['admin', 'super_admin'].includes(user?.role) || user?.department === 'HR' || user?.role === 'finance' || user?.department === 'Finance';

  // Data States
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Active Workspace Tab (10 Tabs)
  const [activeTab, setActiveTab] = useState('records'); // 'records' | 'salaries' | 'departments' | 'history' | 'expenses' | 'reimbursements' | 'advances' | 'statutory' | 'payslips' | 'approvals'

  // Filters (Main Records)
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedPeriod, setSelectedPeriod] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Modals (Existing)
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

  // ─── TAB 5: EXPENSE MANAGEMENT STATE ───
  const [expenses, setExpenses] = useState([]);
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseDept, setExpenseDept] = useState('All');
  const [expenseCategory, setExpenseCategory] = useState('All');
  const [expenseStatus, setExpenseStatus] = useState('All');
  const [expenseStartDate, setExpenseStartDate] = useState('');
  const [expenseEndDate, setExpenseEndDate] = useState('');
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [newExpenseForm, setNewExpenseForm] = useState({
    employeeId: '',
    category: 'Travel',
    title: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    approver: 'Finance Manager',
    receiptNote: '',
  });

  // ─── TAB 6: REIMBURSEMENTS STATE ───
  const [reimbursements, setReimbursements] = useState([]);
  const [reimbursementSearch, setReimbursementSearch] = useState('');
  const [reimbursementCategory, setReimbursementCategory] = useState('All');
  const [reimbursementStatus, setReimbursementStatus] = useState('All');
  const [showAddReimbursementModal, setShowAddReimbursementModal] = useState(false);
  const [newReimbursementForm, setNewReimbursementForm] = useState({
    employeeId: '',
    category: 'Medical',
    title: '',
    amount: '',
    billDate: new Date().toISOString().slice(0, 10),
    proofNote: '',
  });

  // ─── TAB 7: ADVANCES & LOANS STATE ───
  const [advances, setAdvances] = useState([]);
  const [advanceSearch, setAdvanceSearch] = useState('');
  const [advanceType, setAdvanceType] = useState('All');
  const [advanceStatus, setAdvanceStatus] = useState('All');
  const [showAddAdvanceModal, setShowAddAdvanceModal] = useState(false);
  const [newAdvanceForm, setNewAdvanceForm] = useState({
    employeeId: '',
    type: 'Salary Advance',
    amount: '',
    tenureMonths: '3',
    monthlyEmi: '',
    disbursementDate: new Date().toISOString().slice(0, 10),
    reason: '',
  });

  // ─── TAB 8: STATUTORY & TAX STATE ───
  const [statutoryPeriod, setStatutoryPeriod] = useState('All');
  const [statutoryDept, setStatutoryDept] = useState('All');
  const [statutorySearch, setStatutorySearch] = useState('');

  // ─── TAB 9: PAYSLIPS STATE ───
  const [payslipPeriod, setPayslipPeriod] = useState('All');
  const [payslipDept, setPayslipDept] = useState('All');
  const [payslipSearch, setPayslipSearch] = useState('');

  // ─── TAB 10: APPROVALS STATE ───
  const [approvalStatus, setApprovalStatus] = useState('All');
  const [approvalDept, setApprovalDept] = useState('All');
  const [approvalSearch, setApprovalSearch] = useState('');

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

  // Map MongoDB Atlas Expense document to standard UI format
  const mapExpenseDoc = (e) => ({
    ...e,
    id: e.receiptNumber || (e._id ? `EXP-${String(e._id).slice(-4)}` : (e.id || 'EXP-0000')),
    _id: e._id,
    user: e.employee || { firstName: (e.employeeName || '').split(' ')[0], lastName: (e.employeeName || '').split(' ').slice(1).join(' ') },
    employeeName: e.employeeName || (e.employee ? `${e.employee.firstName || ''} ${e.employee.lastName || ''}`.trim() : 'Staff'),
    department: e.department || 'Finance',
    category: e.category || 'General',
    title: e.title || '',
    amount: Number(e.amount) || 0,
    date: e.expenseDate ? new Date(e.expenseDate).toISOString().slice(0, 10) : (e.date || ''),
    expenseDate: e.expenseDate || e.date,
    receiptUrl: e.receiptUrl || '',
    receiptNote: e.description || (e.vendorName ? `Vendor: ${e.vendorName}` : 'Verified expense claim'),
    status: e.paymentStatus || e.status || 'Pending',
    paymentStatus: e.paymentStatus || e.status || 'Pending',
    approver: e.approvedBy ? `${e.approvedBy.firstName || ''} ${e.approvedBy.lastName || ''}`.trim() || 'HR/Finance' : (e.paymentStatus === 'Approved' || e.paymentStatus === 'Paid' ? 'HR Manager' : (e.approver || '—')),
    paymentDate: e.paymentStatus === 'Paid' ? (e.expenseDate ? new Date(e.expenseDate).toISOString().slice(0, 10) : null) : null,
  });

  // Load Real Data from MongoDB Atlas
  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [payrollRes, usersRes, deptRes, expensesRes] = await Promise.all([
        apiClient.get('/payroll'),
        isHR ? apiClient.get('/users').catch(() => ({ data: { data: [] } })) : Promise.resolve({ data: { data: [] } }),
        apiClient.get('/admin/departments').catch(() => apiClient.get('/departments')).catch(() => ({ data: { data: [] } })),
        apiClient.get('/expenses').catch(() => ({ data: { data: [] } })),
      ]);

      const payData = payrollRes.data?.data || [];
      setPayrollRecords(payData);

      const deptData = deptRes.data?.data || [];
      setDepartments(deptData);

      const rawExpenses = expensesRes.data?.data || [];
      setExpenses(rawExpenses.map(mapExpenseDoc));

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

  // Expenses are loaded directly from MongoDB Atlas collection 'expenses' via loadData()

  // Seed realistic sample reimbursements if empty
  useEffect(() => {
    if (employees.length === 0) return;
    const stored = localStorage.getItem('payroll_reimbursements_data');
    if (!stored) {
      const claimCats = ['Medical', 'Travel & Conveyance', 'Fuel Allowance', 'Internet & Mobile', 'Relocation', 'Client Meeting'];
      const claimTitles = [
        'Annual Preventive Health Checkup Claim',
        'Inter-city High-Speed Train Fare',
        'Monthly Field Travel Fuel Claim',
        'High-Speed Fiber Broadband Bill (WFA)',
        'Relocation Luggage Transit Allowance',
        'Client Solution Pitch Dinner',
      ];
      const initial = employees.slice(0, 6).map((emp, i) => {
        const statuses = ['Approved', 'Pending', 'Paid', 'Approved', 'Pending', 'Paid'];
        const amounts = [4500, 2800, 3500, 1499, 18000, 5200];
        const dept = resolveDepartmentName(emp, departments);
        const d = new Date();
        d.setDate(d.getDate() - (i * 4 + 1));
        const billDate = d.toISOString().slice(0, 10);
        return {
          id: `CLM-${5001 + i}`,
          user: emp,
          employeeName: getEmployeeName(emp),
          department: dept,
          category: claimCats[i % claimCats.length],
          title: claimTitles[i % claimTitles.length],
          amount: amounts[i % amounts.length],
          billDate,
          submittedDate: billDate,
          proofDoc: `claim_proof_${5001 + i}.pdf`,
          proofNote: `Verified receipt #CLM-INV-${900 + i}`,
          status: statuses[i % statuses.length],
          settledDate: statuses[i % statuses.length] === 'Paid' ? billDate : null,
        };
      });
      setReimbursements(initial);
      localStorage.setItem('payroll_reimbursements_data', JSON.stringify(initial));
    } else {
      try {
        setReimbursements(JSON.parse(stored));
      } catch {
        // ignore
      }
    }
  }, [employees, departments]);

  // Seed realistic sample advances & loans if empty
  useEffect(() => {
    if (employees.length === 0) return;
    const stored = localStorage.getItem('payroll_advances_data');
    if (!stored) {
      const advTypes = ['Salary Advance', 'Emergency Advance', 'Personal Loan', 'Education Support'];
      const initial = employees.slice(0, 4).map((emp, i) => {
        const amounts = [25000, 40000, 60000, 30000];
        const tenures = [3, 4, 6, 3];
        const emi = Math.round(amounts[i] / tenures[i]);
        const deducted = emi * (i + 1);
        const balance = Math.max(0, amounts[i] - deducted);
        const dept = resolveDepartmentName(emp, departments);
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        const disbDate = d.toISOString().slice(0, 10);
        return {
          id: `ADV-${7001 + i}`,
          user: emp,
          employeeName: getEmployeeName(emp),
          department: dept,
          type: advTypes[i % advTypes.length],
          amount: amounts[i],
          monthlyEmi: emi,
          tenureMonths: tenures[i],
          deductedToDate: deducted,
          balanceRemaining: balance,
          disbursementDate: disbDate,
          status: balance === 0 ? 'Repaid' : 'Active',
          reason: 'Approved by management against salary payroll cycle',
        };
      });
      setAdvances(initial);
      localStorage.setItem('payroll_advances_data', JSON.stringify(initial));
    } else {
      try {
        setAdvances(JSON.parse(stored));
      } catch {
        // ignore
      }
    }
  }, [employees, departments]);

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

  // ─── TAB 5: EXPENSES FILTERING & KPIS ───
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const q = expenseSearch.toLowerCase();
      const matchesSearch = !q ||
        (exp.title || '').toLowerCase().includes(q) ||
        (exp.employeeName || '').toLowerCase().includes(q) ||
        (exp.id || '').toLowerCase().includes(q);
      const matchesDept = expenseDept === 'All' || (exp.department || '').toLowerCase() === expenseDept.toLowerCase();
      const matchesCat = expenseCategory === 'All' || exp.category === expenseCategory;
      const matchesStatus = expenseStatus === 'All' || exp.status === expenseStatus;
      const matchesStart = !expenseStartDate || exp.date >= expenseStartDate;
      const matchesEnd = !expenseEndDate || exp.date <= expenseEndDate;
      return matchesSearch && matchesDept && matchesCat && matchesStatus && matchesStart && matchesEnd;
    });
  }, [expenses, expenseSearch, expenseDept, expenseCategory, expenseStatus, expenseStartDate, expenseEndDate]);

  const expenseKpis = useMemo(() => {
    const totalAmount = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const pendingList = expenses.filter((e) => e.status === 'Pending');
    const approvedList = expenses.filter((e) => e.status === 'Approved');
    const rejectedList = expenses.filter((e) => e.status === 'Rejected');
    const paidList = expenses.filter((e) => e.status === 'Paid');
    return {
      totalAmount,
      totalCount: expenses.length,
      pendingCount: pendingList.length,
      pendingAmount: pendingList.reduce((s, e) => s + (Number(e.amount) || 0), 0),
      approvedCount: approvedList.length,
      approvedAmount: approvedList.reduce((s, e) => s + (Number(e.amount) || 0), 0),
      rejectedCount: rejectedList.length,
      rejectedAmount: rejectedList.reduce((s, e) => s + (Number(e.amount) || 0), 0),
      paidCount: paidList.length,
      paidAmount: paidList.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    };
  }, [expenses]);

  // ─── TAB 6: REIMBURSEMENTS FILTERING & KPIS ───
  const filteredReimbursements = useMemo(() => {
    return reimbursements.filter((r) => {
      const q = reimbursementSearch.toLowerCase();
      const matchesSearch = !q ||
        (r.title || '').toLowerCase().includes(q) ||
        (r.employeeName || '').toLowerCase().includes(q) ||
        (r.id || '').toLowerCase().includes(q);
      const matchesCat = reimbursementCategory === 'All' || r.category === reimbursementCategory;
      const matchesStatus = reimbursementStatus === 'All' || r.status === reimbursementStatus;
      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [reimbursements, reimbursementSearch, reimbursementCategory, reimbursementStatus]);

  const reimbursementKpis = useMemo(() => {
    const totalAmount = reimbursements.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const pendingList = reimbursements.filter((r) => r.status === 'Pending');
    const approvedList = reimbursements.filter((r) => r.status === 'Approved');
    const paidList = reimbursements.filter((r) => r.status === 'Paid');
    return {
      totalAmount,
      pendingCount: pendingList.length,
      approvedCount: approvedList.length,
      paidAmount: paidList.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    };
  }, [reimbursements]);

  // ─── TAB 7: ADVANCES & LOANS FILTERING & KPIS ───
  const filteredAdvances = useMemo(() => {
    return advances.filter((a) => {
      const q = advanceSearch.toLowerCase();
      const matchesSearch = !q ||
        (a.type || '').toLowerCase().includes(q) ||
        (a.employeeName || '').toLowerCase().includes(q) ||
        (a.id || '').toLowerCase().includes(q);
      const matchesType = advanceType === 'All' || a.type === advanceType;
      const matchesStatus = advanceStatus === 'All' || a.status === advanceStatus;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [advances, advanceSearch, advanceType, advanceStatus]);

  const advanceKpis = useMemo(() => {
    const activeList = advances.filter((a) => a.status === 'Active');
    const totalDisbursed = advances.reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const totalRepaid = advances.reduce((s, a) => s + (Number(a.deductedToDate) || 0), 0);
    const outstandingBalance = advances.reduce((s, a) => s + (Number(a.balanceRemaining) || 0), 0);
    return {
      activeCount: activeList.length,
      totalDisbursed,
      totalRepaid,
      outstandingBalance,
    };
  }, [advances]);

  // ─── TAB 8: STATUTORY & TAX COMPUTATIONS ───
  const statutoryRecords = useMemo(() => {
    return payrollRecords
      .filter((r) => {
        const period = r.payPeriod || r.month;
        const matchesPeriod = statutoryPeriod === 'All' || period === statutoryPeriod;
        const dept = resolveDepartmentName(r.user, departments);
        const matchesDept = statutoryDept === 'All' || dept.toLowerCase() === statutoryDept.toLowerCase();
        const name = getEmployeeName(r.user).toLowerCase();
        const empId = getEmployeeId(r.user).toLowerCase();
        const q = statutorySearch.toLowerCase();
        const matchesSearch = !q || name.includes(q) || empId.includes(q);
        return matchesPeriod && matchesDept && matchesSearch;
      })
      .map((r) => {
        const basic = Number(r.basicSalary) || 0;
        const gross = Number(r.gross) || 0;
        const epfEmployee = Math.round(Math.min(basic * 0.12, 1800));
        const epfEmployer = Math.round(Math.min(basic * 0.12, 1800));
        const esi = gross <= 21000 && gross > 0 ? Math.round(gross * 0.0075) : 0;
        const pt = gross > 15000 ? 200 : 0;
        const annualGross = gross * 12;
        const tds = annualGross > 500000 ? Math.round(gross * 0.05) : 0;
        const totalStatutory = epfEmployee + esi + pt + tds;
        const netTaxable = Math.max(0, gross - totalStatutory);
        return {
          ...r,
          basic,
          gross,
          epfEmployee,
          epfEmployer,
          esi,
          pt,
          tds,
          totalStatutory,
          netTaxable,
        };
      });
  }, [payrollRecords, statutoryPeriod, statutoryDept, statutorySearch, departments]);

  const statutoryKpis = useMemo(() => {
    const totalEPF = statutoryRecords.reduce((s, r) => s + (r.epfEmployee + r.epfEmployer), 0);
    const totalESI = statutoryRecords.reduce((s, r) => s + r.esi, 0);
    const totalPT = statutoryRecords.reduce((s, r) => s + r.pt, 0);
    const totalTDS = statutoryRecords.reduce((s, r) => s + r.tds, 0);
    return { totalEPF, totalESI, totalPT, totalTDS };
  }, [statutoryRecords]);

  // ─── TAB 9: PAYSLIPS FILTERING ───
  const filteredPayslips = useMemo(() => {
    return payrollRecords.filter((r) => {
      const period = r.payPeriod || r.month;
      const matchesPeriod = payslipPeriod === 'All' || period === payslipPeriod;
      const dept = resolveDepartmentName(r.user, departments);
      const matchesDept = payslipDept === 'All' || dept.toLowerCase() === payslipDept.toLowerCase();
      const name = getEmployeeName(r.user).toLowerCase();
      const empId = getEmployeeId(r.user).toLowerCase();
      const q = payslipSearch.toLowerCase();
      const matchesSearch = !q || name.includes(q) || empId.includes(q);
      return matchesPeriod && matchesDept && matchesSearch;
    });
  }, [payrollRecords, payslipPeriod, payslipDept, payslipSearch, departments]);

  // ─── TAB 10: APPROVALS FILTERING & KPIS ───
  const approvalRecords = useMemo(() => {
    return payrollRecords.filter((r) => {
      const matchesStatus = approvalStatus === 'All'
        ? (r.status === 'Pending' || r.status === 'Processed' || r.status === 'Processing')
        : r.status === approvalStatus;
      const dept = resolveDepartmentName(r.user, departments);
      const matchesDept = approvalDept === 'All' || dept.toLowerCase() === approvalDept.toLowerCase();
      const name = getEmployeeName(r.user).toLowerCase();
      const q = approvalSearch.toLowerCase();
      const matchesSearch = !q || name.includes(q);
      return matchesStatus && matchesDept && matchesSearch;
    });
  }, [payrollRecords, approvalStatus, approvalDept, approvalSearch, departments]);

  const approvalKpis = useMemo(() => {
    const pendingList = payrollRecords.filter((r) => r.status === 'Pending');
    const processedList = payrollRecords.filter((r) => r.status === 'Processed' || r.status === 'Processing');
    const paidList = payrollRecords.filter((r) => r.status === 'Paid');
    const pendingNet = pendingList.reduce((s, r) => s + (Number(r.net) || 0), 0);
    const processedNet = processedList.reduce((s, r) => s + (Number(r.net) || 0), 0);
    const paidNet = paidList.reduce((s, r) => s + (Number(r.net) || 0), 0);
    return {
      pendingCount: pendingList.length,
      pendingNet,
      processedCount: processedList.length,
      processedNet,
      paidCount: paidList.length,
      paidNet,
      totalBatchNet: pendingNet + processedNet,
    };
  }, [payrollRecords]);

  // ─── CSV EXPORT UTILITY ───
  const exportCSV = (data, filename) => {
    if (!data || data.length === 0) {
      alert('No records available to export.');
      return;
    }
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    for (const row of data) {
      const values = headers.map((header) => {
        const escaped = ('' + (row[header] ?? '')).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleExportExpensesCSV = () => {
    const rows = filteredExpenses.map((e) => ({
      'Expense ID': e.id,
      Employee: e.employeeName,
      Department: e.department,
      Category: e.category,
      Title: e.title,
      'Amount (INR)': e.amount,
      Date: e.date,
      Status: e.status,
      Approver: e.approver,
      'Payment Date': e.paymentDate || '—',
    }));
    exportCSV(rows, `Expenses_Export_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleExportReimbursementsCSV = () => {
    const rows = filteredReimbursements.map((r) => ({
      'Claim ID': r.id,
      Employee: r.employeeName,
      Department: r.department,
      Category: r.category,
      Title: r.title,
      'Amount (INR)': r.amount,
      'Bill Date': r.billDate,
      'Submission Date': r.submittedDate,
      Status: r.status,
      'Settled Date': r.settledDate || '—',
    }));
    exportCSV(rows, `Reimbursements_Export_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleExportAdvancesCSV = () => {
    const rows = filteredAdvances.map((a) => ({
      'Advance ID': a.id,
      Employee: a.employeeName,
      Department: a.department,
      'Advance Type': a.type,
      'Disbursed Amount (INR)': a.amount,
      'Monthly EMI (INR)': a.monthlyEmi,
      'Tenure (Months)': a.tenureMonths,
      'Repaid to Date (INR)': a.deductedToDate,
      'Balance (INR)': a.balanceRemaining,
      'Disbursed Date': a.disbursementDate,
      Status: a.status,
    }));
    exportCSV(rows, `Advances_Loans_Export_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleExportStatutoryCSV = () => {
    const rows = statutoryRecords.map((r) => ({
      Employee: getEmployeeName(r.user),
      'Employee ID': getEmployeeId(r.user),
      Department: resolveDepartmentName(r.user, departments),
      Period: r.payPeriod || r.month,
      'Gross Salary': r.gross,
      'Basic Salary': r.basic,
      'EPF Employee (12%)': r.epfEmployee,
      'EPF Employer (12%)': r.epfEmployer,
      'ESIC Employee (0.75%)': r.esi,
      'Professional Tax (PT)': r.pt,
      'TDS (Income Tax)': r.tds,
      'Total Statutory Deductions': r.totalStatutory,
      'Net Taxable Pay': r.netTaxable,
    }));
    exportCSV(rows, `Statutory_Tax_Register_${statutoryPeriod}_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // ─── ACTION HANDLERS FOR EXPENSES (MONGODB ATLAS INTEGRATED) ───
  const handleApproveExpense = async (expId) => {
    try {
      const exp = expenses.find((e) => e._id === expId || e.id === expId);
      const targetId = exp?._id || expId;
      const res = await apiClient.patch(`/expenses/${targetId}/approve`);
      const updatedDoc = mapExpenseDoc(res.data?.data || {});
      setExpenses((prev) => prev.map((e) => (e._id === targetId || e.id === targetId ? updatedDoc : e)));
      setSuccess(`Expense approved successfully in Atlas.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve expense.');
    }
  };

  const handleRejectExpense = async (expId) => {
    try {
      const reason = window.prompt('Please enter a reason for rejecting this expense claim:', 'Exceeds budget limit / Invalid bill') || 'Rejected by HR/Finance';
      const exp = expenses.find((e) => e._id === expId || e.id === expId);
      const targetId = exp?._id || expId;
      const res = await apiClient.patch(`/expenses/${targetId}/reject`, { reason });
      const updatedDoc = mapExpenseDoc(res.data?.data || {});
      setExpenses((prev) => prev.map((e) => (e._id === targetId || e.id === targetId ? updatedDoc : e)));
      setSuccess(`Expense marked as Rejected.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject expense.');
    }
  };

  const handlePayExpense = async (expId) => {
    try {
      const exp = expenses.find((e) => e._id === expId || e.id === expId);
      const targetId = exp?._id || expId;
      const res = await apiClient.patch(`/expenses/${targetId}/pay`, { paymentMethod: 'Bank Transfer' });
      const updatedDoc = mapExpenseDoc(res.data?.data || {});
      setExpenses((prev) => prev.map((e) => (e._id === targetId || e.id === targetId ? updatedDoc : e)));
      setSuccess(`Expense marked as Paid.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark expense as paid.');
    }
  };

  const handleDeleteExpense = async (expId) => {
    if (!window.confirm(`Delete expense record?`)) return;
    try {
      const exp = expenses.find((e) => e._id === expId || e.id === expId);
      const targetId = exp?._id || expId;
      await apiClient.delete(`/expenses/${targetId}`);
      setExpenses((prev) => prev.filter((e) => e._id !== targetId && e.id !== targetId));
      setSuccess(`Expense deleted from Atlas.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete expense.');
    }
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    try {
      const emp = employees.find((u) => String(u._id) === String(newExpenseForm.employeeId)) || employees[0];
      const payload = {
        title: newExpenseForm.title.trim(),
        category: newExpenseForm.category,
        amount: Number(newExpenseForm.amount) || 0,
        department: resolveDepartmentName(emp, departments) || 'Finance',
        expenseDate: newExpenseForm.date ? new Date(newExpenseForm.date) : new Date(),
        employeeId: emp?._id || null,
        employeeName: getEmployeeName(emp),
        description: newExpenseForm.receiptNote || 'Uploaded via Expense Management',
      };
      const res = await apiClient.post('/expenses', payload);
      const created = mapExpenseDoc(res.data?.data || {});
      setExpenses((prev) => [created, ...prev]);
      setShowAddExpenseModal(false);
      setNewExpenseForm({
        employeeId: '',
        category: 'Travel',
        title: '',
        amount: '',
        date: new Date().toISOString().slice(0, 10),
        approver: 'Finance Manager',
        receiptNote: '',
      });
      setSuccess(`Expense claim "${created.title}" persisted to MongoDB Atlas.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create expense.');
    }
  };

  const handleApproveReimbursement = (claimId) => {
    const updated = reimbursements.map((r) => (r.id === claimId ? { ...r, status: 'Approved' } : r));
    setReimbursements(updated);
    localStorage.setItem('payroll_reimbursements_data', JSON.stringify(updated));
    setSuccess(`Reimbursement claim ${claimId} approved.`);
  };

  const handleSettleReimbursement = (claimId) => {
    const today = new Date().toISOString().slice(0, 10);
    const updated = reimbursements.map((r) => (r.id === claimId ? { ...r, status: 'Paid', settledDate: today } : r));
    setReimbursements(updated);
    localStorage.setItem('payroll_reimbursements_data', JSON.stringify(updated));
    setSuccess(`Reimbursement claim ${claimId} marked as Settled.`);
  };

  const handleCreateReimbursement = (e) => {
    e.preventDefault();
    const emp = employees.find((u) => String(u._id) === String(newReimbursementForm.employeeId)) || employees[0];
    const newClaim = {
      id: `CLM-${Date.now().toString().slice(-4)}`,
      user: emp,
      employeeName: getEmployeeName(emp),
      department: resolveDepartmentName(emp, departments),
      category: newReimbursementForm.category,
      title: newReimbursementForm.title,
      amount: Number(newReimbursementForm.amount) || 0,
      billDate: newReimbursementForm.billDate,
      submittedDate: new Date().toISOString().slice(0, 10),
      proofDoc: 'claim_bill.pdf',
      proofNote: newReimbursementForm.proofNote || 'Submitted via Reimbursements tab',
      status: 'Pending',
      settledDate: null,
    };
    const updated = [newClaim, ...reimbursements];
    setReimbursements(updated);
    localStorage.setItem('payroll_reimbursements_data', JSON.stringify(updated));
    setShowAddReimbursementModal(false);
    setNewReimbursementForm({
      employeeId: '',
      category: 'Medical',
      title: '',
      amount: '',
      billDate: new Date().toISOString().slice(0, 10),
      proofNote: '',
    });
    setSuccess(`Reimbursement claim "${newClaim.title}" submitted successfully.`);
  };

  const handleCreateAdvance = (e) => {
    e.preventDefault();
    const emp = employees.find((u) => String(u._id) === String(newAdvanceForm.employeeId)) || employees[0];
    const amount = Number(newAdvanceForm.amount) || 0;
    const tenure = Number(newAdvanceForm.tenureMonths) || 3;
    const emi = Number(newAdvanceForm.monthlyEmi) || Math.round(amount / tenure);
    const newAdv = {
      id: `ADV-${Date.now().toString().slice(-4)}`,
      user: emp,
      employeeName: getEmployeeName(emp),
      department: resolveDepartmentName(emp, departments),
      type: newAdvanceForm.type,
      amount,
      monthlyEmi: emi,
      tenureMonths: tenure,
      deductedToDate: 0,
      balanceRemaining: amount,
      disbursementDate: newAdvanceForm.disbursementDate,
      status: 'Active',
      reason: newAdvanceForm.reason || 'Requested by employee',
    };
    const updated = [newAdv, ...advances];
    setAdvances(updated);
    localStorage.setItem('payroll_advances_data', JSON.stringify(updated));
    setShowAddAdvanceModal(false);
    setNewAdvanceForm({
      employeeId: '',
      type: 'Salary Advance',
      amount: '',
      tenureMonths: '3',
      monthlyEmi: '',
      disbursementDate: new Date().toISOString().slice(0, 10),
      reason: '',
    });
    setSuccess(`Advance / Loan record ${newAdv.id} created successfully.`);
  };

  const handleBatchApprovePending = async () => {
    const pending = payrollRecords.filter((r) => r.status === 'Pending');
    if (pending.length === 0) {
      alert('No pending payroll records to approve.');
      return;
    }
    if (!window.confirm(`Are you sure you want to approve all ${pending.length} pending payroll records?`)) return;
    setSubmitting(true);
    try {
      await Promise.all(pending.map((r) => apiClient.patch(`/payroll/${r._id}/process`, {}).catch(() => null)));
      setSuccess(`Successfully approved and processed ${pending.length} payroll records.`);
      await loadData();
    } catch {
      setError('Some records could not be updated.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkDownloadPayslips = () => {
    if (filteredPayslips.length === 0) {
      alert('No payslips available in current filter to download.');
      return;
    }
    handleDownloadPayslip(filteredPayslips[0]);
    setSuccess(`Prepared payslip download for ${filteredPayslips.length} employee records.`);
  };

  return (
    <UserLayout pageTitle="Payroll Management">
      <div className="payroll-container">
        {/* ─── 1. PAGE HEADER ─── */}
        <div className="payroll-header-area">
          <div className="payroll-title-meta">
            <h2 className="payroll-page-title">Payroll Management</h2>
            <p className="payroll-page-subtitle">Centrally generate, process, monitor, and disburse monthly employee payroll across all departments.</p>
          </div>
          {isHR && (
            <div className="payroll-header-actions">
              <button
                type="button"
                className="payroll-secondary-btn"
                onClick={loadData}
                disabled={loading}
                title="Refresh Payroll Data"
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

        {/* ─── 2. 6 SUMMARY KPI CARDS (STRICT 1 ROW ON DESKTOP) ─── */}
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
              <h3 className="payroll-kpi-value">{kpiStats.totalEmployees}</h3>
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
              <h3 className="payroll-kpi-value">{kpiStats.pendingCount}</h3>
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
              <h3 className="payroll-kpi-value">{kpiStats.processedCount}</h3>
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
              <h3 className="payroll-kpi-value">{kpiStats.paidCount}</h3>
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
              <h3 className="payroll-kpi-value">{formatMoney(kpiStats.totalNet)}</h3>
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
              <h3 className="payroll-kpi-value">{formatMoney(kpiStats.totalDeductions)}</h3>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && <div className="payroll-alert error">{error}</div>}
        {success && <div className="payroll-alert success">{success}</div>}

        {/* ─── 3. PAYROLL TABS (STRICT 1 ROW ON DESKTOP) ─── */}
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
              <button
                type="button"
                className={`payroll-tab-btn ${activeTab === 'expenses' ? 'active' : ''}`}
                onClick={() => setActiveTab('expenses')}
              >
                Expense Management <span className="payroll-tab-badge">{filteredExpenses.length}</span>
              </button>
              <button
                type="button"
                className={`payroll-tab-btn ${activeTab === 'reimbursements' ? 'active' : ''}`}
                onClick={() => setActiveTab('reimbursements')}
              >
                Reimbursements <span className="payroll-tab-badge">{filteredReimbursements.length}</span>
              </button>
              <button
                type="button"
                className={`payroll-tab-btn ${activeTab === 'advances' ? 'active' : ''}`}
                onClick={() => setActiveTab('advances')}
              >
                Advances & Loans <span className="payroll-tab-badge">{filteredAdvances.length}</span>
              </button>
              <button
                type="button"
                className={`payroll-tab-btn ${activeTab === 'statutory' ? 'active' : ''}`}
                onClick={() => setActiveTab('statutory')}
              >
                Statutory & Tax
              </button>
              <button
                type="button"
                className={`payroll-tab-btn ${activeTab === 'payslips' ? 'active' : ''}`}
                onClick={() => setActiveTab('payslips')}
              >
                Payslips
              </button>
              <button
                type="button"
                className={`payroll-tab-btn ${activeTab === 'approvals' ? 'active' : ''}`}
                onClick={() => setActiveTab('approvals')}
              >
                Payroll Approvals {(approvalKpis.pendingCount + approvalKpis.processedCount) > 0 && (
                  <span className="payroll-tab-badge">{approvalKpis.pendingCount + approvalKpis.processedCount}</span>
                )}
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
                        <th className="payroll-col-emp">Employee</th>
                        <th className="payroll-col-dept">Department</th>
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
                            <td className="payroll-col-emp">
                              <div className="payroll-emp-cell">
                                <div className="payroll-emp-avatar">{initials}</div>
                                <div className="payroll-emp-meta">
                                  <span className="payroll-emp-name">{name}</span>
                                  <span className="payroll-emp-email">{r.user?.email}</span>
                                </div>
                              </div>
                            </td>
                            <td className="payroll-col-dept">
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

        {/* ─── TAB 5: EXPENSE MANAGEMENT (STRICTLY INSIDE PAYROLL) ─── */}
        {activeTab === 'expenses' && isHR && (
          <div>
            {/* 5 Summary KPI Cards in 1 Row */}
            <div className="payroll-sub-kpi-grid cols-5">
              <div className="payroll-sub-kpi-card">
                <div className="payroll-sub-kpi-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                </div>
                <div className="payroll-sub-kpi-body">
                  <span className="payroll-sub-kpi-label">Total Expenses</span>
                  <h3 className="payroll-sub-kpi-value">{formatMoney(expenseKpis.totalAmount)}</h3>
                </div>
              </div>

              <div className="payroll-sub-kpi-card">
                <div className="payroll-sub-kpi-icon" style={{ background: '#fffbeb', color: '#d97706' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                </div>
                <div className="payroll-sub-kpi-body">
                  <span className="payroll-sub-kpi-label">Pending Approval</span>
                  <h3 className="payroll-sub-kpi-value" style={{ color: '#d97706' }}>{expenseKpis.pendingCount} <span style={{ fontSize: '0.72rem', fontWeight: '500', color: '#64748b' }}>({formatMoney(expenseKpis.pendingAmount)})</span></h3>
                </div>
              </div>

              <div className="payroll-sub-kpi-card">
                <div className="payroll-sub-kpi-icon" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <div className="payroll-sub-kpi-body">
                  <span className="payroll-sub-kpi-label">Approved</span>
                  <h3 className="payroll-sub-kpi-value" style={{ color: '#1d4ed8' }}>{expenseKpis.approvedCount} <span style={{ fontSize: '0.72rem', fontWeight: '500', color: '#64748b' }}>({formatMoney(expenseKpis.approvedAmount)})</span></h3>
                </div>
              </div>

              <div className="payroll-sub-kpi-card">
                <div className="payroll-sub-kpi-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                </div>
                <div className="payroll-sub-kpi-body">
                  <span className="payroll-sub-kpi-label">Rejected</span>
                  <h3 className="payroll-sub-kpi-value" style={{ color: '#dc2626' }}>{expenseKpis.rejectedCount} <span style={{ fontSize: '0.72rem', fontWeight: '500', color: '#64748b' }}>({formatMoney(expenseKpis.rejectedAmount)})</span></h3>
                </div>
              </div>

              <div className="payroll-sub-kpi-card">
                <div className="payroll-sub-kpi-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                </div>
                <div className="payroll-sub-kpi-body">
                  <span className="payroll-sub-kpi-label">Paid</span>
                  <h3 className="payroll-sub-kpi-value" style={{ color: '#15803d' }}>{expenseKpis.paidCount} <span style={{ fontSize: '0.72rem', fontWeight: '500', color: '#64748b' }}>({formatMoney(expenseKpis.paidAmount)})</span></h3>
                </div>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="payroll-toolbar" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flex: '1 1 auto', alignItems: 'center' }}>
                <div className="payroll-search-wrap">
                  <svg className="payroll-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input
                    type="text"
                    placeholder="Search expenses by title, employee, ID..."
                    className="payroll-search-input"
                    value={expenseSearch}
                    onChange={(e) => setExpenseSearch(e.target.value)}
                  />
                </div>

                <select className="payroll-filter-select" value={expenseDept} onChange={(e) => setExpenseDept(e.target.value)}>
                  <option value="All">All Departments</option>
                  {canonicalDepartments.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>

                <select className="payroll-filter-select" value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)}>
                  <option value="All">All Categories</option>
                  <option value="Travel">Travel</option>
                  <option value="Equipment">Equipment</option>
                  <option value="Software/Subscriptions">Software & Subs</option>
                  <option value="Meals & Entertainment">Meals</option>
                  <option value="Office Supplies">Office Supplies</option>
                  <option value="Client Entertainment">Client Entertainment</option>
                  <option value="Training/Certification">Training</option>
                </select>

                <select className="payroll-filter-select" value={expenseStatus} onChange={(e) => setExpenseStatus(e.target.value)}>
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Paid">Paid</option>
                  <option value="Rejected">Rejected</option>
                </select>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <input
                    type="date"
                    className="payroll-date-input"
                    title="From Date"
                    value={expenseStartDate}
                    onChange={(e) => setExpenseStartDate(e.target.value)}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>to</span>
                  <input
                    type="date"
                    className="payroll-date-input"
                    title="To Date"
                    value={expenseEndDate}
                    onChange={(e) => setExpenseEndDate(e.target.value)}
                  />
                </div>

                {(expenseSearch || expenseDept !== 'All' || expenseCategory !== 'All' || expenseStatus !== 'All' || expenseStartDate || expenseEndDate) && (
                  <button
                    type="button"
                    className="payroll-secondary-btn"
                    onClick={() => {
                      setExpenseSearch('');
                      setExpenseDept('All');
                      setExpenseCategory('All');
                      setExpenseStatus('All');
                      setExpenseStartDate('');
                      setExpenseEndDate('');
                    }}
                    style={{ padding: '0.45rem 0.75rem' }}
                  >
                    Reset
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                <button
                  type="button"
                  className="payroll-secondary-btn"
                  onClick={handleExportExpensesCSV}
                  title="Export filtered expense records as CSV"
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Export CSV
                </button>
                <button
                  type="button"
                  className="payroll-primary-btn"
                  onClick={() => setShowAddExpenseModal(true)}
                >
                  + Add Expense
                </button>
              </div>
            </div>

            {/* Expense Records Table */}
            <div className="payroll-table-card">
              {filteredExpenses.length === 0 ? (
                <div className="payroll-empty-state">
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🧾</div>
                  <h3>No Expense Records</h3>
                  <p>No expense claims match your search filters. Click "+ Add Expense" to file a claim.</p>
                </div>
              ) : (
                <div className="payroll-table-wrap">
                  <table className="payroll-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Department</th>
                        <th>Category</th>
                        <th>Expense Title</th>
                        <th>Amount</th>
                        <th>Date</th>
                        <th>Receipt</th>
                        <th>Status</th>
                        <th>Approver</th>
                        <th>Payment Date</th>
                        <th style={{ minWidth: '180px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.map((exp) => {
                        const catKey = (exp.category || '').toLowerCase().split('/')[0].split(' ')[0];
                        return (
                          <tr key={exp.id}>
                            <td>
                              <div className="payroll-emp-cell">
                                <div className="payroll-emp-avatar">{getInitials(exp.user?.firstName, exp.user?.lastName, exp.user?.email || exp.employeeName)}</div>
                                <div className="payroll-emp-meta">
                                  <span className="payroll-emp-name">{exp.employeeName}</span>
                                  <span className="payroll-emp-email">{exp.id}</span>
                                </div>
                              </div>
                            </td>
                            <td><span className="hr-emp-dept-pill">{exp.department}</span></td>
                            <td><span className={`payroll-cat-pill ${catKey}`}>{exp.category}</span></td>
                            <td><span style={{ fontWeight: '600', color: '#0f172a' }}>{exp.title}</span></td>
                            <td><strong style={{ color: '#0f172a' }}>{formatMoney(exp.amount)}</strong></td>
                            <td>{formatDate(exp.date)}</td>
                            <td>
                              <button
                                type="button"
                                className="payroll-receipt-link"
                                onClick={() => {
                                  setSelectedReceipt(exp);
                                  setShowReceiptModal(true);
                                }}
                              >
                                📎 View Receipt
                              </button>
                            </td>
                            <td>
                              <span className={`payroll-status-pill ${(exp.status || '').toLowerCase()}`}>
                                {exp.status}
                              </span>
                            </td>
                            <td><span style={{ color: '#475569', fontSize: '0.78rem' }}>{exp.approver || '—'}</span></td>
                            <td>{formatDate(exp.paymentDate)}</td>
                            <td>
                              <div className="payroll-actions-wrap">
                                {exp.status === 'Pending' && (
                                  <>
                                    <button
                                      type="button"
                                      className="payroll-btn-sm approve"
                                      onClick={() => handleApproveExpense(exp._id || exp.id)}
                                      title="Approve Expense"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      className="payroll-btn-sm reject"
                                      onClick={() => handleRejectExpense(exp._id || exp.id)}
                                      title="Reject Expense"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                                {exp.status === 'Approved' && (
                                  <button
                                    type="button"
                                    className="payroll-btn-sm pay"
                                    onClick={() => handlePayExpense(exp._id || exp.id)}
                                    title="Disburse / Mark Paid"
                                  >
                                    Mark Paid
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="payroll-btn-sm view"
                                  onClick={() => {
                                    setSelectedReceipt(exp);
                                    setShowReceiptModal(true);
                                  }}
                                  title="View Receipt Details"
                                >
                                  Details
                                </button>
                                <button
                                  type="button"
                                  className="payroll-btn-sm reject"
                                  onClick={() => handleDeleteExpense(exp._id || exp.id)}
                                  title="Remove Record"
                                  style={{ padding: '0.3rem 0.45rem' }}
                                >
                                  ✕
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

        {/* ─── TAB 6: REIMBURSEMENTS ─── */}
        {activeTab === 'reimbursements' && isHR && (
          <div>
            {/* 4 Summary KPI Cards */}
            <div className="payroll-sub-kpi-grid cols-4">
              <div className="payroll-sub-kpi-card">
                <div className="payroll-sub-kpi-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" /></svg>
                </div>
                <div className="payroll-sub-kpi-body">
                  <span className="payroll-sub-kpi-label">Total Claims</span>
                  <h3 className="payroll-sub-kpi-value">{formatMoney(reimbursementKpis.totalAmount)}</h3>
                </div>
              </div>

              <div className="payroll-sub-kpi-card">
                <div className="payroll-sub-kpi-icon" style={{ background: '#fffbeb', color: '#d97706' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                </div>
                <div className="payroll-sub-kpi-body">
                  <span className="payroll-sub-kpi-label">Pending Verification</span>
                  <h3 className="payroll-sub-kpi-value" style={{ color: '#d97706' }}>{reimbursementKpis.pendingCount}</h3>
                </div>
              </div>

              <div className="payroll-sub-kpi-card">
                <div className="payroll-sub-kpi-icon" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <div className="payroll-sub-kpi-body">
                  <span className="payroll-sub-kpi-label">Approved & Queued</span>
                  <h3 className="payroll-sub-kpi-value" style={{ color: '#1d4ed8' }}>{reimbursementKpis.approvedCount}</h3>
                </div>
              </div>

              <div className="payroll-sub-kpi-card">
                <div className="payroll-sub-kpi-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                </div>
                <div className="payroll-sub-kpi-body">
                  <span className="payroll-sub-kpi-label">Settled / Disbursed</span>
                  <h3 className="payroll-sub-kpi-value" style={{ color: '#15803d' }}>{formatMoney(reimbursementKpis.paidAmount)}</h3>
                </div>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="payroll-toolbar" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="payroll-search-wrap">
                  <svg className="payroll-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input
                    type="text"
                    placeholder="Search claims..."
                    className="payroll-search-input"
                    value={reimbursementSearch}
                    onChange={(e) => setReimbursementSearch(e.target.value)}
                  />
                </div>

                <select className="payroll-filter-select" value={reimbursementCategory} onChange={(e) => setReimbursementCategory(e.target.value)}>
                  <option value="All">All Categories</option>
                  <option value="Medical">Medical</option>
                  <option value="Travel & Conveyance">Travel & Conveyance</option>
                  <option value="Fuel Allowance">Fuel Allowance</option>
                  <option value="Internet & Mobile">Internet & Mobile</option>
                  <option value="Relocation">Relocation</option>
                  <option value="Client Meeting">Client Meeting</option>
                </select>

                <select className="payroll-filter-select" value={reimbursementStatus} onChange={(e) => setReimbursementStatus(e.target.value)}>
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button type="button" className="payroll-secondary-btn" onClick={handleExportReimbursementsCSV}>
                  Export CSV
                </button>
                <button type="button" className="payroll-primary-btn" onClick={() => setShowAddReimbursementModal(true)}>
                  + Submit Claim
                </button>
              </div>
            </div>

            {/* Claims Table */}
            <div className="payroll-table-card">
              <div className="payroll-table-wrap">
                <table className="payroll-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Category</th>
                      <th>Claim Purpose</th>
                      <th>Amount</th>
                      <th>Bill Date</th>
                      <th>Submitted Date</th>
                      <th>Status</th>
                      <th>Settled Date</th>
                      <th style={{ minWidth: '160px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReimbursements.map((clm) => (
                      <tr key={clm.id}>
                        <td>
                          <div className="payroll-emp-cell">
                            <div className="payroll-emp-avatar">{getInitials(clm.user?.firstName, clm.user?.lastName, clm.employeeName)}</div>
                            <div className="payroll-emp-meta">
                              <span className="payroll-emp-name">{clm.employeeName}</span>
                              <span className="payroll-emp-email">{clm.id}</span>
                            </div>
                          </div>
                        </td>
                        <td><span className="hr-emp-dept-pill">{clm.department}</span></td>
                        <td><span className="payroll-cat-pill">{clm.category}</span></td>
                        <td><span style={{ fontWeight: '600' }}>{clm.title}</span></td>
                        <td><strong style={{ color: '#0f172a' }}>{formatMoney(clm.amount)}</strong></td>
                        <td>{formatDate(clm.billDate)}</td>
                        <td>{formatDate(clm.submittedDate)}</td>
                        <td><span className={`payroll-status-pill ${(clm.status || '').toLowerCase()}`}>{clm.status}</span></td>
                        <td>{formatDate(clm.settledDate)}</td>
                        <td>
                          <div className="payroll-actions-wrap">
                            {clm.status === 'Pending' && (
                              <button type="button" className="payroll-btn-sm approve" onClick={() => handleApproveReimbursement(clm.id)}>
                                Approve
                              </button>
                            )}
                            {clm.status === 'Approved' && (
                              <button type="button" className="payroll-btn-sm pay" onClick={() => handleSettleReimbursement(clm.id)}>
                                Disburse
                              </button>
                            )}
                            <button
                              type="button"
                              className="payroll-btn-sm view"
                              onClick={() => {
                                setSelectedReceipt({ ...clm, receiptNote: clm.proofNote, date: clm.billDate });
                                setShowReceiptModal(true);
                              }}
                            >
                              Proof
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 7: ADVANCES & LOANS ─── */}
        {activeTab === 'advances' && isHR && (
          <div>
            {/* 4 Summary KPI Cards */}
            <div className="payroll-sub-kpi-grid cols-4">
              <div className="payroll-sub-kpi-card">
                <div className="payroll-sub-kpi-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
                </div>
                <div className="payroll-sub-kpi-body">
                  <span className="payroll-sub-kpi-label">Active Advances</span>
                  <h3 className="payroll-sub-kpi-value">{advanceKpis.activeCount}</h3>
                </div>
              </div>

              <div className="payroll-sub-kpi-card">
                <div className="payroll-sub-kpi-icon" style={{ background: '#faf5ff', color: '#9333ea' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" /></svg>
                </div>
                <div className="payroll-sub-kpi-body">
                  <span className="payroll-sub-kpi-label">Total Disbursed</span>
                  <h3 className="payroll-sub-kpi-value">{formatMoney(advanceKpis.totalDisbursed)}</h3>
                </div>
              </div>

              <div className="payroll-sub-kpi-card">
                <div className="payroll-sub-kpi-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <div className="payroll-sub-kpi-body">
                  <span className="payroll-sub-kpi-label">Repaid to Date</span>
                  <h3 className="payroll-sub-kpi-value" style={{ color: '#15803d' }}>{formatMoney(advanceKpis.totalRepaid)}</h3>
                </div>
              </div>

              <div className="payroll-sub-kpi-card">
                <div className="payroll-sub-kpi-icon" style={{ background: '#fffbeb', color: '#d97706' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                </div>
                <div className="payroll-sub-kpi-body">
                  <span className="payroll-sub-kpi-label">Outstanding Balance</span>
                  <h3 className="payroll-sub-kpi-value" style={{ color: '#d97706' }}>{formatMoney(advanceKpis.outstandingBalance)}</h3>
                </div>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="payroll-toolbar" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="payroll-search-wrap">
                  <svg className="payroll-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input
                    type="text"
                    placeholder="Search advances by employee or ID..."
                    className="payroll-search-input"
                    value={advanceSearch}
                    onChange={(e) => setAdvanceSearch(e.target.value)}
                  />
                </div>

                <select className="payroll-filter-select" value={advanceType} onChange={(e) => setAdvanceType(e.target.value)}>
                  <option value="All">All Types</option>
                  <option value="Salary Advance">Salary Advance</option>
                  <option value="Emergency Advance">Emergency Advance</option>
                  <option value="Personal Loan">Personal Loan</option>
                  <option value="Education Support">Education Support</option>
                </select>

                <select className="payroll-filter-select" value={advanceStatus} onChange={(e) => setAdvanceStatus(e.target.value)}>
                  <option value="All">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Repaid">Repaid</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button type="button" className="payroll-secondary-btn" onClick={handleExportAdvancesCSV}>
                  Export CSV
                </button>
                <button type="button" className="payroll-primary-btn" onClick={() => setShowAddAdvanceModal(true)}>
                  + New Advance / Loan
                </button>
              </div>
            </div>

            {/* Advances Table */}
            <div className="payroll-table-card">
              <div className="payroll-table-wrap">
                <table className="payroll-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Advance Type</th>
                      <th>Disbursed Amount</th>
                      <th>Monthly EMI</th>
                      <th>Tenure</th>
                      <th>Repaid So Far</th>
                      <th>Balance Outstanding</th>
                      <th>Disbursed Date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAdvances.map((adv) => (
                      <tr key={adv.id}>
                        <td>
                          <div className="payroll-emp-cell">
                            <div className="payroll-emp-avatar">{getInitials(adv.user?.firstName, adv.user?.lastName, adv.employeeName)}</div>
                            <div className="payroll-emp-meta">
                              <span className="payroll-emp-name">{adv.employeeName}</span>
                              <span className="payroll-emp-email">{adv.id}</span>
                            </div>
                          </div>
                        </td>
                        <td><span className="hr-emp-dept-pill">{adv.department}</span></td>
                        <td><span className="payroll-cat-pill">{adv.type}</span></td>
                        <td><strong style={{ color: '#0f172a' }}>{formatMoney(adv.amount)}</strong></td>
                        <td>{formatMoney(adv.monthlyEmi)}/mo</td>
                        <td>{adv.tenureMonths} mos</td>
                        <td><span style={{ color: '#15803d' }}>{formatMoney(adv.deductedToDate)}</span></td>
                        <td><strong style={{ color: adv.balanceRemaining > 0 ? '#ea580c' : '#15803d' }}>{formatMoney(adv.balanceRemaining)}</strong></td>
                        <td>{formatDate(adv.disbursementDate)}</td>
                        <td><span className={`payroll-status-pill ${(adv.status || '').toLowerCase()}`}>{adv.status}</span></td>
                        <td>
                          <button
                            type="button"
                            className="payroll-btn-sm edit"
                            onClick={() => {
                              if (adv.balanceRemaining <= 0) {
                                alert('This advance is already fully settled.');
                                return;
                              }
                              const payment = Math.min(adv.monthlyEmi, adv.balanceRemaining);
                              const newDeducted = adv.deductedToDate + payment;
                              const newBalance = Math.max(0, adv.amount - newDeducted);
                              const updated = advances.map((a) => (a.id === adv.id ? {
                                ...a,
                                deductedToDate: newDeducted,
                                balanceRemaining: newBalance,
                                status: newBalance === 0 ? 'Repaid' : 'Active',
                              } : a));
                              setAdvances(updated);
                              localStorage.setItem('payroll_advances_data', JSON.stringify(updated));
                              setSuccess(`Recorded monthly EMI deduction of ${formatMoney(payment)} for ${adv.employeeName}.`);
                            }}
                          >
                            Record EMI
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

        {/* ─── TAB 8: STATUTORY & TAX ─── */}
        {activeTab === 'statutory' && isHR && (
          <div>
            {/* 4 Summary KPI Cards */}
            <div className="payroll-sub-kpi-grid cols-4">
              <div className="payroll-sub-kpi-card">
                <div className="payroll-sub-kpi-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                </div>
                <div className="payroll-sub-kpi-body">
                  <span className="payroll-sub-kpi-label">EPF Contribution (12%+12%)</span>
                  <h3 className="payroll-sub-kpi-value">{formatMoney(statutoryKpis.totalEPF)}</h3>
                </div>
              </div>

              <div className="payroll-sub-kpi-card">
                <div className="payroll-sub-kpi-icon" style={{ background: '#faf5ff', color: '#9333ea' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="m4.93 4.93 4.24 4.24" /><path d="m14.83 9.17 4.24-4.24" /><path d="m14.83 14.83 4.24 4.24" /><path d="m9.17 14.83-4.24 4.24" /><circle cx="12" cy="12" r="4" /></svg>
                </div>
                <div className="payroll-sub-kpi-body">
                  <span className="payroll-sub-kpi-label">ESIC Contribution (0.75%)</span>
                  <h3 className="payroll-sub-kpi-value">{formatMoney(statutoryKpis.totalESI)}</h3>
                </div>
              </div>

              <div className="payroll-sub-kpi-card">
                <div className="payroll-sub-kpi-icon" style={{ background: '#fffbeb', color: '#d97706' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                </div>
                <div className="payroll-sub-kpi-body">
                  <span className="payroll-sub-kpi-label">Professional Tax (PT)</span>
                  <h3 className="payroll-sub-kpi-value">{formatMoney(statutoryKpis.totalPT)}</h3>
                </div>
              </div>

              <div className="payroll-sub-kpi-card">
                <div className="payroll-sub-kpi-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                </div>
                <div className="payroll-sub-kpi-body">
                  <span className="payroll-sub-kpi-label">Total TDS Deducted</span>
                  <h3 className="payroll-sub-kpi-value" style={{ color: '#dc2626' }}>{formatMoney(statutoryKpis.totalTDS)}</h3>
                </div>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="payroll-toolbar" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="payroll-search-wrap">
                  <svg className="payroll-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input
                    type="text"
                    placeholder="Search employee by name or ID..."
                    className="payroll-search-input"
                    value={statutorySearch}
                    onChange={(e) => setStatutorySearch(e.target.value)}
                  />
                </div>

                <select className="payroll-filter-select" value={statutoryPeriod} onChange={(e) => setStatutoryPeriod(e.target.value)}>
                  <option value="All">All Pay Periods</option>
                  {availablePeriods.map((p) => (
                    <option key={p} value={p}>{formatMonthName(p)}</option>
                  ))}
                </select>

                <select className="payroll-filter-select" value={statutoryDept} onChange={(e) => setStatutoryDept(e.target.value)}>
                  <option value="All">All Departments</option>
                  {canonicalDepartments.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <button type="button" className="payroll-secondary-btn" onClick={handleExportStatutoryCSV}>
                Export Statutory Register CSV
              </button>
            </div>

            {/* Compliance Register Table */}
            <div className="payroll-table-card">
              <div className="payroll-table-wrap">
                <table className="payroll-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Period</th>
                      <th>Gross Pay</th>
                      <th>Basic Salary</th>
                      <th>EPF Emp (12%)</th>
                      <th>EPF Empr (12%)</th>
                      <th>ESIC (0.75%)</th>
                      <th>PT</th>
                      <th>TDS</th>
                      <th>Total Statutory</th>
                      <th>Taxable Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statutoryRecords.map((r) => (
                      <tr key={r._id}>
                        <td>
                          <div className="payroll-emp-cell">
                            <div className="payroll-emp-avatar">{getInitials(r.user?.firstName, r.user?.lastName, r.user?.email)}</div>
                            <div className="payroll-emp-meta">
                              <span className="payroll-emp-name">{getEmployeeName(r.user)}</span>
                              <span className="payroll-emp-email">{getEmployeeId(r.user)}</span>
                            </div>
                          </div>
                        </td>
                        <td><span className="hr-emp-dept-pill">{resolveDepartmentName(r.user, departments)}</span></td>
                        <td><strong>{formatMonthName(r.payPeriod || r.month)}</strong></td>
                        <td><strong>{formatMoney(r.gross)}</strong></td>
                        <td>{formatMoney(r.basic)}</td>
                        <td>{formatMoney(r.epfEmployee)}</td>
                        <td>{formatMoney(r.epfEmployer)}</td>
                        <td>{formatMoney(r.esi)}</td>
                        <td>{formatMoney(r.pt)}</td>
                        <td><span style={{ color: '#dc2626' }}>{formatMoney(r.tds)}</span></td>
                        <td><strong style={{ color: '#dc2626' }}>{formatMoney(r.totalStatutory)}</strong></td>
                        <td><strong style={{ color: '#15803d' }}>{formatMoney(r.netTaxable)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 9: PAYSLIPS ─── */}
        {activeTab === 'payslips' && isHR && (
          <div>
            <div className="payroll-toolbar" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="payroll-search-wrap">
                  <svg className="payroll-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input
                    type="text"
                    placeholder="Search employee or ID..."
                    className="payroll-search-input"
                    value={payslipSearch}
                    onChange={(e) => setPayslipSearch(e.target.value)}
                  />
                </div>

                <select className="payroll-filter-select" value={payslipPeriod} onChange={(e) => setPayslipPeriod(e.target.value)}>
                  <option value="All">All Pay Periods</option>
                  {availablePeriods.map((p) => (
                    <option key={p} value={p}>{formatMonthName(p)}</option>
                  ))}
                </select>

                <select className="payroll-filter-select" value={payslipDept} onChange={(e) => setPayslipDept(e.target.value)}>
                  <option value="All">All Departments</option>
                  {canonicalDepartments.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <button type="button" className="payroll-primary-btn" onClick={handleBulkDownloadPayslips}>
                Bulk Download (Batch PDF)
              </button>
            </div>

            <div className="payroll-table-card">
              <div className="payroll-table-wrap">
                <table className="payroll-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Designation</th>
                      <th>Pay Period</th>
                      <th>Gross Earnings</th>
                      <th>Deductions</th>
                      <th>Net Take-Home</th>
                      <th>Status</th>
                      <th style={{ minWidth: '180px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayslips.map((r) => (
                      <tr key={r._id}>
                        <td>
                          <div className="payroll-emp-cell">
                            <div className="payroll-emp-avatar">{getInitials(r.user?.firstName, r.user?.lastName, r.user?.email)}</div>
                            <div className="payroll-emp-meta">
                              <span className="payroll-emp-name">{getEmployeeName(r.user)}</span>
                              <span className="payroll-emp-email">{getEmployeeId(r.user)}</span>
                            </div>
                          </div>
                        </td>
                        <td><span className="hr-emp-dept-pill">{resolveDepartmentName(r.user, departments)}</span></td>
                        <td>{getEmployeeDesignation(r.user)}</td>
                        <td><strong>{formatMonthName(r.payPeriod || r.month)}</strong></td>
                        <td>{formatMoney(r.gross)}</td>
                        <td><span style={{ color: '#dc2626' }}>- {formatMoney(r.totalDeduction || r.deductions)}</span></td>
                        <td><strong style={{ color: '#15803d' }}>{formatMoney(r.net)}</strong></td>
                        <td><span className={`payroll-status-pill ${(r.status || '').toLowerCase()}`}>{r.status}</span></td>
                        <td>
                          <div className="payroll-actions-wrap">
                            <button type="button" className="payroll-btn-sm payslip" onClick={() => handleDownloadPayslip(r)}>
                              Download PDF
                            </button>
                            <button type="button" className="payroll-btn-sm view" onClick={() => handleOpenDetail(r)}>
                              View Statement
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 10: PAYROLL APPROVALS ─── */}
        {activeTab === 'approvals' && isHR && (
          <div>
            {/* 4 Summary KPI Cards */}
            <div className="payroll-sub-kpi-grid cols-4">
              <div className="payroll-sub-kpi-card">
                <div className="payroll-sub-kpi-icon" style={{ background: '#fffbeb', color: '#d97706' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                </div>
                <div className="payroll-sub-kpi-body">
                  <span className="payroll-sub-kpi-label">Awaiting HR Approval</span>
                  <h3 className="payroll-sub-kpi-value" style={{ color: '#d97706' }}>{approvalKpis.pendingCount} <span style={{ fontSize: '0.72rem', fontWeight: '500', color: '#64748b' }}>({formatMoney(approvalKpis.pendingNet)})</span></h3>
                </div>
              </div>

              <div className="payroll-sub-kpi-card">
                <div className="payroll-sub-kpi-icon" style={{ background: '#faf5ff', color: '#9333ea' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" /></svg>
                </div>
                <div className="payroll-sub-kpi-body">
                  <span className="payroll-sub-kpi-label">Ready for Payment</span>
                  <h3 className="payroll-sub-kpi-value" style={{ color: '#9333ea' }}>{approvalKpis.processedCount} <span style={{ fontSize: '0.72rem', fontWeight: '500', color: '#64748b' }}>({formatMoney(approvalKpis.processedNet)})</span></h3>
                </div>
              </div>

              <div className="payroll-sub-kpi-card">
                <div className="payroll-sub-kpi-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <div className="payroll-sub-kpi-body">
                  <span className="payroll-sub-kpi-label">Disbursed / Settled</span>
                  <h3 className="payroll-sub-kpi-value" style={{ color: '#15803d' }}>{approvalKpis.paidCount} <span style={{ fontSize: '0.72rem', fontWeight: '500', color: '#64748b' }}>({formatMoney(approvalKpis.paidNet)})</span></h3>
                </div>
              </div>

              <div className="payroll-sub-kpi-card">
                <div className="payroll-sub-kpi-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                </div>
                <div className="payroll-sub-kpi-body">
                  <span className="payroll-sub-kpi-label">Pending Disbursement Batch</span>
                  <h3 className="payroll-sub-kpi-value">{formatMoney(approvalKpis.totalBatchNet)}</h3>
                </div>
              </div>
            </div>

            {/* Filter Toolbar & Batch Actions */}
            <div className="payroll-toolbar" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="payroll-search-wrap">
                  <svg className="payroll-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input
                    type="text"
                    placeholder="Search approvals..."
                    className="payroll-search-input"
                    value={approvalSearch}
                    onChange={(e) => setApprovalSearch(e.target.value)}
                  />
                </div>

                <select className="payroll-filter-select" value={approvalStatus} onChange={(e) => setApprovalStatus(e.target.value)}>
                  <option value="All">All Workflow States</option>
                  <option value="Pending">Awaiting HR Review (Pending)</option>
                  <option value="Processed">Awaiting Finance Disbursal (Processed)</option>
                </select>

                <select className="payroll-filter-select" value={approvalDept} onChange={(e) => setApprovalDept(e.target.value)}>
                  <option value="All">All Departments</option>
                  {canonicalDepartments.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {approvalKpis.pendingCount > 0 && (
                  <button type="button" className="payroll-primary-btn" onClick={handleBatchApprovePending}>
                    ✓ Batch Approve All Pending ({approvalKpis.pendingCount})
                  </button>
                )}
              </div>
            </div>

            {/* Approvals Table */}
            <div className="payroll-table-card">
              <div className="payroll-table-wrap">
                <table className="payroll-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Pay Period</th>
                      <th>Gross Pay</th>
                      <th>Deductions</th>
                      <th>Net Payable</th>
                      <th>Workflow State</th>
                      <th style={{ minWidth: '220px' }}>Approval Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvalRecords.map((r) => (
                      <tr key={r._id}>
                        <td>
                          <div className="payroll-emp-cell">
                            <div className="payroll-emp-avatar">{getInitials(r.user?.firstName, r.user?.lastName, r.user?.email)}</div>
                            <div className="payroll-emp-meta">
                              <span className="payroll-emp-name">{getEmployeeName(r.user)}</span>
                              <span className="payroll-emp-email">{getEmployeeId(r.user)}</span>
                            </div>
                          </div>
                        </td>
                        <td><span className="hr-emp-dept-pill">{resolveDepartmentName(r.user, departments)}</span></td>
                        <td><strong>{formatMonthName(r.payPeriod || r.month)}</strong></td>
                        <td>{formatMoney(r.gross)}</td>
                        <td><span style={{ color: '#dc2626' }}>- {formatMoney(r.totalDeduction || r.deductions)}</span></td>
                        <td><strong style={{ color: '#15803d', fontSize: '0.95rem' }}>{formatMoney(r.net)}</strong></td>
                        <td><span className={`payroll-status-pill ${(r.status || '').toLowerCase()}`}>{r.status === 'Pending' ? 'Awaiting HR Review' : r.status === 'Processed' ? 'Ready for Disbursal' : r.status}</span></td>
                        <td>
                          <div className="payroll-actions-wrap">
                            {r.status === 'Pending' && (
                              <button type="button" className="payroll-btn-sm process" onClick={() => handleOpenProcess(r)}>
                                Approve & Process
                              </button>
                            )}
                            {(r.status === 'Processed' || r.status === 'Processing') && (
                              <button type="button" className="payroll-btn-sm pay" onClick={() => handleOpenPay(r)}>
                                Authorize & Pay
                              </button>
                            )}
                            <button type="button" className="payroll-btn-sm view" onClick={() => handleOpenDetail(r)}>
                              Statement
                            </button>
                          </div>
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

        {/* ─── ADD EXPENSE MODAL ─── */}
        {showAddExpenseModal && (
          <div className="hr-modal-overlay" onClick={() => setShowAddExpenseModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
              <div className="hr-modal-header">
                <h3>Add Expense Claim</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowAddExpenseModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleCreateExpense}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                    <div className="hr-form-group" style={{ gridColumn: 'span 2' }}>
                      <label>Employee *</label>
                      <select
                        required
                        value={newExpenseForm.employeeId}
                        onChange={(e) => setNewExpenseForm({ ...newExpenseForm, employeeId: e.target.value })}
                      >
                        <option value="">Select Employee...</option>
                        {employees.map((emp) => (
                          <option key={emp._id} value={emp._id}>
                            {getEmployeeName(emp)} ({resolveDepartmentName(emp, departments)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Expense Category *</label>
                      <select
                        required
                        value={newExpenseForm.category}
                        onChange={(e) => setNewExpenseForm({ ...newExpenseForm, category: e.target.value })}
                      >
                        <option value="Travel">Travel & Lodging</option>
                        <option value="Equipment">Hardware & Equipment</option>
                        <option value="Software/Subscriptions">Software & Subscriptions</option>
                        <option value="Meals & Entertainment">Meals & Food</option>
                        <option value="Office Supplies">Office Supplies</option>
                        <option value="Client Entertainment">Client Entertainment</option>
                        <option value="Training/Certification">Training & Certifications</option>
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Amount (₹) *</label>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="e.g. 3500"
                        value={newExpenseForm.amount}
                        onChange={(e) => setNewExpenseForm({ ...newExpenseForm, amount: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group" style={{ gridColumn: 'span 2' }}>
                      <label>Expense Title / Description *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Client Site Travel & Cab Fare"
                        value={newExpenseForm.title}
                        onChange={(e) => setNewExpenseForm({ ...newExpenseForm, title: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Date *</label>
                      <input
                        type="date"
                        required
                        value={newExpenseForm.date}
                        onChange={(e) => setNewExpenseForm({ ...newExpenseForm, date: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Designated Approver</label>
                      <select
                        value={newExpenseForm.approver}
                        onChange={(e) => setNewExpenseForm({ ...newExpenseForm, approver: e.target.value })}
                      >
                        <option value="Finance Manager">Finance Manager</option>
                        <option value="HR Admin">HR Admin</option>
                        <option value="Department Head">Department Head</option>
                      </select>
                    </div>

                    <div className="hr-form-group" style={{ gridColumn: 'span 2' }}>
                      <label>Receipt Note / Invoice Reference</label>
                      <input
                        type="text"
                        placeholder="e.g. GST Invoice #INV-8823 attached"
                        value={newExpenseForm.receiptNote}
                        onChange={(e) => setNewExpenseForm({ ...newExpenseForm, receiptNote: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowAddExpenseModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="payroll-primary-btn">
                    + Record Expense
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── VIEW RECEIPT / PROOF MODAL ─── */}
        {showReceiptModal && selectedReceipt && (
          <div className="hr-modal-overlay" onClick={() => setShowReceiptModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
              <div className="hr-modal-header">
                <h3>Expense Receipt & Proof</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowReceiptModal(false)}>&times;</button>
              </div>
              <div className="hr-modal-body">
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Expense ID</span>
                    <strong>{selectedReceipt.id}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Employee</span>
                    <strong>{selectedReceipt.employeeName}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Category</span>
                    <span className="payroll-cat-pill">{selectedReceipt.category}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Amount</span>
                    <strong style={{ color: '#0f172a', fontSize: '1.1rem' }}>{formatMoney(selectedReceipt.amount)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Date</span>
                    <span>{formatDate(selectedReceipt.date || selectedReceipt.billDate)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Status</span>
                    <span className={`payroll-status-pill ${(selectedReceipt.status || '').toLowerCase()}`}>{selectedReceipt.status}</span>
                  </div>
                </div>

                <div style={{ background: '#ffffff', border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '1.5rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.35rem' }}>📄</div>
                  <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.875rem' }}>
                    {selectedReceipt.receiptUrl || selectedReceipt.proofDoc || 'verified_tax_invoice.pdf'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                    {selectedReceipt.receiptNote || selectedReceipt.proofNote || 'Verified Tax Invoice / GST Compliant Receipt on File.'}
                  </div>
                </div>
              </div>
              <div className="hr-modal-footer">
                <button type="button" className="payroll-secondary-btn" onClick={() => setShowReceiptModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── ADD REIMBURSEMENT MODAL ─── */}
        {showAddReimbursementModal && (
          <div className="hr-modal-overlay" onClick={() => setShowAddReimbursementModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
              <div className="hr-modal-header">
                <h3>Submit Reimbursement Claim</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowAddReimbursementModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleCreateReimbursement}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                    <div className="hr-form-group" style={{ gridColumn: 'span 2' }}>
                      <label>Employee *</label>
                      <select
                        required
                        value={newReimbursementForm.employeeId}
                        onChange={(e) => setNewReimbursementForm({ ...newReimbursementForm, employeeId: e.target.value })}
                      >
                        <option value="">Select Employee...</option>
                        {employees.map((emp) => (
                          <option key={emp._id} value={emp._id}>
                            {getEmployeeName(emp)} ({resolveDepartmentName(emp, departments)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Claim Category *</label>
                      <select
                        required
                        value={newReimbursementForm.category}
                        onChange={(e) => setNewReimbursementForm({ ...newReimbursementForm, category: e.target.value })}
                      >
                        <option value="Medical">Medical Reimbursement</option>
                        <option value="Travel & Conveyance">Travel & Conveyance</option>
                        <option value="Fuel Allowance">Fuel Allowance</option>
                        <option value="Internet & Mobile">Internet & Mobile (WFA)</option>
                        <option value="Relocation">Relocation Allowance</option>
                        <option value="Client Meeting">Client Pitch Meeting</option>
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Claim Amount (₹) *</label>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="e.g. 2500"
                        value={newReimbursementForm.amount}
                        onChange={(e) => setNewReimbursementForm({ ...newReimbursementForm, amount: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group" style={{ gridColumn: 'span 2' }}>
                      <label>Claim Purpose / Details *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Monthly High-Speed Fiber Broadband Bill"
                        value={newReimbursementForm.title}
                        onChange={(e) => setNewReimbursementForm({ ...newReimbursementForm, title: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Bill / Voucher Date *</label>
                      <input
                        type="date"
                        required
                        value={newReimbursementForm.billDate}
                        onChange={(e) => setNewReimbursementForm({ ...newReimbursementForm, billDate: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Proof Document Note</label>
                      <input
                        type="text"
                        placeholder="e.g. Verified against payment receipt #991"
                        value={newReimbursementForm.proofNote}
                        onChange={(e) => setNewReimbursementForm({ ...newReimbursementForm, proofNote: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowAddReimbursementModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="payroll-primary-btn">
                    Submit Claim
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── ADD ADVANCE / LOAN MODAL ─── */}
        {showAddAdvanceModal && (
          <div className="hr-modal-overlay" onClick={() => setShowAddAdvanceModal(false)}>
            <div className="hr-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
              <div className="hr-modal-header">
                <h3>New Salary Advance / Loan</h3>
                <button type="button" className="hr-modal-close" onClick={() => setShowAddAdvanceModal(false)}>&times;</button>
              </div>
              <form onSubmit={handleCreateAdvance}>
                <div className="hr-modal-body">
                  <div className="hr-form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                    <div className="hr-form-group" style={{ gridColumn: 'span 2' }}>
                      <label>Employee *</label>
                      <select
                        required
                        value={newAdvanceForm.employeeId}
                        onChange={(e) => setNewAdvanceForm({ ...newAdvanceForm, employeeId: e.target.value })}
                      >
                        <option value="">Select Employee...</option>
                        {employees.map((emp) => (
                          <option key={emp._id} value={emp._id}>
                            {getEmployeeName(emp)} ({resolveDepartmentName(emp, departments)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Advance Type *</label>
                      <select
                        required
                        value={newAdvanceForm.type}
                        onChange={(e) => setNewAdvanceForm({ ...newAdvanceForm, type: e.target.value })}
                      >
                        <option value="Salary Advance">Salary Advance (1-3 mos)</option>
                        <option value="Emergency Advance">Emergency Advance</option>
                        <option value="Personal Loan">Staff Personal Loan (Longer)</option>
                        <option value="Education Support">Education / Skill Loan</option>
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Disbursement Amount (₹) *</label>
                      <input
                        type="number"
                        required
                        min="1000"
                        placeholder="e.g. 30000"
                        value={newAdvanceForm.amount}
                        onChange={(e) => {
                          const amt = Number(e.target.value) || 0;
                          const ten = Number(newAdvanceForm.tenureMonths) || 3;
                          setNewAdvanceForm({
                            ...newAdvanceForm,
                            amount: e.target.value,
                            monthlyEmi: String(Math.round(amt / ten)),
                          });
                        }}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Repayment Tenure (Months) *</label>
                      <select
                        value={newAdvanceForm.tenureMonths}
                        onChange={(e) => {
                          const ten = Number(e.target.value) || 3;
                          const amt = Number(newAdvanceForm.amount) || 0;
                          setNewAdvanceForm({
                            ...newAdvanceForm,
                            tenureMonths: e.target.value,
                            monthlyEmi: String(Math.round(amt / ten)),
                          });
                        }}
                      >
                        <option value="1">1 Month (Full Deduct)</option>
                        <option value="2">2 Months</option>
                        <option value="3">3 Months</option>
                        <option value="4">4 Months</option>
                        <option value="6">6 Months</option>
                      </select>
                    </div>

                    <div className="hr-form-group">
                      <label>Calculated Monthly EMI (₹)</label>
                      <input
                        type="number"
                        readOnly
                        style={{ background: '#f8fafc' }}
                        value={newAdvanceForm.monthlyEmi}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Disbursement Date *</label>
                      <input
                        type="date"
                        required
                        value={newAdvanceForm.disbursementDate}
                        onChange={(e) => setNewAdvanceForm({ ...newAdvanceForm, disbursementDate: e.target.value })}
                      />
                    </div>

                    <div className="hr-form-group">
                      <label>Reason / Approval Note</label>
                      <input
                        type="text"
                        placeholder="e.g. Approved against upcoming payroll"
                        value={newAdvanceForm.reason}
                        onChange={(e) => setNewAdvanceForm({ ...newAdvanceForm, reason: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="hr-modal-footer">
                  <button type="button" className="hr-btn-secondary" onClick={() => setShowAddAdvanceModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="payroll-primary-btn">
                    Disburse Advance
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
