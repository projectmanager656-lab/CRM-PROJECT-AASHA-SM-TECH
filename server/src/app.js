// Express Application Setup
import cors from 'cors';
import express from 'express';
import { config } from './config/environment.js';
import errorHandler from './middleware/error.middleware.js';
import notFoundHandler from './middleware/notFound.middleware.js';
import requestLogger from './middleware/requestLogger.middleware.js';
import apiRoutes from './routes/index.js';
import { logger } from './utils/logger.js';

const app = express();

const allowedOrigins = new Set([config.clientUrl]);
if (config.nodeEnv === 'development') {
  allowedOrigins.add('http://localhost:5173');
  allowedOrigins.add('http://127.0.0.1:5173');
  allowedOrigins.add('http://localhost:5174');
  allowedOrigins.add('http://127.0.0.1:5174');
}

// Middleware - Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Middleware - CORS Configuration
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Middleware - Request Logging
app.use(requestLogger);

// Routes
app.use(config.apiPrefix, apiRoutes);

// Middleware - 404 Handler (must be after all routes)
app.use(notFoundHandler);

// Middleware - Global Error Handler (must be last)
app.use(errorHandler);

logger.info('Express application configured successfully');

export default app;
