import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import apiClient from '../../../../../services/apiClient';
import UserLayout from '../components/UserLayout';
import './HRReports.css';

const OFFICIAL_DEPARTMENTS = ['All', 'HR', 'Finance', 'Business Development', 'Digital Marketing', 'Video Editor', 'Tech'];

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
  return `₹${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const initialsFor = (name, email) => {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return 'EM';
};

export default function HRReports() {
  const navigate = useNavigate();

  // Navigation Tabs: 10 Workspaces
  // 'overview' | 'workforce' | 'attendance' | 'leave' | 'payroll' | 'performance' | 'recruitment' | 'assets' | 'department_analytics' | 'employee_360'
  const [activeTab, setActiveTab] = useState('overview');

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [deptLoading, setDeptLoading] = useState(false);
  const [emp360Loading, setEmp360Loading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Primary Data Sources from MongoDB Atlas
  const [overviewData, setOverviewData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [performanceReviews, setPerformanceReviews] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [assets, setAssets] = useState([]);

  // Department Analytics state
  const [selectedDeptName, setSelectedDeptName] = useState('Tech');
  const [deptAnalyticsData, setDeptAnalyticsData] = useState(null);

  // Employee 360 state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [employee360Data, setEmployee360Data] = useState(null);

  // Search and Global Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // 1. Load Overview Aggregation and Domain Datasets
  const fetchAllReportData = useCallback(async () => {
    setLoading(true);
    setOverviewLoading(true);
    setError('');

    try {
      const [
        overviewRes,
        usersRes,
        deptRes,
        attRes,
        leaveRes,
        payRes,
        perfRes,
        candRes,
        assetRes,
      ] = await Promise.all([
        apiClient.get('/reports/hr/overview').catch(() => ({ data: { data: null } })),
        apiClient.get('/users').catch(() => ({ data: { data: [] } })),
        apiClient.get('/admin/departments').catch(() => apiClient.get('/departments')).catch(() => ({ data: { data: [] } })),
        apiClient.get('/attendance').catch(() => ({ data: { data: [] } })),
        apiClient.get('/leave-requests').catch(() => ({ data: { data: [] } })),
        apiClient.get('/payroll').catch(() => ({ data: { data: [] } })),
        apiClient.get('/performance').catch(() => ({ data: { data: [] } })),
        apiClient.get('/recruitment/candidates').catch(() => ({ data: { data: [] } })),
        apiClient.get('/assets').catch(() => ({ data: { data: { assets: [] } } })),
      ]);

      setOverviewData(overviewRes.data?.data || null);

      const allEmps = (usersRes.data?.data || []).filter((u) => u.role === 'employee');
      setEmployees(allEmps);
      setDepartments(deptRes.data?.data || []);
      setAttendances(attRes.data?.data || []);
      setLeaveRequests(leaveRes.data?.data || []);
      setPayrolls(payRes.data?.data || []);
      setPerformanceReviews(perfRes.data?.data || []);
      setCandidates(candRes.data?.data || []);
      setAssets(assetRes.data?.data?.assets || assetRes.data?.data || []);

      if (allEmps.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(allEmps[0]._id);
      }
    } catch (err) {
      console.error('Failed to load reports data', err);
      setError('Unable to load reporting datasets from server.');
    } finally {
      setLoading(false);
      setOverviewLoading(false);
    }
  }, [selectedEmployeeId]);

  useEffect(() => {
    fetchAllReportData();
  }, [fetchAllReportData]);

  // 2. Load Department Analytics when Department tab is active or selected department changes
  const fetchDeptAnalytics = useCallback(async (deptName) => {
    if (!deptName) return;
    setDeptLoading(true);
    try {
      const res = await apiClient.get('/reports/hr/department-analytics', {
        params: { department: deptName },
      });
      setDeptAnalyticsData(res.data?.data || null);
    } catch (err) {
      console.error('Failed to load department analytics', err);
    } finally {
      setDeptLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'department_analytics') {
      fetchDeptAnalytics(selectedDeptName);
    }
  }, [activeTab, selectedDeptName, fetchDeptAnalytics]);

  // 3. Load Employee 360 Dossier when Employee 360 tab is active or employee changes
  const fetchEmployee360 = useCallback(async (userId) => {
    if (!userId) return;
    setEmp360Loading(true);
    try {
      const res = await apiClient.get(`/reports/hr/employee-360/${userId}`);
      setEmployee360Data(res.data?.data || null);
    } catch (err) {
      console.error('Failed to load employee 360', err);
    } finally {
      setEmp360Loading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'employee_360' && selectedEmployeeId) {
      fetchEmployee360(selectedEmployeeId);
    }
  }, [activeTab, selectedEmployeeId, fetchEmployee360]);

  // Filtered Datasets based on search and global filters
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const name = e.personalInfo?.fullName || `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email;
      const dept = e.jobDetails?.department || e.department || 'Unassigned';
      const status = e.isActive ? 'Active' : 'Inactive';

      const matchesSearch = !searchTerm || name.toLowerCase().includes(searchTerm.toLowerCase()) || e.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = filterDept === 'All' || dept.toLowerCase() === filterDept.toLowerCase();
      const matchesStatus = filterStatus === 'All' || status.toLowerCase() === filterStatus.toLowerCase();

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [employees, searchTerm, filterDept, filterStatus]);

  const filteredAttendance = useMemo(() => {
    return attendances.filter((a) => {
      const empName = a.user ? `${a.user.firstName || ''} ${a.user.lastName || ''}`.trim() || a.user.email : '';
      const dept = a.user?.department || '—';
      const matchesSearch = !searchTerm || empName.toLowerCase().includes(searchTerm.toLowerCase()) || (a.date && a.date.includes(searchTerm));
      const matchesDept = filterDept === 'All' || dept.toLowerCase() === filterDept.toLowerCase();
      const matchesStatus = filterStatus === 'All' || (a.status || '').toLowerCase() === filterStatus.toLowerCase();
      const matchesDateFrom = !filterDateFrom || a.date >= filterDateFrom;
      const matchesDateTo = !filterDateTo || a.date <= filterDateTo;

      return matchesSearch && matchesDept && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [attendances, searchTerm, filterDept, filterStatus, filterDateFrom, filterDateTo]);

  const filteredLeaves = useMemo(() => {
    return leaveRequests.filter((l) => {
      const empName = l.user ? `${l.user.firstName || ''} ${l.user.lastName || ''}`.trim() || l.user.email : '';
      const dept = l.user?.department || '—';
      const matchesSearch = !searchTerm || empName.toLowerCase().includes(searchTerm.toLowerCase()) || (l.reason && l.reason.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesDept = filterDept === 'All' || dept.toLowerCase() === filterDept.toLowerCase();
      const matchesStatus = filterStatus === 'All' || (l.status || '').toLowerCase() === filterStatus.toLowerCase();

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [leaveRequests, searchTerm, filterDept, filterStatus]);

  const filteredPayrolls = useMemo(() => {
    return payrolls.filter((p) => {
      const empName = p.user ? `${p.user.firstName || ''} ${p.user.lastName || ''}`.trim() || p.user.email : '';
      const dept = p.user?.department || '—';
      const matchesSearch = !searchTerm || empName.toLowerCase().includes(searchTerm.toLowerCase()) || (p.payPeriod && p.payPeriod.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesDept = filterDept === 'All' || dept.toLowerCase() === filterDept.toLowerCase();
      const matchesStatus = filterStatus === 'All' || (p.status || '').toLowerCase() === filterStatus.toLowerCase();

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [payrolls, searchTerm, filterDept, filterStatus]);

  const filteredPerformance = useMemo(() => {
    return performanceReviews.filter((r) => {
      const empName = r.user ? `${r.user.firstName || ''} ${r.user.lastName || ''}`.trim() || r.user.email : '';
      const dept = r.user?.department || '—';
      const matchesSearch = !searchTerm || empName.toLowerCase().includes(searchTerm.toLowerCase()) || (r.reviewCycle && r.reviewCycle.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesDept = filterDept === 'All' || dept.toLowerCase() === filterDept.toLowerCase();
      const matchesStatus = filterStatus === 'All' || (r.status || '').toLowerCase() === filterStatus.toLowerCase();

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [performanceReviews, searchTerm, filterDept, filterStatus]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const matchesSearch = !searchTerm || (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) || (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) || (c.appliedPosition && c.appliedPosition.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesDept = filterDept === 'All' || (c.department && c.department.toLowerCase() === filterDept.toLowerCase());
      const matchesStatus = filterStatus === 'All' || (c.status && c.status.toLowerCase() === filterStatus.toLowerCase()) || (c.stage && c.stage.toLowerCase() === filterStatus.toLowerCase());

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [candidates, searchTerm, filterDept, filterStatus]);

  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      const assignedName = a.assignedTo ? (a.assignedTo.personalInfo?.fullName || `${a.assignedTo.firstName || ''} ${a.assignedTo.lastName || ''}`.trim() || a.assignedTo.email) : '';
      const matchesSearch = !searchTerm || (a.assetName && a.assetName.toLowerCase().includes(searchTerm.toLowerCase())) || (a.assetCode && a.assetCode.toLowerCase().includes(searchTerm.toLowerCase())) || (a.brand && a.brand.toLowerCase().includes(searchTerm.toLowerCase())) || assignedName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = filterDept === 'All' || (a.department && a.department.toLowerCase() === filterDept.toLowerCase());
      const matchesStatus = filterStatus === 'All' || (a.status && a.status.toLowerCase() === filterStatus.toLowerCase());

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [assets, searchTerm, filterDept, filterStatus]);

  // Helper to auto-fit Excel column widths
  const autoFitColumns = (jsonRows) => {
    if (!jsonRows || jsonRows.length === 0) return [];
    const keys = Object.keys(jsonRows[0] || {});
    return keys.map((key) => {
      let maxLen = String(key).length;
      jsonRows.forEach((row) => {
        const val = row[key];
        const len = val != null ? String(val).length : 0;
        if (len > maxLen) maxLen = len;
      });
      return { wch: Math.min(Math.max(maxLen + 3, 14), 60) };
    });
  };

  // Real Excel (.xlsx) Multi-Sheet Export Engine using SheetJS
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const dateStamp = new Date().toISOString().slice(0, 10);
      let filename = `HR_${activeTab}_Report_${dateStamp}.xlsx`;

      if (activeTab === 'overview') {
        filename = `HR_Executive_Overview_Report_${dateStamp}.xlsx`;

        // Sheet 1: Executive KPI Metrics
        const kpiRows = [
          { 'Metric Category': 'Total Workforce', 'Metric Value': overviewData?.totalEmployees || 0, 'Notes / Subtext': `${overviewData?.activeEmployees || 0} Active Staff` },
          { 'Metric Category': "Today's Attendance Rate", 'Metric Value': `${overviewData?.todayAttendance?.attendanceRatePercent || 0}%`, 'Notes / Subtext': `${overviewData?.todayAttendance?.present || 0} Present, ${overviewData?.todayAttendance?.late || 0} Late` },
          { 'Metric Category': 'Pending Leave Approvals', 'Metric Value': overviewData?.leaveMetrics?.pending || 0, 'Notes / Subtext': `${overviewData?.leaveMetrics?.onLeaveToday || 0} currently on leave` },
          { 'Metric Category': 'Monthly Gross Payroll (INR)', 'Metric Value': overviewData?.payrollMetrics?.totalGross || 0, 'Notes / Subtext': `Net: ₹${overviewData?.payrollMetrics?.totalNet || 0}` },
          { 'Metric Category': 'Average Performance Score', 'Metric Value': overviewData?.performanceMetrics?.averageScore ? `${overviewData.performanceMetrics.averageScore} / 5.0` : '—', 'Notes / Subtext': `${overviewData?.performanceMetrics?.totalReviews || 0} Reviews Completed` },
          { 'Metric Category': 'Open Job Requisitions', 'Metric Value': overviewData?.recruitmentMetrics?.openPositions || 0, 'Notes / Subtext': `${overviewData?.recruitmentMetrics?.totalCandidates || 0} Candidates in pipeline` },
          { 'Metric Category': 'Corporate Asset Fleet Valuation (INR)', 'Metric Value': overviewData?.assetMetrics?.totalValuation || 0, 'Notes / Subtext': `${overviewData?.assetMetrics?.total || 0} Total Assets` },
        ];
        const wsKPI = XLSX.utils.json_to_sheet(kpiRows);
        wsKPI['!cols'] = autoFitColumns(kpiRows);
        XLSX.utils.book_append_sheet(wb, wsKPI, 'Executive Summary');

        // Sheet 2: Workforce Roster
        const empRows = filteredEmployees.map((e) => ({
          'Employee ID': e.jobDetails?.employeeId || `EMP-${String(e._id).slice(-5).toUpperCase()}`,
          'Full Name': e.personalInfo?.fullName || `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email,
          'Email Address': e.email || '',
          'Phone Number': e.personalInfo?.phone || e.phone || '—',
          'Department': e.jobDetails?.department || e.department || 'Unassigned',
          'Designation': e.jobDetails?.designation || e.designation || 'Staff',
          'Employment Status': e.isActive ? 'Active' : 'Inactive',
          'Joining Date': formatDate(e.jobDetails?.joiningDate || e.createdAt),
        }));
        const wsEmp = XLSX.utils.json_to_sheet(empRows);
        wsEmp['!cols'] = autoFitColumns(empRows);
        XLSX.utils.book_append_sheet(wb, wsEmp, 'Workforce Directory');

        // Sheet 3: Department Breakdown
        const deptRows = Object.entries(overviewData?.departmentHeadcounts || {}).map(([dept, count]) => ({
          'Department Name': dept,
          'Headcount': count,
          'Percentage of Total': `${overviewData?.totalEmployees > 0 ? Math.round((count / overviewData.totalEmployees) * 100) : 0}%`,
        }));
        const wsDept = XLSX.utils.json_to_sheet(deptRows);
        wsDept['!cols'] = autoFitColumns(deptRows);
        XLSX.utils.book_append_sheet(wb, wsDept, 'Department Distribution');

      } else if (activeTab === 'workforce') {
        filename = `HR_Workforce_Directory_${dateStamp}.xlsx`;
        const rows = filteredEmployees.map((e) => ({
          'Employee ID': e.jobDetails?.employeeId || `EMP-${String(e._id).slice(-5).toUpperCase()}`,
          'Full Name': e.personalInfo?.fullName || `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email,
          'Email Address': e.email || '',
          'Phone Number': e.personalInfo?.phone || e.phone || '—',
          'Department': e.jobDetails?.department || e.department || 'Unassigned',
          'Designation': e.jobDetails?.designation || e.designation || 'Staff',
          'Employment Status': e.isActive ? 'Active' : 'Inactive',
          'Joining Date': formatDate(e.jobDetails?.joiningDate || e.createdAt),
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = autoFitColumns(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Workforce Directory');

      } else if (activeTab === 'attendance') {
        filename = `HR_Attendance_Log_Report_${dateStamp}.xlsx`;
        const rows = filteredAttendance.map((a) => ({
          'Log Date': a.date || '',
          'Employee Name': a.user ? `${a.user.firstName || ''} ${a.user.lastName || ''}`.trim() || a.user.email : '—',
          'Department': a.user?.department || '—',
          'Check In Time': a.checkIn ? new Date(a.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
          'Check Out Time': a.checkOut ? new Date(a.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
          'Total Working Minutes': a.totalWorkingMinutes || 0,
          'Total Working Hours': a.totalWorkingMinutes ? `${Math.floor(a.totalWorkingMinutes / 60)}h ${a.totalWorkingMinutes % 60}m` : '0h 0m',
          'Attendance Status': a.status || '—',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = autoFitColumns(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance Logs');

      } else if (activeTab === 'leave') {
        filename = `HR_Leave_Requests_Report_${dateStamp}.xlsx`;
        const rows = filteredLeaves.map((l) => ({
          'Employee Name': l.user ? `${l.user.firstName || ''} ${l.user.lastName || ''}`.trim() || l.user.email : '—',
          'Department': l.user?.department || '—',
          'Leave Category': l.type || '—',
          'Start Date': formatDate(l.startDate),
          'End Date': formatDate(l.endDate),
          'Reason / Notes': l.reason || '—',
          'Approval Status': l.status || '—',
          'Request Date': formatDate(l.createdAt),
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = autoFitColumns(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Leave Requests');

      } else if (activeTab === 'payroll') {
        filename = `HR_Payroll_Summary_Report_${dateStamp}.xlsx`;
        const rows = filteredPayrolls.map((p) => ({
          'Employee Name': p.user ? `${p.user.firstName || ''} ${p.user.lastName || ''}`.trim() || p.user.email : '—',
          'Department': p.user?.department || '—',
          'Pay Period': p.payPeriod || '—',
          'Disbursement Date': formatDate(p.effectiveDate || p.createdAt),
          'Gross Salary (INR)': p.gross || 0,
          'Total Deductions (INR)': p.totalDeduction || p.deductions || 0,
          'Net Payout (INR)': p.net || 0,
          'Payment Status': p.status || '—',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = autoFitColumns(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Payroll Summary');

      } else if (activeTab === 'performance') {
        filename = `HR_Performance_Reviews_Report_${dateStamp}.xlsx`;
        const rows = filteredPerformance.map((r) => ({
          'Employee Name': r.user ? `${r.user.firstName || ''} ${r.user.lastName || ''}`.trim() || r.user.email : '—',
          'Department': r.user?.department || '—',
          'Review Cycle': r.reviewCycle || '—',
          'Overall Score (1-5)': r.overallScore ? Number(r.overallScore).toFixed(1) : '—',
          'Productivity (1-5)': r.ratings?.productivity || '—',
          'Quality of Work (1-5)': r.ratings?.qualityOfWork || '—',
          'Teamwork (1-5)': r.ratings?.teamwork || '—',
          'Communication (1-5)': r.ratings?.communication || '—',
          'Problem Solving (1-5)': r.ratings?.problemSolving || '—',
          'Review Status': r.status || '—',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = autoFitColumns(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Performance Appraisals');

      } else if (activeTab === 'recruitment') {
        filename = `HR_Hiring_Pipeline_Report_${dateStamp}.xlsx`;
        const rows = filteredCandidates.map((c) => ({
          'Candidate Name': c.name || '',
          'Email Address': c.email || '',
          'Applied Position': c.appliedPosition || '—',
          'Department': c.department || '—',
          'Experience Level': c.experience || '—',
          'Pipeline Stage': c.stage || 'Applied',
          'Hiring Status': c.status || 'Pending',
          'Application Date': formatDate(c.createdAt),
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = autoFitColumns(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Candidate Pipeline');

      } else if (activeTab === 'assets') {
        filename = `HR_Asset_Inventory_Report_${dateStamp}.xlsx`;
        const rows = filteredAssets.map((a) => ({
          'Asset Name': a.assetName || '',
          'Asset Code': a.assetCode || '',
          'Category': a.category || '',
          'Brand / Manufacturer': a.brand || '—',
          'Model / Specs': a.model || '—',
          'Serial Number': a.serialNumber || '—',
          'Assigned Employee': a.assignedTo
            ? (a.assignedTo.personalInfo?.fullName || `${a.assignedTo.firstName || ''} ${a.assignedTo.lastName || ''}`.trim() || a.assignedTo.email)
            : 'Unallocated (In Stock)',
          'Condition': a.condition || 'Good',
          'Lifecycle Status': a.status || 'Available',
          'Purchase Cost (INR)': a.purchaseCost || 0,
          'Purchase Date': formatDate(a.purchaseDate),
          'Warranty Expiry': formatDate(a.warrantyExpiry),
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = autoFitColumns(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'Asset Inventory');

      } else if (activeTab === 'department_analytics' && deptAnalyticsData) {
        filename = `HR_Department_${deptAnalyticsData.departmentName}_Analytics_${dateStamp}.xlsx`;

        // Sheet 1: Department Overview
        const summaryRows = [
          { 'Metric': 'Department Name', 'Value': deptAnalyticsData.departmentName },
          { 'Metric': 'Department Manager', 'Value': deptAnalyticsData.manager },
          { 'Metric': 'Total Staff Headcount', 'Value': deptAnalyticsData.headcount },
          { 'Metric': 'Active Staff Count', 'Value': deptAnalyticsData.activeCount },
          { 'Metric': 'Monthly Gross Payroll (INR)', 'Value': deptAnalyticsData.totalGrossSalary },
          { 'Metric': 'Monthly Net Payroll (INR)', 'Value': deptAnalyticsData.totalNetSalary },
          { 'Metric': 'Average Performance Rating', 'Value': deptAnalyticsData.averagePerformanceScore || '—' },
          { 'Metric': 'Assigned Hardware Fleet Count', 'Value': deptAnalyticsData.totalAssetsCount },
          { 'Metric': 'Total Hardware Fleet Value (INR)', 'Value': deptAnalyticsData.totalAssetValuation },
          { 'Metric': 'Open Job Requisitions', 'Value': deptAnalyticsData.openPositionsCount },
        ];
        const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
        wsSummary['!cols'] = autoFitColumns(summaryRows);
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Department Summary');

        // Sheet 2: Staff Roster
        const rosterRows = (deptAnalyticsData.employeeRoster || []).map((e) => ({
          'Employee ID': e.employeeCode,
          'Full Name': e.name,
          'Email Address': e.email,
          'Designation': e.designation,
          'Attendance Logs Count': e.attendanceCount,
          'Leaves Taken Count': e.leavesCount,
          'Last Net Salary (INR)': e.lastNetSalary,
          'Performance Score': e.performanceScore || '—',
          'Assigned Hardware Count': e.assignedAssetsCount,
        }));
        const wsRoster = XLSX.utils.json_to_sheet(rosterRows);
        wsRoster['!cols'] = autoFitColumns(rosterRows);
        XLSX.utils.book_append_sheet(wb, wsRoster, 'Staff Roster');

      } else if (activeTab === 'employee_360' && employee360Data) {
        filename = `HR_Employee_360_${employee360Data.profile.employeeId}_${dateStamp}.xlsx`;

        // Sheet 1: Profile & Summary Metrics
        const profileRows = [
          { 'Field': 'Full Name', 'Value': employee360Data.profile.fullName },
          { 'Field': 'Employee ID', 'Value': employee360Data.profile.employeeId },
          { 'Field': 'Email Address', 'Value': employee360Data.profile.email },
          { 'Field': 'Phone Number', 'Value': employee360Data.profile.phone },
          { 'Field': 'Department', 'Value': employee360Data.profile.department },
          { 'Field': 'Designation', 'Value': employee360Data.profile.designation },
          { 'Field': 'Employment Status', 'Value': employee360Data.profile.employmentStatus },
          { 'Field': 'Employment Type', 'Value': employee360Data.profile.employmentType },
          { 'Field': 'Joining Date', 'Value': formatDate(employee360Data.profile.joiningDate) },
          { 'Field': 'Reporting Manager', 'Value': employee360Data.profile.reportingManager },
          { 'Field': 'Work Location', 'Value': employee360Data.profile.workLocation },
          { 'Field': 'Attendance Rate', 'Value': `${employee360Data.attendanceSummary?.attendanceRatePercent || 0}%` },
          { 'Field': 'Total Days Recorded', 'Value': employee360Data.attendanceSummary?.totalDaysRecorded || 0 },
          { 'Field': 'Approved Leaves Count', 'Value': employee360Data.leaveSummary?.approved || 0 },
          { 'Field': 'Pending Leaves Count', 'Value': employee360Data.leaveSummary?.pending || 0 },
          { 'Field': 'Base Compensation (INR)', 'Value': employee360Data.payrollSummary?.baseSalary || 0 },
          { 'Field': 'Average Performance Rating', 'Value': employee360Data.performanceSummary?.averageScore || '—' },
          { 'Field': 'Verified Documents Vault Count', 'Value': employee360Data.documentSummary?.verified || 0 },
          { 'Field': 'Assigned Hardware Count', 'Value': employee360Data.assetSummary?.assignedCount || 0 },
          { 'Field': 'Total Hardware Fleet Valuation (INR)', 'Value': employee360Data.assetSummary?.totalValuation || 0 },
        ];
        const wsProfile = XLSX.utils.json_to_sheet(profileRows);
        wsProfile['!cols'] = autoFitColumns(profileRows);
        XLSX.utils.book_append_sheet(wb, wsProfile, 'Profile & Summary');

        // Sheet 2: Recent Attendance Logs
        if (employee360Data.attendanceSummary?.recentLogs?.length > 0) {
          const attRows = employee360Data.attendanceSummary.recentLogs.map((a) => ({
            'Log Date': a.date,
            'Check In': a.checkIn ? new Date(a.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
            'Check Out': a.checkOut ? new Date(a.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
            'Total Working Minutes': a.totalWorkingMinutes || 0,
            'Status': a.status || '—',
          }));
          const wsAtt = XLSX.utils.json_to_sheet(attRows);
          wsAtt['!cols'] = autoFitColumns(attRows);
          XLSX.utils.book_append_sheet(wb, wsAtt, 'Attendance Logs');
        }

        // Sheet 3: Recent Leave Requests
        if (employee360Data.leaveSummary?.recentRequests?.length > 0) {
          const leaveRows = employee360Data.leaveSummary.recentRequests.map((l) => ({
            'Leave Type': l.type,
            'Start Date': formatDate(l.startDate),
            'End Date': formatDate(l.endDate),
            'Reason': l.reason || '—',
            'Status': l.status || '—',
          }));
          const wsLeave = XLSX.utils.json_to_sheet(leaveRows);
          wsLeave['!cols'] = autoFitColumns(leaveRows);
          XLSX.utils.book_append_sheet(wb, wsLeave, 'Leave Requests');
        }

        // Sheet 4: Payroll History
        if (employee360Data.payrollSummary?.recentPayrolls?.length > 0) {
          const payRows = employee360Data.payrollSummary.recentPayrolls.map((p) => ({
            'Pay Period': p.payPeriod,
            'Disbursement Date': formatDate(p.effectiveDate || p.createdAt),
            'Gross Salary (INR)': p.gross || 0,
            'Deductions (INR)': p.totalDeduction || p.deductions || 0,
            'Net Payout (INR)': p.net || 0,
            'Status': p.status || '—',
          }));
          const wsPay = XLSX.utils.json_to_sheet(payRows);
          wsPay['!cols'] = autoFitColumns(payRows);
          XLSX.utils.book_append_sheet(wb, wsPay, 'Payroll History');
        }

        // Sheet 5: Performance Reviews
        if (employee360Data.performanceSummary?.reviewsList?.length > 0) {
          const perfRows = employee360Data.performanceSummary.reviewsList.map((r) => ({
            'Review Cycle': r.reviewCycle,
            'Overall Score (1-5)': r.overallScore ? Number(r.overallScore).toFixed(1) : '—',
            'Productivity (1-5)': r.ratings?.productivity || '—',
            'Quality of Work (1-5)': r.ratings?.qualityOfWork || '—',
            'Teamwork (1-5)': r.ratings?.teamwork || '—',
            'Communication (1-5)': r.ratings?.communication || '—',
            'Status': r.status || '—',
          }));
          const wsPerf = XLSX.utils.json_to_sheet(perfRows);
          wsPerf['!cols'] = autoFitColumns(perfRows);
          XLSX.utils.book_append_sheet(wb, wsPerf, 'Performance Reviews');
        }

        // Sheet 6: Assigned Hardware
        if (employee360Data.assetSummary?.assignedAssets?.length > 0) {
          const assetRows = employee360Data.assetSummary.assignedAssets.map((a) => ({
            'Asset Name': a.assetName,
            'Asset Code': a.assetCode,
            'Category': a.category,
            'Brand / Model': `${a.brand || ''} ${a.model || ''}`.trim(),
            'Condition': a.condition || 'Good',
            'Purchase Cost (INR)': a.purchaseCost || 0,
          }));
          const wsAsset = XLSX.utils.json_to_sheet(assetRows);
          wsAsset['!cols'] = autoFitColumns(assetRows);
          XLSX.utils.book_append_sheet(wb, wsAsset, 'Hardware Assets');
        }

        // Sheet 7: Documents Vault
        if (employee360Data.documentSummary?.documentsList?.length > 0) {
          const docRows = employee360Data.documentSummary.documentsList.map((d) => ({
            'Document Title': d.title || d.documentType || 'Document',
            'Category': d.category || 'General',
            'Verification Status': d.status || 'Pending',
            'Upload Date': formatDate(d.createdAt),
          }));
          const wsDoc = XLSX.utils.json_to_sheet(docRows);
          wsDoc['!cols'] = autoFitColumns(docRows);
          XLSX.utils.book_append_sheet(wb, wsDoc, 'Document Vault');
        }
      }

      // Generate actual binary XLSX workbook and trigger download
      XLSX.writeFile(wb, filename);

      setSuccess('Excel report exported successfully.');
    } catch (err) {
      console.error('Failed to export Excel report', err);
      setError('Unable to export Excel report. Please try again.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterDept('All');
    setFilterStatus('All');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  return (
    <UserLayout pageTitle="Reports & Analytics Center">
      <div className="hr-rep-container">
        {/* ─── 1. Header Toolbar ─── */}
        <div className="hr-rep-header">
          <div className="hr-rep-title-meta">
            <h2>HR Reports & Analytics Center</h2>
            <p>Unified enterprise reporting, department intelligence, cross-module analytics & employee 360° dossiers.</p>
          </div>
          <div className="hr-rep-header-actions">
            <button type="button" className="hr-rep-btn secondary" onClick={fetchAllReportData} title="Refresh live MongoDB Atlas data">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              Refresh
            </button>
            <button type="button" className="hr-rep-btn secondary" onClick={handleExportExcel} title="Export current filtered report to Microsoft Excel (.xlsx)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="8" y1="13" x2="16" y2="13" />
                <line x1="8" y1="17" x2="16" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Export Excel
            </button>
            <button type="button" className="hr-rep-btn primary" onClick={handlePrint} title="Print or save as PDF">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print / PDF
            </button>
          </div>
        </div>

        {/* ─── Feedback Alerts ─── */}
        {error && (
          <div className="hr-rep-alert error">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')}>✕</button>
          </div>
        )}
        {success && (
          <div className="hr-rep-alert success">
            <span>{success}</span>
            <button type="button" onClick={() => setSuccess('')}>✕</button>
          </div>
        )}

        {/* ─── 2. 10 Navigation Workspaces Bar ─── */}
        <div className="hr-rep-tabs-wrap">
          <div className="hr-rep-tabs">
            <button
              type="button"
              className={`hr-rep-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              📊 Executive Overview
            </button>
            <button
              type="button"
              className={`hr-rep-tab-btn ${activeTab === 'workforce' ? 'active' : ''}`}
              onClick={() => setActiveTab('workforce')}
            >
              👥 Workforce ({employees.length})
            </button>
            <button
              type="button"
              className={`hr-rep-tab-btn ${activeTab === 'attendance' ? 'active' : ''}`}
              onClick={() => setActiveTab('attendance')}
            >
              ⏱️ Attendance ({attendances.length})
            </button>
            <button
              type="button"
              className={`hr-rep-tab-btn ${activeTab === 'leave' ? 'active' : ''}`}
              onClick={() => setActiveTab('leave')}
            >
              🏖️ Leave ({leaveRequests.length})
            </button>
            <button
              type="button"
              className={`hr-rep-tab-btn ${activeTab === 'payroll' ? 'active' : ''}`}
              onClick={() => setActiveTab('payroll')}
            >
              💰 Payroll ({payrolls.length})
            </button>
            <button
              type="button"
              className={`hr-rep-tab-btn ${activeTab === 'performance' ? 'active' : ''}`}
              onClick={() => setActiveTab('performance')}
            >
              ⭐ Performance ({performanceReviews.length})
            </button>
            <button
              type="button"
              className={`hr-rep-tab-btn ${activeTab === 'recruitment' ? 'active' : ''}`}
              onClick={() => setActiveTab('recruitment')}
            >
              🎯 Hiring ({candidates.length})
            </button>
            <button
              type="button"
              className={`hr-rep-tab-btn ${activeTab === 'assets' ? 'active' : ''}`}
              onClick={() => setActiveTab('assets')}
            >
              💻 Assets ({assets.length})
            </button>
            <button
              type="button"
              className={`hr-rep-tab-btn ${activeTab === 'department_analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('department_analytics')}
            >
              🏢 Department 360°
            </button>
            <button
              type="button"
              className={`hr-rep-tab-btn ${activeTab === 'employee_360' ? 'active' : ''}`}
              onClick={() => setActiveTab('employee_360')}
            >
              👤 Employee 360°
            </button>
          </div>
        </div>

        {/* ─── 3. Global Filters Toolbar (Applicable across report tabs) ─── */}
        {activeTab !== 'overview' && activeTab !== 'department_analytics' && activeTab !== 'employee_360' && (
          <div className="hr-rep-filter-toolbar">
            <div className="hr-rep-search-wrap">
              <svg className="hr-rep-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="hr-rep-search-input"
                placeholder="Search by employee, email, code, position, or asset..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Department Filter */}
            <select
              className="hr-rep-select"
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
            >
              {OFFICIAL_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>{dept === 'All' ? 'All Departments' : dept}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              className="hr-rep-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active / Present / Approved / Paid</option>
              <option value="Pending">Pending</option>
              <option value="Inactive">Inactive / Rejected / Under Repair</option>
            </select>

            {/* Date Range Filters (Attendance) */}
            {activeTab === 'attendance' && (
              <div className="hr-rep-date-inputs">
                <input
                  type="date"
                  className="hr-rep-date-picker"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  title="From Date"
                />
                <span>to</span>
                <input
                  type="date"
                  className="hr-rep-date-picker"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  title="To Date"
                />
              </div>
            )}

            {(searchTerm || filterDept !== 'All' || filterStatus !== 'All' || filterDateFrom || filterDateTo) && (
              <button type="button" className="hr-rep-reset-btn" onClick={handleResetFilters}>
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            WORKSPACE 1: EXECUTIVE OVERVIEW DASHBOARD
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="hr-rep-workspace">
            {overviewLoading ? (
              <div className="hr-rep-loading">
                <div className="hr-rep-spinner" />
                <p>Aggregating executive HR analytics from MongoDB Atlas...</p>
              </div>
            ) : !overviewData ? (
              <div className="hr-rep-empty">No overview data available.</div>
            ) : (
              <>
                {/* 8 Executive KPI Metric Cards */}
                <div className="hr-rep-kpi-grid">
                  {/* Card 1: Total Workforce */}
                  <div className="hr-rep-kpi-card blue" onClick={() => setActiveTab('workforce')}>
                    <div className="hr-rep-kpi-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <div className="hr-rep-kpi-body">
                      <span className="hr-rep-kpi-label">Total Workforce</span>
                      <strong className="hr-rep-kpi-value">{overviewData.totalEmployees}</strong>
                    </div>
                  </div>

                  {/* Card 2: Today's Attendance */}
                  <div className="hr-rep-kpi-card emerald" onClick={() => setActiveTab('attendance')}>
                    <div className="hr-rep-kpi-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div className="hr-rep-kpi-body">
                      <span className="hr-rep-kpi-label">Today's Attendance</span>
                      <strong className="hr-rep-kpi-value">{overviewData.todayAttendance?.attendanceRatePercent || 0}%</strong>
                    </div>
                  </div>

                  {/* Card 3: Leave Pipeline */}
                  <div className="hr-rep-kpi-card amber" onClick={() => setActiveTab('leave')}>
                    <div className="hr-rep-kpi-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>
                    <div className="hr-rep-kpi-body">
                      <span className="hr-rep-kpi-label">Pending Leaves</span>
                      <strong className="hr-rep-kpi-value">{overviewData.leaveMetrics?.pending || 0}</strong>
                    </div>
                  </div>

                  {/* Card 4: Monthly Payroll */}
                  <div className="hr-rep-kpi-card purple" onClick={() => setActiveTab('payroll')}>
                    <div className="hr-rep-kpi-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    </div>
                    <div className="hr-rep-kpi-body">
                      <span className="hr-rep-kpi-label">Gross Payroll</span>
                      <strong className="hr-rep-kpi-value">{formatINR(overviewData.payrollMetrics?.totalGross)}</strong>
                    </div>
                  </div>

                  {/* Card 5: Performance Rating */}
                  <div className="hr-rep-kpi-card orange" onClick={() => setActiveTab('performance')}>
                    <div className="hr-rep-kpi-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </div>
                    <div className="hr-rep-kpi-body">
                      <span className="hr-rep-kpi-label">Avg Performance</span>
                      <strong className="hr-rep-kpi-value">{overviewData.performanceMetrics?.averageScore ? `${overviewData.performanceMetrics.averageScore} / 5.0` : '—'}</strong>
                    </div>
                  </div>

                  {/* Card 6: Hiring & Recruitment */}
                  <div className="hr-rep-kpi-card indigo" onClick={() => setActiveTab('recruitment')}>
                    <div className="hr-rep-kpi-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M16 8l-8 8" />
                        <path d="M8 8h8v8" />
                      </svg>
                    </div>
                    <div className="hr-rep-kpi-body">
                      <span className="hr-rep-kpi-label">Open Positions</span>
                      <strong className="hr-rep-kpi-value">{overviewData.recruitmentMetrics?.openPositions || 0}</strong>
                    </div>
                  </div>

                  {/* Card 7: Asset Valuation */}
                  <div className="hr-rep-kpi-card cyan" onClick={() => setActiveTab('assets')}>
                    <div className="hr-rep-kpi-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                      </svg>
                    </div>
                    <div className="hr-rep-kpi-body">
                      <span className="hr-rep-kpi-label">Asset Valuation</span>
                      <strong className="hr-rep-kpi-value">{formatINR(overviewData.assetMetrics?.totalValuation)}</strong>
                    </div>
                  </div>

                  {/* Card 8: Active Departments */}
                  <div className="hr-rep-kpi-card slate" onClick={() => setActiveTab('department_analytics')}>
                    <div className="hr-rep-kpi-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 21h18M3 7v14M21 7v14M9 21V11M15 21V11M3 7l9-4 9 4" />
                      </svg>
                    </div>
                    <div className="hr-rep-kpi-body">
                      <span className="hr-rep-kpi-label">Departments</span>
                      <strong className="hr-rep-kpi-value">{Object.keys(overviewData.departmentHeadcounts || {}).length || 6}</strong>
                    </div>
                  </div>
                </div>

                {/* 4 Visual Breakdown Charts Grid */}
                <div className="hr-rep-charts-grid">
                  {/* Chart 1: Department Headcount Distribution */}
                  <div className="hr-rep-chart-card">
                    <div className="hr-rep-card-title-row">
                      <h4>Workforce by Department</h4>
                      <span className="hr-rep-chart-badge">{overviewData.totalEmployees} Staff</span>
                    </div>
                    <div className="hr-rep-bar-list">
                      {Object.entries(overviewData.departmentHeadcounts || {}).map(([dept, count]) => {
                        const pct = overviewData.totalEmployees > 0 ? Math.round((count / overviewData.totalEmployees) * 100) : 0;
                        return (
                          <div key={dept} className="hr-rep-bar-row">
                            <div className="hr-rep-bar-label-area">
                              <span>{dept}</span>
                              <strong>{count} ({pct}%)</strong>
                            </div>
                            <div className="hr-rep-progress-bg">
                              <div className="hr-rep-progress-fill orange" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Chart 2: Today's Attendance Distribution */}
                  <div className="hr-rep-chart-card">
                    <div className="hr-rep-card-title-row">
                      <h4>Today's Attendance Pulse</h4>
                      <span className="hr-rep-chart-badge green">{overviewData.todayAttendance?.attendanceRatePercent || 0}% Punctuality</span>
                    </div>
                    <div className="hr-rep-pulse-stats">
                      <div className="hr-rep-pulse-item green">
                        <span className="pulse-dot" />
                        <div>
                          <strong>{overviewData.todayAttendance?.present || 0}</strong>
                          <small>Present on Time</small>
                        </div>
                      </div>
                      <div className="hr-rep-pulse-item yellow">
                        <span className="pulse-dot" />
                        <div>
                          <strong>{overviewData.todayAttendance?.late || 0}</strong>
                          <small>Late Arrivals</small>
                        </div>
                      </div>
                      <div className="hr-rep-pulse-item red">
                        <span className="pulse-dot" />
                        <div>
                          <strong>{overviewData.leaveMetrics?.onLeaveToday || 0}</strong>
                          <small>Approved Leave</small>
                        </div>
                      </div>
                    </div>
                    <div className="hr-rep-attendance-bar-wrap">
                      <div
                        className="att-segment present"
                        style={{ width: `${Math.max(5, (overviewData.todayAttendance?.present / (overviewData.activeEmployees || 1)) * 100)}%` }}
                        title="Present"
                      />
                      <div
                        className="att-segment late"
                        style={{ width: `${Math.max(5, (overviewData.todayAttendance?.late / (overviewData.activeEmployees || 1)) * 100)}%` }}
                        title="Late"
                      />
                      <div
                        className="att-segment leave"
                        style={{ width: `${Math.max(5, (overviewData.leaveMetrics?.onLeaveToday / (overviewData.activeEmployees || 1)) * 100)}%` }}
                        title="On Leave"
                      />
                    </div>
                  </div>

                  {/* Chart 3: Payroll Expenditure Breakdown */}
                  <div className="hr-rep-chart-card">
                    <div className="hr-rep-card-title-row">
                      <h4>Compensation & Payroll</h4>
                      <span className="hr-rep-chart-badge purple">{formatINR(overviewData.payrollMetrics?.totalGross)}</span>
                    </div>
                    <div className="hr-rep-payroll-summary-pills">
                      <div className="payroll-pill-col">
                        <span>Net Payouts</span>
                        <strong style={{ color: '#059669' }}>{formatINR(overviewData.payrollMetrics?.totalNet)}</strong>
                      </div>
                      <div className="payroll-pill-col">
                        <span>Total Deductions</span>
                        <strong style={{ color: '#dc2626' }}>- {formatINR(overviewData.payrollMetrics?.totalDeductions)}</strong>
                      </div>
                    </div>
                    <div className="hr-rep-status-counts-row">
                      <span><strong>{overviewData.payrollMetrics?.paid || 0}</strong> Disbursed</span>
                      <span><strong>{overviewData.payrollMetrics?.processed || 0}</strong> Processed</span>
                      <span><strong>{overviewData.payrollMetrics?.pending || 0}</strong> Pending</span>
                    </div>
                  </div>

                  {/* Chart 4: Hardware Asset Allocation */}
                  <div className="hr-rep-chart-card">
                    <div className="hr-rep-card-title-row">
                      <h4>Asset & Hardware Fleet</h4>
                      <span className="hr-rep-chart-badge blue">{overviewData.assetMetrics?.total || 0} Assets</span>
                    </div>
                    <div className="hr-rep-pulse-stats">
                      <div className="hr-rep-pulse-item purple">
                        <div>
                          <strong>{overviewData.assetMetrics?.allocated || 0}</strong>
                          <small>Allocated (In Use)</small>
                        </div>
                      </div>
                      <div className="hr-rep-pulse-item green">
                        <div>
                          <strong>{overviewData.assetMetrics?.available || 0}</strong>
                          <small>Available (In Stock)</small>
                        </div>
                      </div>
                      <div className="hr-rep-pulse-item yellow">
                        <div>
                          <strong>{overviewData.assetMetrics?.underRepair || 0}</strong>
                          <small>Under Maintenance</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            WORKSPACE 2: WORKFORCE ANALYTICS
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'workforce' && (
          <div className="hr-rep-workspace">
            <div className="hr-rep-table-card">
              <div className="hr-rep-card-header">
                <div>
                  <h4>Workforce Directory & Headcount Report</h4>
                  <small>Showing {filteredEmployees.length} employee accounts from MongoDB Atlas</small>
                </div>
                <button type="button" className="hr-rep-action-link" onClick={() => navigate('/user/employees')}>
                  Manage in Employees →
                </button>
              </div>

              <div className="hr-rep-table-wrap">
                <table className="hr-rep-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Employee ID</th>
                      <th>Department</th>
                      <th>Designation</th>
                      <th>Phone</th>
                      <th>Joining Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.length === 0 ? (
                      <tr><td colSpan="7" className="hr-rep-empty">No employees match filters.</td></tr>
                    ) : (
                      filteredEmployees.map((e) => (
                        <tr key={e._id}>
                          <td>
                            <div className="hr-rep-user-cell">
                              <div className="hr-rep-avatar">{initialsFor(e.personalInfo?.fullName || `${e.firstName || ''} ${e.lastName || ''}`, e.email)}</div>
                              <div>
                                <strong>{e.personalInfo?.fullName || `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email}</strong>
                                <small>{e.email}</small>
                              </div>
                            </div>
                          </td>
                          <td><span className="hr-rep-code">{e.jobDetails?.employeeId || `EMP-${String(e._id).slice(-5).toUpperCase()}`}</span></td>
                          <td><span className="hr-rep-pill dept">{e.jobDetails?.department || e.department || 'Unassigned'}</span></td>
                          <td>{e.jobDetails?.designation || e.designation || 'Staff'}</td>
                          <td>{e.personalInfo?.phone || e.phone || '—'}</td>
                          <td>{formatDate(e.jobDetails?.joiningDate || e.createdAt)}</td>
                          <td>
                            <span className={`hr-rep-status-badge ${e.isActive ? 'active' : 'inactive'}`}>
                              {e.isActive ? 'Active' : 'Inactive'}
                            </span>
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

        {/* ════════════════════════════════════════════════════════════════
            WORKSPACE 3: ATTENDANCE ANALYTICS
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'attendance' && (
          <div className="hr-rep-workspace">
            <div className="hr-rep-table-card">
              <div className="hr-rep-card-header">
                <div>
                  <h4>Daily Attendance & Punctuality Log Report</h4>
                  <small>Showing {filteredAttendance.length} punch records from MongoDB Atlas</small>
                </div>
                <button type="button" className="hr-rep-action-link" onClick={() => navigate('/user/attendance')}>
                  Manage in Attendance →
                </button>
              </div>

              <div className="hr-rep-table-wrap">
                <table className="hr-rep-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Working Hours</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttendance.length === 0 ? (
                      <tr><td colSpan="7" className="hr-rep-empty">No attendance records found.</td></tr>
                    ) : (
                      filteredAttendance.map((a) => (
                        <tr key={a._id}>
                          <td><strong>{a.date}</strong></td>
                          <td>{a.user ? `${a.user.firstName || ''} ${a.user.lastName || ''}`.trim() || a.user.email : '—'}</td>
                          <td><span className="hr-rep-pill dept">{a.user?.department || '—'}</span></td>
                          <td>{a.checkIn ? new Date(a.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                          <td>{a.checkOut ? new Date(a.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                          <td>{a.totalWorkingMinutes ? `${Math.floor(a.totalWorkingMinutes / 60)}h ${a.totalWorkingMinutes % 60}m` : '—'}</td>
                          <td>
                            <span className={`hr-rep-status-badge ${a.status === 'Present' ? 'active' : a.status === 'Late' ? 'yellow' : 'inactive'}`}>
                              {a.status}
                            </span>
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

        {/* ════════════════════════════════════════════════════════════════
            WORKSPACE 4: LEAVE ANALYTICS
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'leave' && (
          <div className="hr-rep-workspace">
            <div className="hr-rep-table-card">
              <div className="hr-rep-card-header">
                <div>
                  <h4>Leave Applications & Utilization Report</h4>
                  <small>Showing {filteredLeaves.length} leave requests from MongoDB Atlas</small>
                </div>
                <button type="button" className="hr-rep-action-link" onClick={() => navigate('/user/leave-requests')}>
                  Manage in Leave Requests →
                </button>
              </div>

              <div className="hr-rep-table-wrap">
                <table className="hr-rep-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Leave Type</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Reason</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeaves.length === 0 ? (
                      <tr><td colSpan="7" className="hr-rep-empty">No leave requests found.</td></tr>
                    ) : (
                      filteredLeaves.map((l) => (
                        <tr key={l._id}>
                          <td><strong>{l.user ? `${l.user.firstName || ''} ${l.user.lastName || ''}`.trim() || l.user.email : '—'}</strong></td>
                          <td><span className="hr-rep-pill dept">{l.user?.department || '—'}</span></td>
                          <td><span className="hr-rep-pill type">{l.type}</span></td>
                          <td>{formatDate(l.startDate)}</td>
                          <td>{formatDate(l.endDate)}</td>
                          <td>{l.reason || '—'}</td>
                          <td>
                            <span className={`hr-rep-status-badge ${l.status === 'Approved' ? 'active' : l.status === 'Pending' ? 'yellow' : 'inactive'}`}>
                              {l.status}
                            </span>
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

        {/* ════════════════════════════════════════════════════════════════
            WORKSPACE 5: PAYROLL ANALYTICS
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'payroll' && (
          <div className="hr-rep-workspace">
            <div className="hr-rep-table-card">
              <div className="hr-rep-card-header">
                <div>
                  <h4>Payroll & Salary Disbursement Report</h4>
                  <small>Showing {filteredPayrolls.length} payroll records from MongoDB Atlas</small>
                </div>
                <button type="button" className="hr-rep-action-link" onClick={() => navigate('/user/payroll')}>
                  Manage in Payroll →
                </button>
              </div>

              <div className="hr-rep-table-wrap">
                <table className="hr-rep-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Pay Period</th>
                      <th>Effective Date</th>
                      <th>Gross Salary</th>
                      <th>Deductions</th>
                      <th>Net Payout</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayrolls.length === 0 ? (
                      <tr><td colSpan="7" className="hr-rep-empty">No payroll records found.</td></tr>
                    ) : (
                      filteredPayrolls.map((p) => (
                        <tr key={p._id}>
                          <td><strong>{p.user ? `${p.user.firstName || ''} ${p.user.lastName || ''}`.trim() || p.user.email : '—'}</strong></td>
                          <td>{p.payPeriod || '—'}</td>
                          <td>{formatDate(p.effectiveDate)}</td>
                          <td>{formatINR(p.gross)}</td>
                          <td style={{ color: '#dc2626' }}>- {formatINR(p.totalDeduction || p.deductions)}</td>
                          <td><strong style={{ color: '#059669' }}>{formatINR(p.net)}</strong></td>
                          <td>
                            <span className={`hr-rep-status-badge ${p.status === 'Paid' ? 'active' : p.status === 'Processed' ? 'yellow' : 'inactive'}`}>
                              {p.status}
                            </span>
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

        {/* ════════════════════════════════════════════════════════════════
            WORKSPACE 6: PERFORMANCE ANALYTICS
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'performance' && (
          <div className="hr-rep-workspace">
            <div className="hr-rep-table-card">
              <div className="hr-rep-card-header">
                <div>
                  <h4>Performance Appraisals & Competency Rating Report</h4>
                  <small>Showing {filteredPerformance.length} review evaluations from MongoDB Atlas</small>
                </div>
                <button type="button" className="hr-rep-action-link" onClick={() => navigate('/user/performance')}>
                  Manage in Performance →
                </button>
              </div>

              <div className="hr-rep-table-wrap">
                <table className="hr-rep-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Review Cycle</th>
                      <th>Overall Score</th>
                      <th>Productivity</th>
                      <th>Quality</th>
                      <th>Teamwork</th>
                      <th>Communication</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPerformance.length === 0 ? (
                      <tr><td colSpan="8" className="hr-rep-empty">No performance reviews found.</td></tr>
                    ) : (
                      filteredPerformance.map((r) => (
                        <tr key={r._id}>
                          <td><strong>{r.user ? `${r.user.firstName || ''} ${r.user.lastName || ''}`.trim() || r.user.email : '—'}</strong></td>
                          <td>{r.reviewCycle || '—'}</td>
                          <td><strong style={{ color: '#ea580c' }}>{r.overallScore ? `${Number(r.overallScore).toFixed(1)} / 5.0` : '—'}</strong></td>
                          <td>{r.ratings?.productivity || '—'}/5</td>
                          <td>{r.ratings?.qualityOfWork || '—'}/5</td>
                          <td>{r.ratings?.teamwork || '—'}/5</td>
                          <td>{r.ratings?.communication || '—'}/5</td>
                          <td>
                            <span className={`hr-rep-status-badge ${r.status === 'Completed' ? 'active' : 'yellow'}`}>
                              {r.status}
                            </span>
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

        {/* ════════════════════════════════════════════════════════════════
            WORKSPACE 7: RECRUITMENT ANALYTICS
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'recruitment' && (
          <div className="hr-rep-workspace">
            <div className="hr-rep-table-card">
              <div className="hr-rep-card-header">
                <div>
                  <h4>Recruitment Funnel & Candidate Pipeline Report</h4>
                  <small>Showing {filteredCandidates.length} candidate applicants from MongoDB Atlas</small>
                </div>
                <button type="button" className="hr-rep-action-link" onClick={() => navigate('/user/recruitment')}>
                  Manage in Recruitment →
                </button>
              </div>

              <div className="hr-rep-table-wrap">
                <table className="hr-rep-table">
                  <thead>
                    <tr>
                      <th>Candidate Name</th>
                      <th>Email</th>
                      <th>Applied Position</th>
                      <th>Department</th>
                      <th>Experience</th>
                      <th>Current Stage</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCandidates.length === 0 ? (
                      <tr><td colSpan="7" className="hr-rep-empty">No candidate applications found.</td></tr>
                    ) : (
                      filteredCandidates.map((c) => (
                        <tr key={c._id}>
                          <td><strong>{c.name}</strong></td>
                          <td>{c.email}</td>
                          <td>{c.appliedPosition || '—'}</td>
                          <td><span className="hr-rep-pill dept">{c.department || '—'}</span></td>
                          <td>{c.experience || '—'}</td>
                          <td><span className="hr-rep-pill type">{c.stage || 'Applied'}</span></td>
                          <td>
                            <span className={`hr-rep-status-badge ${c.status === 'Hired' ? 'active' : c.status === 'Rejected' ? 'inactive' : 'yellow'}`}>
                              {c.status}
                            </span>
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

        {/* ════════════════════════════════════════════════════════════════
            WORKSPACE 8: ASSET ANALYTICS
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'assets' && (
          <div className="hr-rep-workspace">
            <div className="hr-rep-table-card">
              <div className="hr-rep-card-header">
                <div>
                  <h4>Hardware & Corporate Asset Inventory Report</h4>
                  <small>Showing {filteredAssets.length} asset records from MongoDB Atlas</small>
                </div>
                <button type="button" className="hr-rep-action-link" onClick={() => navigate('/user/assets')}>
                  Manage in Assets →
                </button>
              </div>

              <div className="hr-rep-table-wrap">
                <table className="hr-rep-table">
                  <thead>
                    <tr>
                      <th>Asset Name</th>
                      <th>Asset Code</th>
                      <th>Category</th>
                      <th>Brand / Model</th>
                      <th>Assigned Employee</th>
                      <th>Condition</th>
                      <th>Status</th>
                      <th>Purchase Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.length === 0 ? (
                      <tr><td colSpan="8" className="hr-rep-empty">No asset inventory records found.</td></tr>
                    ) : (
                      filteredAssets.map((a) => (
                        <tr key={a._id}>
                          <td><strong>{a.assetName}</strong></td>
                          <td><span className="hr-rep-code">{a.assetCode}</span></td>
                          <td><span className="hr-rep-pill type">{a.category}</span></td>
                          <td>{a.brand} {a.model}</td>
                          <td>{a.assignedTo ? (a.assignedTo.personalInfo?.fullName || `${a.assignedTo.firstName || ''} ${a.assignedTo.lastName || ''}`.trim() || a.assignedTo.email) : 'Unallocated (In Stock)'}</td>
                          <td>{a.condition || 'Good'}</td>
                          <td>
                            <span className={`hr-rep-status-badge ${a.status === 'Allocated' ? 'active' : a.status === 'Available' ? 'green' : 'yellow'}`}>
                              {a.status}
                            </span>
                          </td>
                          <td><strong>{formatINR(a.purchaseCost)}</strong></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            WORKSPACE 9: DEPARTMENT 360° CONSOLIDATED ANALYTICS
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'department_analytics' && (
          <div className="hr-rep-workspace">
            {/* Department Selector Banner */}
            <div className="hr-rep-dept-selector-bar">
              <label>
                <strong>Select Department:</strong>
              </label>
              <select
                className="hr-rep-dept-select"
                value={selectedDeptName}
                onChange={(e) => setSelectedDeptName(e.target.value)}
              >
                {OFFICIAL_DEPARTMENTS.filter((d) => d !== 'All').map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {deptLoading ? (
              <div className="hr-rep-loading">
                <div className="hr-rep-spinner" />
                <p>Consolidating department analytics for {selectedDeptName}...</p>
              </div>
            ) : !deptAnalyticsData ? (
              <div className="hr-rep-empty">No department analytics found for {selectedDeptName}.</div>
            ) : (
              <>
                {/* Department Header Profile */}
                <div className="hr-rep-dept-profile-card">
                  <div className="hr-rep-dept-avatar">
                    {selectedDeptName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="hr-rep-dept-meta">
                    <h3>{deptAnalyticsData.departmentName} Department</h3>
                    <p>
                      <strong>Department Manager:</strong> {deptAnalyticsData.manager} •{' '}
                      <strong>Headcount:</strong> {deptAnalyticsData.headcount} Staff ({deptAnalyticsData.activeCount} Active)
                    </p>
                  </div>
                </div>

                {/* 4 Department KPI Cards */}
                <div className="hr-rep-kpi-grid four-col">
                  <div className="hr-rep-kpi-card purple">
                    <span className="hr-rep-kpi-label">Monthly Gross Payroll</span>
                    <strong className="hr-rep-kpi-value">{formatINR(deptAnalyticsData.totalGrossSalary)}</strong>
                  </div>

                  <div className="hr-rep-kpi-card orange">
                    <span className="hr-rep-kpi-label">Avg Performance Rating</span>
                    <strong className="hr-rep-kpi-value">{deptAnalyticsData.averagePerformanceScore ? `${deptAnalyticsData.averagePerformanceScore} / 5.0` : '—'}</strong>
                  </div>

                  <div className="hr-rep-kpi-card cyan">
                    <span className="hr-rep-kpi-label">Hardware Assets Fleet</span>
                    <strong className="hr-rep-kpi-value">{deptAnalyticsData.totalAssetsCount} Assets</strong>
                  </div>

                  <div className="hr-rep-kpi-card emerald">
                    <span className="hr-rep-kpi-label">Open Requisitions</span>
                    <strong className="hr-rep-kpi-value">{deptAnalyticsData.openPositionsCount} Positions</strong>
                  </div>
                </div>

                {/* Department Staff Roster Table */}
                <div className="hr-rep-table-card">
                  <div className="hr-rep-card-header">
                    <h4>Department Staff Roster & Performance Overview</h4>
                    <small>{deptAnalyticsData.employeeRoster?.length || 0} Staff members in {deptAnalyticsData.departmentName}</small>
                  </div>

                  <div className="hr-rep-table-wrap">
                    <table className="hr-rep-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Employee ID</th>
                          <th>Designation</th>
                          <th>Attendance Count</th>
                          <th>Leaves Taken</th>
                          <th>Last Net Salary</th>
                          <th>Performance</th>
                          <th>Assets</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!deptAnalyticsData.employeeRoster || deptAnalyticsData.employeeRoster.length === 0) ? (
                          <tr><td colSpan="8" className="hr-rep-empty">No staff members assigned to {deptAnalyticsData.departmentName} yet.</td></tr>
                        ) : (
                          deptAnalyticsData.employeeRoster.map((s) => (
                            <tr key={s._id}>
                              <td>
                                <strong>{s.name}</strong>
                                <br />
                                <small style={{ color: '#64748b' }}>{s.email}</small>
                              </td>
                              <td><span className="hr-rep-code">{s.employeeCode}</span></td>
                              <td>{s.designation}</td>
                              <td>{s.attendanceCount} logs</td>
                              <td>{s.leavesCount} requests</td>
                              <td><strong>{formatINR(s.lastNetSalary)}</strong></td>
                              <td>
                                {s.performanceScore ? (
                                  <strong style={{ color: '#ea580c' }}>{Number(s.performanceScore).toFixed(1)} / 5.0</strong>
                                ) : '—'}
                              </td>
                              <td>{s.assignedAssetsCount} assigned</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            WORKSPACE 10: EMPLOYEE 360° CONSOLIDATED DOSSIER
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'employee_360' && (
          <div className="hr-rep-workspace">
            {/* Employee Selector Bar */}
            <div className="hr-rep-dept-selector-bar">
              <label>
                <strong>Select Employee:</strong>
              </label>
              <select
                className="hr-rep-dept-select"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
              >
                {employees.map((emp) => {
                  const name = emp.personalInfo?.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email;
                  const code = emp.jobDetails?.employeeId || `EMP-${String(emp._id).slice(-5).toUpperCase()}`;
                  const dept = emp.jobDetails?.department || emp.department || '—';
                  return (
                    <option key={emp._id} value={emp._id}>
                      {name} ({code}) — {dept}
                    </option>
                  );
                })}
              </select>
            </div>

            {emp360Loading ? (
              <div className="hr-rep-loading">
                <div className="hr-rep-spinner" />
                <p>Loading 360° dossier from MongoDB Atlas...</p>
              </div>
            ) : !employee360Data ? (
              <div className="hr-rep-empty">Select an employee to view their 360° dossier.</div>
            ) : (
              <>
                {/* Employee Profile Header Banner */}
                <div className="hr-rep-dossier-header-card">
                  <div className="hr-rep-dossier-avatar">
                    {initialsFor(employee360Data.profile.fullName, employee360Data.profile.email)}
                  </div>
                  <div className="hr-rep-dossier-meta">
                    <h3>{employee360Data.profile.fullName}</h3>
                    <div className="hr-rep-dossier-badges">
                      <span className="hr-rep-code">{employee360Data.profile.employeeId}</span>
                      <span className="hr-rep-pill dept">{employee360Data.profile.department}</span>
                      <span className="hr-rep-pill type">{employee360Data.profile.designation}</span>
                      <span className={`hr-rep-status-badge ${employee360Data.profile.isActive ? 'active' : 'inactive'}`}>
                        {employee360Data.profile.employmentStatus}
                      </span>
                    </div>
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                      <strong>Email:</strong> {employee360Data.profile.email} • <strong>Phone:</strong> {employee360Data.profile.phone} •{' '}
                      <strong>Joined:</strong> {formatDate(employee360Data.profile.joiningDate)} • <strong>Manager:</strong> {employee360Data.profile.reportingManager}
                    </p>
                  </div>
                </div>

                {/* 6 Cross-Module Dossier KPI Summary Cards */}
                <div className="hr-rep-kpi-grid">
                  {/* Attendance Card */}
                  <div className="hr-rep-kpi-card emerald">
                    <span className="hr-rep-kpi-label">Attendance Rate</span>
                    <strong className="hr-rep-kpi-value">{employee360Data.attendanceSummary?.attendanceRatePercent || 0}%</strong>
                  </div>

                  {/* Leaves Card */}
                  <div className="hr-rep-kpi-card amber">
                    <span className="hr-rep-kpi-label">Leave Utilization</span>
                    <strong className="hr-rep-kpi-value">{employee360Data.leaveSummary?.approved || 0} Days Approved</strong>
                  </div>

                  {/* Compensation Card */}
                  <div className="hr-rep-kpi-card purple">
                    <span className="hr-rep-kpi-label">Base Compensation</span>
                    <strong className="hr-rep-kpi-value">{formatINR(employee360Data.payrollSummary?.baseSalary)}</strong>
                  </div>

                  {/* Performance Card */}
                  <div className="hr-rep-kpi-card orange">
                    <span className="hr-rep-kpi-label">Performance Rating</span>
                    <strong className="hr-rep-kpi-value">
                      {employee360Data.performanceSummary?.latestReview?.overallScore
                        ? `${Number(employee360Data.performanceSummary.latestReview.overallScore).toFixed(1)} / 5.0`
                        : '—'}
                    </strong>
                  </div>

                  {/* Document Card */}
                  <div className="hr-rep-kpi-card blue">
                    <span className="hr-rep-kpi-label">Documents Vault</span>
                    <strong className="hr-rep-kpi-value">{employee360Data.documentSummary?.verified || 0} Verified</strong>
                  </div>

                  {/* Assets Card */}
                  <div className="hr-rep-kpi-card cyan">
                    <span className="hr-rep-kpi-label">Assigned Hardware</span>
                    <strong className="hr-rep-kpi-value">{employee360Data.assetSummary?.assignedCount || 0} Assets</strong>
                  </div>
                </div>

                {/* Detailed Sections Grid */}
                <div className="hr-rep-dossier-sections-grid">
                  {/* Assigned Assets Card */}
                  <div className="hr-rep-table-card">
                    <div className="hr-rep-card-header">
                      <h4>Corporate Hardware Allocated</h4>
                    </div>
                    {(!employee360Data.assetSummary?.assignedAssets || employee360Data.assetSummary.assignedAssets.length === 0) ? (
                      <div className="hr-rep-empty">No hardware currently allocated.</div>
                    ) : (
                      <div className="hr-rep-table-wrap">
                        <table className="hr-rep-table">
                          <thead>
                            <tr>
                              <th>Asset</th>
                              <th>Code</th>
                              <th>Category</th>
                              <th>Condition</th>
                              <th>Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {employee360Data.assetSummary.assignedAssets.map((a) => (
                              <tr key={a._id}>
                                <td><strong>{a.assetName}</strong></td>
                                <td><span className="hr-rep-code">{a.assetCode}</span></td>
                                <td>{a.category}</td>
                                <td>{a.condition || 'Good'}</td>
                                <td>{formatINR(a.purchaseCost)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Document Repository Card */}
                  <div className="hr-rep-table-card">
                    <div className="hr-rep-card-header">
                      <h4>Credentials & Document Vault</h4>
                    </div>
                    {(!employee360Data.documentSummary?.documentsList || employee360Data.documentSummary.documentsList.length === 0) ? (
                      <div className="hr-rep-empty">No documents uploaded yet.</div>
                    ) : (
                      <div className="hr-rep-table-wrap">
                        <table className="hr-rep-table">
                          <thead>
                            <tr>
                              <th>Document Title</th>
                              <th>Category</th>
                              <th>Status</th>
                              <th>Uploaded</th>
                            </tr>
                          </thead>
                          <tbody>
                            {employee360Data.documentSummary.documentsList.map((d) => (
                              <tr key={d._id}>
                                <td><strong>{d.title || d.documentType}</strong></td>
                                <td>{d.category || 'General'}</td>
                                <td>
                                  <span className={`hr-rep-status-badge ${d.status === 'Verified' ? 'active' : 'yellow'}`}>
                                    {d.status}
                                  </span>
                                </td>
                                <td>{formatDate(d.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </UserLayout>
  );
}
