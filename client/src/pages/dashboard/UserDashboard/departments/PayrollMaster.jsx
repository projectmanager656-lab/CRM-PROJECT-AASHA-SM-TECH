import React, { useState, useEffect, useMemo, useCallback } from 'react';
import apiClient from '../../../../services/apiClient';

export default function PayrollMaster({
  payrolls = [],
  setPayrolls,
  bankAccounts = [],
  formatCurrency = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`,
  formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
  user,
  isFinanceAdmin = true,
  onRefresh,
  initialSubTab,
}) {
  // ─── Main View Switcher: 'payroll' (Employee Payroll) | 'requests' (Company Payment Requests) | 'recovery' (Loan & Advance Recovery) ───
  const [mainView, setMainView] = useState(
    initialSubTab === 'requests' ? 'requests' : initialSubTab === 'recovery' ? 'recovery' : 'payroll'
  );
  useEffect(() => {
    if (initialSubTab === 'requests') {
      setMainView('requests');
    } else if (initialSubTab === 'recovery') {
      setMainView('recovery');
    } else if (initialSubTab === 'payroll' || initialSubTab === 'overview') {
      setMainView('payroll');
    }
  }, [initialSubTab]);

  // ─── Dynamic Month / Year State ───
  const currentMonthDisplay = useMemo(() => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const now = new Date();
    return `${months[now.getMonth()]} ${now.getFullYear()}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthDisplay);
  const [availableMonths, setAvailableMonths] = useState([currentMonthDisplay]);

  // ─── Dashboard Summary KPIs ───
  const [summary, setSummary] = useState({
    totalEmployees: 0,
    grossPayroll: 0,
    totalDeductions: 0,
    netPayroll: 0,
    paidAmount: 0,
    pendingAmount: 0,
    paidCount: 0,
    pendingCount: 0,
    generatedCount: 0,
  });

  // ─── Employee Payroll Records (Selected Month) ───
  const [payrollRows, setPayrollRows] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState({ type: '', text: '' });

  // ─── Search & Filters ───
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [bankFilter, setBankFilter] = useState('All');

  // ─── Company-Wide Payment Requests & Recoveries Summary ───
  const [allPaymentRequests, setAllPaymentRequests] = useState([]);
  const [allAdvances, setAllAdvances] = useState([]);
  const [advancesSummary, setAdvancesSummary] = useState({ totalDisbursed: 0, totalRecovered: 0, balanceOutstanding: 0, count: 0 });

  // ─── Real Auxiliary Collections for Payment Requests ───
  const [vendors, setVendors] = useState([]);
  const [vendorBills, setVendorBills] = useState([]);
  const [departments, setDepartments] = useState([
    'Finance',
    'HR',
    'Tech',
    'Digital Marketing',
    'Video Editor',
    'Business Development',
    'Operations',
    'Administration',
  ]);

  // ─── Company Payment Requests Search & Filters ───
  const [prSearch, setPrSearch] = useState('');
  const [prStatusFilter, setPrStatusFilter] = useState('All');
  const [prTypeFilter, setPrTypeFilter] = useState('All');
  const [prPriorityFilter, setPrPriorityFilter] = useState('All');

  // ─── Create Payment Request Modal State ───
  const [createPrModalOpen, setCreatePrModalOpen] = useState(false);
  const [createPrForm, setCreatePrForm] = useState({
    requestNumber: '',
    requestDate: new Date().toISOString().slice(0, 10),
    paymentType: 'Vendor Payment',
    priority: 'Medium',
    department: user?.department || 'Finance',
    requester: user?.userId || user?._id || '',
    requesterName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || '',
    requiredDate: '',
    vendor: '',
    vendorBill: '',
    vendorBillNumber: '',
    employee: '',
    expenseCategory: 'Travel & Conveyance',
    expenseDate: new Date().toISOString().slice(0, 10),
    payeeName: '',
    amount: '',
    reason: '',
    description: '',
    paymentMethod: 'Bank Transfer',
    preferredPaymentDate: '',
    referenceNumber: '',
    repaymentPlan: 'Monthly Deduction from Payroll',
    installments: 3,
    notes: '',
    supportingDocumentUrl: '',
  });
  const [createPrErrors, setCreatePrErrors] = useState({});
  const [createPrSubmitting, setCreatePrSubmitting] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadedDocName, setUploadedDocName] = useState('');

  // ─── View / Detail PR Modal State ───
  const [viewPrModalOpen, setViewPrModalOpen] = useState(false);
  const [selectedPr, setSelectedPr] = useState(null);

  // ─── Reject PR Modal State ───
  const [rejectPrModalOpen, setRejectPrModalOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState(null);
  const [rejectReasonText, setRejectReasonText] = useState('');
  const [rejectingPr, setRejectingPr] = useState(false);

  // ─── Main Screen Quick Management Modals ───
  const [recoveriesModalOpen, setRecoveriesModalOpen] = useState(false);
  const [advSearch, setAdvSearch] = useState('');
  const [advStatusFilter, setAdvStatusFilter] = useState('All');
  const [advTypeFilter, setAdvTypeFilter] = useState('All');

  // ─── Central "Manage" Employee Modal State ───
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [selectedEmpRow, setSelectedEmpRow] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  // Internal workspace tabs inside Manage:
  // 'overview' | 'salary' | 'earnings' | 'deductions' | 'attendance' | 'calculation' | 'payment-request' | 'disbursement' | 'payslip' | 'history'
  const [manageTab, setManageTab] = useState('overview');

  // ─── Sub-Action Forms inside Manage ───
  const [salaryForm, setSalaryForm] = useState({});
  const [salarySaving, setSalarySaving] = useState(false);

  const [bonusForm, setBonusForm] = useState({ type: 'Bonus', amount: '', reason: '' });
  const [bonusSaving, setBonusSaving] = useState(false);

  const [recoveryForm, setRecoveryForm] = useState({ advanceType: 'Salary Advance', disbursedAmount: '', monthlyDeduction: '', reason: '', repaymentMonths: 3 });
  const [recoverySaving, setRecoverySaving] = useState(false);

  const [newPrForm, setNewPrForm] = useState({ amount: '', reason: '', priority: 'Medium' });
  const [newPrSaving, setNewPrSaving] = useState(false);

  // ─── Disbursal & Payslip Modals ───
  const [disburseModalOpen, setDisburseModalOpen] = useState(false);
  const [disburseTarget, setDisburseTarget] = useState(null); // specific payroll slip, payment request or 'bulk'
  const [disburseForm, setDisburseForm] = useState({ bankAccountId: '', paymentMethod: 'Bank Transfer', transactionReference: '', notes: '' });
  const [disbursing, setDisbursing] = useState(false);

  const [payslipModalOpen, setPayslipModalOpen] = useState(false);
  const [payslipData, setPayslipData] = useState(null);
  const [payslipLoading, setPayslipLoading] = useState(false);

  // ─── Generate Monthly Payroll Modal ───
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [genForm, setGenForm] = useState({
    month: currentMonthDisplay.split(' ')[0],
    year: currentMonthDisplay.split(' ')[1],
    department: 'All',
  });
  const [genStats, setGenStats] = useState(null);
  const [genLoading, setGenLoading] = useState(false);

  // ─── Quick Management 1: Add Salary State ───
  const [addSalaryModalOpen, setAddSalaryModalOpen] = useState(false);
  const [addSalaryForm, setAddSalaryForm] = useState({
    employeeId: '',
    basicSalary: '',
    hra: '',
    conveyance: '',
    medicalAllowance: '',
    specialAllowance: '',
    bonus: '',
    pf: '',
    professionalTax: '',
    tds: '',
    otherDeductions: '',
    accountHolderName: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
    effectiveDate: new Date().toISOString().slice(0, 10),
    status: 'Active',
    remarks: '',
  });
  const [addSalarySaving, setAddSalarySaving] = useState(false);

  // ─── Quick Management 2: Record Payment State ───
  const [recordPaymentModalOpen, setRecordPaymentModalOpen] = useState(false);
  const [recordPaymentForm, setRecordPaymentForm] = useState({
    paymentReference: '',
    paymentType: 'Direct Expense',
    payeeName: '',
    amount: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'Bank Transfer',
    bankAccountId: '',
    transactionReference: '',
    relatedPaymentRequestId: '',
    relatedPayrollId: '',
    notes: '',
    status: 'Completed',
  });
  const [recordPaymentSaving, setRecordPaymentSaving] = useState(false);

  // ─── Quick Management 3: Add Recovery State ───
  const [addRecoveryModalOpen, setAddRecoveryModalOpen] = useState(false);
  const [addRecoveryForm, setAddRecoveryForm] = useState({
    employeeId: '',
    advanceType: 'Salary Advance',
    originalAmount: '',
    installmentAmount: '',
    totalInstallments: 3,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    recoveredAmount: 0,
    status: 'Disbursed',
    remarks: '',
  });
  const [addRecoverySaving, setAddRecoverySaving] = useState(false);

  // ─── Quick Management 4: Generate Payslip Quick State ───
  const [generatePayslipModalOpen, setGeneratePayslipModalOpen] = useState(false);
  const [quickPayslipEmpId, setQuickPayslipEmpId] = useState('');
  const [quickPayslipMonth, setQuickPayslipMonth] = useState(currentMonthDisplay);
  const [quickPayslipLoading, setQuickPayslipLoading] = useState(false);

  // ─── Quick Management 5: Manage Approvals State ───
  const [approvalsModalOpen, setApprovalsModalOpen] = useState(false);
  const [approvalTab, setApprovalTab] = useState('all');
  const [approvingItemId, setApprovingItemId] = useState(null);

  // ─── Quick Management 6: Payroll History State ───
  const [payrollHistoryModalOpen, setPayrollHistoryModalOpen] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistoryPeriod, setSelectedHistoryPeriod] = useState(null);
  const [historyPeriodSlips, setHistoryPeriodSlips] = useState([]);
  const [historyPeriodLoading, setHistoryPeriodLoading] = useState(false);
  const [historyFilterSearch, setHistoryFilterSearch] = useState('');

  // ─── Notifications Helper ───
  const showNotice = useCallback((type, text) => {
    setNotification({ type, text });
    setTimeout(() => setNotification({ type: '', text: '' }), 5000);
  }, []);

  // ─── 1. Fetch Month Data, Employees, Payment Requests & Recoveries ───
  const fetchMonthData = useCallback(async (monthToFetch = selectedMonth) => {
    setLoading(true);
    try {
      const [sumRes, payRes, empRes, prRes, advRes, vendRes, billRes, deptRes] = await Promise.all([
        apiClient.get(`/finance/payroll/summary?month=${encodeURIComponent(monthToFetch)}`),
        apiClient.get(`/finance/payroll?month=${encodeURIComponent(monthToFetch)}`),
        apiClient.get('/finance/salary/employees'),
        apiClient.get('/finance/payment-requests'),
        apiClient.get('/finance/salary/advances'),
        apiClient.get('/finance/vendors').catch(() => ({ data: { data: [] } })),
        apiClient.get('/finance/vendor-bills').catch(() => ({ data: { data: [] } })),
        apiClient.get('/departments').catch(() => apiClient.get('/admin/departments')).catch(() => ({ data: { data: [] } })),
      ]);

      if (sumRes.data?.data) {
        const s = sumRes.data.data;
        setSummary({
          totalEmployees: s.totalEmployees || 0,
          grossPayroll: s.grossPayroll || 0,
          totalDeductions: s.totalDeductions || 0,
          netPayroll: s.netPayroll || 0,
          paidAmount: s.paidAmount || 0,
          pendingAmount: s.pendingAmount || 0,
          paidCount: s.paidPayroll || 0,
          pendingCount: s.pendingPayroll || 0,
          generatedCount: s.payrollGenerated || 0,
        });
        if (s.availableMonths && s.availableMonths.length > 0) {
          setAvailableMonths(s.availableMonths);
        }
      }

      const slips = Array.isArray(payRes.data?.data) ? payRes.data.data : [];
      if (setPayrolls) setPayrolls(slips);

      const emps = Array.isArray(empRes.data?.data) ? empRes.data.data : [];
      setAllEmployees(emps);

      // Payment requests & advances
      const prList = Array.isArray(prRes.data?.data) ? prRes.data.data : [];
      setAllPaymentRequests(prList);

      const advList = Array.isArray(advRes.data?.data?.advances) ? advRes.data.data.advances : [];
      setAllAdvances(advList);
      if (advRes.data?.data?.summary) {
        setAdvancesSummary(advRes.data.data.summary);
      }

      // Populate real vendors, bills & departments
      if (vendRes?.data?.data && Array.isArray(vendRes.data.data)) {
        setVendors(vendRes.data.data);
      }
      if (billRes?.data?.data && Array.isArray(billRes.data.data)) {
        setVendorBills(billRes.data.data);
      }
      const dList = deptRes?.data?.data || deptRes?.data || [];
      if (Array.isArray(dList) && dList.length > 0) {
        const names = dList.map((d) => (typeof d === 'string' ? d : d.name || d.departmentName)).filter(Boolean);
        if (names.length > 0) {
          setDepartments(Array.from(new Set(names)));
        }
      }

      // Merge active employees with their payroll slip for this month
      const slipsByEmpId = new Map();
      slips.forEach((sl) => {
        const uId = sl.user?._id || sl.user;
        if (uId) slipsByEmpId.set(String(uId), sl);
      });

      const mergedRows = emps.map((emp) => {
        const slip = slipsByEmpId.get(String(emp._id));
        const sal = emp.salaryDetails || {};
        const b = emp.bankDetails || {};
        const isBankConfigured = !!(b.accountNumber && b.ifscCode && b.bankName);

        const basic = slip ? slip.basicSalary : (Number(sal.basicSalary) || 0);
        const allowances = slip
          ? ((slip.earnings?.hra || 0) + (slip.earnings?.conveyance || 0) + (slip.earnings?.medical || 0) + (slip.earnings?.special || 0) + (slip.earnings?.other || 0))
          : (Number(sal.allowances) || 0);
        const bonus = slip ? ((slip.earnings?.bonus || 0) + (slip.earnings?.incentive || 0) + (slip.earnings?.overtime || 0)) : 0;
        const totalEarnings = allowances + bonus;

        const deductions = slip
          ? (slip.totalDeduction || slip.deductions || 0)
          : (Number(sal.deductions) || 0);

        const gross = slip ? slip.gross : (basic + totalEarnings);
        const net = slip ? slip.net : Math.max(0, gross - deductions);

        return {
          employee: emp,
          payroll: slip || null,
          hasPayroll: !!slip,
          employeeId: emp.employeeId || emp.jobDetails?.employeeId || `EMP-${String(emp._id).slice(-4).toUpperCase()}`,
          name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || emp.email,
          email: emp.email,
          department: emp.department || emp.jobDetails?.department || 'General',
          designation: emp.designation || emp.jobDetails?.designation || 'Staff',
          basicSalary: basic,
          earnings: totalEarnings,
          deductions: deductions,
          grossSalary: gross,
          netSalary: net,
          bankConfigured: isBankConfigured,
          bankStatus: isBankConfigured ? 'Verified' : 'Pending Bank Setup',
          payrollStatus: slip?.workflowStatus || slip?.status || 'Draft',
          isPaid: slip?.status === 'Paid',
        };
      });

      setPayrollRows(mergedRows);
    } catch (err) {
      console.error('Failed to load payroll data:', err);
      showNotice('error', err.response?.data?.message || 'Failed to load payroll dashboard data');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, setPayrolls, showNotice]);

  useEffect(() => {
    fetchMonthData(selectedMonth);
  }, [selectedMonth, fetchMonthData]);

  // ─── Quick Management Action Handlers ───
  const handleOpenAddSalary = (preselectedEmpId) => {
    const targetEmp = allEmployees.find((e) => String(e._id) === String(preselectedEmpId)) || allEmployees[0];
    const sal = targetEmp?.salaryDetails || {};
    const bank = targetEmp?.bankDetails || {};
    setAddSalaryForm({
      employeeId: targetEmp ? String(targetEmp._id) : '',
      basicSalary: sal.basicSalary || '',
      hra: sal.hra || '',
      conveyance: sal.conveyance || '',
      medicalAllowance: sal.medicalAllowance || '',
      specialAllowance: sal.specialAllowance || '',
      bonus: sal.bonus || '',
      pf: sal.pf || '',
      professionalTax: sal.professionalTax || '',
      tds: sal.tds || '',
      otherDeductions: '',
      accountHolderName: bank.accountHolderName || `${targetEmp?.firstName || ''} ${targetEmp?.lastName || ''}`.trim(),
      bankName: bank.bankName || '',
      accountNumber: bank.accountNumber || '',
      ifscCode: bank.ifscCode || '',
      branchName: bank.branchName || '',
      effectiveDate: new Date().toISOString().slice(0, 10),
      status: 'Active',
      remarks: '',
    });
    setAddSalaryModalOpen(true);
  };

  const handleAddSalaryEmpChange = (empId) => {
    const targetEmp = allEmployees.find((e) => String(e._id) === String(empId));
    const sal = targetEmp?.salaryDetails || {};
    const bank = targetEmp?.bankDetails || {};
    setAddSalaryForm((prev) => ({
      ...prev,
      employeeId: empId,
      basicSalary: sal.basicSalary || '',
      hra: sal.hra || '',
      conveyance: sal.conveyance || '',
      medicalAllowance: sal.medicalAllowance || '',
      specialAllowance: sal.specialAllowance || '',
      bonus: sal.bonus || '',
      pf: sal.pf || '',
      professionalTax: sal.professionalTax || '',
      tds: sal.tds || '',
      otherDeductions: '',
      accountHolderName: bank.accountHolderName || `${targetEmp?.firstName || ''} ${targetEmp?.lastName || ''}`.trim(),
      bankName: bank.bankName || '',
      accountNumber: bank.accountNumber || '',
      ifscCode: bank.ifscCode || '',
      branchName: bank.branchName || '',
    }));
  };

  const handleSaveAddSalary = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!addSalaryForm.employeeId) {
      showNotice('error', 'Please select an employee');
      return;
    }
    const bSal = Number(addSalaryForm.basicSalary);
    if (isNaN(bSal) || bSal < 0) {
      showNotice('error', 'Basic salary must be a valid positive number');
      return;
    }
    setAddSalarySaving(true);
    try {
      const hra = Number(addSalaryForm.hra) || 0;
      const conv = Number(addSalaryForm.conveyance) || 0;
      const med = Number(addSalaryForm.medicalAllowance) || 0;
      const spec = Number(addSalaryForm.specialAllowance) || 0;
      const bonus = Number(addSalaryForm.bonus) || 0;
      const pf = Number(addSalaryForm.pf) || 0;
      const pt = Number(addSalaryForm.professionalTax) || 0;
      const tds = Number(addSalaryForm.tds) || 0;
      const otherDed = Number(addSalaryForm.otherDeductions) || 0;
      const totalDed = pf + pt + tds + otherDed;

      const payload = {
        basicSalary: bSal,
        hra,
        conveyance: conv,
        medicalAllowance: med,
        specialAllowance: spec,
        bonus,
        pf,
        professionalTax: pt,
        tds,
        deductions: totalDed,
        bankDetails: {
          accountHolderName: addSalaryForm.accountHolderName,
          bankName: addSalaryForm.bankName,
          accountNumber: addSalaryForm.accountNumber,
          ifscCode: addSalaryForm.ifscCode,
          branchName: addSalaryForm.branchName,
        },
        effectiveDate: addSalaryForm.effectiveDate,
        remarks: addSalaryForm.remarks,
      };

      await apiClient.put(`/finance/salary/employees/${addSalaryForm.employeeId}`, payload);

      // If employee has a slip for this month, trigger recalculation
      const existingSlip = payrolls.find(
        (p) => String(p.user?._id || p.user || p.employee?._id || p.employee) === String(addSalaryForm.employeeId)
      );
      if (existingSlip && existingSlip.status !== 'Paid') {
        await apiClient.post(`/finance/payroll/recalculate/${existingSlip._id}`).catch(() => {});
      }

      showNotice('success', 'Employee salary structure updated successfully in MongoDB Atlas');
      setAddSalaryModalOpen(false);
      await fetchMonthData(selectedMonth);
    } catch (err) {
      showNotice('error', err.response?.data?.message || err.message || 'Failed to update salary structure');
    } finally {
      setAddSalarySaving(false);
    }
  };

  const handleOpenRecordPayment = (preset = {}) => {
    setRecordPaymentForm({
      paymentReference: `PAY-${Date.now().toString().slice(-6)}`,
      paymentType: preset.paymentType || 'Direct Expense',
      payeeName: preset.payeeName || '',
      amount: preset.amount || '',
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'Bank Transfer',
      bankAccountId: bankAccounts[0]?._id || '',
      transactionReference: `UTR-${Date.now()}`,
      relatedPaymentRequestId: preset.relatedPaymentRequestId || '',
      relatedPayrollId: preset.relatedPayrollId || '',
      notes: preset.notes || '',
      status: 'Completed',
    });
    setRecordPaymentModalOpen(true);
  };

  const handleSaveRecordPayment = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const amt = Number(recordPaymentForm.amount);
    if (!amt || amt <= 0) {
      showNotice('error', 'Payment amount must be greater than 0');
      return;
    }
    if (!recordPaymentForm.payeeName.trim()) {
      showNotice('error', 'Payee / Beneficiary name is required');
      return;
    }
    setRecordPaymentSaving(true);
    try {
      await apiClient.post('/finance/payments', {
        paymentReference: recordPaymentForm.paymentReference,
        payee: recordPaymentForm.payeeName,
        paymentType: recordPaymentForm.paymentType,
        amount: amt,
        paymentDate: recordPaymentForm.paymentDate,
        paymentMethod: recordPaymentForm.paymentMethod,
        bankAccountId: recordPaymentForm.bankAccountId || undefined,
        transactionReference: recordPaymentForm.transactionReference,
        relatedPaymentRequest: recordPaymentForm.relatedPaymentRequestId || undefined,
        relatedPayroll: recordPaymentForm.relatedPayrollId || undefined,
        notes: recordPaymentForm.notes,
        status: recordPaymentForm.status,
      });

      showNotice('success', `Payment of ₹${amt.toLocaleString('en-IN')} recorded successfully`);
      setRecordPaymentModalOpen(false);
      await fetchMonthData(selectedMonth);
    } catch (err) {
      showNotice('error', err.response?.data?.message || err.message || 'Failed to record payment');
    } finally {
      setRecordPaymentSaving(false);
    }
  };

  const handleOpenAddRecovery = (empId) => {
    const targetEmp = allEmployees.find((e) => String(e._id) === String(empId)) || allEmployees[0];
    setAddRecoveryForm({
      employeeId: targetEmp ? String(targetEmp._id) : '',
      advanceType: 'Salary Advance',
      originalAmount: '',
      installmentAmount: '',
      totalInstallments: 3,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      recoveredAmount: 0,
      status: 'Disbursed',
      remarks: '',
    });
    setAddRecoveryModalOpen(true);
  };

  const handleSaveAddRecovery = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!addRecoveryForm.employeeId) {
      showNotice('error', 'Please select an employee');
      return;
    }
    const amt = Number(addRecoveryForm.originalAmount);
    if (!amt || amt <= 0) {
      showNotice('error', 'Original amount must be greater than 0');
      return;
    }
    const installments = Math.max(1, Number(addRecoveryForm.totalInstallments) || 1);
    const deduction = Number(addRecoveryForm.installmentAmount) > 0 ? Number(addRecoveryForm.installmentAmount) : Math.round(amt / installments);

    setAddRecoverySaving(true);
    try {
      await apiClient.post('/finance/salary/advances', {
        employeeId: addRecoveryForm.employeeId,
        requestedAmount: amt,
        monthlyDeduction: deduction,
        totalInstallments: installments,
        reason: addRecoveryForm.remarks || `${addRecoveryForm.advanceType} scheduled`,
        advanceType: addRecoveryForm.advanceType,
        startDate: addRecoveryForm.startDate,
        endDate: addRecoveryForm.endDate,
        recoveredAmount: Number(addRecoveryForm.recoveredAmount) || 0,
        status: addRecoveryForm.status,
      });

      showNotice('success', 'Recovery / Loan schedule created successfully in MongoDB Atlas');
      setAddRecoveryModalOpen(false);
      await fetchMonthData(selectedMonth);
    } catch (err) {
      showNotice('error', err.response?.data?.message || err.message || 'Failed to create recovery');
    } finally {
      setAddRecoverySaving(false);
    }
  };

  const handleOpenQuickPayslip = () => {
    setQuickPayslipMonth(selectedMonth);
    setQuickPayslipEmpId(allEmployees[0] ? String(allEmployees[0]._id) : '');
    setGeneratePayslipModalOpen(true);
  };

  const handleExecuteQuickPayslip = async () => {
    if (!quickPayslipEmpId) {
      showNotice('error', 'Please select an employee');
      return;
    }
    setQuickPayslipLoading(true);
    try {
      let slips = payrolls;
      if (quickPayslipMonth !== selectedMonth) {
        const res = await apiClient.get(`/finance/payroll?month=${encodeURIComponent(quickPayslipMonth)}`);
        slips = Array.isArray(res.data?.data) ? res.data.data : [];
      }
      let slip = slips.find(
        (p) => String(p.user?._id || p.user || p.employee?._id || p.employee) === String(quickPayslipEmpId)
      );

      if (!slip) {
        await apiClient.post('/finance/payroll/generate', {
          month: quickPayslipMonth.split(' ')[0],
          year: quickPayslipMonth.split(' ')[1] || new Date().getFullYear(),
          department: 'All',
        });
        const refetch = await apiClient.get(`/finance/payroll?month=${encodeURIComponent(quickPayslipMonth)}`);
        slips = Array.isArray(refetch.data?.data) ? refetch.data.data : [];
        slip = slips.find(
          (p) => String(p.user?._id || p.user || p.employee?._id || p.employee) === String(quickPayslipEmpId)
        );
      }

      if (slip) {
        setGeneratePayslipModalOpen(false);
        openPayslip(slip);
      } else {
        showNotice('warning', 'Could not locate or generate payroll record for selected employee in this month');
      }
    } catch (err) {
      showNotice('error', err.response?.data?.message || err.message || 'Failed to generate payslip');
    } finally {
      setQuickPayslipLoading(false);
    }
  };

  const handleOpenApprovals = () => {
    setApprovalTab('all');
    setApprovalsModalOpen(true);
  };

  const handleProcessApproval = async (type, item, action, reason) => {
    setApprovingItemId(item._id);
    try {
      if (type === 'payroll') {
        if (action === 'approve') {
          await apiClient.post(`/finance/payroll/${item._id}/approve`);
          showNotice('success', `Approved payroll for ${item.employeeName || 'employee'}`);
        }
      } else if (type === 'payment-request') {
        if (action === 'approve') {
          await apiClient.post(`/finance/payment-requests/${item._id}/approve`, {
            approvalRemarks: 'Approved via Quick Finance Management',
          });
          showNotice('success', `Approved Payment Request ${item.requestNumber}`);
        } else {
          await apiClient.post(`/finance/payment-requests/${item._id}/reject`, {
            rejectionReason: reason || 'Rejected via Quick Finance Management',
          });
          showNotice('info', `Rejected Payment Request ${item.requestNumber}`);
        }
      } else if (type === 'advance') {
        if (action === 'approve') {
          await apiClient.post(`/finance/salary/advances/${item._id}/approve`, {
            status: 'Approved',
            approvedAmount: item.requestedAmount,
            remarks: 'Approved via Quick Finance Management',
          });
          showNotice('success', `Approved advance ${item.advanceNumber}`);
        } else {
          await apiClient.post(`/finance/salary/advances/${item._id}/approve`, {
            status: 'Rejected',
            remarks: reason || 'Rejected via Quick Finance Management',
          });
          showNotice('info', `Rejected advance ${item.advanceNumber}`);
        }
      }
      await fetchMonthData(selectedMonth);
    } catch (err) {
      showNotice('error', err.response?.data?.message || err.message || 'Failed to process approval');
    } finally {
      setApprovingItemId(null);
    }
  };

  const handleDeleteApprovalItem = async (type, item) => {
    const itemName =
      type === 'payroll'
        ? `Payroll slip for ${item.employeeName || 'staff'} (${item.payPeriod})`
        : type === 'payment-request'
        ? `Payment request ${item.requestNumber}`
        : `Advance request ${item.advanceNumber}`;
    if (!window.confirm(`Are you sure you want to permanently delete this ${itemName}?`)) return;

    try {
      if (type === 'payroll') {
        await apiClient.delete(`/finance/payroll/${item._id}`);
      } else if (type === 'payment-request') {
        await apiClient.delete(`/finance/payment-requests/${item._id}`);
      } else if (type === 'advance') {
        await apiClient.delete(`/finance/salary/advances/${item._id}`);
      }
      showNotice('success', `${itemName} deleted successfully`);
      await fetchMonthData(selectedMonth);
      if (onRefresh) onRefresh();
    } catch (err) {
      showNotice('error', err.response?.data?.message || err.message || 'Failed to delete record');
    }
  };

  const handleOpenPayrollHistory = async () => {
    setSelectedHistoryPeriod(null);
    setHistoryPeriodSlips([]);
    setPayrollHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const res = await apiClient.get('/finance/payroll/history');
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setHistoryList(list);
    } catch (err) {
      showNotice('error', err.response?.data?.message || err.message || 'Failed to load payroll history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleViewHistoryPeriod = async (period) => {
    setSelectedHistoryPeriod(period);
    setHistoryPeriodLoading(true);
    try {
      const res = await apiClient.get(`/finance/payroll?month=${encodeURIComponent(period)}`);
      setHistoryPeriodSlips(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      showNotice('error', err.response?.data?.message || err.message || 'Failed to load period slips');
    } finally {
      setHistoryPeriodLoading(false);
    }
  };

  const handleSwitchToHistoryPeriod = (period) => {
    setSelectedMonth(period);
    fetchMonthData(period);
    setPayrollHistoryModalOpen(false);
    showNotice('info', `Switched active dashboard to ${period}`);
  };

  // ─── 2. Filtered Rows ───
  const filteredRows = useMemo(() => {
    return payrollRows.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        const matchName = r.name.toLowerCase().includes(q);
        const matchId = r.employeeId.toLowerCase().includes(q);
        const matchEmail = r.email.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchEmail) return false;
      }
      if (deptFilter !== 'All' && r.department.toLowerCase() !== deptFilter.toLowerCase()) {
        return false;
      }
      if (statusFilter !== 'All') {
        if (r.payrollStatus.toLowerCase() !== statusFilter.toLowerCase()) return false;
      }
      if (paymentFilter !== 'All') {
        if (paymentFilter === 'Paid' && !r.isPaid) return false;
        if (paymentFilter === 'Pending' && r.isPaid) return false;
      }
      if (bankFilter !== 'All') {
        if (bankFilter === 'Verified' && !r.bankConfigured) return false;
        if (bankFilter === 'Pending Bank Setup' && r.bankConfigured) return false;
      }
      return true;
    });
  }, [payrollRows, search, deptFilter, statusFilter, paymentFilter, bankFilter]);

  // ─── 3. Open "Manage" Panel ───
  const openManagePanel = async (row, initialTab = 'overview') => {
    setSelectedEmpRow(row);
    setManageTab(initialTab);
    setManageModalOpen(true);
    setProfileLoading(true);

    const sal = row.employee?.salaryDetails || {};
    const b = row.employee?.bankDetails || {};
    const basic = Number(sal.basicSalary) || 0;
    setSalaryForm({
      basicSalary: basic,
      hra: sal.hra !== undefined ? Number(sal.hra) : Math.round(basic * 0.4),
      conveyance: Number(sal.conveyance) || 0,
      medicalAllowance: Number(sal.medicalAllowance) || 0,
      specialAllowance: Number(sal.specialAllowance) || 0,
      allowances: Number(sal.allowances) || 0,
      bonus: Number(sal.bonus) || 0,
      pf: sal.pf !== undefined ? Number(sal.pf) : (basic > 0 ? Math.round(Math.min(basic, 15000) * 0.12) : 0),
      professionalTax: sal.professionalTax !== undefined ? Number(sal.professionalTax) : (basic > 15000 ? 200 : 0),
      tds: Number(sal.tds) || 0,
      accountHolderName: b.accountHolderName || row.name,
      bankName: b.bankName || '',
      accountNumber: b.accountNumber || '',
      ifscCode: b.ifscCode || '',
      branchName: b.branchName || '',
    });

    setNewPrForm({ amount: row.netSalary || '', reason: `Payroll payment request for ${selectedMonth}`, priority: 'High' });

    try {
      const res = await apiClient.get(`/finance/payroll/employee/${row.employee._id}/profile?month=${encodeURIComponent(selectedMonth)}`);
      setProfileData(res.data?.data || null);
    } catch (err) {
      console.error('Failed to load employee payroll profile:', err);
      showNotice('error', 'Failed to load complete employee profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const refreshManagePanel = async () => {
    if (!selectedEmpRow) return;
    setProfileLoading(true);
    try {
      const res = await apiClient.get(`/finance/payroll/employee/${selectedEmpRow.employee._id}/profile?month=${encodeURIComponent(selectedMonth)}`);
      setProfileData(res.data?.data || null);
      await fetchMonthData(selectedMonth);
    } catch (err) {
      console.error('Failed to refresh manage panel:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  // ─── 4. Recalculate Payroll ───
  const handleRecalculate = async (payrollId) => {
    if (!payrollId) {
      showNotice('error', 'Cannot recalculate: No payroll generated for this month yet. Click Generate Monthly Payroll first.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiClient.post(`/finance/payroll/recalculate/${payrollId}`);
      showNotice('success', res.data?.message || 'Payroll recalculated successfully');
      await refreshManagePanel();
    } catch (err) {
      showNotice('error', err.response?.data?.message || 'Failed to recalculate payroll');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── 5. Approve Payroll ───
  const handleApprove = async (payrollId) => {
    if (!payrollId) return;
    setActionLoading(true);
    try {
      const res = await apiClient.post(`/finance/payroll/${payrollId}/approve`);
      showNotice('success', res.data?.message || 'Payroll approved for payment');
      await refreshManagePanel();
    } catch (err) {
      showNotice('error', err.response?.data?.message || 'Failed to approve payroll');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── 6. Bulk Approve ───
  const handleBulkApprove = async () => {
    if (!window.confirm(`Approve all pending payroll slips for ${selectedMonth}?`)) return;
    setActionLoading(true);
    try {
      const res = await apiClient.post('/finance/payroll/bulk-approve', { month: selectedMonth });
      showNotice('success', res.data?.message || 'Bulk payroll approved successfully');
      await fetchMonthData(selectedMonth);
    } catch (err) {
      showNotice('error', err.response?.data?.message || 'Failed to bulk approve payroll');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── 7. Open Disbursal Modal ───
  const openDisburseModal = (payrollSlipOrBulk) => {
    setDisburseTarget(payrollSlipOrBulk);
    setDisburseForm({
      bankAccountId: bankAccounts[0]?._id || '',
      paymentMethod: 'Bank Transfer',
      transactionReference: `NEFT-${Date.now().toString().slice(-6)}`,
      notes: payrollSlipOrBulk === 'bulk' ? `Bulk salary disbursal for ${selectedMonth}` : `Salary disbursal for ${selectedEmpRow?.name || 'employee'} (${selectedMonth})`,
    });
    setDisburseModalOpen(true);
  };

  const handleConfirmDisbursal = async () => {
    setDisbursing(true);
    try {
      if (disburseTarget === 'bulk') {
        const res = await apiClient.post('/finance/payroll/bulk-pay', {
          month: selectedMonth,
          bankAccountId: disburseForm.bankAccountId,
          paymentMethod: disburseForm.paymentMethod,
          transactionReference: disburseForm.transactionReference,
        });
        showNotice('success', res.data?.message || 'Bulk salary disbursed successfully');
        setDisburseModalOpen(false);
        await fetchMonthData(selectedMonth);
      } else if (disburseTarget?._isPaymentRequest) {
        // Disbursing Payment Request
        const res = await apiClient.post(`/finance/payment-requests/${disburseTarget._id}/pay`, {
          bankAccountId: disburseForm.bankAccountId,
          paymentMethod: disburseForm.paymentMethod,
          transactionReference: disburseForm.transactionReference,
        });
        showNotice('success', res.data?.message || 'Payment request disbursed successfully');
        setDisburseModalOpen(false);
        await refreshManagePanel();
      } else {
        const res = await apiClient.post(`/finance/payroll/${disburseTarget._id}/pay`, disburseForm);
        showNotice('success', res.data?.message || 'Salary disbursed and recorded in Finance');
        setDisburseModalOpen(false);
        await refreshManagePanel();
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      showNotice('error', err.response?.data?.message || 'Failed to disburse salary');
    } finally {
      setDisbursing(false);
    }
  };

  // ─── 8. Save Salary Structure ───
  const handleSaveSalaryStructure = async (e) => {
    e.preventDefault();
    setSalarySaving(true);
    try {
      const payload = {
        basicSalary: Number(salaryForm.basicSalary) || 0,
        hra: Number(salaryForm.hra) || 0,
        conveyance: Number(salaryForm.conveyance) || 0,
        medicalAllowance: Number(salaryForm.medicalAllowance) || 0,
        specialAllowance: Number(salaryForm.specialAllowance) || 0,
        pf: Number(salaryForm.pf) || 0,
        professionalTax: Number(salaryForm.professionalTax) || 0,
        tds: Number(salaryForm.tds) || 0,
        bankDetails: {
          accountHolderName: salaryForm.accountHolderName,
          bankName: salaryForm.bankName,
          accountNumber: salaryForm.accountNumber,
          ifscCode: salaryForm.ifscCode,
          branchName: salaryForm.branchName,
        },
      };

      await apiClient.put(`/finance/salary/employees/${selectedEmpRow.employee._id}`, payload);
      showNotice('success', 'Salary structure & bank details updated in database');

      if (selectedEmpRow.payroll?._id && selectedEmpRow.payroll.status !== 'Paid') {
        await apiClient.post(`/finance/payroll/recalculate/${selectedEmpRow.payroll._id}`);
      }

      await refreshManagePanel();
    } catch (err) {
      showNotice('error', err.response?.data?.message || 'Failed to update salary structure');
    } finally {
      setSalarySaving(false);
    }
  };

  // ─── 9. Add Bonus / Incentive ───
  const handleSaveBonus = async (e) => {
    e.preventDefault();
    if (!bonusForm.amount || Number(bonusForm.amount) <= 0) {
      showNotice('error', 'Enter a valid positive amount');
      return;
    }
    setBonusSaving(true);
    try {
      await apiClient.post('/finance/salary/extra', {
        employeeId: selectedEmpRow.employee._id,
        type: bonusForm.type,
        amount: Number(bonusForm.amount),
        periodMonth: selectedMonth,
        reason: bonusForm.reason || `${bonusForm.type} for ${selectedMonth}`,
      });
      showNotice('success', `${bonusForm.type} added successfully`);
      setBonusForm({ type: 'Bonus', amount: '', reason: '' });

      if (selectedEmpRow.payroll?._id && selectedEmpRow.payroll.status !== 'Paid') {
        await apiClient.post(`/finance/payroll/recalculate/${selectedEmpRow.payroll._id}`);
      }

      await refreshManagePanel();
    } catch (err) {
      showNotice('error', err.response?.data?.message || 'Failed to add bonus/incentive');
    } finally {
      setBonusSaving(false);
    }
  };

  const handleDeleteBonus = async (extraId) => {
    if (!window.confirm('Delete this bonus/incentive entry?')) return;
    try {
      await apiClient.delete(`/finance/salary/extra/${extraId}`);
      showNotice('success', 'Bonus/incentive removed');
      if (selectedEmpRow.payroll?._id && selectedEmpRow.payroll.status !== 'Paid') {
        await apiClient.post(`/finance/payroll/recalculate/${selectedEmpRow.payroll._id}`);
      }
      await refreshManagePanel();
    } catch (err) {
      showNotice('error', err.response?.data?.message || 'Failed to remove bonus');
    }
  };

  // ─── 10. Add / Manage Recovery (Loan & Salary Advance) ───
  const handleSaveRecovery = async (e, empId = selectedEmpRow?.employee?._id) => {
    if (e) e.preventDefault();
    if (!recoveryForm.disbursedAmount || Number(recoveryForm.disbursedAmount) <= 0) {
      showNotice('error', 'Enter a valid amount');
      return;
    }
    setRecoverySaving(true);
    try {
      await apiClient.post('/finance/salary/advances', {
        employeeId: empId,
        advanceType: recoveryForm.advanceType,
        disbursedAmount: Number(recoveryForm.disbursedAmount),
        monthlyDeduction: Number(recoveryForm.monthlyDeduction) || (Number(recoveryForm.disbursedAmount) / (Number(recoveryForm.repaymentMonths) || 1)),
        repaymentMonths: Number(recoveryForm.repaymentMonths) || 1,
        reason: recoveryForm.reason || `${recoveryForm.advanceType} allocation`,
      });
      showNotice('success', `${recoveryForm.advanceType} schedule created`);
      setRecoveryForm({ advanceType: 'Salary Advance', disbursedAmount: '', monthlyDeduction: '', reason: '', repaymentMonths: 3 });

      if (selectedEmpRow?.payroll?._id && selectedEmpRow.payroll.status !== 'Paid') {
        await apiClient.post(`/finance/payroll/recalculate/${selectedEmpRow.payroll._id}`);
      }
      await refreshManagePanel();
    } catch (err) {
      showNotice('error', err.response?.data?.message || 'Failed to create recovery schedule');
    } finally {
      setRecoverySaving(false);
    }
  };

  const handleToggleRecoveryPause = async (advId, isPaused) => {
    try {
      const endpoint = isPaused ? `/finance/salary/advances/${advId}/resume` : `/finance/salary/advances/${advId}/pause`;
      await apiClient.post(endpoint);
      showNotice('success', isPaused ? 'Recovery resumed' : 'Recovery paused');
      if (selectedEmpRow?.payroll?._id && selectedEmpRow.payroll.status !== 'Paid') {
        await apiClient.post(`/finance/payroll/recalculate/${selectedEmpRow.payroll._id}`);
      }
      await refreshManagePanel();
      await fetchMonthData(selectedMonth);
    } catch (err) {
      showNotice('error', err.response?.data?.message || 'Failed to update recovery state');
    }
  };

  // ─── 11. Create / Manage Payment Request for Employee ───
  const handleCreatePaymentRequest = async (e) => {
    e.preventDefault();
    if (!newPrForm.amount || Number(newPrForm.amount) <= 0) {
      showNotice('error', 'Enter a valid amount');
      return;
    }
    setNewPrSaving(true);
    try {
      await apiClient.post('/finance/payment-requests', {
        paymentType: 'Employee',
        payeeName: selectedEmpRow.name,
        employee: selectedEmpRow.employee._id,
        amount: Number(newPrForm.amount),
        reason: newPrForm.reason || `Salary Payment Request for ${selectedEmpRow.name} (${selectedMonth})`,
        priority: newPrForm.priority || 'High',
      });
      showNotice('success', 'Payment request submitted for approval');
      setNewPrForm({ amount: '', reason: '', priority: 'Medium' });
      await refreshManagePanel();
    } catch (err) {
      showNotice('error', err.response?.data?.message || 'Failed to submit payment request');
    } finally {
      setNewPrSaving(false);
    }
  };

  const handleApprovePaymentRequest = async (requestId) => {
    try {
      await apiClient.post(`/finance/payment-requests/${requestId}/approve`);
      showNotice('success', 'Payment request approved for disbursal');
      await fetchMonthData(selectedMonth);
      if (manageModalOpen) await refreshManagePanel();
      if (viewPrModalOpen && selectedPr?._id === requestId) {
        setSelectedPr((prev) => ({ ...prev, status: 'Approved' }));
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      showNotice('error', err.response?.data?.message || 'Failed to approve request');
    }
  };

  const handleOpenRejectModal = (requestId) => {
    setRejectTargetId(requestId);
    setRejectReasonText('');
    setRejectPrModalOpen(true);
  };

  const handleConfirmRejectPaymentRequest = async () => {
    if (!rejectTargetId) return;
    try {
      setRejectingPr(true);
      await apiClient.post(`/finance/payment-requests/${rejectTargetId}/reject`, {
        reason: rejectReasonText.trim() || 'Rejected by Finance / Management',
      });
      showNotice('success', 'Payment request marked as Rejected');
      setRejectPrModalOpen(false);
      setRejectTargetId(null);
      setRejectReasonText('');
      await fetchMonthData(selectedMonth);
      if (manageModalOpen) await refreshManagePanel();
      if (viewPrModalOpen && selectedPr?._id === rejectTargetId) {
        setSelectedPr((prev) => ({ ...prev, status: 'Rejected', rejectionReason: rejectReasonText }));
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      showNotice('error', err.response?.data?.message || 'Failed to reject request');
    } finally {
      setRejectingPr(false);
    }
  };

  // ─── 11b. Create Payment Request Modal Functions ───
  const openCreatePaymentRequestModal = () => {
    const reqNumPreview = `REQ-${new Date().getFullYear()}-${String(allPaymentRequests.length + 1).padStart(4, '0')}`;
    setCreatePrForm({
      requestNumber: reqNumPreview,
      requestDate: new Date().toISOString().slice(0, 10),
      paymentType: 'Vendor Payment',
      priority: 'Medium',
      department: user?.department || 'Finance',
      requester: user?.userId || user?._id || (allEmployees[0]?._id || ''),
      requesterName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || '',
      requiredDate: '',
      vendor: vendors[0]?._id || '',
      vendorBill: '',
      vendorBillNumber: '',
      employee: allEmployees[0]?._id || '',
      expenseCategory: 'Travel & Conveyance',
      expenseDate: new Date().toISOString().slice(0, 10),
      payeeName: '',
      amount: '',
      reason: '',
      description: '',
      paymentMethod: 'Bank Transfer',
      preferredPaymentDate: '',
      referenceNumber: '',
      repaymentPlan: 'Monthly Deduction from Payroll',
      installments: 3,
      notes: '',
      supportingDocumentUrl: '',
    });
    setUploadedDocName('');
    setCreatePrErrors({});
    setCreatePrModalOpen(true);
  };

  const handlePrFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadingDoc(true);
      const res = await apiClient.post('/finance/payment-requests/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.data?.url) {
        setCreatePrForm((prev) => ({
          ...prev,
          supportingDocumentUrl: res.data.data.url,
        }));
        setUploadedDocName(file.name);
        showNotice('success', `File "${file.name}" uploaded successfully`);
      }
    } catch (err) {
      showNotice('error', err.response?.data?.message || 'Failed to upload document');
    } finally {
      setUploadingDoc(false);
    }
  };

  const validatePrForm = () => {
    const errs = {};
    if (!createPrForm.paymentType) errs.paymentType = 'Request Type is required';
    if (!createPrForm.department) errs.department = 'Department is required';
    if (!createPrForm.amount || Number(createPrForm.amount) <= 0) {
      errs.amount = 'Amount must be a valid positive number';
    }

    if (createPrForm.paymentType === 'Vendor Payment') {
      if (!createPrForm.vendor) errs.vendor = 'Vendor is required';
      if (!createPrForm.reason?.trim() && !createPrForm.description?.trim()) {
        errs.reason = 'Payment purpose is required';
      }
    } else if (createPrForm.paymentType === 'Employee Reimbursement') {
      if (!createPrForm.employee) errs.employee = 'Employee is required';
      if (!createPrForm.expenseCategory) errs.expenseCategory = 'Expense category is required';
      if (!createPrForm.reason?.trim() && !createPrForm.description?.trim()) {
        errs.reason = 'Description / reason is required';
      }
    } else if (createPrForm.paymentType === 'Salary Advance' || createPrForm.paymentType === 'Employee Loan') {
      if (!createPrForm.employee) errs.employee = 'Employee is required';
      if (!createPrForm.reason?.trim() && !createPrForm.description?.trim()) {
        errs.reason = 'Reason / purpose is required';
      }
    } else if (createPrForm.paymentType === 'Company Expense') {
      if (!createPrForm.payeeName?.trim()) errs.payeeName = 'Payee is required';
      if (!createPrForm.expenseCategory) errs.expenseCategory = 'Expense category is required';
      if (!createPrForm.reason?.trim() && !createPrForm.description?.trim()) {
        errs.reason = 'Purpose is required';
      }
    } else {
      if (!createPrForm.payeeName?.trim()) errs.payeeName = 'Payee name is required';
      if (!createPrForm.reason?.trim() && !createPrForm.description?.trim()) {
        errs.reason = 'Payment purpose is required';
      }
    }

    setCreatePrErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreatePrSubmit = async (e) => {
    e.preventDefault();
    if (!validatePrForm()) {
      showNotice('error', 'Please resolve all required fields highlighted in red');
      return;
    }

    setCreatePrSubmitting(true);
    try {
      // Resolve payeeName if needed
      let payeeName = createPrForm.payeeName?.trim();
      if (createPrForm.paymentType === 'Vendor Payment' && !payeeName) {
        const v = vendors.find((x) => String(x._id) === String(createPrForm.vendor));
        payeeName = v?.companyName || v?.name || 'Vendor';
      } else if (['Employee Reimbursement', 'Salary Advance', 'Employee Loan'].includes(createPrForm.paymentType) && !payeeName) {
        const emp = allEmployees.find((x) => String(x._id) === String(createPrForm.employee));
        payeeName = [emp?.firstName, emp?.lastName].filter(Boolean).join(' ') || emp?.email || 'Employee';
      }

      const payload = {
        requestNumber: createPrForm.requestNumber,
        paymentType: createPrForm.paymentType,
        priority: createPrForm.priority,
        department: createPrForm.department,
        requester: createPrForm.requester,
        requesterName: createPrForm.requesterName,
        requiredDate: createPrForm.requiredDate || null,
        payeeName,
        vendor: createPrForm.vendor || null,
        vendorBill: createPrForm.vendorBill || null,
        vendorBillNumber: createPrForm.vendorBillNumber || '',
        employee: createPrForm.employee || null,
        amount: Number(createPrForm.amount),
        reason: (createPrForm.reason || createPrForm.description || '').trim(),
        description: createPrForm.description?.trim() || '',
        expenseCategory: createPrForm.expenseCategory || '',
        expenseDate: createPrForm.expenseDate || null,
        paymentMethod: createPrForm.paymentMethod || 'Bank Transfer',
        preferredPaymentDate: createPrForm.preferredPaymentDate || null,
        referenceNumber: createPrForm.referenceNumber || '',
        repaymentPlan: createPrForm.repaymentPlan || '',
        installments: Number(createPrForm.installments) || 1,
        notes: createPrForm.notes || '',
        supportingDocumentUrl: createPrForm.supportingDocumentUrl || '',
      };

      const res = await apiClient.post('/finance/payment-requests', payload);
      const createdItem = res.data?.data;
      showNotice('success', `Payment Request ${createdItem?.requestNumber || ''} created successfully!`);

      setCreatePrModalOpen(false);
      await fetchMonthData(selectedMonth);
      if (onRefresh) onRefresh();
    } catch (err) {
      showNotice('error', err.response?.data?.message || 'Failed to submit payment request');
    } finally {
      setCreatePrSubmitting(false);
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'Urgent':
        return { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' };
      case 'High':
        return { background: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa' };
      case 'Medium':
        return { background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' };
      case 'Low':
      default:
        return { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' };
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'Vendor Payment':
      case 'Vendor':
        return { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #dbeafe', icon: '🏢' };
      case 'Employee Reimbursement':
        return { background: '#f0fdf4', color: '#15803d', border: '1px solid #dcfce7', icon: '🧾' };
      case 'Salary Advance':
        return { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', icon: '💰' };
      case 'Employee Loan':
        return { background: '#fdf4ff', color: '#86198f', border: '1px solid #f5d0fe', icon: '🏦' };
      case 'Company Expense':
        return { background: '#fff1f2', color: '#be123c', border: '1px solid #ffe4e6', icon: '💼' };
      case 'Other':
      default:
        return { background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', icon: '📌' };
    }
  };

  // ─── 12. View / Print Payslip ───
  const openPayslip = async (payrollSlip) => {
    if (!payrollSlip?._id) {
      showNotice('error', 'No payroll generated for this employee yet. Please generate monthly payroll first.');
      return;
    }
    setPayslipLoading(true);
    setPayslipModalOpen(true);
    try {
      const res = await apiClient.get(`/finance/payroll/${payrollSlip._id}/payslip`);
      setPayslipData(res.data?.data || null);
    } catch (err) {
      showNotice('error', err.response?.data?.message || 'Failed to fetch payslip details');
    } finally {
      setPayslipLoading(false);
    }
  };

  // ─── 13. Generate Monthly Payroll Pre-flight & Submit ───
  const openGenerateModal = () => {
    const parts = selectedMonth.split(' ');
    setGenForm({
      month: parts[0] || 'September',
      year: parts[1] || '2026',
      department: 'All',
    });

    const configured = allEmployees.filter((e) => Number(e.salaryDetails?.basicSalary) > 0).length;
    const missing = allEmployees.length - configured;
    const existing = payrollRows.filter((r) => r.hasPayroll).length;

    setGenStats({
      totalActive: allEmployees.length,
      salaryConfigured: configured,
      missingSalary: missing,
      alreadyGenerated: existing,
      readyToGenerate: Math.max(0, allEmployees.length - existing),
    });
    setGenerateModalOpen(true);
  };

  const handleGeneratePayrollSubmit = async (e) => {
    e.preventDefault();
    setGenLoading(true);
    const monthPeriod = `${genForm.month} ${genForm.year}`;
    try {
      const res = await apiClient.post('/finance/payroll/generate', {
        month: monthPeriod,
        department: genForm.department,
      });

      const data = res.data?.data || {};
      showNotice('success', `Payroll processed! ${data.generatedCount || 0} slips created, ${data.skippedCount || 0} existing skipped.`);
      setGenerateModalOpen(false);
      setSelectedMonth(monthPeriod);
      await fetchMonthData(monthPeriod);
    } catch (err) {
      showNotice('error', err.response?.data?.message || 'Failed to generate monthly payroll');
    } finally {
      setGenLoading(false);
    }
  };

  // ─── Status Badge Colors ───
  const getStatusBadge = (status) => {
    const s = String(status || 'Draft').toLowerCase();
    if (s === 'paid') return { bg: '#dcfce7', text: '#166534', border: '#bbf7d0', label: 'Paid' };
    if (s === 'approved') return { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd', label: 'Approved' };
    if (s === 'calculated' || s === 'pending approval' || s === 'submitted') return { bg: '#fef3c7', text: '#92400e', border: '#fde68a', label: 'Calculated' };
    if (s === 'payment processing') return { bg: '#f3e8ff', text: '#6b21a8', border: '#e9d5ff', label: 'Processing' };
    if (s === 'rejected') return { bg: '#fee2e2', text: '#991b1b', border: '#fecaca', label: 'Rejected' };
    return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0', label: 'Draft' };
  };

  // Payment Requests Counts & Totals
  const prPendingCount = allPaymentRequests.filter((p) => p.status === 'Submitted').length;
  const prApprovedCount = allPaymentRequests.filter((p) => p.status === 'Approved').length;
  const prPaidCount = allPaymentRequests.filter((p) => p.status === 'Paid').length;
  const prTotalAmount = allPaymentRequests.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const prPendingAmount = allPaymentRequests.filter((p) => p.status === 'Submitted').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const prApprovedAmount = allPaymentRequests.filter((p) => p.status === 'Approved').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const prPaidAmount = allPaymentRequests.filter((p) => p.status === 'Paid').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // ─── Filtered Payment Requests for Full-Page CRM Table ───
  const filteredPaymentRequests = useMemo(() => {
    return allPaymentRequests.filter((p) => {
      if (prSearch) {
        const q = prSearch.toLowerCase();
        const matchesNum = (p.requestNumber || '').toLowerCase().includes(q);
        const matchesPayee = (p.payeeName || '').toLowerCase().includes(q);
        const matchesPurpose = (p.purpose || p.reason || '').toLowerCase().includes(q);
        const reqStr = (p.requester?.firstName ? `${p.requester.firstName} ${p.requester.lastName || ''}` : p.requesterName || '').toLowerCase();
        const matchesRequester = reqStr.includes(q);
        const matchesRef = (p.referenceNumber || p.vendorBillNumber || '').toLowerCase().includes(q);
        if (!matchesNum && !matchesPayee && !matchesPurpose && !matchesRequester && !matchesRef) {
          return false;
        }
      }
      if (prStatusFilter !== 'All' && p.status !== prStatusFilter) {
        return false;
      }
      if (prTypeFilter !== 'All' && (p.paymentType || p.requestType) !== prTypeFilter) {
        return false;
      }
      if (prPriorityFilter !== 'All' && p.priority !== prPriorityFilter) {
        return false;
      }
      return true;
    });
  }, [allPaymentRequests, prSearch, prStatusFilter, prTypeFilter, prPriorityFilter]);

  // ─── Filtered Loan & Advance Recoveries for Full-Page CRM Table ───
  const filteredAdvances = useMemo(() => {
    return allAdvances.filter((adv) => {
      if (advSearch) {
        const q = advSearch.toLowerCase();
        const empName = (adv.employeeName || '').toLowerCase();
        const empId = (adv.employeeId || '').toLowerCase();
        const advType = (adv.advanceType || '').toLowerCase();
        if (!empName.includes(q) && !empId.includes(q) && !advType.includes(q)) {
          return false;
        }
      }
      if (advStatusFilter !== 'All' && adv.status !== advStatusFilter) {
        return false;
      }
      if (advTypeFilter !== 'All' && (adv.advanceType || 'Salary Advance') !== advTypeFilter) {
        return false;
      }
      return true;
    });
  }, [allAdvances, advSearch, advStatusFilter, advTypeFilter]);

  return (
    <div className="fin-central-payroll" style={{ padding: '0 0 2rem 0', fontFamily: 'inherit' }}>
      {/* ─── Global Flash Notification ─── */}
      {notification.text && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 99999,
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 600,
            fontSize: '14px',
            background: notification.type === 'error' ? '#fef2f2' : '#f0fdf4',
            color: notification.type === 'error' ? '#991b1b' : '#166534',
            border: `1px solid ${notification.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
            animation: 'fadeIn 0.3s ease-in-out',
          }}
        >
          <span>{notification.type === 'error' ? '⚠️' : '✓'}</span>
          <span>{notification.text}</span>
        </div>
      )}

      {/* ─── Master Tab Bar: Only 2 tabs (Company Payment Requests & Loan & Advance Recovery) ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '1.25rem',
          paddingBottom: '0.85rem',
          borderBottom: '1px solid #e2e8f0',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => setMainView((prev) => (prev === 'requests' ? 'payroll' : 'requests'))}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 700,
            background: mainView === 'requests' ? '#FFE8D2' : '#FFF4E8',
            color: '#E85D04',
            border: mainView === 'requests' ? '2px solid #E85D04' : '1px solid #F5B97A',
            cursor: 'pointer',
            boxShadow: mainView === 'requests' ? '0 1px 3px rgba(232, 93, 4, 0.15)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <span>📋 Company Payment Requests</span>
          <span
            style={{
              background: '#ffffff',
              color: '#E85D04',
              padding: '2px 8px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 800,
              border: '1px solid #F5B97A',
            }}
          >
            {allPaymentRequests.length}
          </span>
          {prPendingCount > 0 && (
            <span
              style={{
                background: '#fef08a',
                color: '#854d0e',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10.5px',
                fontWeight: 800,
              }}
            >
              {prPendingCount} Pending
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setMainView((prev) => (prev === 'recovery' ? 'payroll' : 'recovery'))}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 700,
            background: mainView === 'recovery' ? '#FFE8D2' : '#FFF4E8',
            color: '#E85D04',
            border: mainView === 'recovery' ? '2px solid #E85D04' : '1px solid #F5B97A',
            cursor: 'pointer',
            boxShadow: mainView === 'recovery' ? '0 1px 3px rgba(232, 93, 4, 0.15)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <span>💰 Loan & Advance Recovery</span>
          <span
            style={{
              background: '#ffffff',
              color: '#E85D04',
              padding: '2px 8px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 800,
              border: '1px solid #F5B97A',
            }}
          >
            {allAdvances.length}
          </span>
          {advancesSummary.balanceOutstanding > 0 && (
            <span
              style={{
                background: '#fee2e2',
                color: '#991b1b',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10.5px',
                fontWeight: 800,
              }}
            >
              {formatCurrency(advancesSummary.balanceOutstanding)} Due
            </span>
          )}
        </button>
      </div>

      {mainView === 'payroll' && (
        <div>
          {/* ─── 1. Header Row: Title, Month Dropdown & Generate Action ─── */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1.25rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
              <div>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                  PAYROLL MANAGEMENT
                </h1>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.86rem', color: '#64748b' }}>
                  Central enterprise payroll lifecycle, automated calculations, approvals and banking disbursals
                </p>
              </div>

              {/* Month / Year Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '4px 10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#9a3412' }}>Period:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontWeight: 700,
                    fontSize: '14px',
                    color: '#1e293b',
                    cursor: 'pointer',
                  }}
                >
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Top Actions: Generate Monthly Payroll & Bulk Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              {isFinanceAdmin && (
                <>
                  <button
                    type="button"
                    onClick={handleBulkApprove}
                    disabled={actionLoading || summary.pendingCount === 0}
                    style={{
                      background: '#f8fafc',
                      color: '#0f172a',
                      border: '1px solid #cbd5e1',
                      borderRadius: '7px',
                      padding: '9px 14px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: summary.pendingCount > 0 ? 'pointer' : 'not-allowed',
                      opacity: summary.pendingCount > 0 ? 1 : 0.6,
                    }}
                    title="Bulk approve all pending slips for this month"
                  >
                    ✓ Bulk Approve ({summary.pendingCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => openDisburseModal('bulk')}
                    disabled={actionLoading || summary.pendingCount === 0}
                    style={{
                      background: '#f8fafc',
                      color: '#166534',
                      border: '1px solid #86efac',
                      borderRadius: '7px',
                      padding: '9px 14px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: summary.pendingCount > 0 ? 'pointer' : 'not-allowed',
                      opacity: summary.pendingCount > 0 ? 1 : 0.6,
                    }}
                    title="Bulk disburse salary through company bank account"
                  >
                    💳 Bulk Disburse
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={openGenerateModal}
                style={{
                  background: '#FFF4E8',
                  color: '#E85D04',
                  border: '1px solid #F5B97A',
                  borderRadius: '7px',
                  padding: '9px 18px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span>
                <span>Generate Monthly Payroll</span>
              </button>
            </div>
          </div>

          {/* ─── FINANCE QUICK MANAGEMENT (Compact, Light-Orange Workspace Toolbar) ─── */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #fed7aa',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              marginBottom: '1.15rem',
              boxShadow: '0 1px 3px rgba(234, 88, 12, 0.04)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.65rem',
                flexWrap: 'wrap',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 800,
                    color: '#c2410c',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  ⚡ FINANCE QUICK MANAGEMENT
                </span>
                <span
                  style={{
                    background: '#fff7ed',
                    color: '#ea580c',
                    border: '1px solid #ffedd5',
                    fontSize: '10.5px',
                    padding: '1px 7px',
                    borderRadius: '999px',
                    fontWeight: 700,
                  }}
                >
                  Direct Control Center
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Manage salaries, requests, payments, recoveries, payslips & history
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => handleOpenAddSalary()}
                style={{
                  background: '#FFF4E8',
                  color: '#E85D04',
                  border: '1px solid #F5B97A',
                  borderRadius: '7px',
                  padding: '8px 12px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>+</span>
                <span>Add Salary</span>
              </button>

              <button
                type="button"
                onClick={openCreatePaymentRequestModal}
                style={{
                  background: '#FFF4E8',
                  color: '#E85D04',
                  border: '1px solid #F5B97A',
                  borderRadius: '7px',
                  padding: '8px 12px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>+</span>
                <span>New Payment Request</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenRecordPayment()}
                style={{
                  background: '#FFF4E8',
                  color: '#E85D04',
                  border: '1px solid #F5B97A',
                  borderRadius: '7px',
                  padding: '8px 12px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>+</span>
                <span>Record Payment</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenAddRecovery()}
                style={{
                  background: '#FFF4E8',
                  color: '#E85D04',
                  border: '1px solid #F5B97A',
                  borderRadius: '7px',
                  padding: '8px 12px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>+</span>
                <span>Add Recovery</span>
              </button>

              <button
                type="button"
                onClick={handleOpenQuickPayslip}
                style={{
                  background: '#FFF4E8',
                  color: '#E85D04',
                  border: '1px solid #F5B97A',
                  borderRadius: '7px',
                  padding: '8px 12px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>📄</span>
                <span>Generate Payslip</span>
              </button>

              <button
                type="button"
                onClick={handleOpenApprovals}
                style={{
                  background: '#FFF4E8',
                  color: '#E85D04',
                  border: '1px solid #F5B97A',
                  borderRadius: '7px',
                  padding: '8px 12px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>🛡️</span>
                <span>Manage Approvals</span>
              </button>

              <button
                type="button"
                onClick={handleOpenPayrollHistory}
                style={{
                  background: '#FFF4E8',
                  color: '#E85D04',
                  border: '1px solid #F5B97A',
                  borderRadius: '7px',
                  padding: '8px 12px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>📜</span>
                <span>Payroll History</span>
              </button>
            </div>
          </div>

          {/* ─── 2. Dynamic Summary Cards (Real Database Computed) ─── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.85rem',
              marginBottom: '1.15rem',
            }}
          >
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Employees</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{summary.totalEmployees}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{summary.generatedCount} generated for {selectedMonth}</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gross Payroll</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>{formatCurrency(summary.grossPayroll)}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Base salary + allowances + extra</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Deductions</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626', marginTop: '4px' }}>{formatCurrency(summary.totalDeductions)}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>PF, PT, TDS, LOP & loans</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', borderLeft: '4px solid #ea580c' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Net Payroll</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ea580c', marginTop: '4px' }}>{formatCurrency(summary.netPayroll)}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Total payable obligations</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', borderLeft: '4px solid #16a34a' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Paid</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>{formatCurrency(summary.paidAmount)}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{summary.paidCount} employees disbursed</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', borderLeft: '4px solid #d97706' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pending</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>{formatCurrency(summary.pendingAmount)}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{summary.pendingCount} pending disbursal</div>
            </div>
          </div>

          {/* ─── 3. Search & Filter Bar ─── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
              marginBottom: '1rem',
              padding: '0.85rem 1rem',
              background: '#fff',
              borderRadius: '9px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ flex: '1 1 260px', position: 'relative' }}>
              <input
                type="text"
                placeholder="Search employee by name, ID or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 12px 8px 32px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
              <span style={{ position: 'absolute', left: '10px', top: '8px', color: '#94a3b8', fontSize: '14px' }}>🔍</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Dept:</span>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
              >
                <option value="All">All Departments</option>
                <option value="Tech">Tech</option>
                <option value="HR">HR</option>
                <option value="Finance">Finance</option>
                <option value="Business Development">Business Development</option>
                <option value="Digital Marketing">Digital Marketing</option>
                <option value="Video Editor">Video Editor</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Payroll:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
              >
                <option value="All">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Calculated">Calculated</option>
                <option value="Approved">Approved</option>
                <option value="Paid">Paid</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Bank:</span>
              <select
                value={bankFilter}
                onChange={(e) => setBankFilter(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
              >
                <option value="All">All Bank Statuses</option>
                <option value="Verified">Verified</option>
                <option value="Pending Bank Setup">Pending Setup</option>
              </select>
            </div>

            {(search || deptFilter !== 'All' || statusFilter !== 'All' || bankFilter !== 'All') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setDeptFilter('All');
                  setStatusFilter('All');
                  setPaymentFilter('All');
                  setBankFilter('All');
                }}
                style={{
                  padding: '7px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  fontSize: '12px',
                  color: '#64748b',
                  cursor: 'pointer',
                }}
              >
                Reset
              </button>
            )}

            <div style={{ marginLeft: 'auto', fontSize: '12.5px', color: '#64748b', fontWeight: 600 }}>
              Showing {filteredRows.length} of {payrollRows.length} employees
            </div>
          </div>

          {/* ─── 5. Employee Payroll Table ─── */}
          <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    <th style={{ padding: '12px 14px' }}>Employee</th>
                    <th style={{ padding: '12px 12px' }}>ID</th>
                    <th style={{ padding: '12px 12px' }}>Department / Role</th>
                    <th style={{ padding: '12px 12px', textAlign: 'right' }}>Basic Salary</th>
                    <th style={{ padding: '12px 12px', textAlign: 'right' }}>Earnings</th>
                    <th style={{ padding: '12px 12px', textAlign: 'right' }}>Deductions</th>
                    <th style={{ padding: '12px 12px', textAlign: 'right' }}>Gross Salary</th>
                    <th style={{ padding: '12px 12px', textAlign: 'right' }}>Net Salary</th>
                    <th style={{ padding: '12px 12px', textAlign: 'center' }}>Bank Status</th>
                    <th style={{ padding: '12px 12px', textAlign: 'center' }}>Payroll Status</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                        <div style={{ display: 'inline-block', width: '22px', height: '22px', border: '3px solid #cbd5e1', borderTopColor: '#ea580c', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        <div style={{ marginTop: '8px', fontWeight: 600 }}>Loading employee payroll records for {selectedMonth}...</div>
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📋</div>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>No employees found matching filter criteria</div>
                        <p style={{ margin: '4px 0 0', fontSize: '13px' }}>Try resetting search filters or click "Generate Monthly Payroll" to compute slips for {selectedMonth}.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const badge = getStatusBadge(row.payrollStatus);
                      return (
                        <tr
                          key={row.employee._id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#fafafa')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                        >
                          {/* Employee */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  background: '#fed7aa',
                                  color: '#9a3412',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 800,
                                  fontSize: '13px',
                                  flexShrink: 0,
                                }}
                              >
                                {row.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.name}</div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>{row.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Employee ID */}
                          <td style={{ padding: '12px 12px', fontWeight: 600, color: '#334155' }}>
                            {row.employeeId}
                          </td>

                          {/* Department / Role */}
                          <td style={{ padding: '12px 12px' }}>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{row.department}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{row.designation}</div>
                          </td>

                          {/* Basic Salary */}
                          <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                            {formatCurrency(row.basicSalary)}
                          </td>

                          {/* Earnings */}
                          <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#0284c7' }}>
                            +{formatCurrency(row.earnings)}
                          </td>

                          {/* Deductions */}
                          <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>
                            -{formatCurrency(row.deductions)}
                          </td>

                          {/* Gross Salary */}
                          <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>
                            {formatCurrency(row.grossSalary)}
                          </td>

                          {/* Net Salary */}
                          <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '13.5px' }}>
                            {formatCurrency(row.netSalary)}
                          </td>

                          {/* Bank Status */}
                          <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 9px',
                                borderRadius: '12px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                background: row.bankConfigured ? '#f0fdf4' : '#fef2f2',
                                color: row.bankConfigured ? '#15803d' : '#b91c1c',
                                border: `1px solid ${row.bankConfigured ? '#bbf7d0' : '#fecaca'}`,
                              }}
                            >
                              <span>{row.bankConfigured ? '✓' : '⚠️'}</span>
                              <span>{row.bankConfigured ? 'Verified' : 'Pending'}</span>
                            </span>
                          </td>

                          {/* Payroll Status */}
                          <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                background: badge.bg,
                                color: badge.text,
                                border: `1px solid ${badge.border}`,
                              }}
                            >
                              {badge.label}
                            </span>
                          </td>

                          {/* Actions: Prominent MANAGE Button */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => openManagePanel(row)}
                                style={{
                                  background: '#FFF4E8',
                                  color: '#E85D04',
                                  border: '1px solid #F5B97A',
                                  borderRadius: '6px',
                                  padding: '6px 14px',
                                  fontSize: '12.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                Manage
                              </button>

                              {row.hasPayroll && (
                                <button
                                  type="button"
                                  onClick={() => openPayslip(row.payroll)}
                                  style={{
                                    background: '#f8fafc',
                                    color: '#475569',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    padding: '6px 9px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                  title="Quick view payslip"
                                >
                                  📄
                                </button>
                              )}
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
      )}

      {/* ─── FULL-PAGE COMPANY PAYMENT REQUESTS CRM MODULE ─── */}
      {mainView === 'requests' && (
        <div>
          {/* Module Header Row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1.25rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                  COMPANY PAYMENT REQUESTS
                </h1>
                <span style={{ background: '#FFF4E8', color: '#E85D04', fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '6px', border: '1px solid #F5B97A' }}>
                  Full Page Management
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.86rem', color: '#64748b' }}>
                Create, review, approve, process and manage company payment requests.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={openCreatePaymentRequestModal}
                style={{
                  background: '#FFF4E8',
                  color: '#E85D04',
                  border: '1px solid #F5B97A',
                  borderRadius: '7px',
                  padding: '9px 18px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span>
                <span>New Company Payment Request</span>
              </button>

              <button
                type="button"
                onClick={() => fetchMonthData(selectedMonth)}
                disabled={loading}
                style={{
                  background: '#fff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '7px',
                  padding: '9px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                title="Refresh Payment Requests list from MongoDB Atlas"
              >
                🔄 Refresh
              </button>

              <button
                type="button"
                onClick={() => setMainView('payroll')}
                style={{
                  background: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '7px',
                  padding: '9px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ← Back to Payroll Overview
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ background: '#fff', borderRadius: '10px', padding: '1.1rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Requests</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{allPaymentRequests.length}</div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', fontWeight: 600 }}>Total Value: {formatCurrency(prTotalAmount)}</div>
            </div>

            <div style={{ background: '#fff', borderRadius: '10px', padding: '1.1rem', border: '1px solid #fde68a', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pending Approval</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>{prPendingCount}</div>
              <div style={{ fontSize: '11.5px', color: '#b45309', marginTop: '2px', fontWeight: 600 }}>Awaiting: {formatCurrency(prPendingAmount)}</div>
            </div>

            <div style={{ background: '#fff', borderRadius: '10px', padding: '1.1rem', border: '1px solid #bae6fd', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Approved & Ready</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0369a1', marginTop: '4px' }}>{prApprovedCount}</div>
              <div style={{ fontSize: '11.5px', color: '#0284c7', marginTop: '2px', fontWeight: 600 }}>Ready to Disburse: {formatCurrency(prApprovedAmount)}</div>
            </div>

            <div style={{ background: '#fff', borderRadius: '10px', padding: '1.1rem', border: '1px solid #bbf7d0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Disbursed / Paid</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>{prPaidCount}</div>
              <div style={{ fontSize: '11.5px', color: '#16a34a', marginTop: '2px', fontWeight: 600 }}>Settled: {formatCurrency(prPaidAmount)}</div>
            </div>
          </div>

          {/* Search & Multi-Filter Toolbar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              background: '#fff',
              padding: '0.85rem 1rem',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 260px' }}>
              <span style={{ fontSize: '14px', color: '#94a3b8' }}>🔍</span>
              <input
                type="text"
                placeholder="Search by Request #, payee, vendor, bill #, purpose..."
                value={prSearch}
                onChange={(e) => setPrSearch(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: '13.5px',
                  width: '100%',
                  background: 'transparent',
                }}
              />
              {prSearch && (
                <button
                  type="button"
                  onClick={() => setPrSearch('')}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '12px' }}
                >
                  ✕
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Type Filter */}
              <select
                value={prTypeFilter}
                onChange={(e) => setPrTypeFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                <option value="All">All Types</option>
                <option value="Vendor Payment">Vendor Payment</option>
                <option value="Employee Reimbursement">Employee Reimbursement</option>
                <option value="Salary Advance">Salary Advance</option>
                <option value="Employee Loan">Employee Loan</option>
                <option value="Company Expense">Company Expense</option>
                <option value="Other">Other</option>
              </select>

              {/* Status Filter */}
              <select
                value={prStatusFilter}
                onChange={(e) => setPrStatusFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                <option value="All">All Statuses</option>
                <option value="Submitted">Submitted (Pending)</option>
                <option value="Approved">Approved</option>
                <option value="Paid">Paid</option>
                <option value="Rejected">Rejected</option>
              </select>

              {/* Priority Filter */}
              <select
                value={prPriorityFilter}
                onChange={(e) => setPrPriorityFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                <option value="All">All Priorities</option>
                <option value="Low">Low Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="High">High Priority</option>
                <option value="Urgent">Urgent Priority</option>
              </select>

              {(prSearch || prStatusFilter !== 'All' || prTypeFilter !== 'All' || prPriorityFilter !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    setPrSearch('');
                    setPrStatusFilter('All');
                    setPrTypeFilter('All');
                    setPrPriorityFilter('All');
                  }}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  Reset
                </button>
              )}

              <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 600, marginLeft: '4px' }}>
                Showing <strong>{filteredPaymentRequests.length}</strong> of <strong>{allPaymentRequests.length}</strong>
              </span>
            </div>
          </div>

          {/* Payment Requests Full Page CRM Table */}
          <div
            style={{
              background: '#fff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '12px 14px' }}>Request #</th>
                    <th style={{ padding: '12px 12px' }}>Date</th>
                    <th style={{ padding: '12px 12px' }}>Type</th>
                    <th style={{ padding: '12px 12px' }}>Priority</th>
                    <th style={{ padding: '12px 14px' }}>Payee / Beneficiary</th>
                    <th style={{ padding: '12px 14px' }}>Purpose / Reference</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '12px 14px' }}>Requested By</th>
                    <th style={{ padding: '12px 12px', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPaymentRequests.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>No Payment Requests Found</div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                          {allPaymentRequests.length === 0
                            ? 'No payment requests have been submitted yet. Click "+ New Company Payment Request" to create one.'
                            : 'No payment requests match your current search and filter criteria.'}
                        </div>
                        <button
                          type="button"
                          onClick={openCreatePaymentRequestModal}
                          style={{
                            marginTop: '14px',
                            background: '#FFF4E8',
                            color: '#E85D04',
                            border: '1px solid #F5B97A',
                            padding: '8px 18px',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          + New Company Payment Request
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredPaymentRequests.map((p) => {
                      const tBadge = getTypeBadge(p.paymentType || p.requestType);
                      const prBadge = getPriorityBadge(p.priority);
                      const reqName = p.requester?.firstName
                        ? `${p.requester.firstName} ${p.requester.lastName || ''}`
                        : p.requesterName || 'Finance Dept';
                      const reqDept = p.requester?.department || p.department || '';

                      return (
                        <tr
                          key={p._id}
                          style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.12s ease' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#fafafa')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                        >
                          <td style={{ padding: '12px 14px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPr(p);
                                setViewPrModalOpen(true);
                              }}
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: '5px',
                                padding: '3px 8px',
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                fontSize: '12px',
                                color: '#0f172a',
                                cursor: 'pointer',
                              }}
                              title="Click to view full payment request details"
                            >
                              {p.requestNumber || `PR-${p._id.slice(-6).toUpperCase()}`}
                            </button>
                          </td>
                          <td style={{ padding: '12px 12px', whiteSpace: 'nowrap', color: '#64748b', fontSize: '12.5px' }}>
                            {formatDate ? formatDate(p.requestDate || p.createdAt) : new Date(p.requestDate || p.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            <span style={{ background: tBadge.bg, color: tBadge.color, border: `1px solid ${tBadge.border}`, padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {p.paymentType || p.requestType || 'Payment Request'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            <span style={{ background: prBadge.bg, color: prBadge.color, border: `1px solid ${prBadge.border}`, padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {p.priority || 'Medium'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>
                              {p.payeeName || (p.vendor?.companyName || p.vendor?.name) || (p.employee?.firstName ? `${p.employee.firstName} ${p.employee.lastName || ''}` : 'Authorized Payee')}
                            </div>
                            {(p.vendorBillNumber || p.vendor?.category || p.department) && (
                              <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                                {p.vendorBillNumber ? `Bill #${p.vendorBillNumber}` : p.vendor?.category || p.department}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px', maxWidth: '220px' }}>
                            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#334155' }} title={p.purpose || p.reason || p.description}>
                              {p.purpose || p.reason || p.description || 'General disbursement'}
                            </div>
                            {p.referenceNumber && (
                              <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                                Ref: {p.referenceNumber}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>
                            {formatCurrency(p.amount)}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ color: '#0f172a', fontWeight: 600 }}>{reqName}</div>
                            {reqDept && <div style={{ fontSize: '11px', color: '#64748b' }}>{reqDept}</div>}
                          </td>
                          <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                            <span
                              style={{
                                padding: '3px 9px',
                                borderRadius: '4px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                background: p.status === 'Paid' ? '#dcfce7' : p.status === 'Approved' ? '#e0f2fe' : p.status === 'Rejected' ? '#fee2e2' : '#fef3c7',
                                color: p.status === 'Paid' ? '#166534' : p.status === 'Approved' ? '#0369a1' : p.status === 'Rejected' ? '#991b1b' : '#92400e',
                                border: `1px solid ${p.status === 'Paid' ? '#bbf7d0' : p.status === 'Approved' ? '#bae6fd' : p.status === 'Rejected' ? '#fecaca' : '#fde68a'}`,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {p.status || 'Submitted'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPr(p);
                                  setViewPrModalOpen(true);
                                }}
                                style={{
                                  background: '#f8fafc',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '5px',
                                  padding: '5px 10px',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  color: '#334155',
                                  cursor: 'pointer',
                                }}
                                title="View complete request audit details"
                              >
                                👁️ View
                              </button>

                              {p.status === 'Submitted' && isFinanceAdmin && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleApprovePaymentRequest(p._id)}
                                    style={{
                                      background: '#f0fdf4',
                                      color: '#166534',
                                      border: '1px solid #bbf7d0',
                                      borderRadius: '5px',
                                      padding: '5px 9px',
                                      fontSize: '11.5px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                    title="Approve Payment Request"
                                  >
                                    ✓ Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRejectModal(p._id)}
                                    style={{
                                      background: '#fef2f2',
                                      color: '#991b1b',
                                      border: '1px solid #fecaca',
                                      borderRadius: '5px',
                                      padding: '5px 9px',
                                      fontSize: '11.5px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                    title="Reject Payment Request"
                                  >
                                    ✕ Reject
                                  </button>
                                </>
                              )}

                              {p.status === 'Approved' && isFinanceAdmin && (
                                <button
                                  type="button"
                                  onClick={() => openDisburseModal({ ...p, _isPaymentRequest: true })}
                                  style={{
                                    background: '#16a34a',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '5px',
                                    padding: '5px 11px',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                  title="Disburse payment through linked bank account"
                                >
                                  💳 Disburse
                                </button>
                              )}

                              {p.supportingDocumentUrl && (
                                <a
                                  href={p.supportingDocumentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    background: '#f1f5f9',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '5px',
                                    padding: '5px 8px',
                                    fontSize: '11.5px',
                                    textDecoration: 'none',
                                    color: '#0f172a',
                                  }}
                                  title="Open supporting document / receipt"
                                >
                                  📎
                                </a>
                              )}
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
      )}

      {/* ─── FULL-PAGE LOAN & ADVANCE RECOVERY CRM MODULE ─── */}
      {mainView === 'recovery' && (
        <div>
          {/* Module Header Row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1.25rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                  LOAN & ADVANCE RECOVERY
                </h1>
                <span style={{ background: '#FFF4E8', color: '#E85D04', fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '6px', border: '1px solid #F5B97A' }}>
                  Full Page Management
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.86rem', color: '#64748b' }}>
                Track employee salary advances, loan balances, repayment schedules, and active monthly payroll deductions.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => fetchMonthData(selectedMonth)}
                disabled={loading}
                style={{
                  background: '#FFF4E8',
                  color: '#E85D04',
                  border: '1px solid #F5B97A',
                  borderRadius: '7px',
                  padding: '9px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                title="Refresh recovery schedules from MongoDB Atlas"
              >
                🔄 Refresh Data
              </button>

              <button
                type="button"
                onClick={() => setMainView('payroll')}
                style={{
                  background: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '7px',
                  padding: '9px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                ← Back to Payroll Overview
              </button>
            </div>
          </div>

          {/* Recovery KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ background: '#fff', border: '1px solid #fed7aa', borderRadius: '10px', padding: '1.1rem', borderLeft: '4px solid #f97316' }}>
              <div style={{ fontSize: '11px', color: '#9a3412', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOTAL DISBURSED</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#7c2d12', marginTop: '4px' }}>
                {formatCurrency(advancesSummary.totalDisbursed || 0)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>Cumulative advances & company loans</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '1.1rem', borderLeft: '4px solid #16a34a' }}>
              <div style={{ fontSize: '11px', color: '#166534', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOTAL RECOVERED</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
                {formatCurrency(advancesSummary.totalRecovered || 0)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>Recovered via monthly payroll deductions</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: '10px', padding: '1.1rem', borderLeft: '4px solid #dc2626' }}>
              <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>OUTSTANDING BALANCE</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#dc2626', marginTop: '4px' }}>
                {formatCurrency(advancesSummary.balanceOutstanding || advancesSummary.totalOutstanding || 0)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>Current active unpaid balance</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.1rem', borderLeft: '4px solid #475569' }}>
              <div style={{ fontSize: '11px', color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>ACTIVE SCHEDULES</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {allAdvances.length}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>Employee advance agreements on record</div>
            </div>
          </div>

          {/* Recovery Search & Filter Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
              marginBottom: '1rem',
              padding: '0.85rem 1rem',
              background: '#fff',
              borderRadius: '9px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ flex: '1 1 260px', position: 'relative' }}>
              <input
                type="text"
                placeholder="Search by employee name, ID or advance type..."
                value={advSearch}
                onChange={(e) => setAdvSearch(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 12px 8px 32px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
              <span style={{ position: 'absolute', left: '10px', top: '8px', color: '#94a3b8', fontSize: '14px' }}>🔍</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Type:</span>
              <select
                value={advTypeFilter}
                onChange={(e) => setAdvTypeFilter(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
              >
                <option value="All">All Advance Types</option>
                <option value="Salary Advance">Salary Advance</option>
                <option value="Personal Loan">Personal Loan</option>
                <option value="Emergency Advance">Emergency Advance</option>
                <option value="Travel Advance">Travel Advance</option>
                <option value="Equipment Loan">Equipment Loan</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Status:</span>
              <select
                value={advStatusFilter}
                onChange={(e) => setAdvStatusFilter(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
              >
                <option value="All">All Statuses</option>
                <option value="In Recovery">In Recovery</option>
                <option value="Active">Active</option>
                <option value="Disbursed">Disbursed</option>
                <option value="Paused">Paused</option>
                <option value="Fully Recovered">Fully Recovered</option>
              </select>
            </div>

            {(advSearch || advTypeFilter !== 'All' || advStatusFilter !== 'All') && (
              <button
                type="button"
                onClick={() => {
                  setAdvSearch('');
                  setAdvTypeFilter('All');
                  setAdvStatusFilter('All');
                }}
                style={{
                  padding: '7px 12px',
                  borderRadius: '6px',
                  border: '1px solid #F5B97A',
                  background: '#FFF4E8',
                  fontSize: '12px',
                  color: '#E85D04',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Reset
              </button>
            )}

            <div style={{ marginLeft: 'auto', fontSize: '12.5px', color: '#64748b', fontWeight: 600 }}>
              Showing {filteredAdvances.length} of {allAdvances.length} recovery records
            </div>
          </div>

          {/* Recovery Management Table */}
          <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    <th style={{ padding: '12px 14px' }}>Employee</th>
                    <th style={{ padding: '12px 12px' }}>Advance Type</th>
                    <th style={{ padding: '12px 12px', textAlign: 'right' }}>Disbursed</th>
                    <th style={{ padding: '12px 12px', textAlign: 'right' }}>Recovered</th>
                    <th style={{ padding: '12px 12px', textAlign: 'right' }}>Outstanding</th>
                    <th style={{ padding: '12px 12px', textAlign: 'right' }}>Monthly Deduct</th>
                    <th style={{ padding: '12px 12px', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdvances.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💰</div>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>No loan or advance recovery records found</div>
                        <p style={{ margin: '4px 0 0', fontSize: '13px' }}>Employee advances created in Payroll will appear here for scheduled recovery tracking.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAdvances.map((adv) => {
                      const empName = adv.employeeName || (adv.employee ? [adv.employee.firstName, adv.employee.lastName].filter(Boolean).join(' ') : '') || 'Employee';
                      const empId = adv.employeeId || adv.employee?.employeeId || (typeof adv.employee === 'string' ? adv.employee : adv.employee?._id) || 'EMP';
                      const empDept = adv.employee?.department || '';
                      const disbursed = Number(adv.disbursedAmount || adv.approvedAmount || adv.requestedAmount || 0);
                      const recovered = Number(adv.recoveredAmount || 0);
                      const balance = adv.balanceOutstanding !== undefined ? Number(adv.balanceOutstanding) : Math.max(0, disbursed - recovered);
                      const percent = disbursed > 0 ? Math.min(100, Math.round((recovered / disbursed) * 100)) : 0;
                      const isPaused = adv.status === 'Paused';
                      const matchedRow = payrollRows.find((r) => String(r.employee?._id) === String(adv.employee?._id || adv.employee));

                      return (
                        <tr key={adv._id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{empName}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              ID: {empId} {empDept && `• ${empDept}`}
                            </div>
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            <span style={{ background: '#FFF4E8', color: '#E85D04', border: '1px solid #F5B97A', padding: '3px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 700 }}>
                              {adv.advanceType || 'Salary Advance'}
                            </span>
                            {adv.reason && (
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {adv.reason}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                            {formatCurrency(disbursed)}
                          </td>
                          <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: '#16a34a' }}>+{formatCurrency(recovered)}</div>
                            <div style={{ fontSize: '10.5px', color: '#64748b' }}>{percent}% repaid</div>
                          </td>
                          <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 800, color: '#dc2626', fontSize: '13.5px' }}>
                            {formatCurrency(balance)}
                          </td>
                          <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                            {formatCurrency(adv.monthlyDeduction || 0)}
                            <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block' }}>/ month</span>
                          </td>
                          <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                            <span
                              style={{
                                padding: '3px 9px',
                                borderRadius: '12px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                background: isPaused ? '#fef2f2' : adv.status === 'Fully Recovered' ? '#f0fdf4' : '#fff7ed',
                                color: isPaused ? '#991b1b' : adv.status === 'Fully Recovered' ? '#15803d' : '#c2410c',
                                border: `1px solid ${isPaused ? '#fecaca' : adv.status === 'Fully Recovered' ? '#bbf7d0' : '#fed7aa'}`,
                              }}
                            >
                              {adv.status || 'Active'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => handleToggleRecoveryPause(adv._id, isPaused)}
                                style={{
                                  background: isPaused ? '#f0fdf4' : '#FFF4E8',
                                  color: isPaused ? '#166534' : '#E85D04',
                                  border: `1px solid ${isPaused ? '#bbf7d0' : '#F5B97A'}`,
                                  borderRadius: '5px',
                                  padding: '5px 11px',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                                title={isPaused ? 'Resume monthly payroll deductions' : 'Pause monthly deductions for this agreement'}
                              >
                                {isPaused ? '▶ Resume' : '⏸ Pause'}
                              </button>

                              {matchedRow && (
                                <button
                                  type="button"
                                  onClick={() => openManagePanel(matchedRow)}
                                  style={{
                                    background: '#FFF4E8',
                                    color: '#E85D04',
                                    border: '1px solid #F5B97A',
                                    borderRadius: '5px',
                                    padding: '5px 9px',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                  title="Open Employee Manage workspace"
                                >
                                  Manage
                                </button>
                              )}
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
      )}

      {/* ─── 6. COMPLETE EMPLOYEE PAYROLL MANAGEMENT WORKSPACE (CENTERED MODAL) ─── */}
      {manageModalOpen && selectedEmpRow && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setManageModalOpen(false);
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '1080px',
              maxHeight: '94vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              overflow: 'hidden',
              animation: 'modalZoom 0.2s ease-out',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.15rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: '#ea580c',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: 800,
                  }}
                >
                  {selectedEmpRow.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      {selectedEmpRow.name}
                    </h2>
                    <span style={{ fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#e2e8f0', color: '#334155' }}>
                      {selectedEmpRow.employeeId}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        ...getStatusBadge(selectedEmpRow.payroll?.workflowStatus || selectedEmpRow.payrollStatus),
                      }}
                    >
                      {selectedEmpRow.payroll?.workflowStatus || selectedEmpRow.payrollStatus}
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                    {selectedEmpRow.department} &bull; {selectedEmpRow.designation} &bull; Period: <strong style={{ color: '#c2410c' }}>{selectedMonth}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleRecalculate(selectedEmpRow.payroll?._id)}
                  disabled={actionLoading || !selectedEmpRow.hasPayroll || selectedEmpRow.isPaid}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: selectedEmpRow.hasPayroll && !selectedEmpRow.isPaid ? 'pointer' : 'not-allowed',
                    opacity: selectedEmpRow.hasPayroll && !selectedEmpRow.isPaid ? 1 : 0.5,
                  }}
                  title="Recalculate with latest database records"
                >
                  🔄 Recalculate
                </button>

                <button
                  type="button"
                  onClick={() => setManageModalOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.5rem',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Internal Navigation Tabs inside Manage Modal */}
            <div
              style={{
                display: 'flex',
                gap: '4px',
                padding: '0 1.5rem',
                background: '#fff',
                borderBottom: '1px solid #e2e8f0',
                overflowX: 'auto',
              }}
            >
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'salary', label: 'Salary Structure' },
                { id: 'earnings', label: 'Earnings / Bonus' },
                { id: 'deductions', label: 'Deductions & Recoveries' },
                { id: 'attendance', label: 'Attendance / Leave' },
                { id: 'calculation', label: 'Payroll Calculation' },
                { id: 'payment-request', label: 'Payment Request' },
                { id: 'disbursement', label: 'Disbursement / Pay' },
                { id: 'payslip', label: 'Payslip' },
                { id: 'history', label: 'Payroll History' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setManageTab(t.id)}
                  style={{
                    padding: '11px 13px',
                    background: 'none',
                    border: 'none',
                    borderBottom: manageTab === t.id ? '3px solid #ea580c' : '3px solid transparent',
                    color: manageTab === t.id ? '#ea580c' : '#64748b',
                    fontWeight: manageTab === t.id ? 800 : 600,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Modal Body: Active Tab Content */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
              {profileLoading ? (
                <div style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid #cbd5e1', borderTopColor: '#ea580c', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <div style={{ marginTop: '10px', fontWeight: 600 }}>Loading comprehensive workspace for {selectedEmpRow.name}...</div>
                </div>
              ) : (
                <>
                  {/* TAB 1: OVERVIEW & BANK DETAILS */}
                  {manageTab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* Highlight Banner */}
                      <div
                        style={{
                          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                          color: '#fff',
                          borderRadius: '10px',
                          padding: '1.25rem 1.5rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '1rem',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', fontWeight: 700 }}>
                            Net Payable Salary ({selectedMonth})
                          </div>
                          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>
                            {formatCurrency(selectedEmpRow.netSalary)}
                          </div>
                          <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '3px' }}>
                            Gross: <strong>{formatCurrency(selectedEmpRow.grossSalary)}</strong> &bull; Total Deductions: <strong style={{ color: '#f87171' }}>-{formatCurrency(selectedEmpRow.deductions)}</strong>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          {selectedEmpRow.hasPayroll && selectedEmpRow.payrollStatus !== 'Approved' && !selectedEmpRow.isPaid && (
                            <button
                              type="button"
                              onClick={() => handleApprove(selectedEmpRow.payroll._id)}
                              disabled={actionLoading}
                              style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                            >
                              ✓ Approve Payroll
                            </button>
                          )}

                          {selectedEmpRow.hasPayroll && !selectedEmpRow.isPaid && (
                            <button
                              type="button"
                              onClick={() => setManageTab('disbursement')}
                              style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                            >
                              💳 Disburse Salary
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openPayslip(selectedEmpRow.payroll)}
                            style={{ background: '#334155', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                          >
                            📄 View Payslip
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                        {/* Employee Details Card */}
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem' }}>
                          <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0', textTransform: 'uppercase' }}>
                            Employee Profile
                          </h3>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                            <div><span style={{ color: '#64748b' }}>Employee ID:</span> <strong style={{ color: '#0f172a' }}>{selectedEmpRow.employeeId}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Department:</span> <strong style={{ color: '#0f172a' }}>{selectedEmpRow.department}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Designation:</span> <strong style={{ color: '#0f172a' }}>{selectedEmpRow.designation}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Employment:</span> <strong style={{ color: '#16a34a' }}>{selectedEmpRow.employee.employmentStatus || 'Active'}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Email:</span> <strong style={{ color: '#0f172a' }}>{selectedEmpRow.email}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Phone:</span> <strong>{selectedEmpRow.employee.phone || '—'}</strong></div>
                          </div>
                        </div>

                        {/* Bank Details Card */}
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase' }}>
                              Bank Details
                            </h3>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '10px',
                                background: selectedEmpRow.bankConfigured ? '#f0fdf4' : '#fef2f2',
                                color: selectedEmpRow.bankConfigured ? '#15803d' : '#b91c1c',
                                border: `1px solid ${selectedEmpRow.bankConfigured ? '#bbf7d0' : '#fecaca'}`,
                              }}
                            >
                              {selectedEmpRow.bankStatus}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                            <div><span style={{ color: '#64748b' }}>Account Holder:</span> <strong>{selectedEmpRow.employee.bankDetails?.accountHolderName || selectedEmpRow.name}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Bank Name:</span> <strong>{selectedEmpRow.employee.bankDetails?.bankName || '—'}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Account No:</span> <strong>{selectedEmpRow.employee.bankDetails?.accountNumber ? `••••${selectedEmpRow.employee.bankDetails.accountNumber.slice(-4)}` : '—'}</strong></div>
                            <div><span style={{ color: '#64748b' }}>IFSC Code:</span> <strong>{selectedEmpRow.employee.bankDetails?.ifscCode || '—'}</strong></div>
                            <div><span style={{ color: '#64748b' }}>Branch:</span> <strong>{selectedEmpRow.employee.bankDetails?.branchName || '—'}</strong></div>
                          </div>

                          <div style={{ marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                            <button
                              type="button"
                              onClick={() => setManageTab('salary')}
                              style={{ background: 'none', border: 'none', color: '#ea580c', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', padding: 0 }}
                            >
                              ✏️ Update Bank & Salary Structure →
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: SALARY STRUCTURE */}
                  {manageTab === 'salary' && (
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.5rem' }}>
                      <div style={{ marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                          Salary Structure Configuration
                        </h3>
                        <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                          Configure basic earnings, standard allowances and statutory deductions saved directly to MongoDB.
                        </p>
                      </div>

                      <form onSubmit={handleSaveSalaryStructure}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '1.25rem' }}>
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Basic Salary (₹) *</label>
                            <input
                              type="number"
                              value={salaryForm.basicSalary || ''}
                              onChange={(e) => {
                                const b = Number(e.target.value) || 0;
                                setSalaryForm({
                                  ...salaryForm,
                                  basicSalary: b,
                                  hra: Math.round(b * 0.4),
                                  pf: Math.round(Math.min(b, 15000) * 0.12),
                                  professionalTax: b > 15000 ? 200 : 0,
                                });
                              }}
                              required
                              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>House Rent Allowance (HRA) (₹)</label>
                            <input
                              type="number"
                              value={salaryForm.hra || ''}
                              onChange={(e) => setSalaryForm({ ...salaryForm, hra: Number(e.target.value) || 0 })}
                              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Conveyance Allowance (₹)</label>
                            <input
                              type="number"
                              value={salaryForm.conveyance || ''}
                              onChange={(e) => setSalaryForm({ ...salaryForm, conveyance: Number(e.target.value) || 0 })}
                              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Special Allowance (₹)</label>
                            <input
                              type="number"
                              value={salaryForm.specialAllowance || ''}
                              onChange={(e) => setSalaryForm({ ...salaryForm, specialAllowance: Number(e.target.value) || 0 })}
                              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Provident Fund (PF) (₹)</label>
                            <input
                              type="number"
                              value={salaryForm.pf || ''}
                              onChange={(e) => setSalaryForm({ ...salaryForm, pf: Number(e.target.value) || 0 })}
                              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Professional Tax (PT) (₹)</label>
                            <input
                              type="number"
                              value={salaryForm.professionalTax || ''}
                              onChange={(e) => setSalaryForm({ ...salaryForm, professionalTax: Number(e.target.value) || 0 })}
                              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>TDS Withholding (₹)</label>
                            <input
                              type="number"
                              value={salaryForm.tds || ''}
                              onChange={(e) => setSalaryForm({ ...salaryForm, tds: Number(e.target.value) || 0 })}
                              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            />
                          </div>
                        </div>

                        {/* Bank Details section */}
                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '1rem' }}>
                          <h4 style={{ margin: '0 0 10px 0', fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>
                            Bank Account for Direct Disbursals
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                            <div>
                              <label style={{ fontSize: '11.5px', color: '#64748b' }}>Account Holder Name</label>
                              <input
                                type="text"
                                value={salaryForm.accountHolderName || ''}
                                onChange={(e) => setSalaryForm({ ...salaryForm, accountHolderName: e.target.value })}
                                style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '11.5px', color: '#64748b' }}>Bank Name</label>
                              <input
                                type="text"
                                value={salaryForm.bankName || ''}
                                onChange={(e) => setSalaryForm({ ...salaryForm, bankName: e.target.value })}
                                style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '11.5px', color: '#64748b' }}>Account Number</label>
                              <input
                                type="text"
                                value={salaryForm.accountNumber || ''}
                                onChange={(e) => setSalaryForm({ ...salaryForm, accountNumber: e.target.value })}
                                style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '11.5px', color: '#64748b' }}>IFSC Code</label>
                              <input
                                type="text"
                                value={salaryForm.ifscCode || ''}
                                onChange={(e) => setSalaryForm({ ...salaryForm, ifscCode: e.target.value.toUpperCase() })}
                                style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                              />
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem' }}>
                          <button
                            type="submit"
                            disabled={salarySaving}
                            style={{ background: '#FFF4E8', color: '#E85D04', border: '1px solid #F5B97A', padding: '9px 24px', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                          >
                            {salarySaving ? 'Saving Structure...' : 'Save Structure to Database'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* TAB 3: EARNINGS & BONUSES */}
                  {manageTab === 'earnings' && (
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <div>
                          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                            Bonuses & Extra Earnings for {selectedMonth}
                          </h3>
                          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                            Performance bonuses, incentives and overtime earnings automatically integrated into this month's slip
                          </p>
                        </div>
                      </div>

                      {/* Add Bonus form */}
                      <form onSubmit={handleSaveBonus} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>+ Allocate New Bonus / Incentive</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                          <div>
                            <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569' }}>Type</label>
                            <select
                              value={bonusForm.type}
                              onChange={(e) => setBonusForm({ ...bonusForm, type: e.target.value })}
                              style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            >
                              <option value="Bonus">Annual / Festival Bonus</option>
                              <option value="Performance Incentive">Performance Incentive</option>
                              <option value="Sales Incentive">Sales Incentive</option>
                              <option value="Overtime">Overtime Earnings</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569' }}>Amount (₹) *</label>
                            <input
                              type="number"
                              placeholder="e.g. 5000"
                              value={bonusForm.amount}
                              onChange={(e) => setBonusForm({ ...bonusForm, amount: e.target.value })}
                              required
                              style={{ width: '100%', boxSizing: 'border-box', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569' }}>Reason / Remarks</label>
                            <input
                              type="text"
                              placeholder="e.g. Q3 Sales Target Achieved"
                              value={bonusForm.reason}
                              onChange={(e) => setBonusForm({ ...bonusForm, reason: e.target.value })}
                              style={{ width: '100%', boxSizing: 'border-box', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button
                              type="submit"
                              disabled={bonusSaving}
                              style={{ width: '100%', background: '#16a34a', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              {bonusSaving ? 'Adding...' : '+ Add Bonus'}
                            </button>
                          </div>
                        </div>
                      </form>

                      {/* List of Extra Salaries */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '8px 10px' }}>Type</th>
                            <th style={{ padding: '8px 10px' }}>Amount</th>
                            <th style={{ padding: '8px 10px' }}>Reason</th>
                            <th style={{ padding: '8px 10px' }}>Status</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profileData?.extraSalaries && profileData.extraSalaries.length > 0 ? (
                            profileData.extraSalaries.map((ex) => (
                              <tr key={ex._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '8px 10px', fontWeight: 700 }}>{ex.type}</td>
                                <td style={{ padding: '8px 10px', fontWeight: 800, color: '#16a34a' }}>+{formatCurrency(ex.amount)}</td>
                                <td style={{ padding: '8px 10px', color: '#64748b' }}>{ex.reason || '—'}</td>
                                <td style={{ padding: '8px 10px' }}>
                                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: ex.status === 'Paid' ? '#dcfce7' : '#fef3c7', color: ex.status === 'Paid' ? '#166534' : '#92400e' }}>
                                    {ex.status}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                  {ex.status !== 'Paid' && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteBonus(ex._id)}
                                      style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                      Delete
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                                No special bonuses or incentives recorded for {selectedMonth}.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAB 4: DEDUCTIONS & RECOVERIES */}
                  {manageTab === 'deductions' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* Deductions Breakdown Box */}
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0' }}>
                          Standard & Attendance Deductions Breakdown
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                          <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px' }}>
                            <div style={{ color: '#64748b', fontSize: '12px' }}>Provident Fund (PF)</div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#dc2626' }}>{formatCurrency(selectedEmpRow.payroll?.deductionsBreakdown?.pf || selectedEmpRow.employee.salaryDetails?.pf)}</div>
                          </div>
                          <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px' }}>
                            <div style={{ color: '#64748b', fontSize: '12px' }}>Professional Tax (PT)</div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#dc2626' }}>{formatCurrency(selectedEmpRow.payroll?.deductionsBreakdown?.professionalTax || selectedEmpRow.employee.salaryDetails?.professionalTax)}</div>
                          </div>
                          <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px' }}>
                            <div style={{ color: '#64748b', fontSize: '12px' }}>TDS Withholding</div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#dc2626' }}>{formatCurrency(selectedEmpRow.payroll?.deductionsBreakdown?.tds || selectedEmpRow.employee.salaryDetails?.tds)}</div>
                          </div>
                          <div style={{ background: '#fef2f2', padding: '10px', borderRadius: '6px' }}>
                            <div style={{ color: '#991b1b', fontSize: '12px' }}>Attendance LOP Deduction</div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#dc2626' }}>{formatCurrency(selectedEmpRow.payroll?.deductionsBreakdown?.lopDeduction || selectedEmpRow.payroll?.lopDeductions || 0)}</div>
                          </div>
                        </div>
                      </div>

                      {/* Recoveries / Advances Box */}
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0' }}>
                          Salary Advance & Loan Recovery Schedules
                        </h3>

                        {/* Add Recovery Schedule form */}
                        <form onSubmit={(e) => handleSaveRecovery(e, selectedEmpRow.employee._id)} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
                          <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>+ Set Up Recovery Schedule for {selectedEmpRow.name}</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                            <div>
                              <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569' }}>Type</label>
                              <select
                                value={recoveryForm.advanceType}
                                onChange={(e) => setRecoveryForm({ ...recoveryForm, advanceType: e.target.value })}
                                style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                              >
                                <option value="Salary Advance">Salary Advance</option>
                                <option value="Employee Loan">Employee Loan</option>
                                <option value="Leave Deduction">Leave Deduction</option>
                                <option value="Other Recovery">Other Recovery</option>
                              </select>
                            </div>

                            <div>
                              <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569' }}>Total Amount (₹) *</label>
                              <input
                                type="number"
                                placeholder="e.g. 15000"
                                value={recoveryForm.disbursedAmount}
                                onChange={(e) => {
                                  const a = Number(e.target.value) || 0;
                                  setRecoveryForm({ ...recoveryForm, disbursedAmount: a, monthlyDeduction: Math.round(a / (Number(recoveryForm.repaymentMonths) || 1)) });
                                }}
                                required
                                style={{ width: '100%', boxSizing: 'border-box', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569' }}>Repayment Months</label>
                              <input
                                type="number"
                                value={recoveryForm.repaymentMonths}
                                onChange={(e) => {
                                  const m = Math.max(1, Number(e.target.value) || 1);
                                  setRecoveryForm({ ...recoveryForm, repaymentMonths: m, monthlyDeduction: Math.round((Number(recoveryForm.disbursedAmount) || 0) / m) });
                                }}
                                style={{ width: '100%', boxSizing: 'border-box', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                              />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                              <button
                                type="submit"
                                disabled={recoverySaving}
                                style={{ width: '100%', background: '#FFF4E8', color: '#E85D04', border: '1px solid #F5B97A', padding: '8px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                              >
                                {recoverySaving ? 'Saving...' : '+ Set Recovery'}
                              </button>
                            </div>
                          </div>
                        </form>

                        {/* List of advances */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                              <th style={{ padding: '8px 10px' }}>Type</th>
                              <th style={{ padding: '8px 10px' }}>Disbursed</th>
                              <th style={{ padding: '8px 10px' }}>Recovered</th>
                              <th style={{ padding: '8px 10px' }}>Balance</th>
                              <th style={{ padding: '8px 10px' }}>Monthly Deduction</th>
                              <th style={{ padding: '8px 10px' }}>Status</th>
                              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profileData?.activeAdvances && profileData.activeAdvances.length > 0 ? (
                              profileData.activeAdvances.map((adv) => (
                                <tr key={adv._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '8px 10px', fontWeight: 700 }}>{adv.advanceType || 'Salary Advance'}</td>
                                  <td style={{ padding: '8px 10px' }}>{formatCurrency(adv.disbursedAmount)}</td>
                                  <td style={{ padding: '8px 10px', color: '#16a34a' }}>{formatCurrency(adv.recoveredAmount)}</td>
                                  <td style={{ padding: '8px 10px', fontWeight: 800, color: '#dc2626' }}>{formatCurrency(adv.balanceOutstanding)}</td>
                                  <td style={{ padding: '8px 10px', fontWeight: 700 }}>{formatCurrency(adv.monthlyDeduction)}</td>
                                  <td style={{ padding: '8px 10px' }}>
                                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: adv.status === 'Paused' ? '#fee2e2' : '#fef3c7', color: adv.status === 'Paused' ? '#991b1b' : '#92400e' }}>
                                      {adv.status}
                                    </span>
                                  </td>
                                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleRecoveryPause(adv._id, adv.status === 'Paused')}
                                      style={{ background: 'none', border: 'none', color: '#0284c7', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                      {adv.status === 'Paused' ? 'Resume' : 'Pause'}
                                    </button>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                                  No active loans or salary advances outstanding for this employee.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: ATTENDANCE & LEAVE IMPACT */}
                  {manageTab === 'attendance' && (
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.5rem' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0' }}>
                        Attendance & Leave Integration ({selectedMonth})
                      </h3>
                      <p style={{ margin: '0 0 1.25rem 0', fontSize: '13px', color: '#64748b' }}>
                        Direct synchronization with Attendance logs and approved Leave Requests. Loss of Pay (LOP) days are automatically converted into salary deductions.
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '1.5rem' }}>
                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <div style={{ color: '#64748b', fontSize: '12px' }}>Working Days (Excl. Sun)</div>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{selectedEmpRow.payroll?.attendanceSummary?.workingDays || 26}</div>
                        </div>

                        <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                          <div style={{ color: '#166534', fontSize: '12px' }}>Present Days</div>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>{selectedEmpRow.payroll?.attendanceSummary?.presentDays || 0}</div>
                        </div>

                        <div style={{ background: '#e0f2fe', padding: '12px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                          <div style={{ color: '#0369a1', fontSize: '12px' }}>Approved Paid Leaves</div>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>{selectedEmpRow.payroll?.attendanceSummary?.paidLeaves || 0}</div>
                        </div>

                        <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                          <div style={{ color: '#991b1b', fontSize: '12px' }}>LOP / Absent Days</div>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626', marginTop: '4px' }}>{selectedEmpRow.payroll?.attendanceSummary?.lopDays || selectedEmpRow.payroll?.lopDays || 0}</div>
                        </div>
                      </div>

                      <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '1rem', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: 800, fontSize: '13.5px', color: '#0f172a' }}>Calculated Loss of Pay (LOP) Deduction:</div>
                        <div style={{ fontSize: '13px', color: '#dc2626', marginTop: '4px', fontWeight: 700 }}>
                          {formatCurrency(selectedEmpRow.payroll?.deductionsBreakdown?.lopDeduction || selectedEmpRow.payroll?.lopDeductions || 0)}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                          Formula: (Basic Salary ÷ Total Days in Month) × LOP Days
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 6: PAYROLL CALCULATION STEP-BY-STEP */}
                  {manageTab === 'calculation' && (
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <div>
                          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                            Backend Validated Payroll Computation
                          </h3>
                          <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                            Full step-by-step mathematical reconciliation for {selectedEmpRow.name} ({selectedMonth})
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRecalculate(selectedEmpRow.payroll?._id)}
                          disabled={actionLoading || !selectedEmpRow.hasPayroll || selectedEmpRow.isPaid}
                          style={{ background: '#FFF4E8', color: '#E85D04', border: '1px solid #F5B97A', padding: '8px 16px', borderRadius: '6px', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}
                        >
                          🔄 Recalculate Now
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        {/* Earnings side */}
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                          <h4 style={{ margin: '0 0 10px 0', color: '#0369a1', fontSize: '13.5px', fontWeight: 800 }}>EARNINGS</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Basic Salary:</span> <strong>{formatCurrency(selectedEmpRow.basicSalary)}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Allowances:</span> <strong>{formatCurrency(selectedEmpRow.earnings)}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '6px', marginTop: '4px' }}>
                              <span style={{ fontWeight: 800 }}>Gross Salary:</span>
                              <strong style={{ color: '#0369a1', fontSize: '15px' }}>{formatCurrency(selectedEmpRow.grossSalary)}</strong>
                            </div>
                          </div>
                        </div>

                        {/* Deductions side */}
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                          <h4 style={{ margin: '0 0 10px 0', color: '#dc2626', fontSize: '13.5px', fontWeight: 800 }}>DEDUCTIONS</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Statutory (PF, PT, TDS):</span> <strong>{formatCurrency((selectedEmpRow.payroll?.deductionsBreakdown?.pf || 0) + (selectedEmpRow.payroll?.deductionsBreakdown?.professionalTax || 0) + (selectedEmpRow.payroll?.deductionsBreakdown?.tds || 0))}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Attendance LOP:</span> <strong>{formatCurrency(selectedEmpRow.payroll?.deductionsBreakdown?.lopDeduction || 0)}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Loan Recovery:</span> <strong>{formatCurrency(selectedEmpRow.payroll?.deductionsBreakdown?.advanceRecovery || 0)}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '6px', marginTop: '4px' }}>
                              <span style={{ fontWeight: 800 }}>Total Deductions:</span>
                              <strong style={{ color: '#dc2626', fontSize: '15px' }}>-{formatCurrency(selectedEmpRow.deductions)}</strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Net Result */}
                      <div style={{ background: '#f0fdf4', border: '2px solid #bbf7d0', borderRadius: '8px', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>FINAL NET PAYABLE SALARY</div>
                          <div style={{ fontSize: '12px', color: '#15803d' }}>Gross Salary - Total Deductions</div>
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#166534' }}>
                          {formatCurrency(selectedEmpRow.netSalary)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 7: PAYMENT REQUEST */}
                  {manageTab === 'payment-request' && (
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.5rem' }}>
                      <div style={{ marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                          Employee Payroll Payment Requests
                        </h3>
                        <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                          Formal payment authorization workflow: Submitted &rarr; Approved &rarr; Disbursed
                        </p>
                      </div>

                      {/* Create Payment Request Form */}
                      <form onSubmit={handleCreatePaymentRequest} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>+ Submit Payment Request for this Payroll</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                          <div>
                            <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569' }}>Payee</label>
                            <input type="text" value={selectedEmpRow.name} disabled style={{ width: '100%', boxSizing: 'border-box', padding: '7px', background: '#e2e8f0', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                          </div>

                          <div>
                            <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569' }}>Requested Net Amount (₹) *</label>
                            <input
                              type="number"
                              value={newPrForm.amount}
                              onChange={(e) => setNewPrForm({ ...newPrForm, amount: e.target.value })}
                              required
                              style={{ width: '100%', boxSizing: 'border-box', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569' }}>Notes / Remarks</label>
                            <input
                              type="text"
                              value={newPrForm.reason}
                              onChange={(e) => setNewPrForm({ ...newPrForm, reason: e.target.value })}
                              style={{ width: '100%', boxSizing: 'border-box', padding: '7px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                            />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button
                              type="submit"
                              disabled={newPrSaving}
                              style={{ width: '100%', background: '#FFF4E8', color: '#E85D04', border: '1px solid #F5B97A', padding: '8px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              {newPrSaving ? 'Submitting...' : '+ Submit Request'}
                            </button>
                          </div>
                        </div>
                      </form>

                      {/* List of employee payment requests */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '8px 10px' }}>Request No</th>
                            <th style={{ padding: '8px 10px' }}>Amount</th>
                            <th style={{ padding: '8px 10px' }}>Status</th>
                            <th style={{ padding: '8px 10px' }}>Requested Date</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profileData?.paymentRequests && profileData.paymentRequests.length > 0 ? (
                            profileData.paymentRequests.map((pr) => (
                              <tr key={pr._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '8px 10px', fontWeight: 700 }}>{pr.requestNumber}</td>
                                <td style={{ padding: '8px 10px', fontWeight: 800, color: '#0f172a' }}>{formatCurrency(pr.amount)}</td>
                                <td style={{ padding: '8px 10px' }}>
                                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, ...getStatusBadge(pr.status) }}>
                                    {pr.status}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 10px', color: '#64748b' }}>{formatDate(pr.createdAt)}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', gap: '6px' }}>
                                    {pr.status === 'Submitted' && isFinanceAdmin && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleApprovePaymentRequest(pr._id)}
                                          style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                                        >
                                          Approve
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleRejectPaymentRequest(pr._id)}
                                          style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                                        >
                                          Reject
                                        </button>
                                      </>
                                    )}

                                    {pr.status === 'Approved' && isFinanceAdmin && (
                                      <button
                                        type="button"
                                        onClick={() => openDisburseModal({ ...pr, _isPaymentRequest: true })}
                                        style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                                      >
                                        Disburse
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                                No payment requests filed for this employee yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAB 8: DISBURSEMENT / PAY */}
                  {manageTab === 'disbursement' && (
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.5rem' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0' }}>
                        Process Salary Disbursal
                      </h3>

                      {selectedEmpRow.isPaid ? (
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1.5rem', textAlign: 'center' }}>
                          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✓</div>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: '#166534' }}>Salary Disbursed & Marked Paid</div>
                          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#15803d' }}>
                            Transaction recorded in Finance Payments ledger. Bank account balance updated.
                          </p>
                        </div>
                      ) : (
                        <div>
                          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.25rem' }}>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b' }}>DISBURSAL AMOUNT</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
                              {formatCurrency(selectedEmpRow.netSalary)}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                              Employee: {selectedEmpRow.name} ({selectedEmpRow.employeeId}) &bull; Period: {selectedMonth}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => openDisburseModal(selectedEmpRow.payroll)}
                            disabled={!selectedEmpRow.hasPayroll}
                            style={{
                              background: '#16a34a',
                              color: '#fff',
                              border: 'none',
                              padding: '10px 24px',
                              borderRadius: '6px',
                              fontWeight: 700,
                              fontSize: '14px',
                              cursor: selectedEmpRow.hasPayroll ? 'pointer' : 'not-allowed',
                            }}
                          >
                            💳 Open Payment Processing Terminal
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 9: PAYSLIP */}
                  {manageTab === 'payslip' && (
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <div>
                          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                            Official Payslip View & Print
                          </h3>
                          <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                            Ready-to-print company payslip generated from actual MongoDB records
                          </p>
                        </div>

                        {selectedEmpRow.hasPayroll && (
                          <button
                            type="button"
                            onClick={() => openPayslip(selectedEmpRow.payroll)}
                            style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}
                          >
                            🖨️ Fullscreen / Print Payslip
                          </button>
                        )}
                      </div>

                      {selectedEmpRow.hasPayroll ? (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', textAlign: 'center' }}>
                          <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>Payslip Ready for {selectedMonth}</div>
                          <p style={{ margin: '6px 0 12px 0', fontSize: '13px', color: '#64748b' }}>
                            Net Salary: <strong>{formatCurrency(selectedEmpRow.netSalary)}</strong> &bull; Status: <strong>{selectedEmpRow.payrollStatus}</strong>
                          </p>
                          <button
                            type="button"
                            onClick={() => openPayslip(selectedEmpRow.payroll)}
                            style={{ background: '#FFF4E8', color: '#E85D04', border: '1px solid #F5B97A', padding: '8px 20px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Preview Payslip Document
                          </button>
                        </div>
                      ) : (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                          No payroll record generated for this month yet. Run Monthly Payroll Generation first.
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 10: PAYROLL HISTORY */}
                  {manageTab === 'history' && (
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.5rem' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0' }}>
                        Historical Payrolls for {selectedEmpRow.name}
                      </h3>

                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '8px 10px' }}>Month</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Gross</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Deductions</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Net Salary</th>
                            <th style={{ padding: '8px 10px', textAlign: 'center' }}>Status</th>
                            <th style={{ padding: '8px 10px', textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {profileData?.payrollHistory && profileData.payrollHistory.length > 0 ? (
                            profileData.payrollHistory.map((h) => (
                              <tr key={h._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '8px 10px', fontWeight: 700 }}>{h.payPeriod || h.month}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatCurrency(h.gross)}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(h.totalDeduction || h.deductions)}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>{formatCurrency(h.net)}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, ...getStatusBadge(h.workflowStatus || h.status) }}>
                                    {h.status}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                  <button
                                    type="button"
                                    onClick={() => openPayslip(h)}
                                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '3px 10px', borderRadius: '4px', fontSize: '11.5px', cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    View
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                                No historical payroll records logged for this employee.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid #e2e8f0',
                background: '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Ref: {selectedEmpRow.payroll?._id || 'Draft Record'} &bull; Database Verified
              </div>
              <button
                type="button"
                onClick={() => setManageModalOpen(false)}
                style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
              >
                Close Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 7. CREATE PAYMENT REQUEST MODAL ─── */}
      {createPrModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !createPrSubmitting) setCreatePrModalOpen(false);
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '820px',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                  Create New Payment Request
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Submit an authorized disbursement request for vendor bills, employee reimbursements, advances, or company expenses
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreatePrModalOpen(false)}
                disabled={createPrSubmitting}
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreatePrSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* SECTION 1: REQUEST DETAILS */}
              <div style={{ border: '1px solid #fed7aa', background: '#fffaf5', borderRadius: '10px', padding: '1.15rem' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.85rem' }}>
                  1. Request Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Request Number</label>
                      <span style={{ fontSize: '11px', color: '#ea580c', fontWeight: 700 }}>Auto-Generated</span>
                    </div>
                    <input
                      type="text"
                      disabled
                      value={createPrForm.requestNumber}
                      style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#475569', fontWeight: 700, fontFamily: 'monospace', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Request Date *</label>
                    <input
                      type="date"
                      required
                      value={createPrForm.requestDate}
                      onChange={(e) => setCreatePrForm({ ...createPrForm, requestDate: e.target.value })}
                      style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Request Type *</label>
                    <select
                      value={createPrForm.paymentType}
                      onChange={(e) => {
                        const newType = e.target.value;
                        setCreatePrForm((prev) => ({
                          ...prev,
                          paymentType: newType,
                          vendorBill: '',
                          vendorBillNumber: '',
                          reason: '',
                        }));
                      }}
                      style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: createPrErrors.paymentType ? '1px solid #dc2626' : '1px solid #cbd5e1', fontSize: '13px', background: '#fff', fontWeight: 600 }}
                    >
                      <option value="Vendor Payment">Vendor Payment</option>
                      <option value="Employee Reimbursement">Employee Reimbursement</option>
                      <option value="Salary Advance">Salary Advance</option>
                      <option value="Employee Loan">Employee Loan</option>
                      <option value="Company Expense">Company Expense</option>
                      <option value="Other">Other</option>
                    </select>
                    {createPrErrors.paymentType && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{createPrErrors.paymentType}</span>}
                  </div>

                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Priority</label>
                    <select
                      value={createPrForm.priority}
                      onChange={(e) => setCreatePrForm({ ...createPrForm, priority: e.target.value })}
                      style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Department *</label>
                    <select
                      value={createPrForm.department}
                      onChange={(e) => setCreatePrForm({ ...createPrForm, department: e.target.value })}
                      style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: createPrErrors.department ? '1px solid #dc2626' : '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                    >
                      {departments.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    {createPrErrors.department && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{createPrErrors.department}</span>}
                  </div>

                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Requested By</label>
                    <select
                      value={createPrForm.requester}
                      onChange={(e) => {
                        const selEmp = allEmployees.find((emp) => String(emp._id) === e.target.value);
                        setCreatePrForm({
                          ...createPrForm,
                          requester: e.target.value,
                          requesterName: selEmp ? [selEmp.firstName, selEmp.lastName].filter(Boolean).join(' ') : createPrForm.requesterName,
                        });
                      }}
                      style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                    >
                      {allEmployees.map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {emp.firstName} {emp.lastName} ({emp.department || emp.jobDetails?.department || 'Staff'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Required By Date</label>
                    <input
                      type="date"
                      value={createPrForm.requiredDate}
                      onChange={(e) => setCreatePrForm({ ...createPrForm, requiredDate: e.target.value })}
                      style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: PAYMENT DETAILS (DYNAMIC) */}
              <div style={{ border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '10px', padding: '1.15rem' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>2. Payment Details</span>
                  <span style={{ fontSize: '11px', background: '#ea580c', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                    {createPrForm.paymentType}
                  </span>
                </div>

                {/* --- CASE A: VENDOR PAYMENT --- */}
                {createPrForm.paymentType === 'Vendor Payment' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Select Vendor *</label>
                        <select
                          value={createPrForm.vendor}
                          onChange={(e) => {
                            const vendId = e.target.value;
                            const vend = vendors.find((v) => String(v._id) === String(vendId));
                            setCreatePrForm((prev) => ({
                              ...prev,
                              vendor: vendId,
                              payeeName: vend ? vend.companyName || vend.name : '',
                              vendorBill: '',
                              vendorBillNumber: '',
                            }));
                          }}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: createPrErrors.vendor ? '1px solid #dc2626' : '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                        >
                          <option value="">-- Choose Vendor --</option>
                          {vendors.map((v) => (
                            <option key={v._id} value={v._id}>
                              {v.companyName || v.name} ({v.category || 'Vendor'})
                            </option>
                          ))}
                        </select>
                        {createPrErrors.vendor && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{createPrErrors.vendor}</span>}
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>
                          Vendor Bill (Optional / Auto-fill)
                        </label>
                        <select
                          value={createPrForm.vendorBill}
                          onChange={(e) => {
                            const billId = e.target.value;
                            const bill = vendorBills.find((b) => String(b._id) === String(billId));
                            if (bill) {
                              setCreatePrForm((prev) => ({
                                ...prev,
                                vendorBill: billId,
                                vendorBillNumber: bill.billNumber || '',
                                amount: bill.balance || bill.totalAmount || '',
                                referenceNumber: bill.billNumber || prev.referenceNumber,
                                reason: `Payment for vendor bill ${bill.billNumber}`,
                              }));
                            } else {
                              setCreatePrForm((prev) => ({ ...prev, vendorBill: '', vendorBillNumber: '' }));
                            }
                          }}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                        >
                          <option value="">-- Direct Payment / No Linked Bill --</option>
                          {vendorBills
                            .filter((b) => !createPrForm.vendor || String(b.vendor?._id || b.vendor) === String(createPrForm.vendor))
                            .map((b) => (
                              <option key={b._id} value={b._id}>
                                {b.billNumber} — {formatCurrency(b.totalAmount)} (Bal: {formatCurrency(b.balance || b.totalAmount)})
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Amount (₹) *</label>
                        <input
                          type="number"
                          required
                          min="0.01"
                          step="any"
                          placeholder="0.00"
                          value={createPrForm.amount}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, amount: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: createPrErrors.amount ? '1px solid #dc2626' : '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700 }}
                        />
                        {createPrErrors.amount && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{createPrErrors.amount}</span>}
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Payment Method</label>
                        <select
                          value={createPrForm.paymentMethod}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, paymentMethod: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                        >
                          <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                          <option value="UPI / IMPS">UPI / IMPS</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Credit Card">Company Credit Card</option>
                          <option value="Cash">Cash</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Preferred Payment Date</label>
                        <input
                          type="date"
                          value={createPrForm.preferredPaymentDate}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, preferredPaymentDate: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Reference / Invoice Number</label>
                        <input
                          type="text"
                          placeholder="e.g. INV-2026-9021"
                          value={createPrForm.referenceNumber}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, referenceNumber: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Payment Purpose *</label>
                      <textarea
                        rows="2"
                        required
                        placeholder="Detail the goods or services for which this vendor disbursement is requested..."
                        value={createPrForm.reason}
                        onChange={(e) => setCreatePrForm({ ...createPrForm, reason: e.target.value })}
                        style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: createPrErrors.reason ? '1px solid #dc2626' : '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical' }}
                      />
                      {createPrErrors.reason && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{createPrErrors.reason}</span>}
                    </div>
                  </div>
                )}

                {/* --- CASE B: EMPLOYEE REIMBURSEMENT --- */}
                {createPrForm.paymentType === 'Employee Reimbursement' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Employee *</label>
                        <select
                          value={createPrForm.employee}
                          onChange={(e) => {
                            const empId = e.target.value;
                            const emp = allEmployees.find((x) => String(x._id) === String(empId));
                            setCreatePrForm((prev) => ({
                              ...prev,
                              employee: empId,
                              payeeName: emp ? [emp.firstName, emp.lastName].filter(Boolean).join(' ') : '',
                            }));
                          }}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: createPrErrors.employee ? '1px solid #dc2626' : '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                        >
                          <option value="">-- Choose Employee --</option>
                          {allEmployees.map((emp) => (
                            <option key={emp._id} value={emp._id}>
                              {emp.firstName} {emp.lastName} ({emp.department || emp.jobDetails?.department || 'Staff'})
                            </option>
                          ))}
                        </select>
                        {createPrErrors.employee && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{createPrErrors.employee}</span>}
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Expense Category *</label>
                        <select
                          value={createPrForm.expenseCategory}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, expenseCategory: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                        >
                          <option value="Travel & Conveyance">Travel & Conveyance</option>
                          <option value="Client Entertainment">Client Entertainment</option>
                          <option value="Food & Meals">Food & Meals</option>
                          <option value="Office Supplies">Office Supplies</option>
                          <option value="Internet & Telephone">Internet & Telephone</option>
                          <option value="Software & Subscriptions">Software & Subscriptions</option>
                          <option value="Training & Certification">Training & Certification</option>
                          <option value="Other Reimbursement">Other Reimbursement</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Expense Date *</label>
                        <input
                          type="date"
                          required
                          value={createPrForm.expenseDate}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, expenseDate: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Amount (₹) *</label>
                        <input
                          type="number"
                          required
                          min="0.01"
                          step="any"
                          placeholder="0.00"
                          value={createPrForm.amount}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, amount: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: createPrErrors.amount ? '1px solid #dc2626' : '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700 }}
                        />
                        {createPrErrors.amount && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{createPrErrors.amount}</span>}
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Payment Method</label>
                        <select
                          value={createPrForm.paymentMethod}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, paymentMethod: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                        >
                          <option value="Bank Transfer">Bank Transfer (Salary Account)</option>
                          <option value="UPI / IMPS">UPI / IMPS</option>
                          <option value="Cash">Cash</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Receipt / Bill Reference #</label>
                        <input
                          type="text"
                          placeholder="e.g. TAX-INV-204"
                          value={createPrForm.referenceNumber}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, referenceNumber: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Description / Reason *</label>
                      <textarea
                        rows="2"
                        required
                        placeholder="Explain the business purpose and itemized reimbursable expenses..."
                        value={createPrForm.reason}
                        onChange={(e) => setCreatePrForm({ ...createPrForm, reason: e.target.value })}
                        style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: createPrErrors.reason ? '1px solid #dc2626' : '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical' }}
                      />
                      {createPrErrors.reason && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{createPrErrors.reason}</span>}
                    </div>
                  </div>
                )}

                {/* --- CASE C: SALARY ADVANCE --- */}
                {createPrForm.paymentType === 'Salary Advance' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Employee *</label>
                        <select
                          value={createPrForm.employee}
                          onChange={(e) => {
                            const empId = e.target.value;
                            const emp = allEmployees.find((x) => String(x._id) === String(empId));
                            setCreatePrForm((prev) => ({
                              ...prev,
                              employee: empId,
                              payeeName: emp ? [emp.firstName, emp.lastName].filter(Boolean).join(' ') : '',
                            }));
                          }}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: createPrErrors.employee ? '1px solid #dc2626' : '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                        >
                          <option value="">-- Choose Employee --</option>
                          {allEmployees.map((emp) => (
                            <option key={emp._id} value={emp._id}>
                              {emp.firstName} {emp.lastName} ({emp.department || 'Staff'})
                            </option>
                          ))}
                        </select>
                        {createPrErrors.employee && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{createPrErrors.employee}</span>}
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Requested Amount (₹) *</label>
                        <input
                          type="number"
                          required
                          min="1"
                          placeholder="e.g. 20000"
                          value={createPrForm.amount}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, amount: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: createPrErrors.amount ? '1px solid #dc2626' : '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700 }}
                        />
                        {createPrErrors.amount && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{createPrErrors.amount}</span>}
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Preferred Payment Date</label>
                        <input
                          type="date"
                          value={createPrForm.preferredPaymentDate}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, preferredPaymentDate: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Recovery / Repayment Plan</label>
                        <select
                          value={createPrForm.repaymentPlan}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, repaymentPlan: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                        >
                          <option value="Monthly Deduction from Payroll">Monthly Deduction from Payroll</option>
                          <option value="Bullet Repayment in Next Payroll">Bullet Repayment in Next Payroll</option>
                          <option value="Manual Recovery Schedule">Manual Recovery Schedule</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Number of Installments</label>
                        <select
                          value={createPrForm.installments}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, installments: Number(e.target.value) })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                        >
                          <option value="1">1 Month (Immediate next month)</option>
                          <option value="2">2 Months</option>
                          <option value="3">3 Months</option>
                          <option value="4">4 Months</option>
                          <option value="6">6 Months</option>
                          <option value="12">12 Months</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Estimated Monthly Deduction</label>
                        <div style={{ marginTop: '4px', padding: '8px 10px', borderRadius: '6px', background: '#ffedd5', border: '1px solid #fed7aa', color: '#9a3412', fontWeight: 800, fontSize: '13.5px' }}>
                          {formatCurrency(Math.round((Number(createPrForm.amount) || 0) / (Number(createPrForm.installments) || 1)))} / month
                        </div>
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Reason / Justification *</label>
                      <textarea
                        rows="2"
                        required
                        placeholder="State the reason for requesting salary advance (medical, emergency, personal)..."
                        value={createPrForm.reason}
                        onChange={(e) => setCreatePrForm({ ...createPrForm, reason: e.target.value })}
                        style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: createPrErrors.reason ? '1px solid #dc2626' : '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical' }}
                      />
                      {createPrErrors.reason && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{createPrErrors.reason}</span>}
                    </div>
                  </div>
                )}

                {/* --- CASE D: EMPLOYEE LOAN --- */}
                {createPrForm.paymentType === 'Employee Loan' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Employee *</label>
                        <select
                          value={createPrForm.employee}
                          onChange={(e) => {
                            const empId = e.target.value;
                            const emp = allEmployees.find((x) => String(x._id) === String(empId));
                            setCreatePrForm((prev) => ({
                              ...prev,
                              employee: empId,
                              payeeName: emp ? [emp.firstName, emp.lastName].filter(Boolean).join(' ') : '',
                            }));
                          }}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: createPrErrors.employee ? '1px solid #dc2626' : '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                        >
                          <option value="">-- Choose Employee --</option>
                          {allEmployees.map((emp) => (
                            <option key={emp._id} value={emp._id}>
                              {emp.firstName} {emp.lastName} ({emp.department || 'Staff'})
                            </option>
                          ))}
                        </select>
                        {createPrErrors.employee && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{createPrErrors.employee}</span>}
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Loan Amount (₹) *</label>
                        <input
                          type="number"
                          required
                          min="1"
                          placeholder="e.g. 50000"
                          value={createPrForm.amount}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, amount: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: createPrErrors.amount ? '1px solid #dc2626' : '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700 }}
                        />
                        {createPrErrors.amount && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{createPrErrors.amount}</span>}
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Tenure (Months)</label>
                        <select
                          value={createPrForm.installments}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, installments: Number(e.target.value) })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                        >
                          <option value="3">3 Months</option>
                          <option value="6">6 Months</option>
                          <option value="12">12 Months (1 Year)</option>
                          <option value="18">18 Months</option>
                          <option value="24">24 Months (2 Years)</option>
                          <option value="36">36 Months (3 Years)</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Est. Monthly Recovery</label>
                        <div style={{ marginTop: '4px', padding: '8px 10px', borderRadius: '6px', background: '#fdf4ff', border: '1px solid #f5d0fe', color: '#86198f', fontWeight: 800, fontSize: '13.5px' }}>
                          {formatCurrency(Math.round((Number(createPrForm.amount) || 0) / (Number(createPrForm.installments) || 6)))} / month
                        </div>
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Reason / Loan Purpose *</label>
                      <textarea
                        rows="2"
                        required
                        placeholder="Specify company loan purpose, agreement terms or justification..."
                        value={createPrForm.reason}
                        onChange={(e) => setCreatePrForm({ ...createPrForm, reason: e.target.value })}
                        style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: createPrErrors.reason ? '1px solid #dc2626' : '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical' }}
                      />
                      {createPrErrors.reason && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{createPrErrors.reason}</span>}
                    </div>
                  </div>
                )}

                {/* --- CASE E: COMPANY EXPENSE --- */}
                {createPrForm.paymentType === 'Company Expense' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Expense Category *</label>
                        <select
                          value={createPrForm.expenseCategory}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, expenseCategory: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                        >
                          <option value="Office Rent & Utilities">Office Rent & Utilities</option>
                          <option value="IT & Infrastructure">IT & Infrastructure</option>
                          <option value="Marketing & Advertising">Marketing & Advertising</option>
                          <option value="Legal & Professional Fees">Legal & Professional Fees</option>
                          <option value="Software Licenses">Software Licenses</option>
                          <option value="Hardware & Equipment">Hardware & Equipment</option>
                          <option value="Operational Expenses">Operational Expenses</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Payee / Beneficiary Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. AWS Cloud, Building Management, Internet ISP"
                          value={createPrForm.payeeName}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, payeeName: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: createPrErrors.payeeName ? '1px solid #dc2626' : '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                        {createPrErrors.payeeName && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{createPrErrors.payeeName}</span>}
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Amount (₹) *</label>
                        <input
                          type="number"
                          required
                          min="0.01"
                          step="any"
                          placeholder="0.00"
                          value={createPrForm.amount}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, amount: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: createPrErrors.amount ? '1px solid #dc2626' : '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700 }}
                        />
                        {createPrErrors.amount && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{createPrErrors.amount}</span>}
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Expense Date *</label>
                        <input
                          type="date"
                          required
                          value={createPrForm.expenseDate}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, expenseDate: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Payment Method</label>
                        <select
                          value={createPrForm.paymentMethod}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, paymentMethod: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                        >
                          <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                          <option value="Credit Card">Corporate Credit Card</option>
                          <option value="UPI / IMPS">UPI / IMPS</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Cash">Cash</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Invoice / Bill Reference #</label>
                        <input
                          type="text"
                          placeholder="e.g. AWS-INV-8910"
                          value={createPrForm.referenceNumber}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, referenceNumber: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Purpose / Reason *</label>
                      <textarea
                        rows="2"
                        required
                        placeholder="Detail company expense purpose, vendor service or operational requirement..."
                        value={createPrForm.reason}
                        onChange={(e) => setCreatePrForm({ ...createPrForm, reason: e.target.value })}
                        style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: createPrErrors.reason ? '1px solid #dc2626' : '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical' }}
                      />
                      {createPrErrors.reason && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{createPrErrors.reason}</span>}
                    </div>
                  </div>
                )}

                {/* --- CASE F: OTHER --- */}
                {createPrForm.paymentType === 'Other' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Payee Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="Name of payee"
                          value={createPrForm.payeeName}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, payeeName: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: createPrErrors.payeeName ? '1px solid #dc2626' : '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                        {createPrErrors.payeeName && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{createPrErrors.payeeName}</span>}
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Amount (₹) *</label>
                        <input
                          type="number"
                          required
                          min="0.01"
                          step="any"
                          placeholder="0.00"
                          value={createPrForm.amount}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, amount: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: createPrErrors.amount ? '1px solid #dc2626' : '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700 }}
                        />
                        {createPrErrors.amount && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{createPrErrors.amount}</span>}
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Payment Method</label>
                        <select
                          value={createPrForm.paymentMethod}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, paymentMethod: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                        >
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="UPI / IMPS">UPI / IMPS</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Cash">Cash</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Preferred Due Date</label>
                        <input
                          type="date"
                          value={createPrForm.preferredPaymentDate}
                          onChange={(e) => setCreatePrForm({ ...createPrForm, preferredPaymentDate: e.target.value })}
                          style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Payment Purpose / Reason *</label>
                      <textarea
                        rows="2"
                        required
                        placeholder="State purpose of this payment request..."
                        value={createPrForm.reason}
                        onChange={(e) => setCreatePrForm({ ...createPrForm, reason: e.target.value })}
                        style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: createPrErrors.reason ? '1px solid #dc2626' : '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical' }}
                      />
                      {createPrErrors.reason && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>{createPrErrors.reason}</span>}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: ADDITIONAL INFORMATION & ATTACHMENTS */}
              <div style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: '10px', padding: '1.15rem' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.85rem' }}>
                  3. Additional Information & Attachments
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Detailed Description / Line Items</label>
                    <textarea
                      rows="2"
                      placeholder="Optional additional notes, remarks or line item breakdowns..."
                      value={createPrForm.description}
                      onChange={(e) => setCreatePrForm({ ...createPrForm, description: e.target.value })}
                      style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                      Receipt / Supporting Document Attachment
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <label
                        style={{
                          background: '#f8fafc',
                          color: '#334155',
                          border: '1px dashed #94a3b8',
                          borderRadius: '6px',
                          padding: '8px 16px',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          cursor: uploadingDoc ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>📎</span>
                        <span>{uploadingDoc ? 'Uploading File...' : 'Choose File to Upload'}</span>
                        <input
                          type="file"
                          disabled={uploadingDoc}
                          onChange={handlePrFileUpload}
                          style={{ display: 'none' }}
                        />
                      </label>

                      {createPrForm.supportingDocumentUrl ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#dcfce7', color: '#166534', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                          <span>✓ Attached: {uploadedDocName || 'Supporting Document'}</span>
                          <a
                            href={createPrForm.supportingDocumentUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: '#15803d', textDecoration: 'underline', marginLeft: '6px' }}
                          >
                            View
                          </a>
                        </div>
                      ) : (
                        <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                          Accepts PDF, images, bills, vouchers up to 15MB
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Internal Notes (Finance & Approvers)</label>
                    <textarea
                      rows="2"
                      placeholder="Optional notes visible during approval and payment verification..."
                      value={createPrForm.notes}
                      onChange={(e) => setCreatePrForm({ ...createPrForm, notes: e.target.value })}
                      style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical' }}
                    />
                  </div>
                </div>
              </div>

              {/* Form Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setCreatePrModalOpen(false)}
                  disabled={createPrSubmitting}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#334155',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPrSubmitting || uploadingDoc}
                  style={{
                    background: '#FFF4E8',
                    color: '#E85D04',
                    border: '1px solid #F5B97A',
                    borderRadius: '7px',
                    padding: '9px 22px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: createPrSubmitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {createPrSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 7b. VIEW PAYMENT REQUEST DETAILS MODAL ─── */}
      {viewPrModalOpen && selectedPr && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewPrModalOpen(false);
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '740px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                    {selectedPr.requestNumber}
                  </span>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, ...getStatusBadge(selectedPr.status) }}>
                    {selectedPr.status}
                  </span>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, ...getPriorityBadge(selectedPr.priority) }}>
                    {selectedPr.priority || 'Medium'}
                  </span>
                </div>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Created on {formatDate(selectedPr.createdAt || selectedPr.requestDate)} &bull; Department: <strong>{selectedPr.department || 'Finance'}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewPrModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Highlight Card */}
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#9a3412', textTransform: 'uppercase' }}>
                    {selectedPr.paymentType} &bull; {selectedPr.payeeName}
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ea580c', marginTop: '2px' }}>
                    {formatCurrency(selectedPr.amount)}
                  </div>
                </div>
                {selectedPr.paymentMethod && (
                  <div style={{ textAlign: 'right', fontSize: '12.5px', color: '#7c2d12' }}>
                    <div>Method: <strong>{selectedPr.paymentMethod}</strong></div>
                    {selectedPr.referenceNumber && <div>Ref: <strong>{selectedPr.referenceNumber}</strong></div>}
                  </div>
                )}
              </div>

              {/* Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', fontSize: '13px' }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: '11.5px', fontWeight: 600 }}>Requested By</div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{selectedPr.requesterName || '—'}</div>
                </div>

                <div>
                  <div style={{ color: '#64748b', fontSize: '11.5px', fontWeight: 600 }}>Required By Date</div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{formatDate(selectedPr.requiredDate)}</div>
                </div>

                {selectedPr.preferredPaymentDate && (
                  <div>
                    <div style={{ color: '#64748b', fontSize: '11.5px', fontWeight: 600 }}>Preferred Payment Date</div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{formatDate(selectedPr.preferredPaymentDate)}</div>
                  </div>
                )}

                {selectedPr.expenseCategory && (
                  <div>
                    <div style={{ color: '#64748b', fontSize: '11.5px', fontWeight: 600 }}>Category</div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{selectedPr.expenseCategory}</div>
                  </div>
                )}

                {selectedPr.repaymentPlan && (
                  <div>
                    <div style={{ color: '#64748b', fontSize: '11.5px', fontWeight: 600 }}>Repayment Plan</div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>
                      {selectedPr.repaymentPlan} ({selectedPr.installments || 1} mos)
                    </div>
                  </div>
                )}

                {selectedPr.vendorBill && (
                  <div>
                    <div style={{ color: '#64748b', fontSize: '11.5px', fontWeight: 600 }}>Linked Vendor Bill</div>
                    <div style={{ fontWeight: 700, color: '#0284c7' }}>
                      {selectedPr.vendorBill.billNumber || selectedPr.vendorBillNumber || 'Linked Bill'}
                    </div>
                  </div>
                )}
              </div>

              {/* Purpose & Description */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Purpose / Reason
                </div>
                <div style={{ fontSize: '13.5px', color: '#0f172a', fontWeight: 600 }}>
                  {selectedPr.reason || '—'}
                </div>
                {selectedPr.description && selectedPr.description !== selectedPr.reason && (
                  <div style={{ marginTop: '8px', fontSize: '12.5px', color: '#64748b' }}>
                    {selectedPr.description}
                  </div>
                )}
              </div>

              {/* Supporting Attachment */}
              {selectedPr.supportingDocumentUrl && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>📎</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#166534' }}>
                      Supporting Document Attached
                    </span>
                  </div>
                  <a
                    href={selectedPr.supportingDocumentUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: '#16a34a',
                      color: '#fff',
                      textDecoration: 'none',
                      padding: '5px 12px',
                      borderRadius: '5px',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    Open Document
                  </a>
                </div>
              )}

              {/* Notes */}
              {selectedPr.notes && (
                <div>
                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Internal Notes</div>
                  <div style={{ fontSize: '12.5px', color: '#334155', marginTop: '2px' }}>{selectedPr.notes}</div>
                </div>
              )}

              {/* Approval / Rejection Trail */}
              {selectedPr.status === 'Approved' && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.85rem', fontSize: '12.5px', color: '#1e40af' }}>
                  ✓ Approved by <strong>{selectedPr.approvedByName || 'Finance Admin'}</strong> on {formatDate(selectedPr.approvedAt)}
                </div>
              )}
              {selectedPr.status === 'Rejected' && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.85rem', fontSize: '12.5px', color: '#991b1b' }}>
                  ✕ Rejected: <strong>{selectedPr.rejectionReason || 'No remarks entered'}</strong>
                </div>
              )}
              {selectedPr.status === 'Paid' && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.85rem', fontSize: '12.5px', color: '#166534' }}>
                  💳 Disbursed on {formatDate(selectedPr.paidAt)} through company banking
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {selectedPr.status === 'Submitted' && isFinanceAdmin && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleApprovePaymentRequest(selectedPr._id)}
                      style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Approve Request
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenRejectModal(selectedPr._id)}
                      style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', padding: '7px 16px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Reject Request
                    </button>
                  </div>
                )}

                {selectedPr.status === 'Approved' && isFinanceAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setViewPrModalOpen(false);
                      openDisburseModal({ ...selectedPr, _isPaymentRequest: true });
                    }}
                    style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '7px 18px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    💳 Disburse Now
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setViewPrModalOpen(false)}
                style={{ padding: '7px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: 600, fontSize: '12.5px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 7c. REJECT PAYMENT REQUEST PROMPT MODAL ─── */}
      {rejectPrModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !rejectingPr) setRejectPrModalOpen(false);
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '10px',
              width: '100%',
              maxWidth: '480px',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', color: '#b91c1c' }}>Reject Payment Request</h3>
            <p style={{ margin: '0 0 1rem', fontSize: '13px', color: '#64748b' }}>
              Please state the reason for rejecting this payment request. The requester will be notified.
            </p>
            <textarea
              rows="3"
              placeholder="e.g. Missing valid vendor invoice, budget exhausted, requires revision..."
              value={rejectReasonText}
              onChange={(e) => setRejectReasonText(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setRejectPrModalOpen(false)}
                disabled={rejectingPr}
                style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRejectPaymentRequest}
                disabled={rejectingPr}
                style={{ padding: '7px 16px', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
              >
                {rejectingPr ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 9. SALARY DISBURSAL / PAYMENT MODAL ─── */}
      {disburseModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '520px',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                  {disburseTarget === 'bulk' ? `Bulk Salary Disbursal — ${selectedMonth}` : `Disburse Payment — ${disburseTarget?.payeeName || selectedEmpRow?.name}`}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Debits selected company bank account & records Payment in Finance
                </p>
              </div>
              <button type="button" onClick={() => setDisburseModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '12px', color: '#166534', fontWeight: 700 }}>PAYOUT AMOUNT</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#15803d' }}>
                {disburseTarget === 'bulk' ? formatCurrency(summary.pendingAmount) : formatCurrency(disburseTarget?.amount || disburseTarget?.net || selectedEmpRow?.netSalary)}
              </div>
              <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>
                {disburseTarget === 'bulk' ? `Disbursing all ${summary.pendingCount} pending payroll records` : `Target: ${disburseTarget?.payeeName || selectedEmpRow?.name}`}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Company Bank Account *</label>
                <select
                  value={disburseForm.bankAccountId}
                  onChange={(e) => setDisburseForm({ ...disburseForm, bankAccountId: e.target.value })}
                  style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  {bankAccounts.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.bankName} - {b.accountName} (Balance: {formatCurrency(b.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Payment Method</label>
                  <select
                    value={disburseForm.paymentMethod}
                    onChange={(e) => setDisburseForm({ ...disburseForm, paymentMethod: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  >
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="IMPS">IMPS Instant</option>
                    <option value="Cheque">Corporate Cheque</option>
                    <option value="UPI">Corporate UPI</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>UTR / Reference No</label>
                  <input
                    type="text"
                    value={disburseForm.transactionReference}
                    onChange={(e) => setDisburseForm({ ...disburseForm, transactionReference: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Disbursal Notes</label>
                <input
                  type="text"
                  value={disburseForm.notes}
                  onChange={(e) => setDisburseForm({ ...disburseForm, notes: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={() => setDisburseModalOpen(false)}
                style={{ padding: '9px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDisbursal}
                disabled={disbursing}
                style={{
                  padding: '9px 22px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#16a34a',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
                }}
              >
                {disbursing ? 'Processing Disbursal...' : 'Confirm Disbursal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 10. GENERATE MONTHLY PAYROLL MODAL ─── */}
      {generateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '540px',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                  Generate Monthly Payroll
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Computes salary structures, attendance, unpaid leaves (LOP), extra earnings and recoveries
                </p>
              </div>
              <button type="button" onClick={() => setGenerateModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Pre-flight stats box */}
            {genStats && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>DATABASE PRE-FLIGHT CHECK</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '12px' }}>
                  <div>Active Staff: <strong style={{ color: '#0f172a' }}>{genStats.totalActive}</strong></div>
                  <div>Salary Configured: <strong style={{ color: '#16a34a' }}>{genStats.salaryConfigured}</strong></div>
                  <div>Missing Structure: <strong style={{ color: '#dc2626' }}>{genStats.missingSalary}</strong></div>
                  <div>Already Generated: <strong style={{ color: '#0284c7' }}>{genStats.alreadyGenerated}</strong></div>
                  <div style={{ gridColumn: 'span 2' }}>Ready for Generation: <strong style={{ color: '#ea580c' }}>{genStats.readyToGenerate}</strong></div>
                </div>
              </div>
            )}

            <form onSubmit={handleGeneratePayrollSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Month *</label>
                    <select
                      value={genForm.month}
                      onChange={(e) => setGenForm({ ...genForm, month: e.target.value })}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Year *</label>
                    <select
                      value={genForm.year}
                      onChange={(e) => setGenForm({ ...genForm, year: e.target.value })}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                      <option value="2027">2027</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Department Scope</label>
                  <select
                    value={genForm.department}
                    onChange={(e) => setGenForm({ ...genForm, department: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="All">All Active Employees ({allEmployees.length})</option>
                    <option value="Tech">Tech</option>
                    <option value="HR">HR</option>
                    <option value="Finance">Finance</option>
                    <option value="Business Development">Business Development</option>
                    <option value="Digital Marketing">Digital Marketing</option>
                    <option value="Video Editor">Video Editor</option>
                  </select>
                </div>

                <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', padding: '10px', fontSize: '12px', color: '#92400e' }}>
                  <strong>🔒 Duplicate Payroll Protection:</strong> Employees who already have a payroll record for {genForm.month} {genForm.year} will NOT be duplicated. You can recalculate them from their Manage panel.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setGenerateModalOpen(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 600 }}>Cancel</button>
                <button
                  type="submit"
                  disabled={genLoading}
                  style={{
                    padding: '8px 22px',
                    borderRadius: '6px',
                    border: '1px solid #F5B97A',
                    background: '#FFF4E8',
                    color: '#E85D04',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {genLoading ? 'Calculating & Generating...' : 'Run Payroll Generation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 11. PAYSLIP MODAL (PRINT READY) ─── */}
      {payslipModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '820px',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>
                Official Employee Payslip Preview
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    background: '#0f172a',
                    color: '#fff',
                    border: 'none',
                    padding: '7px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  🖨️ Print Payslip
                </button>
                <button type="button" onClick={() => setPayslipModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
              </div>
            </div>

            <div style={{ padding: '1.5rem', flex: 1 }}>
              {payslipLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  Loading payslip details...
                </div>
              ) : payslipData?.html ? (
                <div
                  dangerouslySetInnerHTML={{ __html: payslipData.html }}
                  style={{ width: '100%', background: '#fff' }}
                />
              ) : (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                  No payslip preview available.
                </div>
              )}
            </div>

            <div style={{ padding: '0.85rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setPayslipModalOpen(false)}
                style={{ padding: '7px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: 600, fontSize: '12.5px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── QUICK MANAGEMENT MODAL 1: ADD SALARY ─── */}
      {addSalaryModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '740px',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid #fed7aa',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#FFF4E8',
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: '15px', color: '#9a3412' }}>
                  💼 Add / Update Employee Salary Structure
                </div>
                <div style={{ fontSize: '11.5px', color: '#c2410c', marginTop: '2px' }}>
                  Configure real salary components, statutory deductions and bank accounts
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddSalaryModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#9a3412' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAddSalary} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Employee Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Select Employee *
                </label>
                <select
                  value={addSalaryForm.employeeId}
                  onChange={(e) => handleAddSalaryEmpChange(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    background: '#fff',
                  }}
                >
                  <option value="">-- Choose Employee --</option>
                  {allEmployees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {[emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.email} ({emp.jobDetails?.employeeId || emp.employeeId || 'ID Pending'}) - {emp.department || 'General'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Employee Details Readonly Strip */}
              {(() => {
                const target = allEmployees.find((e) => String(e._id) === String(addSalaryForm.employeeId));
                if (!target) return null;
                return (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '0.65rem 0.9rem',
                      display: 'flex',
                      gap: '1.25rem',
                      flexWrap: 'wrap',
                      fontSize: '12px',
                      color: '#475569',
                    }}
                  >
                    <div><strong style={{ color: '#0f172a' }}>ID:</strong> {target.jobDetails?.employeeId || target.employeeId || '—'}</div>
                    <div><strong style={{ color: '#0f172a' }}>Dept:</strong> {target.department || 'General'}</div>
                    <div><strong style={{ color: '#0f172a' }}>Role:</strong> {target.designation || 'Staff'}</div>
                    <div><strong style={{ color: '#0f172a' }}>Email:</strong> {target.email}</div>
                  </div>
                );
              })()}

              {/* Live Salary Computation Bar */}
              {(() => {
                const b = Number(addSalaryForm.basicSalary) || 0;
                const h = Number(addSalaryForm.hra) || 0;
                const c = Number(addSalaryForm.conveyance) || 0;
                const m = Number(addSalaryForm.medicalAllowance) || 0;
                const s = Number(addSalaryForm.specialAllowance) || 0;
                const bon = Number(addSalaryForm.bonus) || 0;
                const gross = b + h + c + m + s + bon;

                const pf = Number(addSalaryForm.pf) || 0;
                const pt = Number(addSalaryForm.professionalTax) || 0;
                const tds = Number(addSalaryForm.tds) || 0;
                const oth = Number(addSalaryForm.otherDeductions) || 0;
                const totalDed = pf + pt + tds + oth;
                const net = Math.max(0, gross - totalDed);

                return (
                  <div
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      padding: '0.75rem 1rem',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: '10px',
                      textAlign: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', color: '#166534', fontWeight: 700 }}>GROSS SALARY</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>{formatCurrency(gross)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: 700 }}>TOTAL DEDUCTIONS</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#b91c1c', marginTop: '2px' }}>{formatCurrency(totalDed)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#c2410c', fontWeight: 700 }}>NET TAKE-HOME</div>
                      <div style={{ fontSize: '17px', fontWeight: 900, color: '#ea580c', marginTop: '2px' }}>{formatCurrency(net)}</div>
                    </div>
                  </div>
                );
              })()}

              {/* Earnings & Deductions 2-Column Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                {/* Column 1: Earnings */}
                <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#166534', marginBottom: '0.65rem', textTransform: 'uppercase' }}>
                    📈 Monthly Earnings
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Basic Salary (₹) *</label>
                      <input
                        type="number"
                        min="0"
                        value={addSalaryForm.basicSalary}
                        onChange={(e) => setAddSalaryForm({ ...addSalaryForm, basicSalary: e.target.value })}
                        required
                        placeholder="e.g. 50000"
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>HRA (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={addSalaryForm.hra}
                        onChange={(e) => setAddSalaryForm({ ...addSalaryForm, hra: e.target.value })}
                        placeholder="e.g. 20000"
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Conveyance Allowance (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={addSalaryForm.conveyance}
                        onChange={(e) => setAddSalaryForm({ ...addSalaryForm, conveyance: e.target.value })}
                        placeholder="e.g. 2500"
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Medical Allowance (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={addSalaryForm.medicalAllowance}
                        onChange={(e) => setAddSalaryForm({ ...addSalaryForm, medicalAllowance: e.target.value })}
                        placeholder="e.g. 1500"
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Special Allowance (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={addSalaryForm.specialAllowance}
                        onChange={(e) => setAddSalaryForm({ ...addSalaryForm, specialAllowance: e.target.value })}
                        placeholder="e.g. 6000"
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Bonus / Incentive (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={addSalaryForm.bonus}
                        onChange={(e) => setAddSalaryForm({ ...addSalaryForm, bonus: e.target.value })}
                        placeholder="e.g. 5000"
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Column 2: Deductions */}
                <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#991b1b', marginBottom: '0.65rem', textTransform: 'uppercase' }}>
                    📉 Monthly Deductions
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Provident Fund (PF) (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={addSalaryForm.pf}
                        onChange={(e) => setAddSalaryForm({ ...addSalaryForm, pf: e.target.value })}
                        placeholder="e.g. 1800"
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Professional Tax (PT) (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={addSalaryForm.professionalTax}
                        onChange={(e) => setAddSalaryForm({ ...addSalaryForm, professionalTax: e.target.value })}
                        placeholder="e.g. 200"
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>TDS / Income Tax (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={addSalaryForm.tds}
                        onChange={(e) => setAddSalaryForm({ ...addSalaryForm, tds: e.target.value })}
                        placeholder="e.g. 3500"
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Other Statutory Deductions (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={addSalaryForm.otherDeductions}
                        onChange={(e) => setAddSalaryForm({ ...addSalaryForm, otherDeductions: e.target.value })}
                        placeholder="e.g. 500"
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Effective Date</label>
                      <input
                        type="date"
                        value={addSalaryForm.effectiveDate}
                        onChange={(e) => setAddSalaryForm({ ...addSalaryForm, effectiveDate: e.target.value })}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Salary Status</label>
                      <select
                        value={addSalaryForm.status}
                        onChange={(e) => setAddSalaryForm({ ...addSalaryForm, status: e.target.value })}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', background: '#fff' }}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive / Suspended</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bank Account Details */}
              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#0369a1', marginBottom: '0.65rem', textTransform: 'uppercase' }}>
                  🏦 Bank Account Details (for Direct Salary Disbursals)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Account Holder Name</label>
                    <input
                      type="text"
                      value={addSalaryForm.accountHolderName}
                      onChange={(e) => setAddSalaryForm({ ...addSalaryForm, accountHolderName: e.target.value })}
                      placeholder="Name as per bank"
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Bank Name</label>
                    <input
                      type="text"
                      value={addSalaryForm.bankName}
                      onChange={(e) => setAddSalaryForm({ ...addSalaryForm, bankName: e.target.value })}
                      placeholder="e.g. HDFC Bank"
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Account Number</label>
                    <input
                      type="text"
                      value={addSalaryForm.accountNumber}
                      onChange={(e) => setAddSalaryForm({ ...addSalaryForm, accountNumber: e.target.value })}
                      placeholder="Account number"
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>IFSC Code</label>
                    <input
                      type="text"
                      value={addSalaryForm.ifscCode}
                      onChange={(e) => setAddSalaryForm({ ...addSalaryForm, ifscCode: e.target.value.toUpperCase() })}
                      placeholder="HDFC0001234"
                      style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Remarks / Notes</label>
                <textarea
                  rows="2"
                  value={addSalaryForm.remarks}
                  onChange={(e) => setAddSalaryForm({ ...addSalaryForm, remarks: e.target.value })}
                  placeholder="e.g. Revised CTC structure for FY 2026-27"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              {/* Form Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setAddSalaryModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSalarySaving}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '7px',
                    border: '1px solid #F5B97A',
                    background: '#FFF4E8',
                    color: '#E85D04',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: addSalarySaving ? 'not-allowed' : 'pointer',
                    opacity: addSalarySaving ? 0.7 : 1,
                  }}
                >
                  {addSalarySaving ? 'Saving Structure...' : '💾 Save Salary Structure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── QUICK MANAGEMENT MODAL 2: RECORD PAYMENT ─── */}
      {recordPaymentModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '640px',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid #fed7aa',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#FFF4E8',
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: '15px', color: '#9a3412' }}>
                  💳 Record Company Payment
                </div>
                <div style={{ fontSize: '11.5px', color: '#c2410c', marginTop: '2px' }}>
                  Direct payment disbursal recorded into MongoDB ledger & bank balances
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRecordPaymentModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#9a3412' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRecordPayment} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Payment Reference #</label>
                  <input
                    type="text"
                    value={recordPaymentForm.paymentReference}
                    onChange={(e) => setRecordPaymentForm({ ...recordPaymentForm, paymentReference: e.target.value })}
                    required
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Payment Type *</label>
                  <select
                    value={recordPaymentForm.paymentType}
                    onChange={(e) => setRecordPaymentForm({ ...recordPaymentForm, paymentType: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', background: '#fff' }}
                  >
                    <option value="Direct Expense">Direct Expense</option>
                    <option value="Payment Request Disbursal">Payment Request Disbursal</option>
                    <option value="Salary Disbursal">Salary Disbursal</option>
                    <option value="Vendor Payment">Vendor Payment</option>
                    <option value="Advance Disbursal">Advance Disbursal</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Link to Approved Payment Request if selected */}
              {recordPaymentForm.paymentType === 'Payment Request Disbursal' && (
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Link Approved Payment Request</label>
                  <select
                    value={recordPaymentForm.relatedPaymentRequestId}
                    onChange={(e) => {
                      const selPr = allPaymentRequests.find((pr) => String(pr._id) === String(e.target.value));
                      setRecordPaymentForm({
                        ...recordPaymentForm,
                        relatedPaymentRequestId: e.target.value,
                        payeeName: selPr?.payeeName || recordPaymentForm.payeeName,
                        amount: selPr ? String(selPr.amount) : recordPaymentForm.amount,
                      });
                    }}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', background: '#fff' }}
                  >
                    <option value="">-- Optional: Select Approved Request --</option>
                    {allPaymentRequests.filter((pr) => pr.status === 'Approved' || pr.status === 'Pending').map((pr) => (
                      <option key={pr._id} value={pr._id}>
                        {pr.requestNumber} - {pr.payeeName} ({formatCurrency(pr.amount)}) [{pr.status}]
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Link to Unpaid Payroll Slip if selected */}
              {recordPaymentForm.paymentType === 'Salary Disbursal' && (
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Link Employee Payroll Slip</label>
                  <select
                    value={recordPaymentForm.relatedPayrollId}
                    onChange={(e) => {
                      const selSlip = payrolls.find((p) => String(p._id) === String(e.target.value));
                      setRecordPaymentForm({
                        ...recordPaymentForm,
                        relatedPayrollId: e.target.value,
                        payeeName: selSlip?.employeeName || recordPaymentForm.payeeName,
                        amount: selSlip ? String(selSlip.net) : recordPaymentForm.amount,
                      });
                    }}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', background: '#fff' }}
                  >
                    <option value="">-- Optional: Select Unpaid Slip --</option>
                    {payrolls.filter((p) => p.status !== 'Paid').map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.employeeName || 'Staff'} ({p.payPeriod}) - Net: {formatCurrency(p.net)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Payee / Beneficiary Name *</label>
                  <input
                    type="text"
                    value={recordPaymentForm.payeeName}
                    onChange={(e) => setRecordPaymentForm({ ...recordPaymentForm, payeeName: e.target.value })}
                    required
                    placeholder="Person or Company name"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Amount (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    value={recordPaymentForm.amount}
                    onChange={(e) => setRecordPaymentForm({ ...recordPaymentForm, amount: e.target.value })}
                    required
                    placeholder="Payment amount"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Payment Date</label>
                  <input
                    type="date"
                    value={recordPaymentForm.paymentDate}
                    onChange={(e) => setRecordPaymentForm({ ...recordPaymentForm, paymentDate: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Payment Method</label>
                  <select
                    value={recordPaymentForm.paymentMethod}
                    onChange={(e) => setRecordPaymentForm({ ...recordPaymentForm, paymentMethod: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', background: '#fff' }}
                  >
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="UPI">UPI</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Company Bank Account</label>
                  <select
                    value={recordPaymentForm.bankAccountId}
                    onChange={(e) => setRecordPaymentForm({ ...recordPaymentForm, bankAccountId: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', background: '#fff' }}
                  >
                    <option value="">Default Primary Bank</option>
                    {bankAccounts.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.bankName} - {b.accountName} ({b.accountNumber ? `...${String(b.accountNumber).slice(-4)}` : ''})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Transaction / UTR Reference</label>
                  <input
                    type="text"
                    value={recordPaymentForm.transactionReference}
                    onChange={(e) => setRecordPaymentForm({ ...recordPaymentForm, transactionReference: e.target.value })}
                    placeholder="e.g. UTR12345678"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Notes / Description</label>
                <textarea
                  rows="2"
                  value={recordPaymentForm.notes}
                  onChange={(e) => setRecordPaymentForm({ ...recordPaymentForm, notes: e.target.value })}
                  placeholder="Optional details regarding the payment"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setRecordPaymentModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordPaymentSaving}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '7px',
                    border: '1px solid #F5B97A',
                    background: '#FFF4E8',
                    color: '#E85D04',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: recordPaymentSaving ? 'not-allowed' : 'pointer',
                    opacity: recordPaymentSaving ? 0.7 : 1,
                  }}
                >
                  {recordPaymentSaving ? 'Recording...' : '💳 Confirm & Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── QUICK MANAGEMENT MODAL 3: ADD RECOVERY ─── */}
      {addRecoveryModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid #fed7aa',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#FFF4E8',
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: '15px', color: '#9a3412' }}>
                  💰 Add Loan & Advance Recovery Schedule
                </div>
                <div style={{ fontSize: '11.5px', color: '#c2410c', marginTop: '2px' }}>
                  Schedule automatic installment deductions from monthly employee payroll
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddRecoveryModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#9a3412' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAddRecovery} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Employee *</label>
                <select
                  value={addRecoveryForm.employeeId}
                  onChange={(e) => setAddRecoveryForm({ ...addRecoveryForm, employeeId: e.target.value })}
                  required
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', background: '#fff' }}
                >
                  <option value="">-- Choose Employee --</option>
                  {allEmployees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {[emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.email} ({emp.jobDetails?.employeeId || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Recovery Type</label>
                  <select
                    value={addRecoveryForm.advanceType}
                    onChange={(e) => setAddRecoveryForm({ ...addRecoveryForm, advanceType: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', background: '#fff' }}
                  >
                    <option value="Salary Advance">Salary Advance</option>
                    <option value="Employee Loan">Employee Loan</option>
                    <option value="Leave Deduction">Leave Deduction</option>
                    <option value="Other Recovery">Other Recovery</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Recovery Status</label>
                  <select
                    value={addRecoveryForm.status}
                    onChange={(e) => setAddRecoveryForm({ ...addRecoveryForm, status: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', background: '#fff' }}
                  >
                    <option value="Disbursed">Active / Disbursed (In Recovery)</option>
                    <option value="Approved">Approved (Awaiting Disbursal)</option>
                    <option value="Pending">Pending Approval</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Original Loan Amount (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    value={addRecoveryForm.originalAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      const inst = Number(addRecoveryForm.totalInstallments) || 3;
                      const perMonth = val ? Math.round(Number(val) / inst) : '';
                      setAddRecoveryForm({
                        ...addRecoveryForm,
                        originalAmount: val,
                        installmentAmount: perMonth,
                      });
                    }}
                    required
                    placeholder="e.g. 30000"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Total Installment Months</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={addRecoveryForm.totalInstallments}
                    onChange={(e) => {
                      const inst = Math.max(1, Number(e.target.value) || 1);
                      const orig = Number(addRecoveryForm.originalAmount) || 0;
                      setAddRecoveryForm({
                        ...addRecoveryForm,
                        totalInstallments: inst,
                        installmentAmount: orig ? Math.round(orig / inst) : addRecoveryForm.installmentAmount,
                      });
                    }}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Monthly Deduction (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={addRecoveryForm.installmentAmount}
                    onChange={(e) => setAddRecoveryForm({ ...addRecoveryForm, installmentAmount: e.target.value })}
                    placeholder="e.g. 10000"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Recovered Amount so far (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={addRecoveryForm.recoveredAmount}
                    onChange={(e) => setAddRecoveryForm({ ...addRecoveryForm, recoveredAmount: e.target.value })}
                    placeholder="0"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                </div>
              </div>

              {/* Calculated Remaining Balance Badge */}
              {(() => {
                const orig = Number(addRecoveryForm.originalAmount) || 0;
                const rec = Number(addRecoveryForm.recoveredAmount) || 0;
                const remaining = Math.max(0, orig - rec);
                return (
                  <div
                    style={{
                      background: '#fff7ed',
                      border: '1px solid #fed7aa',
                      borderRadius: '7px',
                      padding: '8px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '12px',
                    }}
                  >
                    <span style={{ color: '#c2410c', fontWeight: 700 }}>Computed Remaining Outstanding:</span>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#ea580c' }}>{formatCurrency(remaining)}</span>
                  </div>
                );
              })()}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Start Date</label>
                  <input
                    type="date"
                    value={addRecoveryForm.startDate}
                    onChange={(e) => setAddRecoveryForm({ ...addRecoveryForm, startDate: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Target End Date</label>
                  <input
                    type="date"
                    value={addRecoveryForm.endDate}
                    onChange={(e) => setAddRecoveryForm({ ...addRecoveryForm, endDate: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Reason / Remarks</label>
                <textarea
                  rows="2"
                  value={addRecoveryForm.remarks}
                  onChange={(e) => setAddRecoveryForm({ ...addRecoveryForm, remarks: e.target.value })}
                  placeholder="e.g. Festival advance recovery over 3 payroll cycles"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setAddRecoveryModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addRecoverySaving}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '7px',
                    border: '1px solid #F5B97A',
                    background: '#FFF4E8',
                    color: '#E85D04',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: addRecoverySaving ? 'not-allowed' : 'pointer',
                    opacity: addRecoverySaving ? 0.7 : 1,
                  }}
                >
                  {addRecoverySaving ? 'Saving...' : '💾 Create Recovery Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── QUICK MANAGEMENT MODAL 4: GENERATE PAYSLIP ─── */}
      {generatePayslipModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '520px',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid #fed7aa',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#FFF4E8',
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: '15px', color: '#9a3412' }}>
                  📄 Generate & View Employee Payslip
                </div>
                <div style={{ fontSize: '11.5px', color: '#c2410c', marginTop: '2px' }}>
                  Instantly compile or inspect individual monthly payroll slips
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGeneratePayslipModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#9a3412' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Select Employee *</label>
                <select
                  value={quickPayslipEmpId}
                  onChange={(e) => setQuickPayslipEmpId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                >
                  <option value="">-- Choose Employee --</option>
                  {allEmployees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {[emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.email} ({emp.jobDetails?.employeeId || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Payroll Period *</label>
                <select
                  value={quickPayslipMonth}
                  onChange={(e) => setQuickPayslipMonth(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                >
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Status Preview */}
              {(() => {
                const matchingSlip = payrolls.find(
                  (p) => String(p.user?._id || p.user || p.employee?._id || p.employee) === String(quickPayslipEmpId)
                );
                if (matchingSlip) {
                  return (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '12px' }}>
                      <div style={{ fontWeight: 700, color: '#166534' }}>✓ Payroll Record Found in Database</div>
                      <div style={{ color: '#15803d', marginTop: '2px' }}>
                        Gross: {formatCurrency(matchingSlip.gross)} | Net: {formatCurrency(matchingSlip.net)} | Status: {matchingSlip.status}
                      </div>
                    </div>
                  );
                }
                return (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '12px', color: '#64748b' }}>
                    ℹ️ No generated slip in active memory for this employee yet. Clicking Generate will compute it from salary details.
                  </div>
                );
              })()}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setGeneratePayslipModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteQuickPayslip}
                  disabled={quickPayslipLoading || !quickPayslipEmpId}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '7px',
                    border: '1px solid #F5B97A',
                    background: '#FFF4E8',
                    color: '#E85D04',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: quickPayslipLoading || !quickPayslipEmpId ? 'not-allowed' : 'pointer',
                    opacity: quickPayslipLoading || !quickPayslipEmpId ? 0.7 : 1,
                  }}
                >
                  {quickPayslipLoading ? 'Processing...' : '📄 Generate & Open Payslip'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── QUICK MANAGEMENT MODAL 5: MANAGE APPROVALS ─── */}
      {approvalsModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '48px 16px 32px 16px',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '980px',
              maxHeight: 'calc(100vh - 96px)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              margin: 'auto 0',
            }}
          >
            <div
              style={{
                padding: '1.1rem 1.5rem',
                borderBottom: '1px solid #fed7aa',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#FFF4E8',
                flexShrink: 0,
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: '15px', color: '#9a3412', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🛡️</span> Finance Approvals Workspace
                </div>
                <div style={{ fontSize: '11.5px', color: '#c2410c', marginTop: '3px' }}>
                  Authorize pending payroll slips, company payment requests and employee loan advances
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApprovalsModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: '#9a3412',
                  padding: '4px 8px',
                  borderRadius: '6px',
                }}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Approval Filter Tabs */}
            {(() => {
              const pendingPayrolls = payrolls.filter((p) => p.status !== 'Paid' && p.status !== 'Approved');
              const pendingPRs = allPaymentRequests.filter((pr) => pr.status === 'Pending' || pr.status === 'Submitted');
              const pendingAdvances = allAdvances.filter((a) => a.status === 'Pending');
              const totalCount = pendingPayrolls.length + pendingPRs.length + pendingAdvances.length;

              return (
                <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.65rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setApprovalTab('all')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        border: approvalTab === 'all' ? '1px solid #F5B97A' : '1px solid #e2e8f0',
                        background: approvalTab === 'all' ? '#FFF4E8' : '#f8fafc',
                        color: approvalTab === 'all' ? '#E85D04' : '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      All Pending ({totalCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setApprovalTab('payroll')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        border: approvalTab === 'payroll' ? '1px solid #F5B97A' : '1px solid #e2e8f0',
                        background: approvalTab === 'payroll' ? '#FFF4E8' : '#f8fafc',
                        color: approvalTab === 'payroll' ? '#E85D04' : '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      Payroll Slips ({pendingPayrolls.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setApprovalTab('requests')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        border: approvalTab === 'requests' ? '1px solid #F5B97A' : '1px solid #e2e8f0',
                        background: approvalTab === 'requests' ? '#FFF4E8' : '#f8fafc',
                        color: approvalTab === 'requests' ? '#E85D04' : '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      Payment Requests ({pendingPRs.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setApprovalTab('advances')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        border: approvalTab === 'advances' ? '1px solid #F5B97A' : '1px solid #e2e8f0',
                        background: approvalTab === 'advances' ? '#FFF4E8' : '#f8fafc',
                        color: approvalTab === 'advances' ? '#E85D04' : '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      Loan Advances ({pendingAdvances.length})
                    </button>
                  </div>

                  {/* Approvals Table */}
                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '12px' }}>
                      <colgroup>
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '22%' }} />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '22%' }} />
                      </colgroup>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                          <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Ref / Slip</th>
                          <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Category</th>
                          <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Beneficiary / Employee</th>
                          <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Amount</th>
                          <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Status</th>
                          <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Payroll items */}
                        {(approvalTab === 'all' || approvalTab === 'payroll') &&
                          pendingPayrolls.map((p) => {
                            const empId = p.user?._id || p.user || p.employeeId;
                            return (
                              <tr key={p._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '10px 12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {p.payPeriod || 'Monthly Slip'}
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                    Payroll
                                  </span>
                                </td>
                                <td style={{ padding: '10px 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {p.employeeName || 'Staff'}
                                </td>
                                <td style={{ padding: '10px 12px', fontWeight: 700 }}>{formatCurrency(p.net)}</td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                    {p.status || 'Pending'}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                    <button
                                      type="button"
                                      title="View Payslip"
                                      onClick={() => openPayslip(p)}
                                      style={{ padding: '4px 7px', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 600, fontSize: '11px', cursor: 'pointer' }}
                                    >
                                      👁️ View
                                    </button>
                                    <button
                                      type="button"
                                      title="Edit Salary"
                                      onClick={() => {
                                        const emp = allEmployees.find((e) => String(e._id) === String(empId));
                                        if (emp) handleOpenAddSalary(emp._id);
                                        else handleOpenAddSalary();
                                      }}
                                      style={{ padding: '4px 7px', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#fff', color: '#0284c7', fontWeight: 600, fontSize: '11px', cursor: 'pointer' }}
                                    >
                                      ✏️ Edit
                                    </button>
                                    <button
                                      type="button"
                                      title="Approve Slip"
                                      onClick={() => handleProcessApproval('payroll', p, 'approve')}
                                      disabled={approvingItemId === p._id}
                                      style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid #86efac', background: '#f0fdf4', color: '#166534', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}
                                    >
                                      {approvingItemId === p._id ? '...' : '✓'}
                                    </button>
                                    <button
                                      type="button"
                                      title="Delete Slip"
                                      onClick={() => handleDeleteApprovalItem('payroll', p)}
                                      style={{ padding: '4px 7px', borderRadius: '5px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}

                        {/* Payment Requests */}
                        {(approvalTab === 'all' || approvalTab === 'requests') &&
                          pendingPRs.map((pr) => (
                            <tr key={pr._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {pr.requestNumber}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{ background: '#ffedd5', color: '#c2410c', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                  {pr.paymentType || 'Request'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {pr.payeeName}
                              </td>
                              <td style={{ padding: '10px 12px', fontWeight: 700 }}>{formatCurrency(pr.amount)}</td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                  {pr.status}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    title="View Request Details"
                                    onClick={() => {
                                      setSelectedPr(pr);
                                      setViewPrModalOpen(true);
                                    }}
                                    style={{ padding: '4px 7px', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 600, fontSize: '11px', cursor: 'pointer' }}
                                  >
                                    👁️ View
                                  </button>
                                  <button
                                    type="button"
                                    title="Approve Request"
                                    onClick={() => handleProcessApproval('payment-request', pr, 'approve')}
                                    disabled={approvingItemId === pr._id}
                                    style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid #86efac', background: '#f0fdf4', color: '#166534', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}
                                  >
                                    {approvingItemId === pr._id ? '...' : '✓'}
                                  </button>
                                  <button
                                    type="button"
                                    title="Reject Request"
                                    onClick={() => handleProcessApproval('payment-request', pr, 'reject', 'Rejected by Finance Authority')}
                                    disabled={approvingItemId === pr._id}
                                    style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid #fed7aa', background: '#fffbeb', color: '#c2410c', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}
                                  >
                                    ✕
                                  </button>
                                  <button
                                    type="button"
                                    title="Delete Request"
                                    onClick={() => handleDeleteApprovalItem('payment-request', pr)}
                                    style={{ padding: '4px 7px', borderRadius: '5px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}

                        {/* Salary Advances */}
                        {(approvalTab === 'all' || approvalTab === 'advances') &&
                          pendingAdvances.map((adv) => {
                            const advEmpId = adv.employee?._id || adv.employee;
                            const targetEmp = allEmployees.find((e) => String(e._id) === String(advEmpId));

                            return (
                              <tr key={adv._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '10px 12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {adv.advanceNumber}
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ background: '#fdf4ff', color: '#86198f', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                    {adv.advanceType}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {adv.employeeName}
                                </td>
                                <td style={{ padding: '10px 12px', fontWeight: 700 }}>{formatCurrency(adv.requestedAmount)}</td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                    Pending
                                  </span>
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                    <button
                                      type="button"
                                      title="Manage Employee Profile"
                                      onClick={() => {
                                        if (targetEmp) handleManageEmployee(targetEmp, 'salary');
                                        else showNotice('info', 'Employee record not found');
                                      }}
                                      style={{ padding: '4px 7px', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 600, fontSize: '11px', cursor: 'pointer' }}
                                    >
                                      👁️ View
                                    </button>
                                    <button
                                      type="button"
                                      title="Approve Advance"
                                      onClick={() => handleProcessApproval('advance', adv, 'approve')}
                                      disabled={approvingItemId === adv._id}
                                      style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid #86efac', background: '#f0fdf4', color: '#166534', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}
                                    >
                                      {approvingItemId === adv._id ? '...' : '✓'}
                                    </button>
                                    <button
                                      type="button"
                                      title="Reject Advance"
                                      onClick={() => handleProcessApproval('advance', adv, 'reject', 'Rejected by Finance')}
                                      disabled={approvingItemId === adv._id}
                                      style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid #fed7aa', background: '#fffbeb', color: '#c2410c', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}
                                    >
                                      ✕
                                    </button>
                                    <button
                                      type="button"
                                      title="Delete Advance"
                                      onClick={() => handleDeleteApprovalItem('advance', adv)}
                                      style={{ padding: '4px 7px', borderRadius: '5px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}

                        {totalCount === 0 && (
                          <tr>
                            <td colSpan="6" style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b' }}>
                              🎉 All finance and payroll items are fully approved and up to date!
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                    <button
                      type="button"
                      onClick={() => setApprovalsModalOpen(false)}
                      style={{ padding: '8px 18px', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                    >
                      Close Workspace
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ─── QUICK MANAGEMENT MODAL 6: PAYROLL HISTORY ─── */}
      {payrollHistoryModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '920px',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid #fed7aa',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#FFF4E8',
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: '15px', color: '#9a3412' }}>
                  📜 Company Payroll History
                </div>
                <div style={{ fontSize: '11.5px', color: '#c2410c', marginTop: '2px' }}>
                  Aggregated multi-month audit records and detailed historical payslips
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayrollHistoryModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#9a3412' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {historyLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  Loading historical payroll records from MongoDB Atlas...
                </div>
              ) : selectedHistoryPeriod ? (
                /* Period Drilldown View */
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                    <div style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>
                      📋 Employee Slips for {selectedHistoryPeriod}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedHistoryPeriod(null)}
                      style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      ← Back to All Periods
                    </button>
                  </div>

                  {historyPeriodLoading ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Loading slips for {selectedHistoryPeriod}...</div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                            <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Employee</th>
                            <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>ID / Dept</th>
                            <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Gross Salary</th>
                            <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Deductions</th>
                            <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Net Payable</th>
                            <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Status</th>
                            <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyPeriodSlips.map((slip) => (
                            <tr key={slip._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{slip.employeeName || 'Staff'}</td>
                              <td style={{ padding: '8px 12px', color: '#64748b' }}>{slip.employeeId || '—'} ({slip.department || 'General'})</td>
                              <td style={{ padding: '8px 12px' }}>{formatCurrency(slip.gross)}</td>
                              <td style={{ padding: '8px 12px', color: '#dc2626' }}>{formatCurrency(slip.totalDeduction || slip.deductions)}</td>
                              <td style={{ padding: '8px 12px', fontWeight: 700, color: '#ea580c' }}>{formatCurrency(slip.net)}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{ background: slip.status === 'Paid' ? '#dcfce7' : '#fef3c7', color: slip.status === 'Paid' ? '#166534' : '#92400e', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                  {slip.status}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                <button
                                  type="button"
                                  onClick={() => openPayslip(slip)}
                                  style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid #F5B97A', background: '#FFF4E8', color: '#E85D04', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}
                                >
                                  📄 Payslip
                                </button>
                              </td>
                            </tr>
                          ))}
                          {historyPeriodSlips.length === 0 && (
                            <tr>
                              <td colSpan="7" style={{ padding: '25px', textAlign: 'center', color: '#64748b' }}>No slips found for this period.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                /* Period Overview Table */
                <div>
                  <div style={{ marginBottom: '0.85rem' }}>
                    <input
                      type="text"
                      placeholder="Search historical pay period..."
                      value={historyFilterSearch}
                      onChange={(e) => setHistoryFilterSearch(e.target.value)}
                      style={{ padding: '7px 12px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '12.5px', width: '260px' }}
                    />
                  </div>

                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                          <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Pay Period</th>
                          <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Employees</th>
                          <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Gross Payroll</th>
                          <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Total Deductions</th>
                          <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Net Payable</th>
                          <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Status</th>
                          <th style={{ padding: '8px 12px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyList
                          .filter((h) => !historyFilterSearch || (h.payPeriod || '').toLowerCase().includes(historyFilterSearch.toLowerCase()))
                          .map((item) => (
                            <tr key={item.payPeriod} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>{item.payPeriod}</td>
                              <td style={{ padding: '8px 12px' }}>{item.employeesCount} staff</td>
                              <td style={{ padding: '8px 12px' }}>{formatCurrency(item.gross)}</td>
                              <td style={{ padding: '8px 12px', color: '#dc2626' }}>{formatCurrency(item.deductions)}</td>
                              <td style={{ padding: '8px 12px', fontWeight: 800, color: '#ea580c' }}>{formatCurrency(item.net)}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <span
                                  style={{
                                    background: item.status === 'Fully Paid' ? '#dcfce7' : item.status === 'Partially Paid' ? '#fef3c7' : '#fee2e2',
                                    color: item.status === 'Fully Paid' ? '#166534' : item.status === 'Partially Paid' ? '#92400e' : '#991b1b',
                                    padding: '2px 7px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                  }}
                                >
                                  {item.status}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  onClick={() => handleViewHistoryPeriod(item.payPeriod)}
                                  style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                  View Slips
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSwitchToHistoryPeriod(item.payPeriod)}
                                  style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid #F5B97A', background: '#FFF4E8', color: '#E85D04', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  Switch Dashboard
                                </button>
                              </td>
                            </tr>
                          ))}
                        {historyList.length === 0 && (
                          <tr>
                            <td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                              No historical payroll records generated yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setPayrollHistoryModalOpen(false)}
                  style={{ padding: '8px 18px', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  Close History
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
