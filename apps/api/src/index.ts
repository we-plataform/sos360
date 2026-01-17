// IMPORTANT: Load .env FIRST before any other imports
import './load-env.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { pinoHttp } from 'pino-http';

import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { setupRoutes } from './routes/index.js';
import { setupSocket } from './socket/index.js';

// Handle uncaught errors - must be set up after logger is available
process.on('uncaughtException', (error) => {
  logger.error({ err: error }, 'Uncaught Exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection');
  process.exit(1);
});

// Initialize Express app and HTTP server
const app = express();
const httpServer = createServer(app);

// Socket.io
let io: Server;
try {
  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS,
      credentials: true,
    },
  });
} catch (error) {
  logger.error({ err: error }, 'Failed to initialize Socket.io');
  process.exit(1);
}

// Middleware - Helmet with relaxed settings for Chrome extensions
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false, // Disable CSP for API (not needed for REST API)
}));

// CORS configuration - allow Chrome extensions and configured origins
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps, Postman, curl, or Chrome extensions in some cases)
    if (!origin) {
      return callback(null, true);
    }
    
    // Allow Chrome extensions (chrome-extension://)
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    
    // Allow configured origins
    if (env.CORS_ORIGINS.includes(origin) || env.CORS_ORIGINS.includes('*')) {
      return callback(null, true);
    }
    
    // In development, allow all localhost origins
    if (env.NODE_ENV === 'development') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(
  pinoHttp({
    logger,
    redact: ['req.headers.authorization', 'req.body.password', 'req.body.refreshToken'],
  })
);

// Health check - must be before routes to avoid rate limiting
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
try {
  setupRoutes(app);
} catch (error) {
  logger.error({ err: error }, 'Failed to setup routes');
  process.exit(1);
}

// Socket.io setup
try {
  setupSocket(io);
} catch (error) {
  logger.error({ err: error }, 'Failed to setup Socket.io');
  process.exit(1);
}

// Make io available to routes
app.set('io', io);

// Error handler (must be last)
app.use(errorHandler);

// Start server - listen on 0.0.0.0 to accept external connections
// Railway injects PORT automatically, ensure we use it
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : env.PORT;
const HOST = process.env.HOST || '0.0.0.0';

httpServer.listen(PORT, HOST, () => {
  logger.info(`Server running on ${HOST}:${PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
  logger.info(`CORS origins: ${env.CORS_ORIGINS.join(', ')}`);
  logger.info('Server is ready to accept connections');
});

httpServer.on('error', (error: NodeJS.ErrnoException) => {
  logger.error({ err: error }, 'Server error');
  
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    logger.error('Failed to start server');
    process.exit(1);
  }
});

export { app, io };
