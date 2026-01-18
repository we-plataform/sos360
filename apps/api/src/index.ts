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

// Log startup information immediately
console.log('=== SOS360 API Starting ===');
console.log(`Node version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV || 'not set'}`);
console.log(`PORT env: ${process.env.PORT || 'not set'}`);
console.log(`DATABASE_URL set: ${!!process.env.DATABASE_URL}`);
console.log(`JWT_SECRET set: ${!!process.env.JWT_SECRET}`);

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
console.log('Initializing Express...');
const app = express();

// Trust proxy - CRITICAL for Render/Vercel/Cloudflare
// This allows express-rate-limit to correctly identify client IPs
app.set('trust proxy', true);

const httpServer = createServer(app);

// Socket.io
console.log('Initializing Socket.io...');
let io: Server;
try {
  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS,
      credentials: true,
    },
  });
  console.log('Socket.io initialized successfully');
} catch (error) {
  console.error('FATAL: Failed to initialize Socket.io:', error);
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
    name: 'SOS360 API',
    version: '0.0.1',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
console.log('Setting up routes...');
try {
  setupRoutes(app);
  console.log('Routes setup completed');
} catch (error) {
  console.error('FATAL: Failed to setup routes:', error);
  logger.error({ err: error }, 'Failed to setup routes');
  process.exit(1);
}

// Socket.io setup
console.log('Setting up Socket.io handlers...');
try {
  setupSocket(io);
  console.log('Socket.io handlers setup completed');
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

console.log(`Starting server on ${HOST}:${PORT}...`);

httpServer.listen(PORT, HOST, () => {
  console.log(`=== Server running on ${HOST}:${PORT} ===`);
  logger.info(`Server running on ${HOST}:${PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
  logger.info(`CORS origins: ${env.CORS_ORIGINS.join(', ')}`);
  console.log('Server is ready to accept connections');
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
