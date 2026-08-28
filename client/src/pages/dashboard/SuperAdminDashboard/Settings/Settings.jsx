import React from 'react';
import SuperAdminLayout from '../components/SuperAdminLayout';
import Profile from '../../UserDashboard/users/Profile/Profile';

export default function Settings() {
  return <Profile CustomLayout={SuperAdminLayout} />;
}
