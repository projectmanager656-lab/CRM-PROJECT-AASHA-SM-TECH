import { useContext, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import apiClient from '../../../../../services/apiClient';
import { AppContext } from '../../../../../context/AppContext';
import { NON_TECH_LEAD_DEPARTMENTS } from '../../../../../config/departments';
import MessageDropdown from '../../../../../components/messaging/MessageDropdown';
import LogoutConfirmModal from '../../../../../components/common/LogoutConfirmModal';
import AdminLayout from '../../../AdminDashboard/components/AdminLayout';
import './UserLayout.css';

const defaultNavItems = [
  { label: 'Dashboard', path: '/user' },
  { label: 'My Tasks', path: '/user/tasks', permission: ['projects', 'tasks'] },
  { label: 'My Projects', path: '/user/projects', permission: ['projects', 'projects'] },
  { label: 'Non-Tech Leads', path: '/user/leads', permission: ['crm', 'leads'], departments: NON_TECH_LEAD_DEPARTMENTS },
  { label: 'My Clients', path: '/user/clients', permission: ['crm', 'clients'] },
  { label: 'Attendance', path: '/user/attendance', permission: ['hrms', 'attendance'] },
  { label: 'Leave Requests', path: '/user/leave-requests', permission: ['hrms', 'leave_requests'] },
  { label: 'HR Support', path: '/user/hr-support' },
  { label: 'Payroll', path: '/user/payroll', permission: ['finance', 'payroll'] },
  { label: 'Invoices', path: '/user/invoices' },
  { label: 'Documents', path: '/user/documents', permission: ['documents', 'documents'] },
  { label: 'Notifications', path: '/user/notifications', permission: ['communications', 'notifications'] },
  { label: 'Calendar', path: '/user/calendar', permission: ['communications', 'calendar'] },
  { label: 'Settings', path: '/user/settings' },
];

const hrNavItems = [
  { label: 'Dashboard', path: '/dashboard/hr' },
  { label: 'Employees', path: '/user/employees' },
  { label: 'Departments', path: '/user/departments' },
  { label: 'Task Management & Allocation', path: '/user/task-allocation' },
  { label: 'Project Management & Allocation', path: '/user/project-allocation' },
  { label: 'Attendance Management', path: '/user/attendance' },
  { label: 'Leave Management', path: '/user/leave-requests' },
  { label: 'Payroll', path: '/user/payroll' },
  { label: 'Performance', path: '/user/performance' },
  { label: 'Recruitment', path: '/user/recruitment' },
  { label: 'Resignation & Exit', path: '/user/resignation-exit' },
  { label: 'Full & Final Settlement', path: '/user/full-and-final-settlement' },
  { label: 'Documents', path: '/user/documents' },
  { label: 'Assets', path: '/user/assets' },
  { label: 'Reports & Analytics', path: '/user/reports' },
  { label: 'Training', path: '/user/training' },
  { label: 'HR Support', path: '/user/hr-support' },
];

const bdNavItems = [
  { label: 'Dashboard', path: '/dashboard/business-development' },
  { label: 'Leads & Sales', path: '/user/leads', permission: ['crm', 'leads'] },
  { label: 'My Clients', path: '/user/clients', permission: ['crm', 'clients'] },
  { label: 'My Projects', path: '/user/projects', permission: ['projects', 'projects'] },
  { label: 'My Tasks', path: '/user/tasks', permission: ['projects', 'tasks'] },
  { label: 'HR Support', path: '/user/hr-support' },
  { label: 'Notifications', path: '/user/notifications', permission: ['communications', 'notifications'] },
  { label: 'Calendar', path: '/user/calendar', permission: ['communications', 'calendar'] },
  { label: 'Settings', path: '/user/settings' },
];

const digitalMarketingNavItems = [
  { label: 'Dashboard', path: '/dashboard/digital-marketing' },
  { label: 'My Tasks', path: '/user/tasks', permission: ['projects', 'tasks'] },
  { label: 'My Projects', path: '/user/projects', permission: ['projects', 'projects'] },
  { label: 'Inbound Leads', path: '/user/leads', permission: ['crm', 'leads'] },
  { label: 'Attendance', path: '/user/attendance', permission: ['hrms', 'attendance'] },
  { label: 'Leave Requests', path: '/user/leave-requests', permission: ['hrms', 'leave_requests'] },
  { label: 'HR Support', path: '/user/hr-support' },
  { label: 'Documents', path: '/user/documents', permission: ['documents', 'documents'] },
  { label: 'Notifications', path: '/user/notifications', permission: ['communications', 'notifications'] },
  { label: 'Calendar', path: '/user/calendar', permission: ['communications', 'calendar'] },
  { label: 'Settings', path: '/user/settings' },
];

const videoEditorNavItems = [
  { label: 'Dashboard', path: '/dashboard/video-editor' },
  { label: 'My Tasks', path: '/user/tasks', permission: ['projects', 'tasks'] },
  { label: 'My Projects', path: '/user/projects', permission: ['projects', 'projects'] },
  { label: 'Attendance', path: '/user/attendance', permission: ['hrms', 'attendance'] },
  { label: 'Leave Requests', path: '/user/leave-requests', permission: ['hrms', 'leave_requests'] },
  { label: 'HR Support', path: '/user/hr-support' },
  { label: 'Documents', path: '/user/documents', permission: ['documents', 'documents'] },
  { label: 'Notifications', path: '/user/notifications', permission: ['communications', 'notifications'] },
  { label: 'Calendar', path: '/user/calendar', permission: ['communications', 'calendar'] },
  { label: 'Settings', path: '/user/settings' },
];

const financeNavItems = [
  { label: 'Dashboard', path: '/dashboard/finance' },
  { label: 'Invoices', path: '/user/invoices' },
  { label: 'My Payroll', path: '/user/payroll', permission: ['finance', 'payroll'] },
  { label: 'HR Support', path: '/user/hr-support' },
  { label: 'Documents', path: '/user/documents', permission: ['documents', 'documents'] },
  { label: 'Notifications', path: '/user/notifications', permission: ['communications', 'notifications'] },
  { label: 'Calendar', path: '/user/calendar', permission: ['communications', 'calendar'] },
  { label: 'Settings', path: '/user/settings' },
];

const getNavItemsForDept = (department) => {
  const dept = String(department || '').trim().toLowerCase();
  switch (dept) {
    case 'hr': return hrNavItems;
    case 'finance': return financeNavItems;
    case 'business development':
    case 'sales': return bdNavItems;
    case 'digital marketing': return digitalMarketingNavItems;
    case 'video editor': return videoEditorNavItems;
    default: return defaultNavItems;
  }
};

const navIcons = {
  '/user': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>,
  '/dashboard/hr': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
  '/dashboard/digital-marketing': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /><path d="M2 12h20" /></svg>,
  '/dashboard/video-editor': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="17" x2="22" y2="17" /><line x1="17" y1="7" x2="22" y2="7" /></svg>,
  '/user/employees': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  '/user/departments': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="9" y1="22" x2="9" y2="22.01" /><line x1="15" y1="22" x2="15" y2="22.01" /><line x1="9" y1="6" x2="9" y2="6.01" /><line x1="15" y1="6" x2="15" y2="6.01" /><line x1="9" y1="10" x2="9" y2="10.01" /><line x1="15" y1="10" x2="15" y2="10.01" /><line x1="9" y1="14" x2="9" y2="14.01" /><line x1="15" y1="14" x2="15" y2="14.01" /><line x1="9" y1="18" x2="9" y2="18.01" /><line x1="15" y1="18" x2="15" y2="18.01" /></svg>,
  '/user/task-allocation': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /><path d="M16 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h2" /></svg>,
  '/user/project-allocation': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><path d="M12 11v6" /><path d="M9 14h6" /></svg>,
  '/user/performance': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>,
  '/user/recruitment': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><circle cx="19" cy="11" r="2" /><path d="M19 8v1" /><path d="M19 13v1" /><path d="M22 11h-1" /><path d="M17 11h-1" /></svg>,
  '/user/resignation-exit': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
  '/user/full-and-final-settlement': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l3 3v15H6z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h6M9 9h2" /></svg>,
  '/user/resignation': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
  '/user/training': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>,
  '/user/assets': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>,
  '/user/reports': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  '/user/inbox': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  '/dashboard/sales': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>,
  '/dashboard/business-development': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>,
  '/dashboard/finance': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>,
  '/user/profile': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  '/user/tasks': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  '/user/projects': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,
  '/user/leads': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>,
  '/user/clients': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  '/user/attendance': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 14 14" /></svg>,
  '/user/leave-requests': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="m9 16 2 2 4-4" /></svg>,
  '/user/payroll': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>,
  '/user/invoices': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  '/user/documents': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
  '/user/notifications': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  '/user/calendar': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  '/user/settings': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  '/user/hr-support': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>,
};

export default function UserLayout({ children, pageTitle, pageSubtitle = 'Employee Portal' }) {
  const { user, logout, can } = useContext(AppContext);
  const location = useLocation();
  const navigate = useNavigate();

  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [latestNotification, setLatestNotification] = useState(null);
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const profileMenuRef = useRef(null);

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    logout();
    navigate('/login');
  };

  useEffect(() => {
    let popupTimer;
    const loadNotifications = async () => {
      try {
        const response = await apiClient.get('/notifications');
        const unread = response.data.data.filter(n => !n.isRead);
        setUnreadNotifications(unread.length);
        if (unread.length > 0) {
          const latest = unread[0];
          setLatestNotification((prev) => {
            if (!prev || prev._id !== latest._id) {
              setShowNotificationPopup(true);
              if (popupTimer) clearTimeout(popupTimer);
              popupTimer = setTimeout(() => setShowNotificationPopup(false), 5000);
              return latest;
            }
            return prev;
          });
        }
      } catch (e) { }
    };
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => { clearInterval(interval); if (popupTimer) clearTimeout(popupTimer); };
  }, []);

  /* Close profile dropdown when clicking outside */
  useEffect(() => {
    if (!showProfileMenu) return;
    const handler = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showProfileMenu]);

  const fullName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.firstName || user?.email || 'Employee';

  const roleLabel = user?.role
    ? user.role.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    : 'Employee';

  const initials = fullName
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (user?.role === 'admin' || user?.role === 'super_admin') {
    return (
      <AdminLayout pageTitle={pageTitle} pageSubtitle={pageSubtitle}>
        {children}
      </AdminLayout>
    );
  }

  return (
    <div className="user-layout-shell">
      <aside className="user-layout-sidebar">
        <div className="user-employee-logo-container">
          <img className="user-employee-logo" src="/aasha-logo-new.jpg" alt="ASHA SM TECHNOLOGIES" />
        </div>


        <nav className="user-sidebar-nav" aria-label="User navigation">
          {getNavItemsForDept(user?.department)
            .filter((item) => (!item.permission || can(...item.permission, 'view')) && (!item.departments || item.departments.includes(user?.department)))
            .map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `user-nav-item ${isActive || location.pathname === item.path ? 'active' : ''}`
                }
              >
                <span className="nav-item-icon" aria-hidden="true">{navIcons[item.path]}</span>
                <span className="nav-item-text">{item.label}</span>
              </NavLink>
            ))}
        </nav>


      </aside>

      <main className="user-layout-content">
        <header className="user-layout-topbar">
          <div className="user-layout-welcome">
            <span className="user-layout-welcome-title">Welcome back, {fullName}! 👋</span>
            <span className="user-layout-welcome-sub">Here is what is happening with your work today.</span>
          </div>

          <div className="user-layout-actions">
            <div className="topbar-tooltip-wrap" data-tooltip="Messages">
              <MessageDropdown />
            </div>
            <div className="topbar-tooltip-wrap" data-tooltip="Notifications">
              <button type="button" className="user-top-icon" onClick={() => navigate('/user/notifications')} aria-label="Open notifications">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                {unreadNotifications > 0 && <span className="user-badge">{unreadNotifications}</span>}
              </button>
            </div>
            <div className="topbar-tooltip-wrap" data-tooltip="Calendar">
              <button type="button" className="user-top-icon" onClick={() => navigate('/user/calendar')} aria-label="Open calendar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              </button>
            </div>
            <div className="topbar-tooltip-wrap" data-tooltip="Settings">
              <button type="button" className="user-top-icon" onClick={() => navigate('/user/settings')} aria-label="Open settings">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
              </button>
            </div>

            {/* ── Profile dropdown — added after Calendar ── */}
            <div className="ul-profile-wrap topbar-tooltip-wrap" data-tooltip={showProfileMenu ? undefined : "Profile"} ref={profileMenuRef}>
              <button
                type="button"
                className="user-top-icon ul-profile-btn"
                onClick={() => setShowProfileMenu((prev) => !prev)}
                aria-label="Open profile menu"
                aria-expanded={showProfileMenu}
              >
                <span className="ul-profile-avatar">{initials}</span>
              </button>

              {showProfileMenu && (
                <div className="ul-profile-dropdown" role="menu">
                  <div className="ul-profile-dropdown-name">
                    <span className="ul-profile-dropdown-avatar">{initials}</span>
                    <span className="ul-profile-dropdown-fullname">{fullName}</span>
                  </div>
                  <div className="ul-profile-dropdown-divider" />
                  <button
                    type="button"
                    className="ul-profile-dropdown-item"
                    role="menuitem"
                    onClick={() => { setShowProfileMenu(false); navigate('/user/profile'); }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    Edit Profile
                  </button>
                  <button
                    type="button"
                    className="ul-profile-dropdown-item ul-profile-dropdown-logout"
                    role="menuitem"
                    onClick={() => { setShowProfileMenu(false); setShowLogoutModal(true); }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="user-page-body">
          {children}
        </div>

        {showNotificationPopup && latestNotification && (
          <div className="notification-popup">
            <div className="notification-popup-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              <strong>{latestNotification.title}</strong>
              <button onClick={() => setShowNotificationPopup(false)}>&times;</button>
            </div>
            <div className="notification-popup-body">
              {latestNotification.message}
            </div>
            <div className="notification-popup-footer">
              <button onClick={() => { setShowNotificationPopup(false); navigate('/user/notifications'); }}>View All</button>
            </div>
          </div>
        )}

        <LogoutConfirmModal
          isOpen={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          onConfirm={handleConfirmLogout}
        />
      </main>
    </div>
  );
}
