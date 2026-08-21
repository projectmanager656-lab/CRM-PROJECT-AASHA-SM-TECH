import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../../../context/AppContext';
import SuperAdminNavbar from './SuperAdminNavbar';
import SuperAdminSidebar from './SuperAdminSidebar';

export default function SuperAdminLayout({ children, pageTitle }) {
  const { user, logout } = useContext(AppContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="superadmin-layout-shell">
      <SuperAdminSidebar user={user} onLogout={handleLogout} />
      <main className="superadmin-main-panel">
        <SuperAdminNavbar user={user} title={pageTitle} />
        <div className="superadmin-page-body">{children}</div>
      </main>
    </div>
  );
}
