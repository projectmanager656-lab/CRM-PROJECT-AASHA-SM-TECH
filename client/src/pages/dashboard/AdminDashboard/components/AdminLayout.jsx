import { useContext, useEffect, useState, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AppContext } from '../../../../context/AppContext';
import apiClient from '../../../../services/apiClient';
import MessageDropdown from '../../../../components/messaging/MessageDropdown';
import LogoutConfirmModal from '../../../../components/common/LogoutConfirmModal';
import './AdminLayout.css';

const navItems = [
  { label: 'Dashboard', path: '/admin' },
  { label: 'Employee Management', path: '/admin/employees', permission: ['administration', 'employees'] },
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
  {
    label: 'HR Support',
    isDropdown: true,
    children: [
      { label: 'HR Support Requests', path: '/admin/hr-support', aliasPath: '/user/hr-support' },
      { label: 'Recruitment', path: '/admin/recruitment', aliasPath: '/user/recruitment' },
      { label: 'Resignation & Exit', path: '/admin/resignation-exit', aliasPath: '/user/resignation-exit' },
      { label: 'Performance Management', path: '/user/performance' },
      { label: 'Training & Skill Development', path: '/user/training' },
      { label: 'Full & Final Settlement', path: '/user/full-and-final-settlement' },
      { label: 'Assets', path: '/user/assets' },
    ],
  },
  { label: 'Reports', path: '/admin/reports' },
];

const hrSupportSubItems = [
  { label: 'HR Support Requests', path: '/admin/hr-support', aliasPath: '/user/hr-support' },
  { label: 'Recruitment', path: '/admin/recruitment', aliasPath: '/user/recruitment' },
  { label: 'Resignation & Exit', path: '/admin/resignation-exit', aliasPath: '/user/resignation-exit' },
  { label: 'Performance Management', path: '/user/performance' },
  { label: 'Training & Skill Development', path: '/user/training' },
  { label: 'Full & Final Settlement', path: '/user/full-and-final-settlement' },
  { label: 'Assets', path: '/user/assets' },
];

