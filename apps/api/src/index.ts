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
import { batchScoringScheduler } from './services/batch-scoring.js';

// Log startup information immediately in development only
if (env.NODE_ENV === 'development') console.log('=== Lia360 API Starting ===');
if (env.NODE_ENV === 'development') console.log(`Node version: ${process.version}`);
if (env.NODE_ENV === 'development') console.log(`Environment: ${process.env.NODE_ENV || 'not set'}`);
if (env.NODE_ENV === 'development') console.log(`PORT env: ${process.env.PORT || 'not set'}`);
if (env.NODE_ENV === 'development') console.log(`DATABASE_URL set: ${!!process.env.DATABASE_URL}`);
if (env.NODE_ENV === 'development') console.log(`JWT_SECRET set: ${!!process.env.JWT_SECRET}`);
if (env.NODE_ENV === 'development') console.log(`CORS_ORIGINS: ${process.env.CORS_ORIGINS || 'NOT SET (will use default)'}`);

// Handle uncaught errors - log to both console and logger
process.on('uncaughtException', (error) => {
  console.error('FATAL: Uncaught Exception:', error);
  logger.error({ err: error }, 'Uncaught Exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('FATAL: Unhandled Rejection:', reason);
  logger.error({ reason, promise }, 'Unhandled Rejection');
  process.exit(1);
});

// Initialize Express app and HTTP server
if (env.NODE_ENV === 'development') console.log('Initializing Express...');
const app = express();

// Trust proxy - CRITICAL for Render/Vercel/Cloudflare
// This allows express-rate-limit to correctly identify client IPs
app.set('trust proxy', true);

const httpServer = createServer(app);

// Socket.io
if (env.NODE_ENV === 'development') console.log('Initializing Socket.io...');
let io: Server;
try {
  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS,
      credentials: true,
    },
  });
  if (env.NODE_ENV === 'development') console.log('Socket.io initialized successfully');
} catch (error) {
  console.error('FATAL: Failed to initialize Socket.io:', error);
  logger.error({ err: error }, 'Failed to initialize Socket.io');
  process.exit(1);
}

// CORS configuration - MUST be before Helmet to handle preflight requests
// This prevents Helmet from interfering with OPTIONS requests
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

    // Check if origin matches any configured origin (exact match or wildcard)
    const isAllowed = env.CORS_ORIGINS.some((allowedOrigin) => {
      // Exact match
      if (allowedOrigin === origin) {
        return true;
      }

      // Wildcard match (e.g., https://*.vercel.app)
      if (allowedOrigin.includes('*')) {
        const pattern = allowedOrigin.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(origin);
      }

      return false;
    });

    if (isAllowed || env.CORS_ORIGINS.includes('*')) {
      return callback(null, true);
    }

    // In development, allow all localhost origins
    if (env.NODE_ENV === 'development') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }

    // Log rejected origins in production for debugging
    if (env.NODE_ENV === 'production') {
      logger.warn({ origin, allowedOrigins: env.CORS_ORIGINS }, 'CORS: Origin rejected');
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
};

// Apply CORS first - critical for preflight (OPTIONS) requests
app.use(cors(corsOptions));

// Middleware - Helmet with relaxed settings for Chrome extensions
// Applied AFTER CORS to prevent interference with preflight requests
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false, // Disable CSP for API (not needed for REST API)
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(
  pinoHttp({
    logger,
    redact: ['req.headers.authorization', 'req.body.password', 'req.body.refreshToken'],
  })
);

// Basic health check - keep for backwards compatibility with Render health checks
// Note: More detailed health checks are available at /health/detailed
app.get('/health', async (_, res) => {
  try {
    // Simple health check that doesn't depend on database
    // Full database health check is at /health/detailed
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
    });
  }
});

// Root endpoint
app.get('/', (_, res) => {
  res.json({ 
    name: 'Lia360 API',
    version: '0.0.1',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
if (env.NODE_ENV === 'development') console.log('Setting up routes...');
try {
  setupRoutes(app);
  if (env.NODE_ENV === 'development') console.log('Routes setup completed');
} catch (error) {
  console.error('FATAL: Failed to setup routes:', error);
  logger.error({ err: error }, 'Failed to setup routes');
  process.exit(1);
}

// Socket.io setup
if (env.NODE_ENV === 'development') console.log('Setting up Socket.io handlers...');
try {
  setupSocket(io);
  if (env.NODE_ENV === 'development') console.log('Socket.io handlers setup completed');
} catch (error) {
  console.error('FATAL: Failed to setup Socket.io:', error);
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
const HOST = '0.0.0.0'; // Always use 0.0.0.0 for Railway

if (env.NODE_ENV === 'development') console.log(`Starting server on ${HOST}:${PORT}...`);

httpServer.listen(PORT, HOST, () => {
  if (env.NODE_ENV === 'development') console.log(`=== Server running on ${HOST}:${PORT} ===`);
  if (env.NODE_ENV === 'development') console.log('Server is ready to accept connections');
  logger.info(`Server running on ${HOST}:${PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
  logger.info(`CORS origins: ${env.CORS_ORIGINS.join(', ')}`);

  // Start batch scoring scheduler
  try {
    batchScoringScheduler.start(24 * 60 * 60 * 1000); // Run daily
    logger.info('Batch scoring scheduler started');
  } catch (error) {
    logger.error({ err: error }, 'Failed to start batch scoring scheduler');
  }
});

httpServer.on('error', (error: NodeJS.ErrnoException) => {
  console.error('FATAL: Server error:', error);
  logger.error({ err: error }, 'Server error');
  
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    logger.error(`Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('Failed to start server');
    logger.error('Failed to start server');
    process.exit(1);
  }
});

export { app, io };
