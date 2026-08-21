// Request logging middleware
import { logger } from '../utils/logger.js';

export const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log incoming request
  const requestLog = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
  };
  
  logger.info('Incoming request', requestLog);
  
  // Override res.json to log response
  const originalJson = res.json;
  res.json = function (data) {
    const duration = Date.now() - startTime;
    
    const responseLog = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    };
    
    // Log response status
    if (res.statusCode >= 400) {
      logger.warn('Request completed with error', responseLog);
    } else {
      logger.info('Request completed', responseLog);
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

export default requestLogger;
