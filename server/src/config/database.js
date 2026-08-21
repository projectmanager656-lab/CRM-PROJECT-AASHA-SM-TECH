// MongoDB Database Connection Configuration
import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import { config } from './environment.js';

const connectDB = async () => {
  try {
    logger.info('Attempting to connect to MongoDB...');
    
    const connection = await mongoose.connect(config.mongodbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    logger.info(
      `MongoDB connected successfully: ${connection.connection.host}:${connection.connection.port}/${connection.connection.name}`
    );
    
    return connection;
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);
    
    // Log additional details in development
    if (config.nodeEnv === 'development') {
      logger.error('Full error details:', error);
    }
    
    // Rethrow to allow proper error handling in server.js
    throw error;
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected successfully');
  } catch (error) {
    logger.error(`MongoDB disconnection failed: ${error.message}`);
    throw error;
  }
};

export { connectDB, disconnectDB };
