import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock RATE_LIMITS
vi.mock('@lia360/shared', () => ({
  RATE_LIMITS: {
    auth: { max: 10, windowMs: 60000 },
    import: { max: 5, windowMs: 60000 },
    default: { max: 100, windowMs: 60000 },
    analyze: { max: 20, windowMs: 60000 },
    analyzeBatch: { max: 5, windowMs: 60000 },
    analyzeDeep: { max: 10, windowMs: 60000 },
    enrich: { max: 15, windowMs: 60000 },
  },
}));

// Mock express-rate-limit to capture config
vi.mock('express-rate-limit', () => ({
  default: vi.fn((config) => {
    const middleware = vi.fn();
    (middleware as any).__config = config;
    return middleware;
  }),
}));

// Import after mocks are set up
import {
  authRateLimit,
  importRateLimit,
  defaultRateLimit,
  analyzeRateLimit,
  analyzeBatchRateLimit,
  analyzeDeepRateLimit,
  enrichRateLimit,
} from './rate-limit.js';

describe('Rate Limit Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getClientIp logic', () => {
    describe('X-Forwarded-For header', () => {
      it('should extract IP from X-Forwarded-For header (single IP)', () => {
        const req = {
          headers: {
            'x-forwarded-for': '192.168.1.100',
          },
          ip: '127.0.0.1',
        };

        const config = (authRateLimit as any).__config;
        const key = config.keyGenerator(req);
        expect(key).toBe('auth:192.168.1.100');
      });

      it('should extract first IP from X-Forwarded-For header (multiple IPs)', () => {
        const req = {
          headers: {
            'x-forwarded-for': '192.168.1.100, 10.0.0.1, 172.16.0.1',
          },
          ip: '127.0.0.1',
        };

        const config = (authRateLimit as any).__config;
        const key = config.keyGenerator(req);
        expect(key).toBe('auth:192.168.1.100');
      });

      it('should extract IP from X-Forwarded-For array', () => {
        const req = {
          headers: {
            'x-forwarded-for': ['192.168.1.100', '10.0.0.1'],
          },
          ip: '127.0.0.1',
        };

        const config = (authRateLimit as any).__config;
        const key = config.keyGenerator(req);
        expect(key).toBe('auth:192.168.1.100');
      });
    });

    describe('Cloudflare CF-Connecting-IP header', () => {
      it('should use CF-Connecting-IP when X-Forwarded-For is not present', () => {
        const req = {
          headers: {
            'cf-connecting-ip': '203.0.113.1',
          },
          ip: '127.0.0.1',
        };

        const config = (authRateLimit as any).__config;
        const key = config.keyGenerator(req);
        expect(key).toBe('auth:203.0.113.1');
      });
    });

    describe('X-Real-IP header', () => {
      it('should use X-Real-IP when other headers are not present', () => {
        const req = {
          headers: {
            'x-real-ip': '198.51.100.1',
          },
          ip: '127.0.0.1',
        };

        const config = (authRateLimit as any).__config;
        const key = config.keyGenerator(req);
        expect(key).toBe('auth:198.51.100.1');
      });
    });

    describe('Fallback to req.ip', () => {
      it('should fallback to req.ip when no proxy headers are present', () => {
        const req = {
          headers: {},
          ip: '203.0.113.50',
        };

        const config = (authRateLimit as any).__config;
        const key = config.keyGenerator(req);
        expect(key).toBe('auth:203.0.113.50');
      });

      it('should return unknown when no IP is available', () => {
        const req = {
          headers: {},
        };

        const config = (authRateLimit as any).__config;
        const key = config.keyGenerator(req);
        expect(key).toBe('auth:unknown');
      });
    });
  });

  describe('authRateLimit', () => {
    it('should use auth prefix in key', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.1' },
        ip: '127.0.0.1',
      };

      const config = (authRateLimit as any).__config;
      const key = config.keyGenerator(req);
      expect(key).toBe('auth:192.168.1.1');
    });

    it('should skip rate limiting when IP is unknown', () => {
      const req = {
        headers: {},
      };

      const config = (authRateLimit as any).__config;
      const shouldSkip = config.skip(req);
      expect(shouldSkip).toBe(true);
    });

    it('should not skip when IP is known', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      };

      const config = (authRateLimit as any).__config;
      const shouldSkip = config.skip(req);
      expect(shouldSkip).toBe(false);
    });
  });

  describe('importRateLimit', () => {
    it('should use import prefix in key', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.1' },
        ip: '127.0.0.1',
      };

      const config = (importRateLimit as any).__config;
      const key = config.keyGenerator(req);
      expect(key).toBe('import:192.168.1.1');
    });

    it('should skip rate limiting when IP is unknown', () => {
      const req = {
        headers: {},
      };

      const config = (importRateLimit as any).__config;
      const shouldSkip = config.skip(req);
      expect(shouldSkip).toBe(true);
    });
  });

  describe('defaultRateLimit', () => {
    it('should use user ID when authenticated', () => {
      const req = {
        user: { id: 'user-123' },
        headers: { 'x-forwarded-for': '192.168.1.1' },
        ip: '127.0.0.1',
      };

      const config = (defaultRateLimit as any).__config;
      const key = config.keyGenerator(req);
      expect(key).toBe('user:user-123');
    });

    it('should use IP when not authenticated', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.1' },
        ip: '127.0.0.1',
      };

      const config = (defaultRateLimit as any).__config;
      const key = config.keyGenerator(req);
      expect(key).toBe('ip:192.168.1.1');
    });

    it('should not skip when user is authenticated', () => {
      const req = {
        user: { id: 'user-123' },
        headers: {},
      };

      const config = (defaultRateLimit as any).__config;
      const shouldSkip = config.skip(req);
      expect(shouldSkip).toBe(false);
    });

    it('should skip when IP is unknown and not authenticated', () => {
      const req = {
        headers: {},
      };

      const config = (defaultRateLimit as any).__config;
      const shouldSkip = config.skip(req);
      expect(shouldSkip).toBe(true);
    });

    it('should not skip when IP is known and not authenticated', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      };

      const config = (defaultRateLimit as any).__config;
      const shouldSkip = config.skip(req);
      expect(shouldSkip).toBe(false);
    });
  });

  describe('analyzeRateLimit', () => {
    it('should use user ID with analyze suffix when authenticated', () => {
      const req = {
        user: { id: 'user-123' },
        headers: { 'x-forwarded-for': '192.168.1.1' },
        ip: '127.0.0.1',
      };

      const config = (analyzeRateLimit as any).__config;
      const key = config.keyGenerator(req);
      expect(key).toBe('user:user-123:analyze');
    });

    it('should use IP with analyze suffix when not authenticated', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.1' },
        ip: '127.0.0.1',
      };

      const config = (analyzeRateLimit as any).__config;
      const key = config.keyGenerator(req);
      expect(key).toBe('ip:192.168.1.1:analyze');
    });

    it('should not skip when user is authenticated', () => {
      const req = {
        user: { id: 'user-123' },
        headers: {},
      };

      const config = (analyzeRateLimit as any).__config;
      const shouldSkip = config.skip(req);
      expect(shouldSkip).toBe(false);
    });

    it('should skip when IP is unknown and not authenticated', () => {
      const req = {
        headers: {},
      };

      const config = (analyzeRateLimit as any).__config;
      const shouldSkip = config.skip(req);
      expect(shouldSkip).toBe(true);
    });
  });

  describe('analyzeBatchRateLimit', () => {
    it('should use user ID with analyze-batch suffix when authenticated', () => {
      const req = {
        user: { id: 'user-456' },
        headers: { 'x-forwarded-for': '192.168.1.1' },
        ip: '127.0.0.1',
      };

      const config = (analyzeBatchRateLimit as any).__config;
      const key = config.keyGenerator(req);
      expect(key).toBe('user:user-456:analyze-batch');
    });

    it('should use IP with analyze-batch suffix when not authenticated', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.1' },
        ip: '127.0.0.1',
      };

      const config = (analyzeBatchRateLimit as any).__config;
      const key = config.keyGenerator(req);
      expect(key).toBe('ip:192.168.1.1:analyze-batch');
    });
  });

  describe('analyzeDeepRateLimit', () => {
    it('should use user ID with analyze-deep suffix when authenticated', () => {
      const req = {
        user: { id: 'user-789' },
        headers: { 'x-forwarded-for': '192.168.1.1' },
        ip: '127.0.0.1',
      };

      const config = (analyzeDeepRateLimit as any).__config;
      const key = config.keyGenerator(req);
      expect(key).toBe('user:user-789:analyze-deep');
    });

    it('should use IP with analyze-deep suffix when not authenticated', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.1' },
        ip: '127.0.0.1',
      };

      const config = (analyzeDeepRateLimit as any).__config;
      const key = config.keyGenerator(req);
      expect(key).toBe('ip:192.168.1.1:analyze-deep');
    });
  });

  describe('enrichRateLimit', () => {
    it('should use user ID with enrich suffix when authenticated', () => {
      const req = {
        user: { id: 'user-999' },
        headers: { 'x-forwarded-for': '192.168.1.1' },
        ip: '127.0.0.1',
      };

      const config = (enrichRateLimit as any).__config;
      const key = config.keyGenerator(req);
      expect(key).toBe('user:user-999:enrich');
    });

    it('should use IP with enrich suffix when not authenticated', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.1' },
        ip: '127.0.0.1',
      };

      const config = (enrichRateLimit as any).__config;
      const key = config.keyGenerator(req);
      expect(key).toBe('ip:192.168.1.1:enrich');
    });
  });

  describe('Rate limit configurations', () => {
    it('should have correct message format for auth rate limit', () => {
      const config = (authRateLimit as any).__config;
      expect(config.message).toEqual({
        success: false,
        error: {
          type: 'rate_limited',
          title: 'Too Many Requests',
          status: 429,
          detail: 'Muitas tentativas. Tente novamente em alguns minutos.',
        },
      });
    });

    it('should have correct message format for import rate limit', () => {
      const config = (importRateLimit as any).__config;
      expect(config.message).toEqual({
        success: false,
        error: {
          type: 'rate_limited',
          title: 'Too Many Requests',
          status: 429,
          detail: 'Limite de importações atingido. Tente novamente em alguns minutos.',
        },
      });
    });

    it('should have correct message format for default rate limit', () => {
      const config = (defaultRateLimit as any).__config;
      expect(config.message).toEqual({
        success: false,
        error: {
          type: 'rate_limited',
          title: 'Too Many Requests',
          status: 429,
          detail: 'Muitas requisições. Tente novamente mais tarde.',
        },
      });
    });

    it('should have standardHeaders enabled', () => {
      const config = (authRateLimit as any).__config;
      expect(config.standardHeaders).toBe(true);
    });

    it('should have legacyHeaders disabled', () => {
      const config = (authRateLimit as any).__config;
      expect(config.legacyHeaders).toBe(false);
    });
  });

  describe('IP extraction priority', () => {
    it('should prioritize X-Forwarded-For over other headers', () => {
      const req = {
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'cf-connecting-ip': '10.0.0.1',
          'x-real-ip': '172.16.0.1',
        },
        ip: '127.0.0.1',
      };

      const config = (authRateLimit as any).__config;
      const key = config.keyGenerator(req);
      expect(key).toBe('auth:192.168.1.1');
    });

    it('should use CF-Connecting-IP when X-Forwarded-For is empty', () => {
      const req = {
        headers: {
          'x-forwarded-for': '',
          'cf-connecting-ip': '10.0.0.1',
          'x-real-ip': '172.16.0.1',
        },
        ip: '127.0.0.1',
      };

      const config = (authRateLimit as any).__config;
      const key = config.keyGenerator(req);
      expect(key).toBe('auth:10.0.0.1');
    });

    it('should use X-Real-IP when X-Forwarded-For and CF-Connecting-IP are missing', () => {
      const req = {
        headers: {
          'x-real-ip': '172.16.0.1',
        },
        ip: '127.0.0.1',
      };

      const config = (authRateLimit as any).__config;
      const key = config.keyGenerator(req);
      expect(key).toBe('auth:172.16.0.1');
    });
  });
});
