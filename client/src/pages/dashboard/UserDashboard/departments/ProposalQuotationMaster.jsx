import React, { useState, useMemo, useEffect } from 'react';
import apiClient from '../../../../services/apiClient';

export default function ProposalQuotationMaster({
  proposals = [],
  setProposals,
  formatCurrency,
  formatDate,
  user,
  refreshTrigger,
  setRefreshTrigger,
  openModal,
}) {
  // Navigation & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // all, draft, pending, sent, accepted, rejected, expired, cancelled, converted
  const [openDropdownId, setOpenDropdownId] = useState(null);

  // Client Master records for selector
  const [clientOptions, setClientOptions] = useState([]);
  const [projectsList, setProjectsList] = useState([]);

  // Active Proposal for Detailed View or Modals
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [proposalDetails, setProposalDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsTab, setDetailsTab] = useState('items'); // items, terms, response, approval, revisions, invoice, audit

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isReviseMode, setIsReviseMode] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);

  // Form States
  const defaultItem = {
    name: '',
    description: '',
    qty: 1,
    unit: 'Unit',
    rate: 0,
    discount: 0,
    taxRate: 18,
    taxAmount: 0,
    amount: 0,
  };

  const [formData, setFormData] = useState({
    title: 'Commercial Quotation & Proposal',
    client: '',
    clientName: '',
    clientCompany: '',
    clientEmail: '',
    clientPhone: '',
    clientAddress: '',
    clientGstin: '',
    project: '',
    projectName: '',
    items: [{ ...defaultItem }],
    taxType: 'INTRA_STATE', // INTRA_STATE (CGST+SGST) or INTER_STATE (IGST)
    tax: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    discount: 0,
    proposalDate: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    commercialTerms: {
      paymentTerms: '50% Advance, 50% on Final Delivery & Acceptance',
      paymentMilestones: 'Milestone 1 (50% Advance on Kickoff), Milestone 2 (50% on Final Delivery)',
      deliveryTimeline: '4 to 6 weeks from initial milestone confirmation',
      scopeOfWork: '',
      deliverables: '',
      exclusions: 'Third-party cloud hosting licenses, payment gateway transaction charges, external API subscriptions.',
      assumptions: 'All client branding assets and required API access will be provided by client prior to development kickoff.',
      clientNotes: 'Thank you for giving us the opportunity to quote. Please contact our finance desk for any clarifications.',
      internalNotes: '',
    },
    notes: '',
    status: 'Draft',
    revisionReason: '',
  });

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Response Form
  const [responseData, setResponseData] = useState({
    status: 'Accepted',
    responseDate: new Date().toISOString().slice(0, 10),
    contactPerson: '',
    reason: '',
    notes: '',
    nextFollowUpDate: '',
  });
  const [responseLoading, setResponseLoading] = useState(false);

  // Send Form
  const [sendData, setSendData] = useState({
    recipientEmail: '',
    customMessage: '',
  });
  const [sendLoading, setSendLoading] = useState(false);

  // Approve Form
  const [approveData, setApproveData] = useState({
    decision: 'Approved',
    comments: '',
  });
  const [approveLoading, setApproveLoading] = useState(false);

  // Fetch client master options
  useEffect(() => {
    let isMounted = true;
    apiClient
      .get('/finance/clients')
      .then((res) => {
        if (!isMounted) return;
        const data = res.data?.data;
        if (data && Array.isArray(data.clients)) {
          setClientOptions(data.clients);
        } else if (Array.isArray(data)) {
          setClientOptions(data);
        }
      })
      .catch((err) => console.error('Failed to load client options:', err));

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  // Fetch projects when client changes or on modal open
  useEffect(() => {
    let isMounted = true;
    const url = formData.client ? `/finance/projects?client=${formData.client}` : '/finance/projects';
    apiClient
      .get(url)
      .then((res) => {
        if (!isMounted) return;
        const list = res.data?.data;
        if (Array.isArray(list)) {
          setProjectsList(list);
        }
      })
      .catch((err) => console.error('Failed to load projects:', err));

    return () => {
      isMounted = false;
    };
  }, [formData.client, isCreateModalOpen]);

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

  // Summary Metrics calculated dynamically from real database records
  const summary = useMemo(() => {
    let totalValue = 0;
    let awaiting = 0;
    let acceptedCount = 0;
    let convertedCount = 0;
    let convertedValue = 0;
    let expiringCount = 0;
    const now = new Date();
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    proposals.forEach((p) => {
      const val = Number(p.total) || 0;
      totalValue += val;
      if (p.status === 'Sent' || p.status === 'Pending Approval') {
        awaiting += 1;
      }
      if (p.status === 'Accepted') {
        acceptedCount += 1;
      }
      if (p.status === 'Converted to Invoice') {
        convertedCount += 1;
        convertedValue += val;
      }
      if (p.validUntil && (p.status === 'Sent' || p.status === 'Pending Approval' || p.status === 'Draft')) {
        const vDate = new Date(p.validUntil);
        if (vDate >= now && vDate <= sevenDaysFromNow) {
          expiringCount += 1;
        }
      }
    });

    return {
      totalProposals: proposals.length,
      awaitingResponse: awaiting,
      accepted: acceptedCount,
      converted: convertedCount,
      convertedValue: Math.round(convertedValue * 100) / 100,
      expiringSoon: expiringCount,
      totalQuotedValue: Math.round(totalValue * 100) / 100,
    };
  }, [proposals]);

  // Filtered proposals
  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      // Category / Status Filter
      if (filter === 'draft' && p.status !== 'Draft') return false;
      if (filter === 'pending' && p.status !== 'Pending Approval') return false;
      if (filter === 'sent' && p.status !== 'Sent') return false;
      if (filter === 'accepted' && p.status !== 'Accepted') return false;
      if (filter === 'rejected' && !(p.status === 'Rejected' || p.status === 'Declined')) return false;
      if (filter === 'expired' && p.status !== 'Expired') return false;
      if (filter === 'cancelled' && p.status !== 'Cancelled') return false;
      if (filter === 'converted' && p.status !== 'Converted to Invoice') return false;
      if (filter === 'expiring') {
        if (!p.validUntil) return false;
        const vDate = new Date(p.validUntil);
        const now = new Date();
        const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        return vDate >= now && vDate <= sevenDays && p.status !== 'Converted to Invoice' && p.status !== 'Expired';
      }

      // Search Query
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        (p.proposalNumber && p.proposalNumber.toLowerCase().includes(q)) ||
        (p.clientName && p.clientName.toLowerCase().includes(q)) ||
        (p.clientCompany && p.clientCompany.toLowerCase().includes(q)) ||
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.projectName && p.projectName.toLowerCase().includes(q)) ||
        (p.status && p.status.toLowerCase().includes(q))
      );
    });
  }, [proposals, filter, searchTerm]);

  // Calculate totals for Form
  const calculatedFormTotals = useMemo(() => {
    let sub = 0;
    let taxAmt = 0;

    (formData.items || []).forEach((it) => {
      const q = Number(it.qty) || 1;
      const r = Number(it.rate) || 0;
      const d = Number(it.discount) || 0;
      const lineBase = Math.max(0, q * r - d);
      sub += lineBase;

      const tRate = Number(it.taxRate) || 0;
      taxAmt += (lineBase * tRate) / 100;
    });

    const disc = Number(formData.discount) || 0;
    const finalSub = Math.round(sub * 100) / 100;
    const taxableAmt = Math.max(0, Math.round((finalSub - disc) * 100) / 100);
    const finalTax = Math.round(taxAmt * 100) / 100;
    const grand = Math.max(0, Math.round((taxableAmt + finalTax) * 100) / 100);

    const isInterState = formData.taxType === 'INTER_STATE';

    return {
      subtotal: finalSub,
      discount: disc,
      taxableAmount: taxableAmt,
      tax: finalTax,
      taxType: isInterState ? 'INTER_STATE' : 'INTRA_STATE',
      cgst: isInterState ? 0 : Math.round((finalTax / 2) * 100) / 100,
      sgst: isInterState ? 0 : Math.round((finalTax / 2) * 100) / 100,
      igst: isInterState ? finalTax : 0,
      total: grand,
    };
  }, [formData.items, formData.discount, formData.taxType]);

  // Open Create Proposal Modal
  const handleOpenCreateModal = () => {
    setFormData({
      title: 'Commercial Quotation & Proposal',
      client: '',
      clientName: '',
      clientCompany: '',
      clientEmail: '',
      clientPhone: '',
      clientAddress: '',
      clientGstin: '',
      project: '',
      projectName: '',
      items: [{ ...defaultItem }],
      taxType: 'INTRA_STATE',
      tax: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      discount: 0,
      proposalDate: new Date().toISOString().slice(0, 10),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      commercialTerms: {
        paymentTerms: '50% Advance, 50% on Final Delivery & Acceptance',
        paymentMilestones: 'Milestone 1 (50% Advance on Kickoff), Milestone 2 (50% on Final Delivery)',
        deliveryTimeline: '4 to 6 weeks from initial milestone confirmation',
        scopeOfWork: '',
        deliverables: '',
        exclusions: 'Third-party cloud hosting licenses, payment gateway transaction charges, external API subscriptions.',
        assumptions: 'All client branding assets and required API access will be provided by client prior to development kickoff.',
        clientNotes: 'Thank you for giving us the opportunity to quote. Please contact our finance desk for any clarifications.',
        internalNotes: '',
      },
      notes: '',
      status: 'Draft',
      revisionReason: '',
    });
    setIsEditMode(false);
    setIsReviseMode(false);
    setFormError('');
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (prop) => {
    const isInterState = prop.taxType === 'INTER_STATE' || (prop.igst > 0 && !prop.cgst && !prop.sgst);
    setFormData({
      _id: prop._id,
      proposalNumber: prop.proposalNumber,
      title: prop.title || 'Commercial Quotation',
      client: prop.client?._id || prop.client || '',
      clientName: prop.clientName || '',
      clientCompany: prop.clientCompany || prop.client?.company || '',
      clientEmail: prop.clientEmail || prop.client?.email || '',
      clientPhone: prop.clientPhone || prop.client?.phone || '',
      clientAddress: prop.clientAddress || prop.client?.billingAddress || prop.client?.address || '',
      clientGstin: prop.clientGstin || prop.client?.gstin || '',
      project: prop.project?._id || prop.project || '',
      projectName: prop.projectName || prop.project?.name || '',
      items: (prop.items && prop.items.length > 0 ? prop.items : [{ ...defaultItem }]).map((it) => ({
        name: it.name || '',
        description: it.description || '',
        qty: it.qty || 1,
        unit: it.unit || 'Unit',
        rate: it.rate || 0,
        discount: it.discount || 0,
        taxRate: it.taxRate !== undefined ? it.taxRate : 18,
        taxAmount: it.taxAmount || 0,
        amount: it.amount || 0,
      })),
      taxType: isInterState ? 'INTER_STATE' : 'INTRA_STATE',
      tax: prop.tax || 0,
      cgst: prop.cgst || 0,
      sgst: prop.sgst || 0,
      igst: prop.igst || 0,
      discount: prop.discount || 0,
      proposalDate: prop.proposalDate ? new Date(prop.proposalDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      validUntil: prop.validUntil ? new Date(prop.validUntil).toISOString().slice(0, 10) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      commercialTerms: {
        paymentTerms: prop.commercialTerms?.paymentTerms || '30 Days Net',
        paymentMilestones: prop.commercialTerms?.paymentMilestones || '',
        deliveryTimeline: prop.commercialTerms?.deliveryTimeline || '',
        scopeOfWork: prop.commercialTerms?.scopeOfWork || '',
        deliverables: prop.commercialTerms?.deliverables || '',
        exclusions: prop.commercialTerms?.exclusions || '',
        assumptions: prop.commercialTerms?.assumptions || '',
        clientNotes: prop.commercialTerms?.clientNotes || '',
        internalNotes: prop.commercialTerms?.internalNotes || '',
      },
      notes: prop.notes || '',
      status: prop.status || 'Draft',
      revisionReason: '',
    });
    setIsEditMode(true);
    setIsReviseMode(false);
    setFormError('');
    setIsCreateModalOpen(true);
    setOpenDropdownId(null);
  };

  // Open Revise Modal (creates new revision of sent quotation)
  const handleOpenReviseModal = (prop) => {
    handleOpenEditModal(prop);
    setIsEditMode(false);
    setIsReviseMode(true);
    setFormData((prev) => ({
      ...prev,
      revisionReason: '',
      title: `${prop.title || 'Quotation'} (Rev v${(prop.version || 1) + 1})`,
    }));
  };

  // Handle Client Selection in Form
  const handleClientSelect = (clientId) => {
    if (!clientId) {
      setFormData((prev) => ({
        ...prev,
        client: '',
        clientName: '',
        clientCompany: '',
        clientEmail: '',
        clientPhone: '',
        clientAddress: '',
        clientGstin: '',
        project: '',
        projectName: '',
      }));
      return;
    }

    const selected = clientOptions.find((c) => c._id === clientId);
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        client: selected._id,
        clientName: selected.name || '',
        clientCompany: selected.company || '',
        clientEmail: selected.email || '',
        clientPhone: selected.phone || '',
        clientAddress: selected.billingAddress || selected.address || '',
        clientGstin: selected.gstin || '',
        project: '',
        projectName: '',
        commercialTerms: {
          ...prev.commercialTerms,
          paymentTerms: selected.paymentTerms ? `${selected.paymentTerms} Days Net` : prev.commercialTerms.paymentTerms,
        },
      }));
    }
  };

  // Handle Project Selection
  const handleProjectSelect = (projectId) => {
    if (!projectId) {
      setFormData((prev) => ({
        ...prev,
        project: '',
        projectName: '',
      }));
      return;
    }

    const selectedProj = projectsList.find((p) => p._id === projectId);
    if (selectedProj) {
      setFormData((prev) => ({
        ...prev,
        project: selectedProj._id,
        projectName: selectedProj.name || '',
      }));
    }
  };

  // Milestone Presets Helper
  const applyMilestonePreset = (presetType) => {
    const total = calculatedFormTotals.total || 0;
    let milestonesText = '';
    let termsText = '';

    if (presetType === '50_50') {
      const adv = Math.round(total * 0.5);
      const fin = total - adv;
      termsText = '50% Advance on confirmation, 50% on Final Delivery & Acceptance';
      milestonesText = `Advance (50%): ${formatCurrency(adv)} | Final Handover (50%): ${formatCurrency(fin)}`;
    } else if (presetType === '30_40_30') {
      const m1 = Math.round(total * 0.3);
      const m2 = Math.round(total * 0.4);
      const m3 = total - m1 - m2;
      termsText = '30% Kickoff Advance, 40% Development Milestone, 30% Final Delivery';
      milestonesText = `Kickoff (30%): ${formatCurrency(m1)} | Mid-stage (40%): ${formatCurrency(m2)} | Handover (30%): ${formatCurrency(m3)}`;
    } else if (presetType === '40_30_20_10') {
      const m1 = Math.round(total * 0.4);
      const m2 = Math.round(total * 0.3);
      const m3 = Math.round(total * 0.2);
      const m4 = total - m1 - m2 - m3;
      termsText = '40% Advance, 30% Core Build, 20% Testing/UAT, 10% Handover';
      milestonesText = `Kickoff (40%): ${formatCurrency(m1)} | Alpha (30%): ${formatCurrency(m2)} | Beta (20%): ${formatCurrency(m3)} | Final (10%): ${formatCurrency(m4)}`;
    }

    setFormData((prev) => ({
      ...prev,
      commercialTerms: {
        ...prev.commercialTerms,
        paymentTerms: termsText,
        paymentMilestones: milestonesText,
      },
    }));
  };

  // Line Items Manipulation
  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { ...defaultItem }],
    }));
  };

  const handleDuplicateItem = (index) => {
    const itemToClone = formData.items[index];
    if (!itemToClone) return;
    const updated = [...formData.items];
    updated.splice(index + 1, 0, { ...itemToClone });
    setFormData((prev) => ({ ...prev, items: updated }));
  };

  const handleMoveItem = (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= formData.items.length) return;
    const updated = [...formData.items];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setFormData((prev) => ({ ...prev, items: updated }));
  };

  const handleRemoveItem = (index) => {
    if (formData.items.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...formData.items];
    updated[index] = { ...updated[index], [field]: value };

    // Update line amount
    const q = Number(field === 'qty' ? value : updated[index].qty) || 1;
    const r = Number(field === 'rate' ? value : updated[index].rate) || 0;
    const d = Number(field === 'discount' ? value : updated[index].discount) || 0;
    const lineBase = Math.max(0, q * r - d);
    updated[index].amount = Math.round(lineBase * 100) / 100;

    const tRate = Number(field === 'taxRate' ? value : updated[index].taxRate) || 0;
    updated[index].taxAmount = Math.round(((lineBase * tRate) / 100) * 100) / 100;

    setFormData((prev) => ({ ...prev, items: updated }));
  };

  // Save Proposal (Draft / Submit / Revise)
  const handleSubmitProposal = async (targetStatus = 'Draft') => {
    if (!formData.clientName) {
      setFormError('Please select or specify a client name.');
      return;
    }
    if (!formData.items || formData.items.length === 0 || !formData.items[0].description) {
      setFormError('Please provide at least one item description.');
      return;
    }

    setFormLoading(true);
    setFormError('');

    try {
      const payload = {
        ...formData,
        status: targetStatus,
        subtotal: calculatedFormTotals.subtotal,
        taxableAmount: calculatedFormTotals.taxableAmount,
        taxType: calculatedFormTotals.taxType,
        tax: calculatedFormTotals.tax,
        cgst: calculatedFormTotals.cgst,
        sgst: calculatedFormTotals.sgst,
        igst: calculatedFormTotals.igst,
        discount: calculatedFormTotals.discount,
        total: calculatedFormTotals.total,
      };

      if (isReviseMode) {
        // Revision endpoint
        const res = await apiClient.post(`/finance/proposals/${formData._id}/revise`, {
          title: payload.title,
          items: payload.items,
          commercialTerms: payload.commercialTerms,
          validUntil: payload.validUntil,
          reason: formData.revisionReason || 'Quotation terms updated',
          status: targetStatus,
          tax: payload.tax,
          discount: payload.discount,
          taxType: payload.taxType,
          cgst: payload.cgst,
          sgst: payload.sgst,
          igst: payload.igst,
        });
        const updated = res.data?.data;
        setProposals((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
      } else if (isEditMode) {
        // Update existing draft
        const res = await apiClient.put(`/finance/proposals/${formData._id}`, payload);
        const updated = res.data?.data;
        setProposals((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
      } else {
        // Create new
        const res = await apiClient.post('/finance/proposals', payload);
        const created = res.data?.data;
        setProposals((prev) => [created, ...prev]);
      }

      setIsCreateModalOpen(false);
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Failed to save proposal');
    } finally {
      setFormLoading(false);
    }
  };

  // Open Details Drawer / Modal
  const handleOpenDetails = async (prop, initialTab = 'items') => {
    setSelectedProposal(prop);
    setDetailsTab(initialTab);
    setDetailsLoading(true);
    setOpenDropdownId(null);

    try {
      const res = await apiClient.get(`/finance/proposals/${prop._id}`);
      setProposalDetails(res.data?.data?.proposal || prop);
    } catch (err) {
      console.error('Failed to load proposal details:', err);
      setProposalDetails(prop);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Open Preview Modal
  const handleOpenPreview = (prop) => {
    setSelectedProposal(prop);
    setProposalDetails(prop);
    setIsPreviewModalOpen(true);
    setOpenDropdownId(null);
  };

  // Open Response Modal
  const handleOpenResponseModal = (prop) => {
    setSelectedProposal(prop);
    setResponseData({
      status: 'Accepted',
      responseDate: new Date().toISOString().slice(0, 10),
      contactPerson: prop.clientName || '',
      reason: '',
      notes: '',
      nextFollowUpDate: '',
    });
    setIsResponseModalOpen(true);
    setOpenDropdownId(null);
  };

  const handleSaveResponse = async (e) => {
    e.preventDefault();
    if (!selectedProposal) return;
    setResponseLoading(true);
    try {
      const res = await apiClient.post(`/finance/proposals/${selectedProposal._id}/client-response`, responseData);
      const updated = res.data?.data;
      setProposals((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
      if (proposalDetails?._id === updated._id) {
        setProposalDetails(updated);
      }
      setIsResponseModalOpen(false);
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record response');
    } finally {
      setResponseLoading(false);
    }
  };

  // Open Send Modal
  const handleOpenSendModal = (prop) => {
    setSelectedProposal(prop);
    setSendData({
      recipientEmail: prop.clientEmail || prop.client?.email || '',
      customMessage: '',
    });
    setIsSendModalOpen(true);
    setOpenDropdownId(null);
  };

  const handleSendProposal = async (e) => {
    e.preventDefault();
    if (!selectedProposal) return;
    setSendLoading(true);
    try {
      const res = await apiClient.post(`/finance/proposals/${selectedProposal._id}/send`, sendData);
      const updated = res.data?.data?.proposal || res.data?.data;
      setProposals((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
      if (proposalDetails?._id === updated._id) {
        setProposalDetails(updated);
      }
      setIsSendModalOpen(false);
      setRefreshTrigger((p) => p + 1);
      alert(`Proposal successfully marked as sent${res.data?.data?.emailSent ? ' and email dispatched' : ''}!`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send proposal');
    } finally {
      setSendLoading(false);
    }
  };

  // Approve Proposal
  const handleOpenApproveModal = (prop) => {
    setSelectedProposal(prop);
    setApproveData({
      decision: 'Approved',
      comments: '',
    });
    setIsApproveModalOpen(true);
    setOpenDropdownId(null);
  };

  const handleApproveProposal = async (e) => {
    e.preventDefault();
    if (!selectedProposal) return;
    setApproveLoading(true);
    try {
      const res = await apiClient.post(`/finance/proposals/${selectedProposal._id}/approve`, approveData);
      const updated = res.data?.data;
      setProposals((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
      if (proposalDetails?._id === updated._id) {
        setProposalDetails(updated);
      }
      setIsApproveModalOpen(false);
      setRefreshTrigger((p) => p + 1);
      alert(`Proposal ${approveData.decision.toLowerCase()} successfully!`);
    } catch (err) {
      alert(err.response?.data?.message || 'Approval action failed');
    } finally {
      setApproveLoading(false);
    }
  };

  // Duplicate Proposal
  const handleDuplicate = async (prop) => {
    setOpenDropdownId(null);
    try {
      const res = await apiClient.post(`/finance/proposals/${prop._id}/duplicate`);
      const cloned = res.data?.data;
      setProposals((prev) => [cloned, ...prev]);
      setRefreshTrigger((p) => p + 1);
      alert(`New quotation draft ${cloned.proposalNumber} created!`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to duplicate quotation');
    }
  };

  // Convert to Invoice
  const handleConvertToInvoice = async (prop) => {
    setOpenDropdownId(null);
    if (!window.confirm(`Convert Quotation ${prop.proposalNumber} into an official Tax Invoice?`)) return;

    try {
      const res = await apiClient.post(`/finance/proposals/${prop._id}/convert-to-invoice`);
      const { proposal: updatedProp, invoice } = res.data?.data || {};
      setProposals((prev) => prev.map((p) => (p._id === updatedProp._id ? updatedProp : p)));
      if (proposalDetails?._id === updatedProp._id) {
        setProposalDetails(updatedProp);
      }
      setRefreshTrigger((p) => p + 1);
      alert(`Quotation successfully converted to Invoice ${invoice?.invoiceNumber || ''}!`);
    } catch (err) {
      alert(err.response?.data?.message || 'Invoice conversion failed');
    }
  };

  // Cancel Proposal
  const handleCancelProposal = async (prop) => {
    setOpenDropdownId(null);
    const reason = window.prompt('Please enter the reason for cancelling this quotation:');
    if (reason === null) return; // User clicked Cancel in prompt

    try {
      const res = await apiClient.post(`/finance/proposals/${prop._id}/cancel`, { reason });
      const updated = res.data?.data;
      setProposals((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
      if (proposalDetails?._id === updated._id) {
        setProposalDetails(updated);
      }
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel proposal');
    }
  };

  // Helper for status badge styling
  const getStatusBadgeClass = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'draft') return 'fin-prop-badge draft';
    if (s === 'pending approval') return 'fin-prop-badge pending';
    if (s === 'sent') return 'fin-prop-badge sent';
    if (s === 'accepted') return 'fin-prop-badge accepted';
    if (s === 'rejected' || s === 'declined') return 'fin-prop-badge rejected';
    if (s === 'expired') return 'fin-prop-badge expired';
    if (s === 'cancelled') return 'fin-prop-badge cancelled';
    if (s === 'converted to invoice') return 'fin-prop-badge converted';
    return 'fin-prop-badge';
  };

  return (
    <div className="fin-proposal-master-root">
      {/* ──────────────────────────────────────────────────────────
          1. HEADER & ACTION BAR
          ────────────────────────────────────────────────────────── */}
      <div className="fin-cm-header">
        <div>
          <h2 className="fin-cm-title">Proposals / Quotations</h2>
          <p className="fin-cm-subtitle">
            Create, manage, approve, and track client proposals and quotations.
          </p>
        </div>
        <button
          type="button"
          className="fin-action-btn primary"
          onClick={handleOpenCreateModal}
        >
          <span className="fin-action-plus">+</span> New Proposal / Quotation
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────
          2. SUMMARY CARDS (Real Database Records)
          ────────────────────────────────────────────────────────── */}
      <div className="fin-cm-summary-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="fin-cm-summary-card">
          <div className="fin-cm-card-top">
            <span className="fin-cm-card-label">Total Proposals</span>
            <span className="fin-cm-icon-pill blue">📜</span>
          </div>
          <div className="fin-cm-card-val">{summary.totalProposals}</div>
          <div className="fin-cm-card-sub">All registered quotations</div>
        </div>

        <div className="fin-cm-summary-card">
          <div className="fin-cm-card-top">
            <span className="fin-cm-card-label">Awaiting Response</span>
            <span className="fin-cm-icon-pill orange">⏳</span>
          </div>
          <div className="fin-cm-card-val text-orange">{summary.awaitingResponse}</div>
          <div className="fin-cm-card-sub">Sent &amp; under client review</div>
        </div>

        <div className="fin-cm-summary-card">
          <div className="fin-cm-card-top">
            <span className="fin-cm-card-label">Accepted</span>
            <span className="fin-cm-icon-pill green">✅</span>
          </div>
          <div className="fin-cm-card-val text-success">{summary.accepted}</div>
          <div className="fin-cm-card-sub">Client approved</div>
        </div>

        <div className="fin-cm-summary-card">
          <div className="fin-cm-card-top">
            <span className="fin-cm-card-label">Expiring Soon</span>
            <span className="fin-cm-icon-pill orange">⚠️</span>
          </div>
          <div className="fin-cm-card-val" style={{ color: summary.expiringSoon > 0 ? '#d97706' : '#64748b' }}>
            {summary.expiringSoon}
          </div>
          <div className="fin-cm-card-sub">Expiring within 7 days</div>
        </div>

        <div className="fin-cm-summary-card">
          <div className="fin-cm-card-top">
            <span className="fin-cm-card-label">Converted to Invoice</span>
            <span className="fin-cm-icon-pill green">📄</span>
          </div>
          <div className="fin-cm-card-val text-success">{summary.converted}</div>
          <div className="fin-cm-card-sub">{formatCurrency(summary.convertedValue)}</div>
        </div>

        <div className="fin-cm-summary-card">
          <div className="fin-cm-card-top">
            <span className="fin-cm-card-label">Total Quoted Value</span>
            <span className="fin-cm-icon-pill blue">💼</span>
          </div>
          <div className="fin-cm-card-val">{formatCurrency(summary.totalQuotedValue)}</div>
          <div className="fin-cm-card-sub">Gross pipeline quotation value</div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          3. CONTROLS BAR: SEARCH & FILTER PILLS
          ────────────────────────────────────────────────────────── */}
      <div className="fin-cm-controls-bar">
        <div className="fin-cm-search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="fin-search-icon">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by proposal #, client, title, project, status..."
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
            { key: 'all', label: 'All', count: proposals.length },
            { key: 'draft', label: 'Draft', count: proposals.filter((p) => p.status === 'Draft').length },
            { key: 'pending', label: 'Pending Approval', count: proposals.filter((p) => p.status === 'Pending Approval').length },
            { key: 'sent', label: 'Sent / Awaiting', count: proposals.filter((p) => p.status === 'Sent').length },
            { key: 'accepted', label: 'Accepted', count: proposals.filter((p) => p.status === 'Accepted').length },
            { key: 'expiring', label: '⚠️ Expiring Soon', count: summary.expiringSoon },
            { key: 'rejected', label: 'Rejected', count: proposals.filter((p) => p.status === 'Rejected' || p.status === 'Declined').length },
            { key: 'expired', label: 'Expired', count: proposals.filter((p) => p.status === 'Expired').length },
            { key: 'converted', label: 'Converted', count: proposals.filter((p) => p.status === 'Converted to Invoice').length },
            { key: 'cancelled', label: 'Cancelled', count: proposals.filter((p) => p.status === 'Cancelled').length },
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

      {/* ──────────────────────────────────────────────────────────
          4. PROPOSAL REGISTER TABLE
          ────────────────────────────────────────────────────────── */}
      <div className="fin-table-container">
        <div className="fin-table-responsive">
          <table className="fin-data-table fin-cm-table">
            <thead>
              <tr>
                <th>Proposal #</th>
                <th>Client</th>
                <th>Proposal Title / Items</th>
                <th className="text-right">Subtotal</th>
                <th className="text-right">Discount</th>
                <th className="text-right">Tax</th>
                <th className="text-right">Grand Total</th>
                <th>Date</th>
                <th>Valid Until</th>
                <th>Status</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProposals.length === 0 ? (
                <tr>
                  <td colSpan="11" className="fin-empty-td">
                    <div className="fin-empty-box">
                      <span>📜</span>
                      <p>No proposals or quotations match the selected filters.</p>
                      {searchTerm && (
                        <button
                          type="button"
                          className="fin-btn-secondary fin-btn-sm"
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
                filteredProposals.map((p) => {
                  const now = new Date();
                  const isExpired = p.status === 'Expired' || (p.validUntil && now > new Date(p.validUntil) && p.status === 'Sent');
                  const daysUntilExpiry = p.validUntil ? Math.ceil((new Date(p.validUntil) - now) / (1000 * 60 * 60 * 24)) : null;
                  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 7 && !isExpired && p.status !== 'Converted to Invoice' && p.status !== 'Accepted';
                  const canConvert = p.status === 'Accepted' && !p.convertedInvoice;

                  return (
                    <tr key={p._id} className={isExpired && p.status !== 'Converted to Invoice' ? 'row-overdue-highlight' : ''}>
                      <td>
                        <div className="fin-prop-num-cell">
                          <strong
                            className="fin-client-clickable-title"
                            onClick={() => handleOpenDetails(p, 'items')}
                            title="View Proposal Details"
                          >
                            {p.proposalNumber}
                          </strong>
                          {p.version && p.version > 1 && (
                            <span className="fin-version-tag">v{p.version}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="fin-cm-client-name-col">
                          <span className="fin-client-avatar">
                            {p.clientName ? p.clientName.charAt(0).toUpperCase() : 'C'}
                          </span>
                          <div>
                            <strong>{p.clientName}</strong>
                            {(p.clientCompany || p.client?.company) && (
                              <div className="fin-sub-text">{p.clientCompany || p.client?.company}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="fin-prop-title-cell">
                          <span className="fin-prop-title-text">{p.title || 'Commercial Quotation'}</span>
                          <small className="fin-sub-text">
                            {p.projectName ? `📁 ${p.projectName} • ` : ''}
                            {p.items?.length || 0} line item{p.items?.length === 1 ? '' : 's'}
                          </small>
                        </div>
                      </td>
                      <td className="text-right font-medium">{formatCurrency(p.subtotal)}</td>
                      <td className="text-right text-muted font-medium">
                        {p.discount ? formatCurrency(p.discount) : '—'}
                      </td>
                      <td className="text-right font-medium">
                        {formatCurrency(p.tax)}
                        {p.taxType === 'INTER_STATE' && <small style={{ color: '#0284c7', display: 'block', fontSize: '10px' }}>IGST</small>}
                      </td>
                      <td className="text-right font-bold text-dark">
                        {formatCurrency(p.total)}
                      </td>
                      <td>{formatDate(p.proposalDate || p.createdAt)}</td>
                      <td>
                        <div className="fin-valid-until-cell">
                          <span>{formatDate(p.validUntil)}</span>
                          {isExpired && p.status !== 'Converted to Invoice' && p.status !== 'Accepted' && (
                            <small className="text-danger font-semibold">Expired</small>
                          )}
                          {isExpiringSoon && (
                            <small style={{ color: '#d97706', fontWeight: 600 }}>⚠️ Expiring in {daysUntilExpiry}d</small>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={getStatusBadgeClass(p.status)}>
                          {p.status}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="fin-cm-row-actions">
                          <button
                            type="button"
                            className="fin-cm-view-btn"
                            onClick={() => handleOpenPreview(p)}
                            title="Preview &amp; Print Quotation Document"
                          >
                            Preview
                          </button>

                          <div className="fin-action-dropdown-wrap">
                            <button
                              type="button"
                              className="fin-cm-dots-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(openDropdownId === p._id ? null : p._id);
                              }}
                              aria-label="More Actions"
                            >
                              ⋮
                            </button>

                            {openDropdownId === p._id && (
                              <div className="fin-cm-dropdown-menu">
                                <button
                                  type="button"
                                  onClick={() => handleOpenDetails(p, 'items')}
                                >
                                  👁️ View Full Details
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenPreview(p)}
                                >
                                  🖨️ Print Quotation
                                </button>

                                {(p.status === 'Draft' || p.status === 'Pending Approval') && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditModal(p)}
                                  >
                                    ✏️ Edit Draft
                                  </button>
                                )}

                                {p.status === 'Pending Approval' && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenApproveModal(p)}
                                  >
                                    🛡️ Review Approval
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleOpenSendModal(p)}
                                >
                                  ✉️ Send to Client
                                </button>

                                {p.status !== 'Converted to Invoice' && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenResponseModal(p)}
                                  >
                                    🤝 Record Client Response
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleOpenReviseModal(p)}
                                >
                                  🔄 Revise Quotation
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDuplicate(p)}
                                >
                                  📋 Duplicate Draft
                                </button>

                                {canConvert && (
                                  <button
                                    type="button"
                                    className="text-success font-semibold"
                                    onClick={() => handleConvertToInvoice(p)}
                                  >
                                    📄 Convert to Invoice
                                  </button>
                                )}

                                {p.status === 'Converted to Invoice' && (
                                  <div style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', color: '#16a34a', fontWeight: 'bold' }}>
                                    ✓ Converted {p.convertedInvoice?.invoiceNumber ? `(${p.convertedInvoice.invoiceNumber})` : ''}
                                  </div>
                                )}

                                <div className="fin-dropdown-divider" />

                                {p.status !== 'Converted to Invoice' && p.status !== 'Cancelled' && (
                                  <button
                                    type="button"
                                    className="text-danger"
                                    onClick={() => handleCancelProposal(p)}
                                  >
                                    🚫 Cancel Proposal
                                  </button>
                                )}
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
          <span>Showing {filteredProposals.length} of {proposals.length} proposals</span>
          <span className="text-muted">MongoDB Atlas synchronized</span>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          MODAL 1: CREATE / EDIT / REVISE PROPOSAL
          ────────────────────────────────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box fin-modal-lg">
            <div className="fin-modal-header">
              <h3>
                {isReviseMode
                  ? `Revise Proposal — ${formData.proposalNumber} (New v${(selectedProposal?.version || 1) + 1})`
                  : isEditMode
                  ? `Edit Proposal — ${formData.proposalNumber}`
                  : 'New Proposal / Quotation'}
              </h3>
              <button
                type="button"
                className="fin-modal-close-btn"
                onClick={() => setIsCreateModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <div className="fin-modal-body fin-prop-form-body">
              {formError && <div className="fin-form-error">{formError}</div>}

              {isReviseMode && (
                <div className="fin-prop-revise-banner">
                  <strong>Revision Notice:</strong> Saving this will snapshot version v{selectedProposal?.version || 1} and increment this quotation to v{(selectedProposal?.version || 1) + 1}.
                  <div className="fin-form-group" style={{ marginTop: '0.5rem' }}>
                    <label>Revision Reason *</label>
                    <input
                      type="text"
                      placeholder="e.g. Scope adjusted per client call, discounted milestone pricing..."
                      value={formData.revisionReason}
                      onChange={(e) => setFormData({ ...formData, revisionReason: e.target.value })}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Section A: Client & Proposal Information */}
              <div className="fin-prop-form-section">
                <h4 className="fin-prop-section-title">1. Client &amp; Proposal Details</h4>
                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Select Client (Client Financial Master)</label>
                    <select
                      value={formData.client}
                      onChange={(e) => handleClientSelect(e.target.value)}
                    >
                      <option value="">-- Choose Existing Client --</option>
                      {clientOptions.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name} {c.company ? `(${c.company})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Linked Project (Optional)</label>
                    <select
                      value={formData.project}
                      onChange={(e) => handleProjectSelect(e.target.value)}
                    >
                      <option value="">-- No Project (Client-Level Quotation) --</option>
                      {projectsList.map((prj) => (
                        <option key={prj._id} value={prj._id}>
                          {prj.name} ({prj.status || 'Active'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Client Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.clientName}
                      onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                      placeholder="Client contact or business name"
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Company / Organization</label>
                    <input
                      type="text"
                      value={formData.clientCompany}
                      onChange={(e) => setFormData({ ...formData, clientCompany: e.target.value })}
                      placeholder="Company name"
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Client Email Address</label>
                    <input
                      type="email"
                      value={formData.clientEmail}
                      onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                      placeholder="accounts@client.com"
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Client Phone / Mobile</label>
                    <input
                      type="text"
                      value={formData.clientPhone}
                      onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                      placeholder="+91 98765 43210"
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Client GSTIN (If registered)</label>
                    <input
                      type="text"
                      value={formData.clientGstin}
                      onChange={(e) => setFormData({ ...formData, clientGstin: e.target.value.toUpperCase() })}
                      placeholder="e.g. 27AAAAA0000A1Z5"
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Proposal Date</label>
                    <input
                      type="date"
                      value={formData.proposalDate}
                      onChange={(e) => setFormData({ ...formData, proposalDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Billing Address</label>
                    <input
                      type="text"
                      value={formData.clientAddress}
                      onChange={(e) => setFormData({ ...formData, clientAddress: e.target.value })}
                      placeholder="Registered billing address..."
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Proposal Title *</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g. Full-Stack CRM Application &amp; Cloud Deployment"
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Valid Until Date</label>
                    <input
                      type="date"
                      value={formData.validUntil}
                      onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Section B: Line Items & Pricing */}
              <div className="fin-prop-form-section">
                <div className="fin-section-toolbar">
                  <h4 className="fin-prop-section-title" style={{ margin: 0 }}>2. Line Items &amp; Pricing</h4>
                  <button
                    type="button"
                    className="fin-action-btn fin-btn-sm"
                    onClick={handleAddItem}
                  >
                    <span className="fin-action-plus">+</span> Add Item
                  </button>
                </div>

                <div className="fin-table-responsive" style={{ maxHeight: '340px', overflowY: 'auto' }}>
                  <table className="fin-data-table fin-prop-items-table">
                    <thead>
                      <tr>
                        <th style={{ width: '18%' }}>Item / Service</th>
                        <th style={{ width: '22%' }}>Description</th>
                        <th style={{ width: '8%' }}>Qty</th>
                        <th style={{ width: '8%' }}>Unit</th>
                        <th style={{ width: '11%' }} className="text-right">Rate (₹)</th>
                        <th style={{ width: '9%' }} className="text-right">Disc (₹)</th>
                        <th style={{ width: '8%' }} className="text-right">Tax %</th>
                        <th style={{ width: '10%' }} className="text-right">Amount (₹)</th>
                        <th style={{ width: '6%' }} className="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <input
                              type="text"
                              className="fin-prop-item-input"
                              placeholder="e.g. Frontend Dev"
                              value={item.name}
                              onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              required
                              className="fin-prop-item-input"
                              placeholder="Service scope..."
                              value={item.description}
                              onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              className="fin-prop-item-input text-center"
                              value={item.qty}
                              onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="fin-prop-item-input text-center"
                              value={item.unit}
                              onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className="fin-prop-item-input text-right"
                              value={item.rate}
                              onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className="fin-prop-item-input text-right"
                              placeholder="0"
                              value={item.discount || ''}
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
                          <td className="text-right font-semibold">
                            {formatCurrency(item.amount)}
                          </td>
                          <td className="text-center">
                            <div style={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
                              <button
                                type="button"
                                className="fin-btn-icon"
                                onClick={() => handleDuplicateItem(idx)}
                                title="Duplicate item"
                                style={{ padding: '2px 4px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#f8fafc', cursor: 'pointer' }}
                              >
                                📋
                              </button>
                              {idx > 0 && (
                                <button
                                  type="button"
                                  className="fin-btn-icon"
                                  onClick={() => handleMoveItem(idx, 'up')}
                                  title="Move up"
                                  style={{ padding: '2px 4px', fontSize: '10px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#f8fafc', cursor: 'pointer' }}
                                >
                                  ▲
                                </button>
                              )}
                              {idx < formData.items.length - 1 && (
                                <button
                                  type="button"
                                  className="fin-btn-icon"
                                  onClick={() => handleMoveItem(idx, 'down')}
                                  title="Move down"
                                  style={{ padding: '2px 4px', fontSize: '10px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#f8fafc', cursor: 'pointer' }}
                                >
                                  ▼
                                </button>
                              )}
                              {formData.items.length > 1 && (
                                <button
                                  type="button"
                                  className="fin-item-del-btn"
                                  onClick={() => handleRemoveItem(idx)}
                                  title="Remove line item"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Tax Treatment & Financial Summary Box */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                  <div style={{ padding: '0.85rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.5rem' }}>
                      GST Tax Treatment
                    </label>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="taxType"
                          value="INTRA_STATE"
                          checked={formData.taxType === 'INTRA_STATE'}
                          onChange={() => setFormData({ ...formData, taxType: 'INTRA_STATE' })}
                        />
                        <span>Intra-State (CGST 50% + SGST 50%)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="taxType"
                          value="INTER_STATE"
                          checked={formData.taxType === 'INTER_STATE'}
                          onChange={() => setFormData({ ...formData, taxType: 'INTER_STATE' })}
                        />
                        <span>Inter-State (IGST 100%)</span>
                      </label>
                    </div>
                    <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.35rem', display: 'block' }}>
                      {formData.taxType === 'INTER_STATE'
                        ? 'Applicable for supply outside state boundary (100% IGST).'
                        : 'Applicable for local supply within Maharashtra (Split equally into CGST & SGST).'}
                    </small>
                  </div>

                  {/* Calculation Summary Box */}
                  <div className="fin-prop-calc-box">
                    <div className="fin-prop-calc-row">
                      <span>Subtotal:</span>
                      <strong>{formatCurrency(calculatedFormTotals.subtotal)}</strong>
                    </div>
                    <div className="fin-prop-calc-row">
                      <span>Overall Discount (₹):</span>
                      <input
                        type="number"
                        min="0"
                        className="fin-prop-disc-input"
                        value={formData.discount}
                        onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                      />
                    </div>
                    <div className="fin-prop-calc-row">
                      <span>Taxable Amount:</span>
                      <strong>{formatCurrency(calculatedFormTotals.taxableAmount)}</strong>
                    </div>
                    {formData.taxType === 'INTER_STATE' ? (
                      <div className="fin-prop-calc-row">
                        <span>IGST (100%):</span>
                        <span>{formatCurrency(calculatedFormTotals.igst)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="fin-prop-calc-row">
                          <span>CGST (50%):</span>
                          <span>{formatCurrency(calculatedFormTotals.cgst)}</span>
                        </div>
                        <div className="fin-prop-calc-row">
                          <span>SGST (50%):</span>
                          <span>{formatCurrency(calculatedFormTotals.sgst)}</span>
                        </div>
                      </>
                    )}
                    <div className="fin-prop-calc-row">
                      <span>Total Tax:</span>
                      <strong>{formatCurrency(calculatedFormTotals.tax)}</strong>
                    </div>
                    <div className="fin-prop-calc-row grand-total">
                      <span>Grand Total:</span>
                      <strong>{formatCurrency(calculatedFormTotals.total)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section C: Commercial Terms, Milestones & Scope */}
              <div className="fin-prop-form-section">
                <h4 className="fin-prop-section-title">3. Payment Terms, Milestones &amp; Scope</h4>

                {/* Milestone Calculator Card */}
                <div style={{ padding: '0.75rem 1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#166534' }}>
                      💡 Payment Milestones Quick-Calculator (Grand Total: {formatCurrency(calculatedFormTotals.total)})
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => applyMilestonePreset('50_50')}
                        style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', border: '1px solid #86efac', background: '#ffffff', color: '#166534', cursor: 'pointer' }}
                      >
                        50% / 50% Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMilestonePreset('30_40_30')}
                        style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', border: '1px solid #86efac', background: '#ffffff', color: '#166534', cursor: 'pointer' }}
                      >
                        30% / 40% / 30%
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMilestonePreset('40_30_20_10')}
                        style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', border: '1px solid #86efac', background: '#ffffff', color: '#166534', cursor: 'pointer' }}
                      >
                        4-Stage Milestone
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#15803d' }}>
                    Current Milestone Allocation: <strong>{formData.commercialTerms.paymentMilestones || 'None generated'}</strong>
                  </div>
                </div>

                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Payment Terms Summary</label>
                    <input
                      type="text"
                      value={formData.commercialTerms.paymentTerms}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          commercialTerms: { ...formData.commercialTerms, paymentTerms: e.target.value },
                        })
                      }
                      placeholder="e.g. 50% Advance on signing, 50% on Final Delivery"
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Delivery Timeline</label>
                    <input
                      type="text"
                      value={formData.commercialTerms.deliveryTimeline}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          commercialTerms: { ...formData.commercialTerms, deliveryTimeline: e.target.value },
                        })
                      }
                      placeholder="e.g. 4 to 6 weeks from kickoff"
                    />
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Detailed Payment Milestones Breakdown</label>
                    <textarea
                      rows="2"
                      value={formData.commercialTerms.paymentMilestones}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          commercialTerms: { ...formData.commercialTerms, paymentMilestones: e.target.value },
                        })
                      }
                      placeholder="Milestone 1 (50% on kickoff: ₹...), Milestone 2 (50% on handover: ₹...)"
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Scope of Work Summary</label>
                    <textarea
                      rows="2"
                      value={formData.commercialTerms.scopeOfWork}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          commercialTerms: { ...formData.commercialTerms, scopeOfWork: e.target.value },
                        })
                      }
                      placeholder="High-level project scope..."
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Deliverables</label>
                    <textarea
                      rows="2"
                      value={formData.commercialTerms.deliverables}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          commercialTerms: { ...formData.commercialTerms, deliverables: e.target.value },
                        })
                      }
                      placeholder="Source code, deployed staging environment, documentation..."
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Exclusions</label>
                    <textarea
                      rows="2"
                      value={formData.commercialTerms.exclusions}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          commercialTerms: { ...formData.commercialTerms, exclusions: e.target.value },
                        })
                      }
                      placeholder="Out-of-scope items..."
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Assumptions</label>
                    <textarea
                      rows="2"
                      value={formData.commercialTerms.assumptions}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          commercialTerms: { ...formData.commercialTerms, assumptions: e.target.value },
                        })
                      }
                      placeholder="Project assumptions & dependencies..."
                    />
                  </div>

                  <div className="fin-form-group">
                    <label style={{ color: '#0369a1' }}>📄 Client-Facing Notes (Printed on Quotation PDF)</label>
                    <textarea
                      rows="2"
                      value={formData.commercialTerms.clientNotes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          commercialTerms: { ...formData.commercialTerms, clientNotes: e.target.value },
                        })
                      }
                      placeholder="Commercial terms and conditions for client..."
                    />
                  </div>

                  <div className="fin-form-group" style={{ background: '#fffbeb', padding: '0.5rem', borderRadius: '6px', border: '1px solid #fef3c7' }}>
                    <label style={{ color: '#b45309', fontWeight: 'bold' }}>🔒 Internal Finance Notes (STRICTLY CONFIDENTIAL)</label>
                    <textarea
                      rows="2"
                      value={formData.commercialTerms.internalNotes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          commercialTerms: { ...formData.commercialTerms, internalNotes: e.target.value },
                        })
                      }
                      placeholder="Confidential margin notes, payment risk assessment (NEVER appears in client document)..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="fin-modal-footer">
              <button
                type="button"
                className="fin-btn-secondary"
                onClick={() => setIsCreateModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="fin-action-btn"
                disabled={formLoading}
                onClick={() => handleSubmitProposal('Draft')}
              >
                {formLoading ? 'Saving...' : 'Save as Draft'}
              </button>
              <button
                type="button"
                className="fin-action-btn"
                disabled={formLoading}
                onClick={() => handleSubmitProposal('Pending Approval')}
              >
                Submit for Approval
              </button>
              <button
                type="button"
                className="fin-action-btn primary"
                disabled={formLoading}
                onClick={() => handleSubmitProposal('Sent')}
              >
                {formLoading ? 'Submitting...' : 'Save & Mark as Sent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL 2: PRINT / PREVIEW QUOTATION DOCUMENT
          ────────────────────────────────────────────────────────── */}
      {isPreviewModalOpen && selectedProposal && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box fin-modal-lg">
            <div className="fin-modal-header fin-no-print">
              <h3>Preview Quotation Document — {selectedProposal.proposalNumber}</h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  className="fin-action-btn primary"
                  onClick={() => window.print()}
                >
                  🖨️ Print / Save PDF
                </button>
                <button
                  type="button"
                  className="fin-modal-close-btn"
                  onClick={() => setIsPreviewModalOpen(false)}
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="fin-modal-body fin-prop-preview-sheet">
              {/* Branded Letterhead */}
              <div className="fin-prop-doc-header">
                <div className="fin-prop-brand-block">
                  <h1 className="fin-prop-brand-name">Aasha SM Technologies</h1>
                  <p className="fin-prop-brand-sub">Software Development &amp; Cloud Infrastructure Solutions</p>
                  <p className="fin-prop-brand-meta">
                    Reg. Office: Navi Mumbai, Maharashtra, India<br />
                    Email: accounts@aashasmtech.com | Contact: +91 98765 43210
                  </p>
                </div>
                <div className="fin-prop-meta-block">
                  <h2 className="fin-prop-doc-type">COMMERCIAL QUOTATION</h2>
                  <div className="fin-prop-meta-row">
                    <span>Quotation #:</span>
                    <strong>{selectedProposal.proposalNumber}</strong>
                  </div>
                  {selectedProposal.version && (
                    <div className="fin-prop-meta-row">
                      <span>Version:</span>
                      <strong>v{selectedProposal.version}</strong>
                    </div>
                  )}
                  <div className="fin-prop-meta-row">
                    <span>Date:</span>
                    <span>{formatDate(selectedProposal.proposalDate || selectedProposal.createdAt)}</span>
                  </div>
                  <div className="fin-prop-meta-row">
                    <span>Valid Until:</span>
                    <strong className="text-danger">{formatDate(selectedProposal.validUntil)}</strong>
                  </div>
                  <div className="fin-prop-meta-row">
                    <span>Status:</span>
                    <span className={getStatusBadgeClass(selectedProposal.status)}>{selectedProposal.status}</span>
                  </div>
                </div>
              </div>

              {/* Client Bill To & Contact */}
              <div className="fin-prop-client-grid">
                <div className="fin-prop-client-card">
                  <span className="fin-prop-label">QUOTATION PREPARED FOR:</span>
                  <h3 className="fin-prop-client-title">{selectedProposal.clientName}</h3>
                  {selectedProposal.clientCompany && (
                    <p className="fin-prop-client-line"><strong>Company:</strong> {selectedProposal.clientCompany}</p>
                  )}
                  {selectedProposal.clientGstin && (
                    <p className="fin-prop-client-line"><strong>GSTIN:</strong> {selectedProposal.clientGstin}</p>
                  )}
                  {selectedProposal.clientAddress && (
                    <p className="fin-prop-client-line"><strong>Address:</strong> {selectedProposal.clientAddress}</p>
                  )}
                  {selectedProposal.clientEmail && (
                    <p className="fin-prop-client-line"><strong>Email:</strong> {selectedProposal.clientEmail}</p>
                  )}
                  {selectedProposal.clientPhone && (
                    <p className="fin-prop-client-line"><strong>Phone:</strong> {selectedProposal.clientPhone}</p>
                  )}
                </div>

                <div className="fin-prop-client-card">
                  <span className="fin-prop-label">PROJECT / REQUIREMENT:</span>
                  <h4 style={{ margin: '0.25rem 0', color: '#0f172a' }}>{selectedProposal.title || 'Service Engagement'}</h4>
                  {selectedProposal.projectName && (
                    <p className="fin-prop-client-line"><strong>Linked Project:</strong> {selectedProposal.projectName}</p>
                  )}
                  <p className="fin-prop-client-line">
                    <strong>Payment Terms:</strong> {selectedProposal.commercialTerms?.paymentTerms || '30 Days Net'}
                  </p>
                  <p className="fin-prop-client-line">
                    <strong>Delivery Timeline:</strong> {selectedProposal.commercialTerms?.deliveryTimeline || 'Standard delivery cycle'}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <table className="fin-data-table fin-prop-preview-table" style={{ margin: '1.5rem 0' }}>
                <thead>
                  <tr>
                    <th style={{ width: '5%' }}>#</th>
                    <th style={{ width: '22%' }}>Item / Service</th>
                    <th style={{ width: '28%' }}>Description</th>
                    <th style={{ width: '10%' }} className="text-center">Qty</th>
                    <th style={{ width: '11%' }} className="text-right">Rate</th>
                    <th style={{ width: '10%' }} className="text-right">Disc (₹)</th>
                    <th style={{ width: '14%' }} className="text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedProposal.items || []).map((it, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td><strong>{it.name || `Item ${i + 1}`}</strong></td>
                      <td>{it.description}</td>
                      <td className="text-center">{it.qty} {it.unit || 'Unit'}</td>
                      <td className="text-right">{formatCurrency(it.rate)}</td>
                      <td className="text-right text-muted">{it.discount ? formatCurrency(it.discount) : '—'}</td>
                      <td className="text-right font-medium">{formatCurrency(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Financial Totals & Commercial Terms */}
              <div className="fin-prop-summary-container">
                <div className="fin-prop-notes-area">
                  <strong>Commercial Terms &amp; Conditions:</strong>
                  {selectedProposal.commercialTerms?.paymentTerms && (
                    <p style={{ margin: '0.25rem 0' }}><strong>Payment Terms:</strong> {selectedProposal.commercialTerms.paymentTerms}</p>
                  )}
                  {selectedProposal.commercialTerms?.paymentMilestones && (
                    <p style={{ margin: '0.25rem 0' }}><strong>Milestones:</strong> {selectedProposal.commercialTerms.paymentMilestones}</p>
                  )}
                  {selectedProposal.commercialTerms?.scopeOfWork && (
                    <p style={{ margin: '0.25rem 0' }}><strong>Scope:</strong> {selectedProposal.commercialTerms.scopeOfWork}</p>
                  )}
                  {selectedProposal.commercialTerms?.deliverables && (
                    <p style={{ margin: '0.25rem 0' }}><strong>Deliverables:</strong> {selectedProposal.commercialTerms.deliverables}</p>
                  )}
                  {selectedProposal.commercialTerms?.exclusions && (
                    <p style={{ margin: '0.25rem 0' }}><strong>Exclusions:</strong> {selectedProposal.commercialTerms.exclusions}</p>
                  )}
                  {selectedProposal.commercialTerms?.assumptions && (
                    <p style={{ margin: '0.25rem 0' }}><strong>Assumptions:</strong> {selectedProposal.commercialTerms.assumptions}</p>
                  )}
                  {selectedProposal.commercialTerms?.clientNotes && (
                    <p style={{ margin: '0.25rem 0' }}><strong>Notes:</strong> {selectedProposal.commercialTerms.clientNotes}</p>
                  )}
                </div>

                <div className="fin-prop-totals-strip">
                  <div className="fin-prop-total-line">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(selectedProposal.subtotal)}</span>
                  </div>
                  {selectedProposal.discount > 0 && (
                    <div className="fin-prop-total-line">
                      <span>Discount:</span>
                      <span className="text-success">- {formatCurrency(selectedProposal.discount)}</span>
                    </div>
                  )}
                  <div className="fin-prop-total-line">
                    <span>Taxable Value:</span>
                    <span>{formatCurrency(selectedProposal.taxableAmount || (selectedProposal.subtotal - (selectedProposal.discount || 0)))}</span>
                  </div>
                  {(selectedProposal.taxType === 'INTER_STATE' || (selectedProposal.igst > 0 && !selectedProposal.cgst)) ? (
                    <div className="fin-prop-total-line">
                      <span>IGST (100%):</span>
                      <span>{formatCurrency(selectedProposal.igst || selectedProposal.tax)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="fin-prop-total-line">
                        <span>CGST:</span>
                        <span>{formatCurrency(selectedProposal.cgst || (selectedProposal.tax / 2))}</span>
                      </div>
                      <div className="fin-prop-total-line">
                        <span>SGST:</span>
                        <span>{formatCurrency(selectedProposal.sgst || (selectedProposal.tax / 2))}</span>
                      </div>
                    </>
                  )}
                  <div className="fin-prop-total-line">
                    <span>Total Tax:</span>
                    <span>{formatCurrency(selectedProposal.tax)}</span>
                  </div>
                  <div className="fin-prop-total-line grand">
                    <span>Grand Total:</span>
                    <strong>{formatCurrency(selectedProposal.total)}</strong>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="fin-prop-sign-row">
                <div className="fin-sign-box">
                  <div className="fin-sign-line" />
                  <p>Authorized Signatory<br /><strong>Aasha SM Technologies</strong></p>
                </div>
                <div className="fin-sign-box">
                  <div className="fin-sign-line" />
                  <p>Client Acceptance / Authorized Signature<br /><strong>{selectedProposal.clientName}</strong></p>
                </div>
              </div>
            </div>

            <div className="fin-modal-footer fin-no-print">
              <button
                type="button"
                className="fin-btn-secondary"
                onClick={() => setIsPreviewModalOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="fin-action-btn"
                onClick={() => handleOpenSendModal(selectedProposal)}
              >
                ✉️ Send to Client
              </button>
              <button
                type="button"
                className="fin-action-btn primary"
                onClick={() => window.print()}
              >
                🖨️ Print Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL 3: FULL PROPOSAL DETAILS WORKSPACE DRAWER
          ────────────────────────────────────────────────────────── */}
      {selectedProposal && !isPreviewModalOpen && !isCreateModalOpen && !isResponseModalOpen && !isSendModalOpen && !isApproveModalOpen && (
        <div className="fin-account-workspace" style={{ marginTop: '1rem' }}>
          {/* Workspace Topbar */}
          <div className="fin-account-topbar">
            <div className="fin-account-title-group">
              <button
                type="button"
                className="fin-back-btn"
                onClick={() => setSelectedProposal(null)}
              >
                ← Back to Proposal List
              </button>
              <div>
                <div className="fin-account-name-row">
                  <h3 className="fin-account-client-name">
                    {proposalDetails?.proposalNumber || selectedProposal.proposalNumber}
                  </h3>
                  {proposalDetails?.version && (
                    <span className="fin-version-tag">Version {proposalDetails.version}</span>
                  )}
                  <span className={getStatusBadgeClass(proposalDetails?.status || selectedProposal.status)}>
                    {proposalDetails?.status || selectedProposal.status}
                  </span>
                </div>
                <div className="fin-account-company-sub">
                  Client: <strong>{proposalDetails?.clientName || selectedProposal.clientName}</strong> • {proposalDetails?.title || selectedProposal.title}
                </div>
              </div>
            </div>

            <div className="fin-account-actions-group">
              <div className="fin-account-quick-pills">
                <div className="fin-quick-stat">
                  <small>Subtotal</small>
                  <strong>{formatCurrency(proposalDetails?.subtotal || selectedProposal.subtotal)}</strong>
                </div>
                <div className="fin-quick-stat">
                  <small>Total Tax</small>
                  <span>{formatCurrency(proposalDetails?.tax || selectedProposal.tax)}</span>
                </div>
                <div className="fin-quick-stat">
                  <small>Grand Total</small>
                  <strong className="text-orange">{formatCurrency(proposalDetails?.total || selectedProposal.total)}</strong>
                </div>
              </div>

              <div className="fin-account-btn-group">
                <button
                  type="button"
                  className="fin-action-btn"
                  onClick={() => handleOpenPreview(proposalDetails || selectedProposal)}
                >
                  🖨️ Preview / Print
                </button>
                <button
                  type="button"
                  className="fin-action-btn"
                  onClick={() => handleOpenSendModal(proposalDetails || selectedProposal)}
                >
                  ✉️ Send
                </button>
                <button
                  type="button"
                  className="fin-action-btn primary"
                  onClick={() => handleOpenResponseModal(proposalDetails || selectedProposal)}
                >
                  🤝 Client Response
                </button>
                {((proposalDetails?.status === 'Accepted' || selectedProposal?.status === 'Accepted') &&
                  !(proposalDetails?.convertedInvoice || selectedProposal?.convertedInvoice)) && (
                  <button
                    type="button"
                    className="fin-action-btn"
                    style={{ background: '#16a34a', color: '#ffffff', borderColor: '#16a34a', fontWeight: 'bold' }}
                    onClick={() => handleConvertToInvoice(proposalDetails || selectedProposal)}
                  >
                    📄 Convert to Invoice
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Details Navigation Tabs */}
          <div className="fin-account-tabs-bar">
            {[
              { key: 'items', label: 'Items & Pricing', icon: '📋' },
              { key: 'terms', label: 'Commercial Terms', icon: '📝' },
              { key: 'response', label: 'Client Response', icon: '🤝' },
              { key: 'approval', label: 'Approval History', icon: '🛡️' },
              { key: 'revisions', label: 'Version Revisions', icon: '🔄', count: proposalDetails?.revisions?.length },
              { key: 'invoice', label: 'Linked Invoice', icon: '📄' },
              { key: 'audit', label: 'Audit Trail', icon: '⏱️' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                className={`fin-account-tab-btn ${detailsTab === t.key ? 'active' : ''}`}
                onClick={() => setDetailsTab(t.key)}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
                {t.count !== undefined && t.count > 0 && (
                  <span className="fin-account-tab-badge">{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content Body */}
          <div className="fin-account-body">
            {/* SUB-TAB: ITEMS & PRICING */}
            {detailsTab === 'items' && (
              <div className="fin-account-section">
                <div className="fin-table-container">
                  <div className="fin-table-responsive">
                    <table className="fin-data-table">
                      <thead>
                        <tr>
                          <th>Item / Service</th>
                          <th>Description</th>
                          <th className="text-center">Qty</th>
                          <th className="text-center">Unit</th>
                          <th className="text-right">Rate</th>
                          <th className="text-right">Tax Rate</th>
                          <th className="text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(proposalDetails?.items || selectedProposal.items || []).map((it, idx) => (
                          <tr key={idx}>
                            <td><strong>{it.name || `Item ${idx + 1}`}</strong></td>
                            <td>{it.description}</td>
                            <td className="text-center">{it.qty}</td>
                            <td className="text-center">{it.unit || 'Unit'}</td>
                            <td className="text-right">{formatCurrency(it.rate)}</td>
                            <td className="text-right">{it.taxRate || 18}%</td>
                            <td className="text-right font-semibold">{formatCurrency(it.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB: COMMERCIAL TERMS */}
            {detailsTab === 'terms' && (
              <div className="fin-account-section">
                <div className="fin-profile-grid">
                  <div className="fin-card">
                    <div className="fin-card-header">
                      <h3>📜 Commercial Terms &amp; Scope</h3>
                    </div>
                    <div className="fin-details-list">
                      <div className="fin-detail-row">
                        <span>Payment Terms</span>
                        <strong>{proposalDetails?.commercialTerms?.paymentTerms || '30 Days Net'}</strong>
                      </div>
                      <div className="fin-detail-row">
                        <span>Milestones</span>
                        <strong>{proposalDetails?.commercialTerms?.paymentMilestones || 'As agreed in scope'}</strong>
                      </div>
                      <div className="fin-detail-row">
                        <span>Delivery Timeline</span>
                        <strong>{proposalDetails?.commercialTerms?.deliveryTimeline || 'Standard schedule'}</strong>
                      </div>
                      <div className="fin-detail-row">
                        <span>Scope of Work</span>
                        <strong>{proposalDetails?.commercialTerms?.scopeOfWork || 'As defined in proposal title'}</strong>
                      </div>
                      <div className="fin-detail-row">
                        <span>Deliverables</span>
                        <strong>{proposalDetails?.commercialTerms?.deliverables || 'As listed in line items'}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="fin-card">
                    <div className="fin-card-header">
                      <h3>⚖️ Conditions &amp; Exclusions</h3>
                    </div>
                    <div className="fin-details-list">
                      <div className="fin-detail-row">
                        <span>Exclusions</span>
                        <strong>{proposalDetails?.commercialTerms?.exclusions || 'None specified'}</strong>
                      </div>
                      <div className="fin-detail-row">
                        <span>Assumptions</span>
                        <strong>{proposalDetails?.commercialTerms?.assumptions || 'Standard client prerequisites'}</strong>
                      </div>
                      <div className="fin-detail-row">
                        <span>Client Notes</span>
                        <p className="fin-notes-block">{proposalDetails?.commercialTerms?.clientNotes || 'Standard quotation note'}</p>
                      </div>
                      <div className="fin-detail-row">
                        <span>Internal Finance Notes</span>
                        <p className="fin-notes-block text-orange" style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '0.5rem', borderRadius: '4px' }}>
                          🔒 <strong>CONFIDENTIAL (Internal Finance Only — Excluded from client PDF):</strong> {proposalDetails?.commercialTerms?.internalNotes || 'No internal notes'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB: CLIENT RESPONSE */}
            {detailsTab === 'response' && (
              <div className="fin-account-section">
                <div className="fin-section-toolbar">
                  <h4>Client Decision &amp; Follow-up History</h4>
                  <button
                    type="button"
                    className="fin-action-btn primary"
                    onClick={() => handleOpenResponseModal(proposalDetails || selectedProposal)}
                  >
                    Record New Response
                  </button>
                </div>

                <div className="fin-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
                  <div className="fin-detail-row">
                    <span>Current Response Status:</span>
                    <span className={getStatusBadgeClass(proposalDetails?.clientResponse?.status || 'Awaiting Response')}>
                      {proposalDetails?.clientResponse?.status || 'Awaiting Response'}
                    </span>
                  </div>
                  {proposalDetails?.clientResponse?.responseDate && (
                    <div className="fin-detail-row">
                      <span>Response Date:</span>
                      <strong>{formatDate(proposalDetails.clientResponse.responseDate)}</strong>
                    </div>
                  )}
                  {proposalDetails?.clientResponse?.contactPerson && (
                    <div className="fin-detail-row">
                      <span>Contact Person:</span>
                      <strong>{proposalDetails.clientResponse.contactPerson}</strong>
                    </div>
                  )}
                  {proposalDetails?.clientResponse?.reason && (
                    <div className="fin-detail-row">
                      <span>Decision Feedback / Reason:</span>
                      <strong>{proposalDetails.clientResponse.reason}</strong>
                    </div>
                  )}
                </div>

                {/* Follow-up Timeline */}
                <h5 style={{ margin: '0.5rem 0', color: '#0f172a' }}>Follow-up Communications:</h5>
                {(!proposalDetails?.followUps || proposalDetails.followUps.length === 0) ? (
                  <p className="text-muted" style={{ fontSize: '0.825rem' }}>No communication follow-ups logged yet.</p>
                ) : (
                  <div className="fin-followup-timeline">
                    {proposalDetails.followUps.map((fu, idx) => (
                      <div key={idx} className="fin-followup-item">
                        <div className="fin-followup-meta">
                          <span>📅 {formatDate(fu.date)} by <strong>{fu.followUpBy}</strong></span>
                          <span className="fin-prop-badge">{fu.status}</span>
                        </div>
                        <div className="fin-followup-note">{fu.note}</div>
                        {fu.nextFollowUpDate && (
                          <small className="text-orange">Next Action Date: {formatDate(fu.nextFollowUpDate)}</small>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB: APPROVAL HISTORY */}
            {detailsTab === 'approval' && (
              <div className="fin-account-section">
                <div className="fin-card" style={{ padding: '1.25rem' }}>
                  <div className="fin-section-toolbar">
                    <h4>Internal Approval Governance</h4>
                    {(proposalDetails?.status === 'Pending Approval' || proposalDetails?.approval?.status === 'Pending') && (
                      <button
                        type="button"
                        className="fin-action-btn primary"
                        onClick={() => handleOpenApproveModal(proposalDetails || selectedProposal)}
                      >
                        Review &amp; Approve
                      </button>
                    )}
                  </div>
                  <div className="fin-details-list">
                    <div className="fin-detail-row">
                      <span>Approval Status</span>
                      <span className={getStatusBadgeClass(proposalDetails?.approval?.status || 'Not Required')}>
                        {proposalDetails?.approval?.status || 'Not Required'}
                      </span>
                    </div>
                    <div className="fin-detail-row">
                      <span>Approver</span>
                      <strong>{proposalDetails?.approval?.approvedByName || 'Finance Head'}</strong>
                    </div>
                    <div className="fin-detail-row">
                      <span>Decision Date</span>
                      <strong>{proposalDetails?.approval?.approvalDate ? formatDate(proposalDetails.approval.approvalDate) : '—'}</strong>
                    </div>
                    <div className="fin-detail-row">
                      <span>Comments &amp; Justification</span>
                      <strong>{proposalDetails?.approval?.comments || 'Standard approval policy'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB: VERSION REVISIONS */}
            {detailsTab === 'revisions' && (
              <div className="fin-account-section">
                <div className="fin-section-toolbar">
                  <h4>Quotation Revisions ({proposalDetails?.revisions?.length || 0})</h4>
                  <button
                    type="button"
                    className="fin-action-btn"
                    onClick={() => handleOpenReviseModal(proposalDetails || selectedProposal)}
                  >
                    🔄 Create Revision v{(proposalDetails?.version || 1) + 1}
                  </button>
                </div>

                {(!proposalDetails?.revisions || proposalDetails.revisions.length === 0) ? (
                  <p className="text-muted" style={{ fontSize: '0.825rem' }}>This quotation is on its original initial version (v1). No revisions have been made.</p>
                ) : (
                  <div className="fin-table-container">
                    <div className="fin-table-responsive">
                      <table className="fin-data-table">
                        <thead>
                          <tr>
                            <th>Version</th>
                            <th>Revised At</th>
                            <th>Revised By</th>
                            <th>Reason</th>
                            <th className="text-right">Version Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {proposalDetails.revisions.map((rev, i) => (
                            <tr key={i}>
                              <td><span className="fin-version-tag">v{rev.version}</span></td>
                              <td>{new Date(rev.revisedAt).toLocaleString('en-IN')}</td>
                              <td><strong>{rev.revisedBy || 'Finance User'}</strong></td>
                              <td>{rev.reason}</td>
                              <td className="text-right font-bold">{formatCurrency(rev.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB: LINKED INVOICE */}
            {detailsTab === 'invoice' && (
              <div className="fin-account-section">
                {proposalDetails?.convertedInvoice ? (
                  <div className="fin-card" style={{ padding: '1.25rem' }}>
                    <div className="fin-section-toolbar">
                      <h4>Linked Tax Invoice</h4>
                      <span className="fin-badge paid">Successfully Converted</span>
                    </div>
                    <div className="fin-details-list">
                      <div className="fin-detail-row">
                        <span>Invoice Number</span>
                        <strong className="fin-code-badge large">
                          {proposalDetails.convertedInvoice.invoiceNumber}
                        </strong>
                      </div>
                      <div className="fin-detail-row">
                        <span>Issue Date</span>
                        <strong>{formatDate(proposalDetails.convertedInvoice.issueDate)}</strong>
                      </div>
                      <div className="fin-detail-row">
                        <span>Due Date</span>
                        <strong>{formatDate(proposalDetails.convertedInvoice.dueDate)}</strong>
                      </div>
                      <div className="fin-detail-row">
                        <span>Invoiced Amount</span>
                        <strong>{formatCurrency(proposalDetails.convertedInvoice.amount)}</strong>
                      </div>
                      <div className="fin-detail-row">
                        <span>Current Invoice Status</span>
                        <span className="fin-badge paid">{proposalDetails.convertedInvoice.status || 'Active'}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="fin-empty-box" style={{ padding: '2rem' }}>
                    <span>📄</span>
                    <p>This proposal has not yet been converted to an invoice.</p>
                    {(proposalDetails?.status === 'Accepted' || selectedProposal.status === 'Accepted') && (
                      <button
                        type="button"
                        className="fin-action-btn primary"
                        onClick={() => handleConvertToInvoice(proposalDetails || selectedProposal)}
                      >
                        Convert to Official Invoice Now
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB: AUDIT TRAIL */}
            {detailsTab === 'audit' && (
              <div className="fin-account-section">
                <h4>Quotation Audit Logs</h4>
                <div className="fin-table-container">
                  <div className="fin-table-responsive">
                    <table className="fin-data-table">
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Action</th>
                          <th>User</th>
                          <th>Reason / Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!proposalDetails?.auditHistory || proposalDetails.auditHistory.length === 0) ? (
                          <tr>
                            <td colSpan="4" className="fin-empty-td">
                              No specific audit events logged for this quotation.
                            </td>
                          </tr>
                        ) : (
                          proposalDetails.auditHistory.map((a, i) => (
                            <tr key={i}>
                              <td>{new Date(a.timestamp).toLocaleString('en-IN')}</td>
                              <td><strong>{a.action}</strong></td>
                              <td>{a.performedByName || 'Finance User'}</td>
                              <td>{a.reason || '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL 4: RECORD CLIENT RESPONSE
          ────────────────────────────────────────────────────────── */}
      {isResponseModalOpen && selectedProposal && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Record Client Decision — {selectedProposal.proposalNumber}</h3>
              <button
                type="button"
                className="fin-modal-close-btn"
                onClick={() => setIsResponseModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveResponse}>
              <div className="fin-modal-body">
                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Client Response *</label>
                    <select
                      value={responseData.status}
                      onChange={(e) => setResponseData({ ...responseData, status: e.target.value })}
                    >
                      <option value="Accepted">✅ Accepted / Approved by Client</option>
                      <option value="Changes Requested">🔄 Changes Requested (Returns to Draft)</option>
                      <option value="Rejected">❌ Rejected / Declined by Client</option>
                      <option value="Awaiting Response">⏳ Awaiting Response</option>
                    </select>
                  </div>

                  <div className="fin-form-group">
                    <label>Response Date</label>
                    <input
                      type="date"
                      value={responseData.responseDate}
                      onChange={(e) => setResponseData({ ...responseData, responseDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Decision Maker / Contact Person</label>
                    <input
                      type="text"
                      value={responseData.contactPerson}
                      onChange={(e) => setResponseData({ ...responseData, contactPerson: e.target.value })}
                      placeholder="e.g. Mr. Sharma (CTO)"
                    />
                  </div>

                  <div className="fin-form-group col-span-2">
                    <label>Reason / Discussion Notes</label>
                    <textarea
                      rows="2"
                      value={responseData.reason}
                      onChange={(e) => setResponseData({ ...responseData, reason: e.target.value })}
                      placeholder="Enter acceptance conditions, price negotiation feedback, or rejection rationale..."
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Next Follow-up Date (Optional)</label>
                    <input
                      type="date"
                      value={responseData.nextFollowUpDate}
                      onChange={(e) => setResponseData({ ...responseData, nextFollowUpDate: e.target.value })}
                    />
                  </div>

                  <div className="fin-form-group">
                    <label>Next Action Note</label>
                    <input
                      type="text"
                      value={responseData.notes}
                      onChange={(e) => setResponseData({ ...responseData, notes: e.target.value })}
                      placeholder="e.g. Prepare milestone invoice, send amended scope..."
                    />
                  </div>
                </div>
              </div>

              <div className="fin-modal-footer">
                <button
                  type="button"
                  className="fin-btn-secondary"
                  onClick={() => setIsResponseModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="fin-action-btn primary"
                  disabled={responseLoading}
                >
                  {responseLoading ? 'Recording...' : 'Save Client Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL 5: SEND QUOTATION TO CLIENT
          ────────────────────────────────────────────────────────── */}
      {isSendModalOpen && selectedProposal && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Send Quotation — {selectedProposal.proposalNumber}</h3>
              <button
                type="button"
                className="fin-modal-close-btn"
                onClick={() => setIsSendModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSendProposal}>
              <div className="fin-modal-body">
                <div className="fin-form-group">
                  <label>Recipient Email Address *</label>
                  <input
                    type="email"
                    required
                    value={sendData.recipientEmail}
                    onChange={(e) => setSendData({ ...sendData, recipientEmail: e.target.value })}
                    placeholder="client@company.com"
                  />
                </div>

                <div className="fin-form-group">
                  <label>Custom Cover Note (Optional)</label>
                  <textarea
                    rows="3"
                    value={sendData.customMessage}
                    onChange={(e) => setSendData({ ...sendData, customMessage: e.target.value })}
                    placeholder="Dear Client, please find attached our commercial proposal for your review..."
                  />
                </div>

                <div className="fin-prop-send-summary">
                  <p><strong>Quotation:</strong> {selectedProposal.proposalNumber} — {selectedProposal.title}</p>
                  <p><strong>Total Value:</strong> {formatCurrency(selectedProposal.total)}</p>
                  <p><strong>Valid Until:</strong> {formatDate(selectedProposal.validUntil)}</p>
                </div>
              </div>

              <div className="fin-modal-footer">
                <button
                  type="button"
                  className="fin-btn-secondary"
                  onClick={() => setIsSendModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="fin-action-btn primary"
                  disabled={sendLoading}
                >
                  {sendLoading ? 'Dispatching...' : '✉️ Send Quotation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL 6: INTERNAL APPROVAL
          ────────────────────────────────────────────────────────── */}
      {isApproveModalOpen && selectedProposal && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-box">
            <div className="fin-modal-header">
              <h3>Finance Head Review — {selectedProposal.proposalNumber}</h3>
              <button
                type="button"
                className="fin-modal-close-btn"
                onClick={() => setIsApproveModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleApproveProposal}>
              <div className="fin-modal-body">
                <div className="fin-form-group">
                  <label>Approval Decision</label>
                  <select
                    value={approveData.decision}
                    onChange={(e) => setApproveData({ ...approveData, decision: e.target.value })}
                  >
                    <option value="Approved">✅ Approve (Mark ready to send to client)</option>
                    <option value="Rejected">❌ Reject / Return for Revisions</option>
                  </select>
                </div>

                <div className="fin-form-group">
                  <label>Reviewer Comments &amp; Justification</label>
                  <textarea
                    rows="3"
                    required
                    value={approveData.comments}
                    onChange={(e) => setApproveData({ ...approveData, comments: e.target.value })}
                    placeholder="Provide commercial guidance or revision instructions..."
                  />
                </div>
              </div>

              <div className="fin-modal-footer">
                <button
                  type="button"
                  className="fin-btn-secondary"
                  onClick={() => setIsApproveModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="fin-action-btn primary"
                  disabled={approveLoading}
                >
                  {approveLoading ? 'Submitting...' : 'Submit Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
