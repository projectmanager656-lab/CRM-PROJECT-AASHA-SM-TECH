import React from 'react';
import SuperAdminLayout from '../components/SuperAdminLayout';
import AdminReports from '../../AdminDashboard/Reports/Reports';

export default function Reports() {
  return <AdminReports Layout={SuperAdminLayout} />;
}
