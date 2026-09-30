import React, { useState, useMemo, useEffect, useRef } from 'react';
import apiClient from '../../../../services/apiClient';

export default function ClientFinancialMaster({
  clients = [],
  setClients,
  formatCurrency,
  formatDate,
  openModal,
  user,
  refreshTrigger,
  setRefreshTrigger,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // all, outstanding, overdue, advance, active, inactive
  const [selectedClient, setSelectedClient] = useState(null);
  const [accountData, setAccountData] = useState(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountTab, setAccountTab] = useState('overview'); // 14 tabs: overview, projects, proposals, invoices, payments, receivables, recovery, advances, expenses, ledger, statement, documents, profitability, audit
  const [openDropdownId, setOpenDropdownId] = useState(null);

  // Bank accounts for selection in payment/expense modals
  const [bankAccounts, setBankAccounts] = useState([]);

  // ─── Modal States ───────────────────────────────────────────
  // 1. Create Client Modal
  const [isCreateClientModalOpen, setIsCreateClientModalOpen] = useState(false);
  const [clientFormData, setClientFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    contactPerson: '',
    clientCode: '',
    billingAddress: '',
    gstin: '',
    pan: '',
    paymentTerms: 30,
    creditLimit: 0,
    status: 'Active',
    notes: '',
  });
  const [clientLoading, setClientLoading] = useState(false);
  const [clientError, setClientError] = useState('');

  // 2. Edit Client Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // 3. Create Invoice Modal
  const [isCreateInvoiceModalOpen, setIsCreateInvoiceModalOpen] = useState(false);
  const [invoiceFormData, setInvoiceFormData] = useState({
    clientId: '',
    clientName: '',
    projectId: '',
    amount: '',
    cgst: '',
    sgst: '',
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    description: '',
  });
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');

  // 4. Record Payment Modal
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false);
  const [paymentFormData, setPaymentFormData] = useState({
    amount: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'Bank Transfer',
    bankAccountId: '',
    transactionReference: '',
    notes: '',
    isAdvance: false,
  });
  const [paymentAllocations, setPaymentAllocations] = useState([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // 5. Advance Adjustment Modal
  const [isAdvanceAdjustModalOpen, setIsAdvanceAdjustModalOpen] = useState(false);
  const [advanceFormData, setAdvanceFormData] = useState({
    actionType: 'ApplyToInvoice',
    invoiceId: '',
    amount: '',
    notes: '',
  });
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [advanceError, setAdvanceError] = useState('');

  // 6. Add Client Expense Modal
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [expenseFormData, setExpenseFormData] = useState({
    title: '',
    category: 'Client Operations',
    amount: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'Bank Transfer',
    paymentStatus: 'Paid',
    project: '',
    vendorName: '',
    description: '',
    bankAccountId: '',
  });
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseError, setExpenseError] = useState('');

  // 7. Create Proposal Modal
  const [isCreateProposalModalOpen, setIsCreateProposalModalOpen] = useState(false);
  const [proposalFormData, setProposalFormData] = useState({
    title: 'Commercial Quotation',
    project: '',
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    items: [{ name: '', description: '', qty: 1, rate: '', taxRate: 18 }],
    notes: '',
  });
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalError, setProposalError] = useState('');

  // 8. Create Credit Note Modal
  const [isCreditNoteModalOpen, setIsCreditNoteModalOpen] = useState(false);
  const [creditNoteFormData, setCreditNoteFormData] = useState({
    invoiceId: '',
    amount: '',
    reason: 'Billing Adjustment',
    notes: '',
  });
  const [creditNoteLoading, setCreditNoteLoading] = useState(false);
  const [creditNoteError, setCreditNoteError] = useState('');

  // 9. Follow-Up Modal
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpFormData, setFollowUpFormData] = useState({
    note: '',
    status: 'In Progress',
    nextFollowUpDate: '',
    promiseToPayDate: '',
    invoiceId: '',
  });
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpError, setFollowUpError] = useState('');

  // 10. Receipt Modal
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  // 11. Statement & Ledger Filters
  const [statementPeriod, setStatementPeriod] = useState('all'); // all, thisMonth, thisQuarter, thisFY, custom
  const [statementStartDate, setStatementStartDate] = useState('');
  const [statementEndDate, setStatementEndDate] = useState('');
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.fin-action-dropdown-wrap')) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Fetch live bank accounts on mount
  useEffect(() => {
    const fetchBankAccounts = async () => {
      try {
        const res = await apiClient.get('/finance/bank-accounts');
        const list = res.data?.data?.accounts || res.data?.data || [];
        setBankAccounts(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Failed to load bank accounts:', err);
      }
    };
    fetchBankAccounts();
  }, []);

  // ─── Real MongoDB Atlas Summary Metrics ──────────────────────
  const summary = useMemo(() => {
    let totalBilled = 0;
    let totalReceived = 0;
    let totalReceivables = 0;
    let overdueAmount = 0;
    let advanceBalance = 0;
    let clientExpenses = 0;

    clients.forEach((c) => {
      totalBilled += Number(c.totalBilled) || 0;
      totalReceived += Number(c.totalReceived) || 0;
      totalReceivables += Number(c.outstanding) || 0;
      overdueAmount += Number(c.overdue) || 0;
      advanceBalance += Number(c.advanceBalance) || 0;
      clientExpenses += Number(c.clientExpenses) || 0;
    });

    const netRevenue = Math.round((totalReceived - clientExpenses) * 100) / 100;

    return {
      totalClients: clients.length,
      totalBilled: Math.round(totalBilled * 100) / 100,
      totalReceived: Math.round(totalReceived * 100) / 100,
      totalReceivables: Math.round(totalReceivables * 100) / 100,
      overdueAmount: Math.round(overdueAmount * 100) / 100,
      advanceBalance: Math.round(advanceBalance * 100) / 100,
      clientExpenses: Math.round(clientExpenses * 100) / 100,
      netRevenue,
    };
  }, [clients]);

  // ─── Filtered Clients ─────────────────────────────────────────
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (filter === 'outstanding' && !(Number(c.outstanding) > 0)) return false;
      if (filter === 'overdue' && !(Number(c.overdue) > 0)) return false;
      if (filter === 'advance' && !(Number(c.advanceBalance) > 0 || c.financialStatus === 'Advance')) return false;
      if (filter === 'active' && c.status === 'Inactive') return false;
      if (filter === 'inactive' && c.status !== 'Inactive') return false;

      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.company && c.company.toLowerCase().includes(q)) ||
        (c.clientCode && c.clientCode.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.gstin && c.gstin.toLowerCase().includes(q))
      );
    });
  }, [clients, filter, searchTerm]);

  // ─── Workspace Account Loader ────────────────────────────────
  const handleOpenAccount = async (client, targetTab = 'overview') => {
    setSelectedClient(client);
    setAccountTab(targetTab);
    setAccountLoading(true);
    setOpenDropdownId(null);

    try {
      const res = await apiClient.get(`/finance/clients/${client._id}`);
      setAccountData(res.data?.data || null);
    } catch (err) {
      console.error('Error fetching client financial account details:', err);
    } finally {
      setAccountLoading(false);
    }
  };

  const handleCloseAccount = () => {
    setSelectedClient(null);
    setAccountData(null);
    setAccountTab('overview');
    setLedgerStartDate('');
    setLedgerEndDate('');
    setStatementStartDate('');
    setStatementEndDate('');
  };

  // ─── Modal Handlers: Create Client ───────────────────────────
  const handleOpenCreateClient = () => {
    setClientFormData({
      name: '',
      company: '',
      email: '',
      phone: '',
      contactPerson: '',
      clientCode: '',
      billingAddress: '',
      gstin: '',
      pan: '',
      paymentTerms: 30,
      creditLimit: 0,
      status: 'Active',
      notes: '',
    });
    setClientError('');
    setIsCreateClientModalOpen(true);
  };

  const handleSaveCreateClient = async (e) => {
    e.preventDefault();
    setClientLoading(true);
    setClientError('');
    try {
      const res = await apiClient.post('/finance/clients', clientFormData);
      const newClient = res.data?.data;
      if (newClient) {
        setClients((prev) => [newClient, ...prev]);
      }
      setIsCreateClientModalOpen(false);
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      setClientError(err.response?.data?.message || err.message || 'Failed to create client');
    } finally {
      setClientLoading(false);
    }
  };

  // ─── Modal Handlers: Edit Profile ────────────────────────────
  const handleOpenEditModal = (client) => {
    const c = accountData?.client || client;
    setEditFormData({
      _id: c._id,
      name: c.name || '',
      company: c.company || '',
      clientCode: c.clientCode || '',
      contactPerson: c.contactPerson || '',
      email: c.email || '',
      phone: c.phone || '',
      billingAddress: c.billingAddress || c.address || '',
      address: c.address || '',
      gstin: c.gstin || '',
      pan: c.pan || '',
      paymentTerms: c.paymentTerms || 30,
      creditLimit: c.creditLimit || 0,
      status: c.status || 'Active',
      notes: c.notes || '',
    });
    setEditError('');
    setIsEditModalOpen(true);
    setOpenDropdownId(null);
  };

  const handleSaveEditProfile = async (e) => {
    e.preventDefault();
    const clientId = selectedClient?._id || editFormData._id;
    if (!clientId) return;

    setEditLoading(true);
    setEditError('');
    try {
      const res = await apiClient.put(`/finance/clients/${clientId}`, editFormData);
      const updated = res.data?.data;

      setClients((prev) =>
        prev.map((c) => (c._id === clientId ? { ...c, ...updated } : c))
      );

      if (accountData?.client?._id === clientId) {
        setAccountData((prev) => ({
          ...prev,
          client: { ...prev.client, ...updated },
        }));
      }

      setIsEditModalOpen(false);
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      setEditError(err.response?.data?.message || err.message || 'Failed to update client profile');
    } finally {
      setEditLoading(false);
    }
  };

  // ─── Status Toggle ───────────────────────────────────────────
  const handleToggleStatus = async (client) => {
    const newStatus = client.status === 'Inactive' ? 'Active' : 'Inactive';
    if (!window.confirm(`Are you sure you want to change status of ${client.name} to ${newStatus}?`)) return;

    try {
      await apiClient.patch(`/finance/clients/${client._id}/status`, { status: newStatus });
      setClients((prev) =>
        prev.map((c) => (c._id === client._id ? { ...c, status: newStatus } : c))
      );
      if (selectedClient?._id === client._id) {
        setSelectedClient((prev) => ({ ...prev, status: newStatus }));
        setAccountData((prev) => ({
          ...prev,
          client: { ...prev.client, status: newStatus },
        }));
      }
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    }
  };

  // ─── Modal Handlers: Create Invoice ──────────────────────────
  const handleOpenCreateInvoice = (project = null) => {
    const c = accountData?.client || selectedClient || {};
    setInvoiceFormData({
      clientId: c._id || '',
      clientName: c.name || '',
      projectId: project?._id || '',
      amount: '',
      cgst: '',
      sgst: '',
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      description: project ? `Billing for ${project.name}` : '',
    });
    setInvoiceError('');
    setIsCreateInvoiceModalOpen(true);
    setOpenDropdownId(null);
  };

  const handleSaveCreateInvoice = async (e) => {
    e.preventDefault();
    setInvoiceLoading(true);
    setInvoiceError('');

    try {
      const amount = Number(invoiceFormData.amount) || 0;
      const cgst = invoiceFormData.cgst !== '' ? Number(invoiceFormData.cgst) : Math.round(amount * 0.09 * 100) / 100;
      const sgst = invoiceFormData.sgst !== '' ? Number(invoiceFormData.sgst) : Math.round(amount * 0.09 * 100) / 100;

      const payload = {
        client: invoiceFormData.clientId || selectedClient?._id,
        clientName: invoiceFormData.clientName || selectedClient?.name,
        project: invoiceFormData.projectId || undefined,
        amount,
        cgst,
        sgst,
        total: amount + cgst + sgst,
        issueDate: invoiceFormData.issueDate,
        dueDate: invoiceFormData.dueDate,
        description: invoiceFormData.description,
      };

      await apiClient.post('/finance/invoices', payload);
      setIsCreateInvoiceModalOpen(false);

      if (selectedClient?._id) {
        handleOpenAccount(selectedClient, 'invoices');
      }
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      setInvoiceError(err.response?.data?.message || err.message || 'Failed to create invoice');
    } finally {
      setInvoiceLoading(false);
    }
  };

  // ─── Modal Handlers: Record Payment ──────────────────────────
  const handleOpenRecordPayment = (targetInvoice = null) => {
    const c = accountData?.client || selectedClient || {};
    const invoices = accountData?.invoices || [];
    const unpaidInvoices = invoices.filter((inv) => (Number(inv.balance) || 0) > 0);

    const initialAmount = targetInvoice
      ? Number(targetInvoice.balance) || Number(targetInvoice.total) || ''
      : unpaidInvoices.reduce((s, i) => s + (Number(i.balance) || 0), 0) || '';

    const allocations = targetInvoice
      ? [{ invoiceId: targetInvoice._id, amount: Number(targetInvoice.balance) || 0 }]
      : unpaidInvoices.map((inv) => ({ invoiceId: inv._id, amount: Number(inv.balance) || 0 }));

    setPaymentFormData({
      amount: initialAmount,
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'Bank Transfer',
      bankAccountId: bankAccounts[0]?._id || '',
      transactionReference: `UTR-${Date.now().toString().slice(-6)}`,
      notes: targetInvoice ? `Payment for Invoice #${targetInvoice.invoiceNumber}` : `Client payment allocation`,
      isAdvance: false,
    });
    setPaymentAllocations(allocations);
    setPaymentError('');
    setIsRecordPaymentModalOpen(true);
    setOpenDropdownId(null);
  };

  const handleSaveRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedClient?._id) return;
    setPaymentLoading(true);
    setPaymentError('');

    try {
      const payload = {
        amount: Number(paymentFormData.amount),
        paymentDate: paymentFormData.paymentDate,
        paymentMethod: paymentFormData.paymentMethod,
        bankAccountId: paymentFormData.bankAccountId || undefined,
        transactionReference: paymentFormData.transactionReference,
        notes: paymentFormData.notes,
        isAdvance: paymentFormData.isAdvance,
        allocations: paymentFormData.isAdvance ? [] : paymentAllocations.filter((a) => Number(a.amount) > 0),
      };

      const res = await apiClient.post(`/finance/clients/${selectedClient._id}/payment`, payload);
      const resData = res.data?.data;

      setIsRecordPaymentModalOpen(false);
      handleOpenAccount(selectedClient, 'payments');
      setRefreshTrigger((p) => p + 1);

      // Open receipt modal with generated receipt
      if (resData?.receiptNumber) {
        setReceiptData({
          receiptNumber: resData.receiptNumber,
          clientName: selectedClient.name,
          clientCode: selectedClient.clientCode,
          amount: payload.amount,
          paymentDate: payload.paymentDate,
          paymentMethod: payload.paymentMethod,
          transactionReference: payload.transactionReference,
          notes: payload.notes,
          unallocatedAdvance: resData.unallocatedAdvance,
        });
        setIsReceiptModalOpen(true);
      }
    } catch (err) {
      setPaymentError(err.response?.data?.message || err.message || 'Failed to record payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  // ─── Modal Handlers: Advance Adjustment ──────────────────────
  const handleOpenAdvanceAdjust = (actionType = 'ApplyToInvoice') => {
    const invoices = accountData?.invoices || [];
    const firstUnpaid = invoices.find((i) => (Number(i.balance) || 0) > 0);
    const advanceBal = Number(accountData?.financials?.advanceBalance) || 0;

    setAdvanceFormData({
      actionType,
      invoiceId: firstUnpaid?._id || '',
      amount: firstUnpaid ? Math.min(advanceBal, Number(firstUnpaid.balance) || advanceBal) : advanceBal,
      notes: actionType === 'Refund' ? 'Refund of advance balance' : 'Adjustment from client advance',
    });
    setAdvanceError('');
    setIsAdvanceAdjustModalOpen(true);
  };

  const handleSaveAdvanceAdjust = async (e) => {
    e.preventDefault();
    if (!selectedClient?._id) return;
    setAdvanceLoading(true);
    setAdvanceError('');

    try {
      await apiClient.post(`/finance/clients/${selectedClient._id}/advance-adjust`, advanceFormData);
      setIsAdvanceAdjustModalOpen(false);
      handleOpenAccount(selectedClient, 'advances');
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      setAdvanceError(err.response?.data?.message || err.message || 'Failed to adjust advance');
    } finally {
      setAdvanceLoading(false);
    }
  };

  // ─── Modal Handlers: Add Client Expense ───────────────────────
  const handleOpenAddExpense = () => {
    setExpenseFormData({
      title: '',
      category: 'Client Operations',
      amount: '',
      expenseDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'Bank Transfer',
      paymentStatus: 'Paid',
      project: accountData?.projects?.[0]?._id || '',
      vendorName: '',
      description: '',
      bankAccountId: bankAccounts[0]?._id || '',
    });
    setExpenseError('');
    setIsAddExpenseModalOpen(true);
  };

  const handleSaveAddExpense = async (e) => {
    e.preventDefault();
    if (!selectedClient?._id) return;
    setExpenseLoading(true);
    setExpenseError('');

    try {
      await apiClient.post(`/finance/clients/${selectedClient._id}/expenses`, expenseFormData);
      setIsAddExpenseModalOpen(false);
      handleOpenAccount(selectedClient, 'expenses');
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      setExpenseError(err.response?.data?.message || err.message || 'Failed to log client expense');
    } finally {
      setExpenseLoading(false);
    }
  };

  // ─── Modal Handlers: Create Proposal ─────────────────────────
  const handleOpenCreateProposal = () => {
    setProposalFormData({
      title: `Commercial Quotation - ${selectedClient?.name}`,
      project: accountData?.projects?.[0]?._id || '',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      items: [{ name: 'Implementation & Services', description: 'Core deliverables', qty: 1, rate: '', taxRate: 18 }],
      notes: 'Terms: 50% advance, balance on delivery. Valid for 30 days.',
    });
    setProposalError('');
    setIsCreateProposalModalOpen(true);
  };

  const handleSaveCreateProposal = async (e) => {
    e.preventDefault();
    if (!selectedClient?._id) return;
    setProposalLoading(true);
    setProposalError('');

    try {
      const items = proposalFormData.items.map((it) => {
        const rate = Number(it.rate) || 0;
        const qty = Number(it.qty) || 1;
        const sub = rate * qty;
        const tax = Math.round(sub * (Number(it.taxRate) || 18) / 100 * 100) / 100;
        return {
          ...it,
          rate,
          qty,
          taxAmount: tax,
          amount: sub + tax,
        };
      });

      const payload = {
        client: selectedClient._id,
        clientName: selectedClient.name,
        project: proposalFormData.project || undefined,
        title: proposalFormData.title,
        validUntil: proposalFormData.validUntil,
        items,
        notes: proposalFormData.notes,
      };

      await apiClient.post('/finance/proposals', payload);
      setIsCreateProposalModalOpen(false);
      handleOpenAccount(selectedClient, 'proposals');
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      setProposalError(err.response?.data?.message || err.message || 'Failed to create quotation');
    } finally {
      setProposalLoading(false);
    }
  };

  // ─── Modal Handlers: Credit Note ─────────────────────────────
  const handleOpenCreditNote = (invoice = null) => {
    const invoices = accountData?.invoices || [];
    const target = invoice || invoices[0];
    setCreditNoteFormData({
      invoiceId: target?._id || '',
      amount: target ? Number(target.balance) || Number(target.total) || '' : '',
      reason: 'Billing Adjustment',
      notes: '',
    });
    setCreditNoteError('');
    setIsCreditNoteModalOpen(true);
  };

  const handleSaveCreditNote = async (e) => {
    e.preventDefault();
    if (!creditNoteFormData.invoiceId) return;
    setCreditNoteLoading(true);
    setCreditNoteError('');

    try {
      await apiClient.post(`/finance/invoices/${creditNoteFormData.invoiceId}/credit-note`, {
        amount: Number(creditNoteFormData.amount),
        reason: creditNoteFormData.reason,
        notes: creditNoteFormData.notes,
      });
      setIsCreditNoteModalOpen(false);
      handleOpenAccount(selectedClient, 'advances');
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      setCreditNoteError(err.response?.data?.message || err.message || 'Failed to create credit note');
    } finally {
      setCreditNoteLoading(false);
    }
  };

  // ─── Follow-up Modal ─────────────────────────────────────────
  const handleOpenFollowUpModal = (invoiceId = '') => {
    setFollowUpFormData({
      note: '',
      status: 'In Progress',
      nextFollowUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      promiseToPayDate: '',
      invoiceId: invoiceId || (accountData?.invoices?.find((i) => (Number(i.balance) || 0) > 0)?._id || ''),
    });
    setFollowUpError('');
    setIsFollowUpModalOpen(true);
    setOpenDropdownId(null);
  };

  const handleSaveFollowUp = async (e) => {
    e.preventDefault();
    if (!selectedClient?._id) return;
    setFollowUpLoading(true);
    setFollowUpError('');

    try {
      await apiClient.post(`/finance/clients/${selectedClient._id}/followup`, followUpFormData);
      setIsFollowUpModalOpen(false);
      handleOpenAccount(selectedClient, 'recovery');
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      setFollowUpError(err.response?.data?.message || err.message || 'Failed to log follow-up');
    } finally {
      setFollowUpLoading(false);
    }
  };

  // ─── Send Payment Reminder ───────────────────────────────────
  const handleSendReminder = async () => {
    if (!selectedClient?._id) return;
    try {
      const res = await apiClient.post(`/finance/clients/${selectedClient._id}/reminder`);
      alert(res.data?.message || 'Payment reminder logged and dispatched successfully');
      handleOpenAccount(selectedClient, 'recovery');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send reminder');
    }
  };

  // ─── Proposal Actions ────────────────────────────────────────
  const handleApproveProposal = async (propId) => {
    try {
      await apiClient.post(`/finance/proposals/${propId}/approve`, { decision: 'Approved' });
      handleOpenAccount(selectedClient, 'proposals');
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve proposal');
    }
  };

  const handleConvertToInvoice = async (propId) => {
    if (!window.confirm('Convert this approved quotation into a live Invoice?')) return;
    try {
      await apiClient.post(`/finance/proposals/${propId}/convert-to-invoice`);
      handleOpenAccount(selectedClient, 'invoices');
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to convert proposal to invoice');
    }
  };

  // ─── Export CSV Handlers ─────────────────────────────────────
  const handleExportClientsCSV = () => {
    if (!filteredClients.length) return;
    const headers = ['Client Name', 'Code', 'Company', 'Contact', 'Email', 'GSTIN', 'Total Billed', 'Total Received', 'Outstanding', 'Overdue', 'Advance', 'Status'];
    const rows = filteredClients.map((c) => [
      `"${c.name}"`,
      `"${c.clientCode || ''}"`,
      `"${c.company || ''}"`,
      `"${c.contactPerson || ''}"`,
      `"${c.email || ''}"`,
      `"${c.gstin || ''}"`,
      c.totalBilled || 0,
      c.totalReceived || 0,
      c.outstanding || 0,
      c.overdue || 0,
      c.advanceBalance || 0,
      `"${c.status || 'Active'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `client_financial_master_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportLedgerCSV = () => {
    const ledger = accountData?.ledger || [];
    if (!ledger.length) return;
    const headers = ['Date', 'Type', 'Reference', 'Description', 'Debit', 'Credit', 'Running Balance'];
    const rows = ledger.map((l) => [
      `"${new Date(l.date).toLocaleDateString('en-IN')}"`,
      `"${l.type}"`,
      `"${l.reference}"`,
      `"${l.description.replace(/"/g, '""')}"`,
      l.debit || 0,
      l.credit || 0,
      l.balance || 0,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ledger_${selectedClient?.name}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── Filtered Ledger & Statement ─────────────────────────────
  const filteredLedger = useMemo(() => {
    if (!accountData?.ledger) return [];
    return accountData.ledger.filter((entry) => {
      const d = new Date(entry.date);
      if (ledgerStartDate && d < new Date(ledgerStartDate)) return false;
      if (ledgerEndDate) {
        const end = new Date(ledgerEndDate);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }
      return true;
    });
  }, [accountData?.ledger, ledgerStartDate, ledgerEndDate]);

  const ledgerTotals = useMemo(() => {
    let debits = 0;
    let credits = 0;
    filteredLedger.forEach((l) => {
      debits += Number(l.debit) || 0;
      credits += Number(l.credit) || 0;
    });
    return {
      debits: Math.round(debits * 100) / 100,
      credits: Math.round(credits * 100) / 100,
      closingBalance: Math.round((debits - credits) * 100) / 100,
    };
  }, [filteredLedger]);

  // Statement calculations based on statementPeriod
  const statementTransactions = useMemo(() => {
    const raw = accountData?.ledger || [];
    const now = new Date();
    let start = null;
    let end = new Date();

    if (statementPeriod === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (statementPeriod === 'thisQuarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), qMonth, 1);
    } else if (statementPeriod === 'thisFY') {
      const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      start = new Date(fyYear, 3, 1);
    } else if (statementPeriod === 'custom') {
      if (statementStartDate) start = new Date(statementStartDate);
      if (statementEndDate) {
        end = new Date(statementEndDate);
        end.setHours(23, 59, 59, 999);
      }
    }

    let openingBal = 0;
    const periodTxs = [];

    raw.forEach((tx) => {
      const txDate = new Date(tx.date);
      if (start && txDate < start) {
        openingBal += (Number(tx.debit) || 0) - (Number(tx.credit) || 0);
      } else if (!end || txDate <= end) {
        periodTxs.push(tx);
      }
    });

    let running = openingBal;
    const withRunning = periodTxs.map((tx) => {
      running += (Number(tx.debit) || 0) - (Number(tx.credit) || 0);
      return { ...tx, balance: Math.round(running * 100) / 100 };
    });

    const periodDebits = periodTxs.reduce((s, t) => s + (Number(t.debit) || 0), 0);
    const periodCredits = periodTxs.reduce((s, t) => s + (Number(t.credit) || 0), 0);

    return {
      openingBal: Math.round(openingBal * 100) / 100,
      transactions: withRunning,
      periodDebits: Math.round(periodDebits * 100) / 100,
      periodCredits: Math.round(periodCredits * 100) / 100,
      closingBal: Math.round(running * 100) / 100,
    };
  }, [accountData?.ledger, statementPeriod, statementStartDate, statementEndDate]);

  // ─── 14 Tab Definitions ──────────────────────────────────────
  const TABS = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'projects', label: 'Projects', icon: '📁', count: accountData?.projects?.length },
    { id: 'proposals', label: 'Proposals', icon: '📜', count: accountData?.proposals?.length },
    { id: 'invoices', label: 'Invoices', icon: '🧾', count: accountData?.invoices?.length },
    { id: 'payments', label: 'Payments', icon: '💳', count: accountData?.payments?.length },
    { id: 'receivables', label: 'Receivables', icon: '⏳', count: accountData?.receivables?.length },
    { id: 'recovery', label: 'Payment Recovery', icon: '📞', count: accountData?.followUps?.length },
    { id: 'advances', label: 'Advances & Credits', icon: '🏷️', count: (accountData?.creditNotes?.length || 0) + (accountData?.advances?.length || 0) },
    { id: 'expenses', label: 'Client Expenses', icon: '💸', count: accountData?.expenses?.length },
    { id: 'ledger', label: 'Ledger', icon: '📖', count: accountData?.ledger?.length },
    { id: 'statement', label: 'Statement', icon: '📄' },
    { id: 'documents', label: 'Documents', icon: '📁', count: accountData?.documents?.length },
    { id: 'profitability', label: 'Profitability', icon: '📈' },
    { id: 'audit', label: 'Audit History', icon: '🛡️', count: accountData?.auditHistory?.length },
  ];

  return (
    <div className="fin-client-master-root">
      {/* ──────────────────────────────────────────────────────────
          MAIN CLIENT REGISTER VIEW (when no client workspace is open)
          ────────────────────────────────────────────────────────── */}
      {!selectedClient ? (
        <>
          {/* Section 4: Header & Top Actions */}
          <div className="fin-cm-header">
            <div>
              <h2 className="fin-cm-title">CLIENT FINANCIAL MASTER</h2>
              <p className="fin-cm-subtitle">
                Manage client accounts, billing, collections, expenses, outstanding balances and financial performance.
              </p>
            </div>
            <div className="fin-cm-header-actions">
              <button
                type="button"
                className="fin-action-btn primary"
                onClick={handleOpenCreateClient}
              >
                <span className="fin-action-plus">+</span> Create Client
              </button>
              <button
                type="button"
                className="fin-action-btn"
                onClick={() => handleOpenCreateInvoice()}
              >
                <span className="fin-action-plus">+</span> Create Invoice
              </button>
              <button
                type="button"
                className="fin-action-btn"
                onClick={() => handleOpenRecordPayment()}
              >
                💳 Record Payment
              </button>
              <button
                type="button"
                className="fin-action-btn"
                onClick={() => openModal && openModal('request')}
              >
                📄 Payment Request
              </button>
              <button
                type="button"
                className="fin-action-btn"
                onClick={handleExportClientsCSV}
              >
                📥 Export
              </button>
            </div>
          </div>

          {/* Section 5: Client KPI Summary (8 Real Metrics) */}
          <div className="fin-cm-summary-grid-8">
            <div className="fin-cm-summary-card">
              <div className="fin-cm-card-top">
                <span className="fin-cm-card-label">Total Clients</span>
                <span className="fin-cm-icon-pill blue">👥</span>
              </div>
              <div className="fin-cm-card-val">{summary.totalClients}</div>
              <div className="fin-cm-card-sub">Registered accounts</div>
            </div>

            <div className="fin-cm-summary-card">
              <div className="fin-cm-card-top">
                <span className="fin-cm-card-label">Total Billed</span>
                <span className="fin-cm-icon-pill blue">🧾</span>
              </div>
              <div className="fin-cm-card-val">{formatCurrency(summary.totalBilled)}</div>
              <div className="fin-cm-card-sub">Gross invoiced billing</div>
            </div>

            <div className="fin-cm-summary-card">
              <div className="fin-cm-card-top">
                <span className="fin-cm-card-label">Total Received</span>
                <span className="fin-cm-icon-pill green">💳</span>
              </div>
              <div className="fin-cm-card-val text-success">{formatCurrency(summary.totalReceived)}</div>
              <div className="fin-cm-card-sub">Collected cash inflow</div>
            </div>

            <div className="fin-cm-summary-card">
              <div className="fin-cm-card-top">
                <span className="fin-cm-card-label">Total Receivables</span>
                <span className="fin-cm-icon-pill orange">💰</span>
              </div>
              <div className="fin-cm-card-val text-orange">{formatCurrency(summary.totalReceivables)}</div>
              <div className="fin-cm-card-sub">Active unsettled balances</div>
            </div>

            <div className="fin-cm-summary-card">
              <div className="fin-cm-card-top">
                <span className="fin-cm-card-label">Overdue Amount</span>
                <span className="fin-cm-icon-pill red">⚠️</span>
              </div>
              <div className="fin-cm-card-val text-danger">{formatCurrency(summary.overdueAmount)}</div>
              <div className="fin-cm-card-sub">Past payment due date</div>
            </div>

            <div className="fin-cm-summary-card">
              <div className="fin-cm-card-top">
                <span className="fin-cm-card-label">Advance / Credit</span>
                <span className="fin-cm-icon-pill green">🏷️</span>
              </div>
              <div className="fin-cm-card-val text-success">{formatCurrency(summary.advanceBalance)}</div>
              <div className="fin-cm-card-sub">Unallocated client credits</div>
            </div>

            <div className="fin-cm-summary-card">
              <div className="fin-cm-card-top">
                <span className="fin-cm-card-label">Client Expenses</span>
                <span className="fin-cm-icon-pill red">💸</span>
              </div>
              <div className="fin-cm-card-val text-danger">{formatCurrency(summary.clientExpenses)}</div>
              <div className="fin-cm-card-sub">Direct client operations</div>
            </div>

            <div className="fin-cm-summary-card">
              <div className="fin-cm-card-top">
                <span className="fin-cm-card-label">Net Revenue</span>
                <span className="fin-cm-icon-pill green">📈</span>
              </div>
              <div className="fin-cm-card-val text-success">{formatCurrency(summary.netRevenue)}</div>
              <div className="fin-cm-card-sub">Received minus expenses</div>
            </div>
          </div>

          {/* Section 7: Client Search & Filter */}
          <div className="fin-cm-controls-bar">
            <div className="fin-cm-search-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="fin-search-icon">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search by client name, company, code, contact, email, GSTIN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="fin-cm-search-input"
              />
              {searchTerm && (
                <button type="button" className="fin-clear-search-btn" onClick={() => setSearchTerm('')}>
                  ✕
                </button>
              )}
            </div>

            <div className="fin-cm-filter-pills">
              {[
                { key: 'all', label: 'All Clients', count: clients.length },
                { key: 'outstanding', label: 'Outstanding', count: clients.filter((c) => Number(c.outstanding) > 0).length },
                { key: 'overdue', label: 'Overdue', count: clients.filter((c) => Number(c.overdue) > 0).length },
                { key: 'advance', label: 'Advance/Credit', count: clients.filter((c) => Number(c.advanceBalance) > 0 || c.financialStatus === 'Advance').length },
                { key: 'active', label: 'Active', count: clients.filter((c) => c.status !== 'Inactive').length },
                { key: 'inactive', label: 'Inactive', count: clients.filter((c) => c.status === 'Inactive').length },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`fin-cm-filter-pill ${filter === f.key ? 'active' : ''}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                  <span className="fin-cm-pill-count">{f.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 6: Client Master Table */}
          <div className="fin-table-container">
            <div className="fin-table-responsive">
              <table className="fin-data-table fin-cm-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Client Code</th>
                    <th>Company</th>
                    <th>Contact</th>
                    <th>GSTIN</th>
                    <th>Projects</th>
                    <th className="text-right">Total Billed</th>
                    <th className="text-right">Total Received</th>
                    <th className="text-right">Outstanding</th>
                    <th className="text-right">Overdue</th>
                    <th>Account Status</th>
                    <th>Last Payment</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.length === 0 ? (
                    <tr>
                      <td colSpan="13" className="fin-empty-td">
                        <div className="fin-empty-box">
                          <span>🔍</span>
                          <p>No client accounts match the active filter or search query.</p>
                          {searchTerm && (
                            <button
                              type="button"
                              className="fin-btn-secondary"
                              onClick={() => {
                                setSearchTerm('');
                                setFilter('all');
                              }}
                            >
                              Reset Filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredClients.map((c) => {
                      const hasOverdue = Number(c.overdue) > 0;
                      return (
                        <tr key={c._id} className={hasOverdue ? 'row-overdue-highlight' : ''}>
                          <td>
                            <div className="fin-cm-client-name-col">
                              <span className="fin-client-avatar">
                                {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                              </span>
                              <div>
                                <strong
                                  className="fin-client-clickable-title"
                                  onClick={() => handleOpenAccount(c, 'overview')}
                                  title="Open Client Financial Profile"
                                >
                                  {c.name}
                                </strong>
                                {c.contactPerson && <div className="fin-sub-text">Attn: {c.contactPerson}</div>}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="fin-code-badge">{c.clientCode || '—'}</span>
                          </td>
                          <td>{c.company || '—'}</td>
                          <td>
                            <div className="fin-contact-col">
                              {c.email && <div>{c.email}</div>}
                              {c.phone && <div className="fin-sub-text">{c.phone}</div>}
                            </div>
                          </td>
                          <td>
                            <small className="fin-gstin-text">{c.gstin || '—'}</small>
                          </td>
                          <td>
                            <span className="fin-badge count-badge">
                              {c.activeProjectsCount || (c.projects ? c.projects.length : 0)} Active
                            </span>
                          </td>
                          <td className="text-right font-weight-bold">
                            {formatCurrency(c.totalBilled)}
                          </td>
                          <td className="text-right text-success font-weight-bold">
                            {formatCurrency(c.totalReceived)}
                          </td>
                          <td className="text-right">
                            <span className={Number(c.outstanding) > 0 ? 'text-orange font-weight-bold' : 'text-muted'}>
                              {formatCurrency(c.outstanding)}
                            </span>
                          </td>
                          <td className="text-right">
                            <span className={Number(c.overdue) > 0 ? 'text-danger font-weight-bold' : 'text-muted'}>
                              {formatCurrency(c.overdue)}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`fin-badge ${
                                c.status === 'Inactive'
                                  ? 'inactive'
                                  : Number(c.overdue) > 0
                                  ? 'overdue'
                                  : Number(c.outstanding) > 0
                                  ? 'pending'
                                  : Number(c.advanceBalance) > 0
                                  ? 'paid'
                                  : 'clear'
                              }`}
                            >
                              {c.status === 'Inactive'
                                ? 'Inactive'
                                : Number(c.overdue) > 0
                                ? 'Overdue'
                                : Number(c.outstanding) > 0
                                ? 'Outstanding'
                                : Number(c.advanceBalance) > 0
                                ? 'Advance'
                                : 'Clear'}
                            </span>
                          </td>
                          <td>
                            {c.lastPayment ? (
                              <div className="fin-last-pay-col">
                                <strong>{formatCurrency(c.lastPayment.amount)}</strong>
                                <small>{formatDate(c.lastPayment.date)}</small>
                              </div>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            <div className="fin-cm-row-actions">
                              <button
                                type="button"
                                className="fin-cm-view-btn"
                                onClick={() => handleOpenAccount(c, 'overview')}
                                title="View Complete Financial Workspace"
                              >
                                View Financial Profile
                              </button>

                              <div className="fin-action-dropdown-wrap">
                                <button
                                  type="button"
                                  className="fin-cm-dots-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenDropdownId(openDropdownId === c._id ? null : c._id);
                                  }}
                                >
                                  •••
                                </button>
                                {openDropdownId === c._id && (
                                  <div className="fin-cm-dropdown-menu">
                                    <button type="button" onClick={() => handleOpenEditModal(c)}>
                                      ✏️ Edit Client
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedClient(c);
                                        handleOpenCreateInvoice();
                                      }}
                                    >
                                      🧾 Create Invoice
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedClient(c);
                                        handleOpenRecordPayment();
                                      }}
                                    >
                                      💳 Record Payment
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenAccount(c, 'statement')}
                                    >
                                      📄 Statement
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenAccount(c, 'ledger')}
                                    >
                                      📖 View Ledger
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedClient(c);
                                        handleOpenFollowUpModal();
                                      }}
                                    >
                                      📞 Log Follow-up
                                    </button>
                                    <div className="fin-dropdown-divider" />
                                    <button
                                      type="button"
                                      className={c.status === 'Inactive' ? 'text-success' : 'text-danger'}
                                      onClick={() => {
                                        setOpenDropdownId(null);
                                        handleToggleStatus(c);
                                      }}
                                    >
                                      {c.status === 'Inactive' ? '✅ Activate' : '🚫 Deactivate'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="fin-table-footer-bar">
              <span>Showing {filteredClients.length} of {clients.length} clients</span>
              <span className="text-muted">MongoDB Atlas Connected • Real-time Financial Master</span>
            </div>
          </div>
        </>
      ) : (
        /* ──────────────────────────────────────────────────────────
            CLIENT FINANCIAL PROFILE WORKSPACE (Section 8)
            ────────────────────────────────────────────────────────── */
        <div className="fin-account-workspace">
          {/* Client Header */}
          <div className="fin-account-topbar">
            <div className="fin-account-title-group">
              <button
                type="button"
                className="fin-back-btn"
                onClick={handleCloseAccount}
                title="Return to Client Register"
              >
                ← Back to Clients
              </button>

              <div className="fin-account-name-block">
                <span className="fin-client-avatar large">
                  {selectedClient.name ? selectedClient.name.charAt(0).toUpperCase() : 'C'}
                </span>
                <div>
                  <div className="fin-account-name-row">
                    <h2 className="fin-account-client-name">{accountData?.client?.name || selectedClient.name}</h2>
                    <span className="fin-code-badge large">
                      {accountData?.client?.clientCode || selectedClient.clientCode || '—'}
                    </span>
                    <span
                      className={`fin-badge ${
                        (accountData?.client?.status || selectedClient.status) === 'Inactive'
                          ? 'inactive'
                          : Number(accountData?.financials?.overdue) > 0
                          ? 'overdue'
                          : Number(accountData?.financials?.outstanding) > 0
                          ? 'pending'
                          : 'clear'
                      }`}
                    >
                      {(accountData?.client?.status || selectedClient.status) === 'Inactive'
                        ? 'Inactive'
                        : Number(accountData?.financials?.overdue) > 0
                        ? 'Overdue'
                        : Number(accountData?.financials?.outstanding) > 0
                        ? 'Outstanding'
                        : 'Clear'}
                    </span>
                  </div>
                  <div className="fin-account-company-sub">
                    {accountData?.client?.company || selectedClient.company || 'Enterprise Client'}
                    {accountData?.client?.gstin && ` • GSTIN: ${accountData.client.gstin}`}
                    {accountData?.client?.email && ` • ${accountData.client.email}`}
                    {accountData?.client?.phone && ` • ${accountData.client.phone}`}
                    {accountData?.client?.contactPerson && ` • Contact: ${accountData.client.contactPerson}`}
                  </div>
                </div>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="fin-account-btn-group">
              <button
                type="button"
                className="fin-action-btn primary"
                onClick={() => handleOpenCreateInvoice()}
              >
                + Create Invoice
              </button>
              <button
                type="button"
                className="fin-action-btn"
                onClick={() => handleOpenRecordPayment()}
              >
                💳 Record Payment
              </button>
              <button
                type="button"
                className="fin-action-btn"
                onClick={() => handleOpenCreditNote()}
              >
                📝 Credit Note
              </button>
              <button
                type="button"
                className="fin-action-btn"
                onClick={() => handleOpenAdvanceAdjust('ApplyToInvoice')}
              >
                ⚖️ Adjustment
              </button>
              <button
                type="button"
                className="fin-action-btn"
                onClick={handleOpenAddExpense}
              >
                💸 Add Expense
              </button>
              <button
                type="button"
                className="fin-action-btn"
                onClick={handleSendReminder}
              >
                🔔 Reminder
              </button>
              <button
                type="button"
                className="fin-action-btn"
                onClick={() => setAccountTab('statement')}
              >
                📄 Statement
              </button>
              <button
                type="button"
                className="fin-action-btn"
                onClick={() => handleOpenEditModal(selectedClient)}
              >
                ✏️ Edit Profile
              </button>
            </div>
          </div>

          {/* Section 8: Client Financial Summary Cards */}
          <div className="fin-ws-summary-grid">
            <div className="fin-ws-card">
              <span className="fin-ws-card-label">Contract Value</span>
              <span className="fin-ws-card-val">
                {formatCurrency(accountData?.financials?.contractValue ?? 0)}
              </span>
            </div>
            <div className="fin-ws-card">
              <span className="fin-ws-card-label">Total Invoiced</span>
              <span className="fin-ws-card-val">
                {formatCurrency(accountData?.financials?.totalBilled ?? selectedClient.totalBilled)}
              </span>
            </div>
            <div className="fin-ws-card">
              <span className="fin-ws-card-label">Total Received</span>
              <span className="fin-ws-card-val text-success">
                {formatCurrency(accountData?.financials?.totalReceived ?? selectedClient.totalReceived)}
              </span>
            </div>
            <div className="fin-ws-card">
              <span className="fin-ws-card-label">Outstanding</span>
              <span className={`fin-ws-card-val ${Number(accountData?.financials?.outstanding) > 0 ? 'text-orange' : ''}`}>
                {formatCurrency(accountData?.financials?.outstanding ?? selectedClient.outstanding)}
              </span>
            </div>
            <div className="fin-ws-card">
              <span className="fin-ws-card-label">Overdue</span>
              <span className={`fin-ws-card-val ${Number(accountData?.financials?.overdue) > 0 ? 'text-danger' : ''}`}>
                {formatCurrency(accountData?.financials?.overdue ?? selectedClient.overdue)}
              </span>
            </div>
            <div className="fin-ws-card">
              <span className="fin-ws-card-label">Advance Balance</span>
              <span className="fin-ws-card-val text-success">
                {formatCurrency(accountData?.financials?.advanceBalance ?? selectedClient.advanceBalance)}
              </span>
            </div>
            <div className="fin-ws-card">
              <span className="fin-ws-card-label">Client Expenses</span>
              <span className="fin-ws-card-val text-danger">
                {formatCurrency(accountData?.financials?.clientExpenses ?? 0)}
              </span>
            </div>
            <div className="fin-ws-card">
              <span className="fin-ws-card-label">Net Profit</span>
              <span className="fin-ws-card-val text-success">
                {formatCurrency(accountData?.financials?.netProfit ?? 0)}
              </span>
            </div>
            <div className="fin-ws-card">
              <span className="fin-ws-card-label">Profit Margin</span>
              <span className="fin-ws-card-val">
                {(accountData?.financials?.profitMargin ?? 0)}%
              </span>
            </div>
          </div>

          {/* Section 9: 14 Navigation Tabs */}
          <div className="fin-account-tabs-bar">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`fin-account-tab-btn ${accountTab === t.id ? 'active' : ''}`}
                onClick={() => setAccountTab(t.id)}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
                {t.count !== undefined && t.count > 0 && (
                  <span className="fin-account-tab-badge">{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Account Workspace Content Body */}
          {accountLoading ? (
            <div className="fin-loading-box">Loading client financial workspace from MongoDB Atlas...</div>
          ) : (
            <div className="fin-account-body">
              {/* ────────────────────────────────────────────────────────
                  TAB 1: OVERVIEW (Section 10)
                  ──────────────────────────────────────────────────────── */}
              {accountTab === 'overview' && (
                <div className="fin-account-section">
                  {/* Quick Action Center */}
                  <div className="fin-quick-actions-bar">
                    <span className="fin-sub-text" style={{ marginRight: '0.4rem', fontWeight: 600 }}>Quick Actions:</span>
                    <button type="button" className="fin-quick-action-btn primary" onClick={() => handleOpenCreateInvoice()}>
                      + Create Invoice
                    </button>
                    <button type="button" className="fin-quick-action-btn" onClick={() => handleOpenRecordPayment()}>
                      💳 Record Payment
                    </button>
                    <button type="button" className="fin-quick-action-btn" onClick={() => handleOpenFollowUpModal()}>
                      📞 Log Follow-up
                    </button>
                    <button type="button" className="fin-quick-action-btn" onClick={handleOpenAddExpense}>
                      💸 Add Expense
                    </button>
                    <button type="button" className="fin-quick-action-btn" onClick={() => handleOpenCreditNote()}>
                      📝 Credit Note
                    </button>
                    <button type="button" className="fin-quick-action-btn" onClick={() => setAccountTab('statement')}>
                      📄 Generate Statement
                    </button>
                    <button type="button" className="fin-quick-action-btn" onClick={handleSendReminder}>
                      🔔 Send Reminder
                    </button>
                  </div>

                  {/* Top Grid: Aging Snapshot & Recovery Snapshot */}
                  <div className="fin-profile-grid">
                    {/* Receivables Aging Snapshot */}
                    <div className="fin-card">
                      <div className="fin-card-header">
                        <h3>⏳ Receivables & Aging Snapshot</h3>
                        <button type="button" className="fin-action-btn fin-btn-sm" onClick={() => setAccountTab('receivables')}>
                          View Receivables
                        </button>
                      </div>
                      <div className="fin-details-list">
                        <div className="fin-detail-row">
                          <span>Current (0–30 Days)</span>
                          <strong className="text-success">{formatCurrency(accountData?.financials?.aging?.['0-30'] || 0)}</strong>
                        </div>
                        <div className="fin-detail-row">
                          <span>31–60 Days</span>
                          <strong className="text-primary">{formatCurrency(accountData?.financials?.aging?.['31-60'] || 0)}</strong>
                        </div>
                        <div className="fin-detail-row">
                          <span>61–90 Days</span>
                          <strong className="text-orange">{formatCurrency(accountData?.financials?.aging?.['61-90'] || 0)}</strong>
                        </div>
                        <div className="fin-detail-row">
                          <span>90+ Days (Severe Overdue)</span>
                          <strong className="text-danger">{formatCurrency(accountData?.financials?.aging?.['90+'] || 0)}</strong>
                        </div>
                        <div className="fin-detail-row" style={{ borderTop: '1px solid #cbd5e1', paddingTop: '0.4rem' }}>
                          <strong>Total Outstanding</strong>
                          <strong className="text-danger">{formatCurrency(accountData?.financials?.outstanding || 0)}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Account & Recovery Snapshot */}
                    <div className="fin-card">
                      <div className="fin-card-header">
                        <h3>📞 Payment Recovery & Follow-up</h3>
                        <button type="button" className="fin-action-btn fin-btn-sm" onClick={() => handleOpenFollowUpModal()}>
                          + Log Follow-up
                        </button>
                      </div>
                      <div className="fin-details-list">
                        <div className="fin-detail-row">
                          <span>Next Follow-up Scheduled</span>
                          <strong>
                            {accountData?.client?.nextFollowUp
                              ? formatDate(accountData.client.nextFollowUp)
                              : 'None scheduled'}
                          </strong>
                        </div>
                        <div className="fin-detail-row">
                          <span>Payment Terms</span>
                          <strong>{accountData?.client?.paymentTerms || 30} Days (Net)</strong>
                        </div>
                        <div className="fin-detail-row">
                          <span>Credit Limit</span>
                          <strong>{formatCurrency(accountData?.client?.creditLimit || 0)}</strong>
                        </div>
                        <div className="fin-detail-row">
                          <span>Available Advance Credit</span>
                          <strong className="text-success">{formatCurrency(accountData?.financials?.advanceBalance || 0)}</strong>
                        </div>
                        <div className="fin-detail-row">
                          <span>Latest Follow-up</span>
                          <span>
                            {accountData?.followUps?.[0]
                              ? `${accountData.followUps[0].status}: "${accountData.followUps[0].note.slice(0, 30)}..."`
                              : 'No follow-up logged yet'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Invoices & Recent Payments Grid */}
                  <div className="fin-profile-grid">
                    {/* Recent Invoices */}
                    <div className="fin-card">
                      <div className="fin-card-header">
                        <h3>🧾 Recent Invoices</h3>
                        <button type="button" className="fin-action-btn fin-btn-sm" onClick={() => setAccountTab('invoices')}>
                          View All ({accountData?.invoices?.length || 0})
                        </button>
                      </div>
                      {(!accountData?.invoices || accountData.invoices.length === 0) ? (
                        <div className="fin-empty-box" style={{ padding: '1.5rem' }}>
                          <p>No invoices generated yet.</p>
                          <button type="button" className="fin-action-btn fin-btn-sm primary" onClick={() => handleOpenCreateInvoice()}>
                            + Create First Invoice
                          </button>
                        </div>
                      ) : (
                        <div className="fin-table-responsive">
                          <table className="fin-data-table">
                            <thead>
                              <tr>
                                <th>Invoice #</th>
                                <th>Date</th>
                                <th className="text-right">Total</th>
                                <th className="text-right">Balance</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {accountData.invoices.slice(0, 4).map((inv) => (
                                <tr key={inv._id}>
                                  <td><strong>{inv.invoiceNumber}</strong></td>
                                  <td>{formatDate(inv.issueDate)}</td>
                                  <td className="text-right">{formatCurrency(inv.total || inv.amount)}</td>
                                  <td className="text-right text-orange font-weight-bold">{formatCurrency(inv.balance || 0)}</td>
                                  <td>
                                    <span className={`fin-badge ${inv.status ? inv.status.toLowerCase().replace(/\s+/g, '-') : 'sent'}`}>
                                      {inv.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Recent Payments */}
                    <div className="fin-card">
                      <div className="fin-card-header">
                        <h3>💳 Recent Payments & Collections</h3>
                        <button type="button" className="fin-action-btn fin-btn-sm" onClick={() => setAccountTab('payments')}>
                          View All ({accountData?.payments?.length || 0})
                        </button>
                      </div>
                      {(!accountData?.payments || accountData.payments.length === 0) ? (
                        <div className="fin-empty-box" style={{ padding: '1.5rem' }}>
                          <p>No payments recorded yet.</p>
                          <button type="button" className="fin-action-btn fin-btn-sm primary" onClick={() => handleOpenRecordPayment()}>
                            💳 Record Payment
                          </button>
                        </div>
                      ) : (
                        <div className="fin-table-responsive">
                          <table className="fin-data-table">
                            <thead>
                              <tr>
                                <th>Receipt / Ref</th>
                                <th>Date</th>
                                <th>Method</th>
                                <th className="text-right">Amount</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {accountData.payments.slice(0, 4).map((pay) => (
                                <tr key={pay._id}>
                                  <td><strong>{pay.receiptNumber || pay.paymentNumber || pay.transactionReference}</strong></td>
                                  <td>{formatDate(pay.paymentDate)}</td>
                                  <td>{pay.paymentMethod}</td>
                                  <td className="text-right text-success font-weight-bold">{formatCurrency(pay.amount)}</td>
                                  <td>
                                    <span className="fin-badge paid">{pay.status}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ────────────────────────────────────────────────────────
                  TAB 2: PROJECTS (Section 11)
                  ──────────────────────────────────────────────────────── */}
              {accountTab === 'projects' && (
                <div className="fin-account-section">
                  <div className="fin-table-header-row">
                    <h3>📁 Client Project Portfolio & Financials</h3>
                  </div>
                  {(!accountData?.projects || accountData.projects.length === 0) ? (
                    <div className="fin-empty-box" style={{ padding: '2.5rem' }}>
                      <span>📁</span>
                      <p>No projects are currently linked to this client account.</p>
                    </div>
                  ) : (
                    <div className="fin-table-responsive">
                      <table className="fin-data-table">
                        <thead>
                          <tr>
                            <th>Project Name</th>
                            <th>Category</th>
                            <th>Status</th>
                            <th className="text-right">Contract Budget</th>
                            <th className="text-right">Total Billed</th>
                            <th className="text-right">Received</th>
                            <th className="text-right">Outstanding</th>
                            <th className="text-right">Expenses</th>
                            <th className="text-right">Net Profit</th>
                            <th className="text-right">Margin</th>
                            <th className="text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accountData.projects.map((p) => (
                            <tr key={p._id}>
                              <td><strong>{p.name}</strong></td>
                              <td><span className="fin-badge count-badge">{p.category || 'Tech'}</span></td>
                              <td><span className={`fin-badge ${p.status ? p.status.toLowerCase().replace(/\s+/g, '-') : 'planning'}`}>{p.status}</span></td>
                              <td className="text-right font-weight-bold">{formatCurrency(p.budget || 0)}</td>
                              <td className="text-right">{formatCurrency(p.billed || 0)}</td>
                              <td className="text-right text-success">{formatCurrency(p.received || 0)}</td>
                              <td className="text-right text-orange">{formatCurrency(p.outstanding || 0)}</td>
                              <td className="text-right text-danger">{formatCurrency(p.expenses || 0)}</td>
                              <td className="text-right font-weight-bold text-success">{formatCurrency(p.netProfit || 0)}</td>
                              <td className="text-right font-weight-bold">{(p.profitMargin || 0)}%</td>
                              <td className="text-center">
                                <button
                                  type="button"
                                  className="fin-action-btn fin-btn-sm"
                                  onClick={() => handleOpenCreateInvoice(p)}
                                >
                                  + Invoice
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ────────────────────────────────────────────────────────
                  TAB 3: PROPOSALS / QUOTATIONS (Section 12)
                  ──────────────────────────────────────────────────────── */}
              {accountTab === 'proposals' && (
                <div className="fin-account-section">
                  <div className="fin-table-header-row">
                    <h3>📜 Client Quotations & Proposals</h3>
                    <button type="button" className="fin-action-btn primary" onClick={handleOpenCreateProposal}>
                      + Create Quotation
                    </button>
                  </div>
                  {(!accountData?.proposals || accountData.proposals.length === 0) ? (
                    <div className="fin-empty-box" style={{ padding: '2.5rem' }}>
                      <span>📜</span>
                      <p>No proposals or commercial quotations created for this client yet.</p>
                      <button type="button" className="fin-action-btn primary" onClick={handleOpenCreateProposal}>
                        + Create First Quotation
                      </button>
                    </div>
                  ) : (
                    <div className="fin-table-responsive">
                      <table className="fin-data-table">
                        <thead>
                          <tr>
                            <th>Proposal #</th>
                            <th>Title</th>
                            <th>Date</th>
                            <th>Valid Until</th>
                            <th>Items</th>
                            <th className="text-right">Total Amount</th>
                            <th>Status</th>
                            <th className="text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accountData.proposals.map((pr) => (
                            <tr key={pr._id}>
                              <td><strong>{pr.proposalNumber}</strong></td>
                              <td>{pr.title || 'Commercial Quotation'}</td>
                              <td>{formatDate(pr.createdAt || pr.proposalDate)}</td>
                              <td>{pr.validUntil ? formatDate(pr.validUntil) : '—'}</td>
                              <td>{pr.items ? pr.items.length : 1} line item(s)</td>
                              <td className="text-right font-weight-bold">{formatCurrency(pr.total || pr.totalAmount || 0)}</td>
                              <td>
                                <span className={`fin-badge ${pr.status ? pr.status.toLowerCase().replace(/\s+/g, '-') : 'draft'}`}>
                                  {pr.status}
                                </span>
                              </td>
                              <td className="text-center">
                                <div className="fin-table-actions-inline">
                                  {pr.status === 'Draft' && (
                                    <button
                                      type="button"
                                      className="fin-action-btn fin-btn-sm"
                                      onClick={() => handleApproveProposal(pr._id)}
                                      title="Approve Proposal"
                                    >
                                      ✓ Approve
                                    </button>
                                  )}
                                  {(pr.status === 'Sent' || pr.status === 'Accepted' || pr.approval?.status === 'Approved') && !pr.convertedInvoice && (
                                    <button
                                      type="button"
                                      className="fin-action-btn fin-btn-sm primary"
                                      onClick={() => handleConvertToInvoice(pr._id)}
                                      title="Convert to Live Invoice"
                                    >
                                      ➔ Invoice
                                    </button>
                                  )}
                                  {pr.convertedInvoice && (
                                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>Converted</span>
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
              )}

              {/* ────────────────────────────────────────────────────────
                  TAB 4: INVOICES (Section 13)
                  ──────────────────────────────────────────────────────── */}
              {accountTab === 'invoices' && (
                <div className="fin-account-section">
                  <div className="fin-table-header-row">
                    <h3>🧾 Client Invoices</h3>
                    <button type="button" className="fin-action-btn primary" onClick={() => handleOpenCreateInvoice()}>
                      + Create Invoice
                    </button>
                  </div>
                  {(!accountData?.invoices || accountData.invoices.length === 0) ? (
                    <div className="fin-empty-box" style={{ padding: '2.5rem' }}>
                      <span>🧾</span>
                      <p>No invoices found for this client account.</p>
                      <button type="button" className="fin-action-btn primary" onClick={() => handleOpenCreateInvoice()}>
                        + Create Invoice
                      </button>
                    </div>
                  ) : (
                    <div className="fin-table-responsive">
                      <table className="fin-data-table">
                        <thead>
                          <tr>
                            <th>Invoice #</th>
                            <th>Issue Date</th>
                            <th>Due Date</th>
                            <th className="text-right">Subtotal</th>
                            <th className="text-right">Tax (GST)</th>
                            <th className="text-right">Total</th>
                            <th className="text-right">Paid</th>
                            <th className="text-right">Balance</th>
                            <th>Status</th>
                            <th className="text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accountData.invoices.map((inv) => {
                            const subtotal = Number(inv.amount) || 0;
                            const tax = (Number(inv.cgst) || 0) + (Number(inv.sgst) || 0);
                            const total = Number(inv.total) || (subtotal + tax);
                            const paid = Number(inv.paidAmount) || 0;
                            const balance = inv.balance !== undefined ? Number(inv.balance) : Math.max(0, total - paid);

                            return (
                              <tr key={inv._id}>
                                <td><strong>{inv.invoiceNumber}</strong></td>
                                <td>{formatDate(inv.issueDate)}</td>
                                <td>{inv.dueDate ? formatDate(inv.dueDate) : '—'}</td>
                                <td className="text-right">{formatCurrency(subtotal)}</td>
                                <td className="text-right">{formatCurrency(tax)}</td>
                                <td className="text-right font-weight-bold">{formatCurrency(total)}</td>
                                <td className="text-right text-success">{formatCurrency(paid)}</td>
                                <td className="text-right text-orange font-weight-bold">{formatCurrency(balance)}</td>
                                <td>
                                  <span className={`fin-badge ${inv.status ? inv.status.toLowerCase().replace(/\s+/g, '-') : 'sent'}`}>
                                    {inv.status}
                                  </span>
                                </td>
                                <td className="text-center">
                                  <div className="fin-table-actions-inline">
                                    {balance > 0 && (
                                      <button
                                        type="button"
                                        className="fin-action-btn fin-btn-sm primary"
                                        onClick={() => handleOpenRecordPayment(inv)}
                                      >
                                        💳 Pay
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      className="fin-action-btn fin-btn-sm"
                                      onClick={() => handleOpenCreditNote(inv)}
                                    >
                                      Credit Note
                                    </button>
                                    <button
                                      type="button"
                                      className="fin-action-btn fin-btn-sm"
                                      onClick={() => window.print()}
                                    >
                                      🖨️ PDF
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
              )}

              {/* ────────────────────────────────────────────────────────
                  TAB 5: PAYMENTS (Section 14 & 15)
                  ──────────────────────────────────────────────────────── */}
              {accountTab === 'payments' && (
                <div className="fin-account-section">
                  <div className="fin-table-header-row">
                    <h3>💳 Payment Transactions & Receipts</h3>
                    <button type="button" className="fin-action-btn primary" onClick={() => handleOpenRecordPayment()}>
                      💳 Record Payment
                    </button>
                  </div>
                  {(!accountData?.payments || accountData.payments.length === 0) ? (
                    <div className="fin-empty-box" style={{ padding: '2.5rem' }}>
                      <span>💳</span>
                      <p>No payment records found for this client account.</p>
                      <button type="button" className="fin-action-btn primary" onClick={() => handleOpenRecordPayment()}>
                        Record Real Payment
                      </button>
                    </div>
                  ) : (
                    <div className="fin-table-responsive">
                      <table className="fin-data-table">
                        <thead>
                          <tr>
                            <th>Receipt / Payment #</th>
                            <th>Payment Date</th>
                            <th className="text-right">Amount</th>
                            <th>Payment Mode</th>
                            <th>Bank Account</th>
                            <th>Reference / UTR</th>
                            <th>Notes</th>
                            <th>Status</th>
                            <th className="text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accountData.payments.map((p) => (
                            <tr key={p._id}>
                              <td>
                                <strong>{p.receiptNumber || p.paymentNumber || 'RCPT-ONLINE'}</strong>
                              </td>
                              <td>{formatDate(p.paymentDate)}</td>
                              <td className="text-right font-weight-bold text-success">{formatCurrency(p.amount)}</td>
                              <td>{p.paymentMethod}</td>
                              <td>{p.bankAccountName || 'Company Bank'}</td>
                              <td><code>{p.transactionReference || '—'}</code></td>
                              <td><small>{p.notes || '—'}</small></td>
                              <td><span className="fin-badge paid">{p.status}</span></td>
                              <td className="text-center">
                                <button
                                  type="button"
                                  className="fin-action-btn fin-btn-sm"
                                  onClick={() => {
                                    setReceiptData({
                                      receiptNumber: p.receiptNumber || p.paymentNumber,
                                      clientName: selectedClient.name,
                                      clientCode: selectedClient.clientCode,
                                      amount: p.amount,
                                      paymentDate: p.paymentDate,
                                      paymentMethod: p.paymentMethod,
                                      transactionReference: p.transactionReference,
                                      notes: p.notes,
                                    });
                                    setIsReceiptModalOpen(true);
                                  }}
                                >
                                  📄 View Receipt
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ────────────────────────────────────────────────────────
                  TAB 6: RECEIVABLES (Section 16)
                  ──────────────────────────────────────────────────────── */}
              {accountTab === 'receivables' && (
                <div className="fin-account-section">
                  <div className="fin-aging-grid">
                    <div className="fin-aging-card current">
                      <span className="fin-aging-label">Current (0–30 Days)</span>
                      <span className="fin-aging-amount text-success">
                        {formatCurrency(accountData?.financials?.aging?.['0-30'] || 0)}
                      </span>
                    </div>
                    <div className="fin-aging-card days30">
                      <span className="fin-aging-label">31–60 Days Overdue</span>
                      <span className="fin-aging-amount text-primary">
                        {formatCurrency(accountData?.financials?.aging?.['31-60'] || 0)}
                      </span>
                    </div>
                    <div className="fin-aging-card days60">
                      <span className="fin-aging-label">61–90 Days Overdue</span>
                      <span className="fin-aging-amount text-orange">
                        {formatCurrency(accountData?.financials?.aging?.['61-90'] || 0)}
                      </span>
                    </div>
                    <div className="fin-aging-card days90">
                      <span className="fin-aging-label">90+ Days (High Risk)</span>
                      <span className="fin-aging-amount text-danger">
                        {formatCurrency(accountData?.financials?.aging?.['90+'] || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="fin-table-header-row">
                    <h3>⏳ Unsettled Invoices Breakdown</h3>
                  </div>
                  {(!accountData?.receivables || accountData.receivables.length === 0) ? (
                    <div className="fin-empty-box" style={{ padding: '2rem' }}>
                      <span className="text-success">✓</span>
                      <p>All client invoices are fully settled. Zero outstanding balance.</p>
                    </div>
                  ) : (
                    <div className="fin-table-responsive">
                      <table className="fin-data-table">
                        <thead>
                          <tr>
                            <th>Invoice #</th>
                            <th>Issue Date</th>
                            <th>Due Date</th>
                            <th className="text-right">Total</th>
                            <th className="text-right">Paid</th>
                            <th className="text-right">Outstanding Balance</th>
                            <th>Days Overdue</th>
                            <th>Aging Bucket</th>
                            <th>Status</th>
                            <th className="text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accountData.receivables.map((r) => (
                            <tr key={r.invoiceId}>
                              <td><strong>{r.invoiceNumber}</strong></td>
                              <td>{formatDate(r.issueDate)}</td>
                              <td>{formatDate(r.dueDate)}</td>
                              <td className="text-right">{formatCurrency(r.total)}</td>
                              <td className="text-right text-success">{formatCurrency(r.paidAmount)}</td>
                              <td className="text-right text-danger font-weight-bold">{formatCurrency(r.balance)}</td>
                              <td>
                                {r.daysOverdue > 0 ? (
                                  <span className="text-danger font-weight-bold">{r.daysOverdue} days</span>
                                ) : (
                                  <span className="text-success">Not overdue</span>
                                )}
                              </td>
                              <td>
                                <span className={`fin-badge ${r.bucket === '0-30' ? 'paid' : r.bucket === '31-60' ? 'pending' : 'overdue'}`}>
                                  {r.bucket}
                                </span>
                              </td>
                              <td><span className={`fin-badge ${r.status ? r.status.toLowerCase().replace(/\s+/g, '-') : 'sent'}`}>{r.status}</span></td>
                              <td className="text-center">
                                <button
                                  type="button"
                                  className="fin-action-btn fin-btn-sm primary"
                                  onClick={() => handleOpenRecordPayment({ _id: r.invoiceId, balance: r.balance, invoiceNumber: r.invoiceNumber })}
                                >
                                  💳 Pay Now
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ────────────────────────────────────────────────────────
                  TAB 7: PAYMENT RECOVERY (Section 17)
                  ──────────────────────────────────────────────────────── */}
              {accountTab === 'recovery' && (
                <div className="fin-account-section">
                  <div className="fin-table-header-row">
                    <div>
                      <h3>📞 Payment Recovery & Follow-up Log</h3>
                      <p className="fin-sub-text">
                        Track collection follow-ups, promises to pay, and debt recovery history.
                      </p>
                    </div>
                    <div className="fin-cm-header-actions">
                      <button type="button" className="fin-action-btn primary" onClick={() => handleOpenFollowUpModal()}>
                        + Log Follow-up / Promise
                      </button>
                      <button type="button" className="fin-action-btn" onClick={handleSendReminder}>
                        🔔 Send Reminder
                      </button>
                    </div>
                  </div>

                  {(!accountData?.followUps || accountData.followUps.length === 0) ? (
                    <div className="fin-empty-box" style={{ padding: '2.5rem' }}>
                      <span>📞</span>
                      <p>No follow-up records or collection attempts logged yet.</p>
                      <button type="button" className="fin-action-btn primary" onClick={() => handleOpenFollowUpModal()}>
                        Log Initial Follow-up
                      </button>
                    </div>
                  ) : (
                    <div className="fin-table-responsive">
                      <table className="fin-data-table">
                        <thead>
                          <tr>
                            <th>Follow-up Date</th>
                            <th>Staff</th>
                            <th>Status</th>
                            <th>Related Invoice</th>
                            <th>Promise Date</th>
                            <th>Discussion Notes & Summary</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accountData.followUps.map((fu, idx) => (
                            <tr key={idx}>
                              <td>{formatDate(fu.date)}</td>
                              <td><strong>{fu.followUpBy}</strong></td>
                              <td>
                                <span className={`fin-badge ${fu.status ? fu.status.toLowerCase().replace(/\s+/g, '-') : 'in-progress'}`}>
                                  {fu.status}
                                </span>
                              </td>
                              <td>{fu.invoiceNumber ? `#${fu.invoiceNumber}` : 'General / All Invoices'}</td>
                              <td>{fu.promiseToPayDate ? formatDate(fu.promiseToPayDate) : '—'}</td>
                              <td>{fu.note}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ────────────────────────────────────────────────────────
                  TAB 8: ADVANCES & CREDITS (Section 18)
                  ──────────────────────────────────────────────────────── */}
              {accountTab === 'advances' && (
                <div className="fin-account-section">
                  <div className="fin-table-header-row">
                    <div>
                      <h3>🏷️ Advances, Credits & Adjustments</h3>
                      <p className="fin-sub-text">
                        Current Available Advance Credit: <strong className="text-success">{formatCurrency(accountData?.financials?.advanceBalance || 0)}</strong>
                      </p>
                    </div>
                    <div className="fin-cm-header-actions">
                      <button
                        type="button"
                        className="fin-action-btn primary"
                        onClick={() => {
                          setPaymentFormData({
                            amount: '',
                            paymentDate: new Date().toISOString().slice(0, 10),
                            paymentMethod: 'Bank Transfer',
                            bankAccountId: bankAccounts[0]?._id || '',
                            transactionReference: `UTR-ADV-${Date.now().toString().slice(-4)}`,
                            notes: 'Advance deposit from client',
                            isAdvance: true,
                          });
                          setPaymentAllocations([]);
                          setIsRecordPaymentModalOpen(true);
                        }}
                      >
                        + Record Advance Deposit
                      </button>
                      <button
                        type="button"
                        className="fin-action-btn"
                        onClick={() => handleOpenAdvanceAdjust('ApplyToInvoice')}
                      >
                        ⚖️ Apply Advance to Invoice
                      </button>
                      <button
                        type="button"
                        className="fin-action-btn"
                        onClick={() => handleOpenAdvanceAdjust('Refund')}
                      >
                        💸 Refund Advance
                      </button>
                      <button
                        type="button"
                        className="fin-action-btn"
                        onClick={() => handleOpenCreditNote()}
                      >
                        📝 Create Credit Note
                      </button>
                    </div>
                  </div>

                  {/* Credit Notes Table */}
                  <div className="fin-card" style={{ marginTop: '0.75rem' }}>
                    <div className="fin-card-header">
                      <h3>Credit Notes Issued</h3>
                    </div>
                    {(!accountData?.creditNotes || accountData.creditNotes.length === 0) ? (
                      <div className="fin-empty-box" style={{ padding: '1.5rem' }}>
                        <p>No credit notes have been issued for this client.</p>
                      </div>
                    ) : (
                      <div className="fin-table-responsive">
                        <table className="fin-data-table">
                          <thead>
                            <tr>
                              <th>Credit Note #</th>
                              <th>Issued Date</th>
                              <th>Invoice #</th>
                              <th className="text-right">Credit Amount</th>
                              <th>Reason</th>
                              <th>Issued By</th>
                            </tr>
                          </thead>
                          <tbody>
                            {accountData.creditNotes.map((cn, idx) => (
                              <tr key={idx}>
                                <td><strong>{cn.creditNoteNumber}</strong></td>
                                <td>{formatDate(cn.issuedDate || cn.createdAt)}</td>
                                <td>#{cn.invoiceNumber}</td>
                                <td className="text-right text-success font-weight-bold">{formatCurrency(cn.amount)}</td>
                                <td>{cn.reason}</td>
                                <td>{cn.issuedByName || 'Finance Admin'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ────────────────────────────────────────────────────────
                  TAB 9: CLIENT EXPENSES (Section 19)
                  ──────────────────────────────────────────────────────── */}
              {accountTab === 'expenses' && (
                <div className="fin-account-section">
                  <div className="fin-table-header-row">
                    <div>
                      <h3>💸 Client & Project Operational Expenses</h3>
                      <p className="fin-sub-text">
                        Total Client Expenses: <strong className="text-danger">{formatCurrency(accountData?.financials?.clientExpenses || 0)}</strong>
                      </p>
                    </div>
                    <button type="button" className="fin-action-btn primary" onClick={handleOpenAddExpense}>
                      + Add Client Expense
                    </button>
                  </div>
                  {(!accountData?.expenses || accountData.expenses.length === 0) ? (
                    <div className="fin-empty-box" style={{ padding: '2.5rem' }}>
                      <span>💸</span>
                      <p>No client or project expenses recorded.</p>
                      <button type="button" className="fin-action-btn primary" onClick={handleOpenAddExpense}>
                        Record Client Expense
                      </button>
                    </div>
                  ) : (
                    <div className="fin-table-responsive">
                      <table className="fin-data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Expense Title / Particulars</th>
                            <th>Category</th>
                            <th>Project</th>
                            <th>Vendor</th>
                            <th className="text-right">Amount</th>
                            <th>Payment Mode</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accountData.expenses.map((e) => (
                            <tr key={e._id}>
                              <td>{formatDate(e.expenseDate)}</td>
                              <td><strong>{e.title}</strong></td>
                              <td><span className="fin-badge count-badge">{e.category}</span></td>
                              <td>{e.projectName || '—'}</td>
                              <td>{e.vendorName || '—'}</td>
                              <td className="text-right font-weight-bold text-danger">{formatCurrency(e.amount)}</td>
                              <td>{e.paymentMethod}</td>
                              <td><span className="fin-badge paid">{e.paymentStatus}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ────────────────────────────────────────────────────────
                  TAB 10: LEDGER (Section 21)
                  ──────────────────────────────────────────────────────── */}
              {accountTab === 'ledger' && (
                <div className="fin-account-section">
                  <div className="fin-table-header-row">
                    <div>
                      <h3>📖 Chronological Client Sub-Ledger</h3>
                      <p className="fin-sub-text">Complete chronological debit/credit transaction record</p>
                    </div>
                    <div className="fin-cm-header-actions">
                      <button type="button" className="fin-action-btn" onClick={handleExportLedgerCSV}>
                        📥 Export CSV
                      </button>
                      <button type="button" className="fin-action-btn" onClick={() => window.print()}>
                        🖨️ Print Ledger
                      </button>
                    </div>
                  </div>

                  {/* Ledger Filters Bar */}
                  <div className="fin-cm-controls-bar">
                    <div className="fin-date-filter-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className="fin-sub-text">Filter Range:</span>
                      <input
                        type="date"
                        value={ledgerStartDate}
                        onChange={(e) => setLedgerStartDate(e.target.value)}
                        className="fin-cm-search-input"
                        style={{ maxWidth: '160px' }}
                      />
                      <span>to</span>
                      <input
                        type="date"
                        value={ledgerEndDate}
                        onChange={(e) => setLedgerEndDate(e.target.value)}
                        className="fin-cm-search-input"
                        style={{ maxWidth: '160px' }}
                      />
                      {(ledgerStartDate || ledgerEndDate) && (
                        <button
                          type="button"
                          className="fin-btn-secondary"
                          onClick={() => {
                            setLedgerStartDate('');
                            setLedgerEndDate('');
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="fin-account-quick-pills">
                      <div className="fin-quick-stat">
                        <small>Total Debits (Billed)</small>
                        <strong>{formatCurrency(ledgerTotals.debits)}</strong>
                      </div>
                      <div className="fin-quick-stat">
                        <small>Total Credits (Paid/Credits)</small>
                        <strong className="text-success">{formatCurrency(ledgerTotals.credits)}</strong>
                      </div>
                      <div className="fin-quick-stat">
                        <small>Closing Balance Due</small>
                        <strong className={ledgerTotals.closingBalance > 0 ? 'text-danger' : 'text-success'}>
                          {formatCurrency(ledgerTotals.closingBalance)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {filteredLedger.length === 0 ? (
                    <div className="fin-empty-box" style={{ padding: '2.5rem' }}>
                      <span>📖</span>
                      <p>No transactions found for the specified period.</p>
                    </div>
                  ) : (
                    <div className="fin-table-responsive">
                      <table className="fin-data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Transaction Type</th>
                            <th>Reference #</th>
                            <th>Particulars / Description</th>
                            <th className="text-right">Debit (₹)</th>
                            <th className="text-right">Credit (₹)</th>
                            <th className="text-right">Running Balance (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLedger.map((row) => (
                            <tr key={row.id}>
                              <td>{formatDate(row.date)}</td>
                              <td>
                                <span className={`fin-badge ${row.type === 'Invoice' ? 'pending' : row.type === 'Payment' ? 'paid' : 'count-badge'}`}>
                                  {row.type}
                                </span>
                              </td>
                              <td><strong>{row.reference}</strong></td>
                              <td>{row.description}</td>
                              <td className="text-right">{row.debit > 0 ? formatCurrency(row.debit) : '—'}</td>
                              <td className="text-right text-success">{row.credit > 0 ? formatCurrency(row.credit) : '—'}</td>
                              <td className="text-right font-weight-bold">
                                {formatCurrency(row.balance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ────────────────────────────────────────────────────────
                  TAB 11: STATEMENT OF ACCOUNT (Section 22)
                  ──────────────────────────────────────────────────────── */}
              {accountTab === 'statement' && (
                <div className="fin-account-section">
                  <div className="fin-table-header-row fin-no-print">
                    <div>
                      <h3>📄 Client Statement of Account</h3>
                      <p className="fin-sub-text">Generate official periodic account statement for billing remittance</p>
                    </div>
                    <div className="fin-cm-header-actions">
                      <div className="fin-filter-group" style={{ display: 'flex', gap: '0.35rem' }}>
                        {['all', 'thisMonth', 'thisQuarter', 'thisFY'].map((p) => (
                          <button
                            key={p}
                            type="button"
                            className={`fin-quick-action-btn ${statementPeriod === p ? 'primary' : ''}`}
                            onClick={() => setStatementPeriod(p)}
                          >
                            {p === 'all' ? 'All Time' : p === 'thisMonth' ? 'This Month' : p === 'thisQuarter' ? 'This Quarter' : 'Financial Year'}
                          </button>
                        ))}
                      </div>
                      <button type="button" className="fin-action-btn" onClick={() => window.print()}>
                        🖨️ Print Statement
                      </button>
                    </div>
                  </div>

                  {/* Printable Statement Sheet */}
                  <div className="fin-statement-container">
                    <div className="fin-statement-header">
                      <div className="fin-statement-company-info">
                        <h3>AASHA SM TECHNOLOGIES</h3>
                        <p>Corporate Office: Mumbai, Maharashtra, India</p>
                        <p>GSTIN: 27AABCU9603R1ZM • Email: accounts@aashasmtech.com</p>
                      </div>
                      <div className="fin-statement-doc-info">
                        <div className="fin-statement-title">STATEMENT OF ACCOUNT</div>
                        <p style={{ margin: '0.2rem 0', fontSize: '0.8rem', color: '#64748b' }}>
                          Generated on: {new Date().toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    </div>

                    <div className="fin-statement-grid-2">
                      <div className="fin-statement-client-box">
                        <h4>Billed To:</h4>
                        <p><strong>{accountData?.client?.name || selectedClient.name}</strong></p>
                        {accountData?.client?.company && <p>{accountData.client.company}</p>}
                        {accountData?.client?.billingAddress && <p>{accountData.client.billingAddress}</p>}
                        {accountData?.client?.gstin && <p>GSTIN: {accountData.client.gstin}</p>}
                        {accountData?.client?.clientCode && <p>Account Code: {accountData.client.clientCode}</p>}
                      </div>
                      <div className="fin-statement-summary-box">
                        <h4>Account Summary:</h4>
                        <table className="fin-statement-summary-table">
                          <tbody>
                            <tr>
                              <td>Opening Balance:</td>
                              <td className="text-right"><strong>{formatCurrency(statementTransactions.openingBal)}</strong></td>
                            </tr>
                            <tr>
                              <td>Period Invoiced (Debits):</td>
                              <td className="text-right">{formatCurrency(statementTransactions.periodDebits)}</td>
                            </tr>
                            <tr>
                              <td>Period Paid / Credits:</td>
                              <td className="text-right text-success">{formatCurrency(statementTransactions.periodCredits)}</td>
                            </tr>
                            <tr className="fin-statement-closing-row">
                              <td>Total Amount Due:</td>
                              <td className="text-right"><strong>{formatCurrency(statementTransactions.closingBal)}</strong></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="fin-table-responsive">
                      <table className="fin-data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Ref #</th>
                            <th>Description</th>
                            <th className="text-right">Debit (₹)</th>
                            <th className="text-right">Credit (₹)</th>
                            <th className="text-right">Balance Due (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {statementTransactions.transactions.map((tx) => (
                            <tr key={tx.id}>
                              <td>{formatDate(tx.date)}</td>
                              <td><strong>{tx.reference}</strong></td>
                              <td>{tx.description}</td>
                              <td className="text-right">{tx.debit > 0 ? formatCurrency(tx.debit) : '—'}</td>
                              <td className="text-right text-success">{tx.credit > 0 ? formatCurrency(tx.credit) : '—'}</td>
                              <td className="text-right font-weight-bold">{formatCurrency(tx.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ────────────────────────────────────────────────────────
                  TAB 12: DOCUMENTS (Section 23)
                  ──────────────────────────────────────────────────────── */}
              {accountTab === 'documents' && (
                <div className="fin-account-section">
                  <div className="fin-table-header-row">
                    <h3>📁 Financial Documents Repository</h3>
                  </div>
                  {(!accountData?.documents || accountData.documents.length === 0) ? (
                    <div className="fin-empty-box" style={{ padding: '2.5rem' }}>
                      <span>📁</span>
                      <p>No financial documents available for this client.</p>
                    </div>
                  ) : (
                    <div className="fin-table-responsive">
                      <table className="fin-data-table">
                        <thead>
                          <tr>
                            <th>Document Type</th>
                            <th>Document # / Identifier</th>
                            <th>Date</th>
                            <th className="text-right">Amount</th>
                            <th>Status</th>
                            <th className="text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accountData.documents.map((doc, idx) => (
                            <tr key={idx}>
                              <td><strong>{doc.type}</strong></td>
                              <td><code>{doc.number}</code></td>
                              <td>{formatDate(doc.date)}</td>
                              <td className="text-right font-weight-bold">{formatCurrency(doc.amount)}</td>
                              <td><span className="fin-badge paid">{doc.status}</span></td>
                              <td className="text-center">
                                <button
                                  type="button"
                                  className="fin-action-btn fin-btn-sm"
                                  onClick={() => window.print()}
                                >
                                  👁️ View / Print
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ────────────────────────────────────────────────────────
                  TAB 13: PROFITABILITY (Section 20)
                  ──────────────────────────────────────────────────────── */}
              {accountTab === 'profitability' && (
                <div className="fin-account-section">
                  <div className="fin-table-header-row">
                    <div>
                      <h3>📈 Client Profitability & ROI Performance</h3>
                      <p className="fin-sub-text">Actual cash inflow vs direct project & client expenditures</p>
                    </div>
                  </div>

                  <div className="fin-profitability-cards">
                    <div className="fin-profit-card">
                      <span className="fin-ws-card-label">Collected Revenue</span>
                      <span className="fin-ws-card-val text-success">
                        {formatCurrency(accountData?.profitability?.revenue ?? 0)}
                      </span>
                    </div>
                    <div className="fin-profit-card">
                      <span className="fin-ws-card-label">Billed Invoiced</span>
                      <span className="fin-ws-card-val">
                        {formatCurrency(accountData?.profitability?.billedRevenue ?? 0)}
                      </span>
                    </div>
                    <div className="fin-profit-card">
                      <span className="fin-ws-card-label">Client Expenses</span>
                      <span className="fin-ws-card-val text-danger">
                        {formatCurrency(accountData?.profitability?.expenses ?? 0)}
                      </span>
                    </div>
                    <div className="fin-profit-card">
                      <span className="fin-ws-card-label">Net Profit</span>
                      <span className="fin-ws-card-val font-weight-bold text-success">
                        {formatCurrency(accountData?.profitability?.netProfit ?? 0)}
                      </span>
                    </div>
                    <div className="fin-profit-card">
                      <span className="fin-ws-card-label">Profit Margin %</span>
                      <span className="fin-ws-card-val">
                        {(accountData?.profitability?.profitMargin ?? 0)}%
                      </span>
                      <span className={`fin-profit-badge ${(accountData?.profitability?.profitMargin ?? 0) >= 30 ? 'high' : (accountData?.profitability?.profitMargin ?? 0) >= 10 ? 'medium' : 'low'}`}>
                        {(accountData?.profitability?.profitMargin ?? 0) >= 30 ? 'High Margin' : (accountData?.profitability?.profitMargin ?? 0) >= 10 ? 'Healthy' : 'Low Margin'}
                      </span>
                    </div>
                  </div>

                  {/* Project Breakdown Table */}
                  <div className="fin-card">
                    <div className="fin-card-header">
                      <h3>Project Profitability Breakdown</h3>
                    </div>
                    {(!accountData?.profitability?.projectBreakdown || accountData.profitability.projectBreakdown.length === 0) ? (
                      <div className="fin-empty-box" style={{ padding: '2rem' }}>
                        <p>No project breakdown available for this client yet.</p>
                      </div>
                    ) : (
                      <div className="fin-table-responsive">
                        <table className="fin-data-table">
                          <thead>
                            <tr>
                              <th>Project</th>
                              <th className="text-right">Contract Budget</th>
                              <th className="text-right">Invoiced</th>
                              <th className="text-right">Received</th>
                              <th className="text-right">Expenses</th>
                              <th className="text-right">Net Profit</th>
                              <th className="text-right">Margin %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {accountData.profitability.projectBreakdown.map((p) => (
                              <tr key={p._id}>
                                <td><strong>{p.name}</strong></td>
                                <td className="text-right">{formatCurrency(p.budget || 0)}</td>
                                <td className="text-right">{formatCurrency(p.billed || 0)}</td>
                                <td className="text-right text-success">{formatCurrency(p.received || 0)}</td>
                                <td className="text-right text-danger">{formatCurrency(p.expenses || 0)}</td>
                                <td className="text-right font-weight-bold text-success">{formatCurrency(p.netProfit || 0)}</td>
                                <td className="text-right font-weight-bold">{(p.profitMargin || 0)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ────────────────────────────────────────────────────────
                  TAB 14: AUDIT HISTORY (Section 24)
                  ──────────────────────────────────────────────────────── */}
              {accountTab === 'audit' && (
                <div className="fin-account-section">
                  <div className="fin-table-header-row">
                    <div>
                      <h3>🛡️ Real Financial Audit Trail</h3>
                      <p className="fin-sub-text">Immutable record of financial transactions, payments, and approvals</p>
                    </div>
                  </div>
                  {(!accountData?.auditHistory || accountData.auditHistory.length === 0) ? (
                    <div className="fin-empty-box" style={{ padding: '2.5rem' }}>
                      <span>🛡️</span>
                      <p>No audit trail records logged for this client yet.</p>
                    </div>
                  ) : (
                    <div className="fin-table-responsive">
                      <table className="fin-data-table">
                        <thead>
                          <tr>
                            <th>Timestamp</th>
                            <th>Action</th>
                            <th>Performed By</th>
                            <th>Reference</th>
                            <th className="text-right">Amount</th>
                            <th>Reason / Activity Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accountData.auditHistory.map((a, idx) => (
                            <tr key={idx}>
                              <td>{formatDate(a.timestamp || a.createdAt)}</td>
                              <td><strong>{a.action}</strong></td>
                              <td>{a.performedByName || 'Finance User'}</td>
                              <td><code>{a.reference || '—'}</code></td>
                              <td className="text-right font-weight-bold">
                                {a.amount !== undefined ? formatCurrency(a.amount) : '—'}
                              </td>
                              <td>{a.reason || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL: CREATE CLIENT
          ────────────────────────────────────────────────────────── */}
      {isCreateClientModalOpen && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Create New Client Account</h3>
              <button type="button" className="fin-modal-close-btn" onClick={() => setIsCreateClientModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveCreateClient}>
              <div className="fin-modal-body">
                {clientError && <div className="fin-form-error">{clientError}</div>}
                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Client Name *</label>
                    <input
                      type="text"
                      required
                      value={clientFormData.name}
                      onChange={(e) => setClientFormData({ ...clientFormData, name: e.target.value })}
                      placeholder="e.g. Apex Global Ltd"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Company / Organization</label>
                    <input
                      type="text"
                      value={clientFormData.company}
                      onChange={(e) => setClientFormData({ ...clientFormData, company: e.target.value })}
                      placeholder="e.g. Apex Enterprises"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Email Address *</label>
                    <input
                      type="email"
                      required
                      value={clientFormData.email}
                      onChange={(e) => setClientFormData({ ...clientFormData, email: e.target.value })}
                      placeholder="accounts@apex.com"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Phone Number</label>
                    <input
                      type="text"
                      value={clientFormData.phone}
                      onChange={(e) => setClientFormData({ ...clientFormData, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Contact Person</label>
                    <input
                      type="text"
                      value={clientFormData.contactPerson}
                      onChange={(e) => setClientFormData({ ...clientFormData, contactPerson: e.target.value })}
                      placeholder="e.g. Rahul Sharma"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Client Code (Auto-generated if empty)</label>
                    <input
                      type="text"
                      value={clientFormData.clientCode}
                      onChange={(e) => setClientFormData({ ...clientFormData, clientCode: e.target.value })}
                      placeholder="e.g. CLI-2026-0005"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>GSTIN</label>
                    <input
                      type="text"
                      value={clientFormData.gstin}
                      onChange={(e) => setClientFormData({ ...clientFormData, gstin: e.target.value.toUpperCase() })}
                      placeholder="27AABCU9603R1ZM"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>PAN</label>
                    <input
                      type="text"
                      value={clientFormData.pan}
                      onChange={(e) => setClientFormData({ ...clientFormData, pan: e.target.value.toUpperCase() })}
                      placeholder="AABCU9603R"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Payment Terms (Days)</label>
                    <input
                      type="number"
                      value={clientFormData.paymentTerms}
                      onChange={(e) => setClientFormData({ ...clientFormData, paymentTerms: e.target.value })}
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Credit Limit (₹)</label>
                    <input
                      type="number"
                      value={clientFormData.creditLimit}
                      onChange={(e) => setClientFormData({ ...clientFormData, creditLimit: e.target.value })}
                    />
                  </div>
                </div>
                <div className="fin-form-group" style={{ marginTop: '0.75rem' }}>
                  <label>Billing Address</label>
                  <textarea
                    rows="2"
                    value={clientFormData.billingAddress}
                    onChange={(e) => setClientFormData({ ...clientFormData, billingAddress: e.target.value })}
                    placeholder="Enter complete office billing address"
                  />
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={() => setIsCreateClientModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="fin-action-btn primary" disabled={clientLoading}>
                  {clientLoading ? 'Registering...' : 'Register Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL: EDIT CLIENT PROFILE
          ────────────────────────────────────────────────────────── */}
      {isEditModalOpen && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Edit Financial Profile — {editFormData.name}</h3>
              <button type="button" className="fin-modal-close-btn" onClick={() => setIsEditModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveEditProfile}>
              <div className="fin-modal-body">
                {editError && <div className="fin-form-error">{editError}</div>}
                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Client Name *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.name || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Company</label>
                    <input
                      type="text"
                      value={editFormData.company || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, company: e.target.value })}
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      required
                      value={editFormData.email || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Phone</label>
                    <input
                      type="text"
                      value={editFormData.phone || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Contact Person</label>
                    <input
                      type="text"
                      value={editFormData.contactPerson || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, contactPerson: e.target.value })}
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>GSTIN</label>
                    <input
                      type="text"
                      value={editFormData.gstin || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, gstin: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>PAN</label>
                    <input
                      type="text"
                      value={editFormData.pan || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, pan: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Payment Terms (Days)</label>
                    <input
                      type="number"
                      value={editFormData.paymentTerms || 30}
                      onChange={(e) => setEditFormData({ ...editFormData, paymentTerms: e.target.value })}
                    />
                  </div>
                </div>
                <div className="fin-form-group" style={{ marginTop: '0.75rem' }}>
                  <label>Billing Address</label>
                  <textarea
                    rows="2"
                    value={editFormData.billingAddress || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, billingAddress: e.target.value })}
                  />
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="fin-action-btn primary" disabled={editLoading}>
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL: CREATE INVOICE
          ────────────────────────────────────────────────────────── */}
      {isCreateInvoiceModalOpen && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Create Invoice for {invoiceFormData.clientName || selectedClient?.name}</h3>
              <button type="button" className="fin-modal-close-btn" onClick={() => setIsCreateInvoiceModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveCreateInvoice}>
              <div className="fin-modal-body">
                {invoiceError && <div className="fin-form-error">{invoiceError}</div>}
                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Taxable Amount (Subtotal) *</label>
                    <input
                      type="number"
                      required
                      value={invoiceFormData.amount}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, amount: e.target.value })}
                      placeholder="e.g. 50000"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Project (Optional)</label>
                    <select
                      value={invoiceFormData.projectId}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, projectId: e.target.value })}
                    >
                      <option value="">General Client Invoice</option>
                      {accountData?.projects?.map((p) => (
                        <option key={p._id} value={p._id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="fin-form-group">
                    <label>CGST (9%)</label>
                    <input
                      type="number"
                      placeholder="Calculated automatically if empty"
                      value={invoiceFormData.cgst}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, cgst: e.target.value })}
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>SGST (9%)</label>
                    <input
                      type="number"
                      placeholder="Calculated automatically if empty"
                      value={invoiceFormData.sgst}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, sgst: e.target.value })}
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Issue Date</label>
                    <input
                      type="date"
                      value={invoiceFormData.issueDate}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, issueDate: e.target.value })}
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Due Date</label>
                    <input
                      type="date"
                      value={invoiceFormData.dueDate}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, dueDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="fin-form-group" style={{ marginTop: '0.75rem' }}>
                  <label>Description & Scope of Services</label>
                  <textarea
                    rows="2"
                    value={invoiceFormData.description}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, description: e.target.value })}
                    placeholder="Enter invoice particulars..."
                  />
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={() => setIsCreateInvoiceModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="fin-action-btn primary" disabled={invoiceLoading}>
                  {invoiceLoading ? 'Generating...' : 'Generate Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL: RECORD PAYMENT
          ────────────────────────────────────────────────────────── */}
      {isRecordPaymentModalOpen && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Record Client Payment — {selectedClient?.name}</h3>
              <button type="button" className="fin-modal-close-btn" onClick={() => setIsRecordPaymentModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveRecordPayment}>
              <div className="fin-modal-body">
                {paymentError && <div className="fin-form-error">{paymentError}</div>}
                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Payment Amount *</label>
                    <input
                      type="number"
                      required
                      value={paymentFormData.amount}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                      placeholder="e.g. 50000"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Payment Mode</label>
                    <select
                      value={paymentFormData.paymentMethod}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentMethod: e.target.value })}
                    >
                      <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                      <option value="UPI">UPI</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                    </select>
                  </div>
                  <div className="fin-form-group">
                    <label>Deposited into Bank Account</label>
                    <select
                      value={paymentFormData.bankAccountId}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, bankAccountId: e.target.value })}
                    >
                      <option value="">Default Operating Account</option>
                      {bankAccounts.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.bankName} - {b.accountName} ({formatCurrency(b.currentBalance)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="fin-form-group">
                    <label>Transaction Reference / UTR *</label>
                    <input
                      type="text"
                      required
                      value={paymentFormData.transactionReference}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, transactionReference: e.target.value })}
                      placeholder="e.g. UTR-987654321"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Payment Date</label>
                    <input
                      type="date"
                      value={paymentFormData.paymentDate}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentDate: e.target.value })}
                    />
                  </div>
                  <div className="fin-form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
                    <input
                      type="checkbox"
                      id="isAdvanceCheckbox"
                      checked={paymentFormData.isAdvance}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, isAdvance: e.target.checked })}
                    />
                    <label htmlFor="isAdvanceCheckbox" style={{ margin: 0, cursor: 'pointer' }}>
                      Hold as Unallocated Client Advance
                    </label>
                  </div>
                </div>

                {/* Invoice Allocation Table if not strictly advance */}
                {!paymentFormData.isAdvance && accountData?.invoices?.filter((i) => (Number(i.balance) || 0) > 0).length > 0 && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                    <h4 style={{ fontSize: '0.8rem', margin: '0 0 0.5rem 0', color: '#475569' }}>
                      Allocate Payment to Open Invoices:
                    </h4>
                    <table className="fin-data-table" style={{ fontSize: '0.775rem' }}>
                      <thead>
                        <tr>
                          <th>Invoice #</th>
                          <th>Total</th>
                          <th>Current Balance</th>
                          <th style={{ width: '130px' }}>Allocate (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accountData.invoices
                          .filter((i) => (Number(i.balance) || 0) > 0)
                          .map((inv) => {
                            const alloc = paymentAllocations.find((a) => a.invoiceId === inv._id);
                            return (
                              <tr key={inv._id}>
                                <td>{inv.invoiceNumber}</td>
                                <td>{formatCurrency(inv.total || inv.amount)}</td>
                                <td className="text-orange font-weight-bold">{formatCurrency(inv.balance)}</td>
                                <td>
                                  <input
                                    type="number"
                                    style={{ width: '100%', padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                                    value={alloc ? alloc.amount : ''}
                                    max={inv.balance}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      setPaymentAllocations((prev) => {
                                        const filtered = prev.filter((a) => a.invoiceId !== inv._id);
                                        return [...filtered, { invoiceId: inv._id, amount: val }];
                                      });
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="fin-form-group" style={{ marginTop: '0.75rem' }}>
                  <label>Remarks / Notes</label>
                  <textarea
                    rows="2"
                    value={paymentFormData.notes}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                    placeholder="Enter remittance details..."
                  />
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={() => setIsRecordPaymentModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="fin-action-btn primary" disabled={paymentLoading}>
                  {paymentLoading ? 'Recording Payment...' : 'Record Payment & Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL: ADVANCE ADJUSTMENT
          ────────────────────────────────────────────────────────── */}
      {isAdvanceAdjustModalOpen && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Advance Adjustment — {selectedClient?.name}</h3>
              <button type="button" className="fin-modal-close-btn" onClick={() => setIsAdvanceAdjustModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveAdvanceAdjust}>
              <div className="fin-modal-body">
                {advanceError && <div className="fin-form-error">{advanceError}</div>}
                <p className="fin-sub-text" style={{ marginBottom: '1rem' }}>
                  Available Advance Balance: <strong className="text-success">{formatCurrency(accountData?.financials?.advanceBalance || 0)}</strong>
                </p>
                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Action Type</label>
                    <select
                      value={advanceFormData.actionType}
                      onChange={(e) => setAdvanceFormData({ ...advanceFormData, actionType: e.target.value })}
                    >
                      <option value="ApplyToInvoice">Apply to Outstanding Invoice</option>
                      <option value="Refund">Issue Advance Refund to Client</option>
                    </select>
                  </div>
                  <div className="fin-form-group">
                    <label>Adjustment Amount *</label>
                    <input
                      type="number"
                      required
                      max={accountData?.financials?.advanceBalance || 0}
                      value={advanceFormData.amount}
                      onChange={(e) => setAdvanceFormData({ ...advanceFormData, amount: e.target.value })}
                    />
                  </div>
                  {advanceFormData.actionType === 'ApplyToInvoice' && (
                    <div className="fin-form-group" style={{ gridColumn: 'span 2' }}>
                      <label>Target Open Invoice *</label>
                      <select
                        required
                        value={advanceFormData.invoiceId}
                        onChange={(e) => setAdvanceFormData({ ...advanceFormData, invoiceId: e.target.value })}
                      >
                        <option value="">Select Invoice</option>
                        {accountData?.invoices
                          ?.filter((i) => (Number(i.balance) || 0) > 0)
                          .map((inv) => (
                            <option key={inv._id} value={inv._id}>
                              {inv.invoiceNumber} — Balance: {formatCurrency(inv.balance)}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="fin-form-group" style={{ marginTop: '0.75rem' }}>
                  <label>Adjustment Notes</label>
                  <textarea
                    rows="2"
                    value={advanceFormData.notes}
                    onChange={(e) => setAdvanceFormData({ ...advanceFormData, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={() => setIsAdvanceAdjustModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="fin-action-btn primary" disabled={advanceLoading}>
                  {advanceLoading ? 'Adjusting...' : 'Confirm Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL: ADD CLIENT EXPENSE
          ────────────────────────────────────────────────────────── */}
      {isAddExpenseModalOpen && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Record Client / Project Expense</h3>
              <button type="button" className="fin-modal-close-btn" onClick={() => setIsAddExpenseModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveAddExpense}>
              <div className="fin-modal-body">
                {expenseError && <div className="fin-form-error">{expenseError}</div>}
                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Expense Title *</label>
                    <input
                      type="text"
                      required
                      value={expenseFormData.title}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, title: e.target.value })}
                      placeholder="e.g. Cloud Hosting Infrastructure"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Amount *</label>
                    <input
                      type="number"
                      required
                      value={expenseFormData.amount}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, amount: e.target.value })}
                      placeholder="e.g. 15000"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Category</label>
                    <select
                      value={expenseFormData.category}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, category: e.target.value })}
                    >
                      <option value="Client Operations">Client Operations</option>
                      <option value="Server / Cloud Costs">Server / Cloud Costs</option>
                      <option value="Third-party Licenses">Third-party Licenses</option>
                      <option value="Vendor Services">Vendor Services</option>
                      <option value="Travel & Client Meetings">Travel & Client Meetings</option>
                    </select>
                  </div>
                  <div className="fin-form-group">
                    <label>Related Project (Optional)</label>
                    <select
                      value={expenseFormData.project}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, project: e.target.value })}
                    >
                      <option value="">General Client Account</option>
                      {accountData?.projects?.map((p) => (
                        <option key={p._id} value={p._id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="fin-form-group">
                    <label>Vendor / Payee</label>
                    <input
                      type="text"
                      value={expenseFormData.vendorName}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, vendorName: e.target.value })}
                      placeholder="e.g. Amazon Web Services"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Payment Date</label>
                    <input
                      type="date"
                      value={expenseFormData.expenseDate}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, expenseDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="fin-form-group" style={{ marginTop: '0.75rem' }}>
                  <label>Description / Notes</label>
                  <textarea
                    rows="2"
                    value={expenseFormData.description}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, description: e.target.value })}
                    placeholder="Enter expense details..."
                  />
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={() => setIsAddExpenseModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="fin-action-btn primary" disabled={expenseLoading}>
                  {expenseLoading ? 'Saving...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL: CREATE PROPOSAL / QUOTATION
          ────────────────────────────────────────────────────────── */}
      {isCreateProposalModalOpen && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Create Commercial Quotation — {selectedClient?.name}</h3>
              <button type="button" className="fin-modal-close-btn" onClick={() => setIsCreateProposalModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveCreateProposal}>
              <div className="fin-modal-body">
                {proposalError && <div className="fin-form-error">{proposalError}</div>}
                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Quotation Title *</label>
                    <input
                      type="text"
                      required
                      value={proposalFormData.title}
                      onChange={(e) => setProposalFormData({ ...proposalFormData, title: e.target.value })}
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Valid Until</label>
                    <input
                      type="date"
                      value={proposalFormData.validUntil}
                      onChange={(e) => setProposalFormData({ ...proposalFormData, validUntil: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '0.75rem' }}>
                  <h4 style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '0.4rem' }}>Line Items:</h4>
                  {proposalFormData.items.map((it, idx) => (
                    <div key={idx} className="fin-form-grid-2" style={{ marginBottom: '0.5rem', background: '#f8fafc', padding: '0.5rem', borderRadius: '6px' }}>
                      <div className="fin-form-group">
                        <label>Item Name / Service *</label>
                        <input
                          type="text"
                          required
                          value={it.name}
                          onChange={(e) => {
                            const newItems = [...proposalFormData.items];
                            newItems[idx].name = e.target.value;
                            setProposalFormData({ ...proposalFormData, items: newItems });
                          }}
                        />
                      </div>
                      <div className="fin-form-group">
                        <label>Rate / Amount (₹) *</label>
                        <input
                          type="number"
                          required
                          value={it.rate}
                          onChange={(e) => {
                            const newItems = [...proposalFormData.items];
                            newItems[idx].rate = e.target.value;
                            setProposalFormData({ ...proposalFormData, items: newItems });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="fin-form-group" style={{ marginTop: '0.75rem' }}>
                  <label>Commercial Terms & Notes</label>
                  <textarea
                    rows="2"
                    value={proposalFormData.notes}
                    onChange={(e) => setProposalFormData({ ...proposalFormData, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={() => setIsCreateProposalModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="fin-action-btn primary" disabled={proposalLoading}>
                  {proposalLoading ? 'Generating...' : 'Save Quotation Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL: CREATE CREDIT NOTE
          ────────────────────────────────────────────────────────── */}
      {isCreditNoteModalOpen && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Issue Credit Note — {selectedClient?.name}</h3>
              <button type="button" className="fin-modal-close-btn" onClick={() => setIsCreditNoteModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveCreditNote}>
              <div className="fin-modal-body">
                {creditNoteError && <div className="fin-form-error">{creditNoteError}</div>}
                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Target Invoice *</label>
                    <select
                      required
                      value={creditNoteFormData.invoiceId}
                      onChange={(e) => setCreditNoteFormData({ ...creditNoteFormData, invoiceId: e.target.value })}
                    >
                      <option value="">Select Invoice</option>
                      {accountData?.invoices?.map((inv) => (
                        <option key={inv._id} value={inv._id}>
                          {inv.invoiceNumber} — Total: {formatCurrency(inv.total || inv.amount)} (Bal: {formatCurrency(inv.balance)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="fin-form-group">
                    <label>Credit Amount *</label>
                    <input
                      type="number"
                      required
                      value={creditNoteFormData.amount}
                      onChange={(e) => setCreditNoteFormData({ ...creditNoteFormData, amount: e.target.value })}
                      placeholder="e.g. 10000"
                    />
                  </div>
                </div>
                <div className="fin-form-group" style={{ marginTop: '0.75rem' }}>
                  <label>Reason for Credit Note *</label>
                  <input
                    type="text"
                    required
                    value={creditNoteFormData.reason}
                    onChange={(e) => setCreditNoteFormData({ ...creditNoteFormData, reason: e.target.value })}
                    placeholder="e.g. Service revision, discount, or scope alteration"
                  />
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={() => setIsCreditNoteModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="fin-action-btn primary" disabled={creditNoteLoading}>
                  {creditNoteLoading ? 'Issuing...' : 'Issue Credit Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL: LOG FOLLOW-UP
          ────────────────────────────────────────────────────────── */}
      {isFollowUpModalOpen && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Log Collection Follow-up — {selectedClient?.name}</h3>
              <button type="button" className="fin-modal-close-btn" onClick={() => setIsFollowUpModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveFollowUp}>
              <div className="fin-modal-body">
                {followUpError && <div className="fin-form-error">{followUpError}</div>}
                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Follow-up Status</label>
                    <select
                      value={followUpFormData.status}
                      onChange={(e) => setFollowUpFormData({ ...followUpFormData, status: e.target.value })}
                    >
                      <option value="In Progress">In Progress</option>
                      <option value="Promised">Promised Payment</option>
                      <option value="Escalated">Escalated</option>
                      <option value="Recovered">Recovered / Settled</option>
                    </select>
                  </div>
                  <div className="fin-form-group">
                    <label>Related Invoice (Optional)</label>
                    <select
                      value={followUpFormData.invoiceId}
                      onChange={(e) => setFollowUpFormData({ ...followUpFormData, invoiceId: e.target.value })}
                    >
                      <option value="">All Outstanding Invoices</option>
                      {accountData?.invoices
                        ?.filter((inv) => (Number(inv.balance) || 0) > 0)
                        .map((inv) => (
                          <option key={inv._id} value={inv._id}>
                            {inv.invoiceNumber} — Balance: {formatCurrency(inv.balance)}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="fin-form-group">
                    <label>Next Follow-up Date</label>
                    <input
                      type="date"
                      value={followUpFormData.nextFollowUpDate}
                      onChange={(e) => setFollowUpFormData({ ...followUpFormData, nextFollowUpDate: e.target.value })}
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Promised Payment Date</label>
                    <input
                      type="date"
                      value={followUpFormData.promiseToPayDate}
                      onChange={(e) => setFollowUpFormData({ ...followUpFormData, promiseToPayDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="fin-form-group" style={{ marginTop: '0.75rem' }}>
                  <label>Follow-up Discussion Notes *</label>
                  <textarea
                    rows="3"
                    required
                    value={followUpFormData.note}
                    onChange={(e) => setFollowUpFormData({ ...followUpFormData, note: e.target.value })}
                    placeholder="Enter call notes, client commitments, delay reasons..."
                  />
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={() => setIsFollowUpModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="fin-action-btn primary" disabled={followUpLoading}>
                  {followUpLoading ? 'Recording...' : 'Record Follow-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL: PAYMENT RECEIPT PREVIEW (Section 15)
          ────────────────────────────────────────────────────────── */}
      {isReceiptModalOpen && receiptData && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>✓ Payment Receipt Generated</h3>
              <button type="button" className="fin-modal-close-btn" onClick={() => setIsReceiptModalOpen(false)}>
                &times;
              </button>
            </div>
            <div className="fin-modal-body">
              <div className="fin-receipt-box">
                <div className="fin-receipt-header">
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>AASHA SM TECHNOLOGIES</h4>
                    <small style={{ color: '#64748b' }}>Official Payment Receipt</small>
                  </div>
                  <div className="fin-receipt-number">{receiptData.receiptNumber}</div>
                </div>
                <table className="fin-data-table" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
                  <tbody>
                    <tr>
                      <td>Received From:</td>
                      <td><strong>{receiptData.clientName}</strong></td>
                    </tr>
                    <tr>
                      <td>Amount Received:</td>
                      <td className="text-success font-weight-bold" style={{ fontSize: '1.05rem' }}>
                        {formatCurrency(receiptData.amount)}
                      </td>
                    </tr>
                    <tr>
                      <td>Payment Date:</td>
                      <td>{formatDate(receiptData.paymentDate)}</td>
                    </tr>
                    <tr>
                      <td>Payment Mode:</td>
                      <td>{receiptData.paymentMethod}</td>
                    </tr>
                    <tr>
                      <td>Transaction Reference (UTR):</td>
                      <td><code>{receiptData.transactionReference}</code></td>
                    </tr>
                    <tr>
                      <td>Notes / Remittance:</td>
                      <td>{receiptData.notes || 'Payment credited to company operating account'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="fin-modal-footer">
              <button type="button" className="fin-btn-secondary" onClick={() => setIsReceiptModalOpen(false)}>
                Close
              </button>
              <button type="button" className="fin-action-btn primary" onClick={() => window.print()}>
                🖨️ Print Official Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
