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
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      department,
      designation,
      role,
      isActive = true,
    } = userData;

    if (!firstName || !lastName || !email || !password) {
      throw createValidationError('First name, last name, email, and password are required');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      throw createValidationError('User with this email already exists');
    }

    const selectedRole = allowedRoles.includes(role) ? role : 'employee';
    const selectedDepartment = String(department || '').trim();
    if (selectedDepartment && !await Department.exists({ name: selectedDepartment, status: 'Active' })) {
      throw createValidationError('Please select an active department');
    }

    const user = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      password,
      phone: phone?.trim() || '',
      department: selectedDepartment,
      designation: designation?.trim() || '',
      role: selectedRole,
      isActive,
    });

    return user.toJSON();
  }

  static async updateUser(id, updateData, currentUserId = null) {
    const user = await User.findById(id);

    if (!user) {
      throw createNotFoundError('User not found');
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
      const selectedDepartment = department.trim();
      if (selectedDepartment && !await Department.exists({ name: selectedDepartment, status: 'Active' })) {
        throw createValidationError('Please select an active department');
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
