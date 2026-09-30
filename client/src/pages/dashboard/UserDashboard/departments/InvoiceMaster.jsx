import React, { useState, useMemo, useEffect } from 'react';
import apiClient from '../../../../services/apiClient';

export default function InvoiceMaster({
  invoices = [],
  setInvoices,
  summary: externalSummary,
  formatCurrency = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`,
  formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'),
  user,
  onRefresh,
  openModal,
}) {
  // Navigation & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, draft, pending, approved, issued, sent, partially-paid, paid, overdue, cancelled, credited
  const [clientFilter, setClientFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all'); // all, unpaid, partial, paid
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Client Master records & Proposals & Bank Accounts for selectors
  const [clientOptions, setClientOptions] = useState([]);
  const [clientProjects, setClientProjects] = useState([]);
  const [proposalsList, setProposalsList] = useState([]);
  const [bankAccountsList, setBankAccountsList] = useState([]);

  // Active Invoice for Detailed View or Modals
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceDetails, setInvoiceDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsTab, setDetailsTab] = useState('items'); // items, payments, milestones, credits, recovery, audit

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [createStep, setCreateStep] = useState(1); // 1: Client, 2: Project/Prop, 3: Items, 4: Milestones, 5: Terms, 6: Review
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCreditNoteModalOpen, setIsCreditNoteModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedReceiptData, setSelectedReceiptData] = useState(null);

  // Form States
  const defaultItem = {
    name: 'Enterprise IT Consulting & Software Development',
    description: 'Full-stack software design, architecture, implementation & quality assurance',
    qty: 1,
    unit: 'Unit',
    rate: 50000,
    discount: 0,
    taxRate: 18,
    taxAmount: 9000,
    amount: 59000,
  };

  const [formData, setFormData] = useState({
    invoiceNumber: '',
    client: '',
    clientName: '',
    clientCompany: '',
    email: '',
    mobileNo: '',
    address: '',
    gstin: '',
    project: '',
    proposal: '',
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    items: [{ ...defaultItem }],
    milestones: [
      { name: 'Advance on Project Kickoff', percentage: 50, amount: 0, status: 'Pending' },
      { name: 'UAT & Milestone Delivery', percentage: 30, amount: 0, status: 'Pending' },
      { name: 'Final Handover & Sign-off', percentage: 20, amount: 0, status: 'Pending' },
    ],
    discount: 0,
    taxType: 'GST',
    paymentTerms: 'Net 30',
    paymentInstructions: 'Bank Transfer (NEFT / RTGS / IMPS):\nBank: HDFC Bank Ltd | A/C: 50200084920192\nIFSC: HDFC0001204 | Branch: Cyber City, Pune\nUPI: aashasmtech@hdfcbank',
    clientNotes: 'Thank you for your business. Please quote the invoice number when making electronic payment.',
    internalNotes: '',
    status: 'Draft',
  });

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Payment Form
  const [paymentFormData, setPaymentFormData] = useState({
    amount: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'Bank Transfer',
    transactionReference: '',
    bankAccountId: '',
    notes: '',
  });
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // Credit Note Form
  const [creditNoteData, setCreditNoteData] = useState({
    amount: '',
    taxAdjusted: 0,
    reason: 'Scope Adjustment / Commercial Discount',
    notes: '',
  });
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditError, setCreditError] = useState('');

  // Cancel Form
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // Send Form
  const [sendData, setSendData] = useState({
    recipientEmail: '',
    customMessage: '',
  });
  const [sendLoading, setSendLoading] = useState(false);

  // Recovery Form
  const [recoveryData, setRecoveryData] = useState({
    status: 'In Progress',
    note: '',
    nextFollowUp: '',
    promiseToPayDate: '',
  });
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  // 1. Fetch dropdown prerequisites
  useEffect(() => {
    const fetchPrerequisites = async () => {
      try {
        const [clientsRes, proposalsRes, banksRes] = await Promise.all([
          apiClient.get('/finance/clients').catch(() => ({ data: { data: [] } })),
          apiClient.get('/finance/proposals').catch(() => ({ data: { data: [] } })),
          apiClient.get('/finance/bank-accounts').catch(() => ({ data: { data: [] } })),
        ]);

        const rawClients = clientsRes.data?.data;
        setClientOptions(Array.isArray(rawClients) ? rawClients : rawClients?.clients || []);

        const rawProposals = proposalsRes.data?.data;
        setProposalsList(Array.isArray(rawProposals) ? rawProposals : rawProposals?.proposals || []);

        const rawBanks = banksRes.data?.data;
        setBankAccountsList(Array.isArray(rawBanks) ? rawBanks : rawBanks?.accounts || []);
      } catch (err) {
        console.error('Failed to load invoice prerequisites:', err);
      }
    };
    fetchPrerequisites();
  }, []);

  // 2. Fetch projects when client changes in create form
  useEffect(() => {
    if (!formData.client) {
      setClientProjects([]);
      return;
    }
    const fetchClientProjects = async () => {
      try {
        const res = await apiClient.get(`/finance/projects?client=${formData.client}`);
        setClientProjects(res.data?.data || []);
      } catch (err) {
        console.error('Failed to load client projects:', err);
        setClientProjects([]);
      }
    };
    fetchClientProjects();
  }, [formData.client]);

  // 3. Fetch full details when selectedInvoice changes
  useEffect(() => {
    if (!selectedInvoice?._id) {
      setInvoiceDetails(null);
      return;
    }

    const fetchDetails = async () => {
      setDetailsLoading(true);
      try {
        const res = await apiClient.get(`/finance/invoices/${selectedInvoice._id}`);
        setInvoiceDetails(res.data?.data?.invoice || selectedInvoice);
      } catch (err) {
        console.error('Failed to fetch invoice details:', err);
        setInvoiceDetails(selectedInvoice);
      } finally {
        setDetailsLoading(false);
      }
    };

    fetchDetails();
  }, [selectedInvoice?._id]);

  // 4. Live Form Calculations
  const calculatedFormTotals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;

    formData.items.forEach((it) => {
      const q = Math.max(0, Number(it.qty) || 1);
      const r = Math.max(0, Number(it.rate) || 0);
      const d = Math.max(0, Math.min(100, Number(it.discount) || 0));
      const lineBase = q * r;
      const discAmt = (lineBase * d) / 100;
      const taxable = lineBase - discAmt;
      const tRate = Math.max(0, Number(it.taxRate) || 0);
      const lineTax = (taxable * tRate) / 100;

      subtotal += taxable;
      taxTotal += lineTax;
    });

    const disc = Math.max(0, Number(formData.discount) || 0);
    const taxableAfterInvoiceDisc = Math.max(0, subtotal - disc);
    const isInterState = formData.taxType === 'IGST' || formData.taxType === 'INTER_STATE';

    const cgst = isInterState ? 0 : Math.round((taxTotal / 2) * 100) / 100;
    const sgst = isInterState ? 0 : Math.round((taxTotal / 2) * 100) / 100;
    const igst = isInterState ? Math.round(taxTotal * 100) / 100 : 0;
    const grandTotal = Math.max(0, Math.round((taxableAfterInvoiceDisc + taxTotal) * 100) / 100);

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxableAmount: Math.round(taxableAfterInvoiceDisc * 100) / 100,
      cgst,
      sgst,
      igst,
      totalTax: Math.round(taxTotal * 100) / 100,
      grandTotal,
    };
  }, [formData.items, formData.discount, formData.taxType]);

  // 5. Dynamic KPI Calculations (Always accurate from real data)
  const metrics = useMemo(() => {
    if (externalSummary && Object.keys(externalSummary).length > 0) {
      return externalSummary;
    }

    const now = new Date();
    let totalInvoiced = 0;
    let totalInvoicedCount = 0;
    let outstanding = 0;
    let outstandingCount = 0;
    let overdue = 0;
    let overdueCount = 0;
    let paymentsReceived = 0;
    let draftCount = 0;
    let draftValue = 0;
    let pendingApprovalCount = 0;
    let approvedCount = 0;
    let issuedCount = 0;
    let sentCount = 0;
    let partiallyPaidCount = 0;
    let partiallyPaidBalance = 0;
    let paidCount = 0;
    let cancelledCount = 0;
    let creditedCount = 0;

    invoices.forEach((inv) => {
      const tot = Number(inv.total) || (Number(inv.amount) || 0) + (Number(inv.cgst) || 0) + (Number(inv.sgst) || 0) + (Number(inv.igst) || 0) - (Number(inv.discount) || 0);
      const paid = Number(inv.paidAmount) || 0;
      const bal = inv.balance !== undefined ? Number(inv.balance) : Math.max(0, tot - paid);

      if (inv.status === 'Draft') {
        draftCount += 1;
        draftValue += tot;
      } else if (inv.status === 'Pending Approval') {
        pendingApprovalCount += 1;
        draftValue += tot;
      } else if (inv.status === 'Approved') {
        approvedCount += 1;
        totalInvoiced += tot;
        totalInvoicedCount += 1;
      } else if (inv.status === 'Issued') {
        issuedCount += 1;
        totalInvoiced += tot;
        totalInvoicedCount += 1;
      } else if (inv.status === 'Sent') {
        sentCount += 1;
        totalInvoiced += tot;
        totalInvoicedCount += 1;
      } else if (inv.status === 'Partially Paid') {
        partiallyPaidCount += 1;
        partiallyPaidBalance += bal;
        totalInvoiced += tot;
        totalInvoicedCount += 1;
      } else if (inv.status === 'Paid') {
        paidCount += 1;
        totalInvoiced += tot;
        totalInvoicedCount += 1;
      } else if (inv.status === 'Cancelled') {
        cancelledCount += 1;
      } else if (inv.status === 'Credited') {
        creditedCount += 1;
      }

      if (inv.status !== 'Cancelled') {
        paymentsReceived += paid;

        if (bal > 0 && inv.status !== 'Draft' && inv.status !== 'Pending Approval') {
          outstanding += bal;
          outstandingCount += 1;

          if (inv.dueDate && new Date(inv.dueDate) < now) {
            overdue += bal;
            overdueCount += 1;
          }
        }
      }
    });

    return {
      totalInvoiced: Math.round(totalInvoiced * 100) / 100,
      totalInvoicedCount,
      outstanding: Math.round(outstanding * 100) / 100,
      outstandingCount,
      overdue: Math.round(overdue * 100) / 100,
      overdueCount,
      paymentsReceived: Math.round(paymentsReceived * 100) / 100,
      draftCount,
      draftValue: Math.round(draftValue * 100) / 100,
      pendingApprovalCount,
      approvedCount,
      issuedCount,
      sentCount,
      partiallyPaidCount,
      partiallyPaidBalance: Math.round(partiallyPaidBalance * 100) / 100,
      paidCount,
      cancelledCount,
      creditedCount,
    };
  }, [invoices, externalSummary]);

  // 6. Filtered Invoices List
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const num = (inv.invoiceNumber || '').toLowerCase();
        const client = (inv.clientName || '').toLowerCase();
        const comp = (inv.client?.company || inv.clientCompany || '').toLowerCase();
        const em = (inv.email || '').toLowerCase();
        const prj = (inv.project?.name || '').toLowerCase();
        const prop = (inv.proposal?.proposalNumber || '').toLowerCase();
        if (!num.includes(q) && !client.includes(q) && !comp.includes(q) && !em.includes(q) && !prj.includes(q) && !prop.includes(q)) {
          return false;
        }
      }

      // Status Filter
      if (statusFilter !== 'all') {
        const now = new Date();
        const bal = Number(inv.balance) || 0;
        const isPastDue = inv.dueDate && new Date(inv.dueDate) < now && bal > 0 && inv.status !== 'Cancelled';

        if (statusFilter === 'overdue' && !isPastDue) return false;
        if (statusFilter === 'draft' && inv.status !== 'Draft') return false;
        if (statusFilter === 'pending' && inv.status !== 'Pending Approval') return false;
        if (statusFilter === 'approved' && inv.status !== 'Approved') return false;
        if (statusFilter === 'issued' && inv.status !== 'Issued') return false;
        if (statusFilter === 'sent' && inv.status !== 'Sent') return false;
        if (statusFilter === 'partially-paid' && inv.status !== 'Partially Paid') return false;
        if (statusFilter === 'paid' && inv.status !== 'Paid') return false;
        if (statusFilter === 'cancelled' && inv.status !== 'Cancelled') return false;
        if (statusFilter === 'credited' && inv.status !== 'Credited') return false;
      }

      // Client Filter
      if (clientFilter !== 'all') {
        const cId = inv.client?._id || inv.client;
        if (String(cId) !== String(clientFilter)) return false;
      }

      // Payment State Filter
      if (paymentFilter !== 'all') {
        const paid = Number(inv.paidAmount) || 0;
        const bal = Number(inv.balance) || 0;
        if (paymentFilter === 'unpaid' && paid > 0) return false;
        if (paymentFilter === 'partial' && (paid === 0 || bal === 0)) return false;
        if (paymentFilter === 'paid' && bal > 0) return false;
      }

      // Date Range Filter
      if (startDate) {
        if (!inv.issueDate || new Date(inv.issueDate) < new Date(startDate)) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (!inv.issueDate || new Date(inv.issueDate) > end) return false;
      }

      return true;
    });
  }, [invoices, searchTerm, statusFilter, clientFilter, paymentFilter, startDate, endDate]);

  // Status Counts for Pills
  const statusCounts = useMemo(() => {
    const counts = {
      all: invoices.length,
      draft: 0,
      pending: 0,
      approved: 0,
      issued: 0,
      sent: 0,
      partiallyPaid: 0,
      paid: 0,
      overdue: 0,
      cancelled: 0,
      credited: 0,
    };

    const now = new Date();
    invoices.forEach((inv) => {
      const bal = Number(inv.balance) || 0;
      if (inv.status === 'Draft') counts.draft += 1;
      else if (inv.status === 'Pending Approval') counts.pending += 1;
      else if (inv.status === 'Approved') counts.approved += 1;
      else if (inv.status === 'Issued') counts.issued += 1;
      else if (inv.status === 'Sent') counts.sent += 1;
      else if (inv.status === 'Partially Paid') counts.partiallyPaid += 1;
      else if (inv.status === 'Paid') counts.paid += 1;
      else if (inv.status === 'Cancelled') counts.cancelled += 1;
      else if (inv.status === 'Credited') counts.credited += 1;

      if (inv.dueDate && new Date(inv.dueDate) < now && bal > 0 && inv.status !== 'Cancelled') {
        counts.overdue += 1;
      }
    });

    return counts;
  }, [invoices]);

  // Handlers for Items
  const handleItemChange = (idx, field, value) => {
    const updated = [...formData.items];
    const it = { ...updated[idx], [field]: value };

    const q = Math.max(0, Number(field === 'qty' ? value : it.qty) || 1);
    const r = Math.max(0, Number(field === 'rate' ? value : it.rate) || 0);
    const d = Math.max(0, Math.min(100, Number(field === 'discount' ? value : it.discount) || 0));
    const tRate = Math.max(0, Number(field === 'taxRate' ? value : it.taxRate) || 0);

    const lineBase = q * r;
    const discAmt = (lineBase * d) / 100;
    const taxable = lineBase - discAmt;
    const lineTax = (taxable * tRate) / 100;

    it.amount = Math.round((taxable + lineTax) * 100) / 100;
    it.taxAmount = Math.round(lineTax * 100) / 100;
    updated[idx] = it;
    setFormData({ ...formData, items: updated });
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          name: '',
          description: '',
          qty: 1,
          unit: 'Unit',
          rate: 0,
          discount: 0,
          taxRate: 18,
          taxAmount: 0,
          amount: 0,
        },
      ],
    });
  };

  const handleDuplicateItem = (idx) => {
    const target = formData.items[idx];
    const updated = [...formData.items];
    updated.splice(idx + 1, 0, { ...target });
    setFormData({ ...formData, items: updated });
  };

  const handleMoveItemUp = (idx) => {
    if (idx === 0) return;
    const updated = [...formData.items];
    const temp = updated[idx];
    updated[idx] = updated[idx - 1];
    updated[idx - 1] = temp;
    setFormData({ ...formData, items: updated });
  };

  const handleMoveItemDown = (idx) => {
    if (idx === formData.items.length - 1) return;
    const updated = [...formData.items];
    const temp = updated[idx];
    updated[idx] = updated[idx + 1];
    updated[idx + 1] = temp;
    setFormData({ ...formData, items: updated });
  };

  const handleRemoveItem = (idx) => {
    if (formData.items.length <= 1) return;
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== idx),
    });
  };

  // Milestone Presets
  const applyMilestonePreset = (preset) => {
    const total = calculatedFormTotals.grandTotal;
    if (preset === '50/50') {
      setFormData((prev) => ({
        ...prev,
        milestones: [
          { name: 'Advance on Contract Signing', percentage: 50, amount: Math.round(total * 0.5), status: 'Pending' },
          { name: 'Final Delivery & Acceptance', percentage: 50, amount: Math.round(total * 0.5), status: 'Pending' },
        ],
      }));
    } else if (preset === '30/40/30') {
      setFormData((prev) => ({
        ...prev,
        milestones: [
          { name: 'Project Advance', percentage: 30, amount: Math.round(total * 0.3), status: 'Pending' },
          { name: 'Beta Deployment & UAT', percentage: 40, amount: Math.round(total * 0.4), status: 'Pending' },
          { name: 'Final Production Release', percentage: 30, amount: Math.round(total * 0.3), status: 'Pending' },
        ],
      }));
    } else if (preset === '40/30/20/10') {
      setFormData((prev) => ({
        ...prev,
        milestones: [
          { name: 'Initial Advance', percentage: 40, amount: Math.round(total * 0.4), status: 'Pending' },
          { name: 'Design & Architecture Sign-off', percentage: 30, amount: Math.round(total * 0.3), status: 'Pending' },
          { name: 'UAT & Client Verification', percentage: 20, amount: Math.round(total * 0.2), status: 'Pending' },
          { name: 'Warranty & Handover', percentage: 10, amount: Math.round(total * 0.1), status: 'Pending' },
        ],
      }));
    }
  };

  // Client Selection Auto-fill
  const handleClientSelect = (clientId) => {
    if (!clientId) {
      setFormData({
        ...formData,
        client: '',
        clientName: '',
        clientCompany: '',
        email: '',
        mobileNo: '',
        address: '',
        gstin: '',
        project: '',
      });
      return;
    }

    const c = clientOptions.find((x) => String(x._id) === String(clientId));
    if (c) {
      setFormData({
        ...formData,
        client: c._id,
        clientName: c.name || c.clientName || '',
        clientCompany: c.company || '',
        email: c.email || '',
        mobileNo: c.phone || c.mobile || '',
        address: c.billingAddress?.street ? `${c.billingAddress.street}, ${c.billingAddress.city || ''}, ${c.billingAddress.state || ''}` : (c.address || ''),
        gstin: c.taxInfo?.gstin || c.gstin || '',
        paymentTerms: c.financialProfile?.paymentTerms || c.paymentTerms || 'Net 30',
        project: '',
      });
    }
  };

  // Proposal Selection Auto-fill
  const handleProposalSelect = (proposalId) => {
    if (!proposalId) {
      setFormData({ ...formData, proposal: '' });
      return;
    }

    const p = proposalsList.find((x) => String(x._id) === String(proposalId));
    if (p) {
      const items = Array.isArray(p.items) && p.items.length > 0
        ? p.items.map((it) => ({
            name: it.name || it.description || 'Proposal Service',
            description: it.description || '',
            qty: it.qty || 1,
            unit: it.unit || 'Unit',
            rate: it.rate || 0,
            discount: it.discount || 0,
            taxRate: it.taxRate || 18,
            taxAmount: it.taxAmount || 0,
            amount: it.amount || 0,
          }))
        : [{ ...defaultItem, rate: p.subtotal || p.total || 0, amount: p.total || 0 }];

      setFormData((prev) => ({
        ...prev,
        proposal: p._id,
        project: p.project?._id || p.project || prev.project,
        client: p.client?._id || p.client || prev.client,
        clientName: p.clientName || prev.clientName,
        clientCompany: p.clientCompany || prev.clientCompany,
        email: p.clientEmail || prev.email,
        mobileNo: p.clientPhone || prev.mobileNo,
        address: p.clientAddress || prev.address,
        gstin: p.clientGstin || prev.gstin,
        items,
        discount: p.discount || 0,
        taxType: p.taxType === 'INTER_STATE' || p.igst > 0 ? 'IGST' : 'GST',
        paymentTerms: p.commercialTerms?.paymentTerms || prev.paymentTerms,
        clientNotes: p.commercialTerms?.clientNotes || prev.clientNotes,
      }));
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setCreateStep(1);
    setFormData({
      invoiceNumber: '',
      client: '',
      clientName: '',
      clientCompany: '',
      email: '',
      mobileNo: '',
      address: '',
      gstin: '',
      project: '',
      proposal: '',
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      items: [{ ...defaultItem }],
      milestones: [
        { name: 'Advance on Project Kickoff', percentage: 50, amount: 0, status: 'Pending' },
        { name: 'UAT & Milestone Delivery', percentage: 30, amount: 0, status: 'Pending' },
        { name: 'Final Handover & Sign-off', percentage: 20, amount: 0, status: 'Pending' },
      ],
      discount: 0,
      taxType: 'GST',
      paymentTerms: 'Net 30',
      paymentInstructions: 'Bank Transfer (NEFT / RTGS / IMPS):\nBank: HDFC Bank Ltd | A/C: 50200084920192\nIFSC: HDFC0001204 | Branch: Cyber City, Pune\nUPI: aashasmtech@hdfcbank',
      clientNotes: 'Thank you for your business. Please quote the invoice number when making electronic payment.',
      internalNotes: '',
      status: 'Draft',
    });
    setFormError('');
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (inv) => {
    setIsEditMode(true);
    setCreateStep(1);
    setSelectedInvoice(inv);
    setFormData({
      invoiceNumber: inv.invoiceNumber,
      client: inv.client?._id || inv.client || '',
      clientName: inv.clientName || '',
      clientCompany: inv.client?.company || inv.clientCompany || '',
      email: inv.email || '',
      mobileNo: inv.mobileNo || '',
      address: inv.address || '',
      gstin: inv.gstin || '',
      project: inv.project?._id || inv.project || '',
      proposal: inv.proposal?._id || inv.proposal || '',
      issueDate: inv.issueDate ? new Date(inv.issueDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      items: Array.isArray(inv.items) && inv.items.length > 0 ? inv.items : [{ ...defaultItem }],
      milestones: Array.isArray(inv.milestones) && inv.milestones.length > 0 ? inv.milestones : [],
      discount: inv.discount || 0,
      taxType: inv.taxType || 'GST',
      paymentTerms: inv.paymentTerms || 'Net 30',
      paymentInstructions: inv.paymentInstructions || '',
      clientNotes: inv.clientNotes || '',
      internalNotes: inv.internalNotes || '',
      status: inv.status || 'Draft',
    });
    setFormError('');
    setIsCreateModalOpen(true);
  };

  // Submit Invoice (Create or Edit)
  const handleSubmitInvoice = async (targetStatus = 'Draft') => {
    if (!formData.clientName.trim()) {
      setFormError('Client name is mandatory.');
      setCreateStep(1);
      return;
    }
    if (new Date(formData.dueDate) < new Date(formData.issueDate)) {
      setFormError('Due date cannot be earlier than invoice issue date.');
      setCreateStep(1);
      return;
    }

    setFormLoading(true);
    setFormError('');

    try {
      const payload = {
        ...formData,
        status: targetStatus,
        milestones: formData.milestones.map((m) => ({
          ...m,
          amount: Math.round(calculatedFormTotals.grandTotal * (Number(m.percentage) / 100)),
        })),
      };

      if (isEditMode && selectedInvoice?._id) {
        await apiClient.put(`/finance/invoices/${selectedInvoice._id}`, payload);
      } else {
        await apiClient.post('/finance/invoices', payload);
      }

      setIsCreateModalOpen(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Failed to save invoice');
    } finally {
      setFormLoading(false);
    }
  };

  // Open Payment Modal
  const handleOpenPaymentModal = (inv) => {
    setSelectedInvoice(inv);
    setPaymentFormData({
      amount: inv.balance > 0 ? inv.balance : '',
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'Bank Transfer',
      transactionReference: '',
      bankAccountId: bankAccountsList.length > 0 ? bankAccountsList[0]._id : '',
      notes: `Settlement for Invoice ${inv.invoiceNumber}`,
    });
    setPaymentError('');
    setIsPaymentModalOpen(true);
  };

  // Submit Payment
  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    const payAmt = Number(paymentFormData.amount);
    const bal = Number(selectedInvoice?.balance) || 0;

    if (!payAmt || payAmt <= 0) {
      setPaymentError('Payment amount must be greater than zero.');
      return;
    }
    if (payAmt > bal + 0.01) {
      setPaymentError(`Payment amount cannot exceed remaining balance of ${formatCurrency(bal)}.`);
      return;
    }

    setPaymentLoading(true);
    setPaymentError('');

    try {
      const res = await apiClient.post(`/finance/invoices/${selectedInvoice._id}/payment`, paymentFormData);
      setIsPaymentModalOpen(false);

      const receiptNum = res.data?.data?.receiptNumber;
      if (receiptNum) {
        setSelectedReceiptData({
          receiptNumber: receiptNum,
          invoiceNumber: selectedInvoice.invoiceNumber,
          clientName: selectedInvoice.clientName,
          clientCompany: selectedInvoice.client?.company || selectedInvoice.clientCompany,
          clientGstin: selectedInvoice.gstin,
          amount: payAmt,
          paymentDate: paymentFormData.paymentDate,
          paymentMethod: paymentFormData.paymentMethod,
          transactionReference: paymentFormData.transactionReference,
          bankAccountName: bankAccountsList.find((b) => String(b._id) === String(paymentFormData.bankAccountId))?.bankName || 'Company Bank Account',
          invoiceTotal: selectedInvoice.total,
          paidToDate: (Number(selectedInvoice.paidAmount) || 0) + payAmt,
          remainingBalance: Math.max(0, bal - payAmt),
        });
        setIsReceiptModalOpen(true);
      }

      if (onRefresh) onRefresh();
    } catch (err) {
      setPaymentError(err.response?.data?.message || err.message || 'Failed to record payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Issue Invoice Handler
  const handleIssueInvoice = async (inv) => {
    try {
      await apiClient.post(`/finance/invoices/${inv._id}/issue`);
      if (onRefresh) onRefresh();
      if (selectedInvoice?._id === inv._id) {
        const fresh = await apiClient.get(`/finance/invoices/${inv._id}`);
        setInvoiceDetails(fresh.data?.data?.invoice || fresh.data?.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to issue invoice');
    }
  };

  // Approve Invoice
  const handleApproveInvoice = async (inv) => {
    try {
      await apiClient.post(`/finance/invoices/${inv._id}/approve`, { comments: 'Approved by authorized Finance Head' });
      if (onRefresh) onRefresh();
      if (selectedInvoice?._id === inv._id) {
        const fresh = await apiClient.get(`/finance/invoices/${inv._id}`);
        setInvoiceDetails(fresh.data?.data?.invoice || fresh.data?.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Approval failed');
    }
  };

  // Reject Invoice
  const handleRejectInvoice = async (inv) => {
    const reason = prompt('Specify rejection reason or requested revision:');
    if (!reason) return;
    try {
      await apiClient.post(`/finance/invoices/${inv._id}/reject`, { reason });
      if (onRefresh) onRefresh();
      if (selectedInvoice?._id === inv._id) {
        const fresh = await apiClient.get(`/finance/invoices/${inv._id}`);
        setInvoiceDetails(fresh.data?.data?.invoice || fresh.data?.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Rejection failed');
    }
  };

  // Open Credit Note Modal
  const handleOpenCreditNoteModal = (inv) => {
    setSelectedInvoice(inv);
    setCreditNoteData({
      amount: inv.balance || 0,
      taxAdjusted: 0,
      reason: 'Scope Adjustment / Discount',
      notes: '',
    });
    setCreditError('');
    setIsCreditNoteModalOpen(true);
  };

  // Submit Credit Note
  const handleSubmitCreditNote = async (e) => {
    e.preventDefault();
    const creditAmt = Number(creditNoteData.amount);
    const bal = Number(selectedInvoice?.balance) || 0;

    if (!creditAmt || creditAmt <= 0) {
      setCreditError('Credit note amount must be greater than zero.');
      return;
    }
    if (creditAmt > bal + 0.01) {
      setCreditError(`Credit note amount cannot exceed outstanding balance of ${formatCurrency(bal)}.`);
      return;
    }

    setCreditLoading(true);
    setCreditError('');

    try {
      await apiClient.post(`/finance/invoices/${selectedInvoice._id}/credit-note`, creditNoteData);
      setIsCreditNoteModalOpen(false);
      if (onRefresh) onRefresh();
      if (selectedInvoice?._id) {
        const fresh = await apiClient.get(`/finance/invoices/${selectedInvoice._id}`);
        setInvoiceDetails(fresh.data?.data?.invoice || fresh.data?.data);
      }
    } catch (err) {
      setCreditError(err.response?.data?.message || err.message || 'Failed to issue credit note');
    } finally {
      setCreditLoading(false);
    }
  };

  // Open Cancel Modal
  const handleOpenCancelModal = (inv) => {
    setSelectedInvoice(inv);
    setCancelReason('');
    setCancelError('');
    setIsCancelModalOpen(true);
  };

  // Submit Cancel
  const handleSubmitCancel = async (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      setCancelError('Cancellation reason is required.');
      return;
    }

    setCancelLoading(true);
    setCancelError('');

    try {
      await apiClient.post(`/finance/invoices/${selectedInvoice._id}/cancel`, { reason: cancelReason });
      setIsCancelModalOpen(false);
      if (onRefresh) onRefresh();
      if (selectedInvoice?._id) {
        const fresh = await apiClient.get(`/finance/invoices/${selectedInvoice._id}`);
        setInvoiceDetails(fresh.data?.data?.invoice || fresh.data?.data);
      }
    } catch (err) {
      setCancelError(err.response?.data?.message || err.message || 'Failed to cancel invoice');
    } finally {
      setCancelLoading(false);
    }
  };

  // Open Send Modal
  const handleOpenSendModal = (inv) => {
    setSelectedInvoice(inv);
    setSendData({
      recipientEmail: inv.email || inv.client?.email || '',
      customMessage: `Dear ${inv.clientName},\n\nPlease find attached Tax Invoice ${inv.invoiceNumber} for ${formatCurrency(inv.total)} with due date ${formatDate(inv.dueDate)}.\n\nThank you for choosing Aasha SM Technologies.`,
    });
    setIsSendModalOpen(true);
  };

  // Submit Send
  const handleSubmitSend = async (e) => {
    e.preventDefault();
    setSendLoading(true);
    try {
      await apiClient.post(`/finance/invoices/${selectedInvoice._id}/send`, sendData);
      setIsSendModalOpen(false);
      alert(`Invoice ${selectedInvoice.invoiceNumber} successfully dispatched to ${sendData.recipientEmail}`);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to dispatch invoice');
    } finally {
      setSendLoading(false);
    }
  };

  // Open Recovery Modal
  const handleOpenRecoveryModal = (inv) => {
    setSelectedInvoice(inv);
    setRecoveryData({
      status: inv.recovery?.status || 'In Progress',
      note: '',
      nextFollowUp: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      promiseToPayDate: '',
    });
    setIsRecoveryModalOpen(true);
  };

  // Submit Recovery
  const handleSubmitRecovery = async (e) => {
    e.preventDefault();
    if (!recoveryData.note.trim()) {
      alert('Follow-up note is required');
      return;
    }
    setRecoveryLoading(true);
    try {
      await apiClient.post(`/finance/recovery/${selectedInvoice._id}/followup`, {
        note: recoveryData.note,
        status: recoveryData.status,
        nextFollowUpDate: recoveryData.nextFollowUp,
        promiseToPayDate: recoveryData.promiseToPayDate,
      });
      setIsRecoveryModalOpen(false);
      alert('Recovery follow-up logged successfully');
      if (onRefresh) onRefresh();
      if (selectedInvoice?._id) {
        const fresh = await apiClient.get(`/finance/invoices/${selectedInvoice._id}`);
        setInvoiceDetails(fresh.data?.data?.invoice || fresh.data?.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to log recovery follow-up');
    } finally {
      setRecoveryLoading(false);
    }
  };

  // Duplicate Invoice
  const handleDuplicateInvoice = async (inv) => {
    try {
      await apiClient.post(`/finance/invoices/${inv._id}/duplicate`);
      if (onRefresh) onRefresh();
      alert(`Invoice ${inv.invoiceNumber} duplicated as draft successfully`);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to duplicate invoice');
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredInvoices.length === 0) {
      alert('No invoices to export.');
      return;
    }
    const headers = ['Invoice Number', 'Client', 'Company', 'Issue Date', 'Due Date', 'Subtotal', 'Tax', 'Total', 'Paid', 'Balance', 'Status'];
    const rows = filteredInvoices.map((i) => [
      i.invoiceNumber,
      `"${i.clientName || ''}"`,
      `"${i.client?.company || i.clientCompany || ''}"`,
      i.issueDate ? new Date(i.issueDate).toLocaleDateString('en-IN') : '',
      i.dueDate ? new Date(i.dueDate).toLocaleDateString('en-IN') : '',
      i.subtotal || i.amount || 0,
      i.totalTax || 0,
      i.total || 0,
      i.paidAmount || 0,
      i.balance || 0,
      i.status || 'Draft',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AashaSM_Invoices_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Status Badges
  const getStatusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    let bg = '#f1f5f9';
    let text = '#475569';
    let border = '#cbd5e1';

    if (s === 'draft') {
      bg = '#f1f5f9';
      text = '#475569';
      border = '#cbd5e1';
    } else if (s === 'pending approval') {
      bg = '#fef3c7';
      text = '#92400e';
      border = '#fde68a';
    } else if (s === 'approved') {
      bg = '#e0e7ff';
      text = '#3730a3';
      border = '#c7d2fe';
    } else if (s === 'issued') {
      bg = '#e0f2fe';
      text = '#0369a1';
      border = '#bae6fd';
    } else if (s === 'sent') {
      bg = '#dbeafe';
      text = '#1d4ed8';
      border = '#bfdbfe';
    } else if (s === 'partially paid') {
      bg = '#ffedd5';
      text = '#c2410c';
      border = '#fed7aa';
    } else if (s === 'paid') {
      bg = '#dcfce7';
      text = '#15803d';
      border = '#bbf7d0';
    } else if (s === 'overdue') {
      bg = '#fee2e2';
      text = '#b91c1c';
      border = '#fecaca';
    } else if (s === 'cancelled') {
      bg = '#f3f4f6';
      text = '#9ca3af';
      border = '#e5e7eb';
    } else if (s === 'credited') {
      bg = '#f3e8ff';
      text = '#7e22ce';
      border = '#e9d5ff';
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0.2rem 0.55rem',
          borderRadius: '9999px',
          fontSize: '0.72rem',
          fontWeight: 700,
          background: bg,
          color: text,
          border: `1px solid ${border}`,
        }}
      >
        {status || 'Draft'}
      </span>
    );
  };

  const getPaymentBadge = (paid = 0, bal = 0) => {
    const p = Number(paid);
    const b = Number(bal);
    if (b <= 0 && p > 0) {
      return (
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
          ✓ Settled
        </span>
      );
    }
    if (p > 0 && b > 0) {
      return (
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ea580c', background: '#ffedd5', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
          Partially Paid
        </span>
      );
    }
    return (
      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
        Unpaid
      </span>
    );
  };

  return (
    <div className="fin-invoice-master-wrap">
      {/* ──────────────────────────────────────────────────────────
          1. HEADER & PRIMARY ACTIONS
          ────────────────────────────────────────────────────────── */}
      <div className="fin-inv-header-block fin-no-print">
        <div className="fin-inv-title-group">
          <h2 className="fin-inv-page-title">Invoice Management &amp; Receivables ERP</h2>
        </div>
        <div className="fin-inv-header-actions">
          <button type="button" className="fin-btn-orange" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? 'Hide Filters' : '⚡ Advanced Filters'}
          </button>
          <button type="button" className="fin-btn-orange" onClick={handleExportCSV}>
            📥 Export CSV
          </button>
          <button type="button" className="fin-btn-orange" onClick={handleOpenCreateModal}>
            + Create Invoice
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          2. DYNAMIC 8-CARD FINANCIAL KPI DASHBOARD (REAL ATLAS DATA)
          ────────────────────────────────────────────────────────── */}
      <div className="fin-inv-kpi-grid fin-no-print" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
        {/* Card 1: Total Invoiced */}
        <div className="fin-inv-kpi-card">
          <div className="fin-inv-kpi-header">
            <span className="fin-inv-kpi-label">Total Invoiced</span>
            <span className="fin-inv-kpi-icon">📄</span>
          </div>
          <div className="fin-inv-kpi-val">{formatCurrency(metrics.totalInvoiced)}</div>
          <div className="fin-inv-kpi-sub">{metrics.totalInvoicedCount} commercial invoices</div>
        </div>

        {/* Card 2: Draft Invoices */}
        <div className="fin-inv-kpi-card">
          <div className="fin-inv-kpi-header">
            <span className="fin-inv-kpi-label">Draft Invoices</span>
            <span className="fin-inv-kpi-icon">📝</span>
          </div>
          <div className="fin-inv-kpi-val">{formatCurrency(metrics.draftValue)}</div>
          <div className="fin-inv-kpi-sub">{metrics.draftCount} drafts awaiting review</div>
        </div>

        {/* Card 3: Pending Approval */}
        <div className="fin-inv-kpi-card">
          <div className="fin-inv-kpi-header">
            <span className="fin-inv-kpi-label">Pending Approval</span>
            <span className="fin-inv-kpi-icon">⚖️</span>
          </div>
          <div className="fin-inv-kpi-val" style={{ color: '#d97706' }}>{metrics.pendingApprovalCount || 0}</div>
          <div className="fin-inv-kpi-sub">Awaiting management approval</div>
        </div>

        {/* Card 4: Issued / Sent */}
        <div className="fin-inv-kpi-card">
          <div className="fin-inv-kpi-header">
            <span className="fin-inv-kpi-label">Issued / Sent</span>
            <span className="fin-inv-kpi-icon">✉️</span>
          </div>
          <div className="fin-inv-kpi-val" style={{ color: '#2563eb' }}>
            {(metrics.issuedCount || 0) + (metrics.sentCount || 0)}
          </div>
          <div className="fin-inv-kpi-sub">Dispatched &amp; active</div>
        </div>

        {/* Card 5: Outstanding */}
        <div className="fin-inv-kpi-card">
          <div className="fin-inv-kpi-header">
            <span className="fin-inv-kpi-label">Outstanding Due</span>
            <span className="fin-inv-kpi-icon">⏳</span>
          </div>
          <div className="fin-inv-kpi-val warning">{formatCurrency(metrics.outstanding)}</div>
          <div className="fin-inv-kpi-sub">{metrics.outstandingCount} active receivables</div>
        </div>

        {/* Card 6: Overdue */}
        <div className="fin-inv-kpi-card">
          <div className="fin-inv-kpi-header">
            <span className="fin-inv-kpi-label">Overdue Receivables</span>
            <span className="fin-inv-kpi-icon">🚨</span>
          </div>
          <div className="fin-inv-kpi-val danger">{formatCurrency(metrics.overdue)}</div>
          <div className="fin-inv-kpi-sub">{metrics.overdueCount} past due date</div>
        </div>

        {/* Card 7: Partially Paid */}
        <div className="fin-inv-kpi-card">
          <div className="fin-inv-kpi-header">
            <span className="fin-inv-kpi-label">Partially Paid</span>
            <span className="fin-inv-kpi-icon">📊</span>
          </div>
          <div className="fin-inv-kpi-val">{formatCurrency(metrics.partiallyPaidBalance)}</div>
          <div className="fin-inv-kpi-sub">{metrics.partiallyPaidCount} remaining partials</div>
        </div>

        {/* Card 8: Collections Received */}
        <div className="fin-inv-kpi-card">
          <div className="fin-inv-kpi-header">
            <span className="fin-inv-kpi-label">Collections Received</span>
            <span className="fin-inv-kpi-icon">💰</span>
          </div>
          <div className="fin-inv-kpi-val success">{formatCurrency(metrics.paymentsReceived)}</div>
          <div className="fin-inv-kpi-sub">{metrics.paidCount || 0} fully settled</div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          3. SEARCH & FILTER CONTROLS BAR
          ────────────────────────────────────────────────────────── */}
      {/* ──────────────────────────────────────────────────────────
          3. SEARCH & FILTER CONTROLS BAR (SINGLE ROW FLEX TOOLBAR)
          ────────────────────────────────────────────────────────── */}
      <div className="fin-inv-toolbar fin-no-print">
        <div className="fin-inv-search-wrap">
          <span className="fin-inv-search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            className="fin-inv-search-input"
            placeholder="Search invoice #, client name, company, email, project..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="fin-inv-search-clear"
              title="Clear search"
              onClick={() => setSearchTerm('')}
            >
              &times;
            </button>
          )}
        </div>

        {/* Status Filter Chips */}
        <div className="fin-inv-filter-chips">
          <button
            type="button"
            className={`fin-inv-filter-chip ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            <span>All</span>
            <span className="fin-inv-chip-count">{statusCounts.all}</span>
          </button>
          <button
            type="button"
            className={`fin-inv-filter-chip ${statusFilter === 'draft' ? 'active' : ''}`}
            onClick={() => setStatusFilter('draft')}
          >
            <span>Draft</span>
            <span className="fin-inv-chip-count">{statusCounts.draft}</span>
          </button>
          <button
            type="button"
            className={`fin-inv-filter-chip ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            <span>Pending</span>
            <span className="fin-inv-chip-count">{statusCounts.pending}</span>
          </button>
          <button
            type="button"
            className={`fin-inv-filter-chip ${statusFilter === 'approved' ? 'active' : ''}`}
            onClick={() => setStatusFilter('approved')}
          >
            <span>Approved</span>
            <span className="fin-inv-chip-count">{statusCounts.approved}</span>
          </button>
          <button
            type="button"
            className={`fin-inv-filter-chip ${statusFilter === 'issued' ? 'active' : ''}`}
            onClick={() => setStatusFilter('issued')}
          >
            <span>Issued</span>
            <span className="fin-inv-chip-count">{statusCounts.issued}</span>
          </button>
          <button
            type="button"
            className={`fin-inv-filter-chip ${statusFilter === 'sent' ? 'active' : ''}`}
            onClick={() => setStatusFilter('sent')}
          >
            <span>Sent</span>
            <span className="fin-inv-chip-count">{statusCounts.sent}</span>
          </button>
          <button
            type="button"
            className={`fin-inv-filter-chip ${statusFilter === 'partially-paid' ? 'active' : ''}`}
            onClick={() => setStatusFilter('partially-paid')}
          >
            <span>Partial</span>
            <span className="fin-inv-chip-count">{statusCounts.partiallyPaid}</span>
          </button>
          <button
            type="button"
            className={`fin-inv-filter-chip ${statusFilter === 'paid' ? 'active' : ''}`}
            onClick={() => setStatusFilter('paid')}
          >
            <span>Paid</span>
            <span className="fin-inv-chip-count">{statusCounts.paid}</span>
          </button>
          <button
            type="button"
            className={`fin-inv-filter-chip ${statusFilter === 'overdue' ? 'active' : ''}`}
            onClick={() => setStatusFilter('overdue')}
          >
            <span>Overdue</span>
            <span className="fin-inv-chip-count overdue">{statusCounts.overdue}</span>
          </button>
          <button
            type="button"
            className={`fin-inv-filter-chip ${statusFilter === 'cancelled' ? 'active' : ''}`}
            onClick={() => setStatusFilter('cancelled')}
          >
            <span>Cancelled</span>
            <span className="fin-inv-chip-count">{statusCounts.cancelled}</span>
          </button>
          <button
            type="button"
            className={`fin-inv-filter-chip ${statusFilter === 'credited' ? 'active' : ''}`}
            onClick={() => setStatusFilter('credited')}
          >
            <span>Credited</span>
            <span className="fin-inv-chip-count">{statusCounts.credited}</span>
          </button>
        </div>
      </div>

      {/* Advanced Filter Drawer */}
      {showFilters && (
        <div className="fin-form-grid-2 fin-no-print" style={{ background: '#ffffff', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '1rem' }}>
          <div className="fin-form-group">
            <label>Filter by Client</label>
            <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
              <option value="all">All Clients</option>
              {clientOptions.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name || c.clientName} {c.company ? `(${c.company})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="fin-form-group">
            <label>Payment Settlement Status</label>
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
              <option value="all">All Payment States</option>
              <option value="unpaid">Unpaid (Zero Collections)</option>
              <option value="partial">Partially Paid</option>
              <option value="paid">Fully Settled (Paid)</option>
            </select>
          </div>
          <div className="fin-form-group">
            <label>Issue Date From</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="fin-form-group">
            <label>Issue Date To</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              {(clientFilter !== 'all' || paymentFilter !== 'all' || startDate || endDate) && (
                <button
                  type="button"
                  className="fin-btn-orange"
                  style={{ height: '36px', padding: '0 0.85rem' }}
                  onClick={() => {
                    setClientFilter('all');
                    setPaymentFilter('all');
                    setStartDate('');
                    setEndDate('');
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          4. INVOICE REGISTER TABLE
          ────────────────────────────────────────────────────────── */}
      <div className="fin-table-container fin-no-print">
        <div className="fin-table-responsive">
          <table className="fin-data-table fin-invoice-table">
            <thead>
              <tr>
                <th className="fin-inv-col-nowrap">Invoice #</th>
                <th className="fin-inv-col-flex">Client &amp; Company</th>
                <th className="fin-inv-col-flex">Project / Scope</th>
                <th className="fin-inv-col-nowrap">Invoice Date</th>
                <th className="fin-inv-col-nowrap">Due Date</th>
                <th className="text-right fin-inv-col-nowrap">Total Amount</th>
                <th className="text-right fin-inv-col-nowrap">Amount Paid</th>
                <th className="text-right fin-inv-col-nowrap">Balance Due</th>
                <th className="fin-inv-col-nowrap">Payment</th>
                <th className="fin-inv-status-th">Status</th>
                <th className="fin-inv-actions-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#64748b' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📄</div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '1rem' }}>No matching invoices found in MongoDB Atlas</div>
                    <div style={{ fontSize: '0.825rem', marginTop: '0.25rem', color: '#64748b' }}>
                      {searchTerm || statusFilter !== 'all' || clientFilter !== 'all'
                        ? 'Try adjusting your search query or status filter.'
                        : 'Click "+ Create Invoice" to issue a client invoice or convert an accepted quotation.'}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const tot = Number(inv.total) || 0;
                  const paid = Number(inv.paidAmount) || 0;
                  const bal = inv.balance !== undefined ? Number(inv.balance) : Math.max(0, tot - paid);
                  const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date() && bal > 0 && inv.status !== 'Cancelled';

                  return (
                    <tr key={inv._id}>
                      {/* Invoice # */}
                      <td className="fin-inv-col-nowrap">
                        <button
                          type="button"
                          className="fin-btn-link"
                          style={{ fontWeight: 700, color: '#0f172a' }}
                          onClick={() => setSelectedInvoice(inv)}
                        >
                          {inv.invoiceNumber}
                        </button>
                      </td>

                      {/* Client */}
                      <td className="fin-inv-col-flex">
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong style={{ color: '#0f172a' }}>{inv.clientName}</strong>
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {inv.client?.company || inv.mobileNo || inv.email || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Project / Ref */}
                      <td className="fin-inv-col-flex">
                        <div style={{ fontSize: '0.775rem', color: '#475569' }}>
                          {inv.project?.name || (inv.proposal ? `Proposal #${inv.proposal?.proposalNumber || ''}` : 'General IT Consulting')}
                        </div>
                      </td>

                      {/* Issue Date */}
                      <td className="fin-inv-col-nowrap">{formatDate(inv.issueDate)}</td>

                      {/* Due Date */}
                      <td className="fin-inv-col-nowrap">
                        <span>{formatDate(inv.dueDate)}</span>
                        {isOverdue && <span className="fin-inv-overdue-tag">OVERDUE</span>}
                      </td>

                      {/* Total Amount */}
                      <td className="text-right fin-inv-col-nowrap" style={{ fontWeight: 700 }}>
                        {formatCurrency(tot)}
                      </td>

                      {/* Amount Paid */}
                      <td className="text-right fin-inv-col-nowrap" style={{ color: '#16a34a', fontWeight: 600 }}>
                        {paid > 0 ? formatCurrency(paid) : '₹0'}
                      </td>

                      {/* Balance Due */}
                      <td className="text-right fin-inv-col-nowrap" style={{ color: bal > 0 ? '#ea580c' : '#64748b', fontWeight: 700 }}>
                        {formatCurrency(bal)}
                      </td>

                      {/* Payment Status */}
                      <td className="fin-inv-col-nowrap">{getPaymentBadge(paid, bal)}</td>

                      {/* Invoice Status */}
                      <td className="fin-inv-status-cell">{getStatusBadge(inv.status)}</td>

                      {/* Actions */}
                      <td className="fin-inv-actions-cell">
                        <div className="fin-inv-actions-group">
                          <button
                            type="button"
                            className="fin-inv-action-btn"
                            title="View Details"
                            aria-label="View Details"
                            onClick={() => setSelectedInvoice(inv)}
                          >
                            <span className="fin-action-ic" aria-hidden="true">👁️</span>
                            <span>View</span>
                          </button>

                          <button
                            type="button"
                            className="fin-inv-action-btn"
                            title="Preview & Print"
                            aria-label="Preview & Print"
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setIsPreviewModalOpen(true);
                            }}
                          >
                            <span className="fin-action-ic" aria-hidden="true">🖨️</span>
                            <span>Print</span>
                          </button>

                          {bal > 0 && inv.status !== 'Cancelled' && (
                            <button
                              type="button"
                              className="fin-inv-action-btn"
                              title="Record Payment"
                              aria-label="Record Payment"
                              onClick={() => handleOpenPaymentModal(inv)}
                            >
                              <span className="fin-action-ic" aria-hidden="true">💳</span>
                              <span>Payment</span>
                            </button>
                          )}

                          {(inv.status === 'Approved' || inv.status === 'Draft') && (
                            <button
                              type="button"
                              className="fin-inv-action-btn"
                              title="Issue Invoice"
                              aria-label="Issue Invoice"
                              onClick={() => handleIssueInvoice(inv)}
                            >
                              <span className="fin-action-ic" aria-hidden="true">🚀</span>
                              <span>Issue</span>
                            </button>
                          )}

                          {inv.status === 'Draft' && (
                            <button
                              type="button"
                              className="fin-inv-action-btn"
                              title="Edit Draft"
                              aria-label="Edit Draft"
                              onClick={() => handleOpenEditModal(inv)}
                            >
                              <span className="fin-action-ic" aria-hidden="true">✏️</span>
                              <span>Edit</span>
                            </button>
                          )}

                          {inv.status === 'Pending Approval' && (
                            <>
                              <button
                                type="button"
                                className="fin-inv-action-btn"
                                title="Approve Invoice"
                                aria-label="Approve Invoice"
                                onClick={() => handleApproveInvoice(inv)}
                              >
                                <span className="fin-action-ic" aria-hidden="true">✅</span>
                                <span>Approve</span>
                              </button>
                              <button
                                type="button"
                                className="fin-inv-action-btn"
                                title="Return for Revision"
                                aria-label="Return for Revision"
                                onClick={() => handleRejectInvoice(inv)}
                              >
                                <span className="fin-action-ic" aria-hidden="true">↩️</span>
                                <span>Revise</span>
                              </button>
                            </>
                          )}

                          {['Issued', 'Approved', 'Sent'].includes(inv.status) && (
                            <button
                              type="button"
                              className="fin-inv-action-btn"
                              title="Send to Client"
                              aria-label="Send to Client"
                              onClick={() => handleOpenSendModal(inv)}
                            >
                              <span className="fin-action-ic" aria-hidden="true">✉️</span>
                              <span>Send</span>
                            </button>
                          )}

                          {bal > 0 && inv.status !== 'Cancelled' && (
                            <button
                              type="button"
                              className="fin-inv-action-btn"
                              title="Recovery Follow-up"
                              aria-label="Recovery Follow-up"
                              onClick={() => handleOpenRecoveryModal(inv)}
                            >
                              <span className="fin-action-ic" aria-hidden="true">⏳</span>
                              <span>Recovery</span>
                            </button>
                          )}

                          {bal > 0 && inv.status !== 'Cancelled' && inv.status !== 'Draft' && (
                            <button
                              type="button"
                              className="fin-inv-action-btn"
                              title="Issue Credit Note"
                              aria-label="Issue Credit Note"
                              onClick={() => handleOpenCreditNoteModal(inv)}
                            >
                              <span className="fin-action-ic" aria-hidden="true">🏷️</span>
                              <span>Credit</span>
                            </button>
                          )}

                          <button
                            type="button"
                            className="fin-inv-action-btn"
                            title="Duplicate as Draft"
                            aria-label="Duplicate as Draft"
                            onClick={() => handleDuplicateInvoice(inv)}
                          >
                            <span className="fin-action-ic" aria-hidden="true">📋</span>
                            <span>Duplicate</span>
                          </button>

                          {inv.status !== 'Cancelled' && paid === 0 && (
                            <button
                              type="button"
                              className="fin-inv-action-btn"
                              title="Cancel Invoice"
                              aria-label="Cancel Invoice"
                              onClick={() => handleOpenCancelModal(inv)}
                            >
                              <span className="fin-action-ic" aria-hidden="true">❌</span>
                              <span>Cancel</span>
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

      {/* ──────────────────────────────────────────────────────────
          MODAL 1: STRUCTURED WORKSPACE FOR CREATE / EDIT INVOICE
          ────────────────────────────────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box fin-modal-lg" style={{ maxWidth: '960px' }}>
            <div className="fin-modal-header">
              <div>
                <h3 style={{ margin: 0 }}>
                  {isEditMode ? `Edit Invoice — ${formData.invoiceNumber}` : 'Create Commercial Tax Invoice'}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Step {createStep} of 6 • Live calculations &amp; verified Atlas persistence
                </span>
              </div>
              <button type="button" className="fin-modal-close-btn" onClick={() => setIsCreateModalOpen(false)}>
                &times;
              </button>
            </div>

            {/* Step Wizard Header */}
            <div className="fin-account-tabs-nav" style={{ margin: '0 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
              <button
                type="button"
                className={`fin-account-nav-btn ${createStep === 1 ? 'active' : ''}`}
                onClick={() => setCreateStep(1)}
              >
                1. Client &amp; Dates
              </button>
              <button
                type="button"
                className={`fin-account-nav-btn ${createStep === 2 ? 'active' : ''}`}
                onClick={() => setCreateStep(2)}
              >
                2. Project &amp; Quotation
              </button>
              <button
                type="button"
                className={`fin-account-nav-btn ${createStep === 3 ? 'active' : ''}`}
                onClick={() => setCreateStep(3)}
              >
                3. Line Items &amp; Tax
              </button>
              <button
                type="button"
                className={`fin-account-nav-btn ${createStep === 4 ? 'active' : ''}`}
                onClick={() => setCreateStep(4)}
              >
                4. Milestones
              </button>
              <button
                type="button"
                className={`fin-account-nav-btn ${createStep === 5 ? 'active' : ''}`}
                onClick={() => setCreateStep(5)}
              >
                5. Terms &amp; Notes
              </button>
              <button
                type="button"
                className={`fin-account-nav-btn ${createStep === 6 ? 'active' : ''}`}
                onClick={() => setCreateStep(6)}
              >
                6. Review &amp; Issue
              </button>
            </div>

            <div className="fin-modal-body fin-prop-form-body" style={{ maxHeight: '65vh', overflowY: 'auto', padding: '1.25rem' }}>
              {formError && <div className="fin-form-error" style={{ marginBottom: '1rem' }}>{formError}</div>}

              {/* STEP 1: Client & Invoice Information */}
              {createStep === 1 && (
                <div className="fin-prop-form-section">
                  <h4 className="fin-prop-section-title">Client &amp; Billing Identification</h4>
                  <div className="fin-form-grid-2">
                    <div className="fin-form-group">
                      <label>Select Existing Client *</label>
                      <select value={formData.client} onChange={(e) => handleClientSelect(e.target.value)}>
                        <option value="">-- Choose Client from Master --</option>
                        {clientOptions.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name || c.clientName} {c.company ? `(${c.company})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="fin-form-group">
                      <label>Client Contact Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Yash Shah"
                        value={formData.clientName}
                        onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                        required
                      />
                    </div>

                    <div className="fin-form-group">
                      <label>Company / Organization</label>
                      <input
                        type="text"
                        placeholder="e.g. Acme Global Industries"
                        value={formData.clientCompany}
                        onChange={(e) => setFormData({ ...formData, clientCompany: e.target.value })}
                      />
                    </div>

                    <div className="fin-form-group">
                      <label>Client Email (for dispatch)</label>
                      <input
                        type="email"
                        placeholder="accounts@client.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>

                    <div className="fin-form-group">
                      <label>Client Mobile / Phone</label>
                      <input
                        type="text"
                        placeholder="+91 98765 43210"
                        value={formData.mobileNo}
                        onChange={(e) => setFormData({ ...formData, mobileNo: e.target.value })}
                      />
                    </div>

                    <div className="fin-form-group">
                      <label>Client GSTIN</label>
                      <input
                        type="text"
                        placeholder="27AABCA1234F1Z5"
                        value={formData.gstin}
                        onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                      />
                    </div>

                    <div className="fin-form-group col-span-2">
                      <label>Billing Address</label>
                      <input
                        type="text"
                        placeholder="Street, Suite, City, State, PIN"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      />
                    </div>

                    <div className="fin-form-group">
                      <label>Invoice Date *</label>
                      <input
                        type="date"
                        value={formData.issueDate}
                        onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                        required
                      />
                    </div>

                    <div className="fin-form-group">
                      <label>Due Date *</label>
                      <input
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Project / Quotation Reference */}
              {createStep === 2 && (
                <div className="fin-prop-form-section">
                  <h4 className="fin-prop-section-title">Commercial &amp; Project Association</h4>
                  <div className="fin-form-grid-2">
                    <div className="fin-form-group">
                      <label>Link Accepted Quotation / Proposal</label>
                      <select value={formData.proposal} onChange={(e) => handleProposalSelect(e.target.value)}>
                        <option value="">-- Direct Invoice (No Quotation Link) --</option>
                        {proposalsList
                          .filter((p) => p.status === 'Accepted' || p.status === 'Converted to Invoice' || p._id === formData.proposal)
                          .map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.proposalNumber} — {p.clientName} ({formatCurrency(p.total)})
                            </option>
                          ))}
                      </select>
                      <small style={{ color: '#64748b', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                        Selecting an accepted quotation auto-loads all line items, terms, and discounts.
                      </small>
                    </div>

                    <div className="fin-form-group">
                      <label>Client Project Reference</label>
                      <select
                        value={formData.project}
                        onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                      >
                        <option value="">-- Client-Level / General Services --</option>
                        {clientProjects.map((prj) => (
                          <option key={prj._id} value={prj._id}>
                            {prj.name} {prj.code ? `(${prj.code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="fin-form-group">
                      <label>Payment Terms</label>
                      <select
                        value={formData.paymentTerms}
                        onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                      >
                        <option value="Net 15">Net 15 Days</option>
                        <option value="Net 30">Net 30 Days</option>
                        <option value="Net 45">Net 45 Days</option>
                        <option value="Net 60">Net 60 Days</option>
                        <option value="Due on Receipt">Due on Receipt</option>
                        <option value="50% Advance, 50% on Delivery">50% Advance, 50% on Delivery</option>
                      </select>
                    </div>

                    <div className="fin-form-group">
                      <label>Currency</label>
                      <input type="text" value="INR (₹) — Indian Rupee" disabled />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Dynamic Line Items & Pricing */}
              {createStep === 3 && (
                <div className="fin-prop-form-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                    <h4 className="fin-prop-section-title" style={{ margin: 0 }}>Dynamic Line Item Editor</h4>
                    <button type="button" className="fin-btn-secondary fin-btn-sm" onClick={handleAddItem}>
                      + Add Item
                    </button>
                  </div>

                  <div className="fin-table-responsive">
                    <table className="fin-data-table fin-prop-items-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '22%' }}>Service / Product</th>
                          <th style={{ width: '22%' }}>Description</th>
                          <th style={{ width: '8%' }}>Qty</th>
                          <th style={{ width: '10%' }}>Unit</th>
                          <th style={{ width: '12%' }}>Rate (₹)</th>
                          <th style={{ width: '8%' }}>Disc %</th>
                          <th style={{ width: '8%' }}>Tax %</th>
                          <th style={{ width: '12%', textAlign: 'right' }}>Total (₹)</th>
                          <th style={{ width: '10%', textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.items.map((item, idx) => (
                          <tr key={idx}>
                            <td>
                              <input
                                type="text"
                                className="fin-prop-item-input"
                                placeholder="Service title"
                                value={item.name}
                                onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="fin-prop-item-input"
                                placeholder="Scope description"
                                value={item.description}
                                onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="fin-prop-item-input"
                                min="1"
                                value={item.qty}
                                onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                              />
                            </td>
                            <td>
                              <select
                                className="fin-prop-item-input"
                                value={item.unit}
                                onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                              >
                                <option value="Unit">Unit</option>
                                <option value="Hours">Hours</option>
                                <option value="Days">Days</option>
                                <option value="Months">Months</option>
                                <option value="Milestone">Milestone</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                className="fin-prop-item-input"
                                min="0"
                                value={item.rate}
                                onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="fin-prop-item-input"
                                min="0"
                                max="100"
                                value={item.discount}
                                onChange={(e) => handleItemChange(idx, 'discount', e.target.value)}
                              />
                            </td>
                            <td>
                              <select
                                className="fin-prop-item-input"
                                value={item.taxRate}
                                onChange={(e) => handleItemChange(idx, 'taxRate', e.target.value)}
                              >
                                <option value="0">0%</option>
                                <option value="5">5%</option>
                                <option value="12">12%</option>
                                <option value="18">18%</option>
                                <option value="28">28%</option>
                              </select>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                              {formatCurrency(item.amount || 0)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                                <button
                                  type="button"
                                  className="fin-btn-secondary fin-btn-sm"
                                  title="Duplicate Item"
                                  onClick={() => handleDuplicateItem(idx)}
                                >
                                  📋
                                </button>
                                <button
                                  type="button"
                                  className="fin-btn-secondary fin-btn-sm"
                                  title="Move Up"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveItemUp(idx)}
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  className="fin-btn-secondary fin-btn-sm"
                                  title="Move Down"
                                  disabled={idx === formData.items.length - 1}
                                  onClick={() => handleMoveItemDown(idx)}
                                >
                                  ▼
                                </button>
                                {formData.items.length > 1 && (
                                  <button
                                    type="button"
                                    className="fin-item-del-btn"
                                    title="Delete Item"
                                    onClick={() => handleRemoveItem(idx)}
                                  >
                                    &times;
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* GST Treatment & Calculation Box */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ flex: 1, minWidth: '260px' }}>
                      <div className="fin-form-group">
                        <label>GST Treatment</label>
                        <select
                          value={formData.taxType}
                          onChange={(e) => setFormData({ ...formData, taxType: e.target.value })}
                        >
                          <option value="GST">Intra-State GST (CGST 50% + SGST 50%)</option>
                          <option value="IGST">Inter-State GST (IGST 100%)</option>
                        </select>
                      </div>
                    </div>

                    <div className="fin-prop-calc-box">
                      <div className="fin-prop-calc-row">
                        <span>Subtotal:</span>
                        <strong>{formatCurrency(calculatedFormTotals.subtotal)}</strong>
                      </div>
                      <div className="fin-prop-calc-row">
                        <span>Invoice Discount (₹):</span>
                        <input
                          type="number"
                          className="fin-prop-disc-input"
                          min="0"
                          value={formData.discount}
                          onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                        />
                      </div>
                      <div className="fin-prop-calc-row">
                        <span>Taxable Amount:</span>
                        <strong>{formatCurrency(calculatedFormTotals.taxableAmount)}</strong>
                      </div>

                      {formData.taxType === 'IGST' ? (
                        <div className="fin-prop-calc-row">
                          <span>IGST:</span>
                          <span>{formatCurrency(calculatedFormTotals.igst)}</span>
                        </div>
                      ) : (
                        <>
                          <div className="fin-prop-calc-row">
                            <span>CGST:</span>
                            <span>{formatCurrency(calculatedFormTotals.cgst)}</span>
                          </div>
                          <div className="fin-prop-calc-row">
                            <span>SGST:</span>
                            <span>{formatCurrency(calculatedFormTotals.sgst)}</span>
                          </div>
                        </>
                      )}

                      <div className="fin-prop-calc-row grand-total">
                        <span>Grand Total:</span>
                        <strong>{formatCurrency(calculatedFormTotals.grandTotal)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Payment Terms & Milestones */}
              {createStep === 4 && (
                <div className="fin-prop-form-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                    <h4 className="fin-prop-section-title" style={{ margin: 0 }}>Milestone Disbursement Schedule</h4>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button type="button" className="fin-btn-secondary fin-btn-sm" onClick={() => applyMilestonePreset('50/50')}>
                        50% / 50%
                      </button>
                      <button type="button" className="fin-btn-secondary fin-btn-sm" onClick={() => applyMilestonePreset('30/40/30')}>
                        30% / 40% / 30%
                      </button>
                      <button type="button" className="fin-btn-secondary fin-btn-sm" onClick={() => applyMilestonePreset('40/30/20/10')}>
                        40% / 30% / 20% / 10%
                      </button>
                    </div>
                  </div>

                  <div className="fin-table-responsive">
                    <table className="fin-data-table">
                      <thead>
                        <tr>
                          <th>Milestone Description</th>
                          <th style={{ width: '15%' }}>Allocation %</th>
                          <th style={{ width: '25%', textAlign: 'right' }}>Calculated Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.milestones.map((m, idx) => {
                          const calculatedAmt = Math.round(calculatedFormTotals.grandTotal * (Number(m.percentage) / 100));
                          return (
                            <tr key={idx}>
                              <td>
                                <input
                                  type="text"
                                  className="fin-prop-item-input"
                                  value={m.name}
                                  onChange={(e) => {
                                    const updated = [...formData.milestones];
                                    updated[idx].name = e.target.value;
                                    setFormData({ ...formData, milestones: updated });
                                  }}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="fin-prop-item-input"
                                  min="0"
                                  max="100"
                                  value={m.percentage}
                                  onChange={(e) => {
                                    const updated = [...formData.milestones];
                                    updated[idx].percentage = Number(e.target.value);
                                    setFormData({ ...formData, milestones: updated });
                                  }}
                                />
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                {formatCurrency(calculatedAmt)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
                    Total Allocation: <strong>{formData.milestones.reduce((acc, m) => acc + (Number(m.percentage) || 0), 0)}%</strong> of Grand Total ({formatCurrency(calculatedFormTotals.grandTotal)})
                  </div>
                </div>
              )}

              {/* STEP 5: Terms & Confidential Notes */}
              {createStep === 5 && (
                <div className="fin-prop-form-section">
                  <h4 className="fin-prop-section-title">Instructions &amp; Governance Notes</h4>
                  <div className="fin-form-grid-2">
                    <div className="fin-form-group">
                      <label>Remittance / Bank Payment Instructions (Appears on Invoice)</label>
                      <textarea
                        rows="3"
                        value={formData.paymentInstructions}
                        onChange={(e) => setFormData({ ...formData, paymentInstructions: e.target.value })}
                      />
                    </div>

                    <div className="fin-form-group">
                      <label>Client-Facing Terms &amp; Notes (Appears on Invoice)</label>
                      <textarea
                        rows="3"
                        value={formData.clientNotes}
                        onChange={(e) => setFormData({ ...formData, clientNotes: e.target.value })}
                      />
                    </div>

                    <div className="fin-form-group col-span-2">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#b91c1c' }}>
                        <span>🔒 Internal Confidential Finance Notes</span>
                        <span style={{ fontSize: '0.65rem', background: '#fee2e2', color: '#991b1b', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                          STRICTLY CONFIDENTIAL • EXCLUDED FROM CLIENT PDF
                        </span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Client negotiated 5% concession on AMC, approved by CFO..."
                        value={formData.internalNotes}
                        onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 6: Review & Final Submission */}
              {createStep === 6 && (
                <div className="fin-prop-form-section">
                  <h4 className="fin-prop-section-title">Commercial Summary Verification</h4>
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.85rem' }}>
                      <div>
                        <span style={{ color: '#64748b' }}>Client:</span>
                        <div style={{ fontWeight: 700 }}>{formData.clientName}</div>
                        <div style={{ color: '#475569' }}>{formData.clientCompany || '—'}</div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Issue / Due Date:</span>
                        <div style={{ fontWeight: 600 }}>{formData.issueDate} → {formData.dueDate}</div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Tax Treatment:</span>
                        <div style={{ fontWeight: 600 }}>{formData.taxType === 'IGST' ? 'Inter-State IGST' : 'Intra-State CGST + SGST'}</div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Final Grand Total:</span>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                          {formatCurrency(calculatedFormTotals.grandTotal)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '0.5rem' }}>
                    Ready to proceed? Select the required operational state according to your finance authorization:
                  </div>
                </div>
              )}
            </div>

            {/* Modal Sticky Footer with Step Navigation & Final Actions */}
            <div className="fin-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <div>
                {createStep > 1 && (
                  <button type="button" className="fin-btn-secondary" onClick={() => setCreateStep(createStep - 1)}>
                    ← Back
                  </button>
                )}
                {createStep < 6 && (
                  <button type="button" className="fin-action-btn primary" style={{ marginLeft: '0.5rem' }} onClick={() => setCreateStep(createStep + 1)}>
                    Next Step →
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="fin-btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="fin-action-btn"
                  disabled={formLoading}
                  onClick={() => handleSubmitInvoice('Draft')}
                >
                  {formLoading ? 'Saving...' : '💾 Save Draft'}
                </button>
                <button
                  type="button"
                  className="fin-action-btn"
                  disabled={formLoading}
                  onClick={() => handleSubmitInvoice('Pending Approval')}
                >
                  ⚖️ Submit for Approval
                </button>
                <button
                  type="button"
                  className="fin-action-btn primary"
                  disabled={formLoading}
                  onClick={() => handleSubmitInvoice('Issued')}
                >
                  🚀 Issue Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL 2: RECORD PAYMENT MODAL
          ────────────────────────────────────────────────────────── */}
      {isPaymentModalOpen && selectedInvoice && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box" style={{ maxWidth: '540px' }}>
            <div className="fin-modal-header">
              <h3>Record Client Payment — {selectedInvoice.invoiceNumber}</h3>
              <button type="button" className="fin-modal-close-btn" onClick={() => setIsPaymentModalOpen(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitPayment}>
              <div className="fin-modal-body">
                {paymentError && <div className="fin-form-error">{paymentError}</div>}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Invoice Total</span>
                    <div style={{ fontWeight: 700 }}>{formatCurrency(selectedInvoice.total)}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Paid to Date</span>
                    <div style={{ fontWeight: 700, color: '#16a34a' }}>{formatCurrency(selectedInvoice.paidAmount || 0)}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Balance Remaining</span>
                    <div style={{ fontWeight: 800, color: '#ea580c' }}>{formatCurrency(selectedInvoice.balance || 0)}</div>
                  </div>
                </div>

                <div className="fin-form-group">
                  <label>Payment Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedInvoice.balance}
                    value={paymentFormData.amount}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Payment Date *</label>
                    <input
                      type="date"
                      value={paymentFormData.paymentDate}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentDate: e.target.value })}
                      required
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Payment Method *</label>
                    <select
                      value={paymentFormData.paymentMethod}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentMethod: e.target.value })}
                      required
                    >
                      <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                      <option value="UPI">UPI / QR</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>
                </div>

                <div className="fin-form-group">
                  <label>Deposited Bank Account *</label>
                  <select
                    value={paymentFormData.bankAccountId}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, bankAccountId: e.target.value })}
                    required
                  >
                    <option value="">-- Choose Account --</option>
                    {bankAccountsList.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.bankName} - {b.accountName} ({b.accountNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="fin-form-group">
                  <label>UTR / Transaction Reference *</label>
                  <input
                    type="text"
                    placeholder="e.g. UTR-HDFC-9482910"
                    value={paymentFormData.transactionReference}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, transactionReference: e.target.value })}
                    required
                  />
                </div>

                <div className="fin-form-group">
                  <label>Notes / Remarks</label>
                  <textarea
                    rows="2"
                    value={paymentFormData.notes}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={() => setIsPaymentModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="fin-action-btn primary" disabled={paymentLoading}>
                  {paymentLoading ? 'Recording...' : '💳 Confirm Payment & Generate Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL 3: OFFICIAL PAYMENT RECEIPT MODAL (RCPT-YYYY-XXXX)
          ────────────────────────────────────────────────────────── */}
      {isReceiptModalOpen && selectedReceiptData && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box" style={{ maxWidth: '600px' }}>
            <div className="fin-modal-header fin-no-print">
              <h3>Official Payment Receipt</h3>
              <button type="button" className="fin-modal-close-btn" onClick={() => setIsReceiptModalOpen(false)}>
                &times;
              </button>
            </div>

            <div className="fin-modal-body" style={{ background: '#f8fafc', padding: '1.5rem' }}>
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '1.5rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>Aasha SM Technologies</h2>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Enterprise Software &amp; IT Solutions</p>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b' }}>GSTIN: 27AABCA1234F1Z5 • Pune, Maharashtra</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>OFFICIAL PAYMENT RECEIPT</span>
                    <h3 style={{ margin: 0, color: '#0f172a' }}>{selectedReceiptData.receiptNumber}</h3>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Date: {formatDate(selectedReceiptData.paymentDate)}</div>
                  </div>
                </div>

                <div style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                  Received with thanks from:
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{selectedReceiptData.clientName}</div>
                  {selectedReceiptData.clientCompany && <div style={{ color: '#475569' }}>{selectedReceiptData.clientCompany}</div>}
                  {selectedReceiptData.clientGstin && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>GSTIN: {selectedReceiptData.clientGstin}</div>}
                </div>

                <div style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '6px', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                    <span>Against Invoice #:</span>
                    <strong>{selectedReceiptData.invoiceNumber}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                    <span>Payment Mode:</span>
                    <strong>{selectedReceiptData.paymentMethod}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                    <span>Transaction UTR / Ref:</span>
                    <strong>{selectedReceiptData.transactionReference}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                    <span>Deposited Bank:</span>
                    <strong>{selectedReceiptData.bankAccountName}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1', fontSize: '1.1rem' }}>
                    <strong>Amount Received:</strong>
                    <strong style={{ color: '#16a34a' }}>{formatCurrency(selectedReceiptData.amount)}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '1rem' }}>
                  <div>
                    Invoice Total: {formatCurrency(selectedReceiptData.invoiceTotal)}<br />
                    Total Paid to Date: {formatCurrency(selectedReceiptData.paidToDate)}<br />
                    Remaining Balance: <strong>{formatCurrency(selectedReceiptData.remainingBalance)}</strong>
                  </div>
                  <div style={{ textAlign: 'right', marginTop: '1.5rem' }}>
                    <div style={{ borderTop: '1px solid #94a3b8', width: '140px', paddingTop: '0.25rem' }}>
                      Authorized Signatory
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="fin-modal-footer fin-no-print">
              <button type="button" className="fin-btn-secondary" onClick={() => setIsReceiptModalOpen(false)}>
                Close
              </button>
              <button type="button" className="fin-action-btn primary" onClick={() => window.print()}>
                🖨️ Print / Download Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL 4: CREDIT NOTE ISSUANCE
          ────────────────────────────────────────────────────────── */}
      {isCreditNoteModalOpen && selectedInvoice && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box" style={{ maxWidth: '480px' }}>
            <div className="fin-modal-header">
              <h3>Issue Credit Note — {selectedInvoice.invoiceNumber}</h3>
              <button type="button" className="fin-modal-close-btn" onClick={() => setIsCreditNoteModalOpen(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitCreditNote}>
              <div className="fin-modal-body">
                {creditError && <div className="fin-form-error">{creditError}</div>}

                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
                  Outstanding Balance: <strong style={{ color: '#ea580c' }}>{formatCurrency(selectedInvoice.balance || 0)}</strong>
                </div>

                <div className="fin-form-group">
                  <label>Credit Adjustment Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedInvoice.balance}
                    value={creditNoteData.amount}
                    onChange={(e) => setCreditNoteData({ ...creditNoteData, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="fin-form-group">
                  <label>Adjustment Reason *</label>
                  <select
                    value={creditNoteData.reason}
                    onChange={(e) => setCreditNoteData({ ...creditNoteData, reason: e.target.value })}
                    required
                  >
                    <option value="Scope Adjustment / Discount">Scope Adjustment / Commercial Discount</option>
                    <option value="Billing Discrepancy Correction">Billing Discrepancy Correction</option>
                    <option value="SLA Concession">SLA Concession / Quality Adjustment</option>
                    <option value="Other">Other Authorized Adjustment</option>
                  </select>
                </div>

                <div className="fin-form-group">
                  <label>Detailed Notes</label>
                  <textarea
                    rows="3"
                    placeholder="Specify justification..."
                    value={creditNoteData.notes}
                    onChange={(e) => setCreditNoteData({ ...creditNoteData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={() => setIsCreditNoteModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="fin-action-btn primary" disabled={creditLoading}>
                  {creditLoading ? 'Issuing...' : '🏷️ Issue Credit Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL 5: CANCEL INVOICE
          ────────────────────────────────────────────────────────── */}
      {isCancelModalOpen && selectedInvoice && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box" style={{ maxWidth: '440px' }}>
            <div className="fin-modal-header">
              <h3>Cancel Invoice — {selectedInvoice.invoiceNumber}</h3>
              <button type="button" className="fin-modal-close-btn" onClick={() => setIsCancelModalOpen(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitCancel}>
              <div className="fin-modal-body">
                {cancelError && <div className="fin-form-error">{cancelError}</div>}
                <p style={{ fontSize: '0.85rem', color: '#475569' }}>
                  Cancelling will void this invoice and set outstanding receivables to ₹0. This action is permanently audited.
                </p>

                <div className="fin-form-group">
                  <label>Reason for Cancellation *</label>
                  <textarea
                    rows="3"
                    placeholder="Provide audit justification..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={() => setIsCancelModalOpen(false)}>
                  Back
                </button>
                <button type="submit" className="fin-action-btn danger" disabled={cancelLoading}>
                  {cancelLoading ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL 6: SEND TO CLIENT
          ────────────────────────────────────────────────────────── */}
      {isSendModalOpen && selectedInvoice && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box" style={{ maxWidth: '480px' }}>
            <div className="fin-modal-header">
              <h3>Send Invoice to Client</h3>
              <button type="button" className="fin-modal-close-btn" onClick={() => setIsSendModalOpen(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitSend}>
              <div className="fin-modal-body">
                <div className="fin-form-group">
                  <label>Recipient Client Email *</label>
                  <input
                    type="email"
                    value={sendData.recipientEmail}
                    onChange={(e) => setSendData({ ...sendData, recipientEmail: e.target.value })}
                    required
                  />
                </div>

                <div className="fin-form-group">
                  <label>Cover Message</label>
                  <textarea
                    rows="3"
                    value={sendData.customMessage}
                    onChange={(e) => setSendData({ ...sendData, customMessage: e.target.value })}
                  />
                </div>
              </div>

              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={() => setIsSendModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="fin-action-btn primary" disabled={sendLoading}>
                  {sendLoading ? 'Dispatching...' : '✉️ Dispatch Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL 7: PAYMENT RECOVERY FOLLOW-UP MODAL
          ────────────────────────────────────────────────────────── */}
      {isRecoveryModalOpen && selectedInvoice && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box" style={{ maxWidth: '500px' }}>
            <div className="fin-modal-header">
              <h3>Log Recovery Follow-up — {selectedInvoice.invoiceNumber}</h3>
              <button type="button" className="fin-modal-close-btn" onClick={() => setIsRecoveryModalOpen(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitRecovery}>
              <div className="fin-modal-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span>Outstanding: <strong style={{ color: '#ea580c' }}>{formatCurrency(selectedInvoice.balance || 0)}</strong></span>
                  <span>Due: <strong>{formatDate(selectedInvoice.dueDate)}</strong></span>
                </div>

                <div className="fin-form-group">
                  <label>Collection Status</label>
                  <select
                    value={recoveryData.status}
                    onChange={(e) => setRecoveryData({ ...recoveryData, status: e.target.value })}
                  >
                    <option value="In Progress">In Progress</option>
                    <option value="Promised">Promised to Pay</option>
                    <option value="Escalated">Escalated</option>
                    <option value="Recovered">Recovered</option>
                  </select>
                </div>

                <div className="fin-form-group">
                  <label>Follow-up Note *</label>
                  <textarea
                    rows="3"
                    placeholder="e.g. Spoke with client accounts; payment promised by next Tuesday..."
                    value={recoveryData.note}
                    onChange={(e) => setRecoveryData({ ...recoveryData, note: e.target.value })}
                    required
                  />
                </div>

                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Next Follow-up Date</label>
                    <input
                      type="date"
                      value={recoveryData.nextFollowUp}
                      onChange={(e) => setRecoveryData({ ...recoveryData, nextFollowUp: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Promise-to-Pay Date</label>
                    <input
                      type="date"
                      value={recoveryData.promiseToPayDate}
                      onChange={(e) => setRecoveryData({ ...recoveryData, promiseToPayDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={() => setIsRecoveryModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="fin-action-btn primary" disabled={recoveryLoading}>
                  {recoveryLoading ? 'Saving...' : 'Save Follow-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL 8: TAX INVOICE PREVIEW & PRINT SHEET
          ────────────────────────────────────────────────────────── */}
      {isPreviewModalOpen && selectedInvoice && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box fin-modal-lg">
            <div className="fin-modal-header fin-no-print">
              <h3>Tax Invoice Preview — {selectedInvoice.invoiceNumber}</h3>
              <button type="button" className="fin-modal-close-btn" onClick={() => setIsPreviewModalOpen(false)}>
                &times;
              </button>
            </div>

            <div className="fin-modal-body" style={{ background: '#f1f5f9', padding: '1.5rem' }}>
              <div className="fin-inv-preview-sheet">
                {/* Header */}
                <div className="fin-prop-doc-header">
                  <div>
                    <h1 className="fin-prop-brand-name">Aasha SM Technologies</h1>
                    <p className="fin-prop-brand-sub">Enterprise IT Solutions &amp; Software Consulting</p>
                    <p className="fin-prop-brand-meta">
                      Cyber City, Tower B, Level 8, Magarpatta, Pune, MH - 411028<br />
                      GSTIN: 27AABCA1234F1Z5 • Email: finance@aashasmtech.com • Web: www.aashasmtech.com
                    </p>
                  </div>
                  <div className="fin-prop-meta-block">
                    <h2 className="fin-prop-doc-type">TAX INVOICE</h2>
                    <div className="fin-prop-meta-row">
                      <span>Invoice #:</span>
                      <strong>{selectedInvoice.invoiceNumber}</strong>
                    </div>
                    <div className="fin-prop-meta-row">
                      <span>Invoice Date:</span>
                      <strong>{formatDate(selectedInvoice.issueDate)}</strong>
                    </div>
                    <div className="fin-prop-meta-row">
                      <span>Due Date:</span>
                      <strong style={{ color: '#ea580c' }}>{formatDate(selectedInvoice.dueDate)}</strong>
                    </div>
                    {selectedInvoice.paymentTerms && (
                      <div className="fin-prop-meta-row">
                        <span>Payment Terms:</span>
                        <strong>{selectedInvoice.paymentTerms}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Billed To Grid */}
                <div className="fin-prop-client-grid">
                  <div className="fin-prop-client-card">
                    <span className="fin-prop-label">Billed To (Client):</span>
                    <h3 className="fin-prop-client-title">{selectedInvoice.clientName}</h3>
                    {selectedInvoice.client?.company && (
                      <div className="fin-prop-client-line"><strong>Company:</strong> {selectedInvoice.client.company}</div>
                    )}
                    {selectedInvoice.address && (
                      <div className="fin-prop-client-line"><strong>Address:</strong> {selectedInvoice.address}</div>
                    )}
                    {selectedInvoice.email && (
                      <div className="fin-prop-client-line"><strong>Email:</strong> {selectedInvoice.email}</div>
                    )}
                    {selectedInvoice.mobileNo && (
                      <div className="fin-prop-client-line"><strong>Phone:</strong> {selectedInvoice.mobileNo}</div>
                    )}
                    {selectedInvoice.gstin && (
                      <div className="fin-prop-client-line"><strong>Client GSTIN:</strong> {selectedInvoice.gstin}</div>
                    )}
                  </div>

                  <div className="fin-prop-client-card">
                    <span className="fin-prop-label">Project / Service Scope:</span>
                    <h3 className="fin-prop-client-title">
                      {selectedInvoice.project?.name || (selectedInvoice.proposal ? `Proposal #${selectedInvoice.proposal?.proposalNumber || ''}` : 'Professional Technical Services')}
                    </h3>
                    <div className="fin-prop-client-line">
                      <strong>Payment Status:</strong> {selectedInvoice.balance <= 0 ? 'Fully Settled (Paid)' : (selectedInvoice.paidAmount > 0 ? 'Partially Paid' : 'Unpaid')}
                    </div>
                    <div className="fin-prop-client-line">
                      <strong>Invoice Currency:</strong> {selectedInvoice.currency || 'INR (₹)'}
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <table className="fin-data-table fin-prop-preview-table" style={{ width: '100%', marginBottom: '1.5rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '5%' }}>#</th>
                      <th style={{ width: '45%' }}>Item &amp; Description</th>
                      <th style={{ width: '10%', textAlign: 'center' }}>Qty</th>
                      <th style={{ width: '15%', textAlign: 'right' }}>Unit Rate</th>
                      <th style={{ width: '10%', textAlign: 'right' }}>Tax %</th>
                      <th style={{ width: '15%', textAlign: 'right' }}>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedInvoice.items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>
                          <strong>{it.name || it.description || 'Professional Services'}</strong>
                          {it.description && it.name && (
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{it.description}</div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>{it.qty || 1} {it.unit || ''}</td>
                        <td style={{ textAlign: 'right' }}>₹{(it.rate || 0).toLocaleString('en-IN')}</td>
                        <td style={{ textAlign: 'right' }}>{it.taxRate || 18}%</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          ₹{(it.amount || (it.qty * it.rate) || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Summary Strip */}
                <div className="fin-prop-summary-container">
                  <div className="fin-prop-notes-area">
                    {selectedInvoice.paymentInstructions && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <strong>Remittance / Bank Instructions:</strong>
                        <div style={{ whiteSpace: 'pre-line' }}>{selectedInvoice.paymentInstructions}</div>
                      </div>
                    )}
                    {selectedInvoice.clientNotes && (
                      <div>
                        <strong>Client Terms &amp; Notes:</strong>
                        <div style={{ whiteSpace: 'pre-line' }}>{selectedInvoice.clientNotes}</div>
                      </div>
                    )}
                  </div>

                  <div className="fin-prop-totals-strip">
                    <div className="fin-prop-total-line">
                      <span>Subtotal (Taxable):</span>
                      <strong>{formatCurrency(selectedInvoice.subtotal || selectedInvoice.amount || 0)}</strong>
                    </div>

                    {selectedInvoice.discount > 0 && (
                      <div className="fin-prop-total-line" style={{ color: '#16a34a' }}>
                        <span>Discount:</span>
                        <span>-{formatCurrency(selectedInvoice.discount)}</span>
                      </div>
                    )}

                    {selectedInvoice.taxType === 'IGST' ? (
                      <div className="fin-prop-total-line">
                        <span>IGST:</span>
                        <span>{formatCurrency(selectedInvoice.igst || selectedInvoice.totalTax || 0)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="fin-prop-total-line">
                          <span>CGST:</span>
                          <span>{formatCurrency(selectedInvoice.cgst || (selectedInvoice.totalTax ? selectedInvoice.totalTax / 2 : 0))}</span>
                        </div>
                        <div className="fin-prop-total-line">
                          <span>SGST:</span>
                          <span>{formatCurrency(selectedInvoice.sgst || (selectedInvoice.totalTax ? selectedInvoice.totalTax / 2 : 0))}</span>
                        </div>
                      </>
                    )}

                    <div className="fin-prop-total-line grand">
                      <span>Invoice Total:</span>
                      <span>{formatCurrency(selectedInvoice.total || 0)}</span>
                    </div>

                    {selectedInvoice.paidAmount > 0 && (
                      <div className="fin-prop-total-line" style={{ color: '#16a34a' }}>
                        <span>Amount Paid:</span>
                        <span>{formatCurrency(selectedInvoice.paidAmount)}</span>
                      </div>
                    )}

                    <div className="fin-prop-total-line" style={{ color: '#ea580c', fontWeight: 800, fontSize: '1.05rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.4rem' }}>
                      <span>Balance Due:</span>
                      <span>{formatCurrency(selectedInvoice.balance || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Signatures */}
                <div className="fin-prop-sign-row">
                  <div className="fin-sign-box">
                    <div className="fin-sign-line"></div>
                    <p>Accounts Department<br />Aasha SM Technologies</p>
                  </div>
                  <div className="fin-sign-box">
                    <div className="fin-sign-line"></div>
                    <p>Authorized Signatory<br />Executive Financial Controller</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="fin-modal-footer fin-no-print">
              <button type="button" className="fin-btn-secondary" onClick={() => setIsPreviewModalOpen(false)}>
                Close
              </button>
              <button
                type="button"
                className="fin-action-btn"
                onClick={() => {
                  setIsPreviewModalOpen(false);
                  handleOpenSendModal(selectedInvoice);
                }}
              >
                ✉️ Email to Client
              </button>
              <button type="button" className="fin-action-btn primary" onClick={() => window.print()}>
                🖨️ Print / Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          INVOICE DETAILS WORKSPACE (DRAWER / SUB-VIEW)
          ────────────────────────────────────────────────────────── */}
      {selectedInvoice && !isPreviewModalOpen && !isCreateModalOpen && !isPaymentModalOpen && !isCreditNoteModalOpen && !isCancelModalOpen && !isSendModalOpen && !isRecoveryModalOpen && !isReceiptModalOpen && (
        <div className="fin-account-workspace fin-no-print" style={{ marginTop: '1.25rem' }}>
          <div className="fin-account-topbar">
            <div className="fin-account-title-group">
              <button
                type="button"
                className="fin-back-btn"
                onClick={() => setSelectedInvoice(null)}
              >
                ← Back to Invoice Register
              </button>
              <div>
                <div className="fin-account-name-row">
                  <h3 className="fin-account-client-name">
                    {invoiceDetails?.invoiceNumber || selectedInvoice.invoiceNumber}
                  </h3>
                  {getStatusBadge(invoiceDetails?.status || selectedInvoice.status)}
                  {getPaymentBadge(invoiceDetails?.paidAmount || selectedInvoice.paidAmount, invoiceDetails?.balance || selectedInvoice.balance)}
                </div>
                <div className="fin-account-company-sub">
                  Client: <strong>{invoiceDetails?.clientName || selectedInvoice.clientName}</strong> • Due: {formatDate(invoiceDetails?.dueDate || selectedInvoice.dueDate)}
                </div>
              </div>
            </div>

            <div className="fin-account-actions">
              {(Number(invoiceDetails?.balance || selectedInvoice.balance) > 0 && selectedInvoice.status !== 'Cancelled') && (
                <button
                  type="button"
                  className="fin-action-btn primary"
                  onClick={() => handleOpenPaymentModal(invoiceDetails || selectedInvoice)}
                >
                  💳 Record Payment
                </button>
              )}
              {((invoiceDetails?.status || selectedInvoice.status) === 'Approved' || (invoiceDetails?.status || selectedInvoice.status) === 'Draft') && (
                <button
                  type="button"
                  className="fin-action-btn"
                  onClick={() => handleIssueInvoice(invoiceDetails || selectedInvoice)}
                >
                  🚀 Issue Invoice
                </button>
              )}
              <button
                type="button"
                className="fin-btn-secondary"
                onClick={() => setIsPreviewModalOpen(true)}
              >
                🖨️ Print Sheet
              </button>
            </div>
          </div>

          {/* Details Tab Navigation */}
          <div className="fin-account-tabs-nav">
            <button
              type="button"
              className={`fin-account-nav-btn ${detailsTab === 'items' ? 'active' : ''}`}
              onClick={() => setDetailsTab('items')}
            >
              Line Items &amp; Pricing
            </button>
            <button
              type="button"
              className={`fin-account-nav-btn ${detailsTab === 'payments' ? 'active' : ''}`}
              onClick={() => setDetailsTab('payments')}
            >
              Payment History ({(invoiceDetails?.paymentHistory || []).length})
            </button>
            <button
              type="button"
              className={`fin-account-nav-btn ${detailsTab === 'milestones' ? 'active' : ''}`}
              onClick={() => setDetailsTab('milestones')}
            >
              Milestones ({(invoiceDetails?.milestones || []).length})
            </button>
            <button
              type="button"
              className={`fin-account-nav-btn ${detailsTab === 'credits' ? 'active' : ''}`}
              onClick={() => setDetailsTab('credits')}
            >
              Credit Notes ({(invoiceDetails?.creditNotes || []).length})
            </button>
            <button
              type="button"
              className={`fin-account-nav-btn ${detailsTab === 'recovery' ? 'active' : ''}`}
              onClick={() => setDetailsTab('recovery')}
            >
              Recovery Follow-ups
            </button>
            <button
              type="button"
              className={`fin-account-nav-btn ${detailsTab === 'audit' ? 'active' : ''}`}
              onClick={() => setDetailsTab('audit')}
            >
              Audit Trail
            </button>
          </div>

          <div className="fin-account-tab-content">
            {detailsLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>Loading invoice records from MongoDB Atlas...</div>
            ) : (
              <>
                {/* Tab 1: Items */}
                {detailsTab === 'items' && (
                  <div>
                    <table className="fin-data-table">
                      <thead>
                        <tr>
                          <th>Item Name</th>
                          <th>Description</th>
                          <th>Qty</th>
                          <th>Unit Rate</th>
                          <th>Tax Rate</th>
                          <th className="text-right">Total Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(invoiceDetails?.items || []).map((it, idx) => (
                          <tr key={idx}>
                            <td><strong>{it.name || 'Service Item'}</strong></td>
                            <td>{it.description || '—'}</td>
                            <td>{it.qty} {it.unit}</td>
                            <td>₹{(it.rate || 0).toLocaleString('en-IN')}</td>
                            <td>{it.taxRate}%</td>
                            <td className="text-right">₹{(it.amount || 0).toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div style={{ marginTop: '1.25rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: 700, marginBottom: '0.35rem', color: '#b91c1c' }}>
                        🔒 Internal Confidential Finance Notes:
                      </div>
                      <div style={{ color: '#475569', fontSize: '0.85rem' }}>
                        {invoiceDetails?.internalNotes || 'No internal notes recorded for this invoice.'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Payments */}
                {detailsTab === 'payments' && (
                  <div>
                    {(invoiceDetails?.paymentHistory || []).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                        No payments recorded for this invoice yet.
                      </div>
                    ) : (
                      <table className="fin-data-table">
                        <thead>
                          <tr>
                            <th>Payment #</th>
                            <th>Receipt #</th>
                            <th>Date</th>
                            <th>Method</th>
                            <th>UTR / Reference</th>
                            <th>Bank Account</th>
                            <th className="text-right">Amount</th>
                            <th style={{ textAlign: 'center' }}>Receipt Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceDetails.paymentHistory.map((p, idx) => (
                            <tr key={idx}>
                              <td><strong>{p.paymentNumber || `PAY-${idx + 1}`}</strong></td>
                              <td><span style={{ fontWeight: 700, color: '#0369a1' }}>{p.receiptNumber || `RCPT-${idx + 1}`}</span></td>
                              <td>{formatDate(p.paymentDate)}</td>
                              <td>{p.paymentMethod}</td>
                              <td>{p.transactionReference || '—'}</td>
                              <td>{p.bankAccount?.bankName || 'Company Bank Account'}</td>
                              <td className="text-right" style={{ color: '#16a34a', fontWeight: 700 }}>
                                {formatCurrency(p.amount)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="fin-btn-secondary fin-btn-sm"
                                  onClick={() => {
                                    setSelectedReceiptData({
                                      receiptNumber: p.receiptNumber || `RCPT-${idx + 1}`,
                                      invoiceNumber: invoiceDetails.invoiceNumber,
                                      clientName: invoiceDetails.clientName,
                                      clientCompany: invoiceDetails.client?.company || invoiceDetails.clientCompany,
                                      clientGstin: invoiceDetails.gstin,
                                      amount: p.amount,
                                      paymentDate: p.paymentDate,
                                      paymentMethod: p.paymentMethod,
                                      transactionReference: p.transactionReference,
                                      bankAccountName: p.bankAccount?.bankName || 'Company Bank Account',
                                      invoiceTotal: invoiceDetails.total,
                                      paidToDate: invoiceDetails.paidAmount,
                                      remainingBalance: invoiceDetails.balance,
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
                    )}
                  </div>
                )}

                {/* Tab 3: Milestones */}
                {detailsTab === 'milestones' && (
                  <div>
                    {(invoiceDetails?.milestones || []).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                        No milestone disbursement schedule configured for this invoice.
                      </div>
                    ) : (
                      <table className="fin-data-table">
                        <thead>
                          <tr>
                            <th>Milestone Name</th>
                            <th>Allocation %</th>
                            <th className="text-right">Milestone Amount</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceDetails.milestones.map((m, idx) => (
                            <tr key={idx}>
                              <td><strong>{m.name || `Milestone ${idx + 1}`}</strong></td>
                              <td>{m.percentage}%</td>
                              <td className="text-right" style={{ fontWeight: 700 }}>
                                {formatCurrency(m.amount || Math.round((invoiceDetails.total || 0) * (Number(m.percentage) / 100)))}
                              </td>
                              <td>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: m.status === 'Paid' ? '#16a34a' : '#ea580c' }}>
                                  {m.status || 'Pending'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* Tab 4: Credit Notes */}
                {detailsTab === 'credits' && (
                  <div>
                    {(invoiceDetails?.creditNotes || []).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                        No credit notes have been issued against this invoice.
                      </div>
                    ) : (
                      <table className="fin-data-table">
                        <thead>
                          <tr>
                            <th>Credit Note #</th>
                            <th>Date</th>
                            <th>Reason</th>
                            <th>Notes</th>
                            <th>Issued By</th>
                            <th className="text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceDetails.creditNotes.map((cn, idx) => (
                            <tr key={idx}>
                              <td><strong>{cn.creditNoteNumber}</strong></td>
                              <td>{formatDate(cn.date)}</td>
                              <td>{cn.reason}</td>
                              <td>{cn.notes || '—'}</td>
                              <td>{cn.issuedByName || 'Finance Head'}</td>
                              <td className="text-right" style={{ color: '#7e22ce', fontWeight: 700 }}>
                                {formatCurrency(cn.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* Tab 5: Recovery Follow-ups */}
                {detailsTab === 'recovery' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div>
                        Status: <strong>{invoiceDetails?.recovery?.status || 'Not Started'}</strong> •
                        Last Follow-up: {formatDate(invoiceDetails?.recovery?.lastFollowUp)} •
                        Next Follow-up: {formatDate(invoiceDetails?.recovery?.nextFollowUp)}
                      </div>
                      <button
                        type="button"
                        className="fin-btn-secondary fin-btn-sm"
                        onClick={() => handleOpenRecoveryModal(invoiceDetails || selectedInvoice)}
                      >
                        + Add Follow-up
                      </button>
                    </div>

                    {(invoiceDetails?.recovery?.notes || []).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                        No collection follow-up logs recorded.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {invoiceDetails.recovery.notes.map((n, idx) => (
                          <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                              <span>{formatDate(n.date)}</span>
                              <span>By: {n.followUpBy || 'Finance Desk'}</span>
                            </div>
                            <div style={{ marginTop: '0.35rem', color: '#0f172a', fontSize: '0.85rem' }}>{n.note}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 6: Audit Trail */}
                {detailsTab === 'audit' && (
                  <div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {(invoiceDetails?.auditLogs || []).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                          Audit entries recorded in system log.
                        </div>
                      ) : (
                        invoiceDetails.auditLogs.map((a, idx) => (
                          <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                              <strong>{a.action}</strong>
                              <span>{new Date(a.timestamp).toLocaleString('en-IN')}</span>
                            </div>
                            <div style={{ fontSize: '0.825rem', color: '#334155', marginTop: '0.25rem' }}>
                              {a.reason || 'No description provided'} — by <strong>{a.performedByName || 'System'}</strong>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
