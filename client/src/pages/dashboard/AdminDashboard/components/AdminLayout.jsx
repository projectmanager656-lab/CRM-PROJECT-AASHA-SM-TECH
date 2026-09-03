import { useContext, useEffect, useState, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AppContext } from '../../../../context/AppContext';
import apiClient from '../../../../services/apiClient';
import MessageDropdown from '../../../../components/messaging/MessageDropdown';
import LogoutConfirmModal from '../../../../components/common/LogoutConfirmModal';
import './AdminLayout.css';

const navItems = [
  { label: 'Dashboard', path: '/admin' },
  { label: 'Departments', path: '/admin/departments', permission: ['administration', 'departments'] },
  { label: 'Projects', path: '/admin/projects', permission: ['projects', 'projects'] },
  { label: 'Tasks', path: '/admin/tasks', permission: ['projects', 'tasks'] },
  { label: 'Leads', path: '/admin/leads', permission: ['crm', 'leads'] },
  { label: 'Clients', path: '/admin/clients', permission: ['crm', 'clients'] },
  { label: 'Attendance', path: '/admin/attendance', permission: ['hrms', 'attendance'] },
  { label: 'Leave Requests', path: '/admin/leave-requests', permission: ['hrms', 'leave_requests'] },
  { label: 'Payroll', path: '/admin/payroll' },
  { label: 'Invoices', path: '/admin/invoices' },
  { label: 'Documents', path: '/admin/documents', permission: ['documents', 'documents'] },
  { label: 'Reports', path: '/admin/reports' },
  { label: 'Notifications', path: '/admin/notifications', permission: ['communications', 'notifications'] },
  { label: 'Announcements', path: '/admin/announcements', permission: ['communications', 'announcements'] },
  { label: 'Calendar', path: '/admin/calendar', permission: ['communications', 'calendar'] },
  { label: 'Settings', path: '/admin/settings' },
];

const navIcons = {
  '/admin': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>,
  '/admin/profile': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  '/admin/departments': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  '/admin/projects': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,
  '/admin/tasks': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  '/admin/leads': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>,
  '/admin/clients': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  '/admin/attendance': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
  '/admin/leave-requests': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  '/admin/payroll': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  '/admin/invoices': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>,
  '/admin/documents': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
  '/admin/reports': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>,
  '/admin/notifications': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  '/admin/announcements': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>,
  '/admin/calendar': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  '/admin/settings': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
};


export default function AdminLayout({ children, pageTitle, pageSubtitle = 'Admin Panel' }) {
  const { user, logout, can } = useContext(AppContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [notificationCount, setNotificationCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const profileMenuRef = useRef(null);

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    logout();
    navigate('/login');
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  useEffect(() => {
    let active = true;

    const loadNotificationCounts = async () => {
      try {
        const response = await apiClient.get('/notifications');
        if (!active) return;

        const notifications = response.data.data || [];
        setNotificationCount(notifications.filter((item) => !item.isRead).length);
      } catch {
        if (active) setNotificationCount(0);
      }
    };

    loadNotificationCounts();
    const intervalId = window.setInterval(loadNotificationCounts, 30000);
    window.addEventListener('notifications:updated', loadNotificationCounts);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('notifications:updated', loadNotificationCounts);
    };
  }, [location.pathname]);

  const fullName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || user?.email || 'Admin';

  const roleLabel = user?.role
    ? user.role.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    : 'Administrator';

  const initials = fullName
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="admin-layout-shell">
      <aside className="admin-layout-sidebar">
        <div className="sidebar-logo-container">
          <img className="sidebar-full-logo" src="/aasha-logo-admin.jpg" alt="ASHA SM TECHNOLOGIES" />
        </div>

        <nav className="admin-sidebar-nav" aria-label="Admin navigation">
          {navItems
            .filter((item) => !item.permission || can(...item.permission, 'view'))
            .filter((item) => item.label.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `admin-nav-item ${isActive || location.pathname === item.path ? 'active' : ''}`
                }
              >
                <span className="nav-item-icon" aria-hidden="true">{navIcons[item.path]}</span>
                <span className="nav-item-text">{item.label}</span>
              </NavLink>
            ))}
        </nav>
      </aside>

      <main className="admin-layout-content">
        <header className="admin-layout-topbar">
          <div className="admin-topbar-welcome">
            Welcome back, {fullName}! 👋
          </div>

          <div className="admin-layout-actions" style={{ marginLeft: 'auto' }}>
            <label className="admin-search-box" aria-label="Search admin area">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" placeholder="Search sidebar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </label>

            <MessageDropdown />

            <button type="button" className="admin-top-icon" onClick={() => navigate('/admin/notifications')} aria-label="Open alerts">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              {notificationCount > 0 && <span className="admin-badge">{notificationCount}</span>}
            </button>
            <button type="button" className="admin-top-icon" onClick={() => navigate('/admin/calendar')} aria-label="Open calendar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            </button>

            {/* Profile Dropdown */}
            <div className="admin-profile-wrap" ref={profileMenuRef}>
              <button
                type="button"
                className="admin-top-icon admin-profile-btn"
                onClick={() => setShowProfileMenu((prev) => !prev)}
                aria-label="Open profile menu"
                aria-expanded={showProfileMenu}
              >
                <span className="admin-profile-avatar">{initials}</span>
              </button>

              {showProfileMenu && (
                <div className="admin-profile-dropdown" role="menu">
                  <div className="admin-profile-dropdown-name">
                    <span className="admin-profile-dropdown-avatar">{initials}</span>
                    <span className="admin-profile-dropdown-fullname">{fullName}</span>
                  </div>
                  <div className="admin-profile-dropdown-divider" />
                  <button
                    type="button"
                    className="admin-profile-dropdown-item"
                    role="menuitem"
                    onClick={() => { setShowProfileMenu(false); navigate('/admin/profile'); }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    Edit Profile
                  </button>
                  <button
                    type="button"
                    className="admin-profile-dropdown-item admin-profile-dropdown-logout"
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

        <div className="admin-page-body">
          {children}
        </div>

        <LogoutConfirmModal
          isOpen={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          onConfirm={handleConfirmLogout}
        />
      </main>
    </div>
  );
}
