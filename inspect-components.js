const fs = require('fs');
const path = require('path');

const clientBase = path.join(__dirname, 'client', 'src', 'pages', 'dashboard');
const superBase = path.join(clientBase, 'SuperAdminDashboard');
const adminBase = path.join(clientBase, 'AdminDashboard');

const targets = [
  path.join(superBase, 'Users', 'Users.jsx'),
  path.join(adminBase, 'Employees', 'Employees.jsx'),
  path.join(superBase, 'Departments', 'Departments.jsx'),
  path.join(adminBase, 'Departments', 'Departments.jsx'),
  path.join(superBase, 'Modules', 'Modules.jsx'),
  path.join(superBase, 'SystemSettings', 'SystemSettings.jsx'),
  path.join(superBase, 'CRM', 'CRM.jsx'),
  path.join(superBase, 'Projects', 'Projects.jsx'),
  path.join(superBase, 'HRMS', 'HRMS.jsx'),
  path.join(superBase, 'Reports', 'Reports.jsx'),
  path.join(adminBase, 'Reports', 'Reports.jsx'),
  path.join(superBase, 'DatabaseBackup', 'DatabaseBackup.jsx'),
  path.join(superBase, 'ActivityLogs', 'ActivityLogs.jsx'),
  path.join(superBase, 'AuditLogs', 'AuditLogs.jsx'),
  path.join(superBase, 'APIIntegrations', 'APIIntegrations.jsx'),
  path.join(superBase, 'Settings', 'Settings.jsx'),
  path.join(adminBase, 'Settings', 'Configuration.jsx')
];

let output = '';
for (const t of targets) {
  output += `\n\n=== FILE: ${t} ===\n`;
  try {
    output += fs.readFileSync(t, 'utf8');
  } catch (e) {
    output += `ERROR: ${e.message}`;
  }
}

fs.writeFileSync(path.join(__dirname, 'inspection.txt'), output);
console.log('Inspection complete');
