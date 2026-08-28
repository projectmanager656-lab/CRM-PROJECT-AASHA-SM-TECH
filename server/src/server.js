import dns from 'dns';

dns.setServers(['8.8.8.8', '1.1.1.1']);

// Server Entry Point
import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/database.js';
import { config } from './config/environment.js';
import { logger } from './utils/logger.js';

const startServer = async () => {
  try {
    logger.info(`Starting server in ${config.nodeEnv} mode`);
    
    // Connect to MongoDB
    try {
      await connectDB();
    } catch (dbError) {
      logger.warn(
        'MongoDB connection failed. Server will start but database features will be unavailable.',
        { error: dbError.message }
      );
      // Continue server startup even if DB connection fails
      logger.info('Continuing server startup without database connection');
    }
    
    // Start HTTP server
    const server = app.listen(config.port, () => {
      logger.info(`Server is running on http://localhost:${config.port}`);
      logger.info(`API base URL: http://localhost:${config.port}${config.apiPrefix}`);
      logger.info(`Health check: http://localhost:${config.port}${config.apiPrefix}/health`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });
    
    process.on('SIGINT', () => {
      logger.info('SIGINT signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });
    
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

startServer();
