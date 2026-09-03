import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../../../context/AppContext';
import apiClient from '../../../../services/apiClient';
import UserLayout from '../users/components/UserLayout';
import './HRDashboard.css';

/* ─── helpers ──────────────────────────────────────────────────────────── */
const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

const formatINR = (val) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val || 0);

const initialsFor = (firstName, lastName, email) => {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return 'EM';
};

const getTodayDateStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/* ─── 3-Slice Attendance Donut Chart ─────────────────────────────────────── */
function AttendanceDonut({ present, onLeave, absent, total, hasRecords }) {
  const R = 40;
  const C = 2 * Math.PI * R;

  const validTotal = total > 0 ? total : 1;
  const pPct = hasRecords ? (present / validTotal) * 100 : 0;
  const lPct = hasRecords ? (onLeave / validTotal) * 100 : 0;
  const aPct = hasRecords ? (absent / validTotal) * 100 : 0;

  const slices = [
    { color: '#10B981', pct: pPct }, // Present (Green)
    { color: '#F59E0B', pct: lPct }, // On Leave (Orange/Amber)
    { color: '#EF4444', pct: aPct }, // Absent (Red)
  ];

  let offset = 0;
  const arcs = slices
    .filter((s) => s.pct > 0)
    .map((s) => {
      const dash = (s.pct / 100) * C;
      const arc = { ...s, dash, gap: C - dash, offset };
      offset += dash;
      return arc;
    });

  return (
    <svg viewBox="0 0 100 100" className="hr-donut-svg">
      <circle cx="50" cy="50" r={R} fill="none" stroke="#f1f5f9" strokeWidth="14" />
      {hasRecords &&
        arcs.map((arc, i) => (
          <circle
            key={i}
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={arc.color}
            strokeWidth="14"
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={-arc.offset}
            strokeLinecap="round"
          />
        ))}
    </svg>
  );
}

