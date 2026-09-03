import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import BlankLayout from '../layouts/BlankLayout';
import AdminLogin from '../pages/auth/AdminLogin/AdminLogin';
import AdminRegister from '../pages/auth/AdminRegister/AdminRegister';
import Login from '../pages/auth/Login/Login';
import Register from '../pages/auth/Register/Register';
import UserSplash from '../pages/auth/UserSplash/UserSplash';
import SuperAdminLogin from '../pages/auth/SuperAdminLogin/SuperAdminLogin';
import ForgotPassword from '../pages/auth/ForgotPassword/ForgotPassword';
import VerifyOtp from '../pages/auth/VerifyOtp/VerifyOtp';
import ResetPassword from '../pages/auth/ResetPassword/ResetPassword';
import AdminDashboard from '../pages/dashboard/AdminDashboard/AdminDashboard';
import AdminAttendance from '../pages/dashboard/AdminDashboard/Attendance/Attendance';
import AdminAnnouncements from '../pages/dashboard/AdminDashboard/Announcements/Announcements';
import AdminClients from '../pages/dashboard/AdminDashboard/Clients/Clients';
import AdminCalendar from '../pages/dashboard/AdminDashboard/Calendar/Calendar';
import AdminDepartments from '../pages/dashboard/AdminDashboard/Departments/Departments';
import AdminDocuments from '../pages/dashboard/AdminDashboard/Documents/Documents';
import AdminEmployees from '../pages/dashboard/AdminDashboard/Employees/Employees';
import AdminLeads from '../pages/dashboard/AdminDashboard/Leads/Leads';
import AdminLeaveRequests from '../pages/dashboard/AdminDashboard/LeaveRequests/LeaveRequests';
import AdminNotifications from '../pages/dashboard/AdminDashboard/Notifications/Notifications';
import AdminPayroll from '../pages/dashboard/AdminDashboard/Payroll/Payroll';
import AdminProjects from '../pages/dashboard/AdminDashboard/Projects/Projects';
import AdminReports from '../pages/dashboard/AdminDashboard/Reports/Reports';
import AdminInvoices from '../pages/dashboard/AdminDashboard/Invoices/Invoices';
import AdminSettings from '../pages/dashboard/AdminDashboard/Settings/Configuration';
import AdminTasks from '../pages/dashboard/AdminDashboard/Tasks/Tasks';
import SuperAdminActivityLogs from '../pages/dashboard/SuperAdminDashboard/ActivityLogs/ActivityLogs';
import SuperAdminAPIIntegrations from '../pages/dashboard/SuperAdminDashboard/APIIntegrations/APIIntegrations';
import SuperAdminAuditLogs from '../pages/dashboard/SuperAdminDashboard/AuditLogs/AuditLogs';
import SuperAdminCRM from '../pages/dashboard/SuperAdminDashboard/CRM/CRM';
import SuperAdminDatabaseBackup from '../pages/dashboard/SuperAdminDashboard/DatabaseBackup/DatabaseBackup';
import SuperAdminDepartments from '../pages/dashboard/SuperAdminDashboard/Departments/Departments';
import SuperAdminHRMS from '../pages/dashboard/SuperAdminDashboard/HRMS/HRMS';
import SuperAdminModules from '../pages/dashboard/SuperAdminDashboard/Modules/Modules';
import SuperAdminNotifications from '../pages/dashboard/SuperAdminDashboard/Notifications/Notifications';
import SuperAdminPayroll from '../pages/dashboard/SuperAdminDashboard/Payroll/Payroll';
import SuperAdminInvoices from '../pages/dashboard/SuperAdminDashboard/Invoices/Invoices';
import SuperAdminProjects from '../pages/dashboard/SuperAdminDashboard/Projects/Projects';
import SuperAdminReports from '../pages/dashboard/SuperAdminDashboard/Reports/Reports';
import SuperAdminRolesPermissions from '../pages/dashboard/SuperAdminDashboard/RolesPermissions/RolesPermissions';
import SuperAdminSettings from '../pages/dashboard/SuperAdminDashboard/Settings/Settings';
import SuperAdminDashboard from '../pages/dashboard/SuperAdminDashboard/SuperAdminDashboard';
import SuperAdminSystemSettings from '../pages/dashboard/SuperAdminDashboard/SystemSettings/SystemSettings';
import SuperAdminUsers from '../pages/dashboard/SuperAdminDashboard/Users/Users';
import SuperAdminCalendar from '../pages/dashboard/SuperAdminDashboard/Calendar/Calendar';
import SuperAdminAttendance from '../pages/dashboard/SuperAdminDashboard/Attendance/Attendance';
import UserDashboard from '../pages/dashboard/UserDashboard/UserDashboard';
import Attendance from '../pages/dashboard/UserDashboard/users/Attendance/AttendancePage';
import Clients from '../pages/dashboard/UserDashboard/users/Clients/Clients';
import Calendar from '../pages/dashboard/UserDashboard/users/Calendar/Calendar';
import Documents from '../pages/dashboard/UserDashboard/users/Documents/Documents';
import Leads from '../pages/dashboard/UserDashboard/users/Leads/Leads';
import LeaveRequests from '../pages/dashboard/UserDashboard/users/LeaveRequests/LeaveRequests';
import Notifications from '../pages/dashboard/UserDashboard/users/Notifications/Notifications';
import Payroll from '../pages/dashboard/UserDashboard/users/Payroll/Payroll';
import Invoices from '../pages/dashboard/UserDashboard/users/Invoices/Invoices';
import Profile from '../pages/dashboard/UserDashboard/users/Profile/Profile';
import Projects from '../pages/dashboard/UserDashboard/users/Projects/Projects';
import Settings from '../pages/dashboard/UserDashboard/users/Settings/Settings';
import Tasks from '../pages/dashboard/UserDashboard/users/Tasks/Tasks';
import Inbox from '../pages/dashboard/Chat/Inbox';
import ProtectedRoute from './ProtectedRoute';
import { getDashboardRoute } from '../utils/dashboardUtils';

