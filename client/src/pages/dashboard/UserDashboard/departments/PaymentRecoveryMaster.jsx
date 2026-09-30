import React, { useState, useMemo, useEffect } from 'react';
import apiClient from '../../../../services/apiClient';

export default function PaymentRecoveryMaster({
  invoices = [],
  setInvoices,
  summary: externalSummary,
  aging: externalAging,
  teamMembers: externalTeamMembers = [],
  formatCurrency,
  formatDate,
  user,
  onRefresh,
  openModal,
}) {
  // Navigation & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // all, due-soon, overdue, followups, promise, disputed, closed
  const [agingFilter, setAgingFilter] = useState('All'); // All, notDue, days1_30, days31_60, days61_90, days90Plus
  const [ownerFilter, setOwnerFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [clientFilter, setClientFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);

  // Active Case for Drawer or Modals
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseDetails, setCaseDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [drawerTab, setDrawerTab] = useState('overview'); // overview, timeline, promise, dispute, payments, audit

  // Modals State
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isPromiseModalOpen, setIsPromiseModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [isResolveDisputeModalOpen, setIsResolveDisputeModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Form States & Loading
  const [formData, setFormData] = useState({});
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Dropdown options
  const [bankAccountsList, setBankAccountsList] = useState([]);
  const [teamMembers, setTeamMembers] = useState(externalTeamMembers);

  // Fetch team members & bank accounts if needed
  useEffect(() => {
    if (externalTeamMembers && externalTeamMembers.length > 0) {
      setTeamMembers(externalTeamMembers);
    } else {
      apiClient
        .get('/finance/recovery/team')
        .then((res) => {
          if (res.data?.data) setTeamMembers(res.data.data);
        })
        .catch(() => {});
    }

    apiClient
      .get('/finance/bank-accounts')
      .then((res) => {
        if (res.data?.data) setBankAccountsList(res.data.data);
      })
      .catch(() => {});
  }, [externalTeamMembers]);

  // Compute Days Overdue helper
  const getDaysOverdue = (dueDate) => {
    if (!dueDate) return 0;
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diff = Math.floor((today - due) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  // Compute live KPIs across loaded dataset
  const metrics = useMemo(() => {
    if (externalSummary) return externalSummary;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let totalOutstanding = 0;
    let overdueAmount = 0;
    let dueSoonAmount = 0;
    let followUpsDue = 0;
    let promiseToPay = 0;

    invoices.forEach((inv) => {
      const bal = Number(inv.balance) || 0;
      if (bal > 0) {
        totalOutstanding += bal;
        const due = inv.dueDate ? new Date(inv.dueDate) : null;
        if (due) {
          if (due < startOfToday) {
            overdueAmount += bal;
          } else {
            const next7Days = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
            if (due <= next7Days) dueSoonAmount += bal;
          }
        }

        const nextFup = inv.recovery?.nextFollowUp ? new Date(inv.recovery.nextFollowUp) : null;
        if (
          inv.recovery?.status !== 'Closed' &&
          (inv.recovery?.status === 'Follow-up Required' || (nextFup && nextFup <= endOfToday))
        ) {
          followUpsDue += 1;
        }

        if (
          inv.recovery?.promiseToPay?.status === 'Active' &&
          (inv.recovery.promiseToPay.amount || 0) > 0
        ) {
          promiseToPay += Number(inv.recovery.promiseToPay.amount) || 0;
        }
      }
    });

    return {
      totalOutstanding,
      overdueAmount,
      dueSoonAmount,
      collectedPeriod: 0,
      followUpsDue,
      promiseToPay,
      totalCases: invoices.length,
    };
  }, [invoices, externalSummary]);

  // Compute Aging Breakdown
  const agingData = useMemo(() => {
    if (externalAging) return externalAging;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const buckets = {
      notDue: 0,
      days1_30: 0,
      days31_60: 0,
      days61_90: 0,
      days90Plus: 0,
    };

    invoices.forEach((inv) => {
      const bal = Number(inv.balance) || 0;
      if (bal > 0) {
        const due = inv.dueDate ? new Date(inv.dueDate) : null;
        if (!due || due >= startOfToday) {
          buckets.notDue += bal;
        } else {
          const diffDays = Math.floor((startOfToday - due) / (1000 * 60 * 60 * 24));
          if (diffDays <= 30) buckets.days1_30 += bal;
          else if (diffDays <= 60) buckets.days31_60 += bal;
          else if (diffDays <= 90) buckets.days61_90 += bal;
          else buckets.days90Plus += bal;
        }
      }
    });

    return buckets;
  }, [invoices, externalAging]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const next7Days = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

    let dueSoon = 0;
    let overdue = 0;
    let followups = 0;
    let promise = 0;
    let disputed = 0;
    let closed = 0;

    invoices.forEach((inv) => {
      const bal = Number(inv.balance) || 0;
      const due = inv.dueDate ? new Date(inv.dueDate) : null;
      const rec = inv.recovery || {};

      if (rec.status === 'Closed') {
        closed += 1;
        return;
      }

      if (rec.status === 'Disputed / On Hold' || rec.dispute?.isDisputed) {
        disputed += 1;
      }

      if (rec.status === 'Promise to Pay' || rec.promiseToPay?.status === 'Active') {
        promise += 1;
      }

      if (bal > 0 && due) {
        if (due < startOfToday) overdue += 1;
        else if (due <= next7Days) dueSoon += 1;
      }

      const nextFup = rec.nextFollowUp ? new Date(rec.nextFollowUp) : null;
      if (bal > 0 && (rec.status === 'Follow-up Required' || (nextFup && nextFup <= endOfToday))) {
        followups += 1;
      }
    });

    return {
      all: invoices.length,
      dueSoon,
      overdue,
      followups,
      promise,
      disputed,
      closed,
    };
  }, [invoices]);

  // Unique clients for filter
  const clientOptions = useMemo(() => {
    const map = new Map();
    invoices.forEach((inv) => {
      const name = inv.clientName || inv.client?.name;
      const id = inv.client?._id || inv.client;
      if (name && !map.has(name)) {
        map.set(name, { id, name });
      }
    });
    return Array.from(map.values());
  }, [invoices]);

  // Filtered Invoices
  const filteredCases = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const next7Days = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

    return invoices.filter((inv) => {
      const bal = Number(inv.balance) || 0;
      const due = inv.dueDate ? new Date(inv.dueDate) : null;
      const rec = inv.recovery || {};

      // 1. Search Query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchNumber = inv.invoiceNumber?.toLowerCase().includes(q);
        const matchClient = inv.clientName?.toLowerCase().includes(q) || inv.client?.name?.toLowerCase().includes(q);
        const matchCompany = inv.clientCompany?.toLowerCase().includes(q) || inv.client?.company?.toLowerCase().includes(q);
        const matchEmail = inv.clientEmail?.toLowerCase().includes(q) || inv.client?.email?.toLowerCase().includes(q);
        const matchOwner = rec.ownerName?.toLowerCase().includes(q);
        if (!matchNumber && !matchClient && !matchCompany && !matchEmail && !matchOwner) {
          return false;
        }
      }

      // 2. View Tab Filtering
      if (activeTab === 'due-soon') {
        if (bal <= 0 || !due || due < startOfToday || due > next7Days || rec.status === 'Closed') return false;
      } else if (activeTab === 'overdue') {
        if (bal <= 0 || !due || due >= startOfToday || rec.status === 'Closed') return false;
      } else if (activeTab === 'followups') {
        const nextFup = rec.nextFollowUp ? new Date(rec.nextFollowUp) : null;
        const isDue = rec.status === 'Follow-up Required' || (nextFup && nextFup <= endOfToday);
        if (bal <= 0 || !isDue || rec.status === 'Closed') return false;
      } else if (activeTab === 'promise') {
        if (rec.status !== 'Promise to Pay' && rec.promiseToPay?.status !== 'Active') return false;
      } else if (activeTab === 'disputed') {
        if (rec.status !== 'Disputed / On Hold' && !rec.dispute?.isDisputed) return false;
      } else if (activeTab === 'closed') {
        if (rec.status !== 'Closed') return false;
      }

      // 3. Aging Filter
      if (agingFilter !== 'All') {
        if (bal <= 0 || !due) return false;
        const diffDays = Math.floor((startOfToday - due) / (1000 * 60 * 60 * 24));
        if (agingFilter === 'notDue' && due < startOfToday) return false;
        if (agingFilter === 'days1_30' && (diffDays < 1 || diffDays > 30)) return false;
        if (agingFilter === 'days31_60' && (diffDays < 31 || diffDays > 60)) return false;
        if (agingFilter === 'days61_90' && (diffDays < 61 || diffDays > 90)) return false;
        if (agingFilter === 'days90Plus' && diffDays <= 90) return false;
      }

      // 4. Owner Filter
      if (ownerFilter !== 'All') {
        const ownerId = rec.owner?._id || rec.owner;
        if (ownerId !== ownerFilter) return false;
      }

      // 5. Priority Filter
      if (priorityFilter !== 'All') {
        if ((rec.priority || 'Medium') !== priorityFilter) return false;
      }

      // 6. Client Filter
      if (clientFilter !== 'All') {
        const cName = inv.clientName || inv.client?.name;
        if (cName !== clientFilter) return false;
      }

      return true;
    });
  }, [invoices, searchTerm, activeTab, agingFilter, ownerFilter, priorityFilter, clientFilter]);

  // Load detailed case with payments & audit
  const openCaseDrawer = async (inv) => {
    setSelectedCase(inv);
    setIsDrawerOpen(true);
    setDetailsLoading(true);
    setDrawerTab('overview');
    try {
      const res = await apiClient.get(`/finance/recovery/${inv._id}`);
      if (res.data?.data) {
        setCaseDetails(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load case details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Close all modals helper
  const closeAllModals = () => {
    setIsFollowUpModalOpen(false);
    setIsScheduleModalOpen(false);
    setIsPromiseModalOpen(false);
    setIsPaymentModalOpen(false);
    setIsDisputeModalOpen(false);
    setIsResolveDisputeModalOpen(false);
    setIsReminderModalOpen(false);
    setIsCloseModalOpen(false);
    setFormData({});
    setFormError('');
    setFormLoading(false);
  };

  // 1. Open Log Follow-up Modal
  const handleOpenFollowUp = (inv) => {
    const target = inv || selectedCase || filteredCases[0];
    if (!target) return;
    setSelectedCase(target);
    setFormData({
      invoiceId: target._id,
      contactMethod: 'Call',
      contactedPerson: target.clientName || '',
      outcome: 'Connected',
      clientResponse: '',
      note: '',
      promisedAmount: target.balance || '',
      promisedDate: '',
      nextFollowUpDate: '',
      assignedTo: target.recovery?.owner?._id || target.recovery?.owner || '',
      status: target.recovery?.status || 'Contacted',
    });
    setFormError('');
    setIsFollowUpModalOpen(true);
  };

  // Submit Log Follow-up
  const handleSubmitFollowUp = async (e) => {
    e.preventDefault();
    if (!formData.note?.trim()) {
      setFormError('Please enter a follow-up note.');
      return;
    }

    setFormLoading(true);
    setFormError('');
    try {
      await apiClient.post(`/finance/recovery/${selectedCase._id}/followup`, formData);
      closeAllModals();
      if (onRefresh) onRefresh();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to log follow-up');
    } finally {
      setFormLoading(false);
    }
  };

  // 2. Open Schedule Follow-up Modal
  const handleOpenSchedule = (inv) => {
    const target = inv || selectedCase || filteredCases[0];
    if (!target) return;
    setSelectedCase(target);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
    setFormData({
      activityType: 'Call',
      nextFollowUpDate: tomorrow,
      assignedTo: target.recovery?.owner?._id || target.recovery?.owner || '',
      priority: target.recovery?.priority || 'Medium',
      instructions: '',
    });
    setFormError('');
    setIsScheduleModalOpen(true);
  };

  // Submit Schedule Follow-up
  const handleSubmitSchedule = async (e) => {
    e.preventDefault();
    if (!formData.nextFollowUpDate) {
      setFormError('Please select a date and time for follow-up.');
      return;
    }

    setFormLoading(true);
    setFormError('');
    try {
      await apiClient.post(`/finance/recovery/${selectedCase._id}/schedule`, formData);
      closeAllModals();
      if (onRefresh) onRefresh();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to schedule follow-up');
    } finally {
      setFormLoading(false);
    }
  };

  // 3. Open Promise to Pay Modal
  const handleOpenPromise = (inv) => {
    const target = inv || selectedCase;
    if (!target) return;
    setSelectedCase(target);
    const defaultDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    setFormData({
      amount: target.balance || 0,
      promisedDate: defaultDate,
      commitment: `Client committed to clear outstanding of ${formatCurrency(target.balance)}`,
      notes: '',
    });
    setFormError('');
    setIsPromiseModalOpen(true);
  };

  // Submit Promise to Pay
  const handleSubmitPromise = async (e) => {
    e.preventDefault();
    if (!formData.amount || Number(formData.amount) <= 0) {
      setFormError('Please enter a valid promised amount.');
      return;
    }
    if (!formData.promisedDate) {
      setFormError('Please select a promised payment date.');
      return;
    }

    setFormLoading(true);
    setFormError('');
    try {
      await apiClient.post(`/finance/recovery/${selectedCase._id}/promise`, formData);
      closeAllModals();
      if (onRefresh) onRefresh();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to record promise to pay');
    } finally {
      setFormLoading(false);
    }
  };

  // 4. Open Record Payment Modal
  const handleOpenPayment = (inv) => {
    const target = inv || selectedCase;
    if (!target) return;
    setSelectedCase(target);
    setFormData({
      amount: target.balance || 0,
      paymentMethod: 'Bank Transfer',
      bankAccountId: bankAccountsList[0]?._id || '',
      transactionReference: '',
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: `Payment for Invoice ${target.invoiceNumber} via Recovery`,
    });
    setFormError('');
    setIsPaymentModalOpen(true);
  };

  // Submit Payment
  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!formData.amount || Number(formData.amount) <= 0) {
      setFormError('Please enter a valid amount.');
      return;
    }

    setFormLoading(true);
    setFormError('');
    try {
      await apiClient.post(`/finance/recovery/${selectedCase._id}/pay`, formData);
      closeAllModals();
      if (onRefresh) onRefresh();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setFormLoading(false);
    }
  };

  // 5. Open Dispute Modal
  const handleOpenDispute = (inv) => {
    const target = inv || selectedCase;
    if (!target) return;
    setSelectedCase(target);
    setFormData({
      category: 'Billing / Scope Dispute',
      reason: '',
      notes: '',
    });
    setFormError('');
    setIsDisputeModalOpen(true);
  };

  // Submit Dispute
  const handleSubmitDispute = async (e) => {
    e.preventDefault();
    if (!formData.reason?.trim()) {
      setFormError('Please state the client dispute reason.');
      return;
    }

    setFormLoading(true);
    setFormError('');
    try {
      await apiClient.post(`/finance/recovery/${selectedCase._id}/dispute`, formData);
      closeAllModals();
      if (onRefresh) onRefresh();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to flag dispute');
    } finally {
      setFormLoading(false);
    }
  };

  // 6. Open Resolve Dispute Modal
  const handleOpenResolveDispute = (inv) => {
    const target = inv || selectedCase;
    if (!target) return;
    setSelectedCase(target);
    setFormData({
      resolutionNotes: '',
      actionTaken: 'Waived adjustment / Clarification accepted',
    });
    setFormError('');
    setIsResolveDisputeModalOpen(true);
  };

  // Submit Resolve Dispute
  const handleSubmitResolveDispute = async (e) => {
    e.preventDefault();
    if (!formData.resolutionNotes?.trim()) {
      setFormError('Please provide dispute resolution notes.');
      return;
    }

    setFormLoading(true);
    setFormError('');
    try {
      await apiClient.post(`/finance/recovery/${selectedCase._id}/dispute/resolve`, formData);
      closeAllModals();
      if (onRefresh) onRefresh();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to resolve dispute');
    } finally {
      setFormLoading(false);
    }
  };

  // 7. Open Reminder Modal
  const handleOpenReminder = (inv) => {
    const target = inv || selectedCase;
    if (!target) return;
    setSelectedCase(target);
    setFormData({
      recipientEmail: target.clientEmail || target.client?.email || '',
      reminderType: (target.daysOverdue || getDaysOverdue(target.dueDate)) > 0 ? 'Overdue Notice' : 'Friendly Payment Reminder',
      message: `Dear ${target.clientName || 'Client'},\n\nThis is a friendly reminder that an outstanding balance of ${formatCurrency(target.balance)} on Invoice ${target.invoiceNumber} is due on ${formatDate(target.dueDate)}. Kindly arrange remittance at your earliest convenience.`,
    });
    setFormError('');
    setIsReminderModalOpen(true);
  };

  // Submit Reminder
  const handleSubmitReminder = async (e) => {
    e.preventDefault();
    if (!formData.recipientEmail?.trim()) {
      setFormError('Recipient email is required.');
      return;
    }

    setFormLoading(true);
    setFormError('');
    try {
      await apiClient.post(`/finance/recovery/${selectedCase._id}/reminder`, formData);
      closeAllModals();
      if (onRefresh) onRefresh();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to send reminder');
    } finally {
      setFormLoading(false);
    }
  };

  // 8. Open Close Case Modal
  const handleOpenCloseCase = (inv) => {
    const target = inv || selectedCase;
    if (!target) return;
    setSelectedCase(target);
    setFormData({
      closureReason: target.balance === 0 ? 'Paid in Full' : 'Settled via Agreement',
    });
    setFormError('');
    setIsCloseModalOpen(true);
  };

  // Submit Close Case
  const handleSubmitCloseCase = async (e) => {
    e.preventDefault();
    if (!formData.closureReason?.trim()) {
      setFormError('Please select or specify a closure reason.');
      return;
    }

    setFormLoading(true);
    setFormError('');
    try {
      await apiClient.post(`/finance/recovery/${selectedCase._id}/close`, formData);
      closeAllModals();
      if (onRefresh) onRefresh();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to close case');
    } finally {
      setFormLoading(false);
    }
  };

  // Reopen Case
  const handleReopenCase = async (inv) => {
    if (!window.confirm(`Reopen recovery case for Invoice ${inv.invoiceNumber}?`)) return;
    try {
      await apiClient.post(`/finance/recovery/${inv._id}/reopen`, {});
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reopen case');
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!filteredCases.length) return alert('No records to export');
    const headers = [
      'Invoice #',
      'Client Name',
      'Company',
      'Issue Date',
      'Due Date',
      'Total Amount',
      'Paid Amount',
      'Balance Due',
      'Days Overdue',
      'Recovery Status',
      'Priority',
      'Owner',
      'Last Follow-up',
      'Next Follow-up',
      'Promise to Pay Date',
      'Promise to Pay Amount',
    ];

    const rows = filteredCases.map((inv) => {
      const rec = inv.recovery || {};
      return [
        inv.invoiceNumber,
        `"${inv.clientName || inv.client?.name || ''}"`,
        `"${inv.clientCompany || inv.client?.company || ''}"`,
        inv.issueDate ? new Date(inv.issueDate).toLocaleDateString('en-IN') : '',
        inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN') : '',
        inv.total || inv.amount || 0,
        inv.paidAmount || 0,
        inv.balance || 0,
        getDaysOverdue(inv.dueDate),
        rec.status || 'Not Started',
        rec.priority || 'Medium',
        `"${rec.ownerName || ''}"`,
        rec.lastFollowUp ? new Date(rec.lastFollowUp).toLocaleDateString('en-IN') : '',
        rec.nextFollowUp ? new Date(rec.nextFollowUp).toLocaleDateString('en-IN') : '',
        rec.promiseToPayDate ? new Date(rec.promiseToPayDate).toLocaleDateString('en-IN') : '',
        rec.promiseToPay?.amount || 0,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `payment_recovery_register_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fin-recovery-master">
      {/* 1. Header Toolbar */}
      <div className="fin-rec-header-block fin-no-print">
        <div className="fin-rec-title-group">
          <h2 className="fin-rec-page-title">Payment Recovery</h2>
          <p className="fin-rec-page-subtitle">
            Track receivables, manage follow-ups, and monitor collections.
          </p>
        </div>
        <div className="fin-rec-header-actions">
          <button
            type="button"
            className="fin-btn-orange"
            onClick={onRefresh}
            title="Reload from MongoDB Atlas"
          >
            🔄 Refresh
          </button>
          <button
            type="button"
            className="fin-btn-orange"
            onClick={handleExportCSV}
            title="Export CSV"
          >
            📥 Export
          </button>
          <button
            type="button"
            className="fin-btn-orange"
            onClick={() => handleOpenSchedule()}
            title="Schedule Activity"
          >
            📅 Schedule Follow-up
          </button>
          <button
            type="button"
            className="fin-btn-orange"
            onClick={() => handleOpenFollowUp()}
            title="Log Follow-up"
          >
            + Log Follow-up
          </button>
        </div>
      </div>

      {/* 2. 6 Dynamic KPI Cards (Income Management Sizing & Structure) */}
      <div className="fin-kpi-grid-6 fin-rec-kpis fin-no-print">
        {/* 1. Total Outstanding */}
        <div className="fin-kpi-card">
          <div className="fin-kpi-top">
            <span className="fin-kpi-label">Total Outstanding</span>
            <div className="fin-kpi-icon-wrap expense">
              💰
            </div>
          </div>
          <div className="fin-kpi-value text-danger">
            {formatCurrency(metrics.totalOutstanding)}
          </div>
          <div className="fin-kpi-footer">Valid Unpaid Receivables</div>
        </div>

        {/* 2. Overdue Amount */}
        <div className="fin-kpi-card">
          <div className="fin-kpi-top">
            <span className="fin-kpi-label">Overdue Amount</span>
            <div className="fin-kpi-icon-wrap expense">
              ⚠️
            </div>
          </div>
          <div className="fin-kpi-value text-danger">
            {formatCurrency(metrics.overdueAmount)}
          </div>
          <div className="fin-kpi-footer">Past Invoice Due Dates</div>
        </div>

        {/* 3. Due Soon */}
        <div className="fin-kpi-card">
          <div className="fin-kpi-top">
            <span className="fin-kpi-label">Due Soon</span>
            <div className="fin-kpi-icon-wrap payable">
              ⏳
            </div>
          </div>
          <div className="fin-kpi-value text-warning">
            {formatCurrency(metrics.dueSoonAmount)}
          </div>
          <div className="fin-kpi-footer">Due in Next 7 Days</div>
        </div>

        {/* 4. Collected This Month */}
        <div className="fin-kpi-card">
          <div className="fin-kpi-top">
            <span className="fin-kpi-label">Collected This Month</span>
            <div className="fin-kpi-icon-wrap income">
              ✅
            </div>
          </div>
          <div className="fin-kpi-value text-success">
            {formatCurrency(metrics.collectedPeriod)}
          </div>
          <div className="fin-kpi-footer">Allocated Payments</div>
        </div>

        {/* 5. Follow-ups Due */}
        <div className="fin-kpi-card">
          <div className="fin-kpi-top">
            <span className="fin-kpi-label">Follow-ups Due</span>
            <div className="fin-kpi-icon-wrap cashflow">
              📞
            </div>
          </div>
          <div className="fin-kpi-value" style={{ color: '#2563eb' }}>
            {metrics.followUpsDue}
          </div>
          <div className="fin-kpi-footer">Due or Overdue Today</div>
        </div>

        {/* 6. Promise to Pay */}
        <div className="fin-kpi-card">
          <div className="fin-kpi-top">
            <span className="fin-kpi-label">Promise to Pay</span>
            <div className="fin-kpi-icon-wrap bank">
              🤝
            </div>
          </div>
          <div className="fin-kpi-value" style={{ color: '#7c3aed' }}>
            {formatCurrency(metrics.promiseToPay)}
          </div>
          <div className="fin-kpi-footer">Active Commitments</div>
        </div>
      </div>

      {/* 3. Receivables Aging Breakdown */}
      <div className="fin-aging-strip fin-no-print">
        <div className="fin-aging-strip-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>Receivables Aging Breakdown</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>• Distribution by days past invoice due date</span>
          </div>
          {agingFilter !== 'All' && (
            <button
              type="button"
              className="fin-btn-link"
              style={{ fontSize: '0.75rem', color: '#fb8234', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => setAgingFilter('All')}
            >
              Clear Aging Filter ({agingFilter})
            </button>
          )}
        </div>
        <div className="fin-aging-buckets">
          <div
            className={`fin-aging-pill ${agingFilter === 'notDue' ? 'active' : ''}`}
            onClick={() => setAgingFilter(agingFilter === 'notDue' ? 'All' : 'notDue')}
          >
            <div className="fin-aging-pill-title">
              <span>Not Yet Due</span>
              <span>🟢</span>
            </div>
            <div className="fin-aging-pill-amount text-success">
              {formatCurrency(agingData.notDue)}
            </div>
          </div>

          <div
            className={`fin-aging-pill ${agingFilter === 'days1_30' ? 'active' : ''}`}
            onClick={() => setAgingFilter(agingFilter === 'days1_30' ? 'All' : 'days1_30')}
          >
            <div className="fin-aging-pill-title">
              <span>1–30 Days</span>
              <span>🟡</span>
            </div>
            <div className="fin-aging-pill-amount text-warning">
              {formatCurrency(agingData.days1_30)}
            </div>
          </div>

          <div
            className={`fin-aging-pill ${agingFilter === 'days31_60' ? 'active' : ''}`}
            onClick={() => setAgingFilter(agingFilter === 'days31_60' ? 'All' : 'days31_60')}
          >
            <div className="fin-aging-pill-title">
              <span>31–60 Days</span>
              <span>🟠</span>
            </div>
            <div className="fin-aging-pill-amount" style={{ color: '#ea580c' }}>
              {formatCurrency(agingData.days31_60)}
            </div>
          </div>

          <div
            className={`fin-aging-pill ${agingFilter === 'days61_90' ? 'active' : ''}`}
            onClick={() => setAgingFilter(agingFilter === 'days61_90' ? 'All' : 'days61_90')}
          >
            <div className="fin-aging-pill-title">
              <span>61–90 Days</span>
              <span>🔴</span>
            </div>
            <div className="fin-aging-pill-amount text-danger">
              {formatCurrency(agingData.days61_90)}
            </div>
          </div>

          <div
            className={`fin-aging-pill ${agingFilter === 'days90Plus' ? 'active' : ''}`}
            onClick={() => setAgingFilter(agingFilter === 'days90Plus' ? 'All' : 'days90Plus')}
          >
            <div className="fin-aging-pill-title">
              <span>90+ Days</span>
              <span>🚨</span>
            </div>
            <div className="fin-aging-pill-amount text-danger">
              {formatCurrency(agingData.days90Plus)}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Unified Search + Status Filter Toolbar */}
      <div className="fin-rec-toolbar fin-no-print">
        <div className="fin-rec-search-wrap">
          <span className="fin-rec-search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            className="fin-rec-search-input"
            placeholder="Search by Client, Company, Invoice #, Owner..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="fin-rec-search-clear"
              title="Clear search"
              onClick={() => setSearchTerm('')}
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filter Chips */}
        <div className="fin-rec-filter-chips">
          <button
            type="button"
            className={`fin-rec-filter-chip ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <span>All Receivables</span>
            <span className="fin-rec-chip-count">{tabCounts.all}</span>
          </button>
          <button
            type="button"
            className={`fin-rec-filter-chip ${activeTab === 'due-soon' ? 'active' : ''}`}
            onClick={() => setActiveTab('due-soon')}
          >
            <span>Due Soon</span>
            <span className="fin-rec-chip-count">{tabCounts.dueSoon}</span>
          </button>
          <button
            type="button"
            className={`fin-rec-filter-chip ${activeTab === 'overdue' ? 'active' : ''}`}
            onClick={() => setActiveTab('overdue')}
          >
            <span>Overdue</span>
            <span className="fin-rec-chip-count overdue">{tabCounts.overdue}</span>
          </button>
          <button
            type="button"
            className={`fin-rec-filter-chip ${activeTab === 'followups' ? 'active' : ''}`}
            onClick={() => setActiveTab('followups')}
          >
            <span>Follow-ups Due</span>
            <span className="fin-rec-chip-count">{tabCounts.followups}</span>
          </button>
          <button
            type="button"
            className={`fin-rec-filter-chip ${activeTab === 'promise' ? 'active' : ''}`}
            onClick={() => setActiveTab('promise')}
          >
            <span>Promise to Pay</span>
            <span className="fin-rec-chip-count">{tabCounts.promise}</span>
          </button>
          <button
            type="button"
            className={`fin-rec-filter-chip ${activeTab === 'disputed' ? 'active' : ''}`}
            onClick={() => setActiveTab('disputed')}
          >
            <span>Disputed / On Hold</span>
            <span className="fin-rec-chip-count">{tabCounts.disputed}</span>
          </button>
          <button
            type="button"
            className={`fin-rec-filter-chip ${activeTab === 'closed' ? 'active' : ''}`}
            onClick={() => setActiveTab('closed')}
          >
            <span>Recovered / Closed</span>
            <span className="fin-rec-chip-count">{tabCounts.closed}</span>
          </button>
        </div>

        {/* Filter Toggle Button */}
        <button
          type="button"
          className={`fin-btn-orange ${showFilters ? 'active' : ''}`}
          style={{ height: '32px', padding: '0 0.85rem', fontSize: '0.78rem' }}
          onClick={() => setShowFilters(!showFilters)}
        >
          ⚡ Filters {showFilters ? '▲' : '▼'}
        </button>
      </div>

      {/* Filter Drawer */}
      {showFilters && (
        <div className="fin-filters-drawer fin-no-print" style={{ background: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.15rem', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)' }}>
          <div className="fin-form-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div className="fin-form-group">
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>Client</label>
              <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="fin-form-select">
                <option value="All">All Clients</option>
                {clientOptions.map((c) => (
                  <option key={c.id || c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="fin-form-group">
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>Recovery Owner</label>
              <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="fin-form-select">
                <option value="All">All Owners</option>
                {teamMembers.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="fin-form-group">
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>Priority</label>
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="fin-form-select">
                <option value="All">All Priorities</option>
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div className="fin-form-group" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
              <button
                type="button"
                className="fin-btn-orange"
                style={{ height: '36px', padding: '0 0.95rem' }}
                onClick={() => {
                  setClientFilter('All');
                  setOwnerFilter('All');
                  setPriorityFilter('All');
                  setAgingFilter('All');
                  setSearchTerm('');
                }}
              >
                Clear All Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Receivables Register Table */}
      <div className="fin-table-container fin-no-print">
        <div className="fin-table-responsive">
          <table className="fin-data-table fin-rec-table">
            <thead>
              <tr>
                <th className="fin-rec-col-flex">Client / Company</th>
                <th className="fin-rec-col-nowrap">Invoice #</th>
                <th className="fin-rec-col-nowrap">Due Date</th>
                <th className="text-right fin-rec-col-nowrap">Total</th>
                <th className="text-right fin-rec-col-nowrap">Paid</th>
                <th className="text-right fin-rec-col-nowrap">Balance Due</th>
                <th className="fin-rec-col-nowrap">Overdue</th>
                <th className="fin-rec-col-nowrap">Next Follow-up</th>
                <th className="fin-rec-col-nowrap">Promise to Pay</th>
                <th className="fin-rec-col-nowrap">Owner</th>
                <th className="fin-rec-col-nowrap">Status</th>
                <th className="fin-rec-actions-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan="12" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#64748b' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '1rem' }}>No recovery records found in MongoDB Atlas</div>
                    <div style={{ fontSize: '0.825rem', marginTop: '0.25rem', color: '#64748b' }}>
                      Try adjusting your search query, clearing aging filters, or logging a new follow-up.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCases.map((inv) => {
                  const rec = inv.recovery || {};
                  const daysOverdue = getDaysOverdue(inv.dueDate);
                  const statusClass = String(rec.status || 'not-started').toLowerCase().replace(/[\s/]+/g, '-');
                  const priorityClass = String(rec.priority || 'medium').toLowerCase();

                  return (
                    <tr key={inv._id}>
                      {/* Client */}
                      <td className="fin-rec-col-flex">
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>
                          {inv.clientName || inv.client?.name || '—'}
                        </div>
                        <small style={{ color: '#64748b', fontSize: '0.72rem' }}>
                          {inv.clientCompany || inv.client?.company || ''}
                        </small>
                      </td>

                      {/* Invoice # */}
                      <td className="fin-rec-col-nowrap">
                        <button
                          type="button"
                          className="fin-btn-link"
                          style={{ fontWeight: 700, color: '#fb8234' }}
                          onClick={() => openCaseDrawer(inv)}
                        >
                          {inv.invoiceNumber}
                        </button>
                      </td>

                      {/* Due Date */}
                      <td className="fin-rec-col-nowrap">
                        <div>{formatDate(inv.dueDate)}</div>
                        <small style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{formatDate(inv.issueDate)}</small>
                      </td>

                      {/* Total */}
                      <td className="text-right fin-rec-col-nowrap" style={{ fontWeight: 700 }}>
                        {formatCurrency(inv.total || inv.amount)}
                      </td>

                      {/* Paid */}
                      <td className="text-right fin-rec-col-nowrap" style={{ color: '#16a34a', fontWeight: 600 }}>
                        {formatCurrency(inv.paidAmount)}
                      </td>

                      {/* Balance Due */}
                      <td className="text-right fin-rec-col-nowrap" style={{ color: (inv.balance || 0) > 0 ? '#dc2626' : '#64748b', fontWeight: 700 }}>
                        {formatCurrency(inv.balance)}
                      </td>

                      {/* Overdue Days */}
                      <td className="fin-rec-col-nowrap">
                        {daysOverdue > 0 ? (
                          <span className="fin-priority-badge urgent">
                            {daysOverdue}d overdue
                          </span>
                        ) : (
                          <span className="fin-priority-badge low">Not Due</span>
                        )}
                      </td>

                      {/* Next Follow-up */}
                      <td className="fin-rec-col-nowrap">
                        {rec.nextFollowUp ? (
                          <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                            {formatDate(rec.nextFollowUp)}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>

                      {/* Promise to Pay */}
                      <td className="fin-rec-col-nowrap">
                        {rec.promiseToPay && rec.promiseToPay.amount > 0 && rec.promiseToPay.status === 'Active' ? (
                          <div style={{ fontSize: '0.78rem' }}>
                            <strong style={{ color: '#7c3aed' }}>
                              {formatCurrency(rec.promiseToPay.amount)}
                            </strong>
                            <div style={{ color: '#64748b', fontSize: '0.7rem' }}>
                              by {formatDate(rec.promiseToPay.promisedDate)}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>

                      {/* Recovery Owner */}
                      <td className="fin-rec-col-nowrap">
                        <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                          {rec.ownerName || <span style={{ color: '#94a3b8' }}>Unassigned</span>}
                        </div>
                        <span className={`fin-priority-badge ${priorityClass}`}>
                          {rec.priority || 'Medium'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="fin-rec-col-nowrap">
                        <span className={`fin-rec-badge ${statusClass}`}>
                          {rec.status || 'Not Started'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="fin-rec-actions-cell">
                        <div className="fin-rec-actions-group">
                          <button
                            type="button"
                            className="fin-rec-action-btn"
                            onClick={() => handleOpenFollowUp(inv)}
                            title="Log Follow-up"
                          >
                            <span className="fin-action-ic" aria-hidden="true">📞</span>
                            <span>Follow-up</span>
                          </button>

                          <div className="fin-dropdown-wrap">
                            <button
                              type="button"
                              className="fin-rec-action-btn"
                              onClick={() => setOpenDropdownId(openDropdownId === inv._id ? null : inv._id)}
                              title="More Options"
                            >
                              <span>•••</span>
                            </button>

                            {openDropdownId === inv._id && (
                              <div className="fin-action-menu">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    openCaseDrawer(inv);
                                  }}
                                >
                                  🔍 Case Details &amp; Timeline
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    handleOpenSchedule(inv);
                                  }}
                                >
                                  📅 Schedule Activity
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    handleOpenPromise(inv);
                                  }}
                                >
                                  🤝 Record Promise to Pay
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    handleOpenPayment(inv);
                                  }}
                                >
                                  💵 Record / Allocate Payment
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    handleOpenReminder(inv);
                                  }}
                                >
                                  📧 Send Payment Reminder
                                </button>
                                {rec.status !== 'Disputed / On Hold' ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenDropdownId(null);
                                      handleOpenDispute(inv);
                                    }}
                                  >
                                    ⚠️ Flag as Disputed
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenDropdownId(null);
                                      handleOpenResolveDispute(inv);
                                    }}
                                  >
                                    ✅ Resolve Dispute
                                  </button>
                                )}
                                {rec.status !== 'Closed' ? (
                                  <button
                                    type="button"
                                    style={{ color: '#dc2626' }}
                                    onClick={() => {
                                      setOpenDropdownId(null);
                                      handleOpenCloseCase(inv);
                                    }}
                                  >
                                    🔒 Close Case
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenDropdownId(null);
                                      handleReopenCase(inv);
                                    }}
                                  >
                                    🔓 Reopen Case
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    window.print();
                                  }}
                                >
                                  🖨️ Print Recovery Statement
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
      </div>

      {/* =========================================================================
          MODALS SECTION (All positioned via .fin-modal-overlay with Top Gap Fix)
          ========================================================================= */}

      {/* 1. Log Follow-up Modal */}
      {isFollowUpModalOpen && selectedCase && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Log Follow-up — {selectedCase.invoiceNumber}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleSubmitFollowUp}>
              <div className="fin-modal-body">
                {formError && <div className="fin-alert-item danger" style={{ marginBottom: '1rem' }}>{formError}</div>}

                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Client & Company</label>
                    <input
                      type="text"
                      disabled
                      value={`${selectedCase.clientName || ''} (${selectedCase.clientCompany || ''})`}
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Current Outstanding Balance</label>
                    <input
                      type="text"
                      disabled
                      value={formatCurrency(selectedCase.balance)}
                      style={{ color: '#dc2626', fontWeight: 700 }}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Contact Method*</label>
                    <select
                      value={formData.contactMethod}
                      onChange={(e) => setFormData({ ...formData, contactMethod: e.target.value })}
                    >
                      <option value="Call">Phone Call</option>
                      <option value="Email">Email</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Meeting">Meeting (In-person / Virtual)</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Contacted Person</label>
                    <input
                      type="text"
                      placeholder="Name of contact person"
                      value={formData.contactedPerson}
                      onChange={(e) => setFormData({ ...formData, contactedPerson: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Follow-up Outcome*</label>
                    <select
                      value={formData.outcome}
                      onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                    >
                      <option value="Connected">Connected / In Discussion</option>
                      <option value="Promise to pay">Promise to Pay</option>
                      <option value="Follow-up required">Follow-up Required (Callback requested)</option>
                      <option value="Payment received">Payment Made / Received</option>
                      <option value="Dispute raised">Dispute Raised by Client</option>
                      <option value="No response">No Response / Left Voicemail</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Next Follow-up Date</label>
                    <input
                      type="datetime-local"
                      value={formData.nextFollowUpDate}
                      onChange={(e) => setFormData({ ...formData, nextFollowUpDate: e.target.value })}
                    />
                  </div>

                  {formData.outcome === 'Promise to pay' && (
                    <>
                      <div className="fin-form-group">
                        <label>Promised Amount (₹)*</label>
                        <input
                          type="number"
                          required
                          value={formData.promisedAmount}
                          onChange={(e) => setFormData({ ...formData, promisedAmount: e.target.value })}
                        />
                      </div>
                      <div className="fin-form-group">
                        <label>Promised Payment Date*</label>
                        <input
                          type="date"
                          required
                          value={formData.promisedDate}
                          onChange={(e) => setFormData({ ...formData, promisedDate: e.target.value })}
                        />
                      </div>
                    </>
                  )}

                  <div className="fin-form-group">
                    <label>Assign Follow-up Owner</label>
                    <select
                      value={formData.assignedTo}
                      onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                    >
                      <option value="">Keep Existing Owner</option>
                      {teamMembers.map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.firstName} {u.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Client's Response / Remarks</label>
                    <input
                      type="text"
                      placeholder="What did the client say?"
                      value={formData.clientResponse}
                      onChange={(e) => setFormData({ ...formData, clientResponse: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Detailed Follow-up Notes*</label>
                    <textarea
                      rows="3"
                      required
                      placeholder="Log conversation summary, commitment, and action items..."
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-orange" disabled={formLoading}>
                  {formLoading ? 'Saving...' : 'Log Follow-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Schedule Follow-up Modal */}
      {isScheduleModalOpen && selectedCase && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Schedule Next Recovery Activity — {selectedCase.invoiceNumber}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleSubmitSchedule}>
              <div className="fin-modal-body">
                {formError && <div className="fin-alert-item danger" style={{ marginBottom: '1rem' }}>{formError}</div>}

                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Activity Type*</label>
                    <select
                      value={formData.activityType}
                      onChange={(e) => setFormData({ ...formData, activityType: e.target.value })}
                    >
                      <option value="Call">Phone Call</option>
                      <option value="Email">Send Official Demand / Email</option>
                      <option value="WhatsApp">WhatsApp Follow-up</option>
                      <option value="Meeting">Client Meeting</option>
                      <option value="Other">Other Review</option>
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Target Date & Time*</label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.nextFollowUpDate}
                      onChange={(e) => setFormData({ ...formData, nextFollowUpDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Assigned Recovery User*</label>
                    <select
                      value={formData.assignedTo}
                      onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                    >
                      <option value="">Select Finance Team Member</option>
                      {teamMembers.map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.firstName} {u.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    >
                      <option value="Urgent">Urgent</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Instructions & Reminders</label>
                    <textarea
                      rows="3"
                      placeholder="e.g. Call client CFO regarding promised transfer of balance due..."
                      value={formData.instructions}
                      onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-orange" disabled={formLoading}>
                  {formLoading ? 'Scheduling...' : 'Schedule Follow-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Promise to Pay Modal */}
      {isPromiseModalOpen && selectedCase && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Record Client Promise to Pay — {selectedCase.invoiceNumber}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleSubmitPromise}>
              <div className="fin-modal-body">
                {formError && <div className="fin-alert-item danger" style={{ marginBottom: '1rem' }}>{formError}</div>}

                <div className="fin-callout-card promise">
                  <strong>ℹ️ Promise to Pay Policy:</strong> Recording a commitment creates an active recovery target. It will not reduce the invoice balance until the payment is actually recorded and cleared in the bank.
                </div>

                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Promised Amount (₹)*</label>
                    <input
                      type="number"
                      required
                      max={selectedCase.balance}
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    />
                    <small style={{ color: '#64748b' }}>Current balance: {formatCurrency(selectedCase.balance)}</small>
                  </div>

                  <div className="fin-form-group">
                    <label>Promised Payment Date*</label>
                    <input
                      type="date"
                      required
                      value={formData.promisedDate}
                      onChange={(e) => setFormData({ ...formData, promisedDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Client's Commitment Statement</label>
                    <input
                      type="text"
                      placeholder="e.g. Managing Director confirmed RTGS transfer will be made by Friday"
                      value={formData.commitment}
                      onChange={(e) => setFormData({ ...formData, commitment: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Internal Follow-up Notes</label>
                    <textarea
                      rows="3"
                      placeholder="Additional details..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-orange" disabled={formLoading}>
                  {formLoading ? 'Saving...' : 'Record Promise'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Record Payment Modal */}
      {isPaymentModalOpen && selectedCase && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Record Client Payment — {selectedCase.invoiceNumber}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleSubmitPayment}>
              <div className="fin-modal-body">
                {formError && <div className="fin-alert-item danger" style={{ marginBottom: '1rem' }}>{formError}</div>}

                <div className="fin-form-grid-2">
                  <div className="fin-form-group col-span-2">
                    <label>Amount Received (₹)*</label>
                    <input
                      type="number"
                      required
                      max={selectedCase.balance}
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    />
                    <small style={{ color: '#64748b' }}>Current balance due: {formatCurrency(selectedCase.balance)}</small>
                  </div>

                  <div className="fin-form-group">
                    <label>Payment Method*</label>
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    >
                      <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                      <option value="UPI">UPI / QR Code</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Deposit to Bank Account*</label>
                    <select
                      value={formData.bankAccountId}
                      onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                    >
                      {bankAccountsList.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.bankName} — {b.accountName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Transaction Reference / UTR Number</label>
                    <input
                      type="text"
                      placeholder="e.g. UTR-829103984"
                      value={formData.transactionReference}
                      onChange={(e) => setFormData({ ...formData, transactionReference: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Payment Date*</label>
                    <input
                      type="date"
                      required
                      value={formData.paymentDate}
                      onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Remittance Notes</label>
                    <textarea
                      rows="2"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-orange" disabled={formLoading}>
                  {formLoading ? 'Processing...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Flag as Disputed Modal */}
      {isDisputeModalOpen && selectedCase && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Flag Receivable as Disputed / On Hold — {selectedCase.invoiceNumber}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleSubmitDispute}>
              <div className="fin-modal-body">
                {formError && <div className="fin-alert-item danger" style={{ marginBottom: '1rem' }}>{formError}</div>}

                <div className="fin-callout-card dispute">
                  <strong>⚠️ Disputed Receivables Policy:</strong> Flagging an invoice as disputed places the case on hold and highlights it in recovery reporting. It preserves the invoice and audit history without silently cancelling or altering records.
                </div>

                <div className="fin-form-grid-2">
                  <div className="fin-form-group col-span-2">
                    <label>Dispute Category*</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="Billing / Scope Dispute">Billing / Deliverable Scope Dispute</option>
                      <option value="Service Quality Issue">Service Quality / Deliverable Defect</option>
                      <option value="Delayed Deliverable">Milestone Delay / Timeline Dispute</option>
                      <option value="Duplicate Invoice / Incorrect Tax">Duplicate Invoice / Incorrect Tax Calculation</option>
                      <option value="Client Financial Hardship">Client Insolvency / Financial Hardship</option>
                      <option value="Other">Other Operational Dispute</option>
                    </select>
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Client's Stated Reason*</label>
                    <textarea
                      rows="3"
                      required
                      placeholder="Explain the client's contention or why payment is withheld..."
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-danger" disabled={formLoading}>
                  {formLoading ? 'Flagging...' : 'Place Case on Hold'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Resolve Dispute Modal */}
      {isResolveDisputeModalOpen && selectedCase && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Resolve Dispute — {selectedCase.invoiceNumber}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleSubmitResolveDispute}>
              <div className="fin-modal-body">
                {formError && <div className="fin-alert-item danger" style={{ marginBottom: '1rem' }}>{formError}</div>}

                <div className="fin-form-grid-2">
                  <div className="fin-form-group col-span-2">
                    <label>Resolution Action Taken</label>
                    <select
                      value={formData.actionTaken}
                      onChange={(e) => setFormData({ ...formData, actionTaken: e.target.value })}
                    >
                      <option value="Deliverable rectification accepted">Deliverable rectification accepted by client</option>
                      <option value="Scope clarification provided">Scope clarification provided and acknowledged</option>
                      <option value="Credit note issued for difference">Credit note issued for differential balance</option>
                      <option value="Mutually agreed payment plan established">Mutually agreed payment plan established</option>
                    </select>
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Detailed Resolution Notes*</label>
                    <textarea
                      rows="3"
                      required
                      placeholder="Document how the dispute was settled..."
                      value={formData.resolutionNotes}
                      onChange={(e) => setFormData({ ...formData, resolutionNotes: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-orange" disabled={formLoading}>
                  {formLoading ? 'Resolving...' : 'Resolve & Resume Recovery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Send Reminder Modal */}
      {isReminderModalOpen && selectedCase && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Send Recovery Reminder Email — {selectedCase.invoiceNumber}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleSubmitReminder}>
              <div className="fin-modal-body">
                {formError && <div className="fin-alert-item danger" style={{ marginBottom: '1rem' }}>{formError}</div>}

                <div className="fin-form-grid-2">
                  <div className="fin-form-group col-span-2">
                    <label>Recipient Email Address*</label>
                    <input
                      type="email"
                      required
                      value={formData.recipientEmail}
                      onChange={(e) => setFormData({ ...formData, recipientEmail: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Reminder Type</label>
                    <select
                      value={formData.reminderType}
                      onChange={(e) => setFormData({ ...formData, reminderType: e.target.value })}
                    >
                      <option value="Friendly Payment Reminder">Friendly Payment Reminder</option>
                      <option value="Overdue Notice">Overdue Notice</option>
                      <option value="Urgent Settlement Request">Urgent Settlement Request</option>
                      <option value="Final Demand Notice">Final Demand Notice</option>
                    </select>
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Custom Reminder Message</label>
                    <textarea
                      rows="4"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    />
                    <small style={{ color: '#64748b' }}>
                      The email will automatically include corporate header, invoice details, bank remittance info, and balance due.
                    </small>
                  </div>
                </div>
              </div>

              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-orange" disabled={formLoading}>
                  {formLoading ? 'Sending...' : 'Send Reminder Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Close Recovery Case Modal */}
      {isCloseModalOpen && selectedCase && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Close Recovery Case — {selectedCase.invoiceNumber}</h3>
              <button className="fin-modal-close-btn" onClick={closeAllModals}>✕</button>
            </div>
            <form onSubmit={handleSubmitCloseCase}>
              <div className="fin-modal-body">
                {formError && <div className="fin-alert-item danger" style={{ marginBottom: '1rem' }}>{formError}</div>}

                <div className="fin-form-grid-2">
                  <div className="fin-form-group col-span-2">
                    <label>Outstanding Balance Remaining</label>
                    <input
                      type="text"
                      disabled
                      value={formatCurrency(selectedCase.balance)}
                      style={{ fontWeight: 700, color: selectedCase.balance > 0 ? '#dc2626' : '#10b981' }}
                    />
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Closure Reason*</label>
                    <select
                      value={formData.closureReason}
                      onChange={(e) => setFormData({ ...formData, closureReason: e.target.value })}
                    >
                      {selectedCase.balance === 0 ? (
                        <option value="Paid in Full">Paid in Full (Zero Balance)</option>
                      ) : (
                        <>
                          <option value="Settled via Agreement">Settled via Formal Settlement Agreement</option>
                          <option value="Bad Debt Write-off">Authorized Bad Debt Write-off</option>
                          <option value="Legal Resolution">Handled via External Legal Resolution</option>
                          <option value="Management Approved Closure">Management Approved Discretionary Closure</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={closeAllModals}>
                  Cancel
                </button>
                <button type="submit" className="fin-btn-danger" disabled={formLoading}>
                  {formLoading ? 'Closing...' : 'Confirm Case Closure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          CASE DETAILS & TIMELINE DRAWER
          ========================================================================= */}
      {isDrawerOpen && selectedCase && (
        <div className="fin-drawer-overlay" onClick={() => setIsDrawerOpen(false)}>
          <div className="fin-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="fin-drawer-header">
              <div>
                <h3>Case: {selectedCase.invoiceNumber}</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {selectedCase.clientName} ({selectedCase.clientCompany || 'Client'})
                </div>
              </div>
              <button className="fin-modal-close-btn" onClick={() => setIsDrawerOpen(false)}>✕</button>
            </div>

            <div className="fin-drawer-tabs">
              <button
                className={`fin-drawer-tab ${drawerTab === 'overview' ? 'active' : ''}`}
                onClick={() => setDrawerTab('overview')}
              >
                Overview
              </button>
              <button
                className={`fin-drawer-tab ${drawerTab === 'timeline' ? 'active' : ''}`}
                onClick={() => setDrawerTab('timeline')}
              >
                Follow-ups ({selectedCase.recovery?.followUps?.length || 0})
              </button>
              <button
                className={`fin-drawer-tab ${drawerTab === 'promise' ? 'active' : ''}`}
                onClick={() => setDrawerTab('promise')}
              >
                Promise to Pay
              </button>
              <button
                className={`fin-drawer-tab ${drawerTab === 'dispute' ? 'active' : ''}`}
                onClick={() => setDrawerTab('dispute')}
              >
                Dispute Info
              </button>
              <button
                className={`fin-drawer-tab ${drawerTab === 'payments' ? 'active' : ''}`}
                onClick={() => setDrawerTab('payments')}
              >
                Payments
              </button>
              <button
                className={`fin-drawer-tab ${drawerTab === 'audit' ? 'active' : ''}`}
                onClick={() => setDrawerTab('audit')}
              >
                Audit Log
              </button>
            </div>

            <div className="fin-drawer-body">
              {detailsLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading case details...</div>
              ) : (
                <>
                  {/* TAB 1: OVERVIEW */}
                  {drawerTab === 'overview' && (
                    <div>
                      <div className="fin-detail-section">
                        <h4>Financial Position</h4>
                        <div className="fin-detail-grid">
                          <div className="fin-detail-item">
                            <span className="fin-detail-label">Invoice Total</span>
                            <span className="fin-detail-val">{formatCurrency(selectedCase.total || selectedCase.amount)}</span>
                          </div>
                          <div className="fin-detail-item">
                            <span className="fin-detail-label">Amount Paid</span>
                            <span className="fin-detail-val text-success">{formatCurrency(selectedCase.paidAmount)}</span>
                          </div>
                          <div className="fin-detail-item">
                            <span className="fin-detail-label">Balance Due</span>
                            <span className="fin-detail-val text-danger" style={{ fontWeight: 700 }}>
                              {formatCurrency(selectedCase.balance)}
                            </span>
                          </div>
                          <div className="fin-detail-item">
                            <span className="fin-detail-label">Days Overdue</span>
                            <span className="fin-detail-val">{getDaysOverdue(selectedCase.dueDate)} days</span>
                          </div>
                        </div>
                      </div>

                      <div className="fin-detail-section">
                        <h4>Recovery Management</h4>
                        <div className="fin-detail-grid">
                          <div className="fin-detail-item">
                            <span className="fin-detail-label">Status</span>
                            <span className="fin-detail-val">{selectedCase.recovery?.status || 'Not Started'}</span>
                          </div>
                          <div className="fin-detail-item">
                            <span className="fin-detail-label">Priority</span>
                            <span className="fin-detail-val">{selectedCase.recovery?.priority || 'Medium'}</span>
                          </div>
                          <div className="fin-detail-item">
                            <span className="fin-detail-label">Recovery Owner</span>
                            <span className="fin-detail-val">{selectedCase.recovery?.ownerName || 'Unassigned'}</span>
                          </div>
                          <div className="fin-detail-item">
                            <span className="fin-detail-label">Next Scheduled Follow-up</span>
                            <span className="fin-detail-val">
                              {selectedCase.recovery?.nextFollowUp ? new Date(selectedCase.recovery.nextFollowUp).toLocaleString('en-IN') : 'None'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="fin-detail-section">
                        <h4>Client Information</h4>
                        <div className="fin-detail-grid">
                          <div className="fin-detail-item">
                            <span className="fin-detail-label">Client Name</span>
                            <span className="fin-detail-val">{selectedCase.clientName}</span>
                          </div>
                          <div className="fin-detail-item">
                            <span className="fin-detail-label">Email</span>
                            <span className="fin-detail-val">{selectedCase.clientEmail || '—'}</span>
                          </div>
                          <div className="fin-detail-item">
                            <span className="fin-detail-label">Company</span>
                            <span className="fin-detail-val">{selectedCase.clientCompany || '—'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: FOLLOW-UP TIMELINE */}
                  {drawerTab === 'timeline' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                        <button className="fin-btn-orange fin-btn-sm" onClick={() => handleOpenFollowUp(selectedCase)}>
                          + Add Follow-up
                        </button>
                      </div>

                      {(!selectedCase.recovery?.followUps || selectedCase.recovery.followUps.length === 0) ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No follow-up activity logged yet.</div>
                      ) : (
                        <div className="fin-timeline">
                          {selectedCase.recovery.followUps
                            .slice()
                            .reverse()
                            .map((f, idx) => (
                              <div className="fin-timeline-item" key={idx}>
                                <div
                                  className={`fin-timeline-dot ${f.outcome === 'Promise to pay' ? 'promise' : f.outcome === 'Payment received' ? 'payment' : f.outcome === 'Dispute raised' ? 'dispute' : ''}`}
                                />
                                <div className="fin-timeline-card">
                                  <div className="fin-timeline-header">
                                    <strong>[{f.contactMethod || 'Call'}] {f.outcome}</strong>
                                    <span className="fin-timeline-meta">{new Date(f.date).toLocaleString('en-IN')}</span>
                                  </div>
                                  <div className="fin-timeline-text">{f.note}</div>
                                  {f.clientResponse && (
                                    <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: '#64748b' }}>
                                      <em>Client: "{f.clientResponse}"</em>
                                    </div>
                                  )}
                                  <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: '#94a3b8' }}>
                                    Logged by: {f.followUpBy || 'Staff'}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: PROMISE TO PAY */}
                  {drawerTab === 'promise' && (
                    <div>
                      {selectedCase.recovery?.promiseToPay && selectedCase.recovery.promiseToPay.amount > 0 ? (
                        <div className="fin-callout-card promise">
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <strong style={{ fontSize: '1rem', color: '#7c3aed' }}>
                              Active Promise: {formatCurrency(selectedCase.recovery.promiseToPay.amount)}
                            </strong>
                            <span className="fin-rec-badge promise-to-pay">
                              {selectedCase.recovery.promiseToPay.status}
                            </span>
                          </div>
                          <div>
                            <strong>Promised Date: </strong>
                            {formatDate(selectedCase.recovery.promiseToPay.promisedDate)}
                          </div>
                          <div style={{ marginTop: '0.25rem' }}>
                            <strong>Commitment: </strong>
                            {selectedCase.recovery.promiseToPay.commitment}
                          </div>
                          <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#64748b' }}>
                            Recorded by {selectedCase.recovery.promiseToPay.recordedByName} on{' '}
                            {formatDate(selectedCase.recovery.promiseToPay.recordedAt)}
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                          No active Promise to Pay commitment.
                        </div>
                      )}

                      <div style={{ marginTop: '1rem' }}>
                        <button className="fin-btn-secondary fin-btn-sm" onClick={() => handleOpenPromise(selectedCase)}>
                          {selectedCase.recovery?.promiseToPay?.amount ? 'Revise Commitment' : 'Record Promise to Pay'}
                        </button>
                      </div>

                      {selectedCase.recovery?.promiseToPay?.history?.length > 0 && (
                        <div style={{ marginTop: '1.5rem' }}>
                          <h5>Commitment Revision History</h5>
                          <table className="fin-data-table" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                            <thead>
                              <tr>
                                <th>Amount</th>
                                <th>Promised Date</th>
                                <th>Status</th>
                                <th>Archived Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedCase.recovery.promiseToPay.history.map((h, i) => (
                                <tr key={i}>
                                  <td>{formatCurrency(h.amount)}</td>
                                  <td>{formatDate(h.promisedDate)}</td>
                                  <td>{h.status || 'Revised'}</td>
                                  <td>{formatDate(h.archivedAt)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 4: DISPUTE INFO */}
                  {drawerTab === 'dispute' && (
                    <div>
                      {selectedCase.recovery?.dispute?.isDisputed ? (
                        <div className="fin-callout-card dispute">
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <strong style={{ color: '#be123c' }}>
                              Case on Hold: {selectedCase.recovery.dispute.category}
                            </strong>
                            <span className="fin-rec-badge disputed">Disputed</span>
                          </div>
                          <div>
                            <strong>Reason: </strong> {selectedCase.recovery.dispute.reason}
                          </div>
                          <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#64748b' }}>
                            Flagged on {formatDate(selectedCase.recovery.dispute.dateRaised)}
                          </div>
                          <div style={{ marginTop: '0.75rem' }}>
                            <button
                              className="fin-btn-orange fin-btn-sm"
                              onClick={() => handleOpenResolveDispute(selectedCase)}
                            >
                              Resolve Dispute
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                          No active dispute flagged for this invoice.
                          <div style={{ marginTop: '0.75rem' }}>
                            <button
                              className="fin-btn-secondary fin-btn-sm"
                              onClick={() => handleOpenDispute(selectedCase)}
                            >
                              Flag as Disputed
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 5: PAYMENTS */}
                  {drawerTab === 'payments' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h5>Payment Allocation History</h5>
                        <button
                          className="fin-btn-orange fin-btn-sm"
                          onClick={() => handleOpenPayment(selectedCase)}
                        >
                          + Record Payment
                        </button>
                      </div>

                      {(!caseDetails?.payments || caseDetails.payments.length === 0) ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                          No payments allocated yet for this invoice.
                        </div>
                      ) : (
                        <table className="fin-data-table" style={{ fontSize: '0.8rem' }}>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Method</th>
                              <th>Reference</th>
                              <th>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {caseDetails.payments.map((p) => (
                              <tr key={p._id}>
                                <td>{formatDate(p.paymentDate)}</td>
                                <td>{p.paymentMethod}</td>
                                <td>{p.transactionReference || '—'}</td>
                                <td style={{ color: '#10b981', fontWeight: 600 }}>{formatCurrency(p.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* TAB 6: AUDIT LOG */}
                  {drawerTab === 'audit' && (
                    <div>
                      {(!caseDetails?.auditLogs || caseDetails.auditLogs.length === 0) ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                          No audit trail records found.
                        </div>
                      ) : (
                        <table className="fin-data-table" style={{ fontSize: '0.78rem' }}>
                          <thead>
                            <tr>
                              <th>Timestamp</th>
                              <th>Action</th>
                              <th>User</th>
                              <th>Reason / Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {caseDetails.auditLogs.map((a) => (
                              <tr key={a._id}>
                                <td>{new Date(a.timestamp).toLocaleString('en-IN')}</td>
                                <td><strong>{a.action}</strong></td>
                                <td>{a.performedByName}</td>
                                <td>{a.reason || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
