import AuthService from '../services/AuthService.js';
import { RbacService } from '../services/RbacService.js';
import { createValidationError } from '../utils/apiError.js';
import { createdResponse, successResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateEmployeeRegister, validateLogin, validateRegister } from '../validators/auth.validation.js';

export class AuthController {
  // Register
  static register = asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName, department } = req.body;

    // Validate input
    const { error } = validateEmployeeRegister.validate({
      email,
      password,
      firstName,
      lastName,
      department,
    });

    if (error) {
      throw createValidationError(
        'Validation failed',
        error.details.map(detail => detail.message)
      );
    }

    // Register user
    const user = await AuthService.register(
      email,
      password,
      firstName,
      lastName,
      department,
      'employee'
    );

    // Generate token for immediate authentication
    const token = AuthService.generateToken(user._id, user.email, user.role);

    res.status(201).json(
      createdResponse({ user, token }, 'User registered and authenticated successfully')
    );
  });

  // Login
  static login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Validate input
    const { error } = validateLogin.validate({ email, password });

    if (error) {
      throw createValidationError(
        'Validation failed',
        error.details.map(detail => detail.message)
      );
    }

    // Login user
    const { user, token } = await AuthService.login(email, password, 'employee');

    res.json(
      successResponse(
        { user, token },
        'Login successful'
      )
    );
  });

  // Get current user
  static getMe = asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    // Get user data
    const user = await AuthService.getUserById(userId, req.user.role);

    res.json(
      successResponse(user, 'User data retrieved successfully')
    );
  });

  static getMyPermissions = asyncHandler(async (req, res) => {
    const effective = await RbacService.effectivePermissions(req.user);
    res.json(successResponse({ role: effective.role, permissions: effective.permissions, bypass: effective.bypass }, 'Effective permissions retrieved successfully'));
  });

  static registerForRole(role) {
    return asyncHandler(async (req, res) => {
      const { email, password, firstName, lastName } = req.body;
      const { error } = validateRegister.validate({ email, password, firstName, lastName });
      if (error) throw createValidationError('Validation failed', error.details.map(detail => detail.message));
      const user = await AuthService.register(email, password, firstName, lastName, '', role);
      const token = AuthService.generateToken(user._id, user.email, user.role);
      res.status(201).json(createdResponse({ user, token }, 'Registration successful'));
    });
  }

  static loginForRole(role) {
    return asyncHandler(async (req, res) => {
      const { email, password } = req.body;
      const { error } = validateLogin.validate({ email, password });
      if (error) throw createValidationError('Validation failed', error.details.map(detail => detail.message));
      res.json(successResponse(await AuthService.login(email, password, role), 'Login successful'));
    });
  }

}

AuthController.adminRegister = AuthController.registerForRole('admin');
AuthController.adminLogin = AuthController.loginForRole('admin');
AuthController.superAdminLogin = AuthController.loginForRole('super_admin');

export default AuthController;