// Department Dashboards & HR Modules
import HRDashboard from '../pages/dashboard/UserDashboard/departments/HRDashboard';
import HREmployees from '../pages/dashboard/UserDashboard/users/Employees/HREmployees';
import HRDepartments from '../pages/dashboard/UserDashboard/users/Departments/HRDepartments';
import Performance from '../pages/dashboard/UserDashboard/users/Performance/Performance';
import Recruitment from '../pages/dashboard/UserDashboard/users/Recruitment/Recruitment';
import Training from '../pages/dashboard/UserDashboard/users/Training/Training';
import Assets from '../pages/dashboard/UserDashboard/users/Assets/Assets';
import HRReports from '../pages/dashboard/UserDashboard/users/Reports/HRReports';
import ResignationExit from '../pages/dashboard/UserDashboard/users/ResignationExit/ResignationExit';
import DigitalMarketingDashboard from '../pages/dashboard/UserDashboard/departments/DigitalMarketingDashboard';
import VideoEditorDashboard from '../pages/dashboard/UserDashboard/departments/VideoEditorDashboard';
import BusinessDevelopmentDashboard from '../pages/dashboard/UserDashboard/departments/BusinessDevelopmentDashboard';
import FinanceDashboard from '../pages/dashboard/UserDashboard/departments/FinanceDashboard';

