// Environment configuration
export const getEnvVar = (key, defaultValue = undefined) => {
  const value = process.env[key];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value || defaultValue;
};

export const config = {
  // Server
  port: parseInt(getEnvVar('PORT', '5001')),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  
  // Database
  mongodbUri: getEnvVar('MONGODB_URI', 'mongodb://localhost:27017/it-management-system'),
  
  // CORS
  clientUrl: getEnvVar('CLIENT_URL', 'http://localhost:5173'),
  
  // JWT (prepared for later phases)
  jwtSecret: getEnvVar('JWT_SECRET', 'your-jwt-secret-key-change-in-production'),
  jwtExpire: getEnvVar('JWT_EXPIRE', '7d'),
  
  // API
  apiPrefix: '/api/v1',

  // Server-only fixed Super Admin bootstrap credentials
  superAdminEmail: getEnvVar('SUPER_ADMIN_EMAIL', ''),
  superAdminPassword: getEnvVar('SUPER_ADMIN_PASSWORD', ''),
};

export default config;
