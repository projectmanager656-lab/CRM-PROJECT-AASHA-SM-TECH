import AuthService from '../services/AuthService.js';
import { createUnauthorizedError } from '../utils/apiError.js';
import { createForbiddenError } from '../utils/apiError.js';
import { logger } from '../utils/logger.js';
import { RbacService } from '../services/RbacService.js';

import User from '../models/User.js';

const normalizeDepartment = (value) => String(value || '').trim().toUpperCase();
const effectiveDepartment = (user = {}) => normalizeDepartment(user.department || user.jobDetails?.department);

// Middleware to protect routes
export const authenticateToken = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw createUnauthorizedError('No authentication token provided');
    }

    // Verify token
    const decoded = AuthService.verifyToken(token);

    // Attach user data to request
    req.user = decoded;
    if (decoded.role === 'employee' && !effectiveDepartment(decoded)) {
      try {
        const u = await User.findById(decoded.userId).select('department jobDetails.department');
        if (u) req.user.department = effectiveDepartment(u);
      } catch (e) {
        // Continue if DB lookup fails
      }
    }
    req.user.department = effectiveDepartment(req.user);
    next();
  } catch (error) {
    logger.warn('Authentication failed', { error: error.message });
    next(error);
  }
};

// Middleware to check user role
export const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(createUnauthorizedError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        createUnauthorizedError(
          `Access denied. Required role(s): ${roles.join(', ')}`
        )
      );
    }

    next();
  };
};

export const authorizeHrOrAdmin = (req, res, next) => {
  if (!req.user) {
    return next(createUnauthorizedError('Authentication required'));
  }
  if (['admin', 'super_admin'].includes(req.user.role) || effectiveDepartment(req.user) === 'HR') {
    return next();
  }
  return next(createForbiddenError('Access denied. HR or Administrator access required.'));
};

export const requirePermission = (moduleKey, resourceKey, action) => async (req, _res, next) => {
  try {
    if (!req.user) throw createUnauthorizedError('Authentication required');
    if (effectiveDepartment(req.user) === 'HR' && ['administration', 'hrms', 'core', 'finance', 'documents', 'communications', 'projects', 'crm'].includes(moduleKey)) {
      return next();
    }
    const effective = await RbacService.effectivePermissions(req.user);
    req.permissions = effective;
    if (effective.bypass || effective.permissions?.[moduleKey]?.[resourceKey]?.[action]) return next();
    throw createForbiddenError(`Permission denied: ${moduleKey}.${resourceKey}.${action}`);
  } catch (error) { next(error); }
};

export default {
  authenticateToken,
  authorizeRole,
  authorizeHrOrAdmin,
  requirePermission,
};
