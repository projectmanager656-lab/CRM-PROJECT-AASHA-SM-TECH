import React, { useState, useEffect, useMemo, useRef } from 'react';
import apiClient from '../../../../services/apiClient';

export default function ExpenseMaster({
  formatCurrency,
  formatDate,
  user,
  onRefresh,
  openModal,
  handleTabChange,
  initialSubTab,
}) {
  // Sync with initialSubTab or URL ?expenseTab=...
  const getInitialTab = () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const fromUrl = urlParams.get('expenseTab') || urlParams.get('subTab');
      if (fromUrl) return fromUrl;
    } catch (e) {}
    if (initialSubTab) return initialSubTab;
    return 'overview';
  };

  // 13 Primary Navigation Tabs
  const [activeSubTab, setActiveSubTab] = useState(getInitialTab);

  useEffect(() => {
    if (initialSubTab && initialSubTab !== activeSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  useEffect(() => {
    const onPop = () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const fromUrl = urlParams.get('expenseTab') || urlParams.get('subTab');
        if (fromUrl && fromUrl !== activeSubTab) {
          setActiveSubTab(fromUrl);
        }
      } catch (e) {}
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [activeSubTab]);

  const handleSubTabSwitch = (tabId) => {
    setActiveSubTab(tabId);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'expenses');
      url.searchParams.set('expenseTab', tabId);
      window.history.replaceState({}, '', url.toString());
    } catch (e) {}
  };

  // Overview state
  const [overviewData, setOverviewData] = useState(null);
  const [overviewPeriod, setOverviewPeriod] = useState('month');
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Expense Register state
  const [expenses, setExpenses] = useState([]);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [regSearch, setRegSearch] = useState('');
  const [regStatusChip, setRegStatusChip] = useState('All');
  const [regCategory, setRegCategory] = useState('All');
  const [regCategoryType, setRegCategoryType] = useState('All');
  const [regVendor, setRegVendor] = useState('All');
  const [regStartDate, setRegStartDate] = useState('');
  const [regEndDate, setRegEndDate] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Client Expenses state
  const [clientExpSearch, setClientExpSearch] = useState('');
  const [clientExpStatusChip, setClientExpStatusChip] = useState('All');
  const [clientExpClientFilter, setClientExpClientFilter] = useState('All');

  // Office Expenses state
  const [officeExpSearch, setOfficeExpSearch] = useState('');
  const [officeExpStatusChip, setOfficeExpStatusChip] = useState('All');
  const [officeExpCatFilter, setOfficeExpCatFilter] = useState('All');

  // Project Expenses state
  const [projectExpSearch, setProjectExpSearch] = useState('');
  const [projectExpStatusChip, setProjectExpStatusChip] = useState('All');
  const [projectExpProjectFilter, setProjectExpProjectFilter] = useState('All');

  // Vendor Bills state
  const [vendorBills, setVendorBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [billSearch, setBillSearch] = useState('');
  const [billStatusChip, setBillStatusChip] = useState('All');

  // Payments state
  const [debitPayments, setDebitPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentStatusChip, setPaymentStatusChip] = useState('All');

  // Recurring Expenses state
  const [recurringPlans, setRecurringPlans] = useState([]);
  const [recurringStats, setRecurringStats] = useState(null);
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [recSearch, setRecSearch] = useState('');
  const [recStatusChip, setRecStatusChip] = useState('All');

  // Reimbursements state
  const [reimbursements, setReimbursements] = useState([]);
  const [reimbLoading, setReimbLoading] = useState(false);
  const [reimbSearch, setReimbSearch] = useState('');
  const [reimbStatusChip, setReimbStatusChip] = useState('All');

  // Categories state
  const [categoriesList, setCategoriesList] = useState([
    'Office Expenses',
    'Infrastructure',
    'Software & Subscriptions',
    'Cloud / Server',
    'Travel',
    'Marketing',
    'Client Expenses',
    'Employee Expenses',
    'Utilities',
    'Rent',
    'Professional Services',
    'Miscellaneous',
  ]);
  const [newCategoryName, setNewCategoryName] = useState('');

  // General Ledger state
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerAccountFilter, setLedgerAccountFilter] = useState('All');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('All');

  // Reconciliation state
  const [reconSearch, setReconSearch] = useState('');
  const [reconStatusChip, setReconStatusChip] = useState('All');
  const [reconBankFilter, setReconBankFilter] = useState('All');
  const [reconNoteText, setReconNoteText] = useState('');

  // Reports state
  const [reportType, setReportType] = useState('expenses');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  // Shared Reference Data
  const [vendorsList, setVendorsList] = useState([]);
  const [bankAccountsList, setBankAccountsList] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [clientsList, setClientsList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'addExpense' | 'editExpense' | 'viewExpense' | 'recordPayment' | 'addBill' | 'recurringPlan' | 'reimbursement' | 'addCategory' | 'reconcileNote'
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // Form states
  const [expenseFormData, setExpenseFormData] = useState({
    title: '',
    category: 'Software & Subscriptions',
    categoryType: 'Office Expenses',
    department: 'Finance',
    amount: '',
    tax: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    paymentMethod: 'Bank Transfer',
    vendorName: '',
    vendor: '',
    clientName: '',
    projectName: '',
    description: '',
    notes: '',
  });

  const [paymentFormData, setPaymentFormData] = useState({
    targetType: 'expense', // 'expense' | 'bill'
    targetId: '',
    amount: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'Bank Transfer',
    bankAccountId: '',
    transactionReference: '',
    notes: '',
  });

  const [billFormData, setBillFormData] = useState({
    vendor: '',
    billNumber: '',
    billDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    category: 'Software & IT',
    amount: '',
    tax: '',
    description: '',
  });

  const [planFormData, setPlanFormData] = useState({
    expenseTitle: '',
    vendor: '',
    vendorName: '',
    category: 'Software & Subscriptions',
    categoryType: 'Office Expenses',
    billingFrequency: 'Monthly',
    amount: '',
    tax: '',
    startDate: new Date().toISOString().slice(0, 10),
    nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    endDate: '',
    paymentMethod: 'Bank Transfer',
    notes: '',
  });

  const [reimbFormData, setReimbFormData] = useState({
    employeeId: '',
    amount: '',
    reason: '',
    requiredDate: new Date().toISOString().slice(0, 10),
    priority: 'Medium',
    supportingDocumentUrl: '',
  });

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState(null); // { type, item, title, warning, isSafe }
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Edit Payment State
  const [editPaymentFormData, setEditPaymentFormData] = useState({
    paymentMethod: 'Bank Transfer',
    transactionReference: '',
    paymentDate: '',
    notes: '',
  });

  // Edit Category State
  const [editCategoryName, setEditCategoryName] = useState('');

  // RBAC Permission Checkers
  const isFinanceAdmin = useMemo(() => {
    if (!user) return true;
    const role = String(user.role || '').trim().toLowerCase();
    if (['admin', 'super_admin'].includes(role)) return true;
    const rbacKey = String(user.rbacRoleKey || '').trim().toLowerCase();
    if (['finance_admin', 'finance_head', 'admin', 'super_admin'].includes(rbacKey)) return true;
    const designation = String(user.designation || '').trim().toLowerCase();
    const dept = String(user.department || '').trim().toUpperCase();
    if (dept === 'FINANCE') {
      const adminDesignations = ['head', 'director', 'cfo', 'chief financial officer', 'manager', 'lead'];
      if (adminDesignations.some((d) => designation.includes(d))) return true;
    }
    return false;
  }, [user]);

  const canEditOrDelete = useMemo(() => {
    if (!user) return true;
    const role = String(user.role || '').trim().toLowerCase();
    if (['admin', 'super_admin'].includes(role)) return true;
    const dept = String(user.department || '').trim().toUpperCase();
    if (dept === 'FINANCE') return true;
    return false;
  }, [user]);

  // Fetch Reference Data
  const fetchCategories = async () => {
    try {
      const res = await apiClient.get('/finance/expenses/categories');
      if (res.data?.data && Array.isArray(res.data.data)) {
        setCategoriesList(res.data.data);
      }
    } catch (e) {
      console.warn('Using standard expense categories');
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchReferences = async () => {
      try {
        const [vRes, bRes, uRes, cRes, pRes] = await Promise.all([
          apiClient.get('/finance/vendors'),
          apiClient.get('/finance/bank-accounts'),
          apiClient.get('/finance/recovery/team'),
          apiClient.get('/finance/clients').catch(() => ({ data: { data: [] } })),
          apiClient.get('/finance/projects').catch(() => ({ data: { data: [] } })),
        ]);
        if (isMounted) {
          if (vRes.data?.data) setVendorsList(vRes.data.data);
          if (bRes.data?.data) setBankAccountsList(bRes.data.data);
          if (uRes.data?.data) setEmployeesList(uRes.data.data);
          if (cRes.data?.data) setClientsList(Array.isArray(cRes.data.data) ? cRes.data.data : []);
          if (pRes.data?.data) setProjectsList(Array.isArray(pRes.data.data) ? pRes.data.data : []);
        }
        await fetchCategories();
      } catch (err) {
        console.error('Failed to load expense reference data:', err);
      }
    };
    fetchReferences();
    return () => {
      isMounted = false;
    };
  }, []);

  // 1. Fetch Overview Data
  const fetchOverview = async () => {
    setOverviewLoading(true);
    try {
      const res = await apiClient.get(`/finance/expenses/overview?period=${overviewPeriod}`);
      if (res.data?.data) {
        setOverviewData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load expense overview:', err);
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [overviewPeriod]);

  // 2. Fetch Expense Register
  const fetchExpenses = async () => {
    setRegisterLoading(true);
    try {
      const params = new URLSearchParams();
      if (regCategoryType !== 'All') params.append('categoryType', regCategoryType);
      if (regCategory !== 'All') params.append('category', regCategory);
      if (regStatusChip !== 'All') params.append('paymentStatus', regStatusChip);
      if (regVendor !== 'All') params.append('vendorName', regVendor);
      if (regStartDate) params.append('startDate', regStartDate);
      if (regEndDate) params.append('endDate', regEndDate);
      if (regSearch) params.append('search', regSearch);

      const res = await apiClient.get(`/finance/expenses?${params.toString()}`);
      if (res.data?.data) {
        setExpenses(Array.isArray(res.data.data) ? res.data.data : []);
      }
    } catch (err) {
      console.error('Failed to load expenses list:', err);
      setExpenses([]);
    } finally {
      setRegisterLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [regCategoryType, regCategory, regStatusChip, regVendor, regStartDate, regEndDate]);

  // 3. Fetch Vendor Bills
  const fetchVendorBills = async () => {
    setBillsLoading(true);
    try {
      const res = await apiClient.get('/finance/vendor-bills');
      if (res.data?.data) {
        setVendorBills(Array.isArray(res.data.data) ? res.data.data : []);
      }
    } catch (err) {
      console.error('Failed to load vendor bills:', err);
      setVendorBills([]);
    } finally {
      setBillsLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'vendorBills' || activeSubTab === 'payments' || activeSubTab === 'overview') {
      fetchVendorBills();
    }
  }, [activeSubTab]);

  // 4. Fetch Debit Payments
  const fetchPayments = async () => {
    setPaymentsLoading(true);
    try {
      const res = await apiClient.get('/finance/expenses/reconciliation');
      if (res.data?.data?.transactions) {
        setDebitPayments(res.data.data.transactions);
      }
    } catch (err) {
      console.error('Failed to load debit payments:', err);
      setDebitPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'payments' || activeSubTab === 'reconciliation') {
      fetchPayments();
    }
  }, [activeSubTab]);

  // 5. Fetch Recurring Plans
  const fetchRecurringPlans = async () => {
    setRecurringLoading(true);
    try {
      const res = await apiClient.get('/finance/expenses/recurring');
      if (res.data?.data) {
        setRecurringPlans(res.data.data.plans || []);
        setRecurringStats(res.data.data.stats || null);
      }
    } catch (err) {
      console.error('Failed to load recurring expenses:', err);
      setRecurringPlans([]);
    } finally {
      setRecurringLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'recurring' || activeSubTab === 'overview') {
      fetchRecurringPlans();
    }
  }, [activeSubTab]);

  // 6. Fetch Reimbursements
  const fetchReimbursements = async () => {
    setReimbLoading(true);
    try {
      const res = await apiClient.get('/finance/expenses/reimbursements');
      if (res.data?.data) {
        setReimbursements(Array.isArray(res.data.data) ? res.data.data : []);
      }
    } catch (err) {
      console.error('Failed to load reimbursements:', err);
      setReimbursements([]);
    } finally {
      setReimbLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'reimbursements' || activeSubTab === 'overview') {
      fetchReimbursements();
    }
  }, [activeSubTab]);

  // 7. Fetch General Ledger
  const fetchLedger = async () => {
    setLedgerLoading(true);
    try {
      let url = '/finance/ledger?transactionType=Expense';
      if (ledgerAccountFilter !== 'All') url += `&accountId=${ledgerAccountFilter}`;
      const res = await apiClient.get(url);
      if (res.data?.data) {
        setLedgerEntries(Array.isArray(res.data.data) ? res.data.data : []);
      }
    } catch (err) {
      console.error('Failed to load ledger entries:', err);
      setLedgerEntries([]);
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'ledger') {
      fetchLedger();
    }
  }, [activeSubTab, ledgerAccountFilter]);

  // 8. Fetch Expense Reports
  const fetchExpenseReport = async () => {
    setReportLoading(true);
    try {
      let url = `/finance/reports?reportType=${reportType}`;
      if (reportStartDate) url += `&startDate=${reportStartDate}`;
      if (reportEndDate) url += `&endDate=${reportEndDate}`;
      const res = await apiClient.get(url);
      setReportData(res.data?.data || null);
    } catch (err) {
      console.error('Failed to load expense report:', err);
      setReportData(null);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'reports') {
      fetchExpenseReport();
    }
  }, [activeSubTab, reportType, reportStartDate, reportEndDate]);

  // Refresh all data
  const refreshAllExpenseData = () => {
    fetchOverview();
    fetchExpenses();
    fetchVendorBills();
    fetchPayments();
    fetchRecurringPlans();
    fetchReimbursements();
    if (activeSubTab === 'ledger') fetchLedger();
    if (activeSubTab === 'reports') fetchExpenseReport();
    if (onRefresh) onRefresh();
  };

  // Close all modals
  const closeAllModals = () => {
    setActiveModal(null);
    setSelectedItem(null);
    setModalError('');
    setModalSuccess('');
    setModalLoading(false);
  };

  // Open Add Expense Modal
  const openAddExpenseModal = (defaults = {}) => {
    setModalError('');
    setModalSuccess('');
    setExpenseFormData({
      title: '',
      category: defaults.category || 'Software & Subscriptions',
      categoryType: defaults.categoryType || 'Office Expenses',
      department: 'Finance',
      amount: '',
      tax: '',
      expenseDate: new Date().toISOString().slice(0, 10),
      dueDate: '',
      paymentMethod: 'Bank Transfer',
      vendorName: '',
      vendor: '',
      clientName: defaults.clientName || '',
      client: defaults.client || '',
      projectName: defaults.projectName || '',
      project: defaults.project || '',
      description: '',
      notes: '',
    });
    setActiveModal('addExpense');
  };

  // Open Edit Expense Modal
  const openEditExpenseModal = (exp) => {
    setSelectedItem(exp);
    setModalError('');
    setModalSuccess('');
    setExpenseFormData({
      title: exp.title || '',
      category: exp.category || 'Office Expenses',
      categoryType: exp.categoryType || 'Office Expenses',
      department: exp.department || 'Finance',
      amount: String(exp.amount || ''),
      tax: String(exp.tax || ''),
      expenseDate: exp.expenseDate ? new Date(exp.expenseDate).toISOString().slice(0, 10) : '',
      dueDate: exp.dueDate ? new Date(exp.dueDate).toISOString().slice(0, 10) : '',
      paymentMethod: exp.paymentMethod || 'Bank Transfer',
      vendorName: exp.vendorName || '',
      vendor: exp.vendor?._id || exp.vendor || '',
      client: exp.client?._id || exp.client || '',
      clientName: exp.clientName || exp.client?.name || '',
      project: exp.project?._id || exp.project || '',
      projectName: exp.projectName || exp.project?.name || '',
      description: exp.description || '',
      notes: exp.notes || '',
    });
    setActiveModal('editExpense');
  };

  // Open View Expense Modal
  const openViewExpenseModal = (exp) => {
    setSelectedItem(exp);
    setActiveModal('viewExpense');
  };

  // Open Record Payment Modal
  const openRecordPaymentModal = (target = null, type = 'expense') => {
    setModalError('');
    setModalSuccess('');
    const defaultBank = bankAccountsList[0]?._id || '';

    if (target) {
      const remaining = target.balance !== undefined ? target.balance : target.total || target.amount;
      setPaymentFormData({
        targetType: type,
        targetId: target._id,
        amount: String(remaining || ''),
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMethod: 'Bank Transfer',
        bankAccountId: defaultBank,
        transactionReference: '',
        notes: `Disbursal for ${target.title || target.billNumber || 'Payable'}`,
      });
      setSelectedItem(target);
    } else {
      setPaymentFormData({
        targetType: 'expense',
        targetId: '',
        amount: '',
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMethod: 'Bank Transfer',
        bankAccountId: defaultBank,
        transactionReference: '',
        notes: '',
      });
      setSelectedItem(null);
    }
    setActiveModal('recordPayment');
  };

  // Submit Add Expense
  const handleAddExpenseSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');
    setModalSuccess('');

    try {
      const payload = {
        ...expenseFormData,
        amount: Number(expenseFormData.amount),
        tax: Number(expenseFormData.tax || 0),
      };
      await apiClient.post('/finance/expenses', payload);
      setModalSuccess('Expense submitted successfully!');
      refreshAllExpenseData();
      setTimeout(closeAllModals, 800);
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Failed to submit expense');
    } finally {
      setModalLoading(false);
    }
  };

  // Submit Edit Expense
  const handleEditExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    setModalLoading(true);
    setModalError('');
    setModalSuccess('');

    try {
      const payload = {
        ...expenseFormData,
        amount: Number(expenseFormData.amount),
        tax: Number(expenseFormData.tax || 0),
      };
      await apiClient.put(`/finance/expenses/${selectedItem._id}`, payload);
      setModalSuccess('Expense updated successfully!');
      refreshAllExpenseData();
      setTimeout(closeAllModals, 800);
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Failed to update expense');
    } finally {
      setModalLoading(false);
    }
  };

  // Universal Delete Confirmation Modal Opener
  const openDeleteModal = (type, item) => {
    let title = '';
    let warning = 'Are you sure you want to permanently delete this record? This action will remove it from MongoDB Atlas.';
    let isSafe = true;

    if (type === 'expense') {
      title = item.title || 'Expense';
      if (item.paymentStatus === 'Paid') {
        isSafe = false;
        warning = 'This expense has already been paid and settled. In accordance with finance auditing rules, paid expenses cannot be deleted.';
      }
    } else if (type === 'vendorBill') {
      title = `Bill #${item.billNumber || item._id}`;
      if (Number(item.paidAmount) > 0 || item.status === 'Paid') {
        isSafe = false;
        warning = 'This vendor bill has disbursements/payments recorded against it and cannot be deleted.';
      }
    } else if (type === 'payment') {
      title = `Payment #${item.paymentNumber || item._id}`;
      if (item.isReconciled) {
        isSafe = false;
        warning = 'This payment has been reconciled with the bank account statement. You must unreconcile it before deletion.';
      } else {
        warning = 'Deleting this payment will safely reverse paid balances on the linked expense or bill and adjust the company bank account balance.';
      }
    } else if (type === 'recurring') {
      title = item.expenseTitle || 'Recurring Plan';
      warning = 'This will permanently remove the recurring schedule. Future auto-due dates will cease.';
    } else if (type === 'reimbursement') {
      title = `Reimbursement #${item.requestNumber || item._id}`;
      if (item.status === 'Paid') {
        isSafe = false;
        warning = 'This reimbursement has already been disbursed and marked as Paid.';
      }
    } else if (type === 'category') {
      title = `Category "${item}"`;
      const inUse = expenses.filter((e) => e.category === item).length;
      if (inUse > 0) {
        isSafe = false;
        warning = `This category cannot be deleted because it is currently assigned to ${inUse} expense record(s).`;
      } else {
        warning = 'This category will be permanently removed from the master category list.';
      }
    }

    setDeleteTarget({ type, item, title, warning, isSafe });
  };

  // Universal Delete Confirmation Executor
  const handleConfirmDelete = async () => {
    if (!deleteTarget || !deleteTarget.isSafe) return;
    setDeleteLoading(true);
    try {
      if (deleteTarget.type === 'expense') {
        await apiClient.delete(`/finance/expenses/${deleteTarget.item._id}`);
        fetchExpenses();
      } else if (deleteTarget.type === 'vendorBill') {
        await apiClient.delete(`/finance/vendor-bills/${deleteTarget.item._id}`);
        fetchVendorBills();
      } else if (deleteTarget.type === 'payment') {
        await apiClient.delete(`/finance/expenses/payments/${deleteTarget.item._id}`);
        fetchPayments();
      } else if (deleteTarget.type === 'recurring') {
        await apiClient.delete(`/finance/expenses/recurring/${deleteTarget.item._id}`);
        fetchRecurringPlans();
      } else if (deleteTarget.type === 'reimbursement') {
        await apiClient.delete(`/finance/expenses/reimbursements/${deleteTarget.item._id}`);
        fetchReimbursements();
      } else if (deleteTarget.type === 'category') {
        await apiClient.delete(`/finance/expenses/categories/${encodeURIComponent(deleteTarget.item)}`);
        fetchCategories();
      }
      refreshAllExpenseData();
      setDeleteTarget(null);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to delete record');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Vendor Bill Actions
  const openViewBillModal = (bill) => {
    setSelectedItem(bill);
    setActiveModal('viewBill');
  };

  const openEditBillModal = (bill) => {
    setSelectedItem(bill);
    setBillFormData({
      vendor: bill.vendor?._id || bill.vendor || '',
      billNumber: bill.billNumber || '',
      billDate: bill.billDate ? new Date(bill.billDate).toISOString().slice(0, 10) : '',
      dueDate: bill.dueDate ? new Date(bill.dueDate).toISOString().slice(0, 10) : '',
      category: bill.category || 'Software & IT',
      amount: String(bill.amount !== undefined ? bill.amount : bill.totalAmount || ''),
      tax: String(bill.tax || ''),
      description: bill.description || '',
    });
    setModalError('');
    setModalSuccess('');
    setActiveModal('editBill');
  };

  const handleEditBillSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    setModalLoading(true);
    setModalError('');
    setModalSuccess('');
    try {
      await apiClient.put(`/finance/vendor-bills/${selectedItem._id}`, {
        ...billFormData,
        amount: Number(billFormData.amount),
        tax: Number(billFormData.tax || 0),
      });
      setModalSuccess('Vendor bill updated successfully!');
      refreshAllExpenseData();
      fetchVendorBills();
      setTimeout(closeAllModals, 800);
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Failed to update vendor bill');
    } finally {
      setModalLoading(false);
    }
  };

  // Payment Actions
  const openViewPaymentModal = (payment) => {
    setSelectedItem(payment);
    setActiveModal('viewPayment');
  };

  const openEditPaymentModal = (payment) => {
    setSelectedItem(payment);
    setEditPaymentFormData({
      paymentMethod: payment.paymentMethod || 'Bank Transfer',
      transactionReference: payment.transactionReference || '',
      paymentDate: payment.paymentDate ? new Date(payment.paymentDate).toISOString().slice(0, 10) : '',
      notes: payment.notes || '',
    });
    setModalError('');
    setModalSuccess('');
    setActiveModal('editPayment');
  };

  const handleEditPaymentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    setModalLoading(true);
    setModalError('');
    setModalSuccess('');
    try {
      await apiClient.put(`/finance/expenses/payments/${selectedItem._id}`, {
        paymentMethod: editPaymentFormData.paymentMethod,
        transactionReference: editPaymentFormData.transactionReference,
        notes: editPaymentFormData.notes,
        paymentDate: editPaymentFormData.paymentDate,
      });
      setModalSuccess('Payment details updated successfully!');
      fetchPayments();
      setTimeout(closeAllModals, 800);
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Failed to update payment');
    } finally {
      setModalLoading(false);
    }
  };

  // Recurring Actions
  const openViewRecurringModal = (plan) => {
    setSelectedItem(plan);
    setActiveModal('viewRecurring');
  };

  const openEditRecurringModal = (plan) => {
    setSelectedItem(plan);
    setPlanFormData({
      expenseTitle: plan.expenseTitle || '',
      vendor: plan.vendor?._id || plan.vendor || '',
      vendorName: plan.vendorName || '',
      category: plan.category || 'Software & Subscriptions',
      categoryType: plan.categoryType || 'Office Expenses',
      billingFrequency: plan.billingFrequency || 'Monthly',
      amount: String(plan.amount || ''),
      tax: String(plan.tax || ''),
      startDate: plan.startDate ? new Date(plan.startDate).toISOString().slice(0, 10) : '',
      nextDueDate: plan.nextDueDate ? new Date(plan.nextDueDate).toISOString().slice(0, 10) : '',
      endDate: plan.endDate ? new Date(plan.endDate).toISOString().slice(0, 10) : '',
      paymentMethod: plan.paymentMethod || 'Bank Transfer',
      notes: plan.notes || '',
    });
    setModalError('');
    setModalSuccess('');
    setActiveModal('recurringPlan');
  };

  // Reimbursement Actions
  const openViewReimbursementModal = (reimb) => {
    setSelectedItem(reimb);
    setActiveModal('viewReimbursement');
  };

  const openEditReimbursementModal = (reimb) => {
    setSelectedItem(reimb);
    setReimbFormData({
      employeeId: reimb.employee?._id || reimb.employee || '',
      amount: String(reimb.amount || ''),
      reason: reimb.reason || '',
      requiredDate: reimb.requiredDate ? new Date(reimb.requiredDate).toISOString().slice(0, 10) : '',
      priority: reimb.priority || 'Medium',
      supportingDocumentUrl: reimb.supportingDocumentUrl || '',
    });
    setModalError('');
    setModalSuccess('');
    setActiveModal('editReimbursement');
  };

  const handleEditReimbursementSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    setModalLoading(true);
    setModalError('');
    setModalSuccess('');
    try {
      await apiClient.put(`/finance/expenses/reimbursements/${selectedItem._id}`, {
        ...reimbFormData,
        amount: Number(reimbFormData.amount),
      });
      setModalSuccess('Reimbursement updated successfully!');
      fetchReimbursements();
      setTimeout(closeAllModals, 800);
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Failed to update reimbursement');
    } finally {
      setModalLoading(false);
    }
  };

  // Category Actions
  const openViewCategoryModal = (cat) => {
    setSelectedItem(cat);
    setActiveModal('viewCategory');
  };

  const openEditCategoryModal = (cat) => {
    setSelectedItem(cat);
    setEditCategoryName(cat);
    setModalError('');
    setModalSuccess('');
    setActiveModal('editCategory');
  };

  const handleEditCategorySubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem || !editCategoryName.trim()) return;
    setModalLoading(true);
    setModalError('');
    setModalSuccess('');
    try {
      await apiClient.put('/finance/expenses/categories', {
        oldName: selectedItem,
        newName: editCategoryName.trim(),
      });
      setModalSuccess('Category renamed successfully!');
      fetchCategories();
      fetchExpenses();
      setTimeout(closeAllModals, 800);
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Failed to rename category');
    } finally {
      setModalLoading(false);
    }
  };

  // Other View Modals
  const openViewLedgerModal = (entry) => {
    setSelectedItem(entry);
    setActiveModal('viewLedger');
  };

  const openViewReconModal = (entry) => {
    setSelectedItem(entry);
    setActiveModal('viewRecon');
  };

  const openViewReportRowModal = (row) => {
    setSelectedItem(row);
    setActiveModal('viewReportRow');
  };

  // Approve Expense
  const handleApproveExpense = async (expId) => {
    try {
      await apiClient.post(`/finance/expenses/${expId}/approve`);
      refreshAllExpenseData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve expense');
    }
  };

  // Reject Expense
  const handleRejectExpense = async (exp) => {
    const reason = window.prompt(`Enter rejection reason for expense "${exp.title}":`);
    if (reason === null) return;
    try {
      await apiClient.post(`/finance/expenses/${exp._id}/reject`, { reason });
      refreshAllExpenseData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject expense');
    }
  };

  // Submit Payment against Expense or Bill
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');
    setModalSuccess('');

    try {
      const { targetType, targetId, amount, bankAccountId, paymentMethod, transactionReference, notes } = paymentFormData;
      if (!targetId) {
        throw new Error('Please select an expense or vendor bill to pay');
      }

      if (targetType === 'bill') {
        await apiClient.post(`/finance/vendor-bills/${targetId}/pay`, {
          amount: Number(amount),
          bankAccountId,
          paymentMethod,
          transactionReference,
        });
      } else {
        await apiClient.post(`/finance/expenses/${targetId}/pay`, {
          amount: Number(amount),
          bankAccountId,
          paymentMethod,
          transactionReference,
          notes,
        });
      }

      setModalSuccess('Payment disbursed and recorded successfully!');
      refreshAllExpenseData();
      setTimeout(closeAllModals, 900);
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Payment recording failed');
    } finally {
      setModalLoading(false);
    }
  };

  // Submit Add Vendor Bill
  const handleAddBillSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');
    setModalSuccess('');

    try {
      const payload = {
        ...billFormData,
        amount: Number(billFormData.amount),
        tax: Number(billFormData.tax || 0),
      };
      await apiClient.post('/finance/vendor-bills', payload);
      setModalSuccess('Vendor bill created successfully!');
      refreshAllExpenseData();
      setTimeout(closeAllModals, 800);
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Failed to create vendor bill');
    } finally {
      setModalLoading(false);
    }
  };

  // Approve Vendor Bill
  const handleApproveBill = async (billId) => {
    try {
      await apiClient.post(`/finance/vendor-bills/${billId}/approve`);
      refreshAllExpenseData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve bill');
    }
  };

  // Open Recurring Plan Modal
  const openRecurringPlanModal = (plan = null) => {
    setModalError('');
    setModalSuccess('');
    if (plan) {
      setSelectedItem(plan);
      setPlanFormData({
        expenseTitle: plan.expenseTitle || '',
        vendor: plan.vendor?._id || plan.vendor || '',
        vendorName: plan.vendorName || '',
        category: plan.category || 'Software & Subscriptions',
        categoryType: plan.categoryType || 'Office Expenses',
        billingFrequency: plan.billingFrequency || 'Monthly',
        amount: String(plan.amount || ''),
        tax: String(plan.tax || ''),
        startDate: plan.startDate ? new Date(plan.startDate).toISOString().slice(0, 10) : '',
        nextDueDate: plan.nextDueDate ? new Date(plan.nextDueDate).toISOString().slice(0, 10) : '',
        endDate: plan.endDate ? new Date(plan.endDate).toISOString().slice(0, 10) : '',
        paymentMethod: plan.paymentMethod || 'Bank Transfer',
        notes: plan.notes || '',
      });
    } else {
      setSelectedItem(null);
      setPlanFormData({
        expenseTitle: '',
        vendor: '',
        vendorName: '',
        category: 'Software & Subscriptions',
        categoryType: 'Office Expenses',
        billingFrequency: 'Monthly',
        amount: '',
        tax: '',
        startDate: new Date().toISOString().slice(0, 10),
        nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        endDate: '',
        paymentMethod: 'Bank Transfer',
        notes: '',
      });
    }
    setActiveModal('recurringPlan');
  };

  // Submit Recurring Plan
  const handleRecurringPlanSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');
    setModalSuccess('');

    try {
      const payload = {
        ...planFormData,
        amount: Number(planFormData.amount),
        tax: Number(planFormData.tax || 0),
      };

      if (selectedItem) {
        await apiClient.put(`/finance/expenses/recurring/${selectedItem._id}`, payload);
        setModalSuccess('Recurring plan updated successfully!');
      } else {
        await apiClient.post('/finance/expenses/recurring', payload);
        setModalSuccess('Recurring expense plan created!');
      }
      refreshAllExpenseData();
      setTimeout(closeAllModals, 800);
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Operation failed');
    } finally {
      setModalLoading(false);
    }
  };

  // Toggle Recurring Plan Status
  const handleTogglePlanStatus = async (planId, currentStatus) => {
    const nextStatus = currentStatus === 'Active' ? 'Paused' : 'Active';
    try {
      await apiClient.patch(`/finance/expenses/recurring/${planId}/status`, { status: nextStatus });
      refreshAllExpenseData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle status');
    }
  };

  // Submit Reimbursement Request
  const handleReimbursementSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');
    setModalSuccess('');

    try {
      await apiClient.post('/finance/expenses/reimbursements', {
        ...reimbFormData,
        amount: Number(reimbFormData.amount),
      });
      setModalSuccess('Employee reimbursement submitted!');
      refreshAllExpenseData();
      setTimeout(closeAllModals, 800);
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Failed to submit reimbursement');
    } finally {
      setModalLoading(false);
    }
  };

  // Approve Reimbursement
  const handleApproveReimbursement = async (reqId) => {
    try {
      await apiClient.post(`/finance/payment-requests/${reqId}/approve`);
      refreshAllExpenseData();
    } catch (err) {
      alert(err.response?.data?.message || 'Approval failed');
    }
  };

  // Reject Reimbursement
  const handleRejectReimbursement = async (reqId) => {
    const reason = window.prompt('Enter rejection reason:');
    if (!reason) return;
    try {
      await apiClient.post(`/finance/payment-requests/${reqId}/reject`, { reason });
      refreshAllExpenseData();
    } catch (err) {
      alert(err.response?.data?.message || 'Rejection failed');
    }
  };

  // Pay Reimbursement
  const handlePayReimbursement = async (req) => {
    const defaultBank = bankAccountsList[0]?._id;
    if (!window.confirm(`Disburse reimbursement of ${formatCurrency(req.amount)} to ${req.payeeName}?`)) return;
    try {
      await apiClient.post(`/finance/payment-requests/${req._id}/pay`, {
        bankAccountId: defaultBank,
        paymentMethod: 'Bank Transfer',
      });
      alert('Reimbursement payment disbursed successfully!');
      refreshAllExpenseData();
    } catch (err) {
      alert(err.response?.data?.message || 'Disbursal failed');
    }
  };

  // Toggle Reconcile status for Debit payment
  const handleReconcileToggle = async (paymentId, currentStatus) => {
    try {
      await apiClient.post(`/finance/expenses/payments/${paymentId}/reconcile`, {
        isReconciled: !currentStatus,
      });
      refreshAllExpenseData();
    } catch (err) {
      alert(err.response?.data?.message || 'Reconciliation update failed');
    }
  };

  // Save Reconciliation Note
  const handleSaveReconcileNote = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    try {
      await apiClient.post(`/finance/expenses/payments/${selectedItem._id}/reconcile`, {
        notes: reconNoteText,
      });
      refreshAllExpenseData();
      closeAllModals();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save note');
    }
  };

  // Add Custom Category
  const handleAddCategorySubmit = async (e) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    try {
      await apiClient.post('/finance/expenses/categories', { name: trimmed });
      await fetchCategories();
      setNewCategoryName('');
      closeAllModals();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add category');
    }
  };

  // Export CSV of Current View
  const handleExportCurrentView = () => {
    let rows = [];
    let filename = `expenses_${activeSubTab}_${new Date().toISOString().slice(0, 10)}.csv`;

    if (activeSubTab === 'register' || activeSubTab === 'overview') {
      const headers = ['Title', 'Category', 'Type', 'Amount', 'Tax', 'Total', 'Paid', 'Balance', 'Date', 'Vendor/Payee', 'Status'];
      rows.push(headers.join(','));
      expenses.forEach((e) => {
        rows.push([
          `"${e.title || ''}"`,
          `"${e.category || ''}"`,
          `"${e.categoryType || ''}"`,
          e.amount || 0,
          e.tax || 0,
          e.total || e.amount || 0,
          e.paidAmount || 0,
          e.balance || 0,
          `"${e.expenseDate ? new Date(e.expenseDate).toLocaleDateString() : ''}"`,
          `"${e.vendorName || e.employeeName || ''}"`,
          `"${e.paymentStatus || ''}"`,
        ].join(','));
      });
    } else if (activeSubTab === 'vendorBills') {
      const headers = ['Bill #', 'Vendor', 'Bill Date', 'Due Date', 'Total', 'Paid', 'Balance', 'Status', 'Approval'];
      rows.push(headers.join(','));
      vendorBills.forEach((b) => {
        rows.push([
          `"${b.billNumber || ''}"`,
          `"${b.vendorName || b.vendor?.companyName || ''}"`,
          `"${b.billDate ? new Date(b.billDate).toLocaleDateString() : ''}"`,
          `"${b.dueDate ? new Date(b.dueDate).toLocaleDateString() : ''}"`,
          b.totalAmount || b.amount || 0,
          b.paidAmount || 0,
          b.balance || 0,
          `"${b.status || ''}"`,
          `"${b.approvalStatus || ''}"`,
        ].join(','));
      });
    } else if (activeSubTab === 'payments' || activeSubTab === 'reconciliation') {
      const headers = ['Payment #', 'Recipient/Vendor', 'Amount', 'Date', 'Bank Account', 'Method', 'Reference', 'Status', 'Reconciled'];
      rows.push(headers.join(','));
      debitPayments.forEach((p) => {
        rows.push([
          `"${p.paymentNumber || ''}"`,
          `"${p.vendorName || p.employeeName || ''}"`,
          p.amount || 0,
          `"${p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : ''}"`,
          `"${p.bankAccountName || p.bankAccount?.accountName || ''}"`,
          `"${p.paymentMethod || ''}"`,
          `"${p.transactionReference || ''}"`,
          `"${p.status || ''}"`,
          `"${p.isReconciled ? 'Yes' : 'No'}"`,
        ].join(','));
      });
    } else if (activeSubTab === 'recurring') {
      const headers = ['Plan #', 'Title', 'Vendor', 'Frequency', 'Amount', 'Start Date', 'Next Due', 'Status'];
      rows.push(headers.join(','));
      recurringPlans.forEach((p) => {
        rows.push([
          `"${p.planNumber || ''}"`,
          `"${p.expenseTitle || ''}"`,
          `"${p.vendorName || ''}"`,
          `"${p.billingFrequency || ''}"`,
          p.amount || 0,
          `"${p.startDate ? new Date(p.startDate).toLocaleDateString() : ''}"`,
          `"${p.nextDueDate ? new Date(p.nextDueDate).toLocaleDateString() : ''}"`,
          `"${p.status || ''}"`,
        ].join(','));
      });
    } else if (activeSubTab === 'clientExpenses') {
      filename = `client_expenses_${new Date().toISOString().slice(0, 10)}.csv`;
      const headers = ['Title', 'Category', 'Client', 'Project', 'Amount', 'Paid', 'Balance', 'Date', 'Vendor', 'Status'];
      rows.push(headers.join(','));
      clientExpenses.forEach((e) => {
        rows.push([
          `"${e.title || ''}"`,
          `"${e.category || ''}"`,
          `"${e.clientName || e.client?.name || ''}"`,
          `"${e.projectName || e.project?.name || ''}"`,
          e.amount || 0,
          e.paidAmount || 0,
          e.balance || 0,
          `"${e.expenseDate ? new Date(e.expenseDate).toLocaleDateString() : ''}"`,
          `"${e.vendorName || e.vendor?.companyName || ''}"`,
          `"${e.paymentStatus || ''}"`,
        ].join(','));
      });
    } else if (activeSubTab === 'officeExpenses') {
      filename = `office_expenses_${new Date().toISOString().slice(0, 10)}.csv`;
      const headers = ['Title', 'Category', 'Vendor', 'Amount', 'Paid', 'Balance', 'Date', 'Status'];
      rows.push(headers.join(','));
      officeExpenses.forEach((e) => {
        rows.push([
          `"${e.title || ''}"`,
          `"${e.category || ''}"`,
          `"${e.vendorName || e.vendor?.companyName || ''}"`,
          e.amount || 0,
          e.paidAmount || 0,
          e.balance || 0,
          `"${e.expenseDate ? new Date(e.expenseDate).toLocaleDateString() : ''}"`,
          `"${e.paymentStatus || ''}"`,
        ].join(','));
      });
    } else if (activeSubTab === 'projectExpenses') {
      filename = `project_expenses_${new Date().toISOString().slice(0, 10)}.csv`;
      const headers = ['Title', 'Project', 'Client', 'Category', 'Vendor', 'Amount', 'Paid', 'Balance', 'Date', 'Status'];
      rows.push(headers.join(','));
      projectExpenses.forEach((e) => {
        rows.push([
          `"${e.title || ''}"`,
          `"${e.projectName || e.project?.name || ''}"`,
          `"${e.clientName || e.client?.name || ''}"`,
          `"${e.category || ''}"`,
          `"${e.vendorName || e.vendor?.companyName || ''}"`,
          e.amount || 0,
          e.paidAmount || 0,
          e.balance || 0,
          `"${e.expenseDate ? new Date(e.expenseDate).toLocaleDateString() : ''}"`,
          `"${e.paymentStatus || ''}"`,
        ].join(','));
      });
    } else if (activeSubTab === 'ledger') {
      filename = `expense_ledger_${new Date().toISOString().slice(0, 10)}.csv`;
      const headers = ['Date', 'Tx #', 'Account', 'Category', 'Party', 'Reference', 'Debit', 'Credit', 'Running Balance'];
      rows.push(headers.join(','));
      ledgerEntries.forEach((t) => {
        rows.push([
          `"${t.date ? new Date(t.date).toLocaleDateString() : ''}"`,
          `"${t.paymentNumber || ''}"`,
          `"${t.accountName || ''}"`,
          `"${t.category || ''}"`,
          `"${t.party || ''}"`,
          `"${t.reference || ''}"`,
          t.debit || 0,
          t.credit || 0,
          t.runningBalance || 0,
        ].join(','));
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered views
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (regSearch) {
        const q = regSearch.toLowerCase();
        const matchTitle = (e.title || '').toLowerCase().includes(q);
        const matchVendor = (e.vendorName || e.employeeName || '').toLowerCase().includes(q);
        const matchRec = (e.receiptNumber || '').toLowerCase().includes(q);
        if (!matchTitle && !matchVendor && !matchRec) return false;
      }
      return true;
    });
  }, [expenses, regSearch]);

  const clientExpenses = useMemo(() => {
    return expenses.filter((e) => e.categoryType === 'Client Expenses');
  }, [expenses]);

  const filteredClientExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (e.categoryType !== 'Client Expenses') return false;
      if (clientExpStatusChip !== 'All' && e.paymentStatus !== clientExpStatusChip) return false;
      if (clientExpClientFilter !== 'All') {
        const cId = e.client?._id || e.client;
        if (String(cId) !== String(clientExpClientFilter) && e.clientName !== clientExpClientFilter) return false;
      }
      if (clientExpSearch) {
        const q = clientExpSearch.toLowerCase();
        const matchTitle = (e.title || '').toLowerCase().includes(q);
        const matchClient = (e.clientName || e.client?.name || '').toLowerCase().includes(q);
        const matchProject = (e.projectName || e.project?.name || '').toLowerCase().includes(q);
        const matchVendor = (e.vendorName || e.vendor?.companyName || '').toLowerCase().includes(q);
        if (!matchTitle && !matchClient && !matchProject && !matchVendor) return false;
      }
      return true;
    });
  }, [expenses, clientExpStatusChip, clientExpClientFilter, clientExpSearch]);

  const officeExpenses = useMemo(() => {
    return expenses.filter((e) => e.categoryType === 'Office Expenses' || !e.categoryType);
  }, [expenses]);

  const filteredOfficeExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (e.categoryType && e.categoryType !== 'Office Expenses') return false;
      if (officeExpStatusChip !== 'All' && e.paymentStatus !== officeExpStatusChip) return false;
      if (officeExpCatFilter !== 'All' && e.category !== officeExpCatFilter) return false;
      if (officeExpSearch) {
        const q = officeExpSearch.toLowerCase();
        const matchTitle = (e.title || '').toLowerCase().includes(q);
        const matchCat = (e.category || '').toLowerCase().includes(q);
        const matchVendor = (e.vendorName || e.vendor?.companyName || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCat && !matchVendor) return false;
      }
      return true;
    });
  }, [expenses, officeExpStatusChip, officeExpCatFilter, officeExpSearch]);

  const projectExpenses = useMemo(() => {
    return expenses.filter((e) => e.categoryType === 'Project Expenses');
  }, [expenses]);

  const filteredProjectExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (e.categoryType !== 'Project Expenses') return false;
      if (projectExpStatusChip !== 'All' && e.paymentStatus !== projectExpStatusChip) return false;
      if (projectExpProjectFilter !== 'All') {
        const pId = e.project?._id || e.project;
        if (String(pId) !== String(projectExpProjectFilter) && e.projectName !== projectExpProjectFilter) return false;
      }
      if (projectExpSearch) {
        const q = projectExpSearch.toLowerCase();
        const matchTitle = (e.title || '').toLowerCase().includes(q);
        const matchProject = (e.projectName || e.project?.name || '').toLowerCase().includes(q);
        const matchClient = (e.clientName || e.client?.name || '').toLowerCase().includes(q);
        const matchVendor = (e.vendorName || e.vendor?.companyName || '').toLowerCase().includes(q);
        if (!matchTitle && !matchProject && !matchClient && !matchVendor) return false;
      }
      return true;
    });
  }, [expenses, projectExpStatusChip, projectExpProjectFilter, projectExpSearch]);

  const filteredBills = useMemo(() => {
    return vendorBills.filter((b) => {
      if (billStatusChip !== 'All' && b.status !== billStatusChip && b.approvalStatus !== billStatusChip) {
        return false;
      }
      if (billSearch) {
        const q = billSearch.toLowerCase();
        const matchNo = (b.billNumber || '').toLowerCase().includes(q);
        const matchVend = (b.vendorName || b.vendor?.companyName || '').toLowerCase().includes(q);
        if (!matchNo && !matchVend) return false;
      }
      return true;
    });
  }, [vendorBills, billStatusChip, billSearch]);

  const filteredDebitPayments = useMemo(() => {
    return debitPayments.filter((p) => {
      if (paymentStatusChip === 'Reconciled' && !p.isReconciled) return false;
      if (paymentStatusChip === 'Unreconciled' && p.isReconciled) return false;
      if (paymentSearch) {
        const q = paymentSearch.toLowerCase();
        const matchNo = (p.paymentNumber || '').toLowerCase().includes(q);
        const matchVend = (p.vendorName || p.employeeName || '').toLowerCase().includes(q);
        const matchRef = (p.transactionReference || '').toLowerCase().includes(q);
        if (!matchNo && !matchVend && !matchRef) return false;
      }
      return true;
    });
  }, [debitPayments, paymentStatusChip, paymentSearch]);

  const filteredReimbursements = useMemo(() => {
    return reimbursements.filter((r) => {
      if (reimbStatusChip !== 'All' && r.status !== reimbStatusChip) return false;
      if (reimbSearch) {
        const q = reimbSearch.toLowerCase();
        const matchNo = (r.requestNumber || '').toLowerCase().includes(q);
        const matchPayee = (r.payeeName || '').toLowerCase().includes(q);
        const matchReason = (r.reason || '').toLowerCase().includes(q);
        if (!matchNo && !matchPayee && !matchReason) return false;
      }
      return true;
    });
  }, [reimbursements, reimbStatusChip, reimbSearch]);

  const filteredReconciliations = useMemo(() => {
    return debitPayments.filter((p) => {
      if (reconStatusChip === 'Reconciled' && !p.isReconciled) return false;
      if (reconStatusChip === 'Pending' && p.isReconciled) return false;
      if (reconBankFilter !== 'All') {
        const bId = p.bankAccount?._id || p.bankAccount;
        if (String(bId) !== String(reconBankFilter)) return false;
      }
      if (reconSearch) {
        const q = reconSearch.toLowerCase();
        const matchNo = (p.paymentNumber || '').toLowerCase().includes(q);
        const matchVend = (p.vendorName || p.employeeName || '').toLowerCase().includes(q);
        const matchRef = (p.transactionReference || '').toLowerCase().includes(q);
        if (!matchNo && !matchVend && !matchRef) return false;
      }
      return true;
    });
  }, [debitPayments, reconStatusChip, reconBankFilter, reconSearch]);

  const filteredLedgerEntries = useMemo(() => {
    return ledgerEntries.filter((t) => {
      if (ledgerTypeFilter === 'Expense' && (Number(t.debit) <= 0 || t.entryType === 'Credit')) return false;
      if (ledgerTypeFilter === 'Reconciled' && !t.isReconciled) return false;
      if (ledgerTypeFilter === 'Unreconciled' && t.isReconciled) return false;
      if (ledgerAccountFilter !== 'All') {
        const aId = t.bankAccount?._id || t.bankAccount;
        if (String(aId) !== String(ledgerAccountFilter) && t.accountName !== ledgerAccountFilter) return false;
      }
      if (ledgerSearch) {
        const q = ledgerSearch.toLowerCase();
        const matchNum = (t.paymentNumber || '').toLowerCase().includes(q);
        const matchAcc = (t.accountName || '').toLowerCase().includes(q);
        const matchCat = (t.category || '').toLowerCase().includes(q);
        const matchParty = (t.party || t.vendorName || '').toLowerCase().includes(q);
        const matchRef = (t.reference || '').toLowerCase().includes(q);
        if (!matchNum && !matchAcc && !matchCat && !matchParty && !matchRef) return false;
      }
      return true;
    });
  }, [ledgerEntries, ledgerTypeFilter, ledgerAccountFilter, ledgerSearch]);

  const filteredReportData = useMemo(() => {
    if (!reportData?.data || !Array.isArray(reportData.data)) return [];
    if (!reportSearch.trim()) return reportData.data;
    const q = reportSearch.toLowerCase();
    return reportData.data.filter((row) => {
      return Object.values(row).some((val) =>
        String(val || '').toLowerCase().includes(q)
      );
    });
  }, [reportData, reportSearch]);

  // Category counts and totals map
  const categoryStats = useMemo(() => {
    const map = {};
    categoriesList.forEach((c) => {
      map[c] = { count: 0, total: 0 };
    });
    expenses.forEach((e) => {
      const c = e.category || 'Office Expenses';
      if (!map[c]) map[c] = { count: 0, total: 0 };
      map[c].count += 1;
      map[c].total += Number(e.total) || Number(e.amount) || 0;
    });
    return map;
  }, [categoriesList, expenses]);

  const kpis = overviewData?.kpis || {};
  const charts = overviewData?.charts || {};

  // Real-data insight calculations from MongoDB records
  const topCategory = useMemo(() => {
    if (charts.categoryBreakdown && charts.categoryBreakdown.length > 0) {
      return charts.categoryBreakdown[0];
    }
    return null;
  }, [charts.categoryBreakdown]);

  const topVendor = useMemo(() => {
    if (charts.vendorBreakdown && charts.vendorBreakdown.length > 0) {
      return charts.vendorBreakdown[0];
    }
    return null;
  }, [charts.vendorBreakdown]);

  const upcomingPaymentsInfo = useMemo(() => {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    let count = 0;
    let totalAmount = 0;

    if (Array.isArray(expenses)) {
      expenses.forEach((e) => {
        if (e.paymentStatus !== 'Paid' && e.paymentStatus !== 'Rejected' && e.dueDate) {
          const d = new Date(e.dueDate);
          if (d >= now && d <= in30Days) {
            count += 1;
            totalAmount += Number(e.balance) || Number(e.amount) || 0;
          }
        }
      });
    }

    if (Array.isArray(vendorBills)) {
      vendorBills.forEach((b) => {
        if (b.status !== 'Paid' && b.approvalStatus !== 'Rejected' && b.dueDate) {
          const d = new Date(b.dueDate);
          if (d >= now && d <= in30Days) {
            count += 1;
            totalAmount += Number(b.balance) || Number(b.totalAmount) || Number(b.amount) || 0;
          }
        }
      });
    }

    if (Array.isArray(recurringPlans)) {
      recurringPlans.forEach((p) => {
        if (p.status === 'Active' && p.nextDueDate) {
          const d = new Date(p.nextDueDate);
          if (d >= now && d <= in30Days) {
            count += 1;
            totalAmount += Number(p.amount) || 0;
          }
        }
      });
    }

    return { count, totalAmount };
  }, [expenses, vendorBills, recurringPlans]);

  return (
    <div className="fin-income-master">
      {/* ========================================================= */}
      {/* 1. PAGE HEADER                                            */}
      {/* ========================================================= */}
      <div className="fin-income-header-block fin-no-print">
        <div className="fin-income-header-top-row">
          <div className="fin-income-title-group">
            <h2 className="fin-income-page-title">Expense Management</h2>
            <p className="fin-income-page-subtitle">
              Manage the complete company expense lifecycle.
            </p>
          </div>
          <div className="fin-income-header-right-controls">
            <button
              type="button"
              className="fin-header-refresh-btn"
              onClick={refreshAllExpenseData}
              title="Refresh all expense records and overview data"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        <div className="fin-income-header-actions">
          <button
            type="button"
            className="fin-btn-orange"
            onClick={openAddExpenseModal}
            title="Add a new expense record"
          >
            + Add Expense
          </button>
          <button
            type="button"
            className="fin-btn-orange"
            onClick={() => openRecordPaymentModal()}
            title="Disburse payment against expense or vendor bill"
          >
            Record Payment
          </button>
          <button
            type="button"
            className="fin-btn-orange"
            onClick={handleExportCurrentView}
            title="Export CSV of current view"
          >
            Export
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. MAIN EXPENSE NAVIGATION TABS (13 Operations)           */}
      {/* ========================================================= */}
      <div className="fin-income-tabs-bar fin-no-print">
        {[
          { id: 'overview', label: 'Overview', icon: '📊' },
          { id: 'register', label: 'Expense Register', icon: '🧾', count: expenses.length },
          { id: 'clientExpenses', label: 'Client Expenses', icon: '💼', count: clientExpenses.length },
          { id: 'officeExpenses', label: 'Office Expenses', icon: '🏢', count: officeExpenses.length },
          { id: 'projectExpenses', label: 'Project Expenses', icon: '📁', count: projectExpenses.length },
          { id: 'vendorBills', label: 'Vendor Bills', icon: '📋', count: vendorBills.length },
          { id: 'payments', label: 'Payments', icon: '💳', count: debitPayments.length },
          { id: 'recurring', label: 'Recurring Expenses', icon: '🔄', count: recurringPlans.length },
          { id: 'reimbursements', label: 'Reimbursements', icon: '👥', count: reimbursements.length },
          { id: 'categories', label: 'Categories', icon: '🏷️', count: categoriesList.length },
          { id: 'ledger', label: 'Ledger', icon: '📖', count: ledgerEntries.length },
          {
            id: 'reconciliation',
            label: 'Reconciliation',
            icon: '⚖️',
            count: kpis.reconciliationPendingCount,
            badgeClass: kpis.reconciliationPendingCount > 0 ? 'fin-tab-badge-orange' : '',
          },
          { id: 'reports', label: 'Reports', icon: '📈' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`fin-income-tab-btn ${activeSubTab === tab.id ? 'active' : ''}`}
            onClick={() => handleSubTabSwitch(tab.id)}
          >
            <span className="fin-tab-icon">{tab.icon}</span>
            <span className="fin-tab-label">{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`fin-tab-count ${tab.badgeClass || ''}`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ========================================================= */}
      {/* TAB 1: OVERVIEW & ANALYTICS                               */}
      {/* ========================================================= */}
      {activeSubTab === 'overview' && (
        <div className="fin-overview-container">
          {/* Quick Expense Insights */}
          <div className="fin-quick-insights-block">
            <div className="fin-quick-insights-header">
              <h4 className="fin-quick-insights-title">
                <span className="fin-insights-icon">⚡</span> Quick Expense Insights
              </h4>
              <span className="fin-insights-sub">Live Key Payables & Spend Indicators</span>
            </div>
            <div className="fin-quick-insights-grid">
              {/* Card 1: Highest Expense Category */}
              <div className="fin-insight-card">
                <div className="fin-insight-icon-wrap category">🏷️</div>
                <div className="fin-insight-content">
                  <span className="fin-insight-label">Top Expense Category</span>
                  <span className="fin-insight-val" title={topCategory ? topCategory.category : 'None recorded'}>
                    {topCategory ? topCategory.category : 'None recorded'}
                  </span>
                  <span className="fin-insight-subval">
                    {topCategory ? formatCurrency(topCategory.amount) : '₹0'}
                  </span>
                </div>
              </div>

              {/* Card 2: Highest Vendor / Payee */}
              <div className="fin-insight-card">
                <div className="fin-insight-icon-wrap vendor">🏢</div>
                <div className="fin-insight-content">
                  <span className="fin-insight-label">Top Vendor / Payee</span>
                  <span className="fin-insight-val" title={topVendor ? topVendor.vendorName : 'None recorded'}>
                    {topVendor ? topVendor.vendorName : 'None recorded'}
                  </span>
                  <span className="fin-insight-subval">
                    {topVendor ? formatCurrency(topVendor.amount) : '₹0'}
                  </span>
                </div>
              </div>

              {/* Card 3: Upcoming Payments */}
              <div className="fin-insight-card">
                <div className="fin-insight-icon-wrap upcoming">⏰</div>
                <div className="fin-insight-content">
                  <span className="fin-insight-label">Upcoming Payments (30d)</span>
                  <span className="fin-insight-val">
                    {formatCurrency(upcomingPaymentsInfo.totalAmount || 0)}
                  </span>
                  <span className="fin-insight-subval">
                    {upcomingPaymentsInfo.count} {upcomingPaymentsInfo.count === 1 ? 'due payment' : 'due payments'}
                  </span>
                </div>
              </div>

              {/* Card 4: Pending Reimbursements */}
              <div className="fin-insight-card">
                <div className="fin-insight-icon-wrap reimb">👥</div>
                <div className="fin-insight-content">
                  <span className="fin-insight-label">Pending Reimbursements</span>
                  <span className="fin-insight-val">
                    {formatCurrency(kpis.reimbursementsPendingAmount || 0)}
                  </span>
                  <span className="fin-insight-subval">
                    {kpis.reimbursementsPendingCount || 0} {kpis.reimbursementsPendingCount === 1 ? 'claim pending' : 'claims pending'}
                  </span>
                </div>
              </div>

              {/* Card 5: Reconciliation Pending */}
              <div className="fin-insight-card">
                <div className="fin-insight-icon-wrap recon">⚖️</div>
                <div className="fin-insight-content">
                  <span className="fin-insight-label">Reconciliation Pending</span>
                  <span className="fin-insight-val">
                    {formatCurrency(kpis.reconciliationPendingAmount || 0)}
                  </span>
                  <span className="fin-insight-subval">
                    {kpis.reconciliationPendingCount || 0} {kpis.reconciliationPendingCount === 1 ? 'unreconciled payment' : 'unreconciled payments'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="fin-overview-controls-bar">
            <div>
              <h3 className="fin-income-heading">Operational Expense Summary</h3>
              <p className="fin-income-subtext">Real-time consolidated company payables & outlays</p>
            </div>
            <div className="fin-segmented-period-control">
              {[
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'This Week' },
                { id: 'month', label: 'This Month' },
                { id: 'quarter', label: 'Quarter' },
                { id: 'year', label: 'Financial Year' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`fin-segmented-btn ${overviewPeriod === p.id ? 'active' : ''}`}
                  onClick={() => setOverviewPeriod(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {overviewLoading ? (
            <div className="fin-loading-indicator">Loading financial metrics from MongoDB Atlas...</div>
          ) : (
            <>
              {/* 6 Primary KPI Cards */}
              <div className="fin-kpi-grid-6">
                {/* 1. Total Expenses */}
                <div className="fin-kpi-card">
                  <div className="fin-kpi-top">
                    <span className="fin-kpi-label">Total Expenses</span>
                    <div className="fin-kpi-icon-wrap expense">🧾</div>
                  </div>
                  <div className="fin-kpi-value">{formatCurrency(kpis.totalExpenses)}</div>
                  <div className="fin-kpi-footer">Cumulative paid outlays</div>
                </div>

                {/* 2. Expenses This Month */}
                <div className="fin-kpi-card">
                  <div className="fin-kpi-top">
                    <span className="fin-kpi-label">Expenses in Period</span>
                    <div className="fin-kpi-icon-wrap cashflow">📅</div>
                  </div>
                  <div className="fin-kpi-value" style={{ color: '#ea580c' }}>
                    {formatCurrency(kpis.expensesThisMonth)}
                  </div>
                  <div className="fin-kpi-footer">Period disbursals & expenses</div>
                </div>

                {/* 3. Outstanding Payables */}
                <div className="fin-kpi-card">
                  <div className="fin-kpi-top">
                    <span className="fin-kpi-label">Outstanding Payables</span>
                    <div className="fin-kpi-icon-wrap danger">⏳</div>
                  </div>
                  <div className="fin-kpi-value" style={{ color: '#dc2626' }}>
                    {formatCurrency(kpis.outstandingPayables)}
                  </div>
                  <div className="fin-kpi-footer">Approved payables due</div>
                </div>

                {/* 4. Pending Approval */}
                <div className="fin-kpi-card">
                  <div className="fin-kpi-top">
                    <span className="fin-kpi-label">Pending Approval</span>
                    <div className="fin-kpi-icon-wrap warning">⌛</div>
                  </div>
                  <div className="fin-kpi-value" style={{ color: '#d97706' }}>
                    {kpis.pendingApprovalCount || 0}
                  </div>
                  <div className="fin-kpi-footer">
                    Total: {formatCurrency(kpis.pendingApprovalAmount)}
                  </div>
                </div>

                {/* 5. Overdue Expenses */}
                <div className="fin-kpi-card">
                  <div className="fin-kpi-top">
                    <span className="fin-kpi-label">Overdue Payables</span>
                    <div className="fin-kpi-icon-wrap danger">🚨</div>
                  </div>
                  <div className="fin-kpi-value" style={{ color: '#ef4444' }}>
                    {kpis.overdueExpensesCount || 0}
                  </div>
                  <div className="fin-kpi-footer">
                    Total: {formatCurrency(kpis.overdueExpensesAmount)}
                  </div>
                </div>

                {/* 6. Paid Expenses */}
                <div className="fin-kpi-card">
                  <div className="fin-kpi-top">
                    <span className="fin-kpi-label">Settled Expenses</span>
                    <div className="fin-kpi-icon-wrap income">✅</div>
                  </div>
                  <div className="fin-kpi-value" style={{ color: '#16a34a' }}>
                    {kpis.paidExpensesCount || 0}
                  </div>
                  <div className="fin-kpi-footer">
                    Total: {formatCurrency(kpis.paidExpensesAmount)}
                  </div>
                </div>
              </div>

              {/* 7 Operational Metric Chips */}
              <div className="fin-secondary-metrics-row">
                <div className="fin-metric-chip">
                  <span className="fin-metric-chip-label">Unpaid Expenses:</span>
                  <span className="fin-metric-chip-val yellow">{kpis.unpaidExpensesCount || 0}</span>
                  <span className="fin-metric-chip-sub">({formatCurrency(kpis.unpaidExpensesAmount)})</span>
                </div>
                <div className="fin-metric-chip">
                  <span className="fin-metric-chip-label">Approved Payables:</span>
                  <span className="fin-metric-chip-val blue">{kpis.approvedExpensesCount || 0}</span>
                  <span className="fin-metric-chip-sub">({formatCurrency(kpis.approvedExpensesAmount)})</span>
                </div>
                <div className="fin-metric-chip">
                  <span className="fin-metric-chip-label">Recurring Subscriptions:</span>
                  <span className="fin-metric-chip-val orange">{kpis.recurringExpensesCount || 0}</span>
                  <span className="fin-metric-chip-sub">({formatCurrency(kpis.recurringExpensesAmount)}/mo)</span>
                </div>
                <div className="fin-metric-chip">
                  <span className="fin-metric-chip-label">Reimbursements Pending:</span>
                  <span className="fin-metric-chip-val red">{kpis.reimbursementsPendingCount || 0}</span>
                  <span className="fin-metric-chip-sub">({formatCurrency(kpis.reimbursementsPendingAmount)})</span>
                </div>
                <div className="fin-metric-chip">
                  <span className="fin-metric-chip-label">Reconciliation Pending:</span>
                  <span className="fin-metric-chip-val red">{kpis.reconciliationPendingCount || 0}</span>
                </div>
                <div className="fin-metric-chip">
                  <span className="fin-metric-chip-label">Active Bank Accounts:</span>
                  <span className="fin-metric-chip-val">{bankAccountsList.length}</span>
                </div>
              </div>

              {/* 6 Real-Data Analytics Cards */}
              <div className="fin-charts-grid-3x2">
                {/* 1. Monthly Expense Trend */}
                <div className="fin-chart-box">
                  <div className="fin-chart-header">
                    <h3>Monthly Expense Trend (12 Months)</h3>
                    <span className="fin-chart-badge">Billed vs Paid</span>
                  </div>
                  {charts.monthlyTrends && charts.monthlyTrends.length > 0 ? (
                    <div className="fin-bar-trend-container">
                      {charts.monthlyTrends.map((m, idx) => {
                        const maxVal = Math.max(...charts.monthlyTrends.map((t) => Math.max(t.total, t.paid)), 1);
                        const totalPct = Math.round((m.total / maxVal) * 90);
                        const paidPct = Math.round((m.paid / maxVal) * 90);
                        return (
                          <div key={idx} className="fin-trend-col" title={`${m.month}: Billed ${formatCurrency(m.total)}, Paid ${formatCurrency(m.paid)}`}>
                            <div className="fin-trend-bars">
                              <div className="fin-trend-bar billed" style={{ height: `${Math.max(4, totalPct)}%`, backgroundColor: '#f97316' }} />
                              <div className="fin-trend-bar paid" style={{ height: `${Math.max(4, paidPct)}%`, backgroundColor: '#10b981' }} />
                            </div>
                            <span className="fin-trend-label">{m.month}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="fin-empty-chart">No monthly expense data recorded</div>
                  )}
                </div>

                {/* 2. Expense by Category */}
                <div className="fin-chart-box">
                  <div className="fin-chart-header">
                    <h3>Expense by Category</h3>
                    <span className="fin-chart-badge">Allocation</span>
                  </div>
                  {charts.categoryBreakdown && charts.categoryBreakdown.length > 0 ? (
                    <div className="fin-chart-breakdown-list">
                      {charts.categoryBreakdown.slice(0, 5).map((cat, idx) => (
                        <div key={idx} className="fin-breakdown-row">
                          <div className="fin-breakdown-info">
                            <span className="fin-breakdown-name">{cat.category}</span>
                            <span className="fin-breakdown-amount">{formatCurrency(cat.amount)}</span>
                          </div>
                          <div className="fin-breakdown-bar-track">
                            <div className="fin-breakdown-bar-fill" style={{ width: `${Math.max(5, cat.percentage)}%`, backgroundColor: '#ea580c' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="fin-empty-chart">No category data available</div>
                  )}
                </div>

                {/* 3. Expense by Vendor / Payee */}
                <div className="fin-chart-box">
                  <div className="fin-chart-header">
                    <h3>Top Vendors / Payees</h3>
                    <span className="fin-chart-badge">Volume</span>
                  </div>
                  {charts.vendorBreakdown && charts.vendorBreakdown.length > 0 ? (
                    <div className="fin-chart-breakdown-list">
                      {charts.vendorBreakdown.map((v, idx) => (
                        <div key={idx} className="fin-breakdown-row">
                          <div className="fin-breakdown-info">
                            <span className="fin-breakdown-name">{v.vendorName}</span>
                            <span className="fin-breakdown-amount">{formatCurrency(v.amount)}</span>
                          </div>
                          <div className="fin-breakdown-bar-track">
                            <div className="fin-breakdown-bar-fill" style={{ width: '65%', backgroundColor: '#2563eb' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="fin-empty-chart">No vendor transactions recorded</div>
                  )}
                </div>

                {/* 4. Paid vs Unpaid Payables */}
                <div className="fin-chart-box">
                  <div className="fin-chart-header">
                    <h3>Paid vs Outstanding</h3>
                    <span className="fin-chart-badge">Settlement</span>
                  </div>
                  {charts.paidVsUnpaid ? (
                    <div className="fin-ratio-container">
                      <div className="fin-ratio-item">
                        <span className="fin-ratio-label">Settled Payments</span>
                        <strong className="fin-ratio-val text-success">
                          {formatCurrency(charts.paidVsUnpaid.paid)}
                        </strong>
                      </div>
                      <div className="fin-ratio-item">
                        <span className="fin-ratio-label">Outstanding Payables</span>
                        <strong className="fin-ratio-val text-danger">
                          {formatCurrency(charts.paidVsUnpaid.outstandingPayables)}
                        </strong>
                      </div>
                      <div className="fin-ratio-item">
                        <span className="fin-ratio-label">Unpaid Invoices</span>
                        <strong className="fin-ratio-val text-warning">
                          {formatCurrency(charts.paidVsUnpaid.unpaid)}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <div className="fin-empty-chart">No balance distribution data</div>
                  )}
                </div>

                {/* 5. Expense by Type */}
                <div className="fin-chart-box">
                  <div className="fin-chart-header">
                    <h3>Expense by Type</h3>
                    <span className="fin-chart-badge">Classification</span>
                  </div>
                  {charts.typeBreakdown && charts.typeBreakdown.length > 0 ? (
                    <div className="fin-chart-breakdown-list">
                      {charts.typeBreakdown.map((t, idx) => (
                        <div key={idx} className="fin-breakdown-row">
                          <div className="fin-breakdown-info">
                            <span className="fin-breakdown-name">{t.type}</span>
                            <span className="fin-breakdown-amount">{formatCurrency(t.amount)}</span>
                          </div>
                          <div className="fin-breakdown-bar-track">
                            <div className="fin-breakdown-bar-fill" style={{ width: '50%', backgroundColor: '#0284c7' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="fin-empty-chart">No expense classification data</div>
                  )}
                </div>

                {/* 6. Top Expense Categories */}
                <div className="fin-chart-box">
                  <div className="fin-chart-header">
                    <h3>Key Cost Centers</h3>
                    <span className="fin-chart-badge">Operations</span>
                  </div>
                  {charts.topCategories && charts.topCategories.length > 0 ? (
                    <div className="fin-chart-breakdown-list">
                      {charts.topCategories.map((c, idx) => (
                        <div key={idx} className="fin-breakdown-row">
                          <div className="fin-breakdown-info">
                            <span className="fin-breakdown-name">{c.category}</span>
                            <span className="fin-breakdown-amount">{c.count} items ({c.percentage}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="fin-empty-chart">No cost centers identified</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: EXPENSE REGISTER                                   */}
      {/* ========================================================= */}
      {activeSubTab === 'register' && (
        <div className="fin-table-container">
          {/* Unified Finance Toolbar */}
          <div className="fin-income-toolbar">
            <div className="fin-income-search-wrap">
              <span className="fin-income-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search expenses..."
                value={regSearch}
                onChange={(e) => setRegSearch(e.target.value)}
                className="fin-income-search-input"
              />
              {regSearch && (
                <button
                  type="button"
                  className="fin-income-search-clear"
                  onClick={() => setRegSearch('')}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Chips */}
            <div className="fin-income-filter-chips">
              {[
                { id: 'All', label: 'All' },
                { id: 'Draft', label: 'Draft' },
                { id: 'Pending', label: 'Pending' },
                { id: 'Approved', label: 'Approved' },
                { id: 'Partially Paid', label: 'Partially Paid' },
                { id: 'Paid', label: 'Paid' },
                { id: 'Overdue', label: 'Overdue' },
              ].map((chip) => {
                const count =
                  chip.id === 'All'
                    ? expenses.length
                    : expenses.filter((e) => e.paymentStatus === chip.id).length;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    className={`fin-income-filter-chip ${regStatusChip === chip.id ? 'active' : ''}`}
                    onClick={() => setRegStatusChip(chip.id)}
                  >
                    <span>{chip.label}</span>
                    <span className="fin-income-chip-count">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Actions / Dropdowns */}
            <div className="fin-income-toolbar-actions">
              <select
                className="fin-filter-select"
                value={regCategory}
                onChange={(e) => setRegCategory(e.target.value)}
              >
                <option value="All">All Categories</option>
                {categoriesList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className={`fin-income-action-btn ${showAdvancedFilters ? '' : 'secondary'}`}
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                Filters {showAdvancedFilters ? '▲' : '▼'}
              </button>

              <button type="button" className="fin-btn-orange" onClick={openAddExpenseModal}>
                + Add Expense
              </button>
            </div>
          </div>

          {/* Optional Advanced Filters Bar */}
          {showAdvancedFilters && (
            <div className="fin-advanced-filters-panel" style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Type:</label>
                <select
                  className="fin-filter-select"
                  value={regCategoryType}
                  onChange={(e) => setRegCategoryType(e.target.value)}
                >
                  <option value="All">All Types</option>
                  <option value="Office Expenses">Office Expenses</option>
                  <option value="Project Expenses">Project Expenses</option>
                  <option value="Client Expenses">Client Expenses</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Vendor:</label>
                <select
                  className="fin-filter-select"
                  value={regVendor}
                  onChange={(e) => setRegVendor(e.target.value)}
                >
                  <option value="All">All Vendors</option>
                  {vendorsList.map((v) => (
                    <option key={v._id} value={v.companyName || v.name}>
                      {v.companyName || v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>From:</label>
                <input
                  type="date"
                  className="fin-filter-select"
                  value={regStartDate}
                  onChange={(e) => setRegStartDate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>To:</label>
                <input
                  type="date"
                  className="fin-filter-select"
                  value={regEndDate}
                  onChange={(e) => setRegEndDate(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="fin-btn-secondary fin-btn-sm"
                onClick={() => {
                  setRegCategoryType('All');
                  setRegVendor('All');
                  setRegStartDate('');
                  setRegEndDate('');
                }}
              >
                Reset
              </button>
            </div>
          )}

          {/* Table */}
          <div className="fin-table-responsive">
            <table className="fin-data-table fin-income-table">
              <thead>
                <tr>
                  <th>TITLE</th>
                  <th>CATEGORY</th>
                  <th>TYPE</th>
                  <th>AMOUNT</th>
                  <th>DATE</th>
                  <th>VENDOR / PAYEE</th>
                  <th>PAID</th>
                  <th>BALANCE</th>
                  <th>STATUS</th>
                  <th className="text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {registerLoading ? (
                  <tr>
                    <td colSpan="10" className="text-center" style={{ padding: '2rem' }}>
                      Loading expenses from MongoDB Atlas...
                    </td>
                  </tr>
                ) : filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="text-center" style={{ padding: '2.5rem', color: '#64748b' }}>
                      No expenses found matching the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => (
                    <tr key={exp._id}>
                      <td>
                        <strong style={{ color: '#0f172a' }}>{exp.title}</strong>
                        {exp.receiptNumber && (
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>#{exp.receiptNumber}</div>
                        )}
                      </td>
                      <td>{exp.category}</td>
                      <td>
                        <small style={{ color: '#475569', fontWeight: 500 }}>
                          {exp.categoryType || 'Office Expenses'}
                        </small>
                      </td>
                      <td>
                        <strong>{formatCurrency(exp.total || exp.amount)}</strong>
                      </td>
                      <td>{formatDate(exp.expenseDate)}</td>
                      <td>{exp.vendorName || exp.employeeName || '—'}</td>
                      <td style={{ color: '#16a34a', fontWeight: 600 }}>
                        {formatCurrency(exp.paidAmount || 0)}
                      </td>
                      <td style={{ color: Number(exp.balance) > 0 ? '#dc2626' : '#64748b', fontWeight: 600 }}>
                        {formatCurrency(exp.balance !== undefined ? exp.balance : exp.total || exp.amount)}
                      </td>
                      <td>
                        <span className={`fin-badge ${String(exp.paymentStatus || 'Pending').toLowerCase().replace(/\s+/g, '-')}`}>
                          {exp.paymentStatus}
                        </span>
                      </td>
                      <td className="fin-income-actions-cell">
                        <div className="fin-income-actions-group">
                          <button
                            type="button"
                            className="fin-income-action-btn secondary"
                            onClick={() => openViewExpenseModal(exp)}
                            title="View complete expense details"
                          >
                            👁 View
                          </button>
                          {canEditOrDelete && (
                            <button
                              type="button"
                              className="fin-income-action-btn secondary"
                              disabled={exp.paymentStatus === 'Paid'}
                              onClick={() => openEditExpenseModal(exp)}
                              title={exp.paymentStatus === 'Paid' ? 'Paid expenses cannot be edited' : 'Edit expense'}
                            >
                              ✏ Edit
                            </button>
                          )}
                          {isFinanceAdmin && (
                            <button
                              type="button"
                              className="fin-income-action-btn danger"
                              disabled={exp.paymentStatus === 'Paid'}
                              onClick={() => openDeleteModal('expense', exp)}
                              title={exp.paymentStatus === 'Paid' ? 'Paid expenses cannot be deleted' : 'Delete expense'}
                            >
                              🗑 Delete
                            </button>
                          )}
                          {exp.paymentStatus !== 'Paid' && (
                            <button
                              type="button"
                              className="fin-income-action-btn"
                              onClick={() => openRecordPaymentModal(exp, 'expense')}
                              title="Record disbursal payment"
                            >
                              Pay
                            </button>
                          )}
                          {exp.paymentStatus === 'Pending' && (
                            <button
                              type="button"
                              className="fin-income-action-btn"
                              style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                              onClick={() => handleApproveExpense(exp._id)}
                              title="Approve expense"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: CLIENT EXPENSES                                    */}
      {/* ========================================================= */}
      {activeSubTab === 'clientExpenses' && (
        <div className="fin-table-container">
          {/* Quick Metrics Bar */}
          <div className="fin-compact-kpi-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            <div className="fin-kpi-chip-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>TOTAL CLIENT EXPENSES</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                {formatCurrency(clientExpenses.reduce((s, e) => s + (Number(e.total || e.amount) || 0), 0))}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{clientExpenses.length} client expense records</div>
            </div>
            <div className="fin-kpi-chip-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>PAID / RECOVERED</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#16a34a' }}>
                {formatCurrency(clientExpenses.reduce((s, e) => s + (Number(e.paidAmount) || 0), 0))}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#16a34a' }}>Disbursed & accounted</div>
            </div>
            <div className="fin-kpi-chip-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#ea580c', fontWeight: 600 }}>OUTSTANDING PAYABLE / BALANCE</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ea580c' }}>
                {formatCurrency(clientExpenses.reduce((s, e) => s + (Number(e.balance !== undefined ? e.balance : (e.total || e.amount) - (e.paidAmount || 0)) || 0), 0))}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#ea580c' }}>Pending reimbursement / balance</div>
            </div>
          </div>

          {/* Unified Finance Toolbar */}
          <div className="fin-income-toolbar">
            <div className="fin-income-search-wrap">
              <span className="fin-income-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search by title, client, project or vendor..."
                value={clientExpSearch}
                onChange={(e) => setClientExpSearch(e.target.value)}
                className="fin-income-search-input"
              />
              {clientExpSearch && (
                <button
                  type="button"
                  className="fin-income-search-clear"
                  onClick={() => setClientExpSearch('')}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Chips */}
            <div className="fin-income-filter-chips">
              {[
                { id: 'All', label: 'All' },
                { id: 'Pending', label: 'Pending' },
                { id: 'Approved', label: 'Approved' },
                { id: 'Partially Paid', label: 'Partially Paid' },
                { id: 'Paid', label: 'Paid' },
                { id: 'Overdue', label: 'Overdue' },
              ].map((chip) => {
                const count =
                  chip.id === 'All'
                    ? clientExpenses.length
                    : clientExpenses.filter((e) => e.paymentStatus === chip.id).length;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    className={`fin-income-filter-chip ${clientExpStatusChip === chip.id ? 'active' : ''}`}
                    onClick={() => setClientExpStatusChip(chip.id)}
                  >
                    <span>{chip.label}</span>
                    <span className="fin-income-chip-count">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Actions / Dropdowns */}
            <div className="fin-income-toolbar-actions">
              <select
                className="fin-filter-select"
                value={clientExpClientFilter}
                onChange={(e) => setClientExpClientFilter(e.target.value)}
              >
                <option value="All">All Clients</option>
                {clientsList.map((c) => (
                  <option key={c._id || c.id} value={c._id || c.id}>
                    {c.name || c.companyName || c.company}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="fin-btn-orange"
                onClick={() => openAddExpenseModal({ categoryType: 'Client Expenses' })}
              >
                + Add Client Expense
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="fin-table-responsive">
            <table className="fin-data-table fin-income-table">
              <thead>
                <tr>
                  <th>CLIENT</th>
                  <th>PROJECT</th>
                  <th>EXPENSE TITLE</th>
                  <th>CATEGORY</th>
                  <th>VENDOR / PAYEE</th>
                  <th>AMOUNT</th>
                  <th>DATE</th>
                  <th>PAID</th>
                  <th>BALANCE</th>
                  <th>STATUS</th>
                  <th className="text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {registerLoading ? (
                  <tr>
                    <td colSpan="11" className="text-center" style={{ padding: '2rem' }}>
                      Loading client expenses...
                    </td>
                  </tr>
                ) : filteredClientExpenses.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="text-center" style={{ padding: '2.5rem', color: '#64748b' }}>
                      No client expenses found.
                    </td>
                  </tr>
                ) : (
                  filteredClientExpenses.map((exp) => (
                    <tr key={exp._id}>
                      <td>
                        <strong style={{ color: '#0f172a' }}>{exp.clientName || exp.client?.name || '—'}</strong>
                      </td>
                      <td>
                        <span style={{ color: '#475569', fontSize: '0.82rem' }}>
                          {exp.projectName || exp.project?.name || '—'}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: '#1e293b' }}>{exp.title}</strong>
                        {exp.receiptNumber && (
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>#{exp.receiptNumber}</div>
                        )}
                      </td>
                      <td>{exp.category}</td>
                      <td>{exp.vendorName || exp.vendor?.companyName || exp.employeeName || '—'}</td>
                      <td>
                        <strong>{formatCurrency(exp.total || exp.amount)}</strong>
                      </td>
                      <td>{formatDate(exp.expenseDate)}</td>
                      <td style={{ color: '#16a34a', fontWeight: 600 }}>
                        {formatCurrency(exp.paidAmount || 0)}
                      </td>
                      <td style={{ color: Number(exp.balance) > 0 ? '#dc2626' : '#64748b', fontWeight: 600 }}>
                        {formatCurrency(exp.balance !== undefined ? exp.balance : exp.total || exp.amount)}
                      </td>
                      <td>
                        <span className={`fin-badge ${String(exp.paymentStatus || 'Pending').toLowerCase().replace(/\s+/g, '-')}`}>
                          {exp.paymentStatus}
                        </span>
                      </td>
                      <td className="fin-income-actions-cell">
                        <div className="fin-income-actions-group">
                          <button
                            type="button"
                            className="fin-income-action-btn secondary"
                            onClick={() => openViewExpenseModal(exp)}
                            title="View complete expense details"
                          >
                            👁 View
                          </button>
                          {canEditOrDelete && (
                            <button
                              type="button"
                              className="fin-income-action-btn secondary"
                              disabled={exp.paymentStatus === 'Paid'}
                              onClick={() => openEditExpenseModal(exp)}
                              title={exp.paymentStatus === 'Paid' ? 'Paid expenses cannot be edited' : 'Edit expense'}
                            >
                              ✏ Edit
                            </button>
                          )}
                          {isFinanceAdmin && (
                            <button
                              type="button"
                              className="fin-income-action-btn danger"
                              disabled={exp.paymentStatus === 'Paid'}
                              onClick={() => openDeleteModal('expense', exp)}
                              title={exp.paymentStatus === 'Paid' ? 'Paid expenses cannot be deleted' : 'Delete expense'}
                            >
                              🗑 Delete
                            </button>
                          )}
                          {exp.paymentStatus !== 'Paid' && (
                            <button
                              type="button"
                              className="fin-income-action-btn"
                              onClick={() => openRecordPaymentModal(exp, 'expense')}
                              title="Record disbursal payment"
                            >
                              Pay
                            </button>
                          )}
                          {exp.paymentStatus === 'Pending' && (
                            <button
                              type="button"
                              className="fin-income-action-btn"
                              style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                              onClick={() => handleApproveExpense(exp._id)}
                              title="Approve expense"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: OFFICE EXPENSES                                    */}
      {/* ========================================================= */}
      {activeSubTab === 'officeExpenses' && (
        <div className="fin-table-container">
          {/* Quick Metrics Bar */}
          <div className="fin-compact-kpi-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            <div className="fin-kpi-chip-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>TOTAL OFFICE OVERHEADS</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                {formatCurrency(officeExpenses.reduce((s, e) => s + (Number(e.total || e.amount) || 0), 0))}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{officeExpenses.length} operational overhead records</div>
            </div>
            <div className="fin-kpi-chip-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>DISBURSED / PAID</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#16a34a' }}>
                {formatCurrency(officeExpenses.reduce((s, e) => s + (Number(e.paidAmount) || 0), 0))}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#16a34a' }}>Paid to vendors & utilities</div>
            </div>
            <div className="fin-kpi-chip-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#ea580c', fontWeight: 600 }}>OUTSTANDING OFFICE PAYABLES</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ea580c' }}>
                {formatCurrency(officeExpenses.reduce((s, e) => s + (Number(e.balance !== undefined ? e.balance : (e.total || e.amount) - (e.paidAmount || 0)) || 0), 0))}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#ea580c' }}>Pending payment</div>
            </div>
          </div>

          {/* Unified Finance Toolbar */}
          <div className="fin-income-toolbar">
            <div className="fin-income-search-wrap">
              <span className="fin-income-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search office expense, vendor, receipt..."
                value={officeExpSearch}
                onChange={(e) => setOfficeExpSearch(e.target.value)}
                className="fin-income-search-input"
              />
              {officeExpSearch && (
                <button
                  type="button"
                  className="fin-income-search-clear"
                  onClick={() => setOfficeExpSearch('')}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Chips */}
            <div className="fin-income-filter-chips">
              {[
                { id: 'All', label: 'All' },
                { id: 'Pending', label: 'Pending' },
                { id: 'Approved', label: 'Approved' },
                { id: 'Partially Paid', label: 'Partially Paid' },
                { id: 'Paid', label: 'Paid' },
                { id: 'Overdue', label: 'Overdue' },
              ].map((chip) => {
                const count =
                  chip.id === 'All'
                    ? officeExpenses.length
                    : officeExpenses.filter((e) => e.paymentStatus === chip.id).length;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    className={`fin-income-filter-chip ${officeExpStatusChip === chip.id ? 'active' : ''}`}
                    onClick={() => setOfficeExpStatusChip(chip.id)}
                  >
                    <span>{chip.label}</span>
                    <span className="fin-income-chip-count">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Actions / Dropdowns */}
            <div className="fin-income-toolbar-actions">
              <select
                className="fin-filter-select"
                value={officeExpCatFilter}
                onChange={(e) => setOfficeExpCatFilter(e.target.value)}
              >
                <option value="All">All Categories</option>
                {categoriesList.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <button
                type="button"
                className="fin-btn-orange"
                onClick={() => openAddExpenseModal({ categoryType: 'Office Expenses' })}
              >
                + Add Office Expense
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="fin-table-responsive">
            <table className="fin-data-table fin-income-table">
              <thead>
                <tr>
                  <th>EXPENSE TITLE</th>
                  <th>CATEGORY</th>
                  <th>VENDOR / PAYEE</th>
                  <th>AMOUNT</th>
                  <th>DATE</th>
                  <th>PAID</th>
                  <th>BALANCE</th>
                  <th>STATUS</th>
                  <th>NOTES</th>
                  <th className="text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {registerLoading ? (
                  <tr>
                    <td colSpan="10" className="text-center" style={{ padding: '2rem' }}>
                      Loading office expenses...
                    </td>
                  </tr>
                ) : filteredOfficeExpenses.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="text-center" style={{ padding: '2.5rem', color: '#64748b' }}>
                      No office expenses found.
                    </td>
                  </tr>
                ) : (
                  filteredOfficeExpenses.map((exp) => (
                    <tr key={exp._id}>
                      <td>
                        <strong style={{ color: '#0f172a' }}>{exp.title}</strong>
                        {exp.receiptNumber && (
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>#{exp.receiptNumber}</div>
                        )}
                      </td>
                      <td>{exp.category}</td>
                      <td>{exp.vendorName || exp.vendor?.companyName || exp.employeeName || '—'}</td>
                      <td>
                        <strong>{formatCurrency(exp.total || exp.amount)}</strong>
                      </td>
                      <td>{formatDate(exp.expenseDate)}</td>
                      <td style={{ color: '#16a34a', fontWeight: 600 }}>
                        {formatCurrency(exp.paidAmount || 0)}
                      </td>
                      <td style={{ color: Number(exp.balance) > 0 ? '#dc2626' : '#64748b', fontWeight: 600 }}>
                        {formatCurrency(exp.balance !== undefined ? exp.balance : exp.total || exp.amount)}
                      </td>
                      <td>
                        <span className={`fin-badge ${String(exp.paymentStatus || 'Pending').toLowerCase().replace(/\s+/g, '-')}`}>
                          {exp.paymentStatus}
                        </span>
                      </td>
                      <td style={{ maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#64748b', fontSize: '0.8rem' }}>
                        {exp.description || exp.notes || '—'}
                      </td>
                      <td className="fin-income-actions-cell">
                        <div className="fin-income-actions-group">
                          <button
                            type="button"
                            className="fin-income-action-btn secondary"
                            onClick={() => openViewExpenseModal(exp)}
                            title="View complete expense details"
                          >
                            👁 View
                          </button>
                          {canEditOrDelete && (
                            <button
                              type="button"
                              className="fin-income-action-btn secondary"
                              disabled={exp.paymentStatus === 'Paid'}
                              onClick={() => openEditExpenseModal(exp)}
                              title={exp.paymentStatus === 'Paid' ? 'Paid expenses cannot be edited' : 'Edit expense'}
                            >
                              ✏ Edit
                            </button>
                          )}
                          {isFinanceAdmin && (
                            <button
                              type="button"
                              className="fin-income-action-btn danger"
                              disabled={exp.paymentStatus === 'Paid'}
                              onClick={() => openDeleteModal('expense', exp)}
                              title={exp.paymentStatus === 'Paid' ? 'Paid expenses cannot be deleted' : 'Delete expense'}
                            >
                              🗑 Delete
                            </button>
                          )}
                          {exp.paymentStatus !== 'Paid' && (
                            <button
                              type="button"
                              className="fin-income-action-btn"
                              onClick={() => openRecordPaymentModal(exp, 'expense')}
                              title="Record disbursal payment"
                            >
                              Pay
                            </button>
                          )}
                          {exp.paymentStatus === 'Pending' && (
                            <button
                              type="button"
                              className="fin-income-action-btn"
                              style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                              onClick={() => handleApproveExpense(exp._id)}
                              title="Approve expense"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: PROJECT EXPENSES                                   */}
      {/* ========================================================= */}
      {activeSubTab === 'projectExpenses' && (
        <div className="fin-table-container">
          {/* Quick Metrics Bar */}
          <div className="fin-compact-kpi-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            <div className="fin-kpi-chip-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>TOTAL PROJECT EXPENSES</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                {formatCurrency(projectExpenses.reduce((s, e) => s + (Number(e.total || e.amount) || 0), 0))}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{projectExpenses.length} project expense records</div>
            </div>
            <div className="fin-kpi-chip-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>PAID / DISBURSED</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#16a34a' }}>
                {formatCurrency(projectExpenses.reduce((s, e) => s + (Number(e.paidAmount) || 0), 0))}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#16a34a' }}>Direct project delivery spend</div>
            </div>
            <div className="fin-kpi-chip-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#ea580c', fontWeight: 600 }}>OUTSTANDING PROJECT BALANCE</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ea580c' }}>
                {formatCurrency(projectExpenses.reduce((s, e) => s + (Number(e.balance !== undefined ? e.balance : (e.total || e.amount) - (e.paidAmount || 0)) || 0), 0))}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#ea580c' }}>Payable to contractors / vendors</div>
            </div>
          </div>

          {/* Unified Finance Toolbar */}
          <div className="fin-income-toolbar">
            <div className="fin-income-search-wrap">
              <span className="fin-income-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search project, client, expense, vendor..."
                value={projectExpSearch}
                onChange={(e) => setProjectExpSearch(e.target.value)}
                className="fin-income-search-input"
              />
              {projectExpSearch && (
                <button
                  type="button"
                  className="fin-income-search-clear"
                  onClick={() => setProjectExpSearch('')}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Chips */}
            <div className="fin-income-filter-chips">
              {[
                { id: 'All', label: 'All' },
                { id: 'Pending', label: 'Pending' },
                { id: 'Approved', label: 'Approved' },
                { id: 'Partially Paid', label: 'Partially Paid' },
                { id: 'Paid', label: 'Paid' },
                { id: 'Overdue', label: 'Overdue' },
              ].map((chip) => {
                const count =
                  chip.id === 'All'
                    ? projectExpenses.length
                    : projectExpenses.filter((e) => e.paymentStatus === chip.id).length;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    className={`fin-income-filter-chip ${projectExpStatusChip === chip.id ? 'active' : ''}`}
                    onClick={() => setProjectExpStatusChip(chip.id)}
                  >
                    <span>{chip.label}</span>
                    <span className="fin-income-chip-count">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Actions / Dropdowns */}
            <div className="fin-income-toolbar-actions">
              <select
                className="fin-filter-select"
                value={projectExpProjectFilter}
                onChange={(e) => setProjectExpProjectFilter(e.target.value)}
              >
                <option value="All">All Projects</option>
                {projectsList.map((p) => (
                  <option key={p._id || p.id} value={p._id || p.id}>
                    {p.name || p.projectName || p.title}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="fin-btn-orange"
                onClick={() => openAddExpenseModal({ categoryType: 'Project Expenses' })}
              >
                + Add Project Expense
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="fin-table-responsive">
            <table className="fin-data-table fin-income-table">
              <thead>
                <tr>
                  <th>PROJECT</th>
                  <th>CLIENT</th>
                  <th>EXPENSE TITLE</th>
                  <th>CATEGORY</th>
                  <th>VENDOR / CONTRACTOR</th>
                  <th>AMOUNT</th>
                  <th>DATE</th>
                  <th>PAID</th>
                  <th>BALANCE</th>
                  <th>STATUS</th>
                  <th className="text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {registerLoading ? (
                  <tr>
                    <td colSpan="11" className="text-center" style={{ padding: '2rem' }}>
                      Loading project expenses...
                    </td>
                  </tr>
                ) : filteredProjectExpenses.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="text-center" style={{ padding: '2.5rem', color: '#64748b' }}>
                      No project expenses found.
                    </td>
                  </tr>
                ) : (
                  filteredProjectExpenses.map((exp) => (
                    <tr key={exp._id}>
                      <td>
                        <strong style={{ color: '#0f172a' }}>{exp.projectName || exp.project?.name || '—'}</strong>
                      </td>
                      <td>
                        <span style={{ color: '#475569', fontSize: '0.82rem' }}>
                          {exp.clientName || exp.client?.name || '—'}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: '#1e293b' }}>{exp.title}</strong>
                        {exp.receiptNumber && (
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>#{exp.receiptNumber}</div>
                        )}
                      </td>
                      <td>{exp.category}</td>
                      <td>{exp.vendorName || exp.vendor?.companyName || exp.employeeName || '—'}</td>
                      <td>
                        <strong>{formatCurrency(exp.total || exp.amount)}</strong>
                      </td>
                      <td>{formatDate(exp.expenseDate)}</td>
                      <td style={{ color: '#16a34a', fontWeight: 600 }}>
                        {formatCurrency(exp.paidAmount || 0)}
                      </td>
                      <td style={{ color: Number(exp.balance) > 0 ? '#dc2626' : '#64748b', fontWeight: 600 }}>
                        {formatCurrency(exp.balance !== undefined ? exp.balance : exp.total || exp.amount)}
                      </td>
                      <td>
                        <span className={`fin-badge ${String(exp.paymentStatus || 'Pending').toLowerCase().replace(/\s+/g, '-')}`}>
                          {exp.paymentStatus}
                        </span>
                      </td>
                      <td className="fin-income-actions-cell">
                        <div className="fin-income-actions-group">
                          <button
                            type="button"
                            className="fin-income-action-btn secondary"
                            onClick={() => openViewExpenseModal(exp)}
                            title="View complete expense details"
                          >
                            👁 View
                          </button>
                          {canEditOrDelete && (
                            <button
                              type="button"
                              className="fin-income-action-btn secondary"
                              disabled={exp.paymentStatus === 'Paid'}
                              onClick={() => openEditExpenseModal(exp)}
                              title={exp.paymentStatus === 'Paid' ? 'Paid expenses cannot be edited' : 'Edit expense'}
                            >
                              ✏ Edit
                            </button>
                          )}
                          {isFinanceAdmin && (
                            <button
                              type="button"
                              className="fin-income-action-btn danger"
                              disabled={exp.paymentStatus === 'Paid'}
                              onClick={() => openDeleteModal('expense', exp)}
                              title={exp.paymentStatus === 'Paid' ? 'Paid expenses cannot be deleted' : 'Delete expense'}
                            >
                              🗑 Delete
                            </button>
                          )}
                          {exp.paymentStatus !== 'Paid' && (
                            <button
                              type="button"
                              className="fin-income-action-btn"
                              onClick={() => openRecordPaymentModal(exp, 'expense')}
                              title="Record disbursal payment"
                            >
                              Pay
                            </button>
                          )}
                          {exp.paymentStatus === 'Pending' && (
                            <button
                              type="button"
                              className="fin-income-action-btn"
                              style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                              onClick={() => handleApproveExpense(exp._id)}
                              title="Approve expense"
                            >
                              Approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 6: VENDOR BILLS                                       */}
      {/* ========================================================= */}
      {activeSubTab === 'vendorBills' && (
        <div className="fin-table-container">
          <div className="fin-income-toolbar">
            <div className="fin-income-search-wrap">
              <span className="fin-income-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search vendor bills..."
                value={billSearch}
                onChange={(e) => setBillSearch(e.target.value)}
                className="fin-income-search-input"
              />
            </div>

            <div className="fin-income-filter-chips">
              {[
                { id: 'All', label: 'All Bills' },
                { id: 'Pending', label: 'Pending' },
                { id: 'Approved', label: 'Approved' },
                { id: 'Partially Paid', label: 'Partially Paid' },
                { id: 'Paid', label: 'Paid' },
              ].map((chip) => {
                const count =
                  chip.id === 'All'
                    ? vendorBills.length
                    : vendorBills.filter((b) => b.status === chip.id || b.approvalStatus === chip.id).length;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    className={`fin-income-filter-chip ${billStatusChip === chip.id ? 'active' : ''}`}
                    onClick={() => setBillStatusChip(chip.id)}
                  >
                    <span>{chip.label}</span>
                    <span className="fin-income-chip-count">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="fin-income-toolbar-actions">
              <button
                type="button"
                className="fin-btn-orange"
                onClick={() => {
                  setModalError('');
                  setModalSuccess('');
                  setBillFormData({
                    vendor: vendorsList[0]?._id || '',
                    billNumber: '',
                    billDate: new Date().toISOString().slice(0, 10),
                    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                    category: 'Software & IT',
                    amount: '',
                    tax: '',
                    description: '',
                  });
                  setActiveModal('addBill');
                }}
              >
                + Add Vendor Bill
              </button>
            </div>
          </div>

          <div className="fin-table-responsive">
            <table className="fin-data-table fin-income-table">
              <thead>
                <tr>
                  <th>BILL #</th>
                  <th>VENDOR</th>
                  <th>BILL DATE</th>
                  <th>DUE DATE</th>
                  <th>TOTAL</th>
                  <th>PAID</th>
                  <th>BALANCE</th>
                  <th>APPROVAL</th>
                  <th>STATUS</th>
                  <th className="text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {billsLoading ? (
                  <tr>
                    <td colSpan="10" className="text-center" style={{ padding: '2rem' }}>
                      Loading vendor bills...
                    </td>
                  </tr>
                ) : filteredBills.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="text-center" style={{ padding: '2.5rem', color: '#64748b' }}>
                      No vendor bills found.
                    </td>
                  </tr>
                ) : (
                  filteredBills.map((bill) => (
                    <tr key={bill._id}>
                      <td>
                        <strong>{bill.billNumber}</strong>
                      </td>
                      <td>{bill.vendorName || bill.vendor?.companyName || '—'}</td>
                      <td>{formatDate(bill.billDate)}</td>
                      <td>
                        <span style={{ color: bill.dueDate && new Date(bill.dueDate) < new Date() && bill.balance > 0 ? '#ef4444' : 'inherit' }}>
                          {formatDate(bill.dueDate)}
                        </span>
                      </td>
                      <td><strong>{formatCurrency(bill.totalAmount || bill.amount)}</strong></td>
                      <td style={{ color: '#16a34a', fontWeight: 600 }}>{formatCurrency(bill.paidAmount || 0)}</td>
                      <td style={{ color: Number(bill.balance) > 0 ? '#dc2626' : '#64748b', fontWeight: 600 }}>
                        {formatCurrency(bill.balance)}
                      </td>
                      <td>
                        <span className={`fin-badge ${String(bill.approvalStatus || 'Pending').toLowerCase()}`}>
                          {bill.approvalStatus || 'Pending'}
                        </span>
                      </td>
                      <td>
                        <span className={`fin-badge ${String(bill.status || 'Pending').toLowerCase().replace(/\s+/g, '-')}`}>
                          {bill.status}
                        </span>
                      </td>
                      <td className="fin-income-actions-cell">
                        <div className="fin-income-actions-group">
                          <button
                            type="button"
                            className="fin-income-action-btn secondary"
                            onClick={() => openViewBillModal(bill)}
                            title="View vendor bill details"
                          >
                            👁 View
                          </button>
                          {canEditOrDelete && (
                            <button
                              type="button"
                              className="fin-income-action-btn secondary"
                              disabled={bill.status === 'Paid'}
                              onClick={() => openEditBillModal(bill)}
                              title={bill.status === 'Paid' ? 'Paid bills cannot be edited' : 'Edit bill'}
                            >
                              ✏ Edit
                            </button>
                          )}
                          {isFinanceAdmin && (
                            <button
                              type="button"
                              className="fin-income-action-btn danger"
                              disabled={Number(bill.paidAmount) > 0 || bill.status === 'Paid'}
                              onClick={() => openDeleteModal('vendorBill', bill)}
                              title={Number(bill.paidAmount) > 0 || bill.status === 'Paid' ? 'Cannot delete bill with recorded payments' : 'Delete bill'}
                            >
                              🗑 Delete
                            </button>
                          )}
                          {bill.approvalStatus === 'Pending' && (
                            <button
                              type="button"
                              className="fin-income-action-btn"
                              style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                              onClick={() => handleApproveBill(bill._id)}
                              title="Approve vendor bill"
                            >
                              Approve
                            </button>
                          )}
                          {bill.approvalStatus === 'Approved' && bill.status !== 'Paid' && (
                            <button
                              type="button"
                              className="fin-income-action-btn"
                              onClick={() => openRecordPaymentModal(bill, 'bill')}
                              title="Record payment against bill"
                            >
                              Pay
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: PAYMENTS                                           */}
      {/* ========================================================= */}
      {activeSubTab === 'payments' && (
        <div className="fin-alloc-workspace">
          {/* Quick Pay Action Banner */}
          <div className="fin-alloc-card">
            <div className="fin-alloc-card-header">
              <h3 className="fin-alloc-card-title">💳 Disburse Operational Payment</h3>
              <button
                type="button"
                className="fin-btn-orange"
                onClick={() => openRecordPaymentModal()}
              >
                + Record New Payment
              </button>
            </div>
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b' }}>
              Execute partial or full payments against approved vendor bills and expenses with automatic bank balance deduction.
            </p>
          </div>

          {/* Payments Register Table */}
          <div className="fin-table-container">
            <div className="fin-income-toolbar">
              <div className="fin-income-search-wrap">
                <span className="fin-income-search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search debit payments..."
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                  className="fin-income-search-input"
                />
              </div>

              <div className="fin-income-filter-chips">
                {[
                  { id: 'All', label: 'All Payments' },
                  { id: 'Reconciled', label: 'Reconciled' },
                  { id: 'Unreconciled', label: 'Unreconciled' },
                ].map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className={`fin-income-filter-chip ${paymentStatusChip === chip.id ? 'active' : ''}`}
                    onClick={() => setPaymentStatusChip(chip.id)}
                  >
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="fin-table-responsive">
              <table className="fin-data-table fin-income-table">
                <thead>
                  <tr>
                    <th>PAYMENT #</th>
                    <th>RECIPIENT / VENDOR</th>
                    <th>AMOUNT</th>
                    <th>DATE</th>
                    <th>BANK ACCOUNT</th>
                    <th>METHOD</th>
                    <th>REFERENCE (UTR)</th>
                    <th>STATUS</th>
                    <th className="text-center">RECONCILED</th>
                    <th className="text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsLoading ? (
                    <tr>
                      <td colSpan="10" className="text-center" style={{ padding: '2rem' }}>
                        Loading payment records...
                      </td>
                    </tr>
                  ) : filteredDebitPayments.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="text-center" style={{ padding: '2.5rem', color: '#64748b' }}>
                        No debit payments found.
                      </td>
                    </tr>
                  ) : (
                    filteredDebitPayments.map((p) => (
                      <tr key={p._id}>
                        <td><strong>{p.paymentNumber}</strong></td>
                        <td>{p.vendorName || p.employeeName || 'Company Outflow'}</td>
                        <td style={{ color: '#ef4444', fontWeight: 700 }}>
                          - {formatCurrency(p.amount)}
                        </td>
                        <td>{formatDate(p.paymentDate)}</td>
                        <td>{p.bankAccountName || p.bankAccount?.accountName || 'Primary Bank'}</td>
                        <td>{p.paymentMethod || 'Bank Transfer'}</td>
                        <td>
                          <code style={{ fontSize: '0.72rem', background: '#f1f5f9', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                            {p.transactionReference || '—'}
                          </code>
                        </td>
                        <td>
                          <span className={`fin-badge ${String(p.status || 'completed').toLowerCase()}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className={`fin-badge ${p.isReconciled ? 'paid' : 'pending'}`}>
                            {p.isReconciled ? '✓ Matched' : 'Pending'}
                          </span>
                        </td>
                        <td className="fin-income-actions-cell">
                          <div className="fin-income-actions-group">
                            <button
                              type="button"
                              className="fin-income-action-btn secondary"
                              onClick={() => openViewPaymentModal(p)}
                              title="View payment transaction"
                            >
                              👁 View
                            </button>
                            {canEditOrDelete && (
                              <button
                                type="button"
                                className="fin-income-action-btn secondary"
                                onClick={() => openEditPaymentModal(p)}
                                title="Edit payment details"
                              >
                                ✏ Edit
                              </button>
                            )}
                            {isFinanceAdmin && (
                              <button
                                type="button"
                                className="fin-income-action-btn danger"
                                disabled={p.isReconciled}
                                onClick={() => openDeleteModal('payment', p)}
                                title={p.isReconciled ? 'Reconciled payments cannot be deleted' : 'Delete payment'}
                              >
                                🗑 Delete
                              </button>
                            )}
                            <button
                              type="button"
                              className={`fin-income-action-btn ${p.isReconciled ? 'secondary' : ''}`}
                              onClick={() => handleReconcileToggle(p._id, p.isReconciled)}
                              title={p.isReconciled ? 'Mark as Unmatched' : 'Mark as Reconciled'}
                            >
                              {p.isReconciled ? 'Unmatch' : 'Reconcile'}
                            </button>
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
      )}

      {/* ========================================================= */}
      {/* TAB 5: RECURRING EXPENSES                                 */}
      {/* ========================================================= */}
      {activeSubTab === 'recurring' && (
        <div className="fin-table-container">
          <div className="fin-income-toolbar">
            <div className="fin-income-search-wrap">
              <span className="fin-income-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search recurring plans..."
                value={recSearch}
                onChange={(e) => setRecSearch(e.target.value)}
                className="fin-income-search-input"
              />
            </div>

            <div className="fin-income-filter-chips">
              {[
                { id: 'All', label: 'All Plans' },
                { id: 'Active', label: 'Active' },
                { id: 'Paused', label: 'Paused' },
                { id: 'Cancelled', label: 'Cancelled' },
              ].map((chip) => {
                const count =
                  chip.id === 'All'
                    ? recurringPlans.length
                    : recurringPlans.filter((p) => p.status === chip.id).length;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    className={`fin-income-filter-chip ${recStatusChip === chip.id ? 'active' : ''}`}
                    onClick={() => setRecStatusChip(chip.id)}
                  >
                    <span>{chip.label}</span>
                    <span className="fin-income-chip-count">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="fin-income-toolbar-actions">
              <button
                type="button"
                className="fin-btn-orange"
                onClick={() => openRecurringPlanModal()}
              >
                + Add Recurring Expense
              </button>
            </div>
          </div>

          <div className="fin-table-responsive">
            <table className="fin-data-table fin-income-table">
              <thead>
                <tr>
                  <th>PLAN #</th>
                  <th>EXPENSE TITLE</th>
                  <th>VENDOR</th>
                  <th>CATEGORY</th>
                  <th>FREQUENCY</th>
                  <th>AMOUNT</th>
                  <th>START DATE</th>
                  <th>NEXT DUE</th>
                  <th>STATUS</th>
                  <th className="text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {recurringLoading ? (
                  <tr>
                    <td colSpan="10" className="text-center" style={{ padding: '2rem' }}>
                      Loading recurring expense plans...
                    </td>
                  </tr>
                ) : recurringPlans.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="text-center" style={{ padding: '2.5rem', color: '#64748b' }}>
                      No recurring expense plans found.
                    </td>
                  </tr>
                ) : (
                  recurringPlans
                    .filter((p) => recStatusChip === 'All' || p.status === recStatusChip)
                    .map((plan) => (
                      <tr key={plan._id}>
                        <td><strong>{plan.planNumber}</strong></td>
                        <td><strong>{plan.expenseTitle}</strong></td>
                        <td>{plan.vendorName || plan.vendor?.companyName || '—'}</td>
                        <td>{plan.category}</td>
                        <td>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{plan.billingFrequency}</span>
                        </td>
                        <td><strong>{formatCurrency(plan.amount)}</strong></td>
                        <td>{formatDate(plan.startDate)}</td>
                        <td>
                          <span style={{ color: plan.nextDueDate && new Date(plan.nextDueDate) < new Date() ? '#ef4444' : 'inherit', fontWeight: 600 }}>
                            {formatDate(plan.nextDueDate)}
                          </span>
                        </td>
                        <td>
                          <span className={`fin-badge ${String(plan.status || 'Active').toLowerCase()}`}>
                            {plan.status}
                          </span>
                        </td>
                        <td className="fin-income-actions-cell">
                          <div className="fin-income-actions-group">
                            <button
                              type="button"
                              className="fin-income-action-btn secondary"
                              onClick={() => openViewRecurringModal(plan)}
                              title="View recurring plan details"
                            >
                              👁 View
                            </button>
                            {canEditOrDelete && (
                              <button
                                type="button"
                                className="fin-income-action-btn secondary"
                                onClick={() => openEditRecurringModal(plan)}
                                title="Edit recurring plan"
                              >
                                ✏ Edit
                              </button>
                            )}
                            {isFinanceAdmin && (
                              <button
                                type="button"
                                className="fin-income-action-btn danger"
                                onClick={() => openDeleteModal('recurring', plan)}
                                title="Delete recurring plan"
                              >
                                🗑 Delete
                              </button>
                            )}
                            <button
                              type="button"
                              className="fin-income-action-btn secondary"
                              onClick={() => handleTogglePlanStatus(plan._id, plan.status)}
                              title={plan.status === 'Active' ? 'Pause automatic scheduling' : 'Resume automatic scheduling'}
                            >
                              {plan.status === 'Active' ? 'Pause' : 'Resume'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 6: EMPLOYEE REIMBURSEMENTS                            */}
      {/* ========================================================= */}
      {activeSubTab === 'reimbursements' && (
        <div className="fin-table-container">
          <div className="fin-income-toolbar">
            <div className="fin-income-search-wrap">
              <span className="fin-income-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search reimbursements..."
                value={reimbSearch}
                onChange={(e) => setReimbSearch(e.target.value)}
                className="fin-income-search-input"
              />
            </div>

            <div className="fin-income-filter-chips">
              {[
                { id: 'All', label: 'All' },
                { id: 'Submitted', label: 'Submitted' },
                { id: 'Approved', label: 'Approved' },
                { id: 'Paid', label: 'Paid' },
                { id: 'Rejected', label: 'Rejected' },
              ].map((chip) => {
                const count =
                  chip.id === 'All'
                    ? reimbursements.length
                    : reimbursements.filter((r) => r.status === chip.id).length;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    className={`fin-income-filter-chip ${reimbStatusChip === chip.id ? 'active' : ''}`}
                    onClick={() => setReimbStatusChip(chip.id)}
                  >
                    <span>{chip.label}</span>
                    <span className="fin-income-chip-count">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="fin-income-toolbar-actions">
              <button
                type="button"
                className="fin-btn-orange"
                onClick={() => {
                  setModalError('');
                  setModalSuccess('');
                  setReimbFormData({
                    employeeId: employeesList[0]?._id || '',
                    amount: '',
                    reason: '',
                    requiredDate: new Date().toISOString().slice(0, 10),
                    priority: 'Medium',
                    supportingDocumentUrl: '',
                  });
                  setActiveModal('reimbursement');
                }}
              >
                + Submit Reimbursement
              </button>
            </div>
          </div>

          <div className="fin-table-responsive">
            <table className="fin-data-table fin-income-table">
              <thead>
                <tr>
                  <th>REQ #</th>
                  <th>EMPLOYEE</th>
                  <th>DEPARTMENT</th>
                  <th>AMOUNT</th>
                  <th>REQUIRED DATE</th>
                  <th>REASON</th>
                  <th>STATUS</th>
                  <th className="text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {reimbLoading ? (
                  <tr>
                    <td colSpan="8" className="text-center" style={{ padding: '2rem' }}>
                      Loading employee reimbursements...
                    </td>
                  </tr>
                ) : filteredReimbursements.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center" style={{ padding: '2.5rem', color: '#64748b' }}>
                      No employee reimbursements found.
                    </td>
                  </tr>
                ) : (
                  filteredReimbursements.map((req) => (
                    <tr key={req._id}>
                      <td><strong>{req.requestNumber}</strong></td>
                      <td><strong>{req.payeeName}</strong></td>
                      <td>{req.department || 'Operations'}</td>
                      <td><strong>{formatCurrency(req.amount)}</strong></td>
                      <td>{formatDate(req.requiredDate)}</td>
                      <td>
                        <div style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={req.reason}>
                          {req.reason}
                        </div>
                      </td>
                      <td>
                        <span className={`fin-badge ${String(req.status || 'Submitted').toLowerCase()}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="fin-income-actions-cell">
                        <div className="fin-income-actions-group">
                          <button
                            type="button"
                            className="fin-income-action-btn secondary"
                            onClick={() => openViewReimbursementModal(req)}
                            title="View reimbursement request"
                          >
                            👁 View
                          </button>
                          {canEditOrDelete && (
                            <button
                              type="button"
                              className="fin-income-action-btn secondary"
                              disabled={req.status === 'Paid'}
                              onClick={() => openEditReimbursementModal(req)}
                              title={req.status === 'Paid' ? 'Paid reimbursements cannot be edited' : 'Edit reimbursement'}
                            >
                              ✏ Edit
                            </button>
                          )}
                          {isFinanceAdmin && (
                            <button
                              type="button"
                              className="fin-income-action-btn danger"
                              disabled={req.status === 'Paid'}
                              onClick={() => openDeleteModal('reimbursement', req)}
                              title={req.status === 'Paid' ? 'Paid reimbursements cannot be deleted' : 'Delete reimbursement'}
                            >
                              🗑 Delete
                            </button>
                          )}
                          {req.status === 'Submitted' && (
                            <>
                              <button
                                type="button"
                                className="fin-income-action-btn"
                                style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                                onClick={() => handleApproveReimbursement(req._id)}
                                title="Approve reimbursement"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="fin-income-action-btn secondary"
                                onClick={() => handleRejectReimbursement(req._id)}
                                title="Reject reimbursement"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {req.status === 'Approved' && (
                            <button
                              type="button"
                              className="fin-income-action-btn"
                              onClick={() => handlePayReimbursement(req)}
                              title="Disburse payment"
                            >
                              Disburse
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 7: CATEGORIES                                         */}
      {/* ========================================================= */}
      {activeSubTab === 'categories' && (
        <div className="fin-table-container">
          <div className="fin-income-toolbar">
            <div>
              <h3 className="fin-income-heading">Master Expense Categories</h3>
              <p className="fin-income-subtext">Manage operational categories and monitor cost distribution</p>
            </div>
            <div className="fin-income-toolbar-actions">
              <button
                type="button"
                className="fin-btn-orange"
                onClick={() => {
                  setNewCategoryName('');
                  setActiveModal('addCategory');
                }}
              >
                + Add Custom Category
              </button>
            </div>
          </div>

          <div className="fin-table-responsive">
            <table className="fin-data-table fin-income-table">
              <thead>
                <tr>
                  <th>CATEGORY NAME</th>
                  <th>EXPENSE COUNT</th>
                  <th>TOTAL EXPENDITURE</th>
                  <th>PERCENTAGE OF OUTLAYS</th>
                  <th>STATUS</th>
                  <th className="text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {categoriesList.map((cat) => {
                  const stat = categoryStats[cat] || { count: 0, total: 0 };
                  const totalExp = kpis.totalExpenses || 1;
                  const pct = Math.round((stat.total / totalExp) * 100);
                  return (
                    <tr key={cat}>
                      <td><strong>{cat}</strong></td>
                      <td>
                        <span className="fin-tab-count" style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>
                          {stat.count} items
                        </span>
                      </td>
                      <td><strong>{formatCurrency(stat.total)}</strong></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: '#fb8234' }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>{pct}%</span>
                        </div>
                      </td>
                      <td>
                        <span className="fin-badge paid">Active</span>
                      </td>
                      <td className="fin-income-actions-cell">
                        <div className="fin-income-actions-group">
                          <button
                            type="button"
                            className="fin-income-action-btn secondary"
                            onClick={() => openViewCategoryModal(cat)}
                            title="View category details"
                          >
                            👁 View
                          </button>
                          {canEditOrDelete && (
                            <button
                              type="button"
                              className="fin-income-action-btn secondary"
                              onClick={() => openEditCategoryModal(cat)}
                              title="Edit/Rename category"
                            >
                              ✏ Edit
                            </button>
                          )}
                          {isFinanceAdmin && (
                            <button
                              type="button"
                              className="fin-income-action-btn danger"
                              disabled={stat.count > 0}
                              onClick={() => openDeleteModal('category', cat)}
                              title={stat.count > 0 ? `Cannot delete category in use by ${stat.count} expense(s)` : 'Delete category'}
                            >
                              🗑 Delete
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
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 11: EXPENSE LEDGER                                    */}
      {/* ========================================================= */}
      {activeSubTab === 'ledger' && (
        <div className="fin-table-container">
          {/* Quick Metrics Bar */}
          <div className="fin-compact-kpi-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            <div className="fin-kpi-chip-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>TOTAL DEBIT / EXPENSE OUTFLOW</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626' }}>
                {formatCurrency(ledgerEntries.reduce((s, t) => s + (Number(t.debit) || 0), 0))}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Recorded expense outflows</div>
            </div>
            <div className="fin-kpi-chip-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>TOTAL CREDIT / REFUNDS</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#16a34a' }}>
                {formatCurrency(ledgerEntries.reduce((s, t) => s + (Number(t.credit) || 0), 0))}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#16a34a' }}>Adjustments & reversals</div>
            </div>
            <div className="fin-kpi-chip-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#0f172a', fontWeight: 600 }}>TOTAL POSTED TRANSACTIONS</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                {ledgerEntries.length}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Real-time General Ledger entries</div>
            </div>
          </div>

          {/* Unified Finance Toolbar */}
          <div className="fin-income-toolbar">
            <div className="fin-income-search-wrap">
              <span className="fin-income-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search ledger by Tx #, account, party, ref..."
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                className="fin-income-search-input"
              />
              {ledgerSearch && (
                <button
                  type="button"
                  className="fin-income-search-clear"
                  onClick={() => setLedgerSearch('')}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Chips */}
            <div className="fin-income-filter-chips">
              {[
                { id: 'All', label: 'All Entries' },
                { id: 'Expense', label: 'Debits Only' },
                { id: 'Reconciled', label: 'Reconciled' },
                { id: 'Unreconciled', label: 'Unreconciled' },
              ].map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  className={`fin-income-filter-chip ${ledgerTypeFilter === chip.id ? 'active' : ''}`}
                  onClick={() => setLedgerTypeFilter(chip.id)}
                >
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>

            {/* Actions / Dropdowns */}
            <div className="fin-income-toolbar-actions">
              <select
                className="fin-filter-select"
                value={ledgerAccountFilter}
                onChange={(e) => setLedgerAccountFilter(e.target.value)}
              >
                <option value="All">All Accounts</option>
                {bankAccountsList.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.accountName || b.bankName}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="fin-income-action-btn secondary"
                onClick={handleExportCurrentView}
              >
                Export CSV
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="fin-table-responsive">
            <table className="fin-data-table fin-income-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>TX / PAYMENT #</th>
                  <th>ACCOUNT</th>
                  <th>CATEGORY</th>
                  <th>PARTY / VENDOR</th>
                  <th>REFERENCE</th>
                  <th className="text-right">DEBIT (₹)</th>
                  <th className="text-right">CREDIT (₹)</th>
                  <th className="text-right">BALANCE (₹)</th>
                  <th className="text-center">STATUS</th>
                  <th className="text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {ledgerLoading ? (
                  <tr>
                    <td colSpan="11" className="text-center" style={{ padding: '2rem' }}>
                      Loading ledger entries from MongoDB Atlas...
                    </td>
                  </tr>
                ) : filteredLedgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="text-center" style={{ padding: '2.5rem', color: '#64748b' }}>
                      No ledger transactions found.
                    </td>
                  </tr>
                ) : (
                  filteredLedgerEntries.map((t, idx) => (
                    <tr key={t._id || idx}>
                      <td>{formatDate(t.date || t.paymentDate || t.createdAt)}</td>
                      <td>
                        <strong style={{ color: '#0f172a' }}>{t.paymentNumber || t.transactionId || '—'}</strong>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500, color: '#334155' }}>
                          {t.accountName || t.bankAccount?.accountName || t.bankAccount?.bankName || 'General Bank'}
                        </span>
                      </td>
                      <td>{t.category || 'Expense'}</td>
                      <td>{t.party || t.vendorName || t.vendor?.companyName || t.clientName || '—'}</td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {t.reference || t.transactionReference || '—'}
                        </span>
                      </td>
                      <td className="text-right" style={{ color: Number(t.debit) > 0 ? '#dc2626' : '#64748b', fontWeight: 600 }}>
                        {Number(t.debit) > 0 ? formatCurrency(t.debit) : '—'}
                      </td>
                      <td className="text-right" style={{ color: Number(t.credit) > 0 ? '#16a34a' : '#64748b', fontWeight: 600 }}>
                        {Number(t.credit) > 0 ? formatCurrency(t.credit) : '—'}
                      </td>
                      <td className="text-right" style={{ fontWeight: 700, color: '#0f172a' }}>
                        {t.runningBalance !== undefined ? formatCurrency(t.runningBalance) : '—'}
                      </td>
                      <td className="text-center">
                        <span className={`fin-badge ${t.isReconciled ? 'paid' : 'pending'}`}>
                          {t.isReconciled ? 'Reconciled' : 'Unreconciled'}
                        </span>
                      </td>
                      <td className="fin-income-actions-cell">
                        <div className="fin-income-actions-group">
                          <button
                            type="button"
                            className="fin-income-action-btn secondary"
                            onClick={() => openViewLedgerModal(t)}
                            title="View ledger journal entry"
                          >
                            👁 View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 12: RECONCILIATION                                    */}
      {/* ========================================================= */}
      {activeSubTab === 'reconciliation' && (
        <div className="fin-table-container">
          <div className="fin-income-toolbar">
            <div className="fin-income-search-wrap">
              <span className="fin-income-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search transactions..."
                value={reconSearch}
                onChange={(e) => setReconSearch(e.target.value)}
                className="fin-income-search-input"
              />
            </div>

            <div className="fin-income-filter-chips">
              {[
                { id: 'All', label: 'All Transactions' },
                { id: 'Reconciled', label: 'Reconciled' },
                { id: 'Pending', label: 'Pending Reconciliation' },
              ].map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  className={`fin-income-filter-chip ${reconStatusChip === chip.id ? 'active' : ''}`}
                  onClick={() => setReconStatusChip(chip.id)}
                >
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>

            <div className="fin-income-toolbar-actions">
              <select
                className="fin-filter-select"
                value={reconBankFilter}
                onChange={(e) => setReconBankFilter(e.target.value)}
              >
                <option value="All">All Bank Accounts</option>
                {bankAccountsList.map((acc) => (
                  <option key={acc._id} value={acc._id}>
                    {acc.bankName} - {acc.accountName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="fin-table-responsive">
            <table className="fin-data-table fin-income-table">
              <thead>
                <tr>
                  <th>PAYMENT #</th>
                  <th>RECIPIENT / VENDOR</th>
                  <th>AMOUNT</th>
                  <th>DATE</th>
                  <th>BANK ACCOUNT</th>
                  <th>METHOD</th>
                  <th>UTR / REF</th>
                  <th>RECONCILED</th>
                  <th className="text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredReconciliations.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center" style={{ padding: '2.5rem', color: '#64748b' }}>
                      No transactions found for reconciliation.
                    </td>
                  </tr>
                ) : (
                  filteredReconciliations.map((p) => (
                    <tr key={p._id}>
                      <td><strong>{p.paymentNumber}</strong></td>
                      <td>{p.vendorName || p.employeeName || 'Company Outflow'}</td>
                      <td style={{ color: '#ef4444', fontWeight: 700 }}>
                        {formatCurrency(p.amount)}
                      </td>
                      <td>{formatDate(p.paymentDate)}</td>
                      <td>{p.bankAccountName || p.bankAccount?.accountName || 'Primary Account'}</td>
                      <td>{p.paymentMethod || 'Bank Transfer'}</td>
                      <td>
                        <code style={{ fontSize: '0.72rem', background: '#f1f5f9', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                          {p.transactionReference || '—'}
                        </code>
                      </td>
                      <td>
                        <span className={`fin-badge ${p.isReconciled ? 'paid' : 'pending'}`}>
                          {p.isReconciled ? '✓ Matched' : 'Pending'}
                        </span>
                      </td>
                      <td className="fin-income-actions-cell">
                        <div className="fin-income-actions-group">
                          <button
                            type="button"
                            className="fin-income-action-btn secondary"
                            onClick={() => openViewReconModal(p)}
                            title="View reconciliation and payment details"
                          >
                            👁 View
                          </button>
                          <button
                            type="button"
                            className={`fin-income-action-btn ${p.isReconciled ? 'secondary' : ''}`}
                            onClick={() => handleReconcileToggle(p._id, p.isReconciled)}
                          >
                            {p.isReconciled ? 'Unmatch' : 'Match & Reconcile'}
                          </button>
                          <button
                            type="button"
                            className="fin-income-action-btn secondary"
                            onClick={() => {
                              setSelectedItem(p);
                              setReconNoteText('');
                              setActiveModal('reconcileNote');
                            }}
                          >
                            Note
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 13: EXPENSE REPORTS                                   */}
      {/* ========================================================= */}
      {activeSubTab === 'reports' && (
        <div className="fin-table-container">
          {/* Unified Finance Toolbar & Filter Bar */}
          <div className="fin-income-toolbar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Report Type:</label>
              <select
                className="fin-filter-select"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                style={{ fontWeight: 600, minWidth: '200px' }}
              >
                <option value="expenses">Expense Register Report</option>
                <option value="vendor_bills">Vendor Bills & Payables Report</option>
                <option value="payables_aging">Payables Aging Analysis</option>
                <option value="ledger">General Expense Ledger</option>
                <option value="reconciliation">Reconciliation Audit Report</option>
                <option value="vendor_financial_summary">Vendor Financial Summary</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>From:</label>
              <input
                type="date"
                className="fin-filter-select"
                value={reportStartDate}
                onChange={(e) => setReportStartDate(e.target.value)}
              />
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>To:</label>
              <input
                type="date"
                className="fin-filter-select"
                value={reportEndDate}
                onChange={(e) => setReportEndDate(e.target.value)}
              />
              <button
                type="button"
                className="fin-income-action-btn secondary"
                onClick={() => {
                  setReportStartDate('');
                  setReportEndDate('');
                }}
              >
                Clear Dates
              </button>
            </div>

            <div className="fin-income-toolbar-actions" style={{ marginLeft: 'auto' }}>
              <div className="fin-income-search-wrap">
                <span className="fin-income-search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Filter report rows..."
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                  className="fin-income-search-input"
                  style={{ width: '180px' }}
                />
                {reportSearch && (
                  <button
                    type="button"
                    className="fin-income-search-clear"
                    onClick={() => setReportSearch('')}
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="button"
                className="fin-btn-orange"
                onClick={() => {
                  if (!reportData?.data || reportData.data.length === 0) {
                    alert('No data to export');
                    return;
                  }
                  const cols = reportData.columns || Object.keys(reportData.data[0] || {}).map((k) => ({ key: k, label: k }));
                  const rows = [cols.map((c) => `"${c.label}"`).join(',')];
                  reportData.data.forEach((item) => {
                    rows.push(cols.map((c) => `"${item[c.key] !== undefined ? item[c.key] : ''}"`).join(','));
                  });
                  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `expense_report_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Export CSV
              </button>
            </div>
          </div>

          {/* Report Summary Cards */}
          {reportData?.summary && Object.keys(reportData.summary).length > 0 && (
            <div className="fin-compact-kpi-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', margin: '1rem 0' }}>
              {Object.entries(reportData.summary).map(([key, val]) => (
                <div key={key} className="fin-kpi-chip-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                    {typeof val === 'number' && !key.toLowerCase().includes('count') && !key.toLowerCase().includes('total') && !key.toLowerCase().includes('transactions') && !key.toLowerCase().includes('invoices') && !key.toLowerCase().includes('bills') && !key.toLowerCase().includes('expenses')
                      ? formatCurrency(val)
                      : typeof val === 'number' && (key.toLowerCase().includes('amount') || key.toLowerCase().includes('balance') || key.toLowerCase().includes('invoiced') || key.toLowerCase().includes('billed') || key.toLowerCase().includes('paid') || key.toLowerCase().includes('collected') || key.toLowerCase().includes('outstanding'))
                      ? formatCurrency(val)
                      : String(val)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Report Table */}
            <div className="fin-table-responsive">
              <table className="fin-data-table fin-income-table">
                <thead>
                  <tr>
                    {reportData?.columns && reportData.columns.length > 0 ? (
                      <>
                        {reportData.columns.map((col) => (
                          <th key={col.key} className={col.align === 'right' ? 'text-right' : ''}>
                            {col.label.toUpperCase()}
                          </th>
                        ))}
                        <th className="text-center">ACTIONS</th>
                      </>
                    ) : (
                      <>
                        <th>RECORD</th>
                        <th>DESCRIPTION</th>
                        <th className="text-right">AMOUNT (₹)</th>
                        <th>STATUS</th>
                        <th className="text-center">ACTIONS</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {reportLoading ? (
                    <tr>
                      <td colSpan={(reportData?.columns?.length || 4) + 1} className="text-center" style={{ padding: '2rem' }}>
                        Generating live financial report from MongoDB Atlas...
                      </td>
                    </tr>
                  ) : filteredReportData.length === 0 ? (
                    <tr>
                      <td colSpan={(reportData?.columns?.length || 4) + 1} className="text-center" style={{ padding: '2.5rem', color: '#64748b' }}>
                        No report records found for the selected parameters.
                      </td>
                    </tr>
                  ) : (
                    filteredReportData.map((row, idx) => (
                      <tr key={idx}>
                        {reportData?.columns && reportData.columns.length > 0 ? (
                          reportData.columns.map((col) => {
                            const val = row[col.key];
                            const isNumeric = col.align === 'right' || typeof val === 'number' || (typeof val === 'string' && !isNaN(val) && (col.key.toLowerCase().includes('amount') || col.key.toLowerCase().includes('total') || col.key.toLowerCase().includes('paid') || col.key.toLowerCase().includes('balance')));
                            return (
                              <td key={col.key} className={col.align === 'right' ? 'text-right' : ''}>
                                {isNumeric && typeof val === 'number' ? (
                                  <strong>{formatCurrency(val)}</strong>
                                ) : col.key.toLowerCase().includes('date') && val ? (
                                  formatDate(val)
                                ) : col.key.toLowerCase().includes('status') ? (
                                  <span className={`fin-badge ${String(val || '').toLowerCase().replace(/\s+/g, '-')}`}>
                                    {val || '—'}
                                  </span>
                                ) : (
                                  String(val !== undefined && val !== null ? val : '—')
                                )}
                              </td>
                            );
                          })
                        ) : (
                          Object.values(row).map((v, cIdx) => (
                            <td key={cIdx}>{String(v || '—')}</td>
                          ))
                        )}
                        <td className="fin-income-actions-cell">
                          <div className="fin-income-actions-group">
                            <button
                              type="button"
                              className="fin-income-action-btn secondary"
                              onClick={() => openViewReportRowModal(row)}
                              title="View complete record details"
                            >
                              👁 View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD EXPENSE MODAL                                                */}
      {/* ========================================================= */}
      {activeModal === 'addExpense' && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>+ Add Operational Expense</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleAddExpenseSubmit}>
              <div className="fin-modal-body">
                {modalError && <div className="fin-modal-error">{modalError}</div>}
                {modalSuccess && <div className="fin-modal-success">{modalSuccess}</div>}

                <div className="fin-form-grid-2">
                  <div className="fin-form-group col-span-2">
                    <label>Expense Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. AWS Cloud Hosting Services - Oct"
                      value={expenseFormData.title}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, title: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Category *</label>
                    <select
                      value={expenseFormData.category}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, category: e.target.value })}
                    >
                      {categoriesList.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Expense Type *</label>
                    <select
                      value={expenseFormData.categoryType}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, categoryType: e.target.value })}
                    >
                      <option value="Office Expenses">Office Expenses</option>
                      <option value="Project Expenses">Project Expenses</option>
                      <option value="Client Expenses">Client Expenses</option>
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Base Amount (₹)*</label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      value={expenseFormData.amount}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, amount: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Tax / GST (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={expenseFormData.tax}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, tax: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Expense Date *</label>
                    <input
                      type="date"
                      required
                      value={expenseFormData.expenseDate}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, expenseDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Due Date</label>
                    <input
                      type="date"
                      value={expenseFormData.dueDate}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, dueDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Vendor / Payee</label>
                    <select
                      value={expenseFormData.vendor}
                      onChange={(e) => {
                        const vId = e.target.value;
                        const vObj = vendorsList.find((v) => v._id === vId);
                        setExpenseFormData({
                          ...expenseFormData,
                          vendor: vId,
                          vendorName: vObj ? vObj.companyName || vObj.name : '',
                        });
                      }}
                    >
                      <option value="">-- Select Vendor (Optional) --</option>
                      {vendorsList.map((v) => (
                        <option key={v._id} value={v._id}>
                          {v.companyName || v.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(expenseFormData.categoryType === 'Client Expenses' || expenseFormData.categoryType === 'Project Expenses') && (
                    <div className="fin-form-group">
                      <label>Client</label>
                      <select
                        value={expenseFormData.client}
                        onChange={(e) => {
                          const cId = e.target.value;
                          const cObj = clientsList.find((c) => (c._id || c.id) === cId);
                          setExpenseFormData({
                            ...expenseFormData,
                            client: cId,
                            clientName: cObj ? cObj.name || cObj.companyName || cObj.company : '',
                          });
                        }}
                      >
                        <option value="">-- Select Client (Optional) --</option>
                        {clientsList.map((c) => (
                          <option key={c._id || c.id} value={c._id || c.id}>
                            {c.name || c.companyName || c.company}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(expenseFormData.categoryType === 'Client Expenses' || expenseFormData.categoryType === 'Project Expenses') && (
                    <div className="fin-form-group">
                      <label>Project</label>
                      <select
                        value={expenseFormData.project}
                        onChange={(e) => {
                          const pId = e.target.value;
                          const pObj = projectsList.find((p) => (p._id || p.id) === pId);
                          setExpenseFormData({
                            ...expenseFormData,
                            project: pId,
                            projectName: pObj ? pObj.name || pObj.projectName || pObj.title : '',
                          });
                        }}
                      >
                        <option value="">-- Select Project (Optional) --</option>
                        {projectsList.map((p) => (
                          <option key={p._id || p.id} value={p._id || p.id}>
                            {p.name || p.projectName || p.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="fin-form-group">
                    <label>Payment Method</label>
                    <select
                      value={expenseFormData.paymentMethod}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, paymentMethod: e.target.value })}
                    >
                      <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                      <option value="UPI">UPI</option>
                      <option value="Corporate Credit Card">Corporate Credit Card</option>
                      <option value="Debit Card">Debit Card</option>
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Description / Notes</label>
                    <textarea
                      rows="2"
                      placeholder="Provide business justification or invoice reference..."
                      value={expenseFormData.description}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, description: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-orange" disabled={modalLoading}>
                  {modalLoading ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT EXPENSE MODAL                                               */}
      {/* ========================================================= */}
      {activeModal === 'editExpense' && selectedItem && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Edit Expense: {selectedItem.title}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleEditExpenseSubmit}>
              <div className="fin-modal-body">
                {modalError && <div className="fin-modal-error">{modalError}</div>}
                {modalSuccess && <div className="fin-modal-success">{modalSuccess}</div>}

                <div className="fin-form-grid-2">
                  <div className="fin-form-group col-span-2">
                    <label>Expense Title *</label>
                    <input
                      type="text"
                      required
                      value={expenseFormData.title}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, title: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Category *</label>
                    <select
                      value={expenseFormData.category}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, category: e.target.value })}
                    >
                      {categoriesList.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Expense Type</label>
                    <select
                      value={expenseFormData.categoryType}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, categoryType: e.target.value })}
                    >
                      <option value="Office Expenses">Office Expenses</option>
                      <option value="Project Expenses">Project Expenses</option>
                      <option value="Client Expenses">Client Expenses</option>
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Base Amount (₹)*</label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={expenseFormData.amount}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, amount: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Tax / GST (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={expenseFormData.tax}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, tax: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Expense Date *</label>
                    <input
                      type="date"
                      required
                      value={expenseFormData.expenseDate}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, expenseDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Due Date</label>
                    <input
                      type="date"
                      value={expenseFormData.dueDate}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, dueDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Vendor / Payee</label>
                    <select
                      value={expenseFormData.vendor}
                      onChange={(e) => {
                        const vId = e.target.value;
                        const vObj = vendorsList.find((v) => v._id === vId);
                        setExpenseFormData({
                          ...expenseFormData,
                          vendor: vId,
                          vendorName: vObj ? vObj.companyName || vObj.name : '',
                        });
                      }}
                    >
                      <option value="">-- Select Vendor (Optional) --</option>
                      {vendorsList.map((v) => (
                        <option key={v._id} value={v._id}>
                          {v.companyName || v.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(expenseFormData.categoryType === 'Client Expenses' || expenseFormData.categoryType === 'Project Expenses') && (
                    <div className="fin-form-group">
                      <label>Client</label>
                      <select
                        value={expenseFormData.client}
                        onChange={(e) => {
                          const cId = e.target.value;
                          const cObj = clientsList.find((c) => (c._id || c.id) === cId);
                          setExpenseFormData({
                            ...expenseFormData,
                            client: cId,
                            clientName: cObj ? cObj.name || cObj.companyName || cObj.company : '',
                          });
                        }}
                      >
                        <option value="">-- Select Client (Optional) --</option>
                        {clientsList.map((c) => (
                          <option key={c._id || c.id} value={c._id || c.id}>
                            {c.name || c.companyName || c.company}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(expenseFormData.categoryType === 'Client Expenses' || expenseFormData.categoryType === 'Project Expenses') && (
                    <div className="fin-form-group">
                      <label>Project</label>
                      <select
                        value={expenseFormData.project}
                        onChange={(e) => {
                          const pId = e.target.value;
                          const pObj = projectsList.find((p) => (p._id || p.id) === pId);
                          setExpenseFormData({
                            ...expenseFormData,
                            project: pId,
                            projectName: pObj ? pObj.name || pObj.projectName || pObj.title : '',
                          });
                        }}
                      >
                        <option value="">-- Select Project (Optional) --</option>
                        {projectsList.map((p) => (
                          <option key={p._id || p.id} value={p._id || p.id}>
                            {p.name || p.projectName || p.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="fin-form-group col-span-2">
                    <label>Description</label>
                    <textarea
                      rows="2"
                      value={expenseFormData.description}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, description: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-orange" disabled={modalLoading}>
                  {modalLoading ? 'Updating...' : 'Update Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: VIEW EXPENSE DETAILS                                             */}
      {/* ========================================================= */}
      {activeModal === 'viewExpense' && selectedItem && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Expense Details — {selectedItem.title}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <div className="fin-modal-body">
              <div className="fin-form-grid-2" style={{ gap: '0.85rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Expense Title</span>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{selectedItem.title}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Receipt / Ref #</span>
                  <div><code>{selectedItem.receiptNumber || '—'}</code></div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Category</span>
                  <div>{selectedItem.category}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Classification</span>
                  <div>{selectedItem.categoryType}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Amount</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ea580c' }}>
                    {formatCurrency(selectedItem.total || selectedItem.amount)}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Remaining Balance</span>
                  <div style={{ fontWeight: 700, color: Number(selectedItem.balance) > 0 ? '#dc2626' : '#16a34a' }}>
                    {formatCurrency(selectedItem.balance)}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Vendor / Payee</span>
                  <div>{selectedItem.vendorName || selectedItem.employeeName || 'Direct'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Payment Status</span>
                  <div>
                    <span className={`fin-badge ${String(selectedItem.paymentStatus || 'pending').toLowerCase()}`}>
                      {selectedItem.paymentStatus}
                    </span>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Expense Date</span>
                  <div>{formatDate(selectedItem.expenseDate)}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Due Date</span>
                  <div>{formatDate(selectedItem.dueDate)}</div>
                </div>
                {(selectedItem.clientName || selectedItem.client?.name) && (
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Client</span>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>
                      {selectedItem.clientName || selectedItem.client?.name}
                    </div>
                  </div>
                )}
                {(selectedItem.projectName || selectedItem.project?.name) && (
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Project</span>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>
                      {selectedItem.projectName || selectedItem.project?.name}
                    </div>
                  </div>
                )}
                <div className="col-span-2">
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Description / Purpose</span>
                  <div style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '4px', fontSize: '0.825rem' }}>
                    {selectedItem.description || 'No description provided.'}
                  </div>
                </div>
              </div>
            </div>
            <div className="fin-modal-footer">
              <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: RECORD PAYMENT (Partial & Full Disbursal)                         */}
      {/* ========================================================= */}
      {activeModal === 'recordPayment' && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>💳 Record Expense Disbursal</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handlePaymentSubmit}>
              <div className="fin-modal-body">
                {modalError && <div className="fin-modal-error">{modalError}</div>}
                {modalSuccess && <div className="fin-modal-success">{modalSuccess}</div>}

                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Target Payable Type *</label>
                    <select
                      value={paymentFormData.targetType}
                      onChange={(e) => {
                        const t = e.target.value;
                        setPaymentFormData({ ...paymentFormData, targetType: t, targetId: '', amount: '' });
                      }}
                    >
                      <option value="expense">Direct Expense</option>
                      <option value="bill">Vendor Bill</option>
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Select Payable Item *</label>
                    {paymentFormData.targetType === 'bill' ? (
                      <select
                        required
                        value={paymentFormData.targetId}
                        onChange={(e) => {
                          const bId = e.target.value;
                          const bObj = vendorBills.find((b) => b._id === bId);
                          setPaymentFormData({
                            ...paymentFormData,
                            targetId: bId,
                            amount: bObj ? String(bObj.balance) : '',
                            notes: bObj ? `Disbursal for Bill ${bObj.billNumber}` : '',
                          });
                        }}
                      >
                        <option value="">-- Select Vendor Bill --</option>
                        {vendorBills
                          .filter((b) => b.approvalStatus === 'Approved' && b.status !== 'Paid')
                          .map((b) => (
                            <option key={b._id} value={b._id}>
                              {b.billNumber} — {b.vendorName} (Bal: {formatCurrency(b.balance)})
                            </option>
                          ))}
                      </select>
                    ) : (
                      <select
                        required
                        value={paymentFormData.targetId}
                        onChange={(e) => {
                          const eId = e.target.value;
                          const eObj = expenses.find((x) => x._id === eId);
                          const rem = eObj ? (eObj.balance !== undefined ? eObj.balance : eObj.total || eObj.amount) : '';
                          setPaymentFormData({
                            ...paymentFormData,
                            targetId: eId,
                            amount: String(rem),
                            notes: eObj ? `Payment for ${eObj.title}` : '',
                          });
                        }}
                      >
                        <option value="">-- Select Expense --</option>
                        {expenses
                          .filter((x) => x.paymentStatus !== 'Paid')
                          .map((x) => (
                            <option key={x._id} value={x._id}>
                              {x.title} (Bal: {formatCurrency(x.balance !== undefined ? x.balance : x.total || x.amount)})
                            </option>
                          ))}
                      </select>
                    )}
                  </div>

                  <div className="fin-form-group">
                    <label>Disbursal Amount (₹)*</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0.01"
                      value={paymentFormData.amount}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Disbursal Date *</label>
                    <input
                      type="date"
                      required
                      value={paymentFormData.paymentDate}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Source Bank Account *</label>
                    <select
                      required
                      value={paymentFormData.bankAccountId}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, bankAccountId: e.target.value })}
                    >
                      <option value="">-- Select Bank Account --</option>
                      {bankAccountsList.map((acc) => (
                        <option key={acc._id} value={acc._id}>
                          {acc.bankName} - {acc.accountName} (Bal: {formatCurrency(acc.currentBalance)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Payment Method</label>
                    <select
                      value={paymentFormData.paymentMethod}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentMethod: e.target.value })}
                    >
                      <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                      <option value="UPI">UPI</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Corporate Credit Card">Corporate Card</option>
                    </select>
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Transaction Reference (UTR / Txn ID)</label>
                    <input
                      type="text"
                      placeholder="e.g. UTR-AXIS-981203"
                      value={paymentFormData.transactionReference}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, transactionReference: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Notes / Voucher Remarks</label>
                    <textarea
                      rows="2"
                      value={paymentFormData.notes}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-orange" disabled={modalLoading}>
                  {modalLoading ? 'Disbursing...' : 'Disburse & Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: ADD VENDOR BILL                                                  */}
      {/* ========================================================= */}
      {activeModal === 'addBill' && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>+ Record Vendor Bill</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleAddBillSubmit}>
              <div className="fin-modal-body">
                {modalError && <div className="fin-modal-error">{modalError}</div>}
                {modalSuccess && <div className="fin-modal-success">{modalSuccess}</div>}

                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Vendor *</label>
                    <select
                      required
                      value={billFormData.vendor}
                      onChange={(e) => setBillFormData({ ...billFormData, vendor: e.target.value })}
                    >
                      <option value="">-- Select Vendor --</option>
                      {vendorsList.map((v) => (
                        <option key={v._id} value={v._id}>
                          {v.companyName || v.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Bill Number (Invoice #)</label>
                    <input
                      type="text"
                      placeholder="e.g. INV-VEND-1049"
                      value={billFormData.billNumber}
                      onChange={(e) => setBillFormData({ ...billFormData, billNumber: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Bill Date *</label>
                    <input
                      type="date"
                      required
                      value={billFormData.billDate}
                      onChange={(e) => setBillFormData({ ...billFormData, billDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Due Date *</label>
                    <input
                      type="date"
                      required
                      value={billFormData.dueDate}
                      onChange={(e) => setBillFormData({ ...billFormData, dueDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Base Amount (₹)*</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0.01"
                      value={billFormData.amount}
                      onChange={(e) => setBillFormData({ ...billFormData, amount: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Tax / GST (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={billFormData.tax}
                      onChange={(e) => setBillFormData({ ...billFormData, tax: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Description / Item Remarks</label>
                    <textarea
                      rows="2"
                      value={billFormData.description}
                      onChange={(e) => setBillFormData({ ...billFormData, description: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-orange" disabled={modalLoading}>
                  {modalLoading ? 'Saving...' : 'Save Vendor Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: RECURRING EXPENSE PLAN (Create & Edit)                           */}
      {/* ========================================================= */}
      {activeModal === 'recurringPlan' && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>{selectedItem ? 'Edit Recurring Plan' : '+ New Recurring Expense Plan'}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleRecurringPlanSubmit}>
              <div className="fin-modal-body">
                {modalError && <div className="fin-modal-error">{modalError}</div>}
                {modalSuccess && <div className="fin-modal-success">{modalSuccess}</div>}

                <div className="fin-form-grid-2">
                  <div className="fin-form-group col-span-2">
                    <label>Subscription / Expense Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. GitHub Enterprise Cloud Plan"
                      value={planFormData.expenseTitle}
                      onChange={(e) => setPlanFormData({ ...planFormData, expenseTitle: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Billing Frequency *</label>
                    <select
                      value={planFormData.billingFrequency}
                      onChange={(e) => setPlanFormData({ ...planFormData, billingFrequency: e.target.value })}
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Yearly">Yearly</option>
                      <option value="Weekly">Weekly</option>
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Billing Amount (₹)*</label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={planFormData.amount}
                      onChange={(e) => setPlanFormData({ ...planFormData, amount: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Vendor</label>
                    <select
                      value={planFormData.vendor}
                      onChange={(e) => {
                        const vId = e.target.value;
                        const vObj = vendorsList.find((v) => v._id === vId);
                        setPlanFormData({
                          ...planFormData,
                          vendor: vId,
                          vendorName: vObj ? vObj.companyName || vObj.name : '',
                        });
                      }}
                    >
                      <option value="">-- Select Vendor (Optional) --</option>
                      {vendorsList.map((v) => (
                        <option key={v._id} value={v._id}>
                          {v.companyName || v.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Category</label>
                    <select
                      value={planFormData.category}
                      onChange={(e) => setPlanFormData({ ...planFormData, category: e.target.value })}
                    >
                      {categoriesList.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Start Date *</label>
                    <input
                      type="date"
                      required
                      value={planFormData.startDate}
                      onChange={(e) => setPlanFormData({ ...planFormData, startDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Next Due Date *</label>
                    <input
                      type="date"
                      required
                      value={planFormData.nextDueDate}
                      onChange={(e) => setPlanFormData({ ...planFormData, nextDueDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Notes / Terms</label>
                    <textarea
                      rows="2"
                      value={planFormData.notes}
                      onChange={(e) => setPlanFormData({ ...planFormData, notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-orange" disabled={modalLoading}>
                  {modalLoading ? 'Saving...' : 'Save Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: EMPLOYEE REIMBURSEMENT MODAL                                     */}
      {/* ========================================================= */}
      {activeModal === 'reimbursement' && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>+ Submit Employee Reimbursement</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleReimbursementSubmit}>
              <div className="fin-modal-body">
                {modalError && <div className="fin-modal-error">{modalError}</div>}
                {modalSuccess && <div className="fin-modal-success">{modalSuccess}</div>}

                <div className="fin-form-grid-2">
                  <div className="fin-form-group col-span-2">
                    <label>Employee *</label>
                    <select
                      required
                      value={reimbFormData.employeeId}
                      onChange={(e) => setReimbFormData({ ...reimbFormData, employeeId: e.target.value })}
                    >
                      <option value="">-- Select Employee --</option>
                      {employeesList.map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {emp.firstName} {emp.lastName} ({emp.email}) - {emp.department}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Amount (₹)*</label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      value={reimbFormData.amount}
                      onChange={(e) => setReimbFormData({ ...reimbFormData, amount: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Required Date</label>
                    <input
                      type="date"
                      value={reimbFormData.requiredDate}
                      onChange={(e) => setReimbFormData({ ...reimbFormData, requiredDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Expense Reason / Business Justification *</label>
                    <textarea
                      rows="3"
                      required
                      placeholder="e.g. Travel and food allowances for client site deployment..."
                      value={reimbFormData.reason}
                      onChange={(e) => setReimbFormData({ ...reimbFormData, reason: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-orange" disabled={modalLoading}>
                  {modalLoading ? 'Submitting...' : 'Submit Reimbursement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: ADD CATEGORY                                                     */}
      {/* ========================================================= */}
      {activeModal === 'addCategory' && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>+ Add Expense Category</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleAddCategorySubmit}>
              <div className="fin-modal-body">
                <div className="fin-form-group">
                  <label>Category Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Legal & Compliance"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-orange">
                  Add Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 9: RECONCILIATION NOTE                                              */}
      {/* ========================================================= */}
      {activeModal === 'reconcileNote' && selectedItem && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Reconciliation Note: {selectedItem.paymentNumber}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleSaveReconcileNote}>
              <div className="fin-modal-body">
                <div className="fin-form-group">
                  <label>Bank Statement Match Remarks / Notes</label>
                  <textarea
                    rows="4"
                    required
                    placeholder="Document bank statement page, clearance reference, date matched..."
                    value={reconNoteText}
                    onChange={(e) => setReconNoteText(e.target.value)}
                  />
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-orange">
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 10: UNIVERSAL DELETE CONFIRMATION MODAL                             */}
      {/* ========================================================================= */}
      {deleteTarget && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box" style={{ maxWidth: '480px' }}>
            <div className="fin-modal-header" style={{ borderBottom: '1px solid #fee2e2', background: '#fef2f2' }}>
              <h3 style={{ color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <span>🗑</span> Delete this record?
              </h3>
              <button className="fin-modal-close-btn" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <div className="fin-modal-body">
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Selected Record</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
                  {deleteTarget.title}
                </div>
              </div>

              {deleteTarget.isSafe ? (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem', fontSize: '0.875rem', color: '#475569', lineHeight: 1.5 }}>
                  <p style={{ margin: 0, fontWeight: 500 }}>
                    {deleteTarget.warning}
                  </p>
                </div>
              ) : (
                <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '0.85rem', fontSize: '0.875rem', color: '#be123c', lineHeight: 1.5 }}>
                  <strong style={{ display: 'block', marginBottom: '0.25rem' }}>⚠️ Action Restricted by Business Rule</strong>
                  {deleteTarget.warning}
                </div>
              )}
            </div>
            <div className="fin-modal-footer">
              <button
                type="button"
                className="fin-btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
              >
                {deleteTarget.isSafe ? 'Cancel' : 'Close'}
              </button>
              {deleteTarget.isSafe && (
                <button
                  type="button"
                  className="fin-income-action-btn danger"
                  style={{ height: '36px', padding: '0 1.25rem', fontSize: '0.85rem' }}
                  disabled={deleteLoading}
                  onClick={handleConfirmDelete}
                >
                  {deleteLoading ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 11: EDIT VENDOR BILL                                                */}
      {/* ========================================================================= */}
      {activeModal === 'editBill' && selectedItem && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Edit Vendor Bill — #{selectedItem.billNumber || selectedItem._id}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleEditBillSubmit}>
              <div className="fin-modal-body">
                {modalError && <div className="fin-modal-error">{modalError}</div>}
                {modalSuccess && <div className="fin-modal-success">{modalSuccess}</div>}

                <div className="fin-form-grid-2">
                  <div className="fin-form-group col-span-2">
                    <label>Vendor *</label>
                    <select
                      value={billFormData.vendor}
                      required
                      onChange={(e) => setBillFormData({ ...billFormData, vendor: e.target.value })}
                    >
                      <option value="">-- Select Vendor --</option>
                      {vendorsList.map((v) => (
                        <option key={v._id} value={v._id}>
                          {v.companyName || v.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Bill Number *</label>
                    <input
                      type="text"
                      required
                      value={billFormData.billNumber}
                      onChange={(e) => setBillFormData({ ...billFormData, billNumber: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Category *</label>
                    <select
                      value={billFormData.category}
                      onChange={(e) => setBillFormData({ ...billFormData, category: e.target.value })}
                    >
                      {categoriesList.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Bill Date *</label>
                    <input
                      type="date"
                      required
                      value={billFormData.billDate}
                      onChange={(e) => setBillFormData({ ...billFormData, billDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Due Date *</label>
                    <input
                      type="date"
                      required
                      value={billFormData.dueDate}
                      onChange={(e) => setBillFormData({ ...billFormData, dueDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Amount (₹)*</label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={billFormData.amount}
                      onChange={(e) => setBillFormData({ ...billFormData, amount: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Tax Amount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={billFormData.tax}
                      onChange={(e) => setBillFormData({ ...billFormData, tax: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Description / Notes</label>
                    <textarea
                      rows="2"
                      placeholder="Notes, scope of vendor invoice..."
                      value={billFormData.description}
                      onChange={(e) => setBillFormData({ ...billFormData, description: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-orange" disabled={modalLoading}>
                  {modalLoading ? 'Saving...' : 'Update Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 12: VIEW VENDOR BILL                                                */}
      {/* ========================================================================= */}
      {activeModal === 'viewBill' && selectedItem && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Vendor Bill Details — #{selectedItem.billNumber || selectedItem._id}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <div className="fin-modal-body">
              <div className="fin-form-grid-2" style={{ gap: '0.85rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Bill Number</span>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{selectedItem.billNumber}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Vendor Name</span>
                  <div style={{ fontWeight: 600 }}>{selectedItem.vendorName || selectedItem.vendor?.companyName || '—'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Category</span>
                  <div>{selectedItem.category}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Bill Date</span>
                  <div>{formatDate(selectedItem.billDate)}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Due Date</span>
                  <div>{formatDate(selectedItem.dueDate)}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Approval Status</span>
                  <div>
                    <span className={`fin-badge ${String(selectedItem.approvalStatus || 'pending').toLowerCase()}`}>
                      {selectedItem.approvalStatus || 'Pending'}
                    </span>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Billed</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ea580c' }}>
                    {formatCurrency(selectedItem.totalAmount || selectedItem.amount)}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Paid Disbursed</span>
                  <div style={{ fontWeight: 700, color: '#16a34a' }}>
                    {formatCurrency(selectedItem.paidAmount || 0)}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Remaining Balance</span>
                  <div style={{ fontWeight: 700, color: Number(selectedItem.balance) > 0 ? '#dc2626' : '#16a34a' }}>
                    {formatCurrency(selectedItem.balance)}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Payment Status</span>
                  <div>
                    <span className={`fin-badge ${String(selectedItem.status || 'pending').toLowerCase().replace(/\s+/g, '-')}`}>
                      {selectedItem.status || 'Pending'}
                    </span>
                  </div>
                </div>
                <div className="col-span-2">
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Description</span>
                  <div style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '4px', fontSize: '0.825rem' }}>
                    {selectedItem.description || 'No description provided.'}
                  </div>
                </div>
              </div>
            </div>
            <div className="fin-modal-footer">
              <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                Close
              </button>
              {canEditOrDelete && selectedItem.status !== 'Paid' && (
                <button
                  type="button"
                  className="fin-income-action-btn secondary"
                  style={{ height: '36px', padding: '0 1rem' }}
                  onClick={() => openEditBillModal(selectedItem)}
                >
                  ✏ Edit Bill
                </button>
              )}
              {selectedItem.status !== 'Paid' && selectedItem.approvalStatus === 'Approved' && (
                <button
                  type="button"
                  className="fin-btn-orange"
                  onClick={() => openRecordPaymentModal(selectedItem, 'bill')}
                >
                  💳 Pay Bill
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 13: EDIT DEBIT PAYMENT                                              */}
      {/* ========================================================================= */}
      {activeModal === 'editPayment' && selectedItem && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Edit Payment — #{selectedItem.paymentNumber}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleEditPaymentSubmit}>
              <div className="fin-modal-body">
                {modalError && <div className="fin-modal-error">{modalError}</div>}
                {modalSuccess && <div className="fin-modal-success">{modalSuccess}</div>}

                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Payment Method</label>
                    <select
                      value={editPaymentFormData.paymentMethod}
                      onChange={(e) => setEditPaymentFormData({ ...editPaymentFormData, paymentMethod: e.target.value })}
                    >
                      <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                      <option value="UPI">UPI</option>
                      <option value="Corporate Credit Card">Corporate Credit Card</option>
                      <option value="Debit Card">Debit Card</option>
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Transaction Reference (UTR)</label>
                    <input
                      type="text"
                      placeholder="e.g. UTR-1293810293"
                      value={editPaymentFormData.transactionReference}
                      onChange={(e) => setEditPaymentFormData({ ...editPaymentFormData, transactionReference: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Payment Date</label>
                    <input
                      type="date"
                      value={editPaymentFormData.paymentDate}
                      onChange={(e) => setEditPaymentFormData({ ...editPaymentFormData, paymentDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Notes / Remarks</label>
                    <textarea
                      rows="2"
                      placeholder="Disbursal notes..."
                      value={editPaymentFormData.notes}
                      onChange={(e) => setEditPaymentFormData({ ...editPaymentFormData, notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-orange" disabled={modalLoading}>
                  {modalLoading ? 'Saving...' : 'Update Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 14: VIEW DEBIT PAYMENT                                              */}
      {/* ========================================================================= */}
      {activeModal === 'viewPayment' && selectedItem && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Payment Details — #{selectedItem.paymentNumber}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <div className="fin-modal-body">
              <div className="fin-form-grid-2" style={{ gap: '0.85rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Payment Number</span>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{selectedItem.paymentNumber}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Payee / Beneficiary</span>
                  <div style={{ fontWeight: 600 }}>{selectedItem.vendorName || selectedItem.employeeName || 'Company Outflow'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Disbursed Amount</span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#dc2626' }}>
                    - {formatCurrency(selectedItem.amount)}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Payment Date</span>
                  <div>{formatDate(selectedItem.paymentDate)}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Bank Account</span>
                  <div>{selectedItem.bankAccountName || selectedItem.bankAccount?.accountName || 'Primary Bank'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Method</span>
                  <div>{selectedItem.paymentMethod || 'Bank Transfer'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Reference (UTR)</span>
                  <div><code>{selectedItem.transactionReference || '—'}</code></div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Reconciliation</span>
                  <div>
                    <span className={`fin-badge ${selectedItem.isReconciled ? 'paid' : 'pending'}`}>
                      {selectedItem.isReconciled ? '✓ Matched with Bank' : 'Pending Reconciliation'}
                    </span>
                  </div>
                </div>
                {selectedItem.isReconciled && selectedItem.reconciledAt && (
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Reconciled On</span>
                    <div>{formatDate(selectedItem.reconciledAt)}</div>
                  </div>
                )}
                <div className="col-span-2">
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Notes / Remarks</span>
                  <div style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '4px', fontSize: '0.825rem' }}>
                    {selectedItem.notes || 'No remarks recorded.'}
                  </div>
                </div>
              </div>
            </div>
            <div className="fin-modal-footer">
              <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                Close
              </button>
              {canEditOrDelete && (
                <button
                  type="button"
                  className="fin-income-action-btn secondary"
                  style={{ height: '36px', padding: '0 1rem' }}
                  onClick={() => openEditPaymentModal(selectedItem)}
                >
                  ✏ Edit Payment
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 15: VIEW RECURRING PLAN                                             */}
      {/* ========================================================================= */}
      {activeModal === 'viewRecurring' && selectedItem && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Recurring Plan — #{selectedItem.planNumber}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <div className="fin-modal-body">
              <div className="fin-form-grid-2" style={{ gap: '0.85rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Plan Number</span>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{selectedItem.planNumber}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Expense Title</span>
                  <div style={{ fontWeight: 600 }}>{selectedItem.expenseTitle}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Billing Frequency</span>
                  <div style={{ fontWeight: 600, color: '#fb8234' }}>{selectedItem.billingFrequency}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Billing Amount</span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                    {formatCurrency(selectedItem.amount)}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Category</span>
                  <div>{selectedItem.category}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Vendor</span>
                  <div>{selectedItem.vendorName || selectedItem.vendor?.companyName || '—'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Start Date</span>
                  <div>{formatDate(selectedItem.startDate)}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Next Due Date</span>
                  <div style={{ fontWeight: 700, color: selectedItem.nextDueDate && new Date(selectedItem.nextDueDate) < new Date() ? '#ef4444' : '#0f172a' }}>
                    {formatDate(selectedItem.nextDueDate)}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Status</span>
                  <div>
                    <span className={`fin-badge ${String(selectedItem.status || 'Active').toLowerCase()}`}>
                      {selectedItem.status}
                    </span>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Payment Method</span>
                  <div>{selectedItem.paymentMethod || 'Bank Transfer'}</div>
                </div>
                <div className="col-span-2">
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Notes</span>
                  <div style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '4px', fontSize: '0.825rem' }}>
                    {selectedItem.notes || 'No additional schedule notes.'}
                  </div>
                </div>
              </div>
            </div>
            <div className="fin-modal-footer">
              <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                Close
              </button>
              {canEditOrDelete && (
                <button
                  type="button"
                  className="fin-income-action-btn secondary"
                  style={{ height: '36px', padding: '0 1rem' }}
                  onClick={() => openEditRecurringModal(selectedItem)}
                >
                  ✏ Edit Plan
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 16: EDIT REIMBURSEMENT                                              */}
      {/* ========================================================================= */}
      {activeModal === 'editReimbursement' && selectedItem && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Edit Reimbursement — #{selectedItem.requestNumber}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleEditReimbursementSubmit}>
              <div className="fin-modal-body">
                {modalError && <div className="fin-modal-error">{modalError}</div>}
                {modalSuccess && <div className="fin-modal-success">{modalSuccess}</div>}

                <div className="fin-form-grid-2">
                  <div className="fin-form-group col-span-2">
                    <label>Employee *</label>
                    <select
                      value={reimbFormData.employeeId}
                      required
                      onChange={(e) => setReimbFormData({ ...reimbFormData, employeeId: e.target.value })}
                    >
                      <option value="">-- Select Employee --</option>
                      {employeesList.map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {[emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.email} ({emp.department || 'Staff'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Amount (₹)*</label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={reimbFormData.amount}
                      onChange={(e) => setReimbFormData({ ...reimbFormData, amount: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Required Date</label>
                    <input
                      type="date"
                      value={reimbFormData.requiredDate}
                      onChange={(e) => setReimbFormData({ ...reimbFormData, requiredDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Priority</label>
                    <select
                      value={reimbFormData.priority}
                      onChange={(e) => setReimbFormData({ ...reimbFormData, priority: e.target.value })}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Business Justification / Reason *</label>
                    <textarea
                      rows="3"
                      required
                      value={reimbFormData.reason}
                      onChange={(e) => setReimbFormData({ ...reimbFormData, reason: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-orange" disabled={modalLoading}>
                  {modalLoading ? 'Saving...' : 'Update Reimbursement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 17: VIEW REIMBURSEMENT                                              */}
      {/* ========================================================================= */}
      {activeModal === 'viewReimbursement' && selectedItem && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Reimbursement Details — #{selectedItem.requestNumber}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <div className="fin-modal-body">
              <div className="fin-form-grid-2" style={{ gap: '0.85rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Request Number</span>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{selectedItem.requestNumber}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Employee Name</span>
                  <div style={{ fontWeight: 600 }}>{selectedItem.payeeName}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Department</span>
                  <div>{selectedItem.department || 'Operations'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Amount</span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ea580c' }}>
                    {formatCurrency(selectedItem.amount)}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Required Date</span>
                  <div>{formatDate(selectedItem.requiredDate)}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Priority</span>
                  <div>{selectedItem.priority || 'Medium'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Status</span>
                  <div>
                    <span className={`fin-badge ${String(selectedItem.status || 'Submitted').toLowerCase()}`}>
                      {selectedItem.status}
                    </span>
                  </div>
                </div>
                <div className="col-span-2">
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Reason / Business Justification</span>
                  <div style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '4px', fontSize: '0.825rem' }}>
                    {selectedItem.reason || 'No justification provided.'}
                  </div>
                </div>
              </div>
            </div>
            <div className="fin-modal-footer">
              <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                Close
              </button>
              {canEditOrDelete && selectedItem.status !== 'Paid' && (
                <button
                  type="button"
                  className="fin-income-action-btn secondary"
                  style={{ height: '36px', padding: '0 1rem' }}
                  onClick={() => openEditReimbursementModal(selectedItem)}
                >
                  ✏ Edit Request
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 18: EDIT CATEGORY                                                   */}
      {/* ========================================================================= */}
      {activeModal === 'editCategory' && selectedItem && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Rename Category — {selectedItem}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleEditCategorySubmit}>
              <div className="fin-modal-body">
                {modalError && <div className="fin-modal-error">{modalError}</div>}
                {modalSuccess && <div className="fin-modal-success">{modalSuccess}</div>}

                <div className="fin-form-group">
                  <label>Category Name *</label>
                  <input
                    type="text"
                    required
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                  />
                  <small style={{ color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                    Renaming this category will update all existing expenses currently assigned to "{selectedItem}".
                  </small>
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-orange" disabled={modalLoading}>
                  {modalLoading ? 'Saving...' : 'Rename Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 19: VIEW CATEGORY                                                   */}
      {/* ========================================================================= */}
      {activeModal === 'viewCategory' && selectedItem && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Category Details — {selectedItem}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <div className="fin-modal-body">
              {(() => {
                const stat = categoryStats[selectedItem] || { count: 0, total: 0 };
                const totalExp = (overviewData?.kpis?.totalExpenses) || 1;
                const pct = Math.round((stat.total / totalExp) * 100);
                return (
                  <div className="fin-form-grid-2" style={{ gap: '0.85rem' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Category Name</span>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.05rem' }}>{selectedItem}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Recorded Expenses</span>
                      <div style={{ fontWeight: 700 }}>{stat.count} item(s)</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Cumulative Outflow</span>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ea580c' }}>
                        {formatCurrency(stat.total)}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Share of Total Budget</span>
                      <div style={{ fontWeight: 700 }}>{pct}%</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Status</span>
                      <div>
                        <span className="fin-badge paid">Active Master Category</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="fin-modal-footer">
              <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                Close
              </button>
              {canEditOrDelete && (
                <button
                  type="button"
                  className="fin-income-action-btn secondary"
                  style={{ height: '36px', padding: '0 1rem' }}
                  onClick={() => openEditCategoryModal(selectedItem)}
                >
                  ✏ Rename Category
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 20: VIEW GENERAL LEDGER ENTRY                                       */}
      {/* ========================================================================= */}
      {activeModal === 'viewLedger' && selectedItem && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>General Ledger Entry — #{selectedItem.paymentNumber || selectedItem.transactionId || 'Journal'}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <div className="fin-modal-body">
              <div className="fin-form-grid-2" style={{ gap: '0.85rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Posting Date</span>
                  <div style={{ fontWeight: 600 }}>{formatDate(selectedItem.date || selectedItem.paymentDate || selectedItem.createdAt)}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Transaction Reference #</span>
                  <div style={{ fontWeight: 700 }}>{selectedItem.paymentNumber || selectedItem.transactionId || '—'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Account Name</span>
                  <div>{selectedItem.accountName || selectedItem.bankAccount?.accountName || selectedItem.bankAccount?.bankName || 'General Bank'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Category / Account Code</span>
                  <div>{selectedItem.category || 'Operational Expense'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Party / Vendor</span>
                  <div>{selectedItem.party || selectedItem.vendorName || selectedItem.vendor?.companyName || selectedItem.clientName || '—'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Bank Reference / UTR</span>
                  <div><code>{selectedItem.reference || selectedItem.transactionReference || '—'}</code></div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Debit Amount (Outflow)</span>
                  <div style={{ fontWeight: 700, color: Number(selectedItem.debit) > 0 ? '#dc2626' : '#64748b' }}>
                    {Number(selectedItem.debit) > 0 ? formatCurrency(selectedItem.debit) : '—'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Credit Amount (Inflow)</span>
                  <div style={{ fontWeight: 700, color: Number(selectedItem.credit) > 0 ? '#16a34a' : '#64748b' }}>
                    {Number(selectedItem.credit) > 0 ? formatCurrency(selectedItem.credit) : '—'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Running Balance</span>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>
                    {selectedItem.runningBalance !== undefined ? formatCurrency(selectedItem.runningBalance) : '—'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Reconciliation Status</span>
                  <div>
                    <span className={`fin-badge ${selectedItem.isReconciled ? 'paid' : 'pending'}`}>
                      {selectedItem.isReconciled ? 'Reconciled' : 'Unreconciled'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="fin-modal-footer">
              <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 21: VIEW RECONCILIATION DETAILS                                     */}
      {/* ========================================================================= */}
      {activeModal === 'viewRecon' && selectedItem && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Reconciliation Record — #{selectedItem.paymentNumber}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <div className="fin-modal-body">
              <div className="fin-form-grid-2" style={{ gap: '0.85rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Payment Number</span>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{selectedItem.paymentNumber}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Recipient / Payee</span>
                  <div style={{ fontWeight: 600 }}>{selectedItem.vendorName || selectedItem.employeeName || 'Company Outflow'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Disbursed Amount</span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#dc2626' }}>
                    - {formatCurrency(selectedItem.amount)}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Payment Date</span>
                  <div>{formatDate(selectedItem.paymentDate)}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Bank Account</span>
                  <div>{selectedItem.bankAccountName || selectedItem.bankAccount?.accountName || 'Primary Account'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Transaction Reference</span>
                  <div><code>{selectedItem.transactionReference || '—'}</code></div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Statement Matched</span>
                  <div>
                    <span className={`fin-badge ${selectedItem.isReconciled ? 'paid' : 'pending'}`}>
                      {selectedItem.isReconciled ? '✓ Matched & Verified' : 'Pending Verification'}
                    </span>
                  </div>
                </div>
                {selectedItem.isReconciled && selectedItem.reconciledAt && (
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Matched Date</span>
                    <div>{formatDate(selectedItem.reconciledAt)}</div>
                  </div>
                )}
                <div className="col-span-2">
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Reconciliation Remarks / Audit Log</span>
                  <div style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '4px', fontSize: '0.825rem' }}>
                    {selectedItem.notes || 'No reconciliation notes logged yet.'}
                  </div>
                </div>
              </div>
            </div>
            <div className="fin-modal-footer">
              <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                Close
              </button>
              <button
                type="button"
                className={`fin-income-action-btn ${selectedItem.isReconciled ? 'secondary' : ''}`}
                style={{ height: '36px', padding: '0 1rem' }}
                onClick={() => {
                  handleReconcileToggle(selectedItem._id, selectedItem.isReconciled);
                  closeAllModals();
                }}
              >
                {selectedItem.isReconciled ? 'Unmatch' : 'Match & Reconcile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 22: VIEW REPORT ROW DETAILS                                         */}
      {/* ========================================================================= */}
      {activeModal === 'viewReportRow' && selectedItem && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Financial Record Details</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <div className="fin-modal-body">
              <div className="fin-form-grid-2" style={{ gap: '0.85rem' }}>
                {Object.entries(selectedItem).map(([key, val]) => {
                  if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                    val = JSON.stringify(val);
                  }
                  const isAmount = key.toLowerCase().includes('amount') || key.toLowerCase().includes('total') || key.toLowerCase().includes('balance') || key.toLowerCase().includes('paid');
                  const isDate = key.toLowerCase().includes('date') && val;
                  return (
                    <div key={key}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                        {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                      </span>
                      <div style={{ fontWeight: 600, color: isAmount && typeof val === 'number' ? '#ea580c' : '#0f172a' }}>
                        {isAmount && typeof val === 'number'
                          ? formatCurrency(val)
                          : isDate
                          ? formatDate(val)
                          : String(val !== undefined && val !== null ? val : '—')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="fin-modal-footer">
              <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
