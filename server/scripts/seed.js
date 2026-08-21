import 'dotenv/config';
import bcryptjs from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { config } from '../src/config/environment.js';
import SuperAdmin from '../src/models/SuperAdmin.js';
import Department from '../src/models/Department.js';

const standardDepartments = [
  'Human Resources (HR)',
  'Sales',
  'Marketing',
  'Business Development',
  'Finance & Accounts',
  'Information Technology (IT)',
  'Operations',
  'Customer Support',
  'Administration',
  'Project Management',
];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const seedDepartments = async () => {
  let created = 0;
  let standardized = 0;

  for (const name of standardDepartments) {
    const matches = await Department.find({ name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } }).sort({ createdAt: 1 });
    const department = matches.find((item) => item.name === name) || matches[0];

    if (!department) {
      await Department.create({ name, status: 'Active' });
      created += 1;
      continue;
    }

    if (department.name !== name || department.status !== 'Active') {
      department.name = name;
      department.status = 'Active';
      await department.save();
      standardized += 1;
    }

    // Case variants represent the same standard department. Keep one canonical document.
    if (matches.length > 1) {
      await Department.deleteMany({ _id: { $in: matches.filter((item) => String(item._id) !== String(department._id)).map((item) => item._id) } });
      standardized += matches.length - 1;
    }
  }

  return { created, standardized };
};

const seedSuperAdmin = async () => {
  const email = config.superAdminEmail.trim().toLowerCase();
  const password = config.superAdminPassword;

  if (!email || !password) {
    throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be configured');
  }

  let account = await SuperAdmin.findOne({ email }).select('+password');
  if (!account) {
    account = new SuperAdmin({
      email,
      password,
      firstName: 'Project Manager',
      lastName: 'Super Admin',
      role: 'super_admin',
      isActive: true,
    });
  } else {
    account.role = 'super_admin';
    account.isActive = true;
    if (!(await bcryptjs.compare(password, account.password))) {
      account.password = password;
    }
  }

  await account.save();
  const removal = await SuperAdmin.deleteMany({ _id: { $ne: account._id } });

  return { email: account.email, removedOtherAccounts: removal.deletedCount };
};

try {
  await connectDB();
  const departments = await seedDepartments();
  console.log(`Departments ready: ${departments.created} created, ${departments.standardized} standardized.`);
  if (!process.argv.includes('--departments-only')) {
    const superAdmin = await seedSuperAdmin();
    console.log(`Super Admin ready: ${superAdmin.email}; removed ${superAdmin.removedOtherAccounts} other account(s).`);
  }
} catch (error) {
  console.error(`Super Admin seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (mongoose.connection.readyState !== 0) await disconnectDB();
}
