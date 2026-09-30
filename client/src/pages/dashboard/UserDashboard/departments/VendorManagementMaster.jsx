import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../../../services/apiClient';

export default function VendorManagementMaster({
  vendors = [],
  setVendors,
  vendorBills = [],
  setVendorBills,
  bankAccounts = [],
  formatCurrency,
  formatDate,
  user,
  isFinanceAdmin,
  onRefresh,
  initialSubTab = 'overview',
}) {
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab || 'overview');

  // Loading & Feedback
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Payment History State
  const [vendorPayments, setVendorPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateStartFilter, setDateStartFilter] = useState('');
  const [dateEndFilter, setDateEndFilter] = useState('');

  // Modals: 'vendor' | 'bill' | 'pay' | 'schedule'
  const [activeModal, setActiveModal] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [modalForm, setModalForm] = useState({});
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Sync initialSubTab if passed or changed via query params
  useEffect(() => {
    if (initialSubTab && initialSubTab !== activeSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 5500);
  };

  // Fetch Vendor Payments on mount or when payments tab selected
  const fetchPayments = async () => {
    setPaymentsLoading(true);
    try {
      const res = await apiClient.get('/finance/vendor-payments');
      setVendorPayments(res.data?.data || []);
    } catch (err) {
      // Fallback to ledger if vendor-payments not yet populated
      try {
        const fallback = await apiClient.get('/finance/ledger?category=Vendor Bill Payment');
        setVendorPayments(fallback.data?.data || []);
      } catch (e) {
        console.error('Failed to load vendor payments:', e);
      }
    } finally {
      setPaymentsLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'payments' || activeSubTab === 'overview') {
      fetchPayments();
    }
  }, [activeSubTab]);

  // Derived Financial Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalVendors = vendors.length;
    const activeVendors = vendors.filter((v) => v.status === 'Active').length;

    let totalBilled = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    const now = new Date();

    vendorBills.forEach((b) => {
      const bTotal = Number(b.totalAmount) || 0;
      const bPaid = Number(b.paidAmount) || 0;
      const bBalance = Number(b.balance) || Math.max(0, bTotal - bPaid);

      totalBilled += bTotal;
      totalPaid += bPaid;
      totalOutstanding += bBalance;

      if (bBalance > 0 && b.dueDate && new Date(b.dueDate) < now) {
        overdueCount += 1;
        overdueAmount += bBalance;
      }
    });

    // Category breakdown
    const catMap = {};
    vendorBills.forEach((b) => {
      const cat = b.category || 'General';
      if (!catMap[cat]) {
        catMap[cat] = { category: cat, billsCount: 0, billed: 0, paid: 0, balance: 0 };
      }
      catMap[cat].billsCount += 1;
      catMap[cat].billed += Number(b.totalAmount) || 0;
      catMap[cat].paid += Number(b.paidAmount) || 0;
      catMap[cat].balance += Number(b.balance) || 0;
    });

    return {
      totalVendors,
      activeVendors,
      totalBilled: Math.round(totalBilled * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      overdueCount,
      overdueAmount: Math.round(overdueAmount * 100) / 100,
      categories: Object.values(catMap),
    };
  }, [vendors, vendorBills]);

  // Filtered Vendors
  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      const matchesCategory = categoryFilter === 'All' || v.category === categoryFilter;
      const matchesStatus = statusFilter === 'All' || v.status === statusFilter;
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        v.companyName?.toLowerCase().includes(q) ||
        v.name?.toLowerCase().includes(q) ||
        v.email?.toLowerCase().includes(q) ||
        v.phone?.toLowerCase().includes(q) ||
        v.category?.toLowerCase().includes(q) ||
        v.gstin?.toLowerCase().includes(q);
      return matchesCategory && matchesStatus && matchesSearch;
    });
  }, [vendors, categoryFilter, statusFilter, searchTerm]);

  // Filtered Bills
  const filteredBills = useMemo(() => {
    return vendorBills.filter((b) => {
      const matchesCategory = categoryFilter === 'All' || b.category === categoryFilter;
      const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        b.billNumber?.toLowerCase().includes(q) ||
        b.vendorName?.toLowerCase().includes(q) ||
        b.category?.toLowerCase().includes(q) ||
        b.description?.toLowerCase().includes(q);
      return matchesCategory && matchesStatus && matchesSearch;
    });
  }, [vendorBills, categoryFilter, statusFilter, searchTerm]);

  // Outstanding Bills (balance > 0)
  const outstandingBills = useMemo(() => {
    return vendorBills
      .filter((b) => Number(b.balance) > 0)
      .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
  }, [vendorBills]);

  // Filtered Payments History
  const filteredPayments = useMemo(() => {
    return vendorPayments.filter((p) => {
      const q = searchTerm.toLowerCase();
      const vName = p.vendor?.companyName || p.vendor?.name || p.vendorName || '';
      const ref = p.paymentNumber || p.transactionReference || '';
      const billRef = p.vendorBill?.billNumber || '';

      const matchesSearch =
        !searchTerm ||
        vName.toLowerCase().includes(q) ||
        ref.toLowerCase().includes(q) ||
        billRef.toLowerCase().includes(q) ||
        p.notes?.toLowerCase().includes(q);

      let matchesDate = true;
      if (dateStartFilter) {
        matchesDate = matchesDate && new Date(p.paymentDate || p.createdAt) >= new Date(dateStartFilter);
      }
      if (dateEndFilter) {
        const end = new Date(dateEndFilter);
        end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && new Date(p.paymentDate || p.createdAt) <= end;
      }

      return matchesSearch && matchesDate;
    });
  }, [vendorPayments, searchTerm, dateStartFilter, dateEndFilter]);

  // Unique categories for filter dropdown
  const uniqueCategories = useMemo(() => {
    const set = new Set([
      ...vendors.map((v) => v.category).filter(Boolean),
      ...vendorBills.map((b) => b.category).filter(Boolean),
      'Software & IT',
      'Hardware & Infrastructure',
      'Office Operations',
      'Legal & Professional',
      'Marketing & Advertising',
      'Utilities',
    ]);
    return ['All', ...Array.from(set)];
  }, [vendors, vendorBills]);

  // ─── MODAL ACTIONS ───
  const openRegisterVendorModal = () => {
    setModalForm({
      companyName: '',
      name: '',
      category: 'Software & IT',
      email: '',
      phone: '',
      address: '',
      gstin: '',
      pan: '',
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      branch: '',
      beneficiaryName: '',
      notes: '',
    });
    setModalError('');
    setActiveModal('vendor');
  };

  const handleCreateVendor = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');
    try {
      await apiClient.post('/finance/vendors', {
        companyName: modalForm.companyName,
        name: modalForm.name,
        category: modalForm.category,
        email: modalForm.email,
        phone: modalForm.phone,
        address: modalForm.address,
        gstin: modalForm.gstin,
        pan: modalForm.pan,
        bankDetails: {
          bankName: modalForm.bankName,
          accountNumber: modalForm.accountNumber,
          ifscCode: modalForm.ifscCode,
          branch: modalForm.branch,
          beneficiaryName: modalForm.beneficiaryName || modalForm.companyName,
        },
        notes: modalForm.notes,
      });
      showSuccess('Vendor registered successfully');
      setActiveModal(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to register vendor');
    } finally {
      setModalLoading(false);
    }
  };

  const openAddBillModal = (preselectedVendor = null) => {
    const now = new Date();
    const due = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    setModalForm({
      vendor: preselectedVendor?._id || vendors[0]?._id || '',
      billNumber: `BILL-${Date.now().toString().slice(-6)}`,
      billDate: now.toISOString().slice(0, 10),
      dueDate: due.toISOString().slice(0, 10),
      category: preselectedVendor?.category || 'Software & IT',
      amount: '',
      tax: '0',
      description: '',
      receiptUrl: '',
    });
    setModalError('');
    setActiveModal('bill');
  };

  const handleCreateBill = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');
    try {
      await apiClient.post('/finance/vendor-bills', {
        vendor: modalForm.vendor,
        billNumber: modalForm.billNumber,
        billDate: modalForm.billDate,
        dueDate: modalForm.dueDate,
        category: modalForm.category,
        amount: Number(modalForm.amount),
        tax: Number(modalForm.tax) || 0,
        description: modalForm.description,
        receiptUrl: modalForm.receiptUrl,
      });
      showSuccess('Vendor bill created successfully');
      setActiveModal(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to create vendor bill');
    } finally {
      setModalLoading(false);
    }
  };

  const openPayBillModal = (bill) => {
    setSelectedBill(bill);
    setModalForm({
      amount: bill.balance || bill.totalAmount,
      bankAccountId: bankAccounts[0]?._id || '',
      paymentMethod: 'Bank Transfer',
      transactionReference: `UTR-VEND-${Date.now().toString().slice(-6)}`,
      notes: `Payment for bill ${bill.billNumber}`,
    });
    setModalError('');
    setActiveModal('pay');
  };

  const handleDisbursePayment = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');
    try {
      await apiClient.post(`/finance/vendor-bills/${selectedBill._id}/pay`, {
        amount: Number(modalForm.amount),
        bankAccountId: modalForm.bankAccountId,
        paymentMethod: modalForm.paymentMethod,
        transactionReference: modalForm.transactionReference,
        notes: modalForm.notes,
      });
      showSuccess(`Payment of ${formatCurrency(modalForm.amount)} disbursed successfully`);
      setActiveModal(null);
      if (onRefresh) onRefresh();
      fetchPayments();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to record vendor payment');
    } finally {
      setModalLoading(false);
    }
  };

  const handleApproveBill = async (billId) => {
    try {
      await apiClient.post(`/finance/vendor-bills/${billId}/approve`);
      showSuccess('Vendor bill approved for payment');
      if (onRefresh) onRefresh();
    } catch (err) {
      showError(err.response?.data?.message || 'Bill approval failed');
    }
  };

  const handleDeleteBill = async (billId) => {
    if (!window.confirm('Are you sure you want to delete this vendor bill? This cannot be undone.')) return;
    try {
      await apiClient.delete(`/finance/vendor-bills/${billId}`);
      showSuccess('Vendor bill deleted successfully');
      if (onRefresh) onRefresh();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to delete bill');
    }
  };

  // CSV Export for Payments History
  const exportPaymentsCSV = () => {
    if (!filteredPayments.length) return alert('No payment history records to export');
    const headers = ['Payment # / UTR', 'Vendor', 'Bill Number', 'Amount', 'Date', 'Payment Method', 'Bank Account', 'Status', 'Notes'];
    const rows = filteredPayments.map((p) => [
      `"${p.paymentNumber || p.transactionReference || ''}"`,
      `"${p.vendor?.companyName || p.vendor?.name || p.vendorName || ''}"`,
      `"${p.vendorBill?.billNumber || ''}"`,
      p.amount,
      formatDate(p.paymentDate || p.createdAt),
      `"${p.paymentMethod || 'Bank Transfer'}"`,
      `"${p.bankAccount?.bankName || p.bankAccountName || ''}"`,
      `"${p.status || 'Completed'}"`,
      `"${p.notes || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `vendor_payments_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fin-vendor-master">
      {/* Notifications */}
      {successMsg && <div className="fin-alert success" style={{ marginBottom: '1rem' }}>✓ {successMsg}</div>}
      {errorMsg && <div className="fin-alert error" style={{ marginBottom: '1rem' }}>⚠ {errorMsg}</div>}

      {/* Internal Subtabs Navigation */}
      <div className="fin-subtab-nav">
        {[
          { key: 'overview', label: '1. Financial Summary', icon: '📊' },
          { key: 'directory', label: `2. Vendor Directory (${vendors.length})`, icon: '🏢' },
          { key: 'bills', label: `3. Vendor Bills (${vendorBills.length})`, icon: '📋' },
          { key: 'outstanding', label: `4. Outstanding Bills (${outstandingBills.length})`, icon: '⏳' },
          { key: 'payments', label: '5. Payment History', icon: '💸' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`fin-subtab-btn ${activeSubTab === tab.key ? 'active' : ''}`}
            onClick={() => {
              setActiveSubTab(tab.key);
              setSearchTerm('');
              setStatusFilter('All');
              setCategoryFilter('All');
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 1. FINANCIAL SUMMARY & ANALYTICS */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeSubTab === 'overview' && (
        <div>
          {/* Top KPI Cards */}
          <div className="fin-kpi-grid-6" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: '1.25rem' }}>
            <div className="fin-kpi-card">
              <div className="fin-kpi-top">
                <span className="fin-kpi-label">Registered Vendors</span>
                <div className="fin-kpi-icon-wrap bank">🏢</div>
              </div>
              <div className="fin-kpi-value">{summaryMetrics.totalVendors}</div>
              <div className="fin-kpi-footer">
                <span style={{ color: '#16a34a', fontWeight: 600 }}>{summaryMetrics.activeVendors} Active</span>
              </div>
            </div>

            <div className="fin-kpi-card">
              <div className="fin-kpi-top">
                <span className="fin-kpi-label">Total Billed</span>
                <div className="fin-kpi-icon-wrap income">📋</div>
              </div>
              <div className="fin-kpi-value">{formatCurrency(summaryMetrics.totalBilled)}</div>
              <div className="fin-kpi-footer">Across {vendorBills.length} Bills</div>
            </div>

            <div className="fin-kpi-card">
              <div className="fin-kpi-top">
                <span className="fin-kpi-label">Total Paid</span>
                <div className="fin-kpi-icon-wrap" style={{ background: '#dcfce7', color: '#16a34a' }}>✓</div>
              </div>
              <div className="fin-kpi-value" style={{ color: '#16a34a' }}>
                {formatCurrency(summaryMetrics.totalPaid)}
              </div>
              <div className="fin-kpi-footer">Disbursed to Vendors</div>
            </div>

            <div className="fin-kpi-card">
              <div className="fin-kpi-top">
                <span className="fin-kpi-label">Outstanding Balance</span>
                <div className="fin-kpi-icon-wrap expense">⏳</div>
              </div>
              <div className="fin-kpi-value" style={{ color: summaryMetrics.totalOutstanding > 0 ? '#ea580c' : '#475569' }}>
                {formatCurrency(summaryMetrics.totalOutstanding)}
              </div>
              <div className="fin-kpi-footer">Payable Balance</div>
            </div>

            <div className="fin-kpi-card">
              <div className="fin-kpi-top">
                <span className="fin-kpi-label">Overdue Bills</span>
                <div className="fin-kpi-icon-wrap" style={{ background: '#fee2e2', color: '#dc2626' }}>⚠</div>
              </div>
              <div className="fin-kpi-value" style={{ color: '#dc2626' }}>
                {summaryMetrics.overdueCount}
              </div>
              <div className="fin-kpi-footer" style={{ color: '#dc2626', fontWeight: 600 }}>
                {formatCurrency(summaryMetrics.overdueAmount)} Overdue
              </div>
            </div>
          </div>

          {/* Quick Actions & Category Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <div className="fin-table-container">
              <div className="fin-table-toolbar">
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Payables by Category Breakdown</span>
              </div>
              <div className="fin-table-responsive">
                <table className="fin-data-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th className="text-right">Bills Count</th>
                      <th className="text-right">Total Billed</th>
                      <th className="text-right">Total Paid</th>
                      <th className="text-right">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryMetrics.categories.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="fin-empty-cell">No vendor bills recorded</td>
                      </tr>
                    ) : (
                      summaryMetrics.categories.map((c) => (
                        <tr key={c.category}>
                          <td><strong>{c.category}</strong></td>
                          <td className="text-right">{c.billsCount}</td>
                          <td className="text-right">{formatCurrency(c.billed)}</td>
                          <td className="text-right" style={{ color: '#16a34a' }}>{formatCurrency(c.paid)}</td>
                          <td className="text-right" style={{ color: c.balance > 0 ? '#ea580c' : '#475569', fontWeight: 600 }}>
                            {formatCurrency(c.balance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="fin-card">
              <div className="fin-card-header">
                <h3>⚡ Vendor Quick Actions</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 0' }}>
                <button
                  type="button"
                  className="fin-btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={openRegisterVendorModal}
                >
                  + Register New Vendor
                </button>
                <button
                  type="button"
                  className="fin-btn-secondary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => openAddBillModal()}
                >
                  + Add Vendor Bill
                </button>
                <button
                  type="button"
                  className="fin-btn-secondary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setActiveSubTab('outstanding')}
                >
                  View Outstanding Bills ({outstandingBills.length})
                </button>
                <button
                  type="button"
                  className="fin-btn-secondary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setActiveSubTab('payments')}
                >
                  View Payment History
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 2. VENDOR DIRECTORY */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeSubTab === 'directory' && (
        <div className="fin-table-container">
          <div className="fin-table-toolbar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
              <input
                type="text"
                className="fin-search-input"
                placeholder="Search vendor name, contact person, phone, email, GSTIN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ maxWidth: '340px' }}
              />
              <select
                className="fin-filter-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                {uniqueCategories.map((c) => (
                  <option key={c} value={c}>Category: {c}</option>
                ))}
              </select>
              <select
                className="fin-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">Status: All</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <button className="fin-btn-primary fin-btn-sm" onClick={openRegisterVendorModal}>
              + Register Vendor
            </button>
          </div>

          <div className="fin-table-responsive">
            <table className="fin-data-table">
              <thead>
                <tr>
                  <th>Company Name</th>
                  <th>Contact Person</th>
                  <th>Category</th>
                  <th>GSTIN / PAN</th>
                  <th className="text-right">Total Billed</th>
                  <th className="text-right">Total Paid</th>
                  <th className="text-right">Outstanding</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVendors.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="fin-empty-cell">
                      {searchTerm ? 'No vendors matching search filter' : 'No vendors found'}
                    </td>
                  </tr>
                ) : (
                  filteredVendors.map((v) => (
                    <tr key={v._id}>
                      <td>
                        <strong>{v.companyName}</strong>
                        {v.address && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{v.address}</div>}
                      </td>
                      <td>
                        <div>{v.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {v.phone && <span>📞 {v.phone} </span>}
                          {v.email && <span>✉ {v.email}</span>}
                        </div>
                      </td>
                      <td>
                        <span className="fin-cell-category">{v.category}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                          {v.gstin || v.pan || '—'}
                        </span>
                      </td>
                      <td className="text-right font-medium">{formatCurrency(v.totalBilled)}</td>
                      <td className="text-right text-success font-medium">{formatCurrency(v.totalPaid)}</td>
                      <td className="text-right font-bold" style={{ color: v.outstanding > 0 ? '#ea580c' : '#475569' }}>
                        {formatCurrency(v.outstanding)}
                      </td>
                      <td>
                        <span className={`fin-badge ${String(v.status || 'active').toLowerCase()}`}>
                          {v.status || 'Active'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="fin-action-btn"
                          title="Add bill for this vendor"
                          onClick={() => openAddBillModal(v)}
                        >
                          + Add Bill
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

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 3. VENDOR BILLS */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeSubTab === 'bills' && (
        <div className="fin-table-container">
          <div className="fin-table-toolbar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
              <input
                type="text"
                className="fin-search-input"
                placeholder="Search by bill number, vendor, category, description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ maxWidth: '340px' }}
              />
              <select
                className="fin-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">Status: All</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Paid">Paid</option>
                <option value="Rejected">Rejected</option>
              </select>
              <select
                className="fin-filter-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                {uniqueCategories.map((c) => (
                  <option key={c} value={c}>Category: {c}</option>
                ))}
              </select>
            </div>
            <button className="fin-btn-primary fin-btn-sm" onClick={() => openAddBillModal()}>
              + Add Vendor Bill
            </button>
          </div>

          <div className="fin-table-responsive">
            <table className="fin-data-table">
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Vendor</th>
                  <th>Bill Date</th>
                  <th>Due Date</th>
                  <th>Category</th>
                  <th className="text-right">Total Bill</th>
                  <th className="text-right">Paid Amount</th>
                  <th className="text-right">Outstanding</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="fin-empty-cell">
                      {searchTerm ? 'No bills matching search filter' : 'No vendor bills recorded'}
                    </td>
                  </tr>
                ) : (
                  filteredBills.map((b) => {
                    const isOverdue = b.balance > 0 && b.dueDate && new Date(b.dueDate) < new Date();
                    return (
                      <tr key={b._id}>
                        <td>
                          <strong className="font-mono text-primary">{b.billNumber}</strong>
                        </td>
                        <td>
                          <strong>{b.vendorName || b.vendor?.companyName || 'Vendor'}</strong>
                        </td>
                        <td>{formatDate(b.billDate)}</td>
                        <td>
                          <span style={{ color: isOverdue ? '#dc2626' : 'inherit', fontWeight: isOverdue ? 700 : 400 }}>
                            {formatDate(b.dueDate)}
                            {isOverdue && <span style={{ marginLeft: '4px', fontSize: '0.7rem', color: '#dc2626' }}>(Overdue)</span>}
                          </span>
                        </td>
                        <td>
                          <span className="fin-cell-category">{b.category}</span>
                        </td>
                        <td className="text-right font-semibold">{formatCurrency(b.totalAmount)}</td>
                        <td className="text-right text-success font-medium">{formatCurrency(b.paidAmount)}</td>
                        <td
                          className="text-right font-bold"
                          style={{ color: b.balance > 0 ? '#ea580c' : '#475569' }}
                        >
                          {formatCurrency(b.balance)}
                        </td>
                        <td>
                          <span className={`fin-badge ${String(b.status || 'pending').toLowerCase().replace(/\s+/g, '-')}`}>
                            {b.status}
                          </span>
                        </td>
                        <td>
                          <div className="fin-row-actions">
                            {b.approvalStatus === 'Pending' && isFinanceAdmin && (
                              <button
                                type="button"
                                className="fin-action-btn approve"
                                onClick={() => handleApproveBill(b._id)}
                              >
                                Approve
                              </button>
                            )}
                            {b.approvalStatus === 'Approved' && b.balance > 0 && (
                              <button
                                type="button"
                                className="fin-action-btn pay"
                                onClick={() => openPayBillModal(b)}
                              >
                                Pay Bill
                              </button>
                            )}
                            {b.status === 'Paid' && (
                              <small style={{ color: '#16a34a' }}>✓ Fully Settled</small>
                            )}
                            {b.paidAmount === 0 && (
                              <button
                                type="button"
                                className="fin-action-btn"
                                style={{ color: '#ef4444' }}
                                onClick={() => handleDeleteBill(b._id)}
                                title="Delete Bill"
                              >
                                🗑
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

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 4. OUTSTANDING BILLS */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeSubTab === 'outstanding' && (
        <div className="fin-table-container">
          <div className="fin-table-toolbar">
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              Pending & Overdue Vendor Payables ({outstandingBills.length} Bills • Total:{' '}
              {formatCurrency(summaryMetrics.totalOutstanding)})
            </span>
          </div>

          <div className="fin-table-responsive">
            <table className="fin-data-table">
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Vendor</th>
                  <th>Due Date</th>
                  <th>Category</th>
                  <th className="text-right">Total Bill</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Outstanding</th>
                  <th>Approval</th>
                  <th>Aging / Urgency</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {outstandingBills.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="fin-empty-cell">
                      🎉 No outstanding bills! All vendor payables are fully settled.
                    </td>
                  </tr>
                ) : (
                  outstandingBills.map((b) => {
                    const now = new Date();
                    const due = b.dueDate ? new Date(b.dueDate) : null;
                    const isOverdue = due && due < now;
                    const diffDays = due ? Math.floor((now - due) / (1000 * 60 * 60 * 24)) : 0;

                    return (
                      <tr key={b._id} style={{ background: isOverdue ? '#fff5f5' : 'inherit' }}>
                        <td>
                          <strong className="font-mono text-primary">{b.billNumber}</strong>
                        </td>
                        <td>
                          <strong>{b.vendorName || b.vendor?.companyName || 'Vendor'}</strong>
                        </td>
                        <td>{formatDate(b.dueDate)}</td>
                        <td>
                          <span className="fin-cell-category">{b.category}</span>
                        </td>
                        <td className="text-right font-medium">{formatCurrency(b.totalAmount)}</td>
                        <td className="text-right text-success">{formatCurrency(b.paidAmount)}</td>
                        <td className="text-right font-bold" style={{ color: '#ea580c' }}>
                          {formatCurrency(b.balance)}
                        </td>
                        <td>
                          <span className={`fin-badge ${String(b.approvalStatus || 'pending').toLowerCase()}`}>
                            {b.approvalStatus}
                          </span>
                        </td>
                        <td>
                          {isOverdue ? (
                            <span className="fin-badge rejected">
                              {diffDays > 0 ? `${diffDays}d Overdue` : 'Overdue Today'}
                            </span>
                          ) : (
                            <span className="fin-badge in-progress">
                              Due in {Math.abs(diffDays)}d
                            </span>
                          )}
                        </td>
                        <td>
                          {b.approvalStatus === 'Approved' ? (
                            <button
                              type="button"
                              className="fin-action-btn pay"
                              onClick={() => openPayBillModal(b)}
                            >
                              Disburse Payment
                            </button>
                          ) : (
                            isFinanceAdmin && (
                              <button
                                type="button"
                                className="fin-action-btn approve"
                                onClick={() => handleApproveBill(b._id)}
                              >
                                Approve to Pay
                              </button>
                            )
                          )}
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

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 5. PAYMENT HISTORY */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeSubTab === 'payments' && (
        <div className="fin-table-container">
          <div className="fin-table-toolbar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
              <input
                type="text"
                className="fin-search-input"
                placeholder="Search payments by UTR, vendor, bill number, notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ maxWidth: '320px' }}
              />
              <input
                type="date"
                className="fin-filter-select"
                value={dateStartFilter}
                onChange={(e) => setDateStartFilter(e.target.value)}
                title="Start Date"
              />
              <span style={{ color: '#64748b' }}>to</span>
              <input
                type="date"
                className="fin-filter-select"
                value={dateEndFilter}
                onChange={(e) => setDateEndFilter(e.target.value)}
                title="End Date"
              />
              {(searchTerm || dateStartFilter || dateEndFilter) && (
                <button
                  type="button"
                  className="fin-btn-secondary fin-btn-sm"
                  onClick={() => {
                    setSearchTerm('');
                    setDateStartFilter('');
                    setDateEndFilter('');
                  }}
                >
                  Reset
                </button>
              )}
            </div>
            <button className="fin-btn-secondary fin-btn-sm" onClick={exportPaymentsCSV}>
              📥 Export CSV
            </button>
          </div>

          <div className="fin-table-responsive">
            <table className="fin-data-table">
              <thead>
                <tr>
                  <th>Payment Ref / UTR</th>
                  <th>Vendor</th>
                  <th>Bill #</th>
                  <th className="text-right">Amount Paid</th>
                  <th>Payment Date</th>
                  <th>Method</th>
                  <th>Bank Account</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paymentsLoading ? (
                  <tr><td colSpan="8" className="fin-empty-cell">Loading vendor payments...</td></tr>
                ) : filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="fin-empty-cell">
                      No vendor payments found
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <strong className="font-mono text-primary">
                          {p.transactionReference || p.paymentNumber || 'UTR-—'}
                        </strong>
                        {p.notes && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.notes}</div>}
                      </td>
                      <td>
                        <strong>{p.vendor?.companyName || p.vendor?.name || p.vendorName || 'Vendor'}</strong>
                      </td>
                      <td>
                        <span className="font-mono">{p.vendorBill?.billNumber || '—'}</span>
                      </td>
                      <td className="text-right font-bold text-success">
                        {formatCurrency(p.amount)}
                      </td>
                      <td>{formatDate(p.paymentDate || p.createdAt)}</td>
                      <td>{p.paymentMethod || 'Bank Transfer'}</td>
                      <td>{p.bankAccount?.bankName || p.bankAccountName || 'Company Bank'}</td>
                      <td>
                        <span className={`fin-badge ${String(p.status || 'completed').toLowerCase()}`}>
                          {p.status || 'Completed'}
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

      {/* ──────────────────────────────────────────────────────────── */}
      {/* MODAL 1: REGISTER VENDOR */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeModal === 'vendor' && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-card" style={{ maxWidth: '640px' }}>
            <div className="fin-modal-header">
              <h3>Register New Vendor in Master</h3>
              <button type="button" className="fin-modal-close" onClick={() => setActiveModal(null)}>×</button>
            </div>
            {modalError && <div className="fin-alert error" style={{ marginBottom: '1rem' }}>{modalError}</div>}
            <form onSubmit={handleCreateVendor}>
              <div className="fin-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Company / Business Name *</label>
                    <input
                      type="text"
                      required
                      value={modalForm.companyName}
                      onChange={(e) => setModalForm({ ...modalForm, companyName: e.target.value })}
                      placeholder="e.g. AWS Cloud Services Ltd"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Contact Person Name *</label>
                    <input
                      type="text"
                      required
                      value={modalForm.name}
                      onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })}
                      placeholder="e.g. Rajesh Kumar"
                    />
                  </div>
                </div>

                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Vendor Category</label>
                    <select
                      value={modalForm.category}
                      onChange={(e) => setModalForm({ ...modalForm, category: e.target.value })}
                    >
                      <option value="Software & IT">Software & IT</option>
                      <option value="Hardware & Infrastructure">Hardware & Infrastructure</option>
                      <option value="Office Operations">Office Operations</option>
                      <option value="Legal & Professional">Legal & Professional</option>
                      <option value="Marketing & Advertising">Marketing & Advertising</option>
                      <option value="Utilities">Utilities</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                  <div className="fin-form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      value={modalForm.email}
                      onChange={(e) => setModalForm({ ...modalForm, email: e.target.value })}
                      placeholder="billing@vendor.com"
                    />
                  </div>
                </div>

                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Phone Number</label>
                    <input
                      type="text"
                      value={modalForm.phone}
                      onChange={(e) => setModalForm({ ...modalForm, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>GSTIN</label>
                    <input
                      type="text"
                      value={modalForm.gstin}
                      onChange={(e) => setModalForm({ ...modalForm, gstin: e.target.value })}
                      placeholder="27AAAAA0000A1Z5"
                    />
                  </div>
                </div>

                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>PAN Number</label>
                    <input
                      type="text"
                      value={modalForm.pan}
                      onChange={(e) => setModalForm({ ...modalForm, pan: e.target.value })}
                      placeholder="ABCDE1234F"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Office Address</label>
                    <input
                      type="text"
                      value={modalForm.address}
                      onChange={(e) => setModalForm({ ...modalForm, address: e.target.value })}
                      placeholder="City, State, Country"
                    />
                  </div>
                </div>

                <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: '#0f172a' }}>
                  Bank Details for Disbursals:
                </div>
                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Bank Name</label>
                    <input
                      type="text"
                      value={modalForm.bankName}
                      onChange={(e) => setModalForm({ ...modalForm, bankName: e.target.value })}
                      placeholder="e.g. HDFC Bank"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Bank Account Number</label>
                    <input
                      type="text"
                      value={modalForm.accountNumber}
                      onChange={(e) => setModalForm({ ...modalForm, accountNumber: e.target.value })}
                      placeholder="Account number"
                    />
                  </div>
                </div>
                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>IFSC Code</label>
                    <input
                      type="text"
                      value={modalForm.ifscCode}
                      onChange={(e) => setModalForm({ ...modalForm, ifscCode: e.target.value })}
                      placeholder="e.g. HDFC0001234"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Beneficiary Name</label>
                    <input
                      type="text"
                      value={modalForm.beneficiaryName}
                      onChange={(e) => setModalForm({ ...modalForm, beneficiaryName: e.target.value })}
                      placeholder="Name on bank account"
                    />
                  </div>
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="fin-btn-primary" disabled={modalLoading}>
                  {modalLoading ? 'Saving...' : 'Register Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* MODAL 2: ADD VENDOR BILL */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeModal === 'bill' && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-card" style={{ maxWidth: '580px' }}>
            <div className="fin-modal-header">
              <h3>Create New Vendor Bill</h3>
              <button type="button" className="fin-modal-close" onClick={() => setActiveModal(null)}>×</button>
            </div>
            {modalError && <div className="fin-alert error" style={{ marginBottom: '1rem' }}>{modalError}</div>}
            <form onSubmit={handleCreateBill}>
              <div className="fin-modal-body">
                <div className="fin-form-group">
                  <label>Select Vendor *</label>
                  <select
                    required
                    value={modalForm.vendor}
                    onChange={(e) => {
                      const v = vendors.find((vend) => vend._id === e.target.value);
                      setModalForm({
                        ...modalForm,
                        vendor: e.target.value,
                        category: v?.category || modalForm.category,
                      });
                    }}
                  >
                    <option value="">-- Choose Vendor --</option>
                    {vendors.map((v) => (
                      <option key={v._id} value={v._id}>{v.companyName || v.name} ({v.category})</option>
                    ))}
                  </select>
                </div>

                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Bill / Invoice Number *</label>
                    <input
                      type="text"
                      required
                      value={modalForm.billNumber}
                      onChange={(e) => setModalForm({ ...modalForm, billNumber: e.target.value })}
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Category</label>
                    <select
                      value={modalForm.category}
                      onChange={(e) => setModalForm({ ...modalForm, category: e.target.value })}
                    >
                      <option value="Software & IT">Software & IT</option>
                      <option value="Hardware & Infrastructure">Hardware & Infrastructure</option>
                      <option value="Office Operations">Office Operations</option>
                      <option value="Legal & Professional">Legal & Professional</option>
                      <option value="Marketing & Advertising">Marketing & Advertising</option>
                      <option value="Utilities">Utilities</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                </div>

                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Bill Date *</label>
                    <input
                      type="date"
                      required
                      value={modalForm.billDate}
                      onChange={(e) => setModalForm({ ...modalForm, billDate: e.target.value })}
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Due Date *</label>
                    <input
                      type="date"
                      required
                      value={modalForm.dueDate}
                      onChange={(e) => setModalForm({ ...modalForm, dueDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Base Amount (INR) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={modalForm.amount}
                      onChange={(e) => setModalForm({ ...modalForm, amount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Tax / GST (INR)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={modalForm.tax}
                      onChange={(e) => setModalForm({ ...modalForm, tax: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="fin-form-group">
                  <label>Total Bill Amount</label>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', padding: '0.4rem 0' }}>
                    {formatCurrency((Number(modalForm.amount) || 0) + (Number(modalForm.tax) || 0))}
                  </div>
                </div>

                <div className="fin-form-group">
                  <label>Description / Line Items</label>
                  <textarea
                    rows="2"
                    value={modalForm.description}
                    onChange={(e) => setModalForm({ ...modalForm, description: e.target.value })}
                    placeholder="Brief description of goods or services"
                  />
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="fin-btn-primary" disabled={modalLoading}>
                  {modalLoading ? 'Creating...' : 'Create Vendor Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* MODAL 3: PAY VENDOR BILL */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeModal === 'pay' && selectedBill && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-card" style={{ maxWidth: '540px' }}>
            <div className="fin-modal-header">
              <h3>Disburse Vendor Payment</h3>
              <button type="button" className="fin-modal-close" onClick={() => setActiveModal(null)}>×</button>
            </div>
            {modalError && <div className="fin-alert error" style={{ marginBottom: '1rem' }}>{modalError}</div>}
            <form onSubmit={handleDisbursePayment}>
              <div className="fin-modal-body">
                <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#64748b' }}>Vendor:</span>
                    <strong>{selectedBill.vendorName || selectedBill.vendor?.companyName}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#64748b' }}>Bill Number:</span>
                    <span className="font-mono">{selectedBill.billNumber}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#64748b' }}>Total Bill:</span>
                    <span>{formatCurrency(selectedBill.totalAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Outstanding Balance:</span>
                    <strong style={{ color: '#ea580c' }}>{formatCurrency(selectedBill.balance)}</strong>
                  </div>
                </div>

                <div className="fin-form-group">
                  <label>Disbursement Amount (INR) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={selectedBill.balance}
                    step="any"
                    value={modalForm.amount}
                    onChange={(e) => setModalForm({ ...modalForm, amount: e.target.value })}
                  />
                  <small style={{ color: '#64748b' }}>You can pay the full balance or a partial amount</small>
                </div>

                <div className="fin-form-group">
                  <label>Debit From Company Bank Account *</label>
                  <select
                    required
                    value={modalForm.bankAccountId}
                    onChange={(e) => setModalForm({ ...modalForm, bankAccountId: e.target.value })}
                  >
                    <option value="">-- Select Bank Account --</option>
                    {bankAccounts.map((acc) => (
                      <option key={acc._id} value={acc._id}>
                        {acc.bankName} - {acc.accountName} (Balance: {formatCurrency(acc.currentBalance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="fin-form-grid-2">
                  <div className="fin-form-group">
                    <label>Payment Method</label>
                    <select
                      value={modalForm.paymentMethod}
                      onChange={(e) => setModalForm({ ...modalForm, paymentMethod: e.target.value })}
                    >
                      <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                      <option value="UPI">UPI</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Corporate Card">Corporate Card</option>
                      <option value="Cash">Cash / Petty Cash</option>
                    </select>
                  </div>
                  <div className="fin-form-group">
                    <label>Transaction / UTR Reference</label>
                    <input
                      type="text"
                      value={modalForm.transactionReference}
                      onChange={(e) => setModalForm({ ...modalForm, transactionReference: e.target.value })}
                      placeholder="e.g. UTR12345678"
                    />
                  </div>
                </div>

                <div className="fin-form-group">
                  <label>Notes / Remarks</label>
                  <input
                    type="text"
                    value={modalForm.notes}
                    onChange={(e) => setModalForm({ ...modalForm, notes: e.target.value })}
                    placeholder="Disbursal notes"
                  />
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="fin-btn-primary" disabled={modalLoading}>
                  {modalLoading ? 'Processing...' : `Disburse ${formatCurrency(modalForm.amount)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
