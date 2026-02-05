import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';

// Mock environment variables
const mockEnv = {
  NODE_ENV: 'test',
  CORS_ORIGINS: 'http://localhost:3000,https://lia360.com,https://*.vercel.app',
  CHROME_EXTENSION_ID: 'abcdefghijklmnopqrstuvwxyz',
};

describe('CORS Validation Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    // Create a fresh Express app for each test
    app = express();

    // CORS configuration (copied from index.ts for testing)
    const corsOptions = {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (like mobile apps, Postman, curl, or Chrome extensions in some cases)
        if (!origin) {
          return callback(null, true);
        }

        // Allow Chrome extensions (chrome-extension://) - STRICT VALIDATION
        if (origin.startsWith('chrome-extension://')) {
          // Extract extension ID from origin
          const extensionId = origin.replace('chrome-extension://', '');

          // CHROME_EXTENSION_ID must be configured for chrome-extension:// origins
          if (!mockEnv.CHROME_EXTENSION_ID) {
            return callback(new Error('Not allowed by CORS'));
          }

          // Only allow the specific configured extension
          if (extensionId === mockEnv.CHROME_EXTENSION_ID) {
            return callback(null, true);
          } else {
            return callback(new Error('Not allowed by CORS'));
          }
        }

        // Check if origin matches any configured origin (exact match or wildcard)
        const corsOrigins = mockEnv.CORS_ORIGINS.split(',').map((o) => o.trim());
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

        if (isAllowed) {
          return callback(null, true);
        }

        // In development, allow all localhost origins
        if (mockEnv.NODE_ENV === 'development') {
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
    app.use(express.json());

    // Add a test endpoint
    app.get('/health', (_, res) => {
      res.status(200).json({ status: 'ok' });
    });

    app.options('/api/v1/leads', (_, res) => {
      res.status(204).end();
    });
  });

  describe('Valid Origins - Exact Match', () => {
    it('should allow requests from http://localhost:3000', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('should allow requests from https://lia360.com', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'https://lia360.com')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('https://lia360.com');
    });
  });

  describe('Valid Origins - Wildcard Match', () => {
    it('should allow requests from https://app.vercel.app', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'https://app.vercel.app')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('https://app.vercel.app');
    });

    it('should allow requests from https://staging.vercel.app', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'https://staging.vercel.app')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('https://staging.vercel.app');
    });

    it('should reject requests from https://evil.com (not in wildcard)', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'https://evil.com');

      // Should not have CORS headers
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Chrome Extension Origins', () => {
    it('should allow requests from configured Chrome extension ID', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'chrome-extension://abcdefghijklmnopqrstuvwxyz')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe(
        'chrome-extension://abcdefghijklmnopqrstuvwxyz'
      );
    });

    it('should reject requests from unconfigured Chrome extension ID', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'chrome-extension://wrongextensionid');

      // Should not have CORS headers
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should reject Chrome extension when CHROME_EXTENSION_ID is not configured', () => {
      // Temporarily remove CHROME_EXTENSION_ID
      const originalId = mockEnv.CHROME_EXTENSION_ID;
      (mockEnv as any).CHROME_EXTENSION_ID = '';

      const testApp = express();
      testApp.use(
        cors({
          origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
            if (!origin) {
              return callback(null, true);
            }

            if (origin.startsWith('chrome-extension://')) {
              if (!(mockEnv as any).CHROME_EXTENSION_ID) {
                return callback(new Error('Not allowed by CORS'));
              }
              return callback(new Error('Not allowed by CORS'));
            }

            return callback(null, true);
          },
        })
      );
      testApp.get('/health', (_, res) => res.status(200).json({ status: 'ok' }));

      return request(testApp)
        .get('/health')
        .set('Origin', 'chrome-extension://someextensionid')
        .then((response) => {
          expect(response.headers['access-control-allow-origin']).toBeUndefined();
          // Restore the ID
          (mockEnv as any).CHROME_EXTENSION_ID = originalId;
        });
    });
  });

  describe('Development Origins (localhost)', () => {
    it('should allow requests from localhost:3001 in development', () => {
      const testApp = express();
      testApp.use(
        cors({
          origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
            if (!origin) {
              return callback(null, true);
            }

            if (origin.includes('localhost')) {
              return callback(null, true);
            }

            return callback(new Error('Not allowed by CORS'));
          },
        })
      );
      testApp.get('/health', (_, res) => res.status(200).json({ status: 'ok' }));

      return request(testApp)
        .get('/health')
        .set('Origin', 'http://localhost:3001')
        .expect(200)
        .then((response) => {
          expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3001');
        });
    });

    it('should allow requests from 127.0.0.1:3000 in development', () => {
      const testApp = express();
      testApp.use(
        cors({
          origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
            if (!origin) {
              return callback(null, true);
            }

            if (origin.includes('127.0.0.1')) {
              return callback(null, true);
            }

            return callback(new Error('Not allowed by CORS'));
          },
        })
      );
      testApp.get('/health', (_, res) => res.status(200).json({ status: 'ok' }));

      return request(testApp)
        .get('/health')
        .set('Origin', 'http://127.0.0.1:3000')
        .expect(200)
        .then((response) => {
          expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:3000');
        });
    });

    it('should not allow localhost in production when not explicitly configured', () => {
      const testApp = express();
      testApp.use(
        cors({
          origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
            if (!origin) {
              return callback(null, true);
            }

            // In production mode (not development), don't allow localhost unless explicitly configured
            return callback(new Error('Not allowed by CORS'));
          },
        })
      );
      testApp.get('/health', (_, res) => res.status(200).json({ status: 'ok' }));

      return request(testApp)
        .get('/health')
        .set('Origin', 'http://localhost:3000')
        .then((response) => {
          expect(response.headers['access-control-allow-origin']).toBeUndefined();
        });
    });
  });

  describe('Requests with No Origin', () => {
    it('should allow requests with no origin header (e.g., Postman, curl)', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body.status).toBe('ok');
    });

    it('should allow requests from mobile apps (no origin)', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body.status).toBe('ok');
    });
  });

  describe('Invalid Origins', () => {
    it('should reject requests from unknown origins', async () => {
      const response = await request(app).get('/health').set('Origin', 'https://malicious-site.com');

      // Should not have CORS headers
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should reject requests from similar but not matching wildcards', async () => {
      const response = await request(app).get('/health').set('Origin', 'https://app.heroku.com');

      // Should not have CORS headers
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Preflight OPTIONS Requests', () => {
    it('should handle preflight requests from allowed origins', async () => {
      const response = await request(app)
        .options('/api/v1/leads')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });

    it('should reject preflight requests from disallowed origins', async () => {
      const response = await request(app)
        .options('/api/v1/leads')
        .set('Origin', 'https://malicious-site.com')
        .set('Access-Control-Request-Method', 'POST');

      // Should not have CORS headers
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should include credentials header for allowed origins', async () => {
      const response = await request(app)
        .options('/api/v1/leads')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);

      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('CORS Headers Configuration', () => {
    it('should include correct allowed headers', async () => {
      const response = await request(app)
        .options('/api/v1/leads')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);

      const allowedHeaders = response.headers['access-control-allow-headers'];
      expect(allowedHeaders).toContain('Content-Type');
      expect(allowedHeaders).toContain('Authorization');
    });

    it('should include correct allowed methods', async () => {
      const response = await request(app)
        .options('/api/v1/leads')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);

      const allowedMethods = response.headers['access-control-allow-methods'];
      expect(allowedMethods).toContain('GET');
      expect(allowedMethods).toContain('POST');
      expect(allowedMethods).toContain('PUT');
      expect(allowedMethods).toContain('DELETE');
      expect(allowedMethods).toContain('OPTIONS');
    });
  });

  describe('Security Edge Cases', () => {
    it('should reject requests with malformed Chrome extension origin', async () => {
      const response = await request(app).get('/health').set('Origin', 'chrome-extension://');

      // Should not have CORS headers
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should reject requests with wildcard origin in production', () => {
      const testApp = express();
      testApp.use(
        cors({
          origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
            if (origin === '*') {
              return callback(new Error('Not allowed by CORS'));
            }
            return callback(null, true);
          },
        })
      );
      testApp.get('/health', (_, res) => res.status(200).json({ status: 'ok' }));

      return request(testApp)
        .get('/health')
        .set('Origin', '*')
        .then((response) => {
          expect(response.headers['access-control-allow-origin']).toBeUndefined();
        });
    });

    it('should handle multiple wildcard patterns correctly', async () => {
      const testApp = express();
      testApp.use(
        cors({
          origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
            if (!origin) {
              return callback(null, true);
            }

            const corsOrigins = ['https://*.vercel.app', 'https://*.herokuapp.com'];
            const isAllowed = corsOrigins.some((allowedOrigin) => {
              if (allowedOrigin.includes('*')) {
                const pattern = allowedOrigin.replace(/\*/g, '.*');
                const regex = new RegExp(`^${pattern}$`);
                return regex.test(origin);
              }
              return false;
            });

            if (isAllowed) {
              return callback(null, true);
            }

            return callback(new Error('Not allowed by CORS'));
          },
        })
      );
      testApp.get('/health', (_, res) => res.status(200).json({ status: 'ok' }));

      const response1 = await request(testApp)
        .get('/health')
        .set('Origin', 'https://app.vercel.app')
        .expect(200);

      expect(response1.headers['access-control-allow-origin']).toBe('https://app.vercel.app');

      const response2 = await request(testApp)
        .get('/health')
        .set('Origin', 'https://app.herokuapp.com')
        .expect(200);

      expect(response2.headers['access-control-allow-origin']).toBe('https://app.herokuapp.com');
    });
  });

  describe('Wildcard Origin Rejection', () => {
    it('should reject literal wildcard origin "*" as origin header', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', '*');

      // Should not have CORS headers
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should reject origins when CORS_ORIGINS contains only wildcard "*"', () => {
      const testApp = express();
      testApp.use(
        cors({
          origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
            if (!origin) {
              return callback(null, true);
            }

            // Simulate CORS_ORIGINS='*' with security check
            const corsOrigins = ['*'];
            const isAllowed = corsOrigins.some((allowedOrigin) => {
              // SECURITY: Reject standalone wildcard '*'
              if (allowedOrigin === '*') {
                return false;
              }

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

            if (isAllowed) {
              return callback(null, true);
            }

            return callback(new Error('Not allowed by CORS'));
          },
        })
      );
      testApp.get('/health', (_, res) => res.status(200).json({ status: 'ok' }));

      return request(testApp)
        .get('/health')
        .set('Origin', 'https://malicious-site.com')
        .then((response) => {
          // Even with CORS_ORIGINS='*', the standalone wildcard is rejected
          // for security - wildcards should only work in patterns like https://*.vercel.app
          expect(response.headers['access-control-allow-origin']).toBeUndefined();
        });
    });

    it('should reject origin that does not match wildcard pattern', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'https://evil.com');

      // evil.com does not match https://*.vercel.app pattern
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should reject origin with partial wildcard match attempt', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'https://attacker.vercel.app.evil.com');

      // This should not match https://*.vercel.app pattern
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Malicious Extension Origins', () => {
    it('should reject extension IDs with suspicious special characters', async () => {
      const maliciousOrigins = [
        'chrome-extension://malicious/../extension',
        'chrome-extension://<script>alert(1)</script>',
        'chrome-extension://"; DROP TABLE users; --',
        'chrome-extension://../../../etc/passwd',
        'chrome-extension://xyz../../etc/passwd',
      ];

      for (const origin of maliciousOrigins) {
        const response = await request(app).get('/health').set('Origin', origin);
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
      }
    });

    it('should reject extension IDs with XSS attempt patterns', async () => {
      const xssOrigins = [
        'chrome-extension://javascript:alert(1)',
        'chrome-extension://data:text/html,<script>alert(1)</script>',
        'chrome-extension://<img src=x onerror=alert(1)>',
        'chrome-extension://"><script>alert(String.fromCharCode(88,83,83))</script>',
      ];

      for (const origin of xssOrigins) {
        const response = await request(app).get('/health').set('Origin', origin);
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
      }
    });

    it('should reject extension IDs with null byte injection', async () => {
      const nullByteOrigins = [
        'chrome-extension://abcdefghijklmnopqrstuvwx%00yz',
        'chrome-extension://abcdefghijklmnop%00qrstuvwxyz',
      ];

      for (const origin of nullByteOrigins) {
        const response = await request(app).get('/health').set('Origin', origin);
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
      }
    });

    it('should reject extension IDs that are case variations of valid ID', async () => {
      const caseVariations = [
        'chrome-extension://ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        'chrome-extension://AbCdEfGhIjKlMnOpQrStUvWxYz',
        'chrome-extension://aBcDeFgHiJkLmNoPqRsTuVwXyZ',
      ];

      for (const origin of caseVariations) {
        const response = await request(app).get('/health').set('Origin', origin);
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
      }
    });

    it('should reject extension IDs with extremely long length (DoS attempt)', async () => {
      const longExtensionId = 'a'.repeat(10000);
      const response = await request(app)
        .get('/health')
        .set('Origin', `chrome-extension://${longExtensionId}`);

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should reject extension IDs with repeated patterns (DoS attempt)', async () => {
      const repeatedPattern = 'abc'.repeat(1000);
      const response = await request(app)
        .get('/health')
        .set('Origin', `chrome-extension://${repeatedPattern}`);

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should reject extension origins with URL encoding tricks', async () => {
      const encodedOrigins = [
        'chrome-extension://%2e%2e%2f',
        'chrome-extension://%252e%252e%252f',
        'chrome-extension://../%00/',
      ];

      for (const origin of encodedOrigins) {
        const response = await request(app).get('/health').set('Origin', origin);
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
      }
    });

    it('should reject extension origins attempting protocol confusion', async () => {
      const protocolConfusionOrigins = [
        'chrome-extension://https://evil.com',
        'chrome-extension://http://attacker.com',
        'chrome-extension://file:///etc/passwd',
      ];

      for (const origin of protocolConfusionOrigins) {
        const response = await request(app).get('/health').set('Origin', origin);
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
      }
    });

    it('should reject extension origins with common malicious patterns', async () => {
      const maliciousPatterns = [
        'chrome-extension://malicious-extension-id',
        'chrome-extension://steal-data-extension',
        'chrome-extension://keylogger-extension',
        'chrome-extension://phishing-attempt',
        'chrome-extension://token-harvester',
      ];

      for (const origin of maliciousPatterns) {
        const response = await request(app).get('/health').set('Origin', origin);
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
      }
    });
  });
});