const RootRedirect = () => {
  const { isAuthenticated, user, loading } = useContext(AppContext);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontSize: '1rem', color: 'var(--color-gray-600)' }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const normalizedUserRole = String(user?.role || '').trim().toLowerCase();

  if (normalizedUserRole === 'super_admin') {
    return <Navigate to="/super-admin/dashboard" replace />;
  }

  if (normalizedUserRole === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

const NotFound = () => React.createElement(
  'div',
  { style: { padding: '2rem', textAlign: 'center' } },
  React.createElement('h1', null, '404 - Page Not Found'),
  React.createElement('p', null, "The page you're looking for doesn't exist.")
);

const Unauthorized = () => React.createElement(
  'div',
  { style: { padding: '2rem', textAlign: 'center' } },
  React.createElement('h1', null, '403 - Unauthorized'),
  React.createElement('p', null, "You don't have permission to access this page.")
);

const withProtected = (Component, requiredRoles = ['employee'], permission = null) =>
  () => React.createElement(ProtectedRoute, { requiredRoles, permission }, React.createElement(Component));

const withUserSplash = (Component) => () => React.createElement(UserSplash, null, React.createElement(Component));

const routeConfig = [
  { path: '/', component: RootRedirect, layout: BlankLayout },
  { path: '/login', component: withUserSplash(Login), layout: BlankLayout },
  { path: '/register', component: withUserSplash(Register), layout: BlankLayout },
  { path: '/forgot-password', component: withUserSplash(ForgotPassword), layout: BlankLayout },
  { path: '/verify-otp', component: withUserSplash(VerifyOtp), layout: BlankLayout },
  { path: '/reset-password', component: withUserSplash(ResetPassword), layout: BlankLayout },
  { path: '/admin/login', component: AdminLogin, layout: BlankLayout },
  { path: '/admin/register', component: AdminRegister, layout: BlankLayout },
  { path: '/super-admin/login', component: SuperAdminLogin, layout: BlankLayout },
  { path: '/unauthorized', component: Unauthorized, layout: BlankLayout },
  { path: '/dashboard/hr', component: withProtected(HRDashboard, ['employee', 'user']), layout: BlankLayout },
  { path: '/dashboard/finance', component: withProtected(FinanceDashboard, ['employee', 'user']), layout: BlankLayout },
  { path: '/dashboard/business-development', component: withProtected(BusinessDevelopmentDashboard, ['employee', 'user']), layout: BlankLayout },
  { path: '/dashboard/digital-marketing', component: withProtected(DigitalMarketingDashboard, ['employee', 'user']), layout: BlankLayout },
  { path: '/dashboard/video-editor', component: withProtected(VideoEditorDashboard, ['employee', 'user']), layout: BlankLayout },
  { path: '/dashboard/sales', component: () => React.createElement(Navigate, { to: '/dashboard/business-development', replace: true }), layout: BlankLayout },
  { path: '/dashboard', component: withProtected(UserDashboard, ['employee', 'user']), layout: BlankLayout },
  { path: '/dashboard/user', component: withProtected(UserDashboard, ['employee', 'user']), layout: BlankLayout },
  { path: '/admin/dashboard', component: withProtected(AdminDashboard, ['admin']), layout: BlankLayout },
  { path: '/dashboard/admin', component: withProtected(AdminDashboard, ['admin']), layout: BlankLayout },
  { path: '/super-admin/dashboard', component: withProtected(SuperAdminDashboard, ['super_admin']), layout: BlankLayout },
  { path: '/dashboard/super-admin', component: withProtected(SuperAdminDashboard, ['super_admin']), layout: BlankLayout },
  { path: '/user', component: withProtected(UserDashboard, ['employee', 'user']), layout: BlankLayout },
  { path: '/UserDashboard', component: withProtected(UserDashboard, ['employee', 'user']), layout: BlankLayout },
  { path: '/user/profile', component: withProtected(Profile, ['employee']), layout: BlankLayout },
  { path: '/user/profile/edit', component: withProtected(Profile, ['employee']), layout: BlankLayout },
  { path: '/user/tasks', component: withProtected(Tasks, ['employee'], { module: 'projects', resource: 'tasks', action: 'view' }), layout: BlankLayout },
  { path: '/user/tasks/new', component: withProtected(Tasks, ['employee']), layout: BlankLayout },
  { path: '/user/tasks/:id/edit', component: withProtected(Tasks, ['employee']), layout: BlankLayout },
  { path: '/user/tasks/:id', component: withProtected(Tasks, ['employee']), layout: BlankLayout },
  { path: '/user/projects', component: withProtected(Projects, ['employee'], { module: 'projects', resource: 'projects', action: 'view' }), layout: BlankLayout },
  { path: '/user/projects/new', component: withProtected(Projects, ['employee']), layout: BlankLayout },
  { path: '/user/projects/:id/edit', component: withProtected(Projects, ['employee']), layout: BlankLayout },
  { path: '/user/projects/:id', component: withProtected(Projects, ['employee']), layout: BlankLayout },
  { path: '/user/leads', component: withProtected(Leads, ['employee'], { module: 'crm', resource: 'leads', action: 'view' }), layout: BlankLayout },
  { path: '/user/leads/new', component: withProtected(Leads, ['employee']), layout: BlankLayout },
  { path: '/user/leads/:id/edit', component: withProtected(Leads, ['employee']), layout: BlankLayout },
  { path: '/user/leads/:id', component: withProtected(Leads, ['employee']), layout: BlankLayout },
  { path: '/user/clients', component: withProtected(Clients, ['employee'], { module: 'crm', resource: 'clients', action: 'view' }), layout: BlankLayout },
  { path: '/user/clients/new', component: withProtected(Clients, ['employee']), layout: BlankLayout },
  { path: '/user/clients/:id/edit', component: withProtected(Clients, ['employee']), layout: BlankLayout },
  { path: '/user/clients/:id', component: withProtected(Clients, ['employee']), layout: BlankLayout },
  { path: '/user/calendar', component: withProtected(Calendar, ['employee', 'user'], { module: 'communications', resource: 'calendar', action: 'view' }), layout: BlankLayout },
  { path: '/user/attendance', component: withProtected(Attendance, ['employee'], { module: 'hrms', resource: 'attendance', action: 'view' }), layout: BlankLayout },
  { path: '/user/attendance/:id', component: withProtected(Attendance, ['employee']), layout: BlankLayout },
  { path: '/user/leave-requests', component: withProtected(LeaveRequests, ['employee'], { module: 'hrms', resource: 'leave_requests', action: 'view' }), layout: BlankLayout },
  { path: '/user/leave-requests/new', component: withProtected(LeaveRequests, ['employee']), layout: BlankLayout },
  { path: '/user/leave-requests/:id', component: withProtected(LeaveRequests, ['employee']), layout: BlankLayout },
  { path: '/user/payroll', component: withProtected(Payroll, ['employee'], { module: 'finance', resource: 'payroll', action: 'view' }), layout: BlankLayout },
  { path: '/user/payroll/:id', component: withProtected(Payroll, ['employee'], { module: 'finance', resource: 'payroll', action: 'view' }), layout: BlankLayout },
  { path: '/user/invoices', component: withProtected(Invoices, ['employee']), layout: BlankLayout },
  { path: '/user/invoices/:id', component: withProtected(Invoices, ['employee']), layout: BlankLayout },
  { path: '/user/documents', component: withProtected(Documents, ['employee'], { module: 'documents', resource: 'documents', action: 'view' }), layout: BlankLayout },
  { path: '/user/documents/upload', component: withProtected(Documents, ['employee']), layout: BlankLayout },
  { path: '/user/documents/:id', component: withProtected(Documents, ['employee']), layout: BlankLayout },
  { path: '/user/notifications', component: withProtected(Notifications, ['employee'], { module: 'communications', resource: 'notifications', action: 'view' }), layout: BlankLayout },
  { path: '/user/notifications/:id', component: withProtected(Notifications, ['employee']), layout: BlankLayout },
  { path: '/user/employees', component: withProtected(HREmployees, ['employee', 'user', 'admin']), layout: BlankLayout },
  { path: '/user/departments', component: withProtected(HRDepartments, ['employee', 'user', 'admin']), layout: BlankLayout },
  { path: '/user/performance', component: withProtected(Performance, ['employee', 'user', 'admin']), layout: BlankLayout },
  { path: '/user/recruitment', component: withProtected(Recruitment, ['employee', 'user', 'admin']), layout: BlankLayout },
  { path: '/user/resignation-exit', component: withProtected(ResignationExit, ['employee', 'user', 'admin']), layout: BlankLayout },
  { path: '/user/resignation', component: withProtected(ResignationExit, ['employee', 'user', 'admin']), layout: BlankLayout },
  { path: '/user/training', component: withProtected(Training, ['employee', 'user', 'admin']), layout: BlankLayout },
  { path: '/user/assets', component: withProtected(Assets, ['employee', 'user', 'admin']), layout: BlankLayout },
  { path: '/user/reports', component: withProtected(HRReports, ['employee', 'user', 'admin']), layout: BlankLayout },
  { path: '/user/settings', component: withProtected(Settings, ['employee']), layout: BlankLayout },
  { path: '/user/inbox', component: withProtected(Inbox, ['employee', 'user']), layout: BlankLayout },
  { path: '/admin', component: withProtected(AdminDashboard, ['admin']), layout: BlankLayout },
  { path: '/AdminDashboard', component: withProtected(AdminDashboard, ['admin']), layout: BlankLayout },
  { path: '/admin/profile', component: withProtected(Profile, ['admin']), layout: BlankLayout },
  { path: '/admin/profile/edit', component: withProtected(Profile, ['admin']), layout: BlankLayout },
  { path: '/admin/employees', component: withProtected(AdminEmployees, ['admin', 'super_admin']), layout: BlankLayout },
  { path: '/admin/departments', component: withProtected(AdminDepartments, ['admin', 'super_admin']), layout: BlankLayout },
  { path: '/admin/projects', component: withProtected(AdminProjects, ['admin', 'super_admin'], { module: 'projects', resource: 'projects', action: 'view' }), layout: BlankLayout },
  { path: '/admin/tasks', component: withProtected(AdminTasks, ['admin', 'super_admin'], { module: 'projects', resource: 'tasks', action: 'view' }), layout: BlankLayout },
  { path: '/admin/leads', component: withProtected(AdminLeads, ['admin', 'super_admin'], { module: 'crm', resource: 'leads', action: 'view' }), layout: BlankLayout },
  { path: '/admin/clients', component: withProtected(AdminClients, ['admin', 'super_admin'], { module: 'crm', resource: 'clients', action: 'view' }), layout: BlankLayout },
  { path: '/admin/calendar', component: withProtected(AdminCalendar, ['admin', 'super_admin']), layout: BlankLayout },
  { path: '/admin/attendance', component: withProtected(AdminAttendance, ['admin', 'super_admin']), layout: BlankLayout },
  { path: '/admin/announcements', component: withProtected(AdminAnnouncements, ['admin', 'super_admin']), layout: BlankLayout },
  { path: '/admin/leave-requests', component: withProtected(AdminLeaveRequests, ['admin', 'super_admin']), layout: BlankLayout },
  { path: '/admin/payroll', component: withProtected(AdminPayroll, ['admin', 'super_admin'], { module: 'finance', resource: 'payroll', action: 'view' }), layout: BlankLayout },
  { path: '/admin/invoices', component: withProtected(AdminInvoices, ['admin', 'super_admin']), layout: BlankLayout },
  { path: '/admin/documents', component: withProtected(AdminDocuments, ['admin', 'super_admin']), layout: BlankLayout },
  { path: '/admin/reports', component: withProtected(AdminReports, ['admin', 'super_admin']), layout: BlankLayout },
  { path: '/admin/notifications', component: withProtected(AdminNotifications, ['admin', 'super_admin']), layout: BlankLayout },
  { path: '/admin/settings', component: withProtected(AdminSettings, ['admin', 'super_admin']), layout: BlankLayout },
  { path: '/admin/inbox', component: withProtected(Inbox, ['admin']), layout: BlankLayout },
  { path: '/super-admin', component: withProtected(SuperAdminDashboard, ['super_admin']), layout: BlankLayout },
  { path: '/SuperAdminDashboard', component: withProtected(SuperAdminDashboard, ['super_admin']), layout: BlankLayout },
  { path: '/super-admin/dashboard', component: withProtected(SuperAdminDashboard, ['super_admin']), layout: BlankLayout },
  { path: '/super-admin/profile', component: withProtected(Profile, ['super_admin']), layout: BlankLayout },
  { path: '/super-admin/profile/edit', component: withProtected(Profile, ['super_admin']), layout: BlankLayout },
  { path: '/super-admin/users', component: withProtected(SuperAdminUsers, ['super_admin']), layout: BlankLayout },
  { path: '/super-admin/roles-permissions', component: withProtected(SuperAdminRolesPermissions, ['super_admin']), layout: BlankLayout },
  { path: '/super-admin/departments', component: withProtected(SuperAdminDepartments, ['super_admin']), layout: BlankLayout },
  { path: '/super-admin/modules', component: withProtected(SuperAdminModules, ['super_admin']), layout: BlankLayout },
  { path: '/super-admin/system-settings', component: withProtected(SuperAdminSystemSettings, ['super_admin']), layout: BlankLayout },
  { path: '/super-admin/crm', component: withProtected(SuperAdminCRM, ['super_admin']), layout: BlankLayout },
  { path: '/super-admin/projects', component: withProtected(SuperAdminProjects, ['super_admin']), layout: BlankLayout },
  { path: '/super-admin/hrms', component: withProtected(SuperAdminHRMS, ['super_admin']), layout: BlankLayout },
  { path: '/super-admin/payroll', component: withProtected(SuperAdminPayroll, ['super_admin'], { module: 'finance', resource: 'payroll', action: 'view' }), layout: BlankLayout },
  { path: '/super-admin/invoices', component: withProtected(SuperAdminInvoices, ['super_admin']), layout: BlankLayout },
  { path: '/super-admin/calendar', component: withProtected(SuperAdminCalendar, ['super_admin']), layout: BlankLayout },
  { path: '/super-admin/attendance', component: withProtected(SuperAdminAttendance, ['super_admin']), layout: BlankLayout },
  { path: '/super-admin/reports', component: withProtected(SuperAdminReports, ['super_admin']), layout: BlankLayout },
  { path: '/super-admin/notifications', component: withProtected(SuperAdminNotifications, ['super_admin']), layout: BlankLayout },
  { path: '/super-admin/database-backup', component: withProtected(SuperAdminDatabaseBackup, ['super_admin']), layout: BlankLayout },
  { path: '/super-admin/activity-logs', component: withProtected(SuperAdminActivityLogs, ['super_admin']), layout: BlankLayout },
  { path: '/super-admin/audit-logs', component: withProtected(SuperAdminAuditLogs, ['super_admin']), layout: BlankLayout },
  { path: '/super-admin/api-integrations', component: withProtected(SuperAdminAPIIntegrations, ['super_admin']), layout: BlankLayout },
  { path: '/super-admin/settings', component: withProtected(SuperAdminSettings, ['super_admin']), layout: BlankLayout },
  { path: '/super-admin/inbox', component: withProtected(Inbox, ['super_admin']), layout: BlankLayout },
  { path: '/unauthorized', component: Unauthorized, layout: BlankLayout },
  { path: '*', component: NotFound, layout: BlankLayout },
];

export default routeConfig;
