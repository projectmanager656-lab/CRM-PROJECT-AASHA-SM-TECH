import React, { useState, useEffect, useMemo, useRef } from 'react';
import apiClient from '../../../../services/apiClient';

export default function IncomeMaster({
  formatCurrency,
  formatDate,
  user,
  onRefresh,
  openModal,
  handleTabChange,
}) {
  // 7 Primary Navigation Tabs
  const [activeSubTab, setActiveSubTab] = useState('overview');

  // Overview state
  const [overviewData, setOverviewData] = useState(null);
  const [overviewPeriod, setOverviewPeriod] = useState('month');
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Register state
  const [transactions, setTransactions] = useState([]);
  const [registerPagination, setRegisterPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [regSearch, setRegSearch] = useState('');
  const [regStatusChip, setRegStatusChip] = useState('All');
  const [regCategory, setRegCategory] = useState('All');
  const [regMethod, setRegMethod] = useState('All');
  const [regClient, setRegClient] = useState('All');
  const [regBank, setRegBank] = useState('All');
  const [regStartDate, setRegStartDate] = useState('');
  const [regEndDate, setRegEndDate] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Invoices & Billing state
  const [invoicesList, setInvoicesList] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invSearch, setInvSearch] = useState('');
  const [invStatusChip, setInvStatusChip] = useState('All');

  // Recurring Income state
  const [recurringPlans, setRecurringPlans] = useState([]);
  const [recurringStats, setRecurringStats] = useState(null);
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [recSearch, setRecSearch] = useState('');
  const [recStatusChip, setRecStatusChip] = useState('All');

  // Reconciliation state
  const [reconSearch, setReconSearch] = useState('');
  const [reconStatusChip, setReconStatusChip] = useState('All');

  // Refunds & Adjustments state
  const [refundSearch, setRefundSearch] = useState('');
  const [refundTypeChip, setRefundTypeChip] = useState('All');

  // Reference Data
  const [clientsList, setClientsList] = useState([]);
  const [bankAccountsList, setBankAccountsList] = useState([]);
  const [incomeSettings, setIncomeSettings] = useState(null);

  // Modals state
  const [activeModal, setActiveModal] = useState(null);
  // 'receivePayment' | 'editIncome' | 'viewIncome' | 'receipt' | 'allocate' | 'recurringPlan' | 'recordRefund' | 'reconcileNote'
  const [selectedItem, setSelectedItem] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // Receive Payment Form State
  const [payFormData, setPayFormData] = useState({
    clientId: '',
    invoiceId: '',
    amount: '',
    incomeCategory: 'Website Development',
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'Bank Transfer',
    transactionReference: '',
    bankAccountId: '',
    notes: '',
    paymentProof: '',
  });
  const [clientInvoices, setClientInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Edit Income Form State
  const [editFormData, setEditFormData] = useState({
    incomeCategory: '',
    paymentDate: '',
    paymentMethod: 'Bank Transfer',
    transactionReference: '',
    bankAccountId: '',
    notes: '',
  });

  // Allocation Modal Form State
  const [allocTargetInvoiceId, setAllocTargetInvoiceId] = useState('');
  const [allocAmount, setAllocAmount] = useState('');
  const [allocInvoices, setAllocInvoices] = useState([]);

  // Recurring Plan Form State
  const [planFormData, setPlanFormData] = useState({
    planName: '',
    clientId: '',
    projectId: '',
    category: 'Website Maintenance / AMC',
    billingFrequency: 'Monthly',
    contractAmount: '',
    startDate: new Date().toISOString().slice(0, 10),
    nextBillingDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    paymentTerms: 'Net 30',
    notes: '',
  });
  const [isEditingPlan, setIsEditingPlan] = useState(false);

  // Refund Form State
  const [refundFormData, setRefundFormData] = useState({
    clientId: '',
    paymentId: '',
    refundAmount: '',
    refundDate: new Date().toISOString().slice(0, 10),
    refundMethod: 'Bank Transfer',
    refundReference: '',
    refundReason: '',
    notes: '',
  });
  const [clientPaymentsForRefund, setClientPaymentsForRefund] = useState([]);
  const [selectedRefundPayment, setSelectedRefundPayment] = useState(null);

  // Reconciliation Note State
  const [reconNoteText, setReconNoteText] = useState('');

  // -------------------------------------------------------------
  // Initial Reference Data Loading (Clients, Bank Accounts, Settings)
  // -------------------------------------------------------------
  const loadReferenceData = () => {
    Promise.all([
      apiClient.get('/finance/clients'),
      apiClient.get('/finance/bank-accounts'),
      apiClient.get('/finance/income/settings'),
    ])
      .then(([cRes, bRes, sRes]) => {
        const cData = cRes.data?.data;
        const clients = Array.isArray(cData?.clients) ? cData.clients : Array.isArray(cData) ? cData : [];
        setClientsList(clients);
        setBankAccountsList(bRes.data?.data || []);
        setIncomeSettings(sRes.data?.data || null);
      })
      .catch((err) => console.error('Failed to load income reference data:', err));
  };

  useEffect(() => {
    loadReferenceData();
  }, []);

  // -------------------------------------------------------------
  // Fetch Overview Data
  // -------------------------------------------------------------
  const fetchOverview = () => {
    setOverviewLoading(true);
    apiClient
      .get(`/finance/income/summary?period=${overviewPeriod}`)
      .then((res) => {
        if (res.data?.data) setOverviewData(res.data.data);
      })
      .catch((err) => console.error('Failed to load income overview:', err))
      .finally(() => setOverviewLoading(false));
  };

  useEffect(() => {
    if (activeSubTab === 'overview') fetchOverview();
  }, [activeSubTab, overviewPeriod]);

  // -------------------------------------------------------------
  // Fetch Register Data
  // -------------------------------------------------------------
  const fetchRegister = () => {
    setRegisterLoading(true);
    const params = new URLSearchParams({
      page: registerPagination.page,
      limit: registerPagination.limit,
      sortBy: 'paymentDate',
      sortOrder: 'desc',
    });

    if (regSearch) params.append('search', regSearch);
    if (regCategory !== 'All') params.append('category', regCategory);
    if (regMethod !== 'All') params.append('paymentMethod', regMethod);
    if (regClient !== 'All') params.append('clientId', regClient);
    if (regBank !== 'All') params.append('bankAccountId', regBank);
    if (regStartDate) params.append('startDate', regStartDate);
    if (regEndDate) params.append('endDate', regEndDate);

    apiClient
      .get(`/finance/income/register?${params.toString()}`)
      .then((res) => {
        if (res.data?.data) {
          setTransactions(res.data.data.transactions || []);
          if (res.data.data.pagination) setRegisterPagination(res.data.data.pagination);
        }
      })
      .catch((err) => console.error('Failed to load register:', err))
      .finally(() => setRegisterLoading(false));
  };

  useEffect(() => {
    if (['register', 'receive', 'reconciliation', 'adjustments'].includes(activeSubTab)) {
      fetchRegister();
    }
  }, [
    activeSubTab,
    registerPagination.page,
    regCategory,
    regMethod,
    regClient,
    regBank,
    regStartDate,
    regEndDate,
  ]);

  // Debounced search for register
  useEffect(() => {
    const timer = setTimeout(() => {
      if (['register', 'reconciliation'].includes(activeSubTab)) {
        fetchRegister();
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [regSearch]);

  // -------------------------------------------------------------
  // Fetch Invoices Data
  // -------------------------------------------------------------
  const fetchInvoices = () => {
    setInvoicesLoading(true);
    apiClient
      .get('/finance/invoices')
      .then((res) => {
        const invs = res.data?.data?.invoices || (Array.isArray(res.data?.data) ? res.data.data : []);
        setInvoicesList(invs);
      })
      .catch((err) => console.error('Failed to load invoices:', err))
      .finally(() => setInvoicesLoading(false));
  };

  useEffect(() => {
    if (activeSubTab === 'invoices' || activeSubTab === 'receive') {
      fetchInvoices();
    }
  }, [activeSubTab]);

  // -------------------------------------------------------------
  // Fetch Recurring Plans
  // -------------------------------------------------------------
  const fetchRecurringPlans = () => {
    setRecurringLoading(true);
    apiClient
      .get('/finance/income/recurring')
      .then((res) => {
        if (res.data?.data) {
          setRecurringPlans(res.data.data.plans || []);
          setRecurringStats(res.data.data.stats || null);
        }
      })
      .catch((err) => console.error('Failed to load recurring plans:', err))
      .finally(() => setRecurringLoading(false));
  };

  useEffect(() => {
    if (activeSubTab === 'recurring') fetchRecurringPlans();
  }, [activeSubTab]);

  // Helper: Refresh all operational datasets
  const refreshAllIncomeData = () => {
    fetchOverview();
    fetchRegister();
    fetchInvoices();
    fetchRecurringPlans();
    if (onRefresh) onRefresh();
  };

  // -------------------------------------------------------------
  // Filtered Lists & Unallocated Payments
  // -------------------------------------------------------------
  const unallocatedPayments = useMemo(() => {
    return transactions.filter(
      (tx) => (Number(tx.unallocatedAmount) || 0) > 0 && tx.status !== 'Cancelled'
    );
  }, [transactions]);

  const filteredRegister = useMemo(() => {
    return transactions.filter((tx) => {
      if (regStatusChip === 'All') return true;
      if (regStatusChip === 'Completed') return tx.status === 'Completed' && !tx.refund?.isRefunded;
      if (regStatusChip === 'Pending') return tx.status === 'Pending';
      if (regStatusChip === 'Unallocated') return (Number(tx.unallocatedAmount) || 0) > 0;
      if (regStatusChip === 'Cancelled') return tx.status === 'Cancelled' || tx.refund?.isRefunded;
      return true;
    });
  }, [transactions, regStatusChip]);

  const filteredInvoices = useMemo(() => {
    return invoicesList.filter((inv) => {
      if (invStatusChip !== 'All') {
        if (invStatusChip === 'Overdue') {
          const isOver = inv.dueDate && new Date(inv.dueDate) < new Date() && (Number(inv.balance) || 0) > 0;
          if (!isOver) return false;
        } else if (inv.status !== invStatusChip) {
          return false;
        }
      }
      if (invSearch) {
        const q = invSearch.toLowerCase();
        return (
          inv.invoiceNumber?.toLowerCase().includes(q) ||
          inv.clientName?.toLowerCase().includes(q) ||
          inv.client?.name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [invoicesList, invStatusChip, invSearch]);

  const filteredRecurring = useMemo(() => {
    return recurringPlans.filter((p) => {
      if (recStatusChip !== 'All' && p.status !== recStatusChip) return false;
      if (recSearch) {
        const q = recSearch.toLowerCase();
        return (
          p.planName?.toLowerCase().includes(q) ||
          p.planNumber?.toLowerCase().includes(q) ||
          p.clientName?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [recurringPlans, recStatusChip, recSearch]);

  const filteredReconciliation = useMemo(() => {
    return transactions.filter((t) => {
      if (reconStatusChip === 'Pending Match') return !t.isReconciled && t.status === 'Completed';
      if (reconStatusChip === 'Reconciled') return t.isReconciled;
      if (reconStatusChip === 'Unallocated') return (Number(t.unallocatedAmount) || 0) > 0;
      if (reconSearch) {
        const q = reconSearch.toLowerCase();
        return (
          t.receiptNumber?.toLowerCase().includes(q) ||
          t.paymentNumber?.toLowerCase().includes(q) ||
          t.clientName?.toLowerCase().includes(q) ||
          t.transactionReference?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [transactions, reconStatusChip, reconSearch]);

  const filteredRefunds = useMemo(() => {
    return transactions.filter((t) => {
      const isRef = t.refund?.isRefunded;
      const isCanc = t.status === 'Cancelled' || t.reversal?.isReversed;
      if (refundTypeChip === 'Refunds') return isRef;
      if (refundTypeChip === 'Cancellations') return isCanc && !isRef;
      if (refundTypeChip === 'All') return isRef || isCanc;
      if (refundSearch) {
        const q = refundSearch.toLowerCase();
        return (
          t.receiptNumber?.toLowerCase().includes(q) ||
          t.clientName?.toLowerCase().includes(q) ||
          t.refund?.refundReason?.toLowerCase().includes(q)
        );
      }
      return isRef || isCanc;
    });
  }, [transactions, refundTypeChip, refundSearch]);

  // -------------------------------------------------------------
  // Modals & Operational Handlers
  // -------------------------------------------------------------
  const closeAllModals = () => {
    setActiveModal(null);
    setSelectedItem(null);
    setModalError('');
    setModalSuccess('');
    setSelectedInvoice(null);
    setSelectedRefundPayment(null);
  };

  // Open Receive Payment / Add Income Modal
  const openReceiveModal = (prefillClientId = '', prefillInvoice = null) => {
    setModalError('');
    setModalSuccess('');
    const defaultBank = bankAccountsList[0]?._id || '';

    setPayFormData({
      clientId: prefillClientId,
      invoiceId: prefillInvoice?._id || '',
      amount: prefillInvoice?.balance ? String(prefillInvoice.balance) : '',
      incomeCategory: 'Website Development',
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'Bank Transfer',
      transactionReference: '',
      bankAccountId: defaultBank,
      notes: prefillInvoice ? `Payment for Invoice ${prefillInvoice.invoiceNumber}` : '',
      paymentProof: '',
    });

    if (prefillClientId) {
      handleClientChange(prefillClientId, prefillInvoice?._id);
    } else {
      setClientInvoices([]);
    }
    setSelectedInvoice(prefillInvoice);
    setActiveModal('receivePayment');
  };

  // When Client changes in Receive Payment form
  const handleClientChange = (clientId, autoSelectInvoiceId = '') => {
    setPayFormData((prev) => ({ ...prev, clientId, invoiceId: autoSelectInvoiceId }));
    setSelectedInvoice(null);
    if (!clientId) {
      setClientInvoices([]);
      return;
    }
    apiClient
      .get(`/finance/invoices?client=${clientId}`)
      .then((res) => {
        const invs = res.data?.data?.invoices || (Array.isArray(res.data?.data) ? res.data.data : []);
        const unpaid = invs.filter((i) => (Number(i.balance) || 0) > 0 && i.status !== 'Cancelled');
        setClientInvoices(unpaid);
        if (autoSelectInvoiceId) {
          const matched = unpaid.find((i) => i._id === autoSelectInvoiceId);
          if (matched) {
            setSelectedInvoice(matched);
            setPayFormData((prev) => ({ ...prev, amount: String(matched.balance) }));
          }
        }
      })
      .catch((err) => console.error('Failed to fetch client invoices:', err));
  };

  // When Invoice changes in Receive Payment form
  const handleInvoiceChange = (invoiceId) => {
    setPayFormData((prev) => ({ ...prev, invoiceId }));
    if (!invoiceId) {
      setSelectedInvoice(null);
      return;
    }
    const inv = clientInvoices.find((i) => i._id === invoiceId);
    if (inv) {
      setSelectedInvoice(inv);
      setPayFormData((prev) => ({
        ...prev,
        amount: String(inv.balance),
        notes: `Payment for Invoice ${inv.invoiceNumber}`,
      }));
    }
  };

  // Submit Receive Payment
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');
    setModalSuccess('');

    try {
      const payload = {
        clientId: payFormData.clientId,
        invoiceId: payFormData.invoiceId || null,
        amount: Number(payFormData.amount),
        incomeCategory: payFormData.incomeCategory,
        paymentDate: payFormData.paymentDate,
        paymentMethod: payFormData.paymentMethod,
        transactionReference: payFormData.transactionReference,
        bankAccountId: payFormData.bankAccountId || null,
        notes: payFormData.notes,
        paymentProof: payFormData.paymentProof,
      };

      const res = await apiClient.post('/finance/income/payments', payload);
      const receiptNum = res.data?.data?.receiptNumber || 'Receipt';
      setModalSuccess(`Payment successfully recorded! Receipt ${receiptNum} generated.`);
      refreshAllIncomeData();

      // Open receipt view after brief pause
      if (res.data?.data?.payment?._id) {
        setTimeout(() => {
          openReceiptModal(res.data.data.payment._id);
        }, 600);
      } else {
        setTimeout(closeAllModals, 1200);
      }
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Failed to record payment');
    } finally {
      setModalLoading(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (tx) => {
    setSelectedItem(tx);
    setModalError('');
    setModalSuccess('');
    setEditFormData({
      incomeCategory: tx.incomeCategory || tx.category || 'Website Development',
      paymentDate: tx.paymentDate ? new Date(tx.paymentDate).toISOString().slice(0, 10) : '',
      paymentMethod: tx.paymentMethod || 'Bank Transfer',
      transactionReference: tx.transactionReference || '',
      bankAccountId: tx.bankAccount?._id || tx.bankAccount || '',
      notes: tx.notes || '',
    });
    setActiveModal('editIncome');
  };

  // Submit Edit Payment
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    setModalLoading(true);
    setModalError('');

    try {
      await apiClient.put(`/finance/income/payments/${selectedItem._id}`, editFormData);
      setModalSuccess('Income record updated successfully');
      refreshAllIncomeData();
      setTimeout(closeAllModals, 800);
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Failed to update income record');
    } finally {
      setModalLoading(false);
    }
  };

  // Open Allocation Modal
  const openAllocationModal = (payment) => {
    setSelectedItem(payment);
    setModalError('');
    setModalSuccess('');
    setAllocAmount(String(payment.unallocatedAmount || payment.amount));
    setAllocTargetInvoiceId('');
    setActiveModal('allocate');

    // Fetch client's eligible invoices
    const clientId = payment.client?._id || payment.client;
    if (clientId) {
      apiClient
        .get(`/finance/invoices?client=${clientId}`)
        .then((res) => {
          const invs = res.data?.data?.invoices || (Array.isArray(res.data?.data) ? res.data.data : []);
          const unpaid = invs.filter((i) => (Number(i.balance) || 0) > 0 && i.status !== 'Cancelled');
          setAllocInvoices(unpaid);
        })
        .catch((err) => console.error('Failed to load invoices for allocation:', err));
    }
  };

  // Submit Allocation
  const handleAllocationSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem || !allocTargetInvoiceId) {
      setModalError('Please select an invoice to allocate this payment to');
      return;
    }
    setModalLoading(true);
    setModalError('');

    try {
      await apiClient.post(`/finance/income/payments/${selectedItem._id}/allocate`, {
        invoiceId: allocTargetInvoiceId,
        amount: Number(allocAmount),
      });
      setModalSuccess('Payment successfully allocated to invoice!');
      refreshAllIncomeData();
      setTimeout(closeAllModals, 800);
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Allocation failed');
    } finally {
      setModalLoading(false);
    }
  };

  // Open Branded Receipt Modal
  const openReceiptModal = async (paymentId) => {
    setModalLoading(true);
    setActiveModal('receipt');
    setReceiptData(null);
    try {
      const res = await apiClient.get(`/finance/income/receipts/${paymentId}`);
      if (res.data?.data) setReceiptData(res.data.data);
    } catch (err) {
      console.error('Failed to load receipt:', err);
    } finally {
      setModalLoading(false);
    }
  };

  // Reconcile Toggle
  const handleReconcileToggle = async (paymentId, currentIsReconciled) => {
    try {
      await apiClient.post(`/finance/income/payments/${paymentId}/reconcile`, {
        isReconciled: !currentIsReconciled,
      });
      fetchRegister();
      fetchOverview();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update reconciliation state');
    }
  };

  // Reconcile Note Modal
  const openReconcileNoteModal = (payment) => {
    setSelectedItem(payment);
    setReconNoteText(payment.notes || '');
    setActiveModal('reconcileNote');
  };

  const handleSaveReconcileNote = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    try {
      await apiClient.post(`/finance/income/payments/${selectedItem._id}/reconcile`, {
        isReconciled: selectedItem.isReconciled,
        notes: reconNoteText,
      });
      fetchRegister();
      closeAllModals();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save reconciliation note');
    }
  };

  // Open Record Refund Modal
  const openRefundModal = (tx = null) => {
    setModalError('');
    setModalSuccess('');
    if (tx) {
      setSelectedItem(tx);
      setSelectedRefundPayment(tx);
      setRefundFormData({
        clientId: tx.client?._id || tx.client || '',
        paymentId: tx._id,
        refundAmount: String(tx.amount - (tx.refund?.refundAmount || 0)),
        refundDate: new Date().toISOString().slice(0, 10),
        refundMethod: tx.paymentMethod || 'Bank Transfer',
        refundReference: '',
        refundReason: '',
        notes: '',
      });
    } else {
      setSelectedItem(null);
      setSelectedRefundPayment(null);
      setRefundFormData({
        clientId: '',
        paymentId: '',
        refundAmount: '',
        refundDate: new Date().toISOString().slice(0, 10),
        refundMethod: 'Bank Transfer',
        refundReference: '',
        refundReason: '',
        notes: '',
      });
      setClientPaymentsForRefund([]);
    }
    setActiveModal('recordRefund');
  };

  // When Client changes in Refund Modal
  const handleRefundClientChange = (cId) => {
    setRefundFormData((prev) => ({ ...prev, clientId: cId, paymentId: '', refundAmount: '' }));
    setSelectedRefundPayment(null);
    if (!cId) {
      setClientPaymentsForRefund([]);
      return;
    }
    apiClient
      .get(`/finance/income/register?clientId=${cId}&status=Completed`)
      .then((res) => {
        const txs = res.data?.data?.transactions || [];
        setClientPaymentsForRefund(txs.filter((t) => t.status === 'Completed'));
      })
      .catch((err) => console.error('Failed to load client payments for refund:', err));
  };

  // When Payment changes in Refund Modal
  const handleRefundPaymentChange = (pId) => {
    setRefundFormData((prev) => ({ ...prev, paymentId: pId }));
    const p = clientPaymentsForRefund.find((t) => t._id === pId);
    if (p) {
      setSelectedRefundPayment(p);
      const rem = Math.max(0, p.amount - (p.refund?.refundAmount || 0));
      setRefundFormData((prev) => ({ ...prev, refundAmount: String(rem) }));
    }
  };

  // Submit Refund
  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    if (!refundFormData.paymentId) {
      setModalError('Please select a payment record to refund');
      return;
    }
    setModalLoading(true);
    setModalError('');

    try {
      await apiClient.post(`/finance/income/payments/${refundFormData.paymentId}/refund`, {
        refundAmount: Number(refundFormData.refundAmount),
        refundReason: refundFormData.refundReason,
        refundReference: refundFormData.refundReference,
      });
      setModalSuccess('Refund processed successfully! Invoices & bank account adjusted.');
      refreshAllIncomeData();
      setTimeout(closeAllModals, 900);
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Refund processing failed');
    } finally {
      setModalLoading(false);
    }
  };

  // Cancel / Reverse Payment
  const handleCancelPayment = async (tx) => {
    const reason = window.prompt(
      `Confirm cancellation of Payment #${tx.receiptNumber || tx.paymentNumber} (₹${tx.amount}). Enter cancellation reason:`
    );
    if (!reason) return;

    try {
      await apiClient.post(`/finance/income/payments/${tx._id}/cancel`, { reason });
      alert('Payment cancelled and reversed successfully.');
      refreshAllIncomeData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel payment');
    }
  };

  // Open Recurring Plan Modal
  const openRecurringPlanModal = (plan = null) => {
    setModalError('');
    setModalSuccess('');
    if (plan) {
      setIsEditingPlan(true);
      setSelectedItem(plan);
      setPlanFormData({
        planName: plan.planName || '',
        clientId: plan.client?._id || plan.client || '',
        projectId: plan.project?._id || plan.project || '',
        category: plan.category || 'Website Maintenance / AMC',
        billingFrequency: plan.billingFrequency || 'Monthly',
        contractAmount: String(plan.contractAmount || ''),
        startDate: plan.startDate ? new Date(plan.startDate).toISOString().slice(0, 10) : '',
        nextBillingDate: plan.nextBillingDate ? new Date(plan.nextBillingDate).toISOString().slice(0, 10) : '',
        endDate: plan.endDate ? new Date(plan.endDate).toISOString().slice(0, 10) : '',
        paymentTerms: plan.paymentTerms || 'Net 30',
        notes: plan.notes || '',
      });
    } else {
      setIsEditingPlan(false);
      setSelectedItem(null);
      setPlanFormData({
        planName: '',
        clientId: '',
        projectId: '',
        category: 'Website Maintenance / AMC',
        billingFrequency: 'Monthly',
        contractAmount: '',
        startDate: new Date().toISOString().slice(0, 10),
        nextBillingDate: new Date().toISOString().slice(0, 10),
        endDate: '',
        paymentTerms: 'Net 30',
        notes: '',
      });
    }
    setActiveModal('recurringPlan');
  };

  // Submit Recurring Plan (Create or Edit)
  const handleRecurringPlanSubmit = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');

    try {
      if (isEditingPlan && selectedItem) {
        await apiClient.put(`/finance/income/recurring/${selectedItem._id}`, planFormData);
        setModalSuccess('Recurring plan updated successfully');
      } else {
        await apiClient.post('/finance/income/recurring', planFormData);
        setModalSuccess('New recurring plan created successfully');
      }
      fetchRecurringPlans();
      setTimeout(closeAllModals, 800);
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Failed to save recurring plan');
    } finally {
      setModalLoading(false);
    }
  };

  // Toggle Plan Status (Pause/Resume/Cancel)
  const handleTogglePlanStatus = async (planId, currentStatus) => {
    const nextStatus = currentStatus === 'Active' ? 'Paused' : 'Active';
    try {
      await apiClient.patch(`/finance/income/recurring/${planId}/status`, { status: nextStatus });
      fetchRecurringPlans();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle plan status');
    }
  };

  // Generate Invoice from Plan
  const handleGeneratePlanInvoice = async (planId) => {
    if (!window.confirm('Generate official invoice for this billing cycle now?')) return;
    try {
      const res = await apiClient.post(`/finance/income/recurring/${planId}/generate-invoice`);
      alert(`Invoice ${res.data?.data?.invoice?.invoiceNumber || ''} created successfully!`);
      fetchRecurringPlans();
      fetchInvoices();
      fetchOverview();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate recurring invoice');
    }
  };

  // Issue Draft Invoice
  const handleIssueInvoice = async (invoiceId) => {
    try {
      await apiClient.post(`/finance/invoices/${invoiceId}/issue`);
      fetchInvoices();
      fetchOverview();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to issue invoice');
    }
  };

  // Export CSV of Current Tab
  const handleExportCurrentView = () => {
    let rows = [];
    let filename = `income_${activeSubTab}_${new Date().toISOString().slice(0, 10)}.csv`;

    if (activeSubTab === 'register' || activeSubTab === 'overview' || activeSubTab === 'reconciliation') {
      const headers = ['Receipt #', 'Payment ID', 'Client', 'Category', 'Amount', 'Date', 'Method', 'UTR', 'Status', 'Reconciled'];
      rows.push(headers.join(','));
      transactions.forEach((t) => {
        rows.push([
          `"${t.receiptNumber || ''}"`,
          `"${t.paymentNumber || ''}"`,
          `"${t.clientName || ''}"`,
          `"${t.incomeCategory || t.category || ''}"`,
          t.amount || 0,
          `"${t.paymentDate ? new Date(t.paymentDate).toLocaleDateString() : ''}"`,
          `"${t.paymentMethod || ''}"`,
          `"${t.transactionReference || ''}"`,
          `"${t.status || ''}"`,
          `"${t.isReconciled ? 'Yes' : 'No'}"`,
        ].join(','));
      });
    } else if (activeSubTab === 'invoices') {
      const headers = ['Invoice #', 'Client', 'Issue Date', 'Due Date', 'Total', 'Paid', 'Balance', 'Status'];
      rows.push(headers.join(','));
      invoicesList.forEach((inv) => {
        rows.push([
          `"${inv.invoiceNumber || ''}"`,
          `"${inv.clientName || inv.client?.name || ''}"`,
          `"${inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : ''}"`,
          `"${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : ''}"`,
          inv.total || 0,
          inv.paidAmount || 0,
          inv.balance || 0,
          `"${inv.status || ''}"`,
        ].join(','));
      });
    } else if (activeSubTab === 'recurring') {
      const headers = ['Plan #', 'Plan Name', 'Client', 'Frequency', 'Amount', 'Start Date', 'Next Billing', 'Status', 'Total Invoiced'];
      rows.push(headers.join(','));
      recurringPlans.forEach((p) => {
        rows.push([
          `"${p.planNumber || ''}"`,
          `"${p.planName || ''}"`,
          `"${p.clientName || ''}"`,
          `"${p.billingFrequency || ''}"`,
          p.contractAmount || 0,
          `"${p.startDate ? new Date(p.startDate).toLocaleDateString() : ''}"`,
          `"${p.nextBillingDate ? new Date(p.nextBillingDate).toLocaleDateString() : ''}"`,
          `"${p.status || ''}"`,
          p.totalInvoicedAmount || 0,
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

  const kpis = overviewData?.kpis || {};
  const op = overviewData?.operational || {};
  const charts = overviewData?.charts || {};

  return (
    <div className="fin-income-master">
      {/* ========================================================= */}
      {/* 1. PAGE HEADER                                            */}
      {/* ========================================================= */}
      <div className="fin-income-header-block fin-no-print">
        <div className="fin-income-title-group">
          <h2 className="fin-income-page-title">Income Management</h2>
          <p className="fin-income-page-subtitle">
            Manage the complete company income lifecycle.
          </p>
        </div>
        <div className="fin-income-header-actions">
          <button
            type="button"
            className="fin-btn-orange"
            onClick={() => openReceiveModal()}
            title="Record direct or invoice income"
          >
            + Add Income
          </button>
          <button
            type="button"
            className="fin-btn-orange"
            onClick={() => setActiveSubTab('receive')}
            title="Open Receive Payment & Allocation workspace"
          >
            Receive Payment
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
      {/* 2. MAIN NAVIGATION TABS (7 Operations)                    */}
      {/* ========================================================= */}
      <div className="fin-income-tabs-bar fin-no-print">
        {[
          { id: 'overview', label: 'Overview', icon: '📊' },
          { id: 'register', label: 'Income Register', icon: '📋', count: registerPagination.total },
          { id: 'invoices', label: 'Invoices & Billing', icon: '📄', count: invoicesList.length },
          {
            id: 'receive',
            label: 'Receive Payment',
            icon: '💳',
            badge: unallocatedPayments.length > 0 ? `${unallocatedPayments.length} Unallocated` : null,
          },
          { id: 'recurring', label: 'Recurring Income', icon: '🔄', count: recurringStats?.activePlansCount },
          { id: 'adjustments', label: 'Refunds & Adjustments', icon: '⚖️', count: op.refundsCount },
          {
            id: 'reconciliation',
            label: 'Reconciliation',
            icon: '🏦',
            badge: op.reconciliationPendingCount > 0 ? `${op.reconciliationPendingCount} Pending` : null,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`fin-income-tab-btn ${activeSubTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveSubTab(tab.id)}
          >
            <span className="fin-tab-icon">{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count !== undefined && <span className="fin-tab-count">{tab.count}</span>}
            {tab.badge && <span className="fin-tab-badge-orange">{tab.badge}</span>}
          </button>
        ))}
      </div>

      {/* ========================================================= */}
      {/* TAB 1: OVERVIEW & FINANCIAL ANALYTICS                     */}
      {/* ========================================================= */}
      {activeSubTab === 'overview' && (
        <div className="fin-income-overview-wrap">
          {/* Period Selector Bar */}
          <div className="fin-overview-controls-bar">
            <div className="fin-overview-title-box">
              <h3 className="fin-income-heading">Income Overview & Financial Performance</h3>
              <p className="fin-income-subtext">Real-time revenue metrics synchronized with MongoDB Atlas</p>
            </div>
            <div className="fin-period-group">
              {[
                { key: 'today', label: 'Today' },
                { key: 'week', label: 'This Week' },
                { key: 'month', label: 'This Month' },
                { key: 'quarter', label: 'Quarter' },
                { key: 'year', label: 'Financial Year' },
                { key: 'all', label: 'All Time' },
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={`fin-period-btn ${overviewPeriod === p.key ? 'active' : ''}`}
                  onClick={() => setOverviewPeriod(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {overviewLoading ? (
            <div className="fin-loading-box">Calculating live revenue balances from Atlas...</div>
          ) : (
            <>
              {/* 6 Primary KPI Cards */}
              <div className="fin-kpi-grid-6 fin-income-kpis">
                {/* 1. Total Income */}
                <div className="fin-kpi-card">
                  <div className="fin-kpi-top">
                    <span className="fin-kpi-label">Total Income</span>
                    <div className="fin-kpi-icon-wrap income">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                    </div>
                  </div>
                  <div className="fin-kpi-value text-success">{formatCurrency(kpis.totalIncome)}</div>
                  <div className="fin-kpi-footer">Net received in period</div>
                </div>

                {/* 2. Income This Month */}
                <div className="fin-kpi-card">
                  <div className="fin-kpi-top">
                    <span className="fin-kpi-label">Income This Month</span>
                    <div className="fin-kpi-icon-wrap bank">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                  </div>
                  <div className="fin-kpi-value">{formatCurrency(kpis.incomeThisMonth)}</div>
                  <div className="fin-kpi-footer">Current calendar month collections</div>
                </div>

                {/* 3. Total Invoiced */}
                <div className="fin-kpi-card">
                  <div className="fin-kpi-top">
                    <span className="fin-kpi-label">Total Invoiced</span>
                    <div className="fin-kpi-icon-wrap cashflow">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                  </div>
                  <div className="fin-kpi-value">{formatCurrency(kpis.totalInvoiced)}</div>
                  <div className="fin-kpi-footer">Billed invoices in period</div>
                </div>

                {/* 4. Outstanding Receivables */}
                <div className="fin-kpi-card">
                  <div className="fin-kpi-top">
                    <span className="fin-kpi-label">Outstanding Receivables</span>
                    <div className="fin-kpi-icon-wrap receivable">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                  </div>
                  <div className="fin-kpi-value text-warning">{formatCurrency(kpis.outstandingReceivables)}</div>
                  <div className="fin-kpi-footer">Collectible invoice balances</div>
                </div>

                {/* 5. Overdue Income */}
                <div className="fin-kpi-card">
                  <div className="fin-kpi-top">
                    <span className="fin-kpi-label">Overdue Income</span>
                    <div className="fin-kpi-icon-wrap expense">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>
                  </div>
                  <div className="fin-kpi-value text-danger">{formatCurrency(kpis.overdueIncome)}</div>
                  <div className="fin-kpi-footer">{op.overdueInvoicesCount || 0} invoices past due date</div>
                </div>

                {/* 6. Pending Income */}
                <div className="fin-kpi-card">
                  <div className="fin-kpi-top">
                    <span className="fin-kpi-label">Pending Income</span>
                    <div className="fin-kpi-icon-wrap payable">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                  </div>
                  <div className="fin-kpi-value">{formatCurrency(kpis.pendingIncome)}</div>
                  <div className="fin-kpi-footer">Uncollected balance in period</div>
                </div>
              </div>

              {/* Secondary Operational Metrics Bar */}
              <div className="fin-secondary-metrics-row">
                <div
                  className="fin-metric-chip"
                  onClick={() => setActiveSubTab('register')}
                  style={{ cursor: 'pointer' }}
                  title="View completed payments in Register"
                >
                  <span className="fin-metric-chip-label">Payments Received</span>
                  <span className="fin-metric-chip-val">{op.paymentsReceivedCount || 0} ({formatCurrency(op.paymentsReceivedSum)})</span>
                </div>
                <div
                  className="fin-metric-chip"
                  onClick={() => setActiveSubTab('receive')}
                  style={{ cursor: 'pointer' }}
                  title="Click to view & allocate unallocated payments"
                >
                  <span className="fin-metric-chip-label">Pending Allocation</span>
                  <span className="fin-metric-chip-val orange">{op.pendingAllocationCount || 0} ({formatCurrency(op.pendingAllocationSum)})</span>
                </div>
                <div
                  className="fin-metric-chip"
                  onClick={() => {
                    setInvStatusChip('Partially Paid');
                    setActiveSubTab('invoices');
                  }}
                  style={{ cursor: 'pointer' }}
                  title="View partially paid invoices"
                >
                  <span className="fin-metric-chip-label">Partially Paid Invoices</span>
                  <span className="fin-metric-chip-val">{op.partiallyPaidInvoicesCount || 0}</span>
                </div>
                <div className="fin-metric-chip">
                  <span className="fin-metric-chip-label">Upcoming Due (7 Days)</span>
                  <span className="fin-metric-chip-val">{op.upcomingDueInvoicesCount || 0}</span>
                </div>
                <div
                  className="fin-metric-chip"
                  onClick={() => setActiveSubTab('recurring')}
                  style={{ cursor: 'pointer' }}
                  title="View recurring billing schedules"
                >
                  <span className="fin-metric-chip-label">Recurring Billing Due</span>
                  <span className="fin-metric-chip-val blue">{op.recurringBillingDueCount || 0} ({formatCurrency(op.recurringBillingDueSum)})</span>
                </div>
                <div
                  className="fin-metric-chip"
                  onClick={() => setActiveSubTab('adjustments')}
                  style={{ cursor: 'pointer' }}
                  title="View refunds and reversals"
                >
                  <span className="fin-metric-chip-label">Refunds Processed</span>
                  <span className="fin-metric-chip-val red">{op.refundsCount || 0} ({formatCurrency(op.refundsSum)})</span>
                </div>
                <div
                  className="fin-metric-chip"
                  onClick={() => setActiveSubTab('reconciliation')}
                  style={{ cursor: 'pointer' }}
                  title="Match transactions with bank statements"
                >
                  <span className="fin-metric-chip-label">Reconciliation Pending</span>
                  <span className="fin-metric-chip-val yellow">{op.reconciliationPendingCount || 0}</span>
                </div>
              </div>

              {/* 6 Real-Data Analytics Cards */}
              <div className="fin-charts-grid-3x2">
                {/* 1. Monthly Income Trend */}
                <div className="fin-chart-box">
                  <div className="fin-chart-header">
                    <h3>Monthly Income Trend (12 Months)</h3>
                    <span className="fin-chart-badge">Received vs Invoiced</span>
                  </div>
                  {(!charts.monthlyTrends || charts.monthlyTrends.every((t) => t.received === 0 && t.invoiced === 0)) ? (
                    <div className="fin-empty-chart">No monthly trends recorded in the current period.</div>
                  ) : (
                    <div className="fin-bar-trend-container">
                      {charts.monthlyTrends.map((t, idx) => {
                        const maxVal = Math.max(...charts.monthlyTrends.map((x) => Math.max(x.received, x.invoiced)), 1);
                        const recHeight = Math.round((t.received / maxVal) * 90);
                        const invHeight = Math.round((t.invoiced / maxVal) * 90);
                        return (
                          <div className="fin-trend-col" key={idx} title={`${t.month}: Received ${formatCurrency(t.received)}, Invoiced ${formatCurrency(t.invoiced)}`}>
                            <div className="fin-trend-bars">
                              <div className="fin-trend-bar rec" style={{ height: `${Math.max(recHeight, 4)}px` }} />
                              <div className="fin-trend-bar inv" style={{ height: `${Math.max(invHeight, 4)}px` }} />
                            </div>
                            <span className="fin-trend-label">{t.month}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="fin-chart-legend">
                    <span><span className="dot rec" /> Collections Received</span>
                    <span><span className="dot inv" /> Total Invoiced</span>
                  </div>
                </div>

                {/* 2. Income by Category */}
                <div className="fin-chart-box">
                  <div className="fin-chart-header">
                    <h3>Income by Service / Category</h3>
                    <span className="fin-chart-badge">Revenue Share</span>
                  </div>
                  {(!charts.categoryBreakdown || charts.categoryBreakdown.length === 0) ? (
                    <div className="fin-empty-chart">No category collections recorded yet.</div>
                  ) : (
                    <div className="fin-cat-breakdown-list">
                      {charts.categoryBreakdown.slice(0, 5).map((cat, idx) => (
                        <div className="fin-cat-row" key={idx}>
                          <div className="fin-cat-info">
                            <span className="fin-cat-name">{cat.category}</span>
                            <span className="fin-cat-amt">{formatCurrency(cat.amount)} ({cat.percentage}%)</span>
                          </div>
                          <div className="fin-cat-progress-bg">
                            <div className="fin-cat-progress-fill" style={{ width: `${Math.max(cat.percentage, 4)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Top Clients by Revenue */}
                <div className="fin-chart-box">
                  <div className="fin-chart-header">
                    <h3>Top Clients by Income</h3>
                    <span className="fin-chart-badge">Revenue Distribution</span>
                  </div>
                  {(!charts.clientBreakdown || charts.clientBreakdown.length === 0) ? (
                    <div className="fin-empty-chart">No client payment records found.</div>
                  ) : (
                    <div className="fin-client-breakdown-list">
                      {charts.clientBreakdown.slice(0, 5).map((cl, idx) => (
                        <div className="fin-client-row" key={idx}>
                          <span className="fin-client-rank">#{idx + 1}</span>
                          <span className="fin-client-name" title={cl.clientName}>{cl.clientName}</span>
                          <div className="fin-client-bar-wrap">
                            <div className="fin-client-bar" style={{ width: `${Math.max(cl.percentage, 5)}%` }} />
                          </div>
                          <span className="fin-client-amt">{formatCurrency(cl.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Received vs Outstanding Analysis */}
                <div className="fin-chart-box">
                  <div className="fin-chart-header">
                    <h3>Received vs Outstanding</h3>
                    <span className="fin-chart-badge">Asset Quality</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '0.5rem 0' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                        <span>Total Collections Received</span>
                        <strong className="text-success">{formatCurrency(charts.receivedVsOutstanding?.totalReceived || 0)}</strong>
                      </div>
                      <div className="fin-cat-progress-bg">
                        <div className="fin-cat-progress-fill" style={{ width: '100%', background: '#10b981' }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                        <span>Outstanding Invoices Balance</span>
                        <strong className="text-warning">{formatCurrency(charts.receivedVsOutstanding?.outstandingReceivables || 0)}</strong>
                      </div>
                      <div className="fin-cat-progress-bg">
                        <div className="fin-cat-progress-fill" style={{ width: '65%', background: '#f59e0b' }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                        <span>Overdue Receivables (Action Required)</span>
                        <strong className="text-danger">{formatCurrency(charts.receivedVsOutstanding?.overdueReceivables || 0)}</strong>
                      </div>
                      <div className="fin-cat-progress-bg">
                        <div className="fin-cat-progress-fill" style={{ width: '35%', background: '#dc2626' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Payment Methods Distribution */}
                <div className="fin-chart-box">
                  <div className="fin-chart-header">
                    <h3>Payment Methods</h3>
                    <span className="fin-chart-badge">Channel Share</span>
                  </div>
                  {(!charts.paymentMethodBreakdown || charts.paymentMethodBreakdown.length === 0) ? (
                    <div className="fin-empty-chart">No payment methods recorded.</div>
                  ) : (
                    <div className="fin-cat-breakdown-list">
                      {charts.paymentMethodBreakdown.map((pm, idx) => (
                        <div className="fin-cat-row" key={idx}>
                          <div className="fin-cat-info">
                            <span className="fin-cat-name">{pm.method}</span>
                            <span className="fin-cat-amt">{formatCurrency(pm.amount)} ({pm.percentage}%)</span>
                          </div>
                          <div className="fin-cat-progress-bg">
                            <div className="fin-cat-progress-fill" style={{ width: `${Math.max(pm.percentage, 5)}%`, background: '#3b82f6' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 6. Quick Operation Center */}
                <div className="fin-chart-box">
                  <div className="fin-chart-header">
                    <h3>Quick Action Center</h3>
                    <span className="fin-chart-badge">Operations</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      className="fin-btn-orange"
                      style={{ width: '100%', justifyContent: 'flex-start' }}
                      onClick={() => openReceiveModal()}
                    >
                      💳 + Record New Client Payment
                    </button>
                    <button
                      type="button"
                      className="fin-income-action-btn secondary"
                      style={{ width: '100%', height: '34px', justifyContent: 'flex-start' }}
                      onClick={() => setActiveSubTab('receive')}
                    >
                      ⇄ Manage Unallocated Payments ({unallocatedPayments.length})
                    </button>
                    <button
                      type="button"
                      className="fin-income-action-btn secondary"
                      style={{ width: '100%', height: '34px', justifyContent: 'flex-start' }}
                      onClick={() => openRecurringPlanModal()}
                    >
                      🔄 + New Recurring Billing Plan
                    </button>
                    <button
                      type="button"
                      className="fin-income-action-btn secondary"
                      style={{ width: '100%', height: '34px', justifyContent: 'flex-start' }}
                      onClick={() => openRefundModal()}
                    >
                      ↩ Record Refund / Credit Adjustment
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: INCOME REGISTER                                   */}
      {/* ========================================================= */}
      {activeSubTab === 'register' && (
        <div className="fin-income-register-wrap">
          {/* Unified Search + Filter Toolbar */}
          <div className="fin-income-toolbar">
            <div className="fin-income-search-wrap">
              <span className="fin-income-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search Receipt, Client, UTR..."
                className="fin-income-search-input"
                value={regSearch}
                onChange={(e) => setRegSearch(e.target.value)}
              />
              {regSearch && (
                <button type="button" className="fin-income-search-clear" onClick={() => setRegSearch('')}>
                  ×
                </button>
              )}
            </div>

            {/* Status Filter Chips */}
            <div className="fin-income-filter-chips">
              {[
                { key: 'All', label: 'All Transactions', count: transactions.length },
                { key: 'Completed', label: 'Completed', count: transactions.filter((t) => t.status === 'Completed' && !t.refund?.isRefunded).length },
                { key: 'Pending', label: 'Pending', count: transactions.filter((t) => t.status === 'Pending').length },
                { key: 'Unallocated', label: 'Unallocated', count: unallocatedPayments.length },
                { key: 'Cancelled', label: 'Refunded / Cancelled', count: transactions.filter((t) => t.status === 'Cancelled' || t.refund?.isRefunded).length },
              ].map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className={`fin-income-filter-chip ${regStatusChip === chip.key ? 'active' : ''}`}
                  onClick={() => setRegStatusChip(chip.key)}
                >
                  <span>{chip.label}</span>
                  <span className="fin-income-chip-count">{chip.count}</span>
                </button>
              ))}
            </div>

            {/* Filter Toggle & Primary Action Buttons */}
            <div className="fin-income-toolbar-actions">
              <button
                type="button"
                className="fin-income-action-btn secondary"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                title="Toggle detailed filters"
              >
                ⚡ Filters {showAdvancedFilters ? '▲' : '▼'}
              </button>
              <button
                type="button"
                className="fin-btn-orange"
                onClick={() => openReceiveModal()}
              >
                + Add Income
              </button>
            </div>
          </div>

          {/* Advanced Collapsible Filters */}
          {showAdvancedFilters && (
            <div className="fin-income-toolbar" style={{ background: '#f8fafc', gap: '0.65rem', marginTop: '-0.5rem' }}>
              <select
                className="fin-filter-select"
                value={regCategory}
                onChange={(e) => setRegCategory(e.target.value)}
              >
                <option value="All">All Categories</option>
                {(incomeSettings?.incomeCategories || [
                  'Website Development',
                  'Social Media Management',
                  'SEO Services',
                  'Website Maintenance / AMC',
                  'Other Services',
                ]).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                className="fin-filter-select"
                value={regMethod}
                onChange={(e) => setRegMethod(e.target.value)}
              >
                <option value="All">All Payment Methods</option>
                <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                <option value="UPI">UPI</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
              </select>

              <select
                className="fin-filter-select"
                value={regClient}
                onChange={(e) => setRegClient(e.target.value)}
              >
                <option value="All">All Clients</option>
                {clientsList.map((c) => (
                  <option key={c._id} value={c._id}>{c.name || c.companyName}</option>
                ))}
              </select>

              <select
                className="fin-filter-select"
                value={regBank}
                onChange={(e) => setRegBank(e.target.value)}
              >
                <option value="All">All Bank Accounts</option>
                {bankAccountsList.map((b) => (
                  <option key={b._id} value={b._id}>{b.bankName} - {b.accountName}</option>
                ))}
              </select>

              <input
                type="date"
                className="fin-date-input"
                value={regStartDate}
                onChange={(e) => setRegStartDate(e.target.value)}
                title="Start Date"
              />
              <input
                type="date"
                className="fin-date-input"
                value={regEndDate}
                onChange={(e) => setRegEndDate(e.target.value)}
                title="End Date"
              />

              <button
                type="button"
                className="fin-income-action-btn secondary"
                onClick={() => {
                  setRegCategory('All');
                  setRegMethod('All');
                  setRegClient('All');
                  setRegBank('All');
                  setRegStartDate('');
                  setRegEndDate('');
                }}
              >
                Reset
              </button>
            </div>
          )}

          {/* Income Register Table */}
          <div className="fin-compact-table-wrap">
            <table className="fin-compact-table fin-income-table">
              <thead>
                <tr>
                  <th className="fin-income-col-nowrap">Receipt #</th>
                  <th className="fin-income-col-nowrap">Payment ID</th>
                  <th className="fin-income-col-flex">Client / Company</th>
                  <th>Category</th>
                  <th className="fin-income-col-nowrap">Invoice #</th>
                  <th className="text-right fin-income-col-nowrap">Received Amount</th>
                  <th className="text-right fin-income-col-nowrap">Allocated</th>
                  <th className="text-right fin-income-col-nowrap">Unallocated</th>
                  <th className="fin-income-col-nowrap">Date</th>
                  <th>Method</th>
                  <th className="fin-income-col-nowrap">Reference (UTR)</th>
                  <th>Receiving Bank</th>
                  <th className="fin-income-col-nowrap">Status</th>
                  <th className="fin-income-col-nowrap">Reconciled</th>
                  <th className="fin-income-actions-cell">Actions</th>
                </tr>
              </thead>
              <tbody>
                {registerLoading ? (
                  <tr><td colSpan="15" className="text-center py-6">Loading income records from MongoDB Atlas...</td></tr>
                ) : filteredRegister.length === 0 ? (
                  <tr>
                    <td colSpan="15" className="text-center py-8 text-muted">
                      No income records found matching your filters. Click <strong>+ Add Income</strong> to record a payment.
                    </td>
                  </tr>
                ) : (
                  filteredRegister.map((tx) => {
                    const isRefunded = tx.refund?.isRefunded;
                    const isCancelled = tx.status === 'Cancelled' || tx.reversal?.isReversed;
                    const hasUnallocated = (Number(tx.unallocatedAmount) || 0) > 0;

                    return (
                      <tr key={tx._id} className={isCancelled ? 'fin-row-cancelled' : ''}>
                        {/* Receipt # */}
                        <td className="font-semibold text-primary fin-income-col-nowrap">
                          {tx.receiptNumber || '—'}
                        </td>
                        {/* Payment ID */}
                        <td className="text-muted font-mono text-xs fin-income-col-nowrap">{tx.paymentNumber}</td>
                        {/* Client */}
                        <td className="font-medium fin-income-col-flex">
                          {tx.clientName || tx.client?.name || 'Client'}
                        </td>
                        {/* Category */}
                        <td>
                          <span className="fin-badge category">{tx.incomeCategory || tx.category}</span>
                        </td>
                        {/* Invoice # */}
                        <td className="fin-income-col-nowrap">
                          {tx.allocations && tx.allocations.length > 0 ? (
                            tx.allocations.map((a, i) => (
                              <span key={i} className="fin-invoice-tag">{a.invoiceNumber}</span>
                            ))
                          ) : tx.invoice?.invoiceNumber ? (
                            <span className="fin-invoice-tag">{tx.invoice.invoiceNumber}</span>
                          ) : (
                            <span className="text-muted text-xs">Direct/Unallocated</span>
                          )}
                        </td>
                        {/* Received Amount */}
                        <td className="text-right font-bold text-success fin-income-col-nowrap">
                          {formatCurrency(tx.amount)}
                          {isRefunded && (
                            <span className="text-xs text-danger block">
                              (-{formatCurrency(tx.refund.refundAmount)})
                            </span>
                          )}
                        </td>
                        {/* Allocated */}
                        <td className="text-right fin-income-col-nowrap">{formatCurrency(tx.allocatedAmount || tx.amount)}</td>
                        {/* Unallocated */}
                        <td className="text-right font-semibold fin-income-col-nowrap">
                          {hasUnallocated ? (
                            <span className="text-warning">{formatCurrency(tx.unallocatedAmount)}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        {/* Date */}
                        <td className="text-muted fin-income-col-nowrap">{formatDate(tx.paymentDate)}</td>
                        {/* Method */}
                        <td>{tx.paymentMethod}</td>
                        {/* Reference */}
                        <td className="font-mono text-xs fin-income-col-nowrap">{tx.transactionReference || '—'}</td>
                        {/* Bank Account */}
                        <td className="text-xs text-muted">{tx.bankAccountName || tx.bankAccount?.bankName || 'Default'}</td>
                        {/* Status */}
                        <td className="fin-income-col-nowrap">
                          <span className={`fin-badge ${isCancelled ? 'cancelled' : isRefunded ? 'refunded' : String(tx.status).toLowerCase()}`}>
                            {isCancelled ? 'Cancelled' : isRefunded ? 'Refunded' : tx.status}
                          </span>
                        </td>
                        {/* Reconciled */}
                        <td className="fin-income-col-nowrap">
                          <span className={`fin-badge ${tx.isReconciled ? 'success' : 'pending'}`}>
                            {tx.isReconciled ? 'Reconciled' : 'Pending'}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="fin-income-actions-cell">
                          <div className="fin-income-actions-group">
                            <button
                              type="button"
                              className="fin-income-action-btn secondary"
                              title="View Full Details"
                              onClick={() => {
                                setSelectedItem(tx);
                                setActiveModal('viewIncome');
                              }}
                            >
                              👁️
                            </button>
                            <button
                              type="button"
                              className="fin-income-action-btn secondary"
                              title="Edit Record"
                              onClick={() => openEditModal(tx)}
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              className="fin-income-action-btn secondary"
                              title="View Official Receipt"
                              onClick={() => openReceiptModal(tx._id)}
                            >
                              🧾
                            </button>
                            {hasUnallocated && !isCancelled && (
                              <button
                                type="button"
                                className="fin-income-action-btn"
                                title="Allocate to unpaid invoice"
                                onClick={() => openAllocationModal(tx)}
                              >
                                ⇄ Allocate
                              </button>
                            )}
                            {!isCancelled && !isRefunded && (
                              <button
                                type="button"
                                className="fin-income-action-btn secondary"
                                style={{ color: '#dc2626' }}
                                title="Process Refund"
                                onClick={() => openRefundModal(tx)}
                              >
                                ↩
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

          {/* Pagination Controls */}
          <div className="fin-table-pagination-bar">
            <span className="fin-pagination-info">
              Showing page {registerPagination.page} of {registerPagination.totalPages} ({registerPagination.total} transactions)
            </span>
            <div className="fin-pagination-buttons">
              <button
                type="button"
                className="fin-income-action-btn secondary"
                disabled={registerPagination.page <= 1}
                onClick={() => setRegisterPagination((p) => ({ ...p, page: p.page - 1 }))}
              >
                Previous
              </button>
              <button
                type="button"
                className="fin-income-action-btn secondary"
                disabled={registerPagination.page >= registerPagination.totalPages}
                onClick={() => setRegisterPagination((p) => ({ ...p, page: p.page + 1 }))}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: INVOICES & BILLING INTEGRATION                     */}
      {/* ========================================================= */}
      {activeSubTab === 'invoices' && (
        <div className="fin-income-invoices-wrap">
          {/* Toolbar */}
          <div className="fin-income-toolbar">
            <div className="fin-income-search-wrap">
              <span className="fin-income-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search Invoice #, Client..."
                className="fin-income-search-input"
                value={invSearch}
                onChange={(e) => setInvSearch(e.target.value)}
              />
              {invSearch && (
                <button type="button" className="fin-income-search-clear" onClick={() => setInvSearch('')}>
                  ×
                </button>
              )}
            </div>

            {/* Filter Chips */}
            <div className="fin-income-filter-chips">
              {[
                { key: 'All', label: 'All Invoices', count: invoicesList.length },
                { key: 'Draft', label: 'Draft', count: invoicesList.filter((i) => i.status === 'Draft').length },
                { key: 'Sent', label: 'Issued / Sent', count: invoicesList.filter((i) => ['Sent', 'Issued'].includes(i.status)).length },
                { key: 'Partially Paid', label: 'Partially Paid', count: invoicesList.filter((i) => i.status === 'Partially Paid').length },
                { key: 'Paid', label: 'Paid', count: invoicesList.filter((i) => i.status === 'Paid').length },
                {
                  key: 'Overdue',
                  label: 'Overdue',
                  count: invoicesList.filter((i) => i.dueDate && new Date(i.dueDate) < new Date() && (Number(i.balance) || 0) > 0).length,
                },
              ].map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className={`fin-income-filter-chip ${invStatusChip === chip.key ? 'active' : ''}`}
                  onClick={() => setInvStatusChip(chip.key)}
                >
                  <span>{chip.label}</span>
                  <span className="fin-income-chip-count">{chip.count}</span>
                </button>
              ))}
            </div>

            <div className="fin-income-toolbar-actions">
              <button
                type="button"
                className="fin-btn-orange"
                onClick={() => {
                  if (openModal) openModal('invoice');
                  else if (handleTabChange) handleTabChange('invoices');
                }}
              >
                + Create Invoice
              </button>
              <button
                type="button"
                className="fin-income-action-btn secondary"
                onClick={handleExportCurrentView}
              >
                📥 Export
              </button>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="fin-compact-table-wrap">
            <table className="fin-compact-table fin-income-table">
              <thead>
                <tr>
                  <th className="fin-income-col-nowrap">Invoice #</th>
                  <th className="fin-income-col-flex">Client / Company</th>
                  <th className="fin-income-col-nowrap">Issue Date</th>
                  <th className="fin-income-col-nowrap">Due Date</th>
                  <th className="text-right fin-income-col-nowrap">Total Amount</th>
                  <th className="text-right fin-income-col-nowrap">Amount Paid</th>
                  <th className="text-right fin-income-col-nowrap">Balance Due</th>
                  <th className="fin-income-col-nowrap">Status</th>
                  <th className="fin-income-actions-cell">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoicesLoading ? (
                  <tr><td colSpan="9" className="text-center py-6">Loading invoices from MongoDB Atlas...</td></tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-8 text-muted">
                      No invoices found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const bal = Number(inv.balance) || 0;
                    return (
                      <tr key={inv._id}>
                        <td className="font-semibold text-primary fin-income-col-nowrap">{inv.invoiceNumber}</td>
                        <td className="font-medium fin-income-col-flex">{inv.clientName || inv.client?.name || 'Client'}</td>
                        <td className="text-muted fin-income-col-nowrap">{formatDate(inv.issueDate)}</td>
                        <td className="text-muted fin-income-col-nowrap">{formatDate(inv.dueDate)}</td>
                        <td className="text-right font-medium fin-income-col-nowrap">{formatCurrency(inv.total)}</td>
                        <td className="text-right text-success fin-income-col-nowrap">{formatCurrency(inv.paidAmount)}</td>
                        <td className="text-right font-bold text-danger fin-income-col-nowrap">
                          {bal > 0 ? formatCurrency(bal) : '₹0'}
                        </td>
                        <td className="fin-income-col-nowrap">
                          <span className={`fin-badge ${String(inv.status).toLowerCase().replace(' ', '-')}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="fin-income-actions-cell">
                          <div className="fin-income-actions-group">
                            {inv.status === 'Draft' && (
                              <button
                                type="button"
                                className="fin-income-action-btn"
                                onClick={() => handleIssueInvoice(inv._id)}
                                title="Issue draft invoice to client"
                              >
                                Issue
                              </button>
                            )}
                            {bal > 0 && inv.status !== 'Draft' && (
                              <button
                                type="button"
                                className="fin-income-action-btn"
                                onClick={() => openReceiveModal(inv.client?._id || inv.client, inv)}
                                title="Receive payment for this invoice"
                              >
                                💳 Receive Payment
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
      )}

      {/* ========================================================= */}
      {/* TAB 4: RECEIVE PAYMENT & PAYMENT ALLOCATION               */}
      {/* ========================================================= */}
      {activeSubTab === 'receive' && (
        <div className="fin-alloc-workspace">
          {/* Section A: Receive Client Payment Form */}
          <div className="fin-alloc-card">
            <div className="fin-alloc-card-header">
              <h3 className="fin-alloc-card-title">
                <span>💳</span> Receive Client Payment
              </h3>
              <span className="fin-tab-badge-orange">Real-Time Ledger Engine</span>
            </div>

            <form onSubmit={handlePaymentSubmit} className="fin-receive-form">
              {modalError && <div className="fin-alert-item danger" style={{ marginBottom: '1rem' }}>{modalError}</div>}
              {modalSuccess && <div className="fin-alert-item success" style={{ marginBottom: '1rem' }}>{modalSuccess}</div>}

              <div className="fin-form-grid-2col">
                {/* 1. Client Picker */}
                <div className="fin-form-field">
                  <label>Client *</label>
                  <select
                    className="fin-input"
                    required
                    value={payFormData.clientId}
                    onChange={(e) => handleClientChange(e.target.value)}
                  >
                    <option value="">-- Select Client --</option>
                    {clientsList.map((c) => (
                      <option key={c._id} value={c._id}>{c.name || c.companyName}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Related Invoice Picker */}
                <div className="fin-form-field">
                  <label>Related Invoice (Leave blank for Unallocated Credit)</label>
                  <select
                    className="fin-input"
                    value={payFormData.invoiceId}
                    onChange={(e) => handleInvoiceChange(e.target.value)}
                  >
                    <option value="">-- Direct / Unallocated Credit Payment --</option>
                    {clientInvoices.map((inv) => (
                      <option key={inv._id} value={inv._id}>
                        {inv.invoiceNumber} — Balance Due: {formatCurrency(inv.balance)} (Total: {formatCurrency(inv.total)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Amount Received */}
                <div className="fin-form-field">
                  <label>Amount Received (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="fin-input font-bold"
                    required
                    placeholder="e.g. 50000"
                    value={payFormData.amount}
                    onChange={(e) => setPayFormData({ ...payFormData, amount: e.target.value })}
                  />
                  {selectedInvoice && (
                    <span className="fin-field-hint">
                      Invoice Outstanding Balance: <strong>{formatCurrency(selectedInvoice.balance)}</strong>
                    </span>
                  )}
                </div>

                {/* 4. Payment Date */}
                <div className="fin-form-field">
                  <label>Payment Date *</label>
                  <input
                    type="date"
                    className="fin-input"
                    required
                    value={payFormData.paymentDate}
                    onChange={(e) => setPayFormData({ ...payFormData, paymentDate: e.target.value })}
                  />
                </div>

                {/* 5. Payment Method */}
                <div className="fin-form-field">
                  <label>Payment Method *</label>
                  <select
                    className="fin-input"
                    required
                    value={payFormData.paymentMethod}
                    onChange={(e) => setPayFormData({ ...payFormData, paymentMethod: e.target.value })}
                  >
                    <option value="Bank Transfer">Bank Transfer (NEFT / RTGS / IMPS)</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Credit / Debit Card</option>
                    <option value="Payment Gateway">Payment Gateway</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* 6. Transaction Reference */}
                <div className="fin-form-field">
                  <label>Transaction Reference (UTR / Cheque #)</label>
                  <input
                    type="text"
                    className="fin-input"
                    placeholder="e.g. UTR829104820 or CHQ1029"
                    value={payFormData.transactionReference}
                    onChange={(e) => setPayFormData({ ...payFormData, transactionReference: e.target.value })}
                  />
                </div>

                {/* 7. Receiving Bank Account */}
                <div className="fin-form-field">
                  <label>Receiving Bank Account *</label>
                  <select
                    className="fin-input"
                    value={payFormData.bankAccountId}
                    onChange={(e) => setPayFormData({ ...payFormData, bankAccountId: e.target.value })}
                  >
                    {bankAccountsList.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.bankName} — {b.accountName} (Balance: {formatCurrency(b.currentBalance)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 8. Income Category */}
                <div className="fin-form-field">
                  <label>Income Category</label>
                  <select
                    className="fin-input"
                    value={payFormData.incomeCategory}
                    onChange={(e) => setPayFormData({ ...payFormData, incomeCategory: e.target.value })}
                  >
                    {(incomeSettings?.incomeCategories || [
                      'Website Development',
                      'Social Media Management',
                      'SEO Services',
                      'Google Business Profile Services',
                      'Website Maintenance / AMC',
                      'Other Services',
                    ]).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 9. Proof & Notes */}
              <div className="fin-form-grid-2col mt-3">
                <div className="fin-form-field">
                  <label>Payment Proof Document / Reference URL</label>
                  <input
                    type="text"
                    className="fin-input"
                    placeholder="e.g. Document reference or receipt link"
                    value={payFormData.paymentProof}
                    onChange={(e) => setPayFormData({ ...payFormData, paymentProof: e.target.value })}
                  />
                </div>

                <div className="fin-form-field">
                  <label>Internal Notes / Remarks</label>
                  <input
                    type="text"
                    className="fin-input"
                    placeholder="Internal accounting remarks"
                    value={payFormData.notes}
                    onChange={(e) => setPayFormData({ ...payFormData, notes: e.target.value })}
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="fin-btn-orange"
                >
                  {modalLoading ? 'Processing Receipt...' : 'Confirm & Generate Branded Receipt'}
                </button>
              </div>
            </form>
          </div>

          {/* Section B: Pending Allocation Workspace */}
          <div className="fin-alloc-card">
            <div className="fin-alloc-card-header">
              <h3 className="fin-alloc-card-title">
                <span>⇄</span> Pending Payment Allocation Workspace
              </h3>
              <span className="fin-tab-badge-orange">{unallocatedPayments.length} Payments With Unallocated Balances</span>
            </div>
            <p style={{ fontSize: '0.825rem', color: '#64748b', margin: '0 0 1rem 0' }}>
              Payments received without an assigned invoice, or with remaining unallocated balance. Assign these funds to settle client invoices.
            </p>

            <div className="fin-compact-table-wrap">
              <table className="fin-compact-table fin-income-table">
                <thead>
                  <tr>
                    <th className="fin-income-col-nowrap">Receipt #</th>
                    <th className="fin-income-col-flex">Client / Company</th>
                    <th className="fin-income-col-nowrap">Payment Date</th>
                    <th className="text-right fin-income-col-nowrap">Total Received</th>
                    <th className="text-right fin-income-col-nowrap">Allocated</th>
                    <th className="text-right fin-income-col-nowrap">Unallocated Balance</th>
                    <th className="fin-income-col-nowrap">Reference</th>
                    <th className="fin-income-actions-cell">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {unallocatedPayments.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-6 text-success font-medium">
                        ✓ All received client funds are fully allocated to invoices!
                      </td>
                    </tr>
                  ) : (
                    unallocatedPayments.map((p) => (
                      <tr key={p._id}>
                        <td className="font-semibold text-primary fin-income-col-nowrap">{p.receiptNumber || p.paymentNumber}</td>
                        <td className="font-medium fin-income-col-flex">{p.clientName || 'Client'}</td>
                        <td className="text-muted fin-income-col-nowrap">{formatDate(p.paymentDate)}</td>
                        <td className="text-right fin-income-col-nowrap">{formatCurrency(p.amount)}</td>
                        <td className="text-right text-muted fin-income-col-nowrap">{formatCurrency(p.allocatedAmount || 0)}</td>
                        <td className="text-right font-bold text-warning fin-income-col-nowrap">{formatCurrency(p.unallocatedAmount)}</td>
                        <td className="font-mono text-xs fin-income-col-nowrap">{p.transactionReference || '—'}</td>
                        <td className="fin-income-actions-cell">
                          <button
                            type="button"
                            className="fin-btn-orange"
                            style={{ height: '26px', fontSize: '0.725rem', padding: '0 0.55rem' }}
                            onClick={() => openAllocationModal(p)}
                          >
                            ⇄ Allocate to Invoice
                          </button>
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
      {/* TAB 5: RECURRING INCOME & BILLING SCHEDULES               */}
      {/* ========================================================= */}
      {activeSubTab === 'recurring' && (
        <div className="fin-recurring-wrap">
          {/* 4 Metric Cards */}
          <div className="fin-kpi-grid-6 fin-income-kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="fin-kpi-card">
              <span className="fin-kpi-label">Active Recurring Plans</span>
              <div className="fin-kpi-value text-primary">{recurringStats?.activePlansCount || 0}</div>
              <div className="fin-kpi-footer">Total: {recurringStats?.totalPlansCount || 0} plans</div>
            </div>
            <div className="fin-kpi-card">
              <span className="fin-kpi-label">Monthly Recurring Revenue (MRR)</span>
              <div className="fin-kpi-value text-success">{formatCurrency(recurringStats?.mrr)}</div>
              <div className="fin-kpi-footer">Normalized monthly run rate</div>
            </div>
            <div className="fin-kpi-card">
              <span className="fin-kpi-label">Annualized Run Rate (ARR)</span>
              <div className="fin-kpi-value">{formatCurrency(recurringStats?.arr)}</div>
              <div className="fin-kpi-footer">Expected annual recurring run rate</div>
            </div>
            <div className="fin-kpi-card">
              <span className="fin-kpi-label">Billing Due in 30 Days</span>
              <div className="fin-kpi-value text-warning">{recurringStats?.upcomingCount || 0}</div>
              <div className="fin-kpi-footer">Scheduled billing cycles</div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="fin-income-toolbar" style={{ marginTop: '1rem' }}>
            <div className="fin-income-search-wrap">
              <span className="fin-income-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search plans, client..."
                className="fin-income-search-input"
                value={recSearch}
                onChange={(e) => setRecSearch(e.target.value)}
              />
              {recSearch && (
                <button type="button" className="fin-income-search-clear" onClick={() => setRecSearch('')}>
                  ×
                </button>
              )}
            </div>

            <div className="fin-income-filter-chips">
              {[
                { key: 'All', label: 'All Plans', count: recurringPlans.length },
                { key: 'Active', label: 'Active', count: recurringPlans.filter((p) => p.status === 'Active').length },
                { key: 'Paused', label: 'Paused', count: recurringPlans.filter((p) => p.status === 'Paused').length },
                { key: 'Completed', label: 'Completed', count: recurringPlans.filter((p) => p.status === 'Completed').length },
                { key: 'Cancelled', label: 'Cancelled', count: recurringPlans.filter((p) => p.status === 'Cancelled').length },
              ].map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className={`fin-income-filter-chip ${recStatusChip === chip.key ? 'active' : ''}`}
                  onClick={() => setRecStatusChip(chip.key)}
                >
                  <span>{chip.label}</span>
                  <span className="fin-income-chip-count">{chip.count}</span>
                </button>
              ))}
            </div>

            <div className="fin-income-toolbar-actions">
              <button
                type="button"
                className="fin-btn-orange"
                onClick={() => openRecurringPlanModal()}
              >
                + New Recurring Plan
              </button>
            </div>
          </div>

          {/* Plans Table */}
          <div className="fin-compact-table-wrap">
            <table className="fin-compact-table fin-income-table">
              <thead>
                <tr>
                  <th className="fin-income-col-nowrap">Plan #</th>
                  <th className="fin-income-col-flex">Plan Name</th>
                  <th>Client</th>
                  <th>Category</th>
                  <th>Frequency</th>
                  <th className="text-right fin-income-col-nowrap">Contract Amount</th>
                  <th className="fin-income-col-nowrap">Start Date</th>
                  <th className="fin-income-col-nowrap">Next Billing Date</th>
                  <th className="fin-income-col-nowrap">Status</th>
                  <th className="text-right fin-income-col-nowrap">Billed to Date</th>
                  <th className="fin-income-actions-cell">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recurringLoading ? (
                  <tr><td colSpan="11" className="text-center py-6">Loading recurring plans...</td></tr>
                ) : filteredRecurring.length === 0 ? (
                  <tr><td colSpan="11" className="text-center py-8 text-muted">No recurring billing plans found.</td></tr>
                ) : (
                  filteredRecurring.map((p) => {
                    const isDue = p.status === 'Active' && p.nextBillingDate && new Date(p.nextBillingDate) <= new Date();
                    return (
                      <tr key={p._id}>
                        <td className="font-semibold text-primary fin-income-col-nowrap">{p.planNumber}</td>
                        <td className="font-medium fin-income-col-flex">{p.planName}</td>
                        <td>{p.clientName}</td>
                        <td><span className="fin-badge category">{p.category}</span></td>
                        <td>{p.billingFrequency}</td>
                        <td className="text-right font-bold fin-income-col-nowrap">{formatCurrency(p.contractAmount)}</td>
                        <td className="text-muted fin-income-col-nowrap">{formatDate(p.startDate)}</td>
                        <td className={`fin-income-col-nowrap ${isDue ? 'text-danger font-semibold' : 'text-muted'}`}>
                          {formatDate(p.nextBillingDate)} {isDue && '🔔 Due'}
                        </td>
                        <td className="fin-income-col-nowrap">
                          <span className={`fin-badge ${String(p.status).toLowerCase()}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="text-right text-success font-medium fin-income-col-nowrap">
                          {formatCurrency(p.totalInvoicedAmount)} ({p.generatedInvoicesCount || 0} bills)
                        </td>
                        <td className="fin-income-actions-cell">
                          <div className="fin-income-actions-group">
                            {p.status === 'Active' && (
                              <button
                                type="button"
                                className="fin-income-action-btn"
                                title="Generate Invoice for cycle"
                                onClick={() => handleGeneratePlanInvoice(p._id)}
                              >
                                📄 Bill Now
                              </button>
                            )}
                            <button
                              type="button"
                              className="fin-income-action-btn secondary"
                              title={p.status === 'Active' ? 'Pause Plan' : 'Resume Plan'}
                              onClick={() => handleTogglePlanStatus(p._id, p.status)}
                            >
                              {p.status === 'Active' ? '⏸️' : '▶️'}
                            </button>
                            <button
                              type="button"
                              className="fin-income-action-btn secondary"
                              title="Edit Plan"
                              onClick={() => openRecurringPlanModal(p)}
                            >
                              ✏️
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
      )}

      {/* ========================================================= */}
      {/* TAB 6: REFUNDS & ADJUSTMENTS                              */}
      {/* ========================================================= */}
      {activeSubTab === 'adjustments' && (
        <div className="fin-adjustments-wrap">
          <div className="fin-income-toolbar">
            <div className="fin-income-search-wrap">
              <span className="fin-income-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search refund reference, client, reason..."
                className="fin-income-search-input"
                value={refundSearch}
                onChange={(e) => setRefundSearch(e.target.value)}
              />
            </div>

            <div className="fin-income-filter-chips">
              {[
                { key: 'All', label: 'All Adjustments', count: transactions.filter((t) => t.refund?.isRefunded || t.status === 'Cancelled').length },
                { key: 'Refunds', label: 'Refunds', count: transactions.filter((t) => t.refund?.isRefunded).length },
                { key: 'Cancellations', label: 'Cancellations / Reversals', count: transactions.filter((t) => t.status === 'Cancelled' && !t.refund?.isRefunded).length },
              ].map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className={`fin-income-filter-chip ${refundTypeChip === chip.key ? 'active' : ''}`}
                  onClick={() => setRefundTypeChip(chip.key)}
                >
                  <span>{chip.label}</span>
                  <span className="fin-income-chip-count">{chip.count}</span>
                </button>
              ))}
            </div>

            <div className="fin-income-toolbar-actions">
              <button
                type="button"
                className="fin-btn-orange"
                onClick={() => openRefundModal()}
              >
                + Record Refund / Adjustment
              </button>
            </div>
          </div>

          <div className="fin-compact-table-wrap">
            <table className="fin-compact-table fin-income-table">
              <thead>
                <tr>
                  <th className="fin-income-col-nowrap">Type</th>
                  <th className="fin-income-col-nowrap">Payment Reference</th>
                  <th className="fin-income-col-flex">Client / Company</th>
                  <th className="text-right fin-income-col-nowrap">Original Amount</th>
                  <th className="text-right fin-income-col-nowrap">Refunded Amount</th>
                  <th className="fin-income-col-nowrap">Refund Date</th>
                  <th>Reason / Contention</th>
                  <th className="fin-income-col-nowrap">Status</th>
                  <th className="fin-income-actions-cell">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRefunds.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-8 text-muted">
                      No refunds or adjustments recorded. Click <strong>+ Record Refund / Adjustment</strong> to process a reversal.
                    </td>
                  </tr>
                ) : (
                  filteredRefunds.map((tx) => (
                    <tr key={tx._id}>
                      <td className="fin-income-col-nowrap">
                        <span className={`fin-badge ${tx.refund?.isRefunded ? 'refunded' : 'cancelled'}`}>
                          {tx.refund?.isRefunded ? 'Refund' : 'Reversal'}
                        </span>
                      </td>
                      <td className="font-semibold text-primary fin-income-col-nowrap">
                        {tx.receiptNumber || tx.paymentNumber}
                      </td>
                      <td className="font-medium fin-income-col-flex">{tx.clientName}</td>
                      <td className="text-right text-muted fin-income-col-nowrap">{formatCurrency(tx.amount)}</td>
                      <td className="text-right text-danger font-bold fin-income-col-nowrap">
                        {formatCurrency(tx.refund?.refundAmount || tx.amount)}
                      </td>
                      <td className="text-muted fin-income-col-nowrap">
                        {formatDate(tx.refund?.refundDate || tx.reversal?.reversedAt || tx.updatedAt)}
                      </td>
                      <td>{tx.refund?.refundReason || tx.reversal?.reversalReason || tx.notes || '—'}</td>
                      <td className="fin-income-col-nowrap">
                        <span className="fin-badge cancelled">Audited & Restored</span>
                      </td>
                      <td className="fin-income-actions-cell">
                        <button
                          type="button"
                          className="fin-income-action-btn secondary"
                          onClick={() => {
                            setSelectedItem(tx);
                            setActiveModal('viewIncome');
                          }}
                        >
                          👁️ Details
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

      {/* ========================================================= */}
      {/* TAB 7: RECONCILIATION                                     */}
      {/* ========================================================= */}
      {activeSubTab === 'reconciliation' && (
        <div className="fin-reconcile-wrap">
          <div className="fin-income-toolbar">
            <div className="fin-income-search-wrap">
              <span className="fin-income-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search by Receipt, UTR, Client..."
                className="fin-income-search-input"
                value={reconSearch}
                onChange={(e) => setReconSearch(e.target.value)}
              />
            </div>

            <div className="fin-income-filter-chips">
              {[
                { key: 'All', label: 'All Transactions', count: transactions.length },
                { key: 'Pending Match', label: 'Pending Bank Match', count: transactions.filter((t) => !t.isReconciled && t.status === 'Completed').length },
                { key: 'Reconciled', label: 'Reconciled', count: transactions.filter((t) => t.isReconciled).length },
                { key: 'Unallocated', label: 'Unallocated', count: unallocatedPayments.length },
              ].map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className={`fin-income-filter-chip ${reconStatusChip === chip.key ? 'active' : ''}`}
                  onClick={() => setReconStatusChip(chip.key)}
                >
                  <span>{chip.label}</span>
                  <span className="fin-income-chip-count">{chip.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="fin-compact-table-wrap">
            <table className="fin-compact-table fin-income-table">
              <thead>
                <tr>
                  <th className="fin-income-col-nowrap">Receipt #</th>
                  <th className="fin-income-col-flex">Client / Company</th>
                  <th className="fin-income-col-nowrap">Payment Date</th>
                  <th>Method</th>
                  <th className="fin-income-col-nowrap">UTR / Reference</th>
                  <th>Receiving Bank Account</th>
                  <th className="text-right fin-income-col-nowrap">Amount</th>
                  <th className="fin-income-col-nowrap">Reconciliation Status</th>
                  <th className="fin-income-actions-cell">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReconciliation.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-8 text-success font-medium">
                      ✓ All income transactions in this view are reconciled with bank statements!
                    </td>
                  </tr>
                ) : (
                  filteredReconciliation.map((t) => (
                    <tr key={t._id}>
                      <td className="font-semibold text-primary fin-income-col-nowrap">{t.receiptNumber || t.paymentNumber}</td>
                      <td className="font-medium fin-income-col-flex">{t.clientName}</td>
                      <td className="text-muted fin-income-col-nowrap">{formatDate(t.paymentDate)}</td>
                      <td>{t.paymentMethod}</td>
                      <td className="font-mono text-xs fin-income-col-nowrap">{t.transactionReference || '—'}</td>
                      <td>{t.bankAccountName || 'Company Operating A/C'}</td>
                      <td className="text-right font-bold text-success fin-income-col-nowrap">{formatCurrency(t.amount)}</td>
                      <td className="fin-income-col-nowrap">
                        <span className={`fin-badge ${t.isReconciled ? 'success' : 'pending'}`}>
                          {t.isReconciled ? 'Reconciled' : 'Pending Bank Match'}
                        </span>
                      </td>
                      <td className="fin-income-actions-cell">
                        <div className="fin-income-actions-group">
                          <button
                            type="button"
                            className={t.isReconciled ? 'fin-income-action-btn secondary' : 'fin-income-action-btn'}
                            onClick={() => handleReconcileToggle(t._id, t.isReconciled)}
                          >
                            {t.isReconciled ? '↩ Unmatch' : '✓ Match & Reconcile'}
                          </button>
                          <button
                            type="button"
                            className="fin-income-action-btn secondary"
                            title="Add/Edit Notes"
                            onClick={() => openReconcileNoteModal(t)}
                          >
                            📝 Note
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
      {/* MODAL 1: ADD INCOME / RECEIVE PAYMENT MODAL                                */}
      {/* ========================================================================= */}
      {activeModal === 'receivePayment' && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Receive Client Payment</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handlePaymentSubmit}>
              <div className="fin-modal-body">
                {modalError && <div className="fin-alert-item danger" style={{ marginBottom: '1rem' }}>{modalError}</div>}
                {modalSuccess && <div className="fin-alert-item success" style={{ marginBottom: '1rem' }}>{modalSuccess}</div>}

                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Client *</label>
                    <select
                      required
                      value={payFormData.clientId}
                      onChange={(e) => handleClientChange(e.target.value)}
                    >
                      <option value="">-- Select Client --</option>
                      {clientsList.map((c) => (
                        <option key={c._id} value={c._id}>{c.name || c.companyName}</option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Related Invoice (Optional)</label>
                    <select
                      value={payFormData.invoiceId}
                      onChange={(e) => handleInvoiceChange(e.target.value)}
                    >
                      <option value="">-- Direct / Unallocated Credit --</option>
                      {clientInvoices.map((inv) => (
                        <option key={inv._id} value={inv._id}>
                          {inv.invoiceNumber} — Bal: {formatCurrency(inv.balance)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Amount Received (₹)*</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={payFormData.amount}
                      onChange={(e) => setPayFormData({ ...payFormData, amount: e.target.value })}
                    />
                    {selectedInvoice && (
                      <small style={{ color: '#64748b' }}>
                        Invoice Balance: <strong>{formatCurrency(selectedInvoice.balance)}</strong>
                      </small>
                    )}
                  </div>

                  <div className="fin-form-group">
                    <label>Payment Date*</label>
                    <input
                      type="date"
                      required
                      value={payFormData.paymentDate}
                      onChange={(e) => setPayFormData({ ...payFormData, paymentDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Payment Method*</label>
                    <select
                      required
                      value={payFormData.paymentMethod}
                      onChange={(e) => setPayFormData({ ...payFormData, paymentMethod: e.target.value })}
                    >
                      <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                      <option value="UPI">UPI / QR Code</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Cash">Cash</option>
                      <option value="Card">Credit / Debit Card</option>
                      <option value="Payment Gateway">Payment Gateway</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Deposit to Bank Account*</label>
                    <select
                      value={payFormData.bankAccountId}
                      onChange={(e) => setPayFormData({ ...payFormData, bankAccountId: e.target.value })}
                    >
                      {bankAccountsList.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.bankName} — {b.accountName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Transaction Reference / UTR</label>
                    <input
                      type="text"
                      placeholder="e.g. UTR-829103984"
                      value={payFormData.transactionReference}
                      onChange={(e) => setPayFormData({ ...payFormData, transactionReference: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Income Category</label>
                    <select
                      value={payFormData.incomeCategory}
                      onChange={(e) => setPayFormData({ ...payFormData, incomeCategory: e.target.value })}
                    >
                      {(incomeSettings?.incomeCategories || [
                        'Website Development',
                        'Social Media Management',
                        'SEO Services',
                        'Website Maintenance / AMC',
                        'Other Services',
                      ]).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Notes / Remarks</label>
                    <textarea
                      rows="2"
                      placeholder="Payment details, commitment, remarks..."
                      value={payFormData.notes}
                      onChange={(e) => setPayFormData({ ...payFormData, notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-orange" disabled={modalLoading}>
                  {modalLoading ? 'Processing...' : 'Confirm & Generate Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT INCOME PAYMENT                                              */}
      {/* ========================================================================= */}
      {activeModal === 'editIncome' && selectedItem && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Edit Income Record — {selectedItem.receiptNumber || selectedItem.paymentNumber}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="fin-modal-body">
                {modalError && <div className="fin-alert-item danger" style={{ marginBottom: '1rem' }}>{modalError}</div>}
                {modalSuccess && <div className="fin-alert-item success" style={{ marginBottom: '1rem' }}>{modalSuccess}</div>}

                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Client Name</label>
                    <input type="text" disabled value={selectedItem.clientName} />
                  </div>
                  <div className="fin-form-group">
                    <label>Amount (₹)</label>
                    <input type="text" disabled value={formatCurrency(selectedItem.amount)} />
                  </div>

                  <div className="fin-form-group">
                    <label>Income Category</label>
                    <select
                      value={editFormData.incomeCategory}
                      onChange={(e) => setEditFormData({ ...editFormData, incomeCategory: e.target.value })}
                    >
                      {(incomeSettings?.incomeCategories || [
                        'Website Development',
                        'Social Media Management',
                        'SEO Services',
                        'Website Maintenance / AMC',
                        'Other Services',
                      ]).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Payment Date</label>
                    <input
                      type="date"
                      value={editFormData.paymentDate}
                      onChange={(e) => setEditFormData({ ...editFormData, paymentDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Payment Method</label>
                    <select
                      value={editFormData.paymentMethod}
                      onChange={(e) => setEditFormData({ ...editFormData, paymentMethod: e.target.value })}
                    >
                      <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                      <option value="UPI">UPI</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Transaction Reference (UTR)</label>
                    <input
                      type="text"
                      value={editFormData.transactionReference}
                      onChange={(e) => setEditFormData({ ...editFormData, transactionReference: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Deposit to Bank Account</label>
                    <select
                      value={editFormData.bankAccountId}
                      onChange={(e) => setEditFormData({ ...editFormData, bankAccountId: e.target.value })}
                    >
                      {bankAccountsList.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.bankName} — {b.accountName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Notes</label>
                    <textarea
                      rows="2"
                      value={editFormData.notes}
                      onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-orange" disabled={modalLoading}>
                  {modalLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: VIEW INCOME DETAILS                                              */}
      {/* ========================================================================= */}
      {activeModal === 'viewIncome' && selectedItem && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Income Record Details — {selectedItem.receiptNumber || selectedItem.paymentNumber}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <div className="fin-modal-body">
              <div className="fin-detail-section">
                <h4>Financial Position</h4>
                <div className="fin-detail-grid">
                  <div className="fin-detail-item">
                    <span className="fin-detail-label">Received Amount</span>
                    <span className="fin-detail-val text-success" style={{ fontWeight: 700 }}>
                      {formatCurrency(selectedItem.amount)}
                    </span>
                  </div>
                  <div className="fin-detail-item">
                    <span className="fin-detail-label">Allocated to Invoices</span>
                    <span className="fin-detail-val">{formatCurrency(selectedItem.allocatedAmount || selectedItem.amount)}</span>
                  </div>
                  <div className="fin-detail-item">
                    <span className="fin-detail-label">Unallocated Balance</span>
                    <span className="fin-detail-val text-warning">{formatCurrency(selectedItem.unallocatedAmount || 0)}</span>
                  </div>
                  <div className="fin-detail-item">
                    <span className="fin-detail-label">Payment Date</span>
                    <span className="fin-detail-val">{formatDate(selectedItem.paymentDate)}</span>
                  </div>
                </div>
              </div>

              <div className="fin-detail-section">
                <h4>Transaction Identifiers</h4>
                <div className="fin-detail-grid">
                  <div className="fin-detail-item">
                    <span className="fin-detail-label">Client</span>
                    <span className="fin-detail-val">{selectedItem.clientName}</span>
                  </div>
                  <div className="fin-detail-item">
                    <span className="fin-detail-label">Income Category</span>
                    <span className="fin-detail-val">{selectedItem.incomeCategory || selectedItem.category}</span>
                  </div>
                  <div className="fin-detail-item">
                    <span className="fin-detail-label">Payment Method</span>
                    <span className="fin-detail-val">{selectedItem.paymentMethod}</span>
                  </div>
                  <div className="fin-detail-item">
                    <span className="fin-detail-label">UTR / Reference</span>
                    <span className="fin-detail-val font-mono">{selectedItem.transactionReference || '—'}</span>
                  </div>
                  <div className="fin-detail-item">
                    <span className="fin-detail-label">Receiving Bank</span>
                    <span className="fin-detail-val">{selectedItem.bankAccountName || 'Company Account'}</span>
                  </div>
                  <div className="fin-detail-item">
                    <span className="fin-detail-label">Status</span>
                    <span className="fin-detail-val">{selectedItem.status}</span>
                  </div>
                </div>
              </div>

              {selectedItem.allocations?.length > 0 && (
                <div className="fin-detail-section">
                  <h4>Allocated Invoices</h4>
                  <table className="fin-compact-table" style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}>
                    <thead>
                      <tr><th>Invoice No</th><th className="text-right">Allocated Amount</th></tr>
                    </thead>
                    <tbody>
                      {selectedItem.allocations.map((a, i) => (
                        <tr key={i}>
                          <td>{a.invoiceNumber}</td>
                          <td className="text-right font-medium">{formatCurrency(a.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedItem.notes && (
                <div className="fin-detail-section">
                  <h4>Internal Notes</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>{selectedItem.notes}</p>
                </div>
              )}
            </div>

            <div className="fin-modal-footer">
              <button
                type="button"
                className="fin-btn-orange"
                onClick={() => openReceiptModal(selectedItem._id)}
              >
                🧾 View Branded Receipt
              </button>
              <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: BRANDED OFFICIAL PRINTABLE RECEIPT                               */}
      {/* ========================================================================= */}
      {activeModal === 'receipt' && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box" style={{ maxWidth: '640px' }}>
            <div className="fin-modal-header fin-no-print">
              <h3>Official Payment Receipt</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>

            <div className="fin-modal-body">
              {modalLoading || !receiptData ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>Loading receipt document...</div>
              ) : (
                <div className="fin-receipt-printable">
                  {/* Company Header */}
                  <div className="fin-receipt-header">
                    <div className="fin-receipt-company-info">
                      <h3>{receiptData.company?.companyName}</h3>
                      <p>{receiptData.company?.address}</p>
                      <p>Email: {receiptData.company?.email} | Tel: {receiptData.company?.phone}</p>
                      {receiptData.company?.gstin && <p>GSTIN: {receiptData.company?.gstin}</p>}
                    </div>
                    <div className="fin-receipt-badge-box">
                      <div className="fin-receipt-title">PAYMENT RECEIPT</div>
                      <div className="fin-receipt-number">{receiptData.payment?.receiptNumber || receiptData.payment?.paymentNumber}</div>
                      <div className="fin-receipt-date">{formatDate(receiptData.payment?.paymentDate)}</div>
                    </div>
                  </div>

                  <hr className="fin-receipt-divider" />

                  {/* Client & Payment Meta */}
                  <div className="fin-receipt-meta-grid">
                    <div>
                      <span className="fin-receipt-lbl">Received From:</span>
                      <strong>{receiptData.payment?.clientName}</strong>
                      <p style={{ margin: '0.15rem 0', fontSize: '0.75rem', color: '#64748b' }}>
                        {receiptData.payment?.client?.email || ''}
                      </p>
                    </div>
                    <div>
                      <span className="fin-receipt-lbl">Payment Details:</span>
                      <div>Method: <strong>{receiptData.payment?.paymentMethod}</strong></div>
                      <div>Ref (UTR): <strong>{receiptData.payment?.transactionReference || '—'}</strong></div>
                      <div>Bank: <strong>{receiptData.payment?.bankAccountName || 'Company Account'}</strong></div>
                    </div>
                  </div>

                  {/* Allocation Table */}
                  <table className="fin-receipt-table">
                    <thead>
                      <tr>
                        <th>Particulars / Description</th>
                        <th>Category</th>
                        <th className="text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          Payment received towards {receiptData.relatedInvoices?.length > 0
                            ? receiptData.relatedInvoices.map((i) => i.invoiceNumber).join(', ')
                            : 'General Account Settlement'}
                        </td>
                        <td>{receiptData.payment?.incomeCategory || receiptData.payment?.category}</td>
                        <td className="text-right font-bold">{formatCurrency(receiptData.payment?.amount)}</td>
                      </tr>
                      <tr className="fin-receipt-total-row">
                        <td colSpan="2"><strong>TOTAL AMOUNT RECEIVED</strong></td>
                        <td className="text-right"><strong style={{ fontSize: '1.05rem', color: '#16a34a' }}>{formatCurrency(receiptData.payment?.amount)}</strong></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Footer */}
                  <div className="fin-receipt-footer" style={{ marginTop: '1.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      <em>This is an authorized computer-generated commercial receipt.</em>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span className="fin-sign-line" />
                      <div style={{ fontSize: '0.725rem', fontWeight: 600 }}>Authorized Signatory</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="fin-modal-footer fin-no-print">
              <button
                type="button"
                className="fin-btn-orange"
                onClick={() => window.print()}
              >
                🖨️ Print Receipt
              </button>
              <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: ALLOCATE PAYMENT TO INVOICE                                      */}
      {/* ========================================================================= */}
      {activeModal === 'allocate' && selectedItem && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Allocate Payment — {selectedItem.receiptNumber || selectedItem.paymentNumber}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleAllocationSubmit}>
              <div className="fin-modal-body">
                {modalError && <div className="fin-alert-item danger" style={{ marginBottom: '1rem' }}>{modalError}</div>}
                {modalSuccess && <div className="fin-alert-item success" style={{ marginBottom: '1rem' }}>{modalSuccess}</div>}

                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Client</label>
                    <input type="text" disabled value={selectedItem.clientName} />
                  </div>
                  <div className="fin-form-group">
                    <label>Available Unallocated Balance</label>
                    <input
                      type="text"
                      disabled
                      value={formatCurrency(selectedItem.unallocatedAmount || selectedItem.amount)}
                      style={{ fontWeight: 700, color: '#ea580c' }}
                    />
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Select Unpaid Invoice to Settle *</label>
                    <select
                      required
                      value={allocTargetInvoiceId}
                      onChange={(e) => {
                        const invId = e.target.value;
                        setAllocTargetInvoiceId(invId);
                        const matched = allocInvoices.find((i) => i._id === invId);
                        if (matched) {
                          const maxAlloc = Math.min(
                            Number(selectedItem.unallocatedAmount) || 0,
                            Number(matched.balance) || 0
                          );
                          setAllocAmount(String(maxAlloc));
                        }
                      }}
                    >
                      <option value="">-- Select Client Invoice --</option>
                      {allocInvoices.map((inv) => (
                        <option key={inv._id} value={inv._id}>
                          {inv.invoiceNumber} — Balance Due: {formatCurrency(inv.balance)} (Total: {formatCurrency(inv.total)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Amount to Allocate (₹)*</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      max={selectedItem.unallocatedAmount}
                      value={allocAmount}
                      onChange={(e) => setAllocAmount(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-orange" disabled={modalLoading}>
                  {modalLoading ? 'Allocating...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: RECURRING PLAN (CREATE & EDIT)                                   */}
      {/* ========================================================================= */}
      {activeModal === 'recurringPlan' && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>{isEditingPlan ? 'Edit Recurring Plan' : 'Create New Recurring Billing Plan'}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleRecurringPlanSubmit}>
              <div className="fin-modal-body">
                {modalError && <div className="fin-alert-item danger" style={{ marginBottom: '1rem' }}>{modalError}</div>}
                {modalSuccess && <div className="fin-alert-item success" style={{ marginBottom: '1rem' }}>{modalSuccess}</div>}

                <div className="fin-form-grid-2">
                  <div className="fin-form-group col-span-2">
                    <label>Plan Name / Contract Description *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Annual Cloud Hosting & Website AMC"
                      value={planFormData.planName}
                      onChange={(e) => setPlanFormData({ ...planFormData, planName: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Client *</label>
                    <select
                      required
                      value={planFormData.clientId}
                      onChange={(e) => setPlanFormData({ ...planFormData, clientId: e.target.value })}
                      disabled={isEditingPlan}
                    >
                      <option value="">-- Select Client --</option>
                      {clientsList.map((c) => (
                        <option key={c._id} value={c._id}>{c.name || c.companyName}</option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Service Category</label>
                    <select
                      value={planFormData.category}
                      onChange={(e) => setPlanFormData({ ...planFormData, category: e.target.value })}
                    >
                      <option value="Website Maintenance / AMC">Website Maintenance / AMC</option>
                      <option value="Social Media Retainer">Social Media Retainer</option>
                      <option value="SEO Retainer">SEO Retainer</option>
                      <option value="Software License / SaaS">Software License / SaaS</option>
                      <option value="Consultation Retainer">Consultation Retainer</option>
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Billing Frequency *</label>
                    <select
                      required
                      value={planFormData.billingFrequency}
                      onChange={(e) => setPlanFormData({ ...planFormData, billingFrequency: e.target.value })}
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Semi-Annually">Semi-Annually</option>
                      <option value="Annually">Annually</option>
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Contract Amount Per Cycle (₹)*</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0.01"
                      value={planFormData.contractAmount}
                      onChange={(e) => setPlanFormData({ ...planFormData, contractAmount: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Contract Start Date *</label>
                    <input
                      type="date"
                      required
                      value={planFormData.startDate}
                      onChange={(e) => setPlanFormData({ ...planFormData, startDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Next Billing Date *</label>
                    <input
                      type="date"
                      required
                      value={planFormData.nextBillingDate}
                      onChange={(e) => setPlanFormData({ ...planFormData, nextBillingDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Internal Notes</label>
                    <textarea
                      rows="2"
                      placeholder="Contract terms, SLA, commitments..."
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
                  {modalLoading ? 'Saving Plan...' : isEditingPlan ? 'Save Changes' : 'Create Recurring Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: RECORD REFUND / ADJUSTMENT                                       */}
      {/* ========================================================================= */}
      {activeModal === 'recordRefund' && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Record Client Refund / Adjustment</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleRefundSubmit}>
              <div className="fin-modal-body">
                {modalError && <div className="fin-alert-item danger" style={{ marginBottom: '1rem' }}>{modalError}</div>}
                {modalSuccess && <div className="fin-alert-item success" style={{ marginBottom: '1rem' }}>{modalSuccess}</div>}

                <div className="fin-form-grid-2">
                  <div className="fin-form-group col-span-2">
                    <label>Client *</label>
                    <select
                      required
                      value={refundFormData.clientId}
                      onChange={(e) => handleRefundClientChange(e.target.value)}
                    >
                      <option value="">-- Select Client --</option>
                      {clientsList.map((c) => (
                        <option key={c._id} value={c._id}>{c.name || c.companyName}</option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Select Completed Payment to Refund *</label>
                    <select
                      required
                      value={refundFormData.paymentId}
                      onChange={(e) => handleRefundPaymentChange(e.target.value)}
                    >
                      <option value="">-- Select Payment Transaction --</option>
                      {clientPaymentsForRefund.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.receiptNumber || p.paymentNumber} — Amount: {formatCurrency(p.amount)} ({formatDate(p.paymentDate)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Refund Amount (₹)*</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0.01"
                      value={refundFormData.refundAmount}
                      onChange={(e) => setRefundFormData({ ...refundFormData, refundAmount: e.target.value })}
                    />
                    {selectedRefundPayment && (
                      <small style={{ color: '#64748b' }}>
                        Max refundable: {formatCurrency(selectedRefundPayment.amount - (selectedRefundPayment.refund?.refundAmount || 0))}
                      </small>
                    )}
                  </div>

                  <div className="fin-form-group">
                    <label>Refund Date *</label>
                    <input
                      type="date"
                      required
                      value={refundFormData.refundDate}
                      onChange={(e) => setRefundFormData({ ...refundFormData, refundDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Refund Reference (UTR / Txn ID)</label>
                    <input
                      type="text"
                      placeholder="e.g. REF-UTR-981023"
                      value={refundFormData.refundReference}
                      onChange={(e) => setRefundFormData({ ...refundFormData, refundReference: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Refund Method</label>
                    <select
                      value={refundFormData.refundMethod}
                      onChange={(e) => setRefundFormData({ ...refundFormData, refundMethod: e.target.value })}
                    >
                      <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                      <option value="UPI">UPI</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Reason for Refund *</label>
                    <textarea
                      rows="2"
                      required
                      placeholder="Provide clear commercial rationale for refund..."
                      value={refundFormData.refundReason}
                      onChange={(e) => setRefundFormData({ ...refundFormData, refundReason: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-orange" disabled={modalLoading}>
                  {modalLoading ? 'Processing...' : 'Confirm & Process Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: RECONCILIATION NOTE MODAL                                        */}
      {/* ========================================================================= */}
      {activeModal === 'reconcileNote' && selectedItem && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Reconciliation Note — {selectedItem.receiptNumber || selectedItem.paymentNumber}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleSaveReconcileNote}>
              <div className="fin-modal-body">
                <div className="fin-form-group">
                  <label>Bank Statement Match Remarks / Notes</label>
                  <textarea
                    rows="4"
                    required
                    placeholder="Document bank statement page, reconciliation clearance reference, date matched..."
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
    </div>
  );
}
