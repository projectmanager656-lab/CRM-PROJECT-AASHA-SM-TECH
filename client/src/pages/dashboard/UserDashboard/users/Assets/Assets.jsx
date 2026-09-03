import React, { useState, useEffect, useMemo, useCallback } from 'react';
import apiClient from '../../../../../services/apiClient';
import UserLayout from '../components/UserLayout';
import './Assets.css';

const ASSET_CATEGORIES = [
  'Laptop',
  'Desktop',
  'Monitor',
  'Mobile Device',
  'Networking',
  'Peripheral / Accessory',
  'Furniture',
  'Audio / Visual',
  'Other',
];

const ASSET_CONDITIONS = ['New', 'Good', 'Fair', 'Damaged', 'Needs Repair'];

const OFFICIAL_DEPARTMENTS = ['HR', 'Finance', 'Business Development', 'Digital Marketing', 'Video Editor', 'Tech'];

const initialsFor = (firstName, lastName, email) => {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return 'EM';
};

const formatDate = (val) => {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return String(val);
  }
};

const formatINR = (val) => {
  if (val == null || isNaN(val)) return '₹0';
  return `₹${Number(val).toLocaleString('en-IN')}`;
};

export default function Assets() {
  // Data States
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState({
    totalAssets: 0,
    availableAssets: 0,
    allocatedAssets: 0,
    underRepairAssets: 0,
    lostDamagedAssets: 0,
    retiredDisposedAssets: 0,
    totalAssetValue: 0,
    categoryCounts: {},
    departmentCounts: {},
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Tabs: 'all' | 'allocated' | 'available' | 'repair' | 'lost_damaged' | 'retired_disposed' | 'directory'
  const [activeTab, setActiveTab] = useState('all');

  // Search & Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [paginationMeta, setPaginationMeta] = useState({ total: 0, totalPages: 1 });

  // Directory tab employee selection
  const [dirSelectedEmpId, setDirSelectedEmpId] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showLostDamagedModal, setShowLostDamagedModal] = useState(false);
  const [showRetireDisposeModal, setShowRetireDisposeModal] = useState(false);

  const [activeAsset, setActiveAsset] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [addForm, setAddForm] = useState({
    assetName: '',
    assetCode: '',
    category: 'Laptop',
    brand: '',
    model: '',
    serialNumber: '',
    purchaseDate: '',
    purchaseCost: '',
    vendor: '',
    warrantyStart: '',
    warrantyExpiry: '',
    condition: 'Good',
    location: 'Headquarters / Main Office',
    description: '',
    notes: '',
  });

  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    assignedDate: new Date().toISOString().slice(0, 10),
    condition: 'Good',
    notes: '',
  });

  const [returnForm, setReturnForm] = useState({
    returnDate: new Date().toISOString().slice(0, 10),
    condition: 'Good',
    location: 'Headquarters / Main Office',
    notes: '',
  });

  const [transferForm, setTransferForm] = useState({
    targetEmployeeId: '',
    transferDate: new Date().toISOString().slice(0, 10),
    condition: 'Good',
    notes: '',
  });

  const [maintForm, setMaintForm] = useState({
    actionType: 'start',
    issueDescription: '',
    cost: '',
    condition: 'Needs Repair',
    notes: '',
  });

  const [lostDamagedForm, setLostDamagedForm] = useState({
    type: 'Lost',
    reason: '',
    notes: '',
  });

  const [retireDisposeForm, setRetireDisposeForm] = useState({
    type: 'Retired',
    reason: '',
    notes: '',
  });

  // Load live data from MongoDB Atlas
  const loadAssetsData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let statusParam = selectedStatus !== 'All' ? selectedStatus : undefined;
      if (activeTab === 'allocated') statusParam = 'Allocated';
      else if (activeTab === 'available') statusParam = 'Available';
      else if (activeTab === 'repair') statusParam = 'Under Repair';
      else if (activeTab === 'lost_damaged') statusParam = 'Lost_Damaged';
      else if (activeTab === 'retired_disposed') statusParam = 'Retired_Disposed';

      const [assetsRes, sumRes, usersRes] = await Promise.all([
        apiClient.get('/assets', {
          params: {
            search: search || undefined,
            category: selectedCategory !== 'All' ? selectedCategory : undefined,
            department: selectedDept !== 'All' ? selectedDept : undefined,
            condition: selectedCondition !== 'All' ? selectedCondition : undefined,
            status: statusParam,
            page: currentPage,
            limit: pageSize,
          },
        }),
        apiClient.get('/assets/summary').catch(() => ({ data: { data: null } })),
        apiClient.get('/users').catch(() => ({ data: { data: [] } })),
      ]);

      const fetchedAssets = assetsRes.data?.data?.assets || [];
      const fetchedMeta = assetsRes.data?.data?.pagination || { total: fetchedAssets.length, totalPages: 1 };
      setAssets(fetchedAssets);
      setPaginationMeta(fetchedMeta);

      if (sumRes.data?.data) {
        setSummary(sumRes.data.data);
      }

      // Filter active employees
      const emps = (usersRes.data?.data || []).filter(
        (u) => u.role === 'employee' && u.isActive !== false && u.employmentStatus !== 'Exited' && u.employmentStatus !== 'Terminated'
      );
      setEmployees(emps);

      if (emps.length > 0 && !dirSelectedEmpId) {
        setDirSelectedEmpId(emps[0]._id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load asset records.');
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    selectedCategory,
    selectedDept,
    selectedCondition,
    selectedStatus,
    search,
    currentPage,
    pageSize,
    dirSelectedEmpId,
  ]);

  useEffect(() => {
    loadAssetsData();
  }, [loadAssetsData]);

  // Tab change handler
  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setCurrentPage(1);
  };

  // Directory selected employee derived object & docs
  const dirEmployee = useMemo(() => {
    return employees.find((e) => String(e._id) === String(dirSelectedEmpId)) || null;
  }, [employees, dirSelectedEmpId]);

  const dirEmployeeAssets = useMemo(() => {
    if (!dirSelectedEmpId) return [];
    return assets.filter((a) => String(a.assignedTo?._id || a.assignedTo) === String(dirSelectedEmpId));
  }, [assets, dirSelectedEmpId]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setError('');
    setSuccess('');
    setAddForm({
      assetName: '',
      assetCode: '',
      category: 'Laptop',
      brand: '',
      model: '',
      serialNumber: '',
      purchaseDate: '',
      purchaseCost: '',
      vendor: '',
      warrantyStart: '',
      warrantyExpiry: '',
      condition: 'Good',
      location: 'Headquarters / Main Office',
      description: '',
      notes: '',
    });
    setShowAddModal(true);
  };

  // Submit Add Asset
  const handleSaveAdd = async (e) => {
    e.preventDefault();
    if (!addForm.assetName.trim()) {
      setError('Asset name is required.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await apiClient.post('/assets', addForm);
      setShowAddModal(false);
      setSuccess('Asset registered successfully in inventory.');
      await loadAssetsData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create asset.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Details Modal
  const handleOpenDetails = async (asset) => {
    try {
      const res = await apiClient.get(`/assets/${asset._id}`);
      setActiveAsset(res.data?.data || asset);
    } catch {
      setActiveAsset(asset);
    }
    setShowDetailsModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (asset) => {
    setActiveAsset(asset);
    setAddForm({
      assetName: asset.assetName || '',
      assetCode: asset.assetCode || '',
      category: asset.category || 'Laptop',
      brand: asset.brand || '',
      model: asset.model || '',
      serialNumber: asset.serialNumber || '',
      purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '',
      purchaseCost: asset.purchaseCost || '',
      vendor: asset.vendor || '',
      warrantyStart: asset.warrantyStart ? asset.warrantyStart.split('T')[0] : '',
      warrantyExpiry: asset.warrantyExpiry ? asset.warrantyExpiry.split('T')[0] : '',
      condition: asset.condition || 'Good',
      location: asset.location || 'Headquarters / Main Office',
      description: asset.description || '',
      notes: asset.notes || '',
    });
    setShowEditModal(true);
  };

  // Submit Edit
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!activeAsset) return;
    setSubmitting(true);
    setError('');
    try {
      await apiClient.put(`/assets/${activeAsset._id}`, addForm);
      setShowEditModal(false);
      if (showDetailsModal) setShowDetailsModal(false);
      setSuccess(`Asset "${activeAsset.assetCode}" updated successfully.`);
      await loadAssetsData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update asset.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Assign Modal
  const handleOpenAssign = (asset, targetEmpId = null) => {
    setActiveAsset(asset);
    const defaultEmp = targetEmpId || (employees.length > 0 ? employees[0]._id : '');
    setAssignForm({
      employeeId: defaultEmp,
      assignedDate: new Date().toISOString().slice(0, 10),
      condition: asset.condition || 'Good',
      notes: '',
    });
    setShowAssignModal(true);
  };

  // Submit Assign
  const handleSaveAssign = async (e) => {
    e.preventDefault();
    if (!assignForm.employeeId) {
      setError('Please select an employee.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiClient.patch(`/assets/${activeAsset._id}/assign`, assignForm);
      setShowAssignModal(false);
      if (showDetailsModal) setShowDetailsModal(false);
      setSuccess(`Asset "${activeAsset.assetCode}" successfully allocated.`);
      await loadAssetsData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to allocate asset.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Return Modal
  const handleOpenReturn = (asset) => {
    setActiveAsset(asset);
    setReturnForm({
      returnDate: new Date().toISOString().slice(0, 10),
      condition: asset.condition || 'Good',
      location: 'Headquarters / Main Office',
      notes: '',
    });
    setShowReturnModal(true);
  };

  // Submit Return
  const handleSaveReturn = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiClient.patch(`/assets/${activeAsset._id}/return`, returnForm);
      setShowReturnModal(false);
      if (showDetailsModal) setShowDetailsModal(false);
      setSuccess(`Asset "${activeAsset.assetCode}" returned to inventory.`);
      await loadAssetsData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to return asset.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Transfer Modal
  const handleOpenTransfer = (asset) => {
    setActiveAsset(asset);
    const target = employees.find((e) => String(e._id) !== String(asset.assignedTo?._id || asset.assignedTo));
    setTransferForm({
      targetEmployeeId: target ? target._id : '',
      transferDate: new Date().toISOString().slice(0, 10),
      condition: asset.condition || 'Good',
      notes: '',
    });
    setShowTransferModal(true);
  };

  // Submit Transfer
  const handleSaveTransfer = async (e) => {
    e.preventDefault();
    if (!transferForm.targetEmployeeId) {
      setError('Please select a target employee for transfer.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiClient.patch(`/assets/${activeAsset._id}/transfer`, transferForm);
      setShowTransferModal(false);
      if (showDetailsModal) setShowDetailsModal(false);
      setSuccess(`Asset "${activeAsset.assetCode}" transferred successfully.`);
      await loadAssetsData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to transfer asset.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Maintenance Modal
  const handleOpenMaintenance = (asset) => {
    setActiveAsset(asset);
    setMaintForm({
      actionType: asset.status === 'Under Repair' ? 'complete' : 'start',
      issueDescription: '',
      cost: '',
      condition: asset.status === 'Under Repair' ? 'Good' : 'Needs Repair',
      notes: '',
    });
    setShowMaintenanceModal(true);
  };

  // Submit Maintenance
  const handleSaveMaintenance = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiClient.patch(`/assets/${activeAsset._id}/maintenance`, maintForm);
      setShowMaintenanceModal(false);
      if (showDetailsModal) setShowDetailsModal(false);
      setSuccess(`Asset "${activeAsset.assetCode}" maintenance status updated.`);
      await loadAssetsData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update maintenance.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Lost/Damaged Modal
  const handleOpenLostDamaged = (asset) => {
    setActiveAsset(asset);
    setLostDamagedForm({
      type: 'Lost',
      reason: '',
      notes: '',
    });
    setShowLostDamagedModal(true);
  };

  // Submit Lost/Damaged
  const handleSaveLostDamaged = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiClient.patch(`/assets/${activeAsset._id}/lost-damaged`, lostDamagedForm);
      setShowLostDamagedModal(false);
      if (showDetailsModal) setShowDetailsModal(false);
      setSuccess(`Asset "${activeAsset.assetCode}" marked as ${lostDamagedForm.type}.`);
      await loadAssetsData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Retire/Dispose Modal
  const handleOpenRetireDispose = (asset) => {
    setActiveAsset(asset);
    setRetireDisposeForm({
      type: 'Retired',
      reason: '',
      notes: '',
    });
    setShowRetireDisposeModal(true);
  };

  // Submit Retire/Dispose
  const handleSaveRetireDispose = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiClient.patch(`/assets/${activeAsset._id}/retire-dispose`, retireDisposeForm);
      setShowRetireDisposeModal(false);
      if (showDetailsModal) setShowDetailsModal(false);
      setSuccess(`Asset "${activeAsset.assetCode}" marked as ${retireDisposeForm.type}. Complete history preserved.`);
      await loadAssetsData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retire/dispose asset.');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearch('');
    setSelectedCategory('All');
    setSelectedDept('All');
    setSelectedCondition('All');
    setSelectedStatus('All');
    setCurrentPage(1);
  };

  return (
    <UserLayout pageTitle="Asset Management">
      <div className="ast-container">
        {/* ─── Top Header ─── */}
        <div className="ast-header-area">
          <div className="ast-title-meta">
            <h2>Asset Management</h2>
            <p>Track, allocate, maintain and manage corporate hardware & hardware inventory.</p>
          </div>
          <div className="ast-header-actions">
            <button type="button" className="ast-secondary-btn" onClick={loadAssetsData} title="Refresh Records">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              Refresh
            </button>
            <button type="button" className="ast-primary-btn" onClick={handleOpenAdd}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add New Asset
            </button>
          </div>
        </div>

        {/* ─── Feedback Alerts ─── */}
        {error && (
          <div className="ast-alert error">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')}>✕</button>
          </div>
        )}
        {success && (
          <div className="ast-alert success">
            <span>{success}</span>
            <button type="button" onClick={() => setSuccess('')}>✕</button>
          </div>
        )}

        {/* ─── 6 Dynamic KPI Cards ─── */}
        <div className="ast-kpi-grid">
          {/* Card 1: Total Assets */}
          <div
            className={`ast-kpi-card blue ${activeTab === 'all' ? 'active-kpi' : ''}`}
            onClick={() => handleTabChange('all')}
          >
            <div className="ast-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div className="ast-kpi-body">
              <span className="ast-kpi-label">Total Assets</span>
              <strong className="ast-kpi-value">{summary.totalAssets}</strong>
              <span className="ast-kpi-sub">Valuation: {formatINR(summary.totalAssetValue)}</span>
            </div>
          </div>

          {/* Card 2: Available / In Stock */}
          <div
            className={`ast-kpi-card emerald ${activeTab === 'available' ? 'active-kpi' : ''}`}
            onClick={() => handleTabChange('available')}
          >
            <div className="ast-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className="ast-kpi-body">
              <span className="ast-kpi-label">Available / In Stock</span>
              <strong className="ast-kpi-value">{summary.availableAssets}</strong>
              <span className="ast-kpi-sub">Ready for allocation</span>
            </div>
          </div>

          {/* Card 3: Allocated */}
          <div
            className={`ast-kpi-card purple ${activeTab === 'allocated' ? 'active-kpi' : ''}`}
            onClick={() => handleTabChange('allocated')}
          >
            <div className="ast-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="ast-kpi-body">
              <span className="ast-kpi-label">Allocated Assets</span>
              <strong className="ast-kpi-value">{summary.allocatedAssets}</strong>
              <span className="ast-kpi-sub">Assigned to staff</span>
            </div>
          </div>

          {/* Card 4: Under Repair */}
          <div
            className={`ast-kpi-card amber ${activeTab === 'repair' ? 'active-kpi' : ''}`}
            onClick={() => handleTabChange('repair')}
          >
            <div className="ast-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            </div>
            <div className="ast-kpi-body">
              <span className="ast-kpi-label">Under Repair</span>
              <strong className="ast-kpi-value">{summary.underRepairAssets}</strong>
              <span className="ast-kpi-sub">Maintenance active</span>
            </div>
          </div>

          {/* Card 5: Lost / Damaged */}
          <div
            className={`ast-kpi-card rose ${activeTab === 'lost_damaged' ? 'active-kpi' : ''}`}
            onClick={() => handleTabChange('lost_damaged')}
          >
            <div className="ast-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="ast-kpi-body">
              <span className="ast-kpi-label">Lost / Damaged</span>
              <strong className="ast-kpi-value">{summary.lostDamagedAssets}</strong>
              <span className="ast-kpi-sub">Flagged equipment</span>
            </div>
          </div>

          {/* Card 6: Retired / Disposed */}
          <div
            className={`ast-kpi-card slate ${activeTab === 'retired_disposed' ? 'active-kpi' : ''}`}
            onClick={() => handleTabChange('retired_disposed')}
          >
            <div className="ast-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>
            <div className="ast-kpi-body">
              <span className="ast-kpi-label">Retired / Disposed</span>
              <strong className="ast-kpi-value">{summary.retiredDisposedAssets}</strong>
              <span className="ast-kpi-sub">Historical archive</span>
            </div>
          </div>
        </div>

        {/* ─── Navigation Tabs ─── */}
        <div className="ast-nav-tabs-wrap">
          <div className="ast-nav-tabs">
            <button
              type="button"
              className={`ast-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => handleTabChange('all')}
            >
              All Assets
              <span className="ast-tab-badge">{summary.totalAssets}</span>
            </button>
            <button
              type="button"
              className={`ast-tab-btn ${activeTab === 'allocated' ? 'active' : ''}`}
              onClick={() => handleTabChange('allocated')}
            >
              Allocated
              <span className="ast-tab-badge purple">{summary.allocatedAssets}</span>
            </button>
            <button
              type="button"
              className={`ast-tab-btn ${activeTab === 'available' ? 'active' : ''}`}
              onClick={() => handleTabChange('available')}
            >
              Available
              <span className="ast-tab-badge emerald">{summary.availableAssets}</span>
            </button>
            <button
              type="button"
              className={`ast-tab-btn ${activeTab === 'repair' ? 'active' : ''}`}
              onClick={() => handleTabChange('repair')}
            >
              Under Repair
              <span className="ast-tab-badge amber">{summary.underRepairAssets}</span>
            </button>
            <button
              type="button"
              className={`ast-tab-btn ${activeTab === 'lost_damaged' ? 'active' : ''}`}
              onClick={() => handleTabChange('lost_damaged')}
            >
              Lost / Damaged
              <span className="ast-tab-badge rose">{summary.lostDamagedAssets}</span>
            </button>
            <button
              type="button"
              className={`ast-tab-btn ${activeTab === 'retired_disposed' ? 'active' : ''}`}
              onClick={() => handleTabChange('retired_disposed')}
            >
              Retired / Disposed
              <span className="ast-tab-badge slate">{summary.retiredDisposedAssets}</span>
            </button>
            <button
              type="button"
              className={`ast-tab-btn ${activeTab === 'directory' ? 'active' : ''}`}
              onClick={() => handleTabChange('directory')}
            >
              Employee Asset Directory
            </button>
          </div>
        </div>

        {/* ─── TAB CONTENT: ASSET TABLE VIEW (Tabs 1-6) ─── */}
        {activeTab !== 'directory' && (
          <>
            {/* Toolbar */}
            <div className="ast-toolbar">
              <div className="ast-search-wrap">
                <svg className="ast-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="ast-search-input"
                  placeholder="Search by asset name, code, brand, model, serial, or employee..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Category Filter */}
              <select
                className="ast-filter-select"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="All">All Categories</option>
                {ASSET_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {/* Department Filter */}
              <select
                className="ast-filter-select"
                value={selectedDept}
                onChange={(e) => {
                  setSelectedDept(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="All">All Departments</option>
                {OFFICIAL_DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>

              {/* Condition Filter */}
              <select
                className="ast-filter-select"
                value={selectedCondition}
                onChange={(e) => {
                  setSelectedCondition(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="All">All Conditions</option>
                {ASSET_CONDITIONS.map((cond) => (
                  <option key={cond} value={cond}>{cond}</option>
                ))}
              </select>

              {/* Clear Filters */}
              {(search || selectedCategory !== 'All' || selectedDept !== 'All' || selectedCondition !== 'All' || selectedStatus !== 'All') && (
                <button type="button" className="ast-reset-btn" onClick={handleResetFilters}>
                  Clear Filters
                </button>
              )}
            </div>

            {/* Asset Table Card */}
            <div className="ast-table-card">
              {loading ? (
                <div className="ast-loading-state">
                  <div className="ast-spinner" />
                  <p>Loading assets from MongoDB Atlas...</p>
                </div>
              ) : assets.length === 0 ? (
                <div className="ast-empty-state">
                  <div className="ast-empty-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  </div>
                  <h3>No Assets Found</h3>
                  <p>
                    {search || selectedCategory !== 'All' || selectedDept !== 'All' || activeTab !== 'all'
                      ? 'No assets match your search and filter criteria.'
                      : 'Register corporate hardware and equipment to start tracking.'}
                  </p>
                  <button type="button" className="ast-primary-btn" onClick={handleOpenAdd}>
                    ⚡ Register First Asset
                  </button>
                </div>
              ) : (
                <div className="ast-table-wrap">
                  <table className="ast-table">
                    <thead>
                      <tr>
                        <th>Asset Name & Code</th>
                        <th>Category</th>
                        <th>Brand / Model</th>
                        <th>Assigned Employee</th>
                        <th>Condition</th>
                        <th>Status</th>
                        <th>Cost & Warranty</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assets.map((asset) => {
                        const statusClass = (asset.status || 'Available').toLowerCase().replace(/\s+/g, '_');
                        const assignedEmp = asset.assignedTo;
                        const empName = assignedEmp
                          ? assignedEmp.personalInfo?.fullName || `${assignedEmp.firstName || ''} ${assignedEmp.lastName || ''}`.trim() || assignedEmp.email
                          : null;
                        const empId = assignedEmp?.jobDetails?.employeeId || (assignedEmp?._id ? `EMP-${String(assignedEmp._id).slice(-5).toUpperCase()}` : '');

                        return (
                          <tr key={asset._id}>
                            {/* Asset Info */}
                            <td>
                              <div className="ast-name-cell">
                                <strong className="ast-name">{asset.assetName}</strong>
                                <span className="ast-code-badge">{asset.assetCode}</span>
                              </div>
                            </td>

                            {/* Category */}
                            <td>
                              <span className="ast-cat-pill">{asset.category}</span>
                            </td>

                            {/* Brand & Model */}
                            <td>
                              <div className="ast-spec-cell">
                                <span>{asset.brand || '—'} {asset.model}</span>
                                {asset.serialNumber && <small>SN: {asset.serialNumber}</small>}
                              </div>
                            </td>

                            {/* Assigned Employee */}
                            <td>
                              {assignedEmp ? (
                                <div className="ast-emp-cell">
                                  <div className="ast-emp-avatar">
                                    {initialsFor(assignedEmp.firstName, assignedEmp.lastName, assignedEmp.email)}
                                  </div>
                                  <div className="ast-emp-meta">
                                    <span className="ast-emp-name">{empName}</span>
                                    <span className="ast-emp-sub">{empId} • {asset.department || assignedEmp.department || '—'}</span>
                                  </div>
                                </div>
                              ) : (
                                <span className="ast-unallocated-tag">Unallocated (In Stock)</span>
                              )}
                            </td>

                            {/* Condition */}
                            <td>
                              <span className={`ast-cond-tag cond-${(asset.condition || 'good').toLowerCase().replace(/\s+/g, '_')}`}>
                                {asset.condition || 'Good'}
                              </span>
                            </td>

                            {/* Status */}
                            <td>
                              <span className={`ast-status-pill status-${statusClass}`}>
                                {asset.status === 'Available' && '🟢 Available'}
                                {asset.status === 'Returned' && '🟢 Returned (Available)'}
                                {asset.status === 'Allocated' && '🟣 Allocated'}
                                {asset.status === 'Under Repair' && '🟠 Under Repair'}
                                {asset.status === 'Lost' && '🔴 Lost'}
                                {asset.status === 'Damaged' && '🔴 Damaged'}
                                {asset.status === 'Retired' && '⚪ Retired'}
                                {asset.status === 'Disposed' && '⚪ Disposed'}
                              </span>
                            </td>

                            {/* Cost & Warranty */}
                            <td>
                              <div className="ast-cost-cell">
                                <strong>{formatINR(asset.purchaseCost)}</strong>
                                <small>
                                  {asset.warrantyExpiry ? `Warranty: ${formatDate(asset.warrantyExpiry)}` : 'No Warranty'}
                                </small>
                              </div>
                            </td>

                            {/* Contextual Actions */}
                            <td>
                              <div className="ast-actions-wrap">
                                <button
                                  type="button"
                                  className="ast-btn-sm view"
                                  onClick={() => handleOpenDetails(asset)}
                                  title="View Full Details & History"
                                >
                                  View
                                </button>

                                {/* If Available -> Allow Assign */}
                                {(asset.status === 'Available' || asset.status === 'Returned') && (
                                  <button
                                    type="button"
                                    className="ast-btn-sm assign"
                                    onClick={() => handleOpenAssign(asset)}
                                    title="Allocate to Employee"
                                  >
                                    Assign
                                  </button>
                                )}

                                {/* If Allocated -> Allow Return or Transfer */}
                                {asset.status === 'Allocated' && (
                                  <>
                                    <button
                                      type="button"
                                      className="ast-btn-sm return"
                                      onClick={() => handleOpenReturn(asset)}
                                      title="Return to Inventory"
                                    >
                                      Return
                                    </button>
                                    <button
                                      type="button"
                                      className="ast-btn-sm transfer"
                                      onClick={() => handleOpenTransfer(asset)}
                                      title="Transfer to another Employee"
                                    >
                                      Transfer
                                    </button>
                                  </>
                                )}

                                {/* If Under Repair -> Complete Repair */}
                                {asset.status === 'Under Repair' && (
                                  <button
                                    type="button"
                                    className="ast-btn-sm complete"
                                    onClick={() => handleOpenMaintenance(asset)}
                                    title="Complete Maintenance"
                                  >
                                    Complete
                                  </button>
                                )}

                                {/* Maintenance action if not in repair */}
                                {asset.status !== 'Under Repair' && asset.status !== 'Retired' && asset.status !== 'Disposed' && (
                                  <button
                                    type="button"
                                    className="ast-btn-sm repair"
                                    onClick={() => handleOpenMaintenance(asset)}
                                    title="Send for Repair"
                                  >
                                    Repair
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

              {/* Pagination */}
              {paginationMeta.total > pageSize && (
                <div className="ast-pagination-bar">
                  <div className="ast-pagination-info">
                    Showing {Math.min((currentPage - 1) * pageSize + 1, paginationMeta.total)} to{' '}
                    {Math.min(currentPage * pageSize, paginationMeta.total)} of {paginationMeta.total} records
                  </div>
                  <div className="ast-pagination-controls">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
                      ← Previous
                    </button>
                    <span className="ast-page-indicator">
                      Page {currentPage} of {paginationMeta.totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= paginationMeta.totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── TAB CONTENT: EMPLOYEE ASSET DIRECTORY (Tab 7) ─── */}
        {activeTab === 'directory' && (
          <div className="ast-dir-workspace">
            {/* Employee Selector Card */}
            <div className="ast-dir-header-card">
              <div className="ast-dir-select-row">
                <label>
                  <strong>Select Employee:</strong>
                </label>
                <select
                  className="ast-dir-employee-select"
                  value={dirSelectedEmpId}
                  onChange={(e) => setDirSelectedEmpId(e.target.value)}
                >
                  {employees.map((emp) => {
                    const name = emp.personalInfo?.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email;
                    const id = emp.jobDetails?.employeeId || `EMP-${String(emp._id).slice(-5).toUpperCase()}`;
                    const dept = emp.jobDetails?.department || emp.department || '—';
                    return (
                      <option key={emp._id} value={emp._id}>
                        {name} ({id}) — {dept}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Selected Employee Profile Banner */}
              {dirEmployee && (
                <div className="ast-dir-profile-banner">
                  <div className="ast-dir-avatar">
                    {initialsFor(dirEmployee.firstName, dirEmployee.lastName, dirEmployee.email)}
                  </div>
                  <div className="ast-dir-profile-info">
                    <h3>
                      {dirEmployee.personalInfo?.fullName ||
                        `${dirEmployee.firstName || ''} ${dirEmployee.lastName || ''}`.trim() ||
                        dirEmployee.email}
                    </h3>
                    <div className="ast-dir-meta-tags">
                      <span><strong>ID:</strong> {dirEmployee.jobDetails?.employeeId || `EMP-${String(dirEmployee._id).slice(-5).toUpperCase()}`}</span>
                      <span><strong>Dept:</strong> {dirEmployee.jobDetails?.department || dirEmployee.department || '—'}</span>
                      <span><strong>Role:</strong> {dirEmployee.designation || dirEmployee.jobDetails?.designation || 'Staff'}</span>
                      <span><strong>Email:</strong> {dirEmployee.email}</span>
                    </div>
                  </div>

                  {/* Summary Count for Employee */}
                  <div className="ast-dir-counters">
                    <div className="ast-counter-col purple">
                      <span>Assigned Assets</span>
                      <strong>{dirEmployeeAssets.length}</strong>
                    </div>
                    <div className="ast-counter-col blue">
                      <span>Total Value</span>
                      <strong>{formatINR(dirEmployeeAssets.reduce((s, a) => s + (Number(a.purchaseCost) || 0), 0))}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Employee Assets Table */}
            <div className="ast-table-card">
              <div className="ast-card-heading">
                <h4>Allocated Hardware & Assets for {dirEmployee?.firstName || 'Selected Employee'}</h4>
              </div>

              {dirEmployeeAssets.length === 0 ? (
                <div className="ast-empty-state">
                  <p>No assets currently allocated to this employee.</p>
                </div>
              ) : (
                <div className="ast-table-wrap">
                  <table className="ast-table">
                    <thead>
                      <tr>
                        <th>Asset Name & Code</th>
                        <th>Category</th>
                        <th>Brand / Model</th>
                        <th>Serial Number</th>
                        <th>Assigned Date</th>
                        <th>Condition</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dirEmployeeAssets.map((asset) => (
                        <tr key={asset._id}>
                          <td>
                            <div className="ast-name-cell">
                              <strong className="ast-name">{asset.assetName}</strong>
                              <span className="ast-code-badge">{asset.assetCode}</span>
                            </div>
                          </td>
                          <td><span className="ast-cat-pill">{asset.category}</span></td>
                          <td>{asset.brand} {asset.model}</td>
                          <td>{asset.serialNumber || '—'}</td>
                          <td>{formatDate(asset.assignedDate)}</td>
                          <td>
                            <span className={`ast-cond-tag cond-${(asset.condition || 'good').toLowerCase()}`}>
                              {asset.condition || 'Good'}
                            </span>
                          </td>
                          <td>
                            <span className="ast-status-pill status-allocated">🟣 Allocated</span>
                          </td>
                          <td>
                            <div className="ast-actions-wrap">
                              <button
                                type="button"
                                className="ast-btn-sm view"
                                onClick={() => handleOpenDetails(asset)}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                className="ast-btn-sm return"
                                onClick={() => handleOpenReturn(asset)}
                              >
                                Return
                              </button>
                              <button
                                type="button"
                                className="ast-btn-sm transfer"
                                onClick={() => handleOpenTransfer(asset)}
                              >
                                Transfer
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── MODAL 1: ADD NEW ASSET ─── */}
        {showAddModal && (
          <div className="ast-modal-overlay">
            <div className="ast-modal-card">
              <div className="ast-modal-header">
                <h3>Register New Asset</h3>
                <button type="button" className="ast-modal-close" onClick={() => setShowAddModal(false)}>✕</button>
              </div>

              <form onSubmit={handleSaveAdd} className="ast-modal-form">
                <div className="ast-form-row">
                  <div className="ast-form-group">
                    <label>Asset Name <span className="req">*</span></label>
                    <input
                      type="text"
                      className="ast-input"
                      placeholder="e.g. MacBook Pro 16, Dell UltraSharp 27"
                      value={addForm.assetName}
                      onChange={(e) => setAddForm({ ...addForm, assetName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="ast-form-group">
                    <label>Asset Category <span className="req">*</span></label>
                    <select
                      className="ast-input"
                      value={addForm.category}
                      onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                      required
                    >
                      {ASSET_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="ast-form-row">
                  <div className="ast-form-group">
                    <label>Custom Asset Code (Auto-generated if empty)</label>
                    <input
                      type="text"
                      className="ast-input"
                      placeholder="e.g. AST-1049 (Optional)"
                      value={addForm.assetCode}
                      onChange={(e) => setAddForm({ ...addForm, assetCode: e.target.value })}
                    />
                  </div>
                  <div className="ast-form-group">
                    <label>Initial Condition</label>
                    <select
                      className="ast-input"
                      value={addForm.condition}
                      onChange={(e) => setAddForm({ ...addForm, condition: e.target.value })}
                    >
                      {ASSET_CONDITIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="ast-form-row">
                  <div className="ast-form-group">
                    <label>Brand / Manufacturer</label>
                    <input
                      type="text"
                      className="ast-input"
                      placeholder="e.g. Apple, Dell, Lenovo, HP"
                      value={addForm.brand}
                      onChange={(e) => setAddForm({ ...addForm, brand: e.target.value })}
                    />
                  </div>
                  <div className="ast-form-group">
                    <label>Model / Specification</label>
                    <input
                      type="text"
                      className="ast-input"
                      placeholder="e.g. M2 Pro 32GB RAM / 1TB SSD"
                      value={addForm.model}
                      onChange={(e) => setAddForm({ ...addForm, model: e.target.value })}
                    />
                  </div>
                  <div className="ast-form-group">
                    <label>Serial Number</label>
                    <input
                      type="text"
                      className="ast-input"
                      placeholder="e.g. C02G9123MD6R"
                      value={addForm.serialNumber}
                      onChange={(e) => setAddForm({ ...addForm, serialNumber: e.target.value })}
                    />
                  </div>
                </div>

                <div className="ast-form-row">
                  <div className="ast-form-group">
                    <label>Purchase Date</label>
                    <input
                      type="date"
                      className="ast-input"
                      value={addForm.purchaseDate}
                      onChange={(e) => setAddForm({ ...addForm, purchaseDate: e.target.value })}
                    />
                  </div>
                  <div className="ast-form-group">
                    <label>Purchase Cost (₹ INR)</label>
                    <input
                      type="number"
                      className="ast-input"
                      placeholder="e.g. 185000"
                      value={addForm.purchaseCost}
                      onChange={(e) => setAddForm({ ...addForm, purchaseCost: e.target.value })}
                    />
                  </div>
                  <div className="ast-form-group">
                    <label>Vendor / Supplier</label>
                    <input
                      type="text"
                      className="ast-input"
                      placeholder="e.g. Apple India, Reliance Digital"
                      value={addForm.vendor}
                      onChange={(e) => setAddForm({ ...addForm, vendor: e.target.value })}
                    />
                  </div>
                </div>

                <div className="ast-form-row">
                  <div className="ast-form-group">
                    <label>Warranty Expiry</label>
                    <input
                      type="date"
                      className="ast-input"
                      value={addForm.warrantyExpiry}
                      onChange={(e) => setAddForm({ ...addForm, warrantyExpiry: e.target.value })}
                    />
                  </div>
                  <div className="ast-form-group">
                    <label>Storage / Workstation Location</label>
                    <input
                      type="text"
                      className="ast-input"
                      placeholder="e.g. Floor 2 - IT Storage"
                      value={addForm.location}
                      onChange={(e) => setAddForm({ ...addForm, location: e.target.value })}
                    />
                  </div>
                </div>

                <div className="ast-form-group">
                  <label>Description & Notes</label>
                  <textarea
                    className="ast-textarea"
                    rows="2"
                    placeholder="Add any extra information regarding this equipment..."
                    value={addForm.notes}
                    onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  />
                </div>

                <div className="ast-modal-footer">
                  <button type="button" className="ast-secondary-btn" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="ast-primary-btn" disabled={submitting}>
                    {submitting ? 'Registering...' : 'Save Asset to Inventory'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL 2: ASSET DETAILS & AUDIT HISTORY ─── */}
        {showDetailsModal && activeAsset && (
          <div className="ast-modal-overlay">
            <div className="ast-modal-card ast-details-card">
              <div className="ast-modal-header">
                <div className="ast-details-header-title">
                  <h3>{activeAsset.assetName}</h3>
                  <span className="ast-code-badge">{activeAsset.assetCode}</span>
                  <span className={`ast-status-pill status-${(activeAsset.status || 'available').toLowerCase().replace(/\s+/g, '_')}`}>
                    {activeAsset.status}
                  </span>
                </div>
                <button type="button" className="ast-modal-close" onClick={() => setShowDetailsModal(false)}>✕</button>
              </div>

              <div className="ast-details-body">
                {/* Current Allocation Card */}
                {activeAsset.assignedTo ? (
                  <div className="ast-details-emp-card">
                    <div className="ast-emp-avatar lg">
                      {initialsFor(activeAsset.assignedTo.firstName, activeAsset.assignedTo.lastName, activeAsset.assignedTo.email)}
                    </div>
                    <div className="ast-details-emp-meta">
                      <h4>
                        {activeAsset.assignedTo.personalInfo?.fullName ||
                          [activeAsset.assignedTo.firstName, activeAsset.assignedTo.lastName].filter(Boolean).join(' ') ||
                          activeAsset.assignedTo.email}
                      </h4>
                      <p>
                        <strong>ID:</strong> {activeAsset.assignedTo.jobDetails?.employeeId || 'Staff'} •{' '}
                        <strong>Dept:</strong> {activeAsset.department || activeAsset.assignedTo.jobDetails?.department || activeAsset.assignedTo.department || '—'} •{' '}
                        <strong>Allocated on:</strong> {formatDate(activeAsset.assignedDate)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="ast-unallocated-banner">
                    <span>📦 This asset is currently <strong>In Stock</strong> and available for allocation.</span>
                  </div>
                )}

                {/* Metadata Grid */}
                <div className="ast-meta-grid">
                  <div className="ast-meta-item">
                    <span>Category</span>
                    <strong>{activeAsset.category}</strong>
                  </div>
                  <div className="ast-meta-item">
                    <span>Brand & Model</span>
                    <strong>{activeAsset.brand || '—'} {activeAsset.model}</strong>
                  </div>
                  <div className="ast-meta-item">
                    <span>Serial Number</span>
                    <strong>{activeAsset.serialNumber || '—'}</strong>
                  </div>
                  <div className="ast-meta-item">
                    <span>Current Condition</span>
                    <strong>{activeAsset.condition || 'Good'}</strong>
                  </div>
                  <div className="ast-meta-item">
                    <span>Purchase Cost</span>
                    <strong>{formatINR(activeAsset.purchaseCost)}</strong>
                  </div>
                  <div className="ast-meta-item">
                    <span>Purchase Date</span>
                    <strong>{formatDate(activeAsset.purchaseDate)}</strong>
                  </div>
                  <div className="ast-meta-item">
                    <span>Warranty Expiry</span>
                    <strong>{formatDate(activeAsset.warrantyExpiry)}</strong>
                  </div>
                  <div className="ast-meta-item">
                    <span>Location</span>
                    <strong>{activeAsset.location || 'HQ'}</strong>
                  </div>
                </div>

                {/* Audit History Timeline */}
                <div className="ast-audit-section">
                  <h5>Complete Asset Lifecycle History</h5>
                  {(!activeAsset.history || activeAsset.history.length === 0) ? (
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No history records recorded.</p>
                  ) : (
                    <div className="ast-audit-timeline">
                      {activeAsset.history.slice().reverse().map((h, idx) => (
                        <div key={idx} className="ast-audit-event">
                          <span className={`ast-audit-bullet ${h.action.toLowerCase().replace(/\s+/g, '_')}`} />
                          <div className="ast-audit-content">
                            <div className="ast-audit-top">
                              <strong>{h.action}</strong>
                              <small>{formatDate(h.date)} at {new Date(h.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                            </div>
                            <p className="ast-audit-desc">{h.notes || 'Status transition recorded.'}</p>
                            <span className="ast-audit-performer">By {h.performedByName || 'HR Manager'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="ast-modal-footer space-between">
                <div>
                  <button type="button" className="ast-secondary-btn" onClick={() => handleOpenEdit(activeAsset)}>
                    ✏️ Edit Specs
                  </button>
                </div>

                <div className="ast-footer-right-actions">
                  {(activeAsset.status === 'Available' || activeAsset.status === 'Returned') && (
                    <button type="button" className="ast-primary-btn" onClick={() => handleOpenAssign(activeAsset)}>
                      👤 Allocate Asset
                    </button>
                  )}
                  {activeAsset.status === 'Allocated' && (
                    <>
                      <button type="button" className="ast-secondary-btn" onClick={() => handleOpenReturn(activeAsset)}>
                        📥 Return to Stock
                      </button>
                      <button type="button" className="ast-primary-btn" onClick={() => handleOpenTransfer(activeAsset)}>
                        🔄 Transfer
                      </button>
                    </>
                  )}
                  {activeAsset.status !== 'Under Repair' && activeAsset.status !== 'Retired' && activeAsset.status !== 'Disposed' && (
                    <button type="button" className="ast-btn-repair-lg" onClick={() => handleOpenMaintenance(activeAsset)}>
                      🛠️ Send to Repair
                    </button>
                  )}
                  {activeAsset.status === 'Under Repair' && (
                    <button type="button" className="ast-primary-btn" onClick={() => handleOpenMaintenance(activeAsset)}>
                      ✅ Complete Repair
                    </button>
                  )}
                  {activeAsset.status !== 'Lost' && activeAsset.status !== 'Damaged' && (
                    <button type="button" className="ast-btn-lost-lg" onClick={() => handleOpenLostDamaged(activeAsset)}>
                      ⚠️ Mark Lost/Damaged
                    </button>
                  )}
                  {activeAsset.status !== 'Retired' && activeAsset.status !== 'Disposed' && (
                    <button type="button" className="ast-btn-retire-lg" onClick={() => handleOpenRetireDispose(activeAsset)}>
                      ⏹️ Retire / Dispose
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL 3: EDIT ASSET MODAL ─── */}
        {showEditModal && activeAsset && (
          <div className="ast-modal-overlay">
            <div className="ast-modal-card">
              <div className="ast-modal-header">
                <h3>Edit Asset Specifications — {activeAsset.assetCode}</h3>
                <button type="button" className="ast-modal-close" onClick={() => setShowEditModal(false)}>✕</button>
              </div>

              <form onSubmit={handleSaveEdit} className="ast-modal-form">
                <div className="ast-form-row">
                  <div className="ast-form-group">
                    <label>Asset Name <span className="req">*</span></label>
                    <input
                      type="text"
                      className="ast-input"
                      value={addForm.assetName}
                      onChange={(e) => setAddForm({ ...addForm, assetName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="ast-form-group">
                    <label>Category</label>
                    <select
                      className="ast-input"
                      value={addForm.category}
                      onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                    >
                      {ASSET_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="ast-form-row">
                  <div className="ast-form-group">
                    <label>Brand</label>
                    <input
                      type="text"
                      className="ast-input"
                      value={addForm.brand}
                      onChange={(e) => setAddForm({ ...addForm, brand: e.target.value })}
                    />
                  </div>
                  <div className="ast-form-group">
                    <label>Model</label>
                    <input
                      type="text"
                      className="ast-input"
                      value={addForm.model}
                      onChange={(e) => setAddForm({ ...addForm, model: e.target.value })}
                    />
                  </div>
                  <div className="ast-form-group">
                    <label>Serial Number</label>
                    <input
                      type="text"
                      className="ast-input"
                      value={addForm.serialNumber}
                      onChange={(e) => setAddForm({ ...addForm, serialNumber: e.target.value })}
                    />
                  </div>
                </div>

                <div className="ast-form-row">
                  <div className="ast-form-group">
                    <label>Purchase Cost (₹)</label>
                    <input
                      type="number"
                      className="ast-input"
                      value={addForm.purchaseCost}
                      onChange={(e) => setAddForm({ ...addForm, purchaseCost: e.target.value })}
                    />
                  </div>
                  <div className="ast-form-group">
                    <label>Condition</label>
                    <select
                      className="ast-input"
                      value={addForm.condition}
                      onChange={(e) => setAddForm({ ...addForm, condition: e.target.value })}
                    >
                      {ASSET_CONDITIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="ast-form-group">
                    <label>Location</label>
                    <input
                      type="text"
                      className="ast-input"
                      value={addForm.location}
                      onChange={(e) => setAddForm({ ...addForm, location: e.target.value })}
                    />
                  </div>
                </div>

                <div className="ast-form-group">
                  <label>Notes</label>
                  <textarea
                    className="ast-textarea"
                    rows="2"
                    value={addForm.notes}
                    onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  />
                </div>

                <div className="ast-modal-footer">
                  <button type="button" className="ast-secondary-btn" onClick={() => setShowEditModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="ast-primary-btn" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL 4: ALLOCATE ASSET MODAL ─── */}
        {showAssignModal && activeAsset && (
          <div className="ast-modal-overlay">
            <div className="ast-modal-card sm">
              <div className="ast-modal-header">
                <h3>Allocate Asset — {activeAsset.assetCode}</h3>
                <button type="button" className="ast-modal-close" onClick={() => setShowAssignModal(false)}>✕</button>
              </div>

              <form onSubmit={handleSaveAssign} className="ast-modal-form">
                <div className="ast-form-group">
                  <label>Assign to Employee <span className="req">*</span></label>
                  <select
                    className="ast-input"
                    value={assignForm.employeeId}
                    onChange={(e) => setAssignForm({ ...assignForm, employeeId: e.target.value })}
                    required
                  >
                    <option value="" disabled>Select Employee</option>
                    {employees.map((emp) => {
                      const name = emp.personalInfo?.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email;
                      const id = emp.jobDetails?.employeeId || `EMP-${String(emp._id).slice(-5).toUpperCase()}`;
                      const dept = emp.jobDetails?.department || emp.department || '—';
                      return (
                        <option key={emp._id} value={emp._id}>
                          {name} ({id}) — {dept}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="ast-form-group">
                  <label>Allocation Date</label>
                  <input
                    type="date"
                    className="ast-input"
                    value={assignForm.assignedDate}
                    onChange={(e) => setAssignForm({ ...assignForm, assignedDate: e.target.value })}
                  />
                </div>

                <div className="ast-form-group">
                  <label>Condition at Handover</label>
                  <select
                    className="ast-input"
                    value={assignForm.condition}
                    onChange={(e) => setAssignForm({ ...assignForm, condition: e.target.value })}
                  >
                    {ASSET_CONDITIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="ast-form-group">
                  <label>Handover Notes</label>
                  <textarea
                    className="ast-textarea"
                    rows="2"
                    placeholder="e.g. Handed over charger, case, and security token."
                    value={assignForm.notes}
                    onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                  />
                </div>

                <div className="ast-modal-footer">
                  <button type="button" className="ast-secondary-btn" onClick={() => setShowAssignModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="ast-primary-btn" disabled={submitting}>
                    {submitting ? 'Allocating...' : 'Confirm Allocation'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL 5: RETURN ASSET MODAL ─── */}
        {showReturnModal && activeAsset && (
          <div className="ast-modal-overlay">
            <div className="ast-modal-card sm">
              <div className="ast-modal-header">
                <h3>Return Asset to Stock — {activeAsset.assetCode}</h3>
                <button type="button" className="ast-modal-close" onClick={() => setShowReturnModal(false)}>✕</button>
              </div>

              <form onSubmit={handleSaveReturn} className="ast-modal-form">
                <div className="ast-form-group">
                  <label>Return Date</label>
                  <input
                    type="date"
                    className="ast-input"
                    value={returnForm.returnDate}
                    onChange={(e) => setReturnForm({ ...returnForm, returnDate: e.target.value })}
                  />
                </div>

                <div className="ast-form-group">
                  <label>Condition Upon Return</label>
                  <select
                    className="ast-input"
                    value={returnForm.condition}
                    onChange={(e) => setReturnForm({ ...returnForm, condition: e.target.value })}
                  >
                    {ASSET_CONDITIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="ast-form-group">
                  <label>Storage Location</label>
                  <input
                    type="text"
                    className="ast-input"
                    value={returnForm.location}
                    onChange={(e) => setReturnForm({ ...returnForm, location: e.target.value })}
                  />
                </div>

                <div className="ast-form-group">
                  <label>Inspection Notes</label>
                  <textarea
                    className="ast-textarea"
                    rows="2"
                    placeholder="e.g. Device returned in clean working condition."
                    value={returnForm.notes}
                    onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                  />
                </div>

                <div className="ast-modal-footer">
                  <button type="button" className="ast-secondary-btn" onClick={() => setShowReturnModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="ast-primary-btn" disabled={submitting}>
                    {submitting ? 'Returning...' : 'Confirm Return to Inventory'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL 6: TRANSFER ASSET MODAL ─── */}
        {showTransferModal && activeAsset && (
          <div className="ast-modal-overlay">
            <div className="ast-modal-card sm">
              <div className="ast-modal-header">
                <h3>Transfer Asset — {activeAsset.assetCode}</h3>
                <button type="button" className="ast-modal-close" onClick={() => setShowTransferModal(false)}>✕</button>
              </div>

              <form onSubmit={handleSaveTransfer} className="ast-modal-form">
                <div className="ast-form-group">
                  <label>Transfer to New Employee <span className="req">*</span></label>
                  <select
                    className="ast-input"
                    value={transferForm.targetEmployeeId}
                    onChange={(e) => setTransferForm({ ...transferForm, targetEmployeeId: e.target.value })}
                    required
                  >
                    <option value="" disabled>Select Target Employee</option>
                    {employees
                      .filter((emp) => String(emp._id) !== String(activeAsset.assignedTo?._id || activeAsset.assignedTo))
                      .map((emp) => {
                        const name = emp.personalInfo?.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email;
                        const id = emp.jobDetails?.employeeId || `EMP-${String(emp._id).slice(-5).toUpperCase()}`;
                        const dept = emp.jobDetails?.department || emp.department || '—';
                        return (
                          <option key={emp._id} value={emp._id}>
                            {name} ({id}) — {dept}
                          </option>
                        );
                      })}
                  </select>
                </div>

                <div className="ast-form-group">
                  <label>Transfer Date</label>
                  <input
                    type="date"
                    className="ast-input"
                    value={transferForm.transferDate}
                    onChange={(e) => setTransferForm({ ...transferForm, transferDate: e.target.value })}
                  />
                </div>

                <div className="ast-form-group">
                  <label>Transfer Notes / Reason</label>
                  <textarea
                    className="ast-textarea"
                    rows="2"
                    placeholder="e.g. Workstation reassigned for new project."
                    value={transferForm.notes}
                    onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                  />
                </div>

                <div className="ast-modal-footer">
                  <button type="button" className="ast-secondary-btn" onClick={() => setShowTransferModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="ast-primary-btn" disabled={submitting}>
                    {submitting ? 'Transferring...' : 'Confirm Transfer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL 7: MAINTENANCE MODAL ─── */}
        {showMaintenanceModal && activeAsset && (
          <div className="ast-modal-overlay">
            <div className="ast-modal-card sm">
              <div className="ast-modal-header">
                <h3>Maintenance & Repair — {activeAsset.assetCode}</h3>
                <button type="button" className="ast-modal-close" onClick={() => setShowMaintenanceModal(false)}>✕</button>
              </div>

              <form onSubmit={handleSaveMaintenance} className="ast-modal-form">
                <div className="ast-form-group">
                  <label>Action Type</label>
                  <select
                    className="ast-input"
                    value={maintForm.actionType}
                    onChange={(e) => setMaintForm({ ...maintForm, actionType: e.target.value })}
                  >
                    <option value="start">Send Asset to Maintenance (Under Repair)</option>
                    <option value="complete">Complete Maintenance (Return to Available)</option>
                  </select>
                </div>

                {maintForm.actionType === 'start' ? (
                  <div className="ast-form-group">
                    <label>Reported Issue / Fault <span className="req">*</span></label>
                    <textarea
                      className="ast-textarea"
                      rows="3"
                      placeholder="Specify hardware issue, display fault, battery failure..."
                      value={maintForm.issueDescription}
                      onChange={(e) => setMaintForm({ ...maintForm, issueDescription: e.target.value })}
                      required
                    />
                  </div>
                ) : (
                  <div className="ast-form-group">
                    <label>Repair Cost (₹ INR)</label>
                    <input
                      type="number"
                      className="ast-input"
                      placeholder="e.g. 4500"
                      value={maintForm.cost}
                      onChange={(e) => setMaintForm({ ...maintForm, cost: e.target.value })}
                    />
                  </div>
                )}

                <div className="ast-form-group">
                  <label>Condition</label>
                  <select
                    className="ast-input"
                    value={maintForm.condition}
                    onChange={(e) => setMaintForm({ ...maintForm, condition: e.target.value })}
                  >
                    {ASSET_CONDITIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="ast-modal-footer">
                  <button type="button" className="ast-secondary-btn" onClick={() => setShowMaintenanceModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="ast-primary-btn" disabled={submitting}>
                    {submitting ? 'Updating...' : 'Update Maintenance'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL 8: LOST / DAMAGED MODAL ─── */}
        {showLostDamagedModal && activeAsset && (
          <div className="ast-modal-overlay">
            <div className="ast-modal-card sm">
              <div className="ast-modal-header">
                <h3>Flag Equipment — {activeAsset.assetCode}</h3>
                <button type="button" className="ast-modal-close" onClick={() => setShowLostDamagedModal(false)}>✕</button>
              </div>

              <form onSubmit={handleSaveLostDamaged} className="ast-modal-form">
                <div className="ast-form-group">
                  <label>Flag Type</label>
                  <select
                    className="ast-input"
                    value={lostDamagedForm.type}
                    onChange={(e) => setLostDamagedForm({ ...lostDamagedForm, type: e.target.value })}
                  >
                    <option value="Lost">Lost Equipment</option>
                    <option value="Damaged">Damaged / Destroyed</option>
                  </select>
                </div>

                <div className="ast-form-group">
                  <label>Incident Details / Reason <span className="req">*</span></label>
                  <textarea
                    className="ast-textarea"
                    rows="3"
                    placeholder="Provide details regarding the loss or physical damage..."
                    value={lostDamagedForm.reason}
                    onChange={(e) => setLostDamagedForm({ ...lostDamagedForm, reason: e.target.value })}
                    required
                  />
                </div>

                <div className="ast-modal-footer">
                  <button type="button" className="ast-secondary-btn" onClick={() => setShowLostDamagedModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="ast-danger-btn" disabled={submitting || !lostDamagedForm.reason.trim()}>
                    {submitting ? 'Flagging...' : `Confirm Flag as ${lostDamagedForm.type}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL 9: RETIRE / DISPOSE MODAL ─── */}
        {showRetireDisposeModal && activeAsset && (
          <div className="ast-modal-overlay">
            <div className="ast-modal-card sm">
              <div className="ast-modal-header">
                <h3>Retire or Dispose Asset — {activeAsset.assetCode}</h3>
                <button type="button" className="ast-modal-close" onClick={() => setShowRetireDisposeModal(false)}>✕</button>
              </div>

              <form onSubmit={handleSaveRetireDispose} className="ast-modal-form">
                <div className="ast-form-group">
                  <label>Action</label>
                  <select
                    className="ast-input"
                    value={retireDisposeForm.type}
                    onChange={(e) => setRetireDisposeForm({ ...retireDisposeForm, type: e.target.value })}
                  >
                    <option value="Retired">Retire Asset (End of Lifecycle)</option>
                    <option value="Disposed">Dispose / Scrap Asset (Sold / Recycled)</option>
                  </select>
                </div>

                <div className="ast-form-group">
                  <label>Reason & Disposal Details <span className="req">*</span></label>
                  <textarea
                    className="ast-textarea"
                    rows="3"
                    placeholder="e.g. Obsolete hardware replaced under refresh cycle. Complete historical records will remain preserved in MongoDB."
                    value={retireDisposeForm.reason}
                    onChange={(e) => setRetireDisposeForm({ ...retireDisposeForm, reason: e.target.value })}
                    required
                  />
                </div>

                <div className="ast-modal-footer">
                  <button type="button" className="ast-secondary-btn" onClick={() => setShowRetireDisposeModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="ast-danger-btn" disabled={submitting || !retireDisposeForm.reason.trim()}>
                    {submitting ? 'Processing...' : `Mark as ${retireDisposeForm.type}`}
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
