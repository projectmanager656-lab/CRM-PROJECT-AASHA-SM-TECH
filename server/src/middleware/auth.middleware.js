import AuthService from '../services/AuthService.js';
import { createUnauthorizedError, createForbiddenError } from '../utils/apiError.js';
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
    if (decoded.role === 'employee') {
      try {
        const u = await User.findById(decoded.userId).select('department jobDetails.department isActive accessStatus restrictedModules');
        if (u) {
          if (u.isActive === false || u.accessStatus === 'Revoked') {
            throw createUnauthorizedError('Account access has been revoked');
          }
          req.user.department = effectiveDepartment(u);
          req.user.accessStatus = u.accessStatus || 'Active';
          req.user.restrictedModules = u.restrictedModules || [];
        }
      } catch (e) {
        if (e.statusCode === 401) throw e;
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

    // 1. If access is completely revoked, immediately block
    if (req.user.accessStatus === 'Revoked') {
      throw createForbiddenError('All system access has been revoked for this account');
    }

    // 2. If this specific module or resource is restricted, block immediately (even for HR employees)
    if (
      (req.user.accessStatus === 'Restricted' || (req.user.restrictedModules && req.user.restrictedModules.length > 0)) &&
      (req.user.restrictedModules || []).some((m) => {
        const norm = String(m).toLowerCase();
        return norm === String(moduleKey).toLowerCase() || norm === String(resourceKey).toLowerCase();
      })
    ) {
      throw createForbiddenError(`Access to ${moduleKey}${resourceKey ? '.' + resourceKey : ''} has been restricted`);
    }

    // 3. Departmental bypass for non-restricted modules
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
