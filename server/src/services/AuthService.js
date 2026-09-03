import jwt from 'jsonwebtoken';
import { config } from '../config/environment.js';
import Admin from '../models/Admin.js';
import SuperAdmin from '../models/SuperAdmin.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import { createUnauthorizedError, createValidationError } from '../utils/apiError.js';

const accountModels = { employee: User, admin: Admin, super_admin: SuperAdmin };

export class AuthService {
  // Register new user
  static getModel(role) {
    const Model = accountModels[role];
    if (!Model) throw createUnauthorizedError('Invalid account role');
    return Model;
  }

  static async register(email, password, firstName, lastName, department = '', role = 'employee', phone = '', designation = '') {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!['employee', 'admin'].includes(role)) {
      throw createValidationError('Registration is not allowed for this role');
    }
    const Model = this.getModel(role);

    if (role === 'employee') {
      const OFFICIAL_DEPARTMENTS = ['HR', 'Sales', 'Business Development', 'Finance', 'Tech', 'Non-Tech'];
      const selectedDepartment = String(department || '').trim();
      if (!selectedDepartment) throw createValidationError('Department is required');
      if (!OFFICIAL_DEPARTMENTS.includes(selectedDepartment)) throw createValidationError('Please select a valid official department');
    }

    const existingUser = await Model.findOne({ email: normalizedEmail });

    if (existingUser) {
      // Prevent duplicate registrations using same email
      throw createValidationError('Email already registered');
    }

    const user = new Model({
      email: normalizedEmail,
      password,
      firstName,
      lastName,
      department: String(department || '').trim(),
      role,
      phone: String(phone || '').trim(),
      designation: String(designation || '').trim(),
    });

    await user.save();

    return user.toJSON();
  }

  // Login user
  static async login(email, password, role) {
    // Validate email and password provided
    if (!email || !password) {
      throw createValidationError('Email and password are required');
    }

    // Normalize email before lookup to match registration behavior
    const normalizedEmail = String(email || '').trim().toLowerCase();

    // Find user and include password (normally excluded)
    const Model = this.getModel(role);
    const user = await Model.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      throw createUnauthorizedError('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw createUnauthorizedError('Account is inactive');
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw createUnauthorizedError('Invalid credentials');
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = this.generateToken(user._id, user.email, user.role, user.department || '');

    // Return user and token (without password)
    return {
      user: user.toJSON(),
      token,
    };
  }

  // Generate JWT token
  static generateToken(userId, email, role, department = '') {
    const payload = {
      userId,
      email,
      role,
      department,
    };

    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpire || '7d',
    });
  }

  // Verify JWT token
  static verifyToken(token) {
    try {
      return jwt.verify(token, config.jwtSecret);
    } catch (error) {
      throw createUnauthorizedError('Invalid or expired token');
    }
  }

  // Get user by ID
  static async getUserById(userId, role) {
    const user = await this.getModel(role).findById(userId);
    if (!user) {
      throw createUnauthorizedError('User not found');
    }
    return user.toJSON();
  }
}

export default AuthService;