const navIcons = {
  '/admin': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>,
  '/admin/employees': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  '/admin/departments': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="9" y1="22" x2="9" y2="22.01" /><line x1="15" y1="22" x2="15" y2="22.01" /><line x1="9" y1="6" x2="9" y2="6.01" /><line x1="15" y1="6" x2="15" y2="6.01" /><line x1="9" y1="10" x2="9" y2="10.01" /><line x1="15" y1="10" x2="15" y2="10.01" /></svg>,
  '/admin/projects': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,
  '/admin/tasks': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  '/admin/leads': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>,
  '/admin/clients': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  '/admin/attendance': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
  '/admin/leave-requests': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  '/admin/payroll': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  '/admin/invoices': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>,
  '/admin/documents': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
  'hr-support-main': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M4.93 4.93l4.24 4.24" /><path d="M14.83 9.17l4.24-4.24" /><path d="M14.83 14.83l4.24 4.24" /><path d="M4.93 19.07l4.24-4.24" /><circle cx="12" cy="12" r="4" /></svg>,
  '/admin/recruitment': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><circle cx="19" cy="11" r="2" /><path d="M19 8v1" /><path d="M19 13v1" /><path d="M22 11h-1" /><path d="M17 11h-1" /></svg>,
  '/user/recruitment': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><circle cx="19" cy="11" r="2" /><path d="M19 8v1" /><path d="M19 13v1" /><path d="M22 11h-1" /><path d="M17 11h-1" /></svg>,
  '/admin/resignation-exit': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
  '/user/resignation-exit': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
  '/admin/hr-support': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>,
  '/user/hr-support': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>,
  '/user/performance': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>,
  '/user/training': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>,
  '/user/full-and-final-settlement': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l3 3v15H6z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h6M9 9h2" /></svg>,
  '/user/assets': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>,
  '/admin/reports': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>,
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

  // Exact active matching logic
  const isItemActive = (item) => {
    if (item.path === '/admin') {
      return (
        location.pathname === '/admin' ||
        location.pathname === '/admin/' ||
        location.pathname === '/admin/dashboard'
      );
    }
    return (
      location.pathname === item.path ||
      (item.aliasPath && location.pathname === item.aliasPath) ||
      location.pathname.startsWith(item.path + '/') ||
      (item.aliasPath && location.pathname.startsWith(item.aliasPath + '/'))
    );
  };

  // Check if any HR Support child route is currently active
  const isHrChildActive = hrSupportSubItems.some(
    (sub) =>
      location.pathname === sub.path ||
      (sub.aliasPath && location.pathname === sub.aliasPath) ||
      location.pathname.startsWith(sub.path + '/') ||
      (sub.aliasPath && location.pathname.startsWith(sub.aliasPath + '/'))
  );

  const [hrDropdownOpen, setHrDropdownOpen] = useState(isHrChildActive);

  // Auto-expand HR Support dropdown if navigating to any child route
  useEffect(() => {
    if (isHrChildActive) {
      setHrDropdownOpen(true);
    }
  }, [isHrChildActive, location.pathname]);

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

  const isQueryMatching = (item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (item.label.toLowerCase().includes(q)) return true;
    if (item.isDropdown && item.children.some((child) => child.label.toLowerCase().includes(q))) return true;
    return false;
  };

  return (
    <div className="admin-layout-shell">
      <aside className="admin-layout-sidebar">
        <div className="sidebar-logo-container">
          <img className="sidebar-full-logo" src="/aasha-logo-new.jpg" alt="ASHA SM TECHNOLOGIES" />
        </div>

        <nav className="admin-sidebar-nav" aria-label="Admin navigation">
          {navItems
            .filter((item) => !item.permission || can(...item.permission, 'view'))
            .filter(isQueryMatching)
            .map((item) => {
              if (item.isDropdown) {
                const isGroupActive = item.children.some(
                  (c) =>
                    location.pathname === c.path ||
                    (c.aliasPath && location.pathname === c.aliasPath) ||
                    location.pathname.startsWith(c.path + '/') ||
                    (c.aliasPath && location.pathname.startsWith(c.aliasPath + '/'))
                );
                const shouldExpand = hrDropdownOpen || Boolean(searchQuery);

                return (
                  <div key={item.label} className={`admin-nav-dropdown-group ${isGroupActive ? 'child-active' : ''}`}>
                    <button
                      type="button"
                      className={`admin-nav-item admin-nav-dropdown-toggle ${isGroupActive ? 'active-parent' : ''}`}
                      onClick={() => setHrDropdownOpen((prev) => !prev)}
                      aria-expanded={shouldExpand}
                    >
                      <span className="nav-item-icon" aria-hidden="true">{navIcons['hr-support-main']}</span>
                      <span className="nav-item-text">{item.label}</span>
                      <span className={`nav-dropdown-chevron ${shouldExpand ? 'open' : ''}`} aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </span>
                    </button>

                    {shouldExpand && (
                      <div className="admin-nav-submenu">
                        {item.children
                          .filter((sub) => !searchQuery || sub.label.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map((sub) => {
                            const isSubActive =
                              location.pathname === sub.path ||
                              (sub.aliasPath && location.pathname === sub.aliasPath) ||
                              location.pathname.startsWith(sub.path + '/') ||
                              (sub.aliasPath && location.pathname.startsWith(sub.aliasPath + '/'));

                            return (
                              <NavLink
                                key={sub.path}
                                to={sub.path}
                                className={() =>
                                  `admin-subnav-item ${isSubActive ? 'active' : ''}`
                                }
                              >
                                <span className="subnav-item-icon" aria-hidden="true">{navIcons[sub.path]}</span>
                                <span className="subnav-item-text">{sub.label}</span>
                              </NavLink>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              }

              const active = isItemActive(item);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/admin'}
                  className={() =>
                    `admin-nav-item ${active ? 'active' : ''}`
                  }
                >
                  <span className="nav-item-icon" aria-hidden="true">{navIcons[item.path]}</span>
                  <span className="nav-item-text">{item.label}</span>
                </NavLink>
              );
            })}
        </nav>
      </aside>

      <main className="admin-layout-content">
        <header className="admin-layout-topbar">
          <div className="admin-layout-welcome">
            <span className="admin-layout-welcome-title">Admin Management</span>
            <span className="admin-layout-welcome-sub">ASHA SM Technologies CRM</span>
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
