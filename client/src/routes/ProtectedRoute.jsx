import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

export default function ProtectedRoute({ children, requiredRoles = null, permission = null }) {
  const { isAuthenticated, user, loading, permissionsLoading, can } = useContext(AppContext);
  const normalizedUserRole = String(user?.role || '').trim().toLowerCase();
  const allowedRoles = (requiredRoles || []).map((role) => String(role).trim().toLowerCase());

  if (loading || (isAuthenticated && permission && permissionsLoading)) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        fontSize: '1rem',
        color: 'var(--color-gray-600)'
      }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    // Decide login route based on requiredRoles
    const roles = allowedRoles;
    if (roles.includes('super_admin')) {
      return <Navigate to="/super-admin/login" replace />;
    }
    if (roles.includes('admin')) {
      return <Navigate to="/admin/login" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles && allowedRoles.length > 0 && !allowedRoles.includes(normalizedUserRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (permission && !can(permission.module, permission.resource, permission.action || 'view')) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
