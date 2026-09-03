import User from '../models/User.js';
import Department from '../models/Department.js';
import {
  createForbiddenError,
  createNotFoundError,
  createValidationError,
} from '../utils/apiError.js';

const allowedRoles = ['employee'];

export class UserService {
  static async getAllUsers(filters = {}) {
    const query = {};
    if (filters.department) query.department = String(filters.department).trim();
    const users = await User.find(query).sort({ createdAt: -1 });
    return users.map((user) => user.toJSON());
  }

  static async getUserById(id) {
    const user = await User.findById(id);

    if (!user) {
      throw createNotFoundError('User not found');
    }

    return user.toJSON();
  }

  static async createUser(userData) {
    const personalInfo = userData.personalInfo || {};
    const jobDetails = userData.jobDetails || {};
    const bankDetails = userData.bankDetails || {};

    let fullName = (personalInfo.fullName || userData.fullName || '').trim();
    let firstName = userData.firstName?.trim() || '';
    let lastName = userData.lastName?.trim() || '';

    if (fullName && (!firstName || !lastName)) {
      const parts = fullName.split(/\s+/);
      firstName = parts[0] || 'Employee';
      lastName = parts.slice(1).join(' ') || ' ';
    } else if (firstName && !fullName) {
      fullName = [firstName, lastName].filter(Boolean).join(' ');
    }

    const email = (personalInfo.email || userData.email || '').trim().toLowerCase();
    const phone = (personalInfo.phoneNumber || userData.phone || '').trim();
    const department = (jobDetails.department || userData.department || '').trim();
    const designation = (jobDetails.designation || userData.designation || '').trim();
    const role = userData.role || 'employee';
    const isActive = userData.isActive !== undefined ? userData.isActive : true;

    // Auto-generate password if not provided in form
    const password = userData.password || `Pass@${Math.floor(1000 + Math.random() * 9000)}`;

    if (!firstName || !email) {
      throw createValidationError('Full name and email address are required');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw createValidationError('User with this email already exists');
    }

    const selectedRole = allowedRoles.includes(role) ? role : 'employee';
    const OFFICIAL_DEPARTMENTS = ['HR', 'Finance', 'Business Development', 'Digital Marketing', 'Video Editor', 'Tech'];
    const selectedDepartment = String(department || '').trim();
    if (selectedDepartment && !OFFICIAL_DEPARTMENTS.includes(selectedDepartment)) {
      throw createValidationError('Please select a valid official department');
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone,
      department: selectedDepartment,
      designation,
      location: personalInfo.address || userData.location || '',
      role: selectedRole,
      isActive,
      personalInfo: {
        profilePhoto: personalInfo.profilePhoto || '',
        fullName: fullName || `${firstName} ${lastName}`.trim(),
        email,
        phoneNumber: phone,
        dateOfBirth: personalInfo.dateOfBirth || '',
        gender: personalInfo.gender || '',
        address: personalInfo.address || '',
      },
      jobDetails: {
        employeeId: jobDetails.employeeId || `EMP-${Date.now().toString().slice(-5)}`,
        department: selectedDepartment,
        designation,
        joiningDate: jobDetails.joiningDate || new Date().toISOString().slice(0, 10),
        employmentType: jobDetails.employmentType || 'Full Time',
        reportingManager: jobDetails.reportingManager || '',
      },
      bankDetails: {
        accountHolderName: bankDetails.accountHolderName || '',
        bankName: bankDetails.bankName || '',
        accountNumber: bankDetails.accountNumber || '',
        ifscCode: bankDetails.ifscCode ? bankDetails.ifscCode.toUpperCase() : '',
        branchName: bankDetails.branchName || '',
      },
    });

    return user.toJSON();
  }

  static async updateUser(id, updateData, currentUserId = null) {
    const user = await User.findById(id);

    if (!user) {
      throw createNotFoundError('User not found');
    }

    const personalInfo = updateData.personalInfo;
    const jobDetails = updateData.jobDetails;
    const bankDetails = updateData.bankDetails;

    if (personalInfo) {
      if (personalInfo.fullName) {
        const parts = personalInfo.fullName.trim().split(/\s+/);
        user.firstName = parts[0] || user.firstName;
        user.lastName = parts.slice(1).join(' ') || user.lastName;
      }
      if (personalInfo.phoneNumber !== undefined) user.phone = personalInfo.phoneNumber.trim();
      if (personalInfo.address !== undefined) user.location = personalInfo.address.trim();
      user.personalInfo = { ...(user.personalInfo?.toObject ? user.personalInfo.toObject() : user.personalInfo || {}), ...personalInfo };
    }

    if (jobDetails) {
      if (jobDetails.department !== undefined) user.department = jobDetails.department.trim();
      if (jobDetails.designation !== undefined) user.designation = jobDetails.designation.trim();
      user.jobDetails = { ...(user.jobDetails?.toObject ? user.jobDetails.toObject() : user.jobDetails || {}), ...jobDetails };
    }

    if (bankDetails) {
      if (bankDetails.ifscCode) bankDetails.ifscCode = bankDetails.ifscCode.toUpperCase();
      user.bankDetails = { ...(user.bankDetails?.toObject ? user.bankDetails.toObject() : user.bankDetails || {}), ...bankDetails };
    }

    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      department,
      designation,
      role,
      isActive,
    } = updateData;

    if (firstName !== undefined) user.firstName = firstName.trim();
    if (lastName !== undefined) user.lastName = lastName.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (department !== undefined) {
      const OFFICIAL_DEPARTMENTS = ['HR', 'Finance', 'Business Development', 'Digital Marketing', 'Video Editor', 'Tech'];
      const selectedDepartment = department.trim();
      if (selectedDepartment && !OFFICIAL_DEPARTMENTS.includes(selectedDepartment)) {
        throw createValidationError('Please select a valid official department');
      }
      user.department = selectedDepartment;
    }
    if (designation !== undefined) user.designation = designation.trim();

    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== user.email) {
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
          throw createValidationError('User with this email already exists');
        }
      }
      user.email = normalizedEmail;
    }

    if (role !== undefined) {
      if (!allowedRoles.includes(role)) {
        throw createValidationError('Invalid role selected');
      }
      user.role = role;
    }

    if (typeof isActive === 'boolean') {
      if (currentUserId && currentUserId === id && isActive === false) {
        throw createForbiddenError('You cannot deactivate your own account');
      }
      user.isActive = isActive;
    }

    if (password) {
      if (password.length < 6) {
        throw createValidationError('Password must be at least 6 characters');
      }
      user.password = password;
    }

    await user.save();
    return user.toJSON();
  }

  static async deactivateUser(id, currentUserId) {
    const user = await User.findById(id);

    if (!user) {
      throw createNotFoundError('User not found');
    }

    if (currentUserId && currentUserId === id) {
      throw createForbiddenError('You cannot deactivate your own account');
    }

    user.isActive = false;
    await user.save();

    return user.toJSON();
  }
}

export default UserService;
