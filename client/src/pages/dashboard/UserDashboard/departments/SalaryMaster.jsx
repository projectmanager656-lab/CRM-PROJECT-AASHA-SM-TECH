import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../../../services/apiClient';

export default function SalaryMaster({
  formatCurrency,
  formatDate,
  user,
  isFinanceAdmin,
  onRefresh,
}) {
  const [activeSubTab, setActiveSubTab] = useState('structure'); // 'structure' | 'advance' | 'extra' | 'history'

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Salary Structure State
  const [employees, setEmployees] = useState([]);
  const [empSearch, setEmpSearch] = useState('');
  const [empDeptFilter, setEmpDeptFilter] = useState('All');

  // 2. Salary Advance State
  const [advances, setAdvances] = useState([]);
  const [advanceSummary, setAdvanceSummary] = useState(null);
  const [advSearch, setAdvSearch] = useState('');
  const [advStatusFilter, setAdvStatusFilter] = useState('All');

  // 3. Extra Salary State
  const [extraSalaries, setExtraSalaries] = useState([]);
  const [extraSummary, setExtraSummary] = useState(null);
  const [extraSearch, setExtraSearch] = useState('');
  const [extraTypeFilter, setExtraTypeFilter] = useState('All');
  const [extraStatusFilter, setExtraStatusFilter] = useState('All');

  // 4. Salary History State
  const [history, setHistory] = useState([]);
  const [historySummary, setHistorySummary] = useState(null);
  const [histTypeFilter, setHistTypeFilter] = useState('All');
  const [histStartDate, setHistStartDate] = useState('');
  const [histEndDate, setHistEndDate] = useState('');

  // Bank accounts for disbursement modals
  const [bankAccounts, setBankAccounts] = useState([]);

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'editStructure' | 'requestAdvance' | 'approveAdvance' | 'disburseAdvance' | 'createExtra' | 'approveExtra' | 'disburseExtra' | 'advanceDetail'
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalForm, setModalForm] = useState({});
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 5000);
  };

  // Fetch Bank Accounts for dropdowns
  useEffect(() => {
    apiClient
      .get('/finance/bank-accounts')
      .then((res) => {
        setBankAccounts(res.data?.data || []);
      })
      .catch(() => {});
  }, []);

  // Fetch Sub-Tab Data On Tab Change
  const fetchSubTabData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      if (activeSubTab === 'structure') {
        const res = await apiClient.get('/finance/salary/employees');
        setEmployees(res.data?.data || []);
      } else if (activeSubTab === 'advance') {
        const res = await apiClient.get('/finance/salary/advances');
        setAdvances(res.data?.data?.advances || []);
        setAdvanceSummary(res.data?.data?.summary || null);
      } else if (activeSubTab === 'extra') {
        const res = await apiClient.get('/finance/salary/extra');
        setExtraSalaries(res.data?.data?.extraSalaries || []);
        setExtraSummary(res.data?.data?.summary || null);
      } else if (activeSubTab === 'history') {
        let url = '/finance/salary/history?';
        if (histStartDate) url += `startDate=${histStartDate}&`;
        if (histEndDate) url += `endDate=${histEndDate}&`;
        if (histTypeFilter !== 'All') url += `type=${histTypeFilter}&`;
        const res = await apiClient.get(url);
        setHistory(res.data?.data?.history || []);
        setHistorySummary(res.data?.data?.summary || null);
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to load salary module data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubTabData();
  }, [activeSubTab, histStartDate, histEndDate, histTypeFilter]);

  // Filtered Employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesDept = empDeptFilter === 'All' || emp.department === empDeptFilter;
      const matchesSearch =
        !empSearch ||
        emp.name?.toLowerCase().includes(empSearch.toLowerCase()) ||
        emp.email?.toLowerCase().includes(empSearch.toLowerCase()) ||
        emp.employeeId?.toLowerCase().includes(empSearch.toLowerCase()) ||
        emp.designation?.toLowerCase().includes(empSearch.toLowerCase());
      return matchesDept && matchesSearch;
    });
  }, [employees, empDeptFilter, empSearch]);

  // Unique departments for filter dropdown
  const uniqueDepts = useMemo(() => {
    const set = new Set(employees.map((e) => e.department).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [employees]);

  // Filtered Advances
  const filteredAdvances = useMemo(() => {
    return advances.filter((adv) => {
      const matchesStatus = advStatusFilter === 'All' || adv.status === advStatusFilter;
      const matchesSearch =
        !advSearch ||
        adv.advanceNumber?.toLowerCase().includes(advSearch.toLowerCase()) ||
        adv.employeeName?.toLowerCase().includes(advSearch.toLowerCase()) ||
        adv.employeeId?.toLowerCase().includes(advSearch.toLowerCase()) ||
        adv.reason?.toLowerCase().includes(advSearch.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [advances, advStatusFilter, advSearch]);

  // Filtered Extra Salaries
  const filteredExtraSalaries = useMemo(() => {
    return extraSalaries.filter((item) => {
      const matchesType = extraTypeFilter === 'All' || item.type === extraTypeFilter;
      const matchesStatus = extraStatusFilter === 'All' || item.status === extraStatusFilter;
      const matchesSearch =
        !extraSearch ||
        item.extraSalaryNumber?.toLowerCase().includes(extraSearch.toLowerCase()) ||
        item.employeeName?.toLowerCase().includes(extraSearch.toLowerCase()) ||
        item.employeeId?.toLowerCase().includes(extraSearch.toLowerCase()) ||
        item.reason?.toLowerCase().includes(extraSearch.toLowerCase());
      return matchesType && matchesStatus && matchesSearch;
    });
  }, [extraSalaries, extraTypeFilter, extraStatusFilter, extraSearch]);

  // Open Edit Structure Modal
  const openEditStructure = (emp) => {
    setSelectedItem(emp);
    setModalForm({
      basicSalary: emp.salaryStructure?.basicSalary || 0,
      allowances: emp.salaryStructure?.allowances || 0,
      bonus: emp.salaryStructure?.bonus || 0,
      deductions: emp.salaryStructure?.deductions || 0,
      accountHolderName: emp.bankDetails?.accountHolderName || emp.name,
      bankName: emp.bankDetails?.bankName || '',
      accountNumber: emp.bankDetails?.rawAccountNumber || '',
      ifscCode: emp.bankDetails?.ifscCode || '',
      branchName: emp.bankDetails?.branchName || '',
    });
    setModalError('');
    setActiveModal('editStructure');
  };

  // Submit Structure Edit
  const handleSaveStructure = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');
    try {
      await apiClient.put(`/finance/salary/employees/${selectedItem._id}`, {
        basicSalary: Number(modalForm.basicSalary) || 0,
        allowances: Number(modalForm.allowances) || 0,
        bonus: Number(modalForm.bonus) || 0,
        deductions: Number(modalForm.deductions) || 0,
        bankDetails: {
          accountHolderName: modalForm.accountHolderName,
          bankName: modalForm.bankName,
          accountNumber: modalForm.accountNumber,
          ifscCode: modalForm.ifscCode,
          branchName: modalForm.branchName,
        },
      });
      showSuccess('Salary structure updated successfully');
      setActiveModal(null);
      fetchSubTabData();
      if (onRefresh) onRefresh();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to update salary structure');
    } finally {
      setModalLoading(false);
    }
  };

  // Open Request Advance Modal
  const openRequestAdvance = () => {
    setModalForm({
      employeeId: employees[0]?._id || '',
      requestedAmount: '',
      totalInstallments: 1,
      monthlyDeduction: '',
      reason: '',
      urgency: 'Normal',
    });
    setModalError('');
    setActiveModal('requestAdvance');
  };

  // Submit Request Advance
  const handleCreateAdvance = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');
    try {
      await apiClient.post('/finance/salary/advances', {
        employeeId: modalForm.employeeId,
        requestedAmount: Number(modalForm.requestedAmount),
        totalInstallments: Number(modalForm.totalInstallments) || 1,
        monthlyDeduction: modalForm.monthlyDeduction ? Number(modalForm.monthlyDeduction) : undefined,
        reason: modalForm.reason,
        urgency: modalForm.urgency,
      });
      showSuccess('Salary advance request submitted successfully');
      setActiveModal(null);
      fetchSubTabData();
      if (onRefresh) onRefresh();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to request salary advance');
    } finally {
      setModalLoading(false);
    }
  };

  // Open Approve Advance Modal
  const openApproveAdvance = (adv) => {
    setSelectedItem(adv);
    setModalForm({
      status: 'Approved',
      approvedAmount: adv.requestedAmount,
      totalInstallments: adv.totalInstallments || 1,
      monthlyDeduction: adv.monthlyDeduction || adv.requestedAmount,
      remarks: '',
    });
    setModalError('');
    setActiveModal('approveAdvance');
  };

  // Submit Approve/Reject Advance
  const handleApproveAdvance = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');
    try {
      await apiClient.post(`/finance/salary/advances/${selectedItem._id}/approve`, {
        status: modalForm.status,
        approvedAmount: Number(modalForm.approvedAmount),
        totalInstallments: Number(modalForm.totalInstallments) || 1,
        monthlyDeduction: Number(modalForm.monthlyDeduction),
        remarks: modalForm.remarks,
      });
      showSuccess(`Salary advance ${modalForm.status.toLowerCase()} successfully`);
      setActiveModal(null);
      fetchSubTabData();
      if (onRefresh) onRefresh();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to process advance approval');
    } finally {
      setModalLoading(false);
    }
  };

  // Open Disburse Advance Modal
  const openDisburseAdvance = (adv) => {
    setSelectedItem(adv);
    setModalForm({
      bankAccountId: bankAccounts[0]?._id || '',
      paymentMethod: 'Bank Transfer',
      paymentReference: '',
      remarks: '',
    });
    setModalError('');
    setActiveModal('disburseAdvance');
  };

  // Submit Disburse Advance
  const handleDisburseAdvance = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');
    try {
      await apiClient.post(`/finance/salary/advances/${selectedItem._id}/disburse`, {
        bankAccountId: modalForm.bankAccountId,
        paymentMethod: modalForm.paymentMethod,
        paymentReference: modalForm.paymentReference,
        remarks: modalForm.remarks,
      });
      showSuccess(`Salary advance disbursed successfully. Linked to Bank Account.`);
      setActiveModal(null);
      fetchSubTabData();
      if (onRefresh) onRefresh();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to disburse advance');
    } finally {
      setModalLoading(false);
    }
  };

  // Open Create Extra Salary Modal
  const openCreateExtra = () => {
    const now = new Date();
    setModalForm({
      employeeId: employees[0]?._id || '',
      type: 'Bonus',
      amount: '',
      periodMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      reason: '',
    });
    setModalError('');
    setActiveModal('createExtra');
  };

  // Submit Create Extra Salary
  const handleCreateExtra = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');
    try {
      await apiClient.post('/finance/salary/extra', {
        employeeId: modalForm.employeeId,
        type: modalForm.type,
        amount: Number(modalForm.amount),
        periodMonth: modalForm.periodMonth,
        reason: modalForm.reason,
      });
      showSuccess('Extra salary entry created successfully');
      setActiveModal(null);
      fetchSubTabData();
      if (onRefresh) onRefresh();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to create extra salary');
    } finally {
      setModalLoading(false);
    }
  };

  // Open Approve Extra Salary Modal
  const openApproveExtra = (item) => {
    setSelectedItem(item);
    setModalForm({
      status: 'Approved',
      remarks: '',
    });
    setModalError('');
    setActiveModal('approveExtra');
  };

  // Submit Approve Extra Salary
  const handleApproveExtra = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');
    try {
      await apiClient.post(`/finance/salary/extra/${selectedItem._id}/approve`, {
        status: modalForm.status,
        remarks: modalForm.remarks,
      });
      showSuccess(`Extra salary ${modalForm.status.toLowerCase()} successfully`);
      setActiveModal(null);
      fetchSubTabData();
      if (onRefresh) onRefresh();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to process approval');
    } finally {
      setModalLoading(false);
    }
  };

  // Open Disburse Extra Salary Modal
  const openDisburseExtra = (item) => {
    setSelectedItem(item);
    setModalForm({
      bankAccountId: bankAccounts[0]?._id || '',
      paymentMethod: 'Bank Transfer',
      paymentReference: '',
      remarks: '',
    });
    setModalError('');
    setActiveModal('disburseExtra');
  };

  // Submit Disburse Extra Salary
  const handleDisburseExtra = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');
    try {
      await apiClient.post(`/finance/salary/extra/${selectedItem._id}/disburse`, {
        bankAccountId: modalForm.bankAccountId,
        paymentMethod: modalForm.paymentMethod,
        paymentReference: modalForm.paymentReference,
        remarks: modalForm.remarks,
      });
      showSuccess(`Extra salary disbursed successfully. Linked to Bank Account.`);
      setActiveModal(null);
      fetchSubTabData();
      if (onRefresh) onRefresh();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to disburse extra salary');
    } finally {
      setModalLoading(false);
    }
  };

  // CSV Export for History
  const exportHistoryCSV = () => {
    if (!history.length) return alert('No history data to export');
    const headers = ['Date', 'Record Type', 'Reference', 'Employee Name', 'Employee ID', 'Description', 'Amount', 'Payment Method', 'Status', 'Disbursed By'];
    const rows = history.map((h) => [
      formatDate(h.date),
      `"${h.recordType}"`,
      `"${h.reference}"`,
      `"${h.employeeName}"`,
      `"${h.employeeId}"`,
      `"${h.description}"`,
      h.amount,
      `"${h.paymentMethod}"`,
      `"${h.status}"`,
      `"${h.disbursedByName || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `salary_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fin-salary-master-container">
      {/* Alert Banners */}
      {successMsg && <div className="fin-alert success">{successMsg}</div>}
      {errorMsg && <div className="fin-alert error">{errorMsg}</div>}

      {/* Sub-Tabs Navigation */}
      <div className="fin-subtab-nav">
        {[
          { key: 'structure', label: '1. Salary Management', icon: '👤' },
          { key: 'advance', label: '2. Salary Advance', icon: '💸' },
          { key: 'extra', label: '3. Extra Salary', icon: '✨' },
          { key: 'history', label: '4. Salary History / Transactions', icon: '📜' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`fin-subtab-btn ${activeSubTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveSubTab(tab.key)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 1: SALARY MANAGEMENT */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeSubTab === 'structure' && (
        <div className="fin-salary-subcontent">
          <div className="fin-table-toolbar">
            <input
              type="text"
              placeholder="Search employee by name, ID, designation, email..."
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
              className="fin-search-input"
            />
            <select
              value={empDeptFilter}
              onChange={(e) => setEmpDeptFilter(e.target.value)}
              className="fin-filter-select"
            >
              {uniqueDepts.map((d) => (
                <option key={d} value={d}>
                  {d === 'All' ? 'All Departments' : d}
                </option>
              ))}
            </select>
            <span className="fin-toolbar-count">
              Showing <strong>{filteredEmployees.length}</strong> active employees
            </span>
          </div>

          <div className="fin-responsive-table-wrapper">
            <table className="fin-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department & Designation</th>
                  <th style={{ textAlign: 'right' }}>Basic Salary</th>
                  <th style={{ textAlign: 'right' }}>Allowances</th>
                  <th style={{ textAlign: 'right' }}>Deductions</th>
                  <th style={{ textAlign: 'right' }}>Net Salary</th>
                  <th>Bank Account</th>
                  <th style={{ textAlign: 'right' }}>Active Advance</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="fin-empty-cell">
                      {loading ? 'Loading employee salary structures...' : 'No employees found matching filter'}
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp._id}>
                      <td>
                        <div className="fin-cell-bold">{emp.name}</div>
                        <div className="fin-cell-sub">{emp.employeeId} • {emp.email}</div>
                      </td>
                      <td>
                        <div>{emp.department}</div>
                        <div className="fin-cell-sub">{emp.designation}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(emp.salaryStructure?.basicSalary)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(emp.salaryStructure?.allowances)}</td>
                      <td style={{ textAlign: 'right', color: '#ef4444' }}>
                        {emp.salaryStructure?.deductions ? `- ${formatCurrency(emp.salaryStructure.deductions)}` : '₹0'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '700', color: '#10b981' }}>
                        {formatCurrency(emp.salaryStructure?.netSalary)}
                      </td>
                      <td>
                        <div>{emp.bankDetails?.bankName || 'Not Set'}</div>
                        <div className="fin-cell-sub">{emp.bankDetails?.accountNumber}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {emp.outstandingAdvance > 0 ? (
                          <span className="fin-badge warning">{formatCurrency(emp.outstandingAdvance)}</span>
                        ) : (
                          <span className="fin-cell-sub">None</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isFinanceAdmin ? (
                          <button
                            type="button"
                            className="fin-action-btn small"
                            onClick={() => openEditStructure(emp)}
                          >
                            Edit Structure
                          </button>
                        ) : (
                          <span className="fin-badge neutral" title="Requires Finance Admin privileges">Read Only</span>
                        )}
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
      {/* SUB-TAB 2: SALARY ADVANCE */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeSubTab === 'advance' && (
        <div className="fin-salary-subcontent">
          {/* Metrics summary */}
          {advanceSummary && (
            <div className="fin-mini-kpi-grid">
              <div className="fin-mini-kpi-card">
                <span className="fin-mini-kpi-label">Total Requested</span>
                <span className="fin-mini-kpi-val">{formatCurrency(advanceSummary.totalRequested)}</span>
              </div>
              <div className="fin-mini-kpi-card">
                <span className="fin-mini-kpi-label">Total Approved</span>
                <span className="fin-mini-kpi-val" style={{ color: '#3b82f6' }}>{formatCurrency(advanceSummary.totalApproved)}</span>
              </div>
              <div className="fin-mini-kpi-card">
                <span className="fin-mini-kpi-label">Disbursed (Total Outflow)</span>
                <span className="fin-mini-kpi-val" style={{ color: '#8b5cf6' }}>{formatCurrency(advanceSummary.totalDisbursed)}</span>
              </div>
              <div className="fin-mini-kpi-card">
                <span className="fin-mini-kpi-label">Recovered Via Payroll</span>
                <span className="fin-mini-kpi-val" style={{ color: '#10b981' }}>{formatCurrency(advanceSummary.totalRecovered)}</span>
              </div>
              <div className="fin-mini-kpi-card highlighted">
                <span className="fin-mini-kpi-label">Outstanding Balance</span>
                <span className="fin-mini-kpi-val" style={{ color: '#f59e0b' }}>{formatCurrency(advanceSummary.totalOutstanding)}</span>
              </div>
            </div>
          )}

          <div className="fin-table-toolbar">
            <input
              type="text"
              placeholder="Search by advance number, employee name, reason..."
              value={advSearch}
              onChange={(e) => setAdvSearch(e.target.value)}
              className="fin-search-input"
            />
            <select
              value={advStatusFilter}
              onChange={(e) => setAdvStatusFilter(e.target.value)}
              className="fin-filter-select"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending Approval</option>
              <option value="Approved">Approved (Awaiting Disbursal)</option>
              <option value="Disbursed">Disbursed</option>
              <option value="In Recovery">In Recovery</option>
              <option value="Fully Recovered">Fully Recovered</option>
              <option value="Rejected">Rejected</option>
            </select>
            <button
              type="button"
              className="fin-action-btn primary"
              onClick={openRequestAdvance}
            >
              + Request Salary Advance
            </button>
          </div>

          <div className="fin-responsive-table-wrapper">
            <table className="fin-table">
              <thead>
                <tr>
                  <th>Advance No</th>
                  <th>Employee</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Requested</th>
                  <th style={{ textAlign: 'right' }}>Approved</th>
                  <th style={{ textAlign: 'right' }}>Monthly Deduction</th>
                  <th style={{ textAlign: 'right' }}>Recovered</th>
                  <th style={{ textAlign: 'right' }}>Balance Due</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdvances.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="fin-empty-cell">
                      {loading ? 'Loading salary advances...' : 'No salary advances found'}
                    </td>
                  </tr>
                ) : (
                  filteredAdvances.map((adv) => (
                    <tr key={adv._id}>
                      <td className="fin-cell-bold">{adv.advanceNumber}</td>
                      <td>
                        <div className="fin-cell-bold">{adv.employeeName}</div>
                        <div className="fin-cell-sub">{adv.employeeId} • {adv.department}</div>
                      </td>
                      <td>{formatDate(adv.requestDate)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(adv.requestedAmount)}</td>
                      <td style={{ textAlign: 'right', fontWeight: '600' }}>
                        {adv.approvedAmount ? formatCurrency(adv.approvedAmount) : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {adv.monthlyDeduction ? `${formatCurrency(adv.monthlyDeduction)} / mo` : '—'}
                      </td>
                      <td style={{ textAlign: 'right', color: '#10b981' }}>{formatCurrency(adv.recoveredAmount)}</td>
                      <td style={{ textAlign: 'right', fontWeight: '700', color: adv.balanceOutstanding > 0 ? '#f59e0b' : '#6b7280' }}>
                        {formatCurrency(adv.balanceOutstanding)}
                      </td>
                      <td>
                        <span className={`fin-badge ${
                          adv.status === 'Approved' ? 'info' :
                          adv.status === 'Disbursed' || adv.status === 'In Recovery' ? 'warning' :
                          adv.status === 'Fully Recovered' ? 'success' :
                          adv.status === 'Rejected' ? 'danger' : 'neutral'
                        }`}>
                          {adv.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          {adv.status === 'Pending' && (
                            isFinanceAdmin ? (
                              <button
                                type="button"
                                className="fin-action-btn small primary"
                                onClick={() => openApproveAdvance(adv)}
                              >
                                Review / Approve
                              </button>
                            ) : (
                              <span className="fin-cell-sub">Awaiting Admin</span>
                            )
                          )}
                          {adv.status === 'Approved' && (
                            isFinanceAdmin ? (
                              <button
                                type="button"
                                className="fin-action-btn small success"
                                onClick={() => openDisburseAdvance(adv)}
                              >
                                Disburse
                              </button>
                            ) : (
                              <span className="fin-cell-sub">Approved</span>
                            )
                          )}
                          {adv.status === 'Disbursed' && (
                            <span className="fin-cell-sub" title={adv.paymentReference}>
                              Disbursed ({adv.paymentMethod})
                            </span>
                          )}
                          {adv.status === 'Fully Recovered' && (
                            <span className="fin-cell-sub" style={{ color: '#10b981' }}>✓ Closed</span>
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

      {/* ──────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 3: EXTRA SALARY */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeSubTab === 'extra' && (
        <div className="fin-salary-subcontent">
          {extraSummary && (
            <div className="fin-mini-kpi-grid">
              <div className="fin-mini-kpi-card">
                <span className="fin-mini-kpi-label">Total Bonuses</span>
                <span className="fin-mini-kpi-val" style={{ color: '#10b981' }}>{formatCurrency(extraSummary.totalBonus)}</span>
              </div>
              <div className="fin-mini-kpi-card">
                <span className="fin-mini-kpi-label">Total Incentives</span>
                <span className="fin-mini-kpi-val" style={{ color: '#3b82f6' }}>{formatCurrency(extraSummary.totalIncentive)}</span>
              </div>
              <div className="fin-mini-kpi-card">
                <span className="fin-mini-kpi-label">Total Overtime</span>
                <span className="fin-mini-kpi-val" style={{ color: '#8b5cf6' }}>{formatCurrency(extraSummary.totalOvertime)}</span>
              </div>
              <div className="fin-mini-kpi-card">
                <span className="fin-mini-kpi-label">Paid / Disbursed</span>
                <span className="fin-mini-kpi-val">{formatCurrency(extraSummary.totalPaid)}</span>
              </div>
              <div className="fin-mini-kpi-card highlighted">
                <span className="fin-mini-kpi-label">Pending Disbursement</span>
                <span className="fin-mini-kpi-val" style={{ color: '#f59e0b' }}>{formatCurrency(extraSummary.totalPending)}</span>
              </div>
            </div>
          )}

          <div className="fin-table-toolbar">
            <input
              type="text"
              placeholder="Search extra salary by reference, employee, reason..."
              value={extraSearch}
              onChange={(e) => setExtraSearch(e.target.value)}
              className="fin-search-input"
            />
            <select
              value={extraTypeFilter}
              onChange={(e) => setExtraTypeFilter(e.target.value)}
              className="fin-filter-select"
            >
              <option value="All">All Types</option>
              <option value="Bonus">Bonus</option>
              <option value="Incentive">Incentive</option>
              <option value="Overtime">Overtime</option>
              <option value="Performance Award">Performance Award</option>
              <option value="Special Allowance">Special Allowance</option>
              <option value="Commission">Commission</option>
              <option value="Other">Other</option>
            </select>
            <select
              value={extraStatusFilter}
              onChange={(e) => setExtraStatusFilter(e.target.value)}
              className="fin-filter-select"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending Approval</option>
              <option value="Approved">Approved (Ready to Pay)</option>
              <option value="Paid">Paid</option>
              <option value="Rejected">Rejected</option>
            </select>
            <button
              type="button"
              className="fin-action-btn primary"
              onClick={openCreateExtra}
            >
              + Add Extra Salary Entry
            </button>
          </div>

          <div className="fin-responsive-table-wrapper">
            <table className="fin-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Period</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Reason / Remarks</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExtraSalaries.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="fin-empty-cell">
                      {loading ? 'Loading extra salary entries...' : 'No extra salary entries found'}
                    </td>
                  </tr>
                ) : (
                  filteredExtraSalaries.map((item) => (
                    <tr key={item._id}>
                      <td className="fin-cell-bold">{item.extraSalaryNumber}</td>
                      <td>
                        <div className="fin-cell-bold">{item.employeeName}</div>
                        <div className="fin-cell-sub">{item.employeeId} • {item.department}</div>
                      </td>
                      <td>
                        <span className="fin-badge info">{item.type}</span>
                      </td>
                      <td>{item.periodMonth}</td>
                      <td style={{ textAlign: 'right', fontWeight: '700', color: '#10b981' }}>
                        {formatCurrency(item.amount)}
                      </td>
                      <td>
                        <div style={{ maxWidth: '240px', whiteSpace: 'normal' }}>{item.reason}</div>
                      </td>
                      <td>
                        <span className={`fin-badge ${
                          item.status === 'Paid' ? 'success' :
                          item.status === 'Approved' ? 'info' :
                          item.status === 'Rejected' ? 'danger' : 'neutral'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          {item.status === 'Pending' && (
                            isFinanceAdmin ? (
                              <button
                                type="button"
                                className="fin-action-btn small primary"
                                onClick={() => openApproveExtra(item)}
                              >
                                Approve / Reject
                              </button>
                            ) : (
                              <span className="fin-cell-sub">Pending Review</span>
                            )
                          )}
                          {item.status === 'Approved' && (
                            isFinanceAdmin ? (
                              <button
                                type="button"
                                className="fin-action-btn small success"
                                onClick={() => openDisburseExtra(item)}
                              >
                                Pay / Disburse
                              </button>
                            ) : (
                              <span className="fin-cell-sub">Approved</span>
                            )
                          )}
                          {item.status === 'Paid' && (
                            <span className="fin-cell-sub" style={{ color: '#10b981' }}>
                              ✓ Paid on {formatDate(item.paymentDate)}
                            </span>
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

      {/* ──────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 4: SALARY HISTORY / TRANSACTIONS */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeSubTab === 'history' && (
        <div className="fin-salary-subcontent">
          {historySummary && (
            <div className="fin-mini-kpi-grid">
              <div className="fin-mini-kpi-card">
                <span className="fin-mini-kpi-label">Regular Salary Disbursed</span>
                <span className="fin-mini-kpi-val">{formatCurrency(historySummary.totalSalaryDisbursed)}</span>
              </div>
              <div className="fin-mini-kpi-card">
                <span className="fin-mini-kpi-label">Advances Given</span>
                <span className="fin-mini-kpi-val" style={{ color: '#8b5cf6' }}>{formatCurrency(historySummary.totalAdvancesGiven)}</span>
              </div>
              <div className="fin-mini-kpi-card">
                <span className="fin-mini-kpi-label">Advances Recovered</span>
                <span className="fin-mini-kpi-val" style={{ color: '#10b981' }}>{formatCurrency(historySummary.totalAdvancesRecovered)}</span>
              </div>
              <div className="fin-mini-kpi-card">
                <span className="fin-mini-kpi-label">Extra Salary Paid</span>
                <span className="fin-mini-kpi-val" style={{ color: '#3b82f6' }}>{formatCurrency(historySummary.totalExtraSalaryPaid)}</span>
              </div>
              <div className="fin-mini-kpi-card highlighted">
                <span className="fin-mini-kpi-label">Total Outflows</span>
                <span className="fin-mini-kpi-val" style={{ color: '#ef4444' }}>{formatCurrency(historySummary.totalDisbursements)}</span>
              </div>
            </div>
          )}

          <div className="fin-table-toolbar">
            <select
              value={histTypeFilter}
              onChange={(e) => setHistTypeFilter(e.target.value)}
              className="fin-filter-select"
            >
              <option value="All">All Transaction Types</option>
              <option value="Payroll">Regular Payroll</option>
              <option value="Advance">Salary Advance</option>
              <option value="Extra">Extra Salary</option>
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="fin-cell-sub">From:</span>
              <input
                type="date"
                value={histStartDate}
                onChange={(e) => setHistStartDate(e.target.value)}
                className="fin-date-input"
              />
              <span className="fin-cell-sub">To:</span>
              <input
                type="date"
                value={histEndDate}
                onChange={(e) => setHistEndDate(e.target.value)}
                className="fin-date-input"
              />
            </div>
            <button
              type="button"
              className="fin-action-btn secondary"
              onClick={exportHistoryCSV}
            >
              📥 Export CSV
            </button>
          </div>

          <div className="fin-responsive-table-wrapper">
            <table className="fin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Transaction Type</th>
                  <th>Reference</th>
                  <th>Employee</th>
                  <th>Description</th>
                  <th>Payment Method</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Disbursed By</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="fin-empty-cell">
                      {loading ? 'Loading salary transaction history...' : 'No transactions found'}
                    </td>
                  </tr>
                ) : (
                  history.map((h, i) => (
                    <tr key={i}>
                      <td>{formatDate(h.date)}</td>
                      <td>
                        <span className={`fin-badge ${
                          h.recordType.includes('Advance') ? 'warning' :
                          h.recordType.includes('Extra') ? 'info' : 'primary'
                        }`}>
                          {h.recordType}
                        </span>
                      </td>
                      <td className="fin-cell-bold">{h.reference}</td>
                      <td>
                        <div className="fin-cell-bold">{h.employeeName}</div>
                        <div className="fin-cell-sub">{h.employeeId}</div>
                      </td>
                      <td>
                        <div style={{ maxWidth: '280px', whiteSpace: 'normal' }}>{h.description}</div>
                      </td>
                      <td>{h.paymentMethod}</td>
                      <td style={{ textAlign: 'right', fontWeight: '700', color: '#10b981' }}>
                        {formatCurrency(h.amount)}
                      </td>
                      <td>{h.disbursedByName || 'System'}</td>
                      <td>
                        <span className="fin-badge success">{h.status}</span>
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
      {/* MODALS */}
      {/* ──────────────────────────────────────────────────────────── */}

      {/* 1. Edit Salary Structure Modal */}
      {activeModal === 'editStructure' && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-dialog">
            <div className="fin-modal-header">
              <h3>Edit Salary Structure — {selectedItem?.name}</h3>
              <button type="button" className="fin-modal-close" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <form onSubmit={handleSaveStructure}>
              <div className="fin-modal-body">
                {modalError && <div className="fin-alert error">{modalError}</div>}
                <div className="fin-form-grid">
                  <div className="fin-form-group">
                    <label>Basic Salary (₹ / month) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={modalForm.basicSalary}
                      onChange={(e) => setModalForm({ ...modalForm, basicSalary: e.target.value })}
                      className="fin-form-input"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Allowances (HRA, Special, etc.) (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={modalForm.allowances}
                      onChange={(e) => setModalForm({ ...modalForm, allowances: e.target.value })}
                      className="fin-form-input"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Standard Bonus / Incentive (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={modalForm.bonus}
                      onChange={(e) => setModalForm({ ...modalForm, bonus: e.target.value })}
                      className="fin-form-input"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Standard Deductions (PF, ESI, etc.) (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={modalForm.deductions}
                      onChange={(e) => setModalForm({ ...modalForm, deductions: e.target.value })}
                      className="fin-form-input"
                    />
                  </div>
                </div>

                <div style={{ marginTop: '16px', padding: '12px', background: '#f3f4f6', borderRadius: '6px' }}>
                  <strong>Computed Net Salary: </strong>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#10b981' }}>
                    {formatCurrency(
                      Math.max(
                        0,
                        (Number(modalForm.basicSalary) || 0) +
                        (Number(modalForm.allowances) || 0) +
                        (Number(modalForm.bonus) || 0) -
                        (Number(modalForm.deductions) || 0)
                      )
                    )}
                  </span>
                </div>

                <h4 style={{ margin: '18px 0 10px', fontSize: '0.95rem' }}>Bank & Disbursement Details</h4>
                <div className="fin-form-grid">
                  <div className="fin-form-group">
                    <label>Account Holder Name</label>
                    <input
                      type="text"
                      value={modalForm.accountHolderName}
                      onChange={(e) => setModalForm({ ...modalForm, accountHolderName: e.target.value })}
                      className="fin-form-input"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Bank Name</label>
                    <input
                      type="text"
                      value={modalForm.bankName}
                      onChange={(e) => setModalForm({ ...modalForm, bankName: e.target.value })}
                      className="fin-form-input"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Account Number</label>
                    <input
                      type="text"
                      value={modalForm.accountNumber}
                      onChange={(e) => setModalForm({ ...modalForm, accountNumber: e.target.value })}
                      className="fin-form-input"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>IFSC Code</label>
                    <input
                      type="text"
                      value={modalForm.ifscCode}
                      onChange={(e) => setModalForm({ ...modalForm, ifscCode: e.target.value.toUpperCase() })}
                      className="fin-form-input"
                    />
                  </div>
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-action-btn" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="fin-action-btn primary" disabled={modalLoading}>
                  {modalLoading ? 'Saving...' : 'Save Structure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Request Advance Modal */}
      {activeModal === 'requestAdvance' && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-dialog">
            <div className="fin-modal-header">
              <h3>Request Salary Advance</h3>
              <button type="button" className="fin-modal-close" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <form onSubmit={handleCreateAdvance}>
              <div className="fin-modal-body">
                {modalError && <div className="fin-alert error">{modalError}</div>}
                <div className="fin-form-group">
                  <label>Select Employee *</label>
                  <select
                    required
                    value={modalForm.employeeId}
                    onChange={(e) => setModalForm({ ...modalForm, employeeId: e.target.value })}
                    className="fin-form-input"
                  >
                    {employees.map((e) => (
                      <option key={e._id} value={e._id}>
                        {e.name} ({e.employeeId} - {e.department}) - Basic: {formatCurrency(e.salaryStructure?.basicSalary)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="fin-form-grid">
                  <div className="fin-form-group">
                    <label>Requested Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      min="1000"
                      value={modalForm.requestedAmount}
                      onChange={(e) => {
                        const amt = e.target.value;
                        const inst = Number(modalForm.totalInstallments) || 1;
                        setModalForm({
                          ...modalForm,
                          requestedAmount: amt,
                          monthlyDeduction: amt && inst ? Math.round(Number(amt) / inst) : '',
                        });
                      }}
                      className="fin-form-input"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Recovery Installments (Months) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="24"
                      value={modalForm.totalInstallments}
                      onChange={(e) => {
                        const inst = Number(e.target.value) || 1;
                        const amt = Number(modalForm.requestedAmount) || 0;
                        setModalForm({
                          ...modalForm,
                          totalInstallments: inst,
                          monthlyDeduction: amt ? Math.round(amt / inst) : '',
                        });
                      }}
                      className="fin-form-input"
                    />
                  </div>
                </div>
                <div className="fin-form-grid">
                  <div className="fin-form-group">
                    <label>Monthly Deduction (₹ / month)</label>
                    <input
                      type="number"
                      value={modalForm.monthlyDeduction}
                      onChange={(e) => setModalForm({ ...modalForm, monthlyDeduction: e.target.value })}
                      className="fin-form-input"
                    />
                  </div>
                  <div className="fin-form-group">
                    <label>Urgency Level</label>
                    <select
                      value={modalForm.urgency}
                      onChange={(e) => setModalForm({ ...modalForm, urgency: e.target.value })}
                      className="fin-form-input"
                    >
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical / Emergency</option>
                    </select>
                  </div>
                </div>
                <div className="fin-form-group">
                  <label>Reason for Advance *</label>
                  <textarea
                    required
                    rows="3"
                    value={modalForm.reason}
                    onChange={(e) => setModalForm({ ...modalForm, reason: e.target.value })}
                    className="fin-form-input"
                    placeholder="Provide detailed explanation for the salary advance request..."
                  />
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-action-btn" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="fin-action-btn primary" disabled={modalLoading}>
                  {modalLoading ? 'Submitting...' : 'Submit Advance Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Approve / Reject Advance Modal */}
      {activeModal === 'approveAdvance' && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-dialog">
            <div className="fin-modal-header">
              <h3>Review Advance — {selectedItem?.advanceNumber}</h3>
              <button type="button" className="fin-modal-close" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <form onSubmit={handleApproveAdvance}>
              <div className="fin-modal-body">
                {modalError && <div className="fin-alert error">{modalError}</div>}
                <div style={{ marginBottom: '16px', padding: '12px', background: '#f9fafb', borderRadius: '6px' }}>
                  <div><strong>Employee:</strong> {selectedItem?.employeeName} ({selectedItem?.employeeId})</div>
                  <div><strong>Requested:</strong> {formatCurrency(selectedItem?.requestedAmount)} for {selectedItem?.totalInstallments} months</div>
                  <div><strong>Reason:</strong> {selectedItem?.reason}</div>
                </div>
                <div className="fin-form-group">
                  <label>Approval Action *</label>
                  <select
                    value={modalForm.status}
                    onChange={(e) => setModalForm({ ...modalForm, status: e.target.value })}
                    className="fin-form-input"
                  >
                    <option value="Approved">Approve Request</option>
                    <option value="Rejected">Reject Request</option>
                  </select>
                </div>
                {modalForm.status === 'Approved' && (
                  <div className="fin-form-grid">
                    <div className="fin-form-group">
                      <label>Approved Amount (₹) *</label>
                      <input
                        type="number"
                        required
                        min="1000"
                        value={modalForm.approvedAmount}
                        onChange={(e) => setModalForm({ ...modalForm, approvedAmount: e.target.value })}
                        className="fin-form-input"
                      />
                    </div>
                    <div className="fin-form-group">
                      <label>Monthly Deduction (₹) *</label>
                      <input
                        type="number"
                        required
                        min="100"
                        value={modalForm.monthlyDeduction}
                        onChange={(e) => setModalForm({ ...modalForm, monthlyDeduction: e.target.value })}
                        className="fin-form-input"
                      />
                    </div>
                  </div>
                )}
                <div className="fin-form-group">
                  <label>Remarks / Notes</label>
                  <textarea
                    rows="2"
                    value={modalForm.remarks}
                    onChange={(e) => setModalForm({ ...modalForm, remarks: e.target.value })}
                    className="fin-form-input"
                    placeholder="Enter approval conditions or rejection reason..."
                  />
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-action-btn" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className={`fin-action-btn ${modalForm.status === 'Approved' ? 'primary' : 'danger'}`} disabled={modalLoading}>
                  {modalLoading ? 'Processing...' : modalForm.status === 'Approved' ? 'Confirm Approval' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Disburse Advance Modal */}
      {activeModal === 'disburseAdvance' && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-dialog">
            <div className="fin-modal-header">
              <h3>Disburse Advance — {selectedItem?.advanceNumber}</h3>
              <button type="button" className="fin-modal-close" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <form onSubmit={handleDisburseAdvance}>
              <div className="fin-modal-body">
                {modalError && <div className="fin-alert error">{modalError}</div>}
                <div style={{ marginBottom: '16px', padding: '12px', background: '#ecfdf5', borderRadius: '6px' }}>
                  <div><strong>Disbursing to:</strong> {selectedItem?.employeeName}</div>
                  <div><strong>Approved Amount:</strong> <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '1.1rem' }}>{formatCurrency(selectedItem?.approvedAmount)}</span></div>
                  <div><strong>Monthly Recovery:</strong> {formatCurrency(selectedItem?.monthlyDeduction)} / month</div>
                </div>

                <div className="fin-form-group">
                  <label>Disburse From Bank Account *</label>
                  <select
                    required
                    value={modalForm.bankAccountId}
                    onChange={(e) => setModalForm({ ...modalForm, bankAccountId: e.target.value })}
                    className="fin-form-input"
                  >
                    {bankAccounts.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.bankName} - {b.accountName} (Balance: {formatCurrency(b.currentBalance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="fin-form-grid">
                  <div className="fin-form-group">
                    <label>Payment Method *</label>
                    <select
                      value={modalForm.paymentMethod}
                      onChange={(e) => setModalForm({ ...modalForm, paymentMethod: e.target.value })}
                      className="fin-form-input"
                    >
                      <option value="Bank Transfer">Bank Transfer / NEFT / IMPS</option>
                      <option value="UPI">UPI</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>
                  <div className="fin-form-group">
                    <label>Transaction / UTR Reference</label>
                    <input
                      type="text"
                      placeholder="e.g. UTR-98234101"
                      value={modalForm.paymentReference}
                      onChange={(e) => setModalForm({ ...modalForm, paymentReference: e.target.value })}
                      className="fin-form-input"
                    />
                  </div>
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-action-btn" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="fin-action-btn success" disabled={modalLoading}>
                  {modalLoading ? 'Disbursing...' : 'Confirm & Disburse Funds'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Create Extra Salary Modal */}
      {activeModal === 'createExtra' && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-dialog">
            <div className="fin-modal-header">
              <h3>Add Extra Salary / Incentive / Bonus</h3>
              <button type="button" className="fin-modal-close" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <form onSubmit={handleCreateExtra}>
              <div className="fin-modal-body">
                {modalError && <div className="fin-alert error">{modalError}</div>}
                <div className="fin-form-group">
                  <label>Select Employee *</label>
                  <select
                    required
                    value={modalForm.employeeId}
                    onChange={(e) => setModalForm({ ...modalForm, employeeId: e.target.value })}
                    className="fin-form-input"
                  >
                    {employees.map((e) => (
                      <option key={e._id} value={e._id}>
                        {e.name} ({e.employeeId} - {e.department})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="fin-form-grid">
                  <div className="fin-form-group">
                    <label>Extra Salary Type *</label>
                    <select
                      value={modalForm.type}
                      onChange={(e) => setModalForm({ ...modalForm, type: e.target.value })}
                      className="fin-form-input"
                    >
                      <option value="Bonus">Bonus</option>
                      <option value="Incentive">Incentive</option>
                      <option value="Overtime">Overtime</option>
                      <option value="Performance Award">Performance Award</option>
                      <option value="Special Allowance">Special Allowance</option>
                      <option value="Commission">Commission</option>
                      <option value="Arrears">Arrears</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="fin-form-group">
                    <label>Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={modalForm.amount}
                      onChange={(e) => setModalForm({ ...modalForm, amount: e.target.value })}
                      className="fin-form-input"
                    />
                  </div>
                </div>
                <div className="fin-form-group">
                  <label>Applicable Period (YYYY-MM) *</label>
                  <input
                    type="month"
                    required
                    value={modalForm.periodMonth}
                    onChange={(e) => setModalForm({ ...modalForm, periodMonth: e.target.value })}
                    className="fin-form-input"
                  />
                </div>
                <div className="fin-form-group">
                  <label>Reason / Justification *</label>
                  <textarea
                    required
                    rows="3"
                    value={modalForm.reason}
                    onChange={(e) => setModalForm({ ...modalForm, reason: e.target.value })}
                    className="fin-form-input"
                    placeholder="Enter reason for bonus, metric achieved, or overtime hours..."
                  />
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-action-btn" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="fin-action-btn primary" disabled={modalLoading}>
                  {modalLoading ? 'Saving...' : 'Create Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Approve Extra Salary Modal */}
      {activeModal === 'approveExtra' && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-dialog">
            <div className="fin-modal-header">
              <h3>Review Extra Salary — {selectedItem?.extraSalaryNumber}</h3>
              <button type="button" className="fin-modal-close" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <form onSubmit={handleApproveExtra}>
              <div className="fin-modal-body">
                {modalError && <div className="fin-alert error">{modalError}</div>}
                <div style={{ marginBottom: '16px', padding: '12px', background: '#f9fafb', borderRadius: '6px' }}>
                  <div><strong>Employee:</strong> {selectedItem?.employeeName}</div>
                  <div><strong>Type:</strong> {selectedItem?.type}</div>
                  <div><strong>Amount:</strong> <span style={{ color: '#10b981', fontWeight: 'bold' }}>{formatCurrency(selectedItem?.amount)}</span></div>
                  <div><strong>Period:</strong> {selectedItem?.periodMonth}</div>
                  <div><strong>Reason:</strong> {selectedItem?.reason}</div>
                </div>
                <div className="fin-form-group">
                  <label>Approval Action *</label>
                  <select
                    value={modalForm.status}
                    onChange={(e) => setModalForm({ ...modalForm, status: e.target.value })}
                    className="fin-form-input"
                  >
                    <option value="Approved">Approve Entry</option>
                    <option value="Rejected">Reject Entry</option>
                  </select>
                </div>
                <div className="fin-form-group">
                  <label>Remarks</label>
                  <textarea
                    rows="2"
                    value={modalForm.remarks}
                    onChange={(e) => setModalForm({ ...modalForm, remarks: e.target.value })}
                    className="fin-form-input"
                  />
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-action-btn" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className={`fin-action-btn ${modalForm.status === 'Approved' ? 'primary' : 'danger'}`} disabled={modalLoading}>
                  {modalLoading ? 'Saving...' : `Confirm ${modalForm.status}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Disburse Extra Salary Modal */}
      {activeModal === 'disburseExtra' && (
        <div className="fin-modal-overlay">
          <div className="fin-modal-dialog">
            <div className="fin-modal-header">
              <h3>Disburse Extra Salary — {selectedItem?.extraSalaryNumber}</h3>
              <button type="button" className="fin-modal-close" onClick={() => setActiveModal(null)}>×</button>
            </div>
            <form onSubmit={handleDisburseExtra}>
              <div className="fin-modal-body">
                {modalError && <div className="fin-alert error">{modalError}</div>}
                <div style={{ marginBottom: '16px', padding: '12px', background: '#ecfdf5', borderRadius: '6px' }}>
                  <div><strong>Employee:</strong> {selectedItem?.employeeName}</div>
                  <div><strong>Type:</strong> {selectedItem?.type}</div>
                  <div><strong>Disbursement Amount:</strong> <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '1.1rem' }}>{formatCurrency(selectedItem?.amount)}</span></div>
                </div>

                <div className="fin-form-group">
                  <label>Bank Account *</label>
                  <select
                    required
                    value={modalForm.bankAccountId}
                    onChange={(e) => setModalForm({ ...modalForm, bankAccountId: e.target.value })}
                    className="fin-form-input"
                  >
                    {bankAccounts.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.bankName} - {b.accountName} (Balance: {formatCurrency(b.currentBalance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="fin-form-grid">
                  <div className="fin-form-group">
                    <label>Payment Method *</label>
                    <select
                      value={modalForm.paymentMethod}
                      onChange={(e) => setModalForm({ ...modalForm, paymentMethod: e.target.value })}
                      className="fin-form-input"
                    >
                      <option value="Bank Transfer">Bank Transfer / NEFT / IMPS</option>
                      <option value="UPI">UPI</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>
                  <div className="fin-form-group">
                    <label>Transaction / UTR Reference</label>
                    <input
                      type="text"
                      placeholder="e.g. UTR-78219401"
                      value={modalForm.paymentReference}
                      onChange={(e) => setModalForm({ ...modalForm, paymentReference: e.target.value })}
                      className="fin-form-input"
                    />
                  </div>
                </div>
              </div>
              <div className="fin-modal-footer">
                <button type="button" className="fin-action-btn" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="fin-action-btn success" disabled={modalLoading}>
                  {modalLoading ? 'Disbursing...' : 'Confirm & Disburse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
