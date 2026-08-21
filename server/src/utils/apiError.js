// API Error class for standardized error handling
import { ERROR_TYPES, HTTP_STATUS_CODES } from '../config/constants.js';

export class ApiError extends Error {
  constructor(
    statusCode = HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
    message = 'An error occurred',
    errorType = ERROR_TYPES.INTERNAL_SERVER_ERROR,
    errors = []
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.errors = errors;
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace in production
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      statusCode: this.statusCode,
      errorType: this.errorType,
      message: this.message,
      errors: this.errors,
      timestamp: this.timestamp,
    };
  }
}

// Factory functions for common errors
export const createValidationError = (message = 'Validation failed', errors = []) => {
  return new ApiError(
    HTTP_STATUS_CODES.BAD_REQUEST,
    message,
    ERROR_TYPES.VALIDATION_ERROR,
    errors
  );
};

export const createNotFoundError = (message = 'Resource not found') => {
  return new ApiError(
    HTTP_STATUS_CODES.NOT_FOUND,
    message,
    ERROR_TYPES.NOT_FOUND_ERROR
  );
};

export const createUnauthorizedError = (message = 'Authentication required') => {
  return new ApiError(
    HTTP_STATUS_CODES.UNAUTHORIZED,
    message,
    ERROR_TYPES.AUTHENTICATION_ERROR
  );
};

export const createForbiddenError = (message = 'Access forbidden') => {
  return new ApiError(
    HTTP_STATUS_CODES.FORBIDDEN,
    message,
    ERROR_TYPES.AUTHORIZATION_ERROR
  );
};

export const createDatabaseError = (message = 'Database operation failed') => {
  return new ApiError(
    HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
    message,
    ERROR_TYPES.DATABASE_ERROR
  );
};

export default ApiError;
