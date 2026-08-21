import AuthService from '../services/AuthService.js';
import { createUnauthorizedError } from '../utils/apiError.js';
import { createForbiddenError } from '../utils/apiError.js';
import { logger } from '../utils/logger.js';
import { RbacService } from '../services/RbacService.js';

// Middleware to protect routes
export const authenticateToken = (req, res, next) => {
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

export const requirePermission = (moduleKey, resourceKey, action) => async (req, _res, next) => {
  try {
    if (!req.user) throw createUnauthorizedError('Authentication required');
    const effective = await RbacService.effectivePermissions(req.user);
    req.permissions = effective;
    if (effective.bypass || effective.permissions?.[moduleKey]?.[resourceKey]?.[action]) return next();
    throw createForbiddenError(`Permission denied: ${moduleKey}.${resourceKey}.${action}`);
  } catch (error) { next(error); }
};

export default {
  authenticateToken,
  authorizeRole,
  requirePermission,
};
