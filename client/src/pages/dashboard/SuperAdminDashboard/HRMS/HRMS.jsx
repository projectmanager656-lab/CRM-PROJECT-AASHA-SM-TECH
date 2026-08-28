import React, { useState } from 'react';
import SuperAdminLayout from '../components/SuperAdminLayout';
import EmployeesAdmin from '../../AdminDashboard/Employees/Employees';
import AttendanceAdmin from '../../AdminDashboard/Attendance/Attendance';
import LeaveRequestsAdmin from '../../AdminDashboard/LeaveRequests/LeaveRequests';

export default function HRMS() {
  const [tab, setTab] = useState('employees');
  const FragmentLayout = ({ children }) => <>{children}</>;

  return (
    <SuperAdminLayout pageTitle="HRMS">
      <div className="admin-page">
        <div className="admin-page-header">
          <h2>Human Resource Management System</h2>
          <div className="admin-tabs" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button 
              className={`action-btn ${tab === 'employees' ? 'primary' : 'view'}`} 
              onClick={() => setTab('employees')}
            >
              Employees
            </button>
            <button 
              className={`action-btn ${tab === 'attendance' ? 'primary' : 'view'}`} 
              onClick={() => setTab('attendance')}
            >
              Attendance
            </button>
            <button 
              className={`action-btn ${tab === 'leaves' ? 'primary' : 'view'}`} 
              onClick={() => setTab('leaves')}
            >
              Leave Requests
            </button>
          </div>
        </div>
        
        <div style={{ marginTop: '2rem' }}>
          {tab === 'employees' && <EmployeesAdmin Layout={FragmentLayout} />}
          {tab === 'attendance' && <AttendanceAdmin Layout={FragmentLayout} />}
          {tab === 'leaves' && <LeaveRequestsAdmin Layout={FragmentLayout} />}
        </div>
      </div>
    </SuperAdminLayout>
  );
}
