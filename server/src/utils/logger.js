// Logger utility for consistent logging across the application
import { LOG_LEVELS } from '../config/constants.js';

const getTimestamp = () => {
  return new Date().toISOString();
};

const formatLog = (level, message, data = null) => {
  const log = {
    timestamp: getTimestamp(),
    level,
    message,
  };
  
  if (data) {
    log.data = data;
  }
  
  return log;
};

const logToConsole = (level, message, data = null) => {
  const log = formatLog(level, message, data);
  const logString = JSON.stringify(log);
  
  switch (level) {
    case LOG_LEVELS.DEBUG:
      console.debug(logString);
      break;
    case LOG_LEVELS.INFO:
      console.info(logString);
      break;
    case LOG_LEVELS.WARN:
      console.warn(logString);
      break;
    case LOG_LEVELS.ERROR:
      console.error(logString);
      break;
    default:
      console.log(logString);
  }
};

export const logger = {
  debug: (message, data) => logToConsole(LOG_LEVELS.DEBUG, message, data),
  info: (message, data) => logToConsole(LOG_LEVELS.INFO, message, data),
  warn: (message, data) => logToConsole(LOG_LEVELS.WARN, message, data),
  error: (message, data) => logToConsole(LOG_LEVELS.ERROR, message, data),
};

export default logger;
