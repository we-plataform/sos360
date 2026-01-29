import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { pino } from 'pino';

// Mock pino
vi.mock('pino', () => ({
  pino: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  })),
}));

describe('Logger', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalEnv;
  });

  describe('Production Configuration', () => {
    it('should configure logger for production environment', async () => {
      process.env.NODE_ENV = 'production';

      // Clear module cache to force re-import
      vi.resetModules();

      // Re-import logger to trigger initialization with production env
      await import('./logger.js');

      expect(pino).toHaveBeenCalled();
      const callArgs = vi.mocked(pino).mock.calls[0][0];

      expect(callArgs.level).toBe('info');
      expect(callArgs.transport).toBeUndefined();
    });

    it('should redact sensitive fields in production', async () => {
      process.env.NODE_ENV = 'production';
      vi.resetModules();

      await import('./logger.js');

      const callArgs = vi.mocked(pino).mock.calls[0][0];

      expect(callArgs.redact).toEqual([
        'password',
        'passwordHash',
        'refreshToken',
        'accessToken',
        'authorization',
      ]);
    });
  });

  describe('Development Configuration', () => {
    it('should configure logger for development environment', async () => {
      process.env.NODE_ENV = 'development';
      vi.resetModules();

      await import('./logger.js');

      expect(pino).toHaveBeenCalled();
      const callArgs = vi.mocked(pino).mock.calls[0][0];

      expect(callArgs.level).toBe('debug');
    });

    it('should include pino-pretty transport in development', async () => {
      process.env.NODE_ENV = 'development';
      vi.resetModules();

      await import('./logger.js');

      const callArgs = vi.mocked(pino).mock.calls[0][0];

      expect(callArgs.transport).toBeDefined();
      expect(callArgs.transport?.target).toBe('pino-pretty');
      expect(callArgs.transport?.options).toEqual({ colorize: true });
    });

    it('should redact sensitive fields in development', async () => {
      process.env.NODE_ENV = 'development';
      vi.resetModules();

      await import('./logger.js');

      const callArgs = vi.mocked(pino).mock.calls[0][0];

      expect(callArgs.redact).toEqual([
        'password',
        'passwordHash',
        'refreshToken',
        'accessToken',
        'authorization',
      ]);
    });
  });

  describe('Test Environment Configuration', () => {
    it('should configure logger for test environment', async () => {
      process.env.NODE_ENV = 'test';
      vi.resetModules();

      await import('./logger.js');

      expect(pino).toHaveBeenCalled();
      const callArgs = vi.mocked(pino).mock.calls[0][0];

      // Test environment should behave like development (not production)
      expect(callArgs.level).toBe('debug');
      expect(callArgs.transport).toBeDefined();
    });
  });

  describe('Logger Instance', () => {
    it('should export a logger instance', async () => {
      vi.resetModules();

      const { logger } = await import('./logger.js');

      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.debug).toBeDefined();
      expect(logger.warn).toBeDefined();
    });
  });

  describe('Security - Sensitive Field Redaction', () => {
    it('should include all critical security fields in redaction list', async () => {
      vi.resetModules();

      await import('./logger.js');

      const callArgs = vi.mocked(pino).mock.calls[0][0];
      const redactFields = callArgs.redact as string[];

      // Verify all sensitive fields are redacted
      expect(redactFields).toContain('password');
      expect(redactFields).toContain('passwordHash');
      expect(redactFields).toContain('refreshToken');
      expect(redactFields).toContain('accessToken');
      expect(redactFields).toContain('authorization');
    });

    it('should have exactly 5 redacted fields', async () => {
      vi.resetModules();

      await import('./logger.js');

      const callArgs = vi.mocked(pino).mock.calls[0][0];
      const redactFields = callArgs.redact as string[];

      expect(redactFields).toHaveLength(5);
    });
  });

  describe('Log Level Configuration', () => {
    it('should use info level for production', async () => {
      process.env.NODE_ENV = 'production';
      vi.resetModules();

      await import('./logger.js');

      const callArgs = vi.mocked(pino).mock.calls[0][0];
      expect(callArgs.level).toBe('info');
    });

    it('should use debug level for non-production', async () => {
      const environments = ['development', 'test', undefined];

      for (const env of environments) {
        vi.resetModules();
        process.env.NODE_ENV = env;

        await import('./logger.js');

        const callArgs = vi.mocked(pino).mock.calls[vi.mocked(pino).mock.calls.length - 1][0];
        expect(callArgs.level).toBe('debug');
      }
    });
  });

  describe('Transport Configuration', () => {
    it('should not include transport in production', async () => {
      process.env.NODE_ENV = 'production';
      vi.resetModules();

      await import('./logger.js');

      const callArgs = vi.mocked(pino).mock.calls[0][0];
      expect(callArgs.transport).toBeUndefined();
    });

    it('should include colorized transport in non-production', async () => {
      const environments = ['development', 'test', undefined];

      for (const env of environments) {
        vi.resetModules();
        process.env.NODE_ENV = env;

        await import('./logger.js');

        const callArgs = vi.mocked(pino).mock.calls[vi.mocked(pino).mock.calls.length - 1][0];
        expect(callArgs.transport).toBeDefined();
        expect(callArgs.transport?.target).toBe('pino-pretty');
        expect(callArgs.transport?.options?.colorize).toBe(true);
      }
    });
  });
});
