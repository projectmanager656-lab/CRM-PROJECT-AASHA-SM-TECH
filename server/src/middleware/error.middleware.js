// Global error handling middleware
import { API_RESPONSE_MESSAGES, ERROR_TYPES, HTTP_STATUS_CODES } from '../config/constants.js';
import { config } from '../config/environment.js';
import { ApiError } from '../utils/apiError.js';
import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  let error = err;

  if (err?.name === 'ValidationError' || err?.name === 'CastError' || err?.code === 11000 || err?.name === 'MulterError') {
    const message = err.code === 11000
      ? 'A record with these details already exists'
      : err.name === 'MulterError'
        ? 'Invalid file upload'
        : Object.values(err.errors || {}).map((item) => item.message).join(', ') || 'Invalid request data';
    error = new ApiError(400, message, ERROR_TYPES.VALIDATION_ERROR);
  }

  // Convert non-ApiError errors to ApiError
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
    const message = error.message || API_RESPONSE_MESSAGES.SERVER_ERROR;
    
    error = new ApiError(statusCode, message, ERROR_TYPES.INTERNAL_SERVER_ERROR);
  }

  // Log error details
  const errorLog = {
    errorType: error.errorType,
    message: error.message,
    statusCode: error.statusCode,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  };

  if (config.nodeEnv === 'development') {
    errorLog.stack = error.stack;
  }

  logger.error('Request error', errorLog);

  // Send error response
  res.status(error.statusCode).json(error.toJSON());
};

export default errorHandler;
