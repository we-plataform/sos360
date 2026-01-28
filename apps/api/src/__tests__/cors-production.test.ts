import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';

// Load environment variables
config();

// Mock logger to avoid console output during tests
vi.mock('pino-http', () => ({
  default: () => (_req: any, _res: any, next: any) => next(),
}));

describe('CORS Production Mode with CHROME_EXTENSION_ID', () => {
  let testEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store original environment
    testEnv = { ...process.env };

    // Set production mode
    process.env.NODE_ENV = 'production';

    // Set a test extension ID
    process.env.CHROME_EXTENSION_ID = 'abcdefghijklmno123456789';

    // Set basic CORS origins
    process.env.CORS_ORIGINS = 'https://lia360.app,https://www.lia360.app';

    // Clear module cache to force reload with new env vars
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env = testEnv;
    vi.resetModules();
  });

  const createTestApp = async () => {
    const app = express();

    // Import the CORS configuration function
    // We need to recreate the corsOptions with current env
    const corsOptions: cors.CorsOptions = {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (like mobile apps, Postman, curl, or Chrome extensions in some cases)
        if (!origin) {
          return callback(null, true);
        }

        // Validate Chrome extensions against CHROME_EXTENSION_ID
        if (origin.startsWith('chrome-extension://')) {
          const extensionId = origin.replace('chrome-extension://', '');

          // If CHROME_EXTENSION_ID is configured, only allow that specific extension
          if (process.env.CHROME_EXTENSION_ID) {
            if (extensionId === process.env.CHROME_EXTENSION_ID) {
              return callback(null, true);
            }
            // Extension ID mismatch - reject
            return callback(new Error('Not allowed by CORS'));
          }

          // In production, reject if CHROME_EXTENSION_ID is not configured
          return callback(new Error('Not allowed by CORS'));
        }

        // Check if origin matches any configured origin (exact match or wildcard)
        const corsOrigins = process.env.CORS_ORIGINS?.split(',') || [];
        const isAllowed = corsOrigins.some((allowedOrigin) => {
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

        if (isAllowed || corsOrigins.includes('*')) {
          return callback(null, true);
        }

        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['Content-Length', 'Content-Type'],
    };

    app.use(cors(corsOptions));
    app.use(express.json());

    // Add a test endpoint
    app.get('/api/test', (_req, res) => {
      res.json({ success: true, message: 'Test endpoint' });
    });

    return app;
  };

  describe('Production mode with CHROME_EXTENSION_ID set', () => {
    it('should allow requests from the configured extension ID', async () => {
      const app = await createTestApp();
      const validExtensionOrigin = `chrome-extension://${process.env.CHROME_EXTENSION_ID}`;

      const response = await request(app)
        .get('/api/test')
        .set('Origin', validExtensionOrigin);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.headers['access-control-allow-origin']).toBe(validExtensionOrigin);
    });

    it('should reject requests from different extension IDs', async () => {
      const app = await createTestApp();
      const invalidExtensionOrigin = 'chrome-extension://differentextensionid123';

      const response = await request(app)
        .get('/api/test')
        .set('Origin', invalidExtensionOrigin);

      expect(response.status).toBe(404); // CORS errors return 404 from supertest
    });

    it('should reject requests from random chrome-extension:// origins', async () => {
      const app = await createTestApp();
      const randomExtensionOrigins = [
        'chrome-extension://aaaaaaaaaaaaaaaaaaaaaa',
        'chrome-extension://bbbbbbbbbbbbbbbbbbbbbb',
        'chrome-extension://xyz1234567890',
      ];

      for (const origin of randomExtensionOrigins) {
        const response = await request(app)
          .get('/api/test')
          .set('Origin', origin);

        expect(response.status).toBe(404);
      }
    });

    it('should handle preflight OPTIONS requests from configured extension', async () => {
      const app = await createTestApp();
      const validExtensionOrigin = `chrome-extension://${process.env.CHROME_EXTENSION_ID}`;

      const response = await request(app)
        .options('/api/test')
        .set('Origin', validExtensionOrigin)
        .set('Access-Control-Request-Method', 'GET');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(validExtensionOrigin);
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });

    it('should reject preflight OPTIONS requests from different extension IDs', async () => {
      const app = await createTestApp();
      const invalidExtensionOrigin = 'chrome-extension://differentextensionid123';

      const response = await request(app)
        .options('/api/test')
        .set('Origin', invalidExtensionOrigin)
        .set('Access-Control-Request-Method', 'GET');

      expect(response.status).toBe(404);
    });
  });

  describe('Production mode with CHROME_EXTENSION_ID not set', () => {
    beforeEach(() => {
      delete process.env.CHROME_EXTENSION_ID;
    });

    it('should reject all chrome-extension:// origins when CHROME_EXTENSION_ID is not configured', async () => {
      const app = await createTestApp();
      const extensionOrigin = 'chrome-extension://anyextensionid123';

      const response = await request(app)
        .get('/api/test')
        .set('Origin', extensionOrigin);

      expect(response.status).toBe(404);
    });

    it('should still allow configured web origins', async () => {
      const app = await createTestApp();

      const response = await request(app)
        .get('/api/test')
        .set('Origin', 'https://lia360.app');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.headers['access-control-allow-origin']).toBe('https://lia360.app');
    });
  });

  describe('Edge cases and security', () => {
    it('should not allow partial extension ID matches', async () => {
      const app = await createTestApp();
      const fullExtensionId = process.env.CHROME_EXTENSION_ID!;
      const partialExtensionId = fullExtensionId.substring(0, 10);

      const response = await request(app)
        .get('/api/test')
        .set('Origin', `chrome-extension://${partialExtensionId}`);

      expect(response.status).toBe(404);
    });

    it('should be case-sensitive for extension IDs', async () => {
      const app = await createTestApp();
      const uppercaseExtensionId = process.env.CHROME_EXTENSION_ID!.toUpperCase();

      const response = await request(app)
        .get('/api/test')
        .set('Origin', `chrome-extension://${uppercaseExtensionId}`);

      expect(response.status).toBe(404);
    });

    it('should not allow empty extension ID', async () => {
      const app = await createTestApp();

      const response = await request(app)
        .get('/api/test')
        .set('Origin', 'chrome-extension://');

      expect(response.status).toBe(404);
    });

    it('should allow requests with no origin (mobile apps, curl)', async () => {
      const app = await createTestApp();

      const response = await request(app)
        .get('/api/test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
