import { useContext } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AppContext } from '../../../../../context/AppContext';
import { NON_TECH_LEAD_DEPARTMENTS } from '../../../../../config/departments';
import './UserLayout.css';

const navItems = [
  { label: 'Dashboard', path: '/user' },
  { label: 'My Profile', path: '/user/profile' },
  { label: 'My Tasks', path: '/user/tasks', permission: ['projects', 'tasks'] },
  { label: 'My Projects', path: '/user/projects', permission: ['projects', 'projects'] },
  { label: 'Non-Tech Leads', path: '/user/leads', permission: ['crm', 'leads'], departments: NON_TECH_LEAD_DEPARTMENTS },
  { label: 'My Clients', path: '/user/clients', permission: ['crm', 'clients'] },
  { label: 'Attendance', path: '/user/attendance', permission: ['hrms', 'attendance'] },
  { label: 'Leave Requests', path: '/user/leave-requests', permission: ['hrms', 'leave_requests'] },
  { label: 'Payroll', path: '/user/payroll', permission: ['finance', 'payroll'] },
  { label: 'Invoices', path: '/user/invoices' },
  { label: 'Documents', path: '/user/documents', permission: ['documents', 'documents'] },
  { label: 'Notifications', path: '/user/notifications', permission: ['communications', 'notifications'] },
  { label: 'Calendar', path: '/user/calendar', permission: ['communications', 'calendar'] },
  { label: 'Settings', path: '/user/settings' },
];

const navIcons = {
  '/user': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>,
  '/user/profile': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  '/user/tasks': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  '/user/projects': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,
  '/user/leads': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>,
  '/user/clients': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  '/user/attendance': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>,
  '/user/leave-requests': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  '/user/payroll': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  '/user/invoices': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  '/user/documents': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
  '/user/notifications': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  '/user/calendar': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  '/user/settings': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
};

export default function UserLayout({ children, pageTitle, pageSubtitle = 'Employee Portal' }) {
  const { user, logout, can } = useContext(AppContext);
  const location = useLocation();
  const navigate = useNavigate();

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

  return (
    <div className="user-layout-shell">
      <aside className="user-layout-sidebar">
        <div className="user-sidebar-header">
          <img className="user-brand-logo" src="/aasha-sm-logo.jpeg" alt="Aasha SM Tech" />
          <div className="user-brand-text">
            <h2>Aasha SM Tech</h2>
            <span>{pageSubtitle}</span>
          </div>
        </div>

        <div className="user-sidebar-profile">
          <div className="user-sidebar-avatar">{initials}</div>
          <div>
            <h3>{fullName}</h3>
            <p>{roleLabel}</p>
            <span className="user-status-dot">Online</span>
          </div>
        </div>

        <nav className="user-sidebar-nav" aria-label="User navigation">
          {navItems
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

        <button type="button" className="user-sidebar-logout" onClick={logout}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="logout-icon"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          Logout
        </button>
      </aside>

      <main className="user-layout-content">
        <header className="user-layout-topbar">
          <div className="user-layout-title">
            <span className="page-kicker">Employee</span>
            <h1>{pageTitle}</h1>
          </div>

          <div className="user-layout-actions">
            <label className="user-search-box" aria-label="Search employee area">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" placeholder="Search..." />
            </label>
            <button type="button" className="user-top-icon" onClick={() => navigate('/user/notifications')} aria-label="Open notifications">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
            </button>
            <button type="button" className="user-top-icon" onClick={() => navigate('/user/calendar')} aria-label="Open calendar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            </button>
          </div>
        </header>

        <div className="user-page-body">
          {children}
        </div>
      </main>
    </div>
  );
}
