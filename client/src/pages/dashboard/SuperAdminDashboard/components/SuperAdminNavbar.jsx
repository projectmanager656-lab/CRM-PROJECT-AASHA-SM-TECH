import { useNavigate } from 'react-router-dom';
import NotificationDropdown from './NotificationDropdown';
import MessageDropdown from '../../../../components/messaging/MessageDropdown';

export default function SuperAdminNavbar({ user, title }) {
  const navigate = useNavigate();
  const fullName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || user?.email || 'Super Admin';

  return (
    <header className="superadmin-header">
      <div className="superadmin-header-main">
        <button type="button" className="mobile-menu-button">☰</button>
        <div>
          <span className="eyebrow">System overview</span>
          <h1>{title}</h1>
        </div>
      </div>

      <div className="superadmin-header-actions">
        <label className="superadmin-search" aria-label="Search system">
          <span>⌕</span>
          <input type="text" placeholder="Search..." />
        </label>
        
        <NotificationDropdown />
        <MessageDropdown />
        
        <button 
          type="button" 
          className="header-icon-button"
          onClick={() => {
            const baseRoute = user?.role === 'super_admin' ? '/super-admin' : (user?.role === 'admin' ? '/admin' : '/user');
            navigate(`${baseRoute}/settings`);
          }}
          aria-label="Settings"
        >
          ⚙️
        </button>

        <div className="superadmin-profile-chip">
          <div className="profile-avatar">{fullName.slice(0, 2).toUpperCase()}</div>
          <div className="profile-copy">
            <strong>{fullName}</strong>
            <span>{user?.email || 'superadmin@itcms.com'}</span>
          </div>
          <span className="chip-caret">▾</span>
        </div>
      </div>
    </header>
  );
}