export default function HRDashboard() {
  const { user } = useContext(AppContext);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const todayDateStr = useMemo(() => getTodayDateStr(), []);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const requests = [
      apiClient.get('/users').catch(() => ({ data: { data: [] } })),
      apiClient.get('/admin/departments').catch(() => apiClient.get('/departments')).catch(() => ({ data: { data: [] } })),
      apiClient.get('/attendance', { params: { date: todayDateStr } }).catch(() => ({ data: { data: [] } })),
      apiClient.get('/leave-requests').catch(() => ({ data: { data: [] } })),
      apiClient.get('/payroll').catch(() => ({ data: { data: [] } })),
      apiClient.get('/notifications').catch(() => ({ data: { data: [] } })),
    ];

    Promise.allSettled(requests).then((results) => {
      if (!active) return;

      const getData = (res) => (res.status === 'fulfilled' && res.value?.data?.data ? res.value.data.data : []);

      setEmployees(getData(results[0]));
      setDepartments(getData(results[1]));
      setTodayAttendance(getData(results[2]));
      setLeaveRequests(getData(results[3]));
      setPayrollRecords(getData(results[4]));
      setNotifications(getData(results[5]));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [todayDateStr]);

  /* ─── Derived Dynamic Statistics ─── */
  const fullName = useMemo(() => {
    return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'HR Manager';
  }, [user]);

  // 1. Total Active Employees from MongoDB users collection
  const activeEmployees = useMemo(() => {
    return employees.filter(
      (e) => e.role === 'employee' && e.isActive !== false && e.employmentStatus !== 'Exited' && e.employmentStatus !== 'Terminated'
    );
  }, [employees]);

  const totalEmployeesCount = activeEmployees.length;

  // 2. Present Today from real attendance records
  const presentCount = useMemo(() => {
    return todayAttendance.filter((a) => a.status === 'Present' || a.status === 'Late' || a.status === 'Half Day').length;
  }, [todayAttendance]);

  // 3. On Leave Today from approved leave requests
  const onLeaveCount = useMemo(() => {
    return leaveRequests.filter((l) => {
      if (l.status !== 'Approved') return false;
      const start = l.startDate ? String(l.startDate).slice(0, 10) : '';
      const end = l.endDate ? String(l.endDate).slice(0, 10) : '';
      return start <= todayDateStr && todayDateStr <= end;
    }).length;
  }, [leaveRequests, todayDateStr]);

  // 4. Absent Today
  const explicitAbsentCount = useMemo(() => {
    return todayAttendance.filter((a) => a.status === 'Absent').length;
  }, [todayAttendance]);

  const hasAttendanceRecordsToday = todayAttendance.length > 0 || onLeaveCount > 0;
  const absentCount = hasAttendanceRecordsToday ? explicitAbsentCount : 0;

  // 5. Percentages calculated dynamically
  const presentPct = totalEmployeesCount > 0 && hasAttendanceRecordsToday
    ? ((presentCount / totalEmployeesCount) * 100).toFixed(2)
    : '0.00';

  const onLeavePct = totalEmployeesCount > 0 && hasAttendanceRecordsToday
    ? ((onLeaveCount / totalEmployeesCount) * 100).toFixed(2)
    : '0.00';

  const absentPct = totalEmployeesCount > 0 && hasAttendanceRecordsToday
    ? ((absentCount / totalEmployeesCount) * 100).toFixed(2)
    : '0.00';

  // New Joinings this month
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const newJoiningsCount = activeEmployees.filter((e) => e.createdAt && String(e.createdAt).startsWith(currentMonthStr)).length;

  // Pending Leaves
  const pendingLeavesList = leaveRequests.filter((l) => l.status === 'Pending');
  const pendingLeavesCount = pendingLeavesList.length;

  // Payroll Summary calculation
  const totalPayrollCost = payrollRecords.reduce((sum, p) => sum + (Number(p.net || p.gross) || 0), 0);
  const processedPayrollCount = payrollRecords.filter((p) => p.status === 'Paid' || p.status === 'Processed').length;
  const pendingPayrollCount = Math.max(0, totalEmployeesCount - processedPayrollCount);

  // Department Headcount Data for Bar Chart
  const departmentHeadcounts = useMemo(() => {
    const deptMap = {};
    const standardDepts = ['HR', 'Finance', 'Business Development', 'Digital Marketing', 'Video Editor', 'Tech'];
    const allDeptNames = standardDepts;

    allDeptNames.forEach((name) => {
      deptMap[name] = 0;
    });

    activeEmployees.forEach((emp) => {
      const dept = emp.jobDetails?.department || emp.department;
      if (dept && deptMap[dept] !== undefined) {
        deptMap[dept] += 1;
      }
    });

    return Object.entries(deptMap).map(([dept, count]) => ({
      name: dept,
      count,
    }));
  }, [activeEmployees]);

  const maxDeptCount = Math.max(...departmentHeadcounts.map((d) => d.count), 1);

  return (
    <UserLayout pageTitle="HR Dashboard">
      <div className="hr-dash-container">
        {/* 5 Dynamic KPI Stat Cards */}
        <div className="hr-kpi-grid">
          {/* 1. Total Active Employees */}
          <div className="hr-kpi-card blue" onClick={() => navigate('/user/employees')}>
            <div className="hr-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="hr-kpi-body">
              <span className="hr-kpi-title">Total Employees</span>
              <strong className="hr-kpi-value">{totalEmployeesCount}</strong>
              <span className="hr-kpi-meta success">
                {newJoiningsCount > 0 ? `+${newJoiningsCount} this month` : `${totalEmployeesCount} active`}
              </span>
            </div>
          </div>

          {/* 2. Present Today */}
          <div className="hr-kpi-card green" onClick={() => navigate('/user/attendance')}>
            <div className="hr-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
                <polyline points="16 11 18 13 22 9" />
              </svg>
            </div>
            <div className="hr-kpi-body">
              <span className="hr-kpi-title">Present Today</span>
              <strong className="hr-kpi-value">{presentCount}</strong>
              <span className="hr-kpi-meta success">{presentPct}%</span>
            </div>
          </div>

          {/* 3. On Leave Today */}
          <div className="hr-kpi-card amber" onClick={() => navigate('/user/leave-requests')}>
            <div className="hr-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div className="hr-kpi-body">
              <span className="hr-kpi-title">On Leave Today</span>
              <strong className="hr-kpi-value">{onLeaveCount}</strong>
              <span className="hr-kpi-meta amber">{onLeavePct}%</span>
            </div>
          </div>

          {/* 4. New Joinings */}
          <div className="hr-kpi-card purple" onClick={() => navigate('/user/employees')}>
            <div className="hr-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </div>
            <div className="hr-kpi-body">
              <span className="hr-kpi-title">New Joinings</span>
              <strong className="hr-kpi-value">{newJoiningsCount}</strong>
              <span className="hr-kpi-meta success">{newJoiningsCount > 0 ? `+${newJoiningsCount} this month` : '0 this month'}</span>
            </div>
          </div>

          {/* 5. Pending Leaves */}
          <div className="hr-kpi-card red" onClick={() => navigate('/user/leave-requests')}>
            <div className="hr-kpi-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="12" y1="9" x2="12.01" y2="9" />
              </svg>
            </div>
            <div className="hr-kpi-body">
              <span className="hr-kpi-title">Pending Leaves</span>
              <strong className="hr-kpi-value">{pendingLeavesCount}</strong>
              <span className="hr-kpi-meta red">{pendingLeavesCount > 0 ? 'Requires Approval' : 'All Reviewed'}</span>
            </div>
          </div>
        </div>

        {/* ─── Row 2: Attendance Overview + Leave Requests ─── */}
        <div className="hr-grid-row-2">
          {/* Card 1: Attendance Overview */}
          <div className="hr-card">
            <div className="hr-card-header">
              <h3>Attendance Overview</h3>
              <button type="button" className="hr-card-action-link" onClick={() => navigate('/user/attendance')}>
                View Details
              </button>
            </div>

            <div className="hr-donut-wrapper">
              <div className="hr-donut-box">
                <AttendanceDonut
                  present={presentCount}
                  onLeave={onLeaveCount}
                  absent={absentCount}
                  total={totalEmployeesCount}
                  hasRecords={hasAttendanceRecordsToday}
                />
                <div className="hr-donut-center-info">
                  <strong>{totalEmployeesCount}</strong>
                  <span>Total</span>
                </div>
              </div>

              <ul className="hr-donut-legend-list">
                <li className="hr-donut-legend-item">
                  <div className="hr-donut-legend-left">
                    <span className="hr-legend-dot" style={{ background: '#10B981' }} />
                    <span>Present ({presentCount})</span>
                  </div>
                  <span className="hr-donut-legend-right">{presentPct}%</span>
                </li>

                <li className="hr-donut-legend-item">
                  <div className="hr-donut-legend-left">
                    <span className="hr-legend-dot" style={{ background: '#F59E0B' }} />
                    <span>On Leave ({onLeaveCount})</span>
                  </div>
                  <span className="hr-donut-legend-right">{onLeavePct}%</span>
                </li>

                <li className="hr-donut-legend-item">
                  <div className="hr-donut-legend-left">
                    <span className="hr-legend-dot" style={{ background: '#EF4444' }} />
                    <span>Absent ({absentCount})</span>
                  </div>
                  <span className="hr-donut-legend-right">{absentPct}%</span>
                </li>
              </ul>
            </div>

            {!hasAttendanceRecordsToday && (
              <div style={{ marginTop: '0.85rem', padding: '0.6rem 0.85rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '0.8rem', color: '#64748B', textAlign: 'center' }}>
                No attendance records for today
              </div>
            )}
          </div>

          {/* Card 2: Leave Requests */}
          <div className="hr-card">
            <div className="hr-card-header">
              <h3>Leave Requests</h3>
              <button type="button" className="hr-card-action-link" onClick={() => navigate('/user/leave-requests')}>
                View All
              </button>
            </div>

            {leaveRequests.length === 0 ? (
              <div className="hr-emp-empty">No leave requests submitted yet.</div>
            ) : (
              <ul className="hr-leave-list">
                {leaveRequests.slice(0, 4).map((l) => {
                  const empName = l.user
                    ? `${l.user.firstName || ''} ${l.user.lastName || ''}`.trim() || l.user.email
                    : 'Employee';
                  const initials = l.user ? initialsFor(l.user.firstName, l.user.lastName, l.user.email) : 'EM';
                  const statusClass = (l.status || 'Pending').toLowerCase();

                  return (
                    <li key={l._id} className="hr-leave-item">
                      <div className="hr-leave-user-wrap">
                        <div className="hr-leave-avatar">{initials}</div>
                        <div>
                          <span className="hr-leave-name">{empName}</span>
                          <span className="hr-leave-type">{l.type} Leave</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className="hr-leave-date">{formatDate(l.startDate)}</span>
                        <span className={`hr-leave-pill ${statusClass}`}>{l.status || 'Pending'}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* ─── Row 3: Payroll Summary + Department Wise Headcount + Recent Activities ─── */}
        <div className="hr-grid-row-3">
          {/* Card 1: Payroll Summary */}
          <div className="hr-card">
            <div className="hr-card-header">
              <h3>Payroll Summary</h3>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '500' }}>This Month</span>
            </div>

            <div className="hr-payroll-summary-content">
              <div>
                <span className="hr-payroll-cost-label">Total Payroll Cost</span>
                <div className="hr-payroll-cost-value">{formatINR(totalPayrollCost)}</div>
              </div>

              <div className="hr-payroll-meta-grid">
                <div className="hr-payroll-meta-col">
                  <span>Processed Employees</span>
                  <strong>
                    {processedPayrollCount} / {totalEmployeesCount}
                  </strong>
                </div>
                <div className="hr-payroll-meta-col">
                  <span>Pending</span>
                  <strong>{pendingPayrollCount}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Department Wise Headcount */}
          <div className="hr-card">
            <div className="hr-card-header">
              <h3>Department Wise Headcount</h3>
              <button type="button" className="hr-card-action-link" onClick={() => navigate('/user/departments')}>
                View Report ▾
              </button>
            </div>

            <div className="hr-barchart-container">
              {departmentHeadcounts.slice(0, 6).map((item) => {
                const heightPct = Math.max(12, Math.round((item.count / maxDeptCount) * 100));
                return (
                  <div key={item.name} className="hr-bar-col">
                    <span className="hr-bar-val">{item.count}</span>
                    <div className="hr-bar-track">
                      <div className="hr-bar-fill" style={{ height: `${heightPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hr-bar-labels">
              {departmentHeadcounts.slice(0, 6).map((item) => (
                <span key={item.name} className="hr-bar-lbl" title={item.name}>
                  {item.name}
                </span>
              ))}
            </div>
          </div>

          {/* Card 3: Recent Activities */}
          <div className="hr-card">
            <div className="hr-card-header">
              <h3>Recent Activities</h3>
              <button type="button" className="hr-card-action-link" onClick={() => navigate('/user/notifications')}>
                View All
              </button>
            </div>

            {notifications.length === 0 ? (
              <div className="hr-emp-empty" style={{ padding: '1.5rem 0' }}>
                No recent HR activities.
              </div>
            ) : (
              <ul className="hr-activity-list">
                {notifications.slice(0, 4).map((n) => {
                  const iconClass = n.type === 'Success' ? 'green' : n.type === 'Warning' ? 'amber' : 'blue';
                  return (
                    <li key={n._id} className="hr-activity-item">
                      <div className={`hr-activity-icon ${iconClass}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                      </div>
                      <div className="hr-activity-content">
                        <span className="hr-activity-title">{n.title || n.message}</span>
                        <span className="hr-activity-time">{formatDate(n.createdAt)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </UserLayout>
  );
}
