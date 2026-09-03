import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../../../context/AppContext';
import SuperAdminNavbar from './SuperAdminNavbar';
import SuperAdminSidebar from './SuperAdminSidebar';
import LogoutConfirmModal from '../../../../components/common/LogoutConfirmModal';

export default function SuperAdminLayout({ children, pageTitle }) {
  const { user, logout } = useContext(AppContext);
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleOpenLogoutModal = () => {
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    logout();
    navigate('/login');
  };

  return (
    <div className="superadmin-layout-shell">
      <SuperAdminSidebar user={user} onLogout={handleOpenLogoutModal} />
      <main className="superadmin-main-panel">
        <SuperAdminNavbar user={user} title={pageTitle} />
        <div className="superadmin-page-body">{children}</div>
      </main>

      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
      />
    </div>
  );
}
