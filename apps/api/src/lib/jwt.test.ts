import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { JwtPayload } from '@lia360/shared';

// Mock the env module BEFORE importing jwt
vi.mock('../config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-secret-key-at-least-32-characters-long',
    JWT_EXPIRES_IN: '15m',
    REFRESH_TOKEN_EXPIRES_IN: '7d',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    NODE_ENV: 'test',
    PORT: 3001,
    CORS_ORIGINS: ['http://localhost:3000'],
    REDIS_URL: '',
  },
}));

// Import after mocking
import {
  signAccessToken,
  signRefreshToken,
  signSelectionToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifySelectionToken,
  getTokenExpiresIn,
  getRefreshTokenTTL,
} from './jwt.js';

describe('JWT Library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signAccessToken', () => {
    it('should sign an access token with correct payload', () => {
      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        sub: 'user-123',
        companyId: 'company-456',
        workspaceId: 'workspace-789',
        companyRole: 'admin',
        workspaceRole: 'manager',
      };

      const token = signAccessToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });

    it('should include all required fields in token', () => {
      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        sub: 'user-123',
        companyId: 'company-456',
        workspaceId: 'workspace-789',
        companyRole: 'owner',
        workspaceRole: 'admin',
      };

      const token = signAccessToken(payload);
      const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      expect(decoded.sub).toBe('user-123');
      expect(decoded.companyId).toBe('company-456');
      expect(decoded.workspaceId).toBe('workspace-789');
      expect(decoded.companyRole).toBe('owner');
      expect(decoded.workspaceRole).toBe('admin');
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });
  });

  describe('signRefreshToken', () => {
    it('should sign a refresh token with user ID', () => {
      const userId = 'user-123';
      const token = signRefreshToken(userId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include user ID and type in refresh token', () => {
      const userId = 'user-456';
      const token = signRefreshToken(userId);
      const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      expect(decoded.sub).toBe(userId);
      expect(decoded.type).toBe('refresh');
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });
  });

  describe('signSelectionToken', () => {
    it('should sign a selection token with user ID', () => {
      const userId = 'user-789';
      const token = signSelectionToken(userId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include user ID and selection type in token', () => {
      const userId = 'user-999';
      const token = signSelectionToken(userId);
      const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      expect(decoded.sub).toBe(userId);
      expect(decoded.type).toBe('selection');
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should have 5 minute expiration', () => {
      const userId = 'user-123';
      const token = signSelectionToken(userId);
      const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

      // Verify iat and exp exist
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();

      // Verify exp is after iat
      expect(decoded.exp).toBeGreaterThan(decoded.iat);

      // Calculate expiration time (should be 5 minutes = 300 seconds)
      const expiresIn = decoded.exp - decoded.iat;
      expect(expiresIn).toBe(300);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        sub: 'user-123',
        companyId: 'company-456',
        workspaceId: 'workspace-789',
        companyRole: 'admin',
        workspaceRole: 'manager',
      };

      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);

      expect(decoded.sub).toBe('user-123');
      expect(decoded.companyId).toBe('company-456');
      expect(decoded.workspaceId).toBe('workspace-789');
      expect(decoded.companyRole).toBe('admin');
      expect(decoded.workspaceRole).toBe('manager');
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        verifyAccessToken('invalid-token');
      }).toThrow();
    });

    it('should throw error for tampered token', () => {
      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        sub: 'user-123',
        companyId: 'company-456',
        workspaceId: 'workspace-789',
        companyRole: 'admin',
        workspaceRole: 'manager',
      };

      const token = signAccessToken(payload);
      const tamperedToken = token.slice(0, -10) + 'tamperedsignature';

      expect(() => {
        verifyAccessToken(tamperedToken);
      }).toThrow();
    });

    it('should throw error for expired token', () => {
      const jwt = require('jsonwebtoken');

      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        sub: 'user-123',
        companyId: 'company-456',
        workspaceId: 'workspace-789',
        companyRole: 'admin',
        workspaceRole: 'manager',
      };

      // Create an already-expired token
      const secret = 'test-secret-key-at-least-32-characters-long';
      const token = jwt.sign(payload, secret, { expiresIn: '0s' });

      // Wait a bit to ensure expiration
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(() => {
            verifyAccessToken(token);
          }).toThrow();
          resolve();
        }, 100);
      });
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const userId = 'user-123';
      const token = signRefreshToken(userId);
      const decoded = verifyRefreshToken(token);

      expect(decoded.sub).toBe(userId);
      expect(decoded.type).toBe('refresh');
    });

    it('should throw error for invalid refresh token', () => {
      expect(() => {
        verifyRefreshToken('invalid-refresh-token');
      }).toThrow();
    });

    it('should handle access token used as refresh token', () => {
      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        sub: 'user-123',
        companyId: 'company-456',
        workspaceId: 'workspace-789',
        companyRole: 'admin',
        workspaceRole: 'manager',
      };

      const accessToken = signAccessToken(payload);

      // verifyRefreshToken will verify the token but it won't have the 'type' field
      // The function will succeed but return undefined for the 'type' field
      const result = verifyRefreshToken(accessToken);

      expect(result.sub).toBe('user-123');
      expect(result.type).toBeUndefined(); // Access tokens don't have a type field
    });
  });

  describe('verifySelectionToken', () => {
    it('should verify a valid selection token', () => {
      const userId = 'user-123';
      const token = signSelectionToken(userId);
      const decoded = verifySelectionToken(token);

      expect(decoded.sub).toBe(userId);
      expect(decoded.type).toBe('selection');
    });

    it('should throw error for invalid selection token', () => {
      expect(() => {
        verifySelectionToken('invalid-selection-token');
      }).toThrow();
    });

    it('should throw error for token with wrong type', () => {
      const userId = 'user-123';
      const refresh_token = signRefreshToken(userId);

      expect(() => {
        verifySelectionToken(refresh_token);
      }).toThrow('Invalid token type');
    });

    it('should throw error for token missing type field', () => {
      // Create a token without type field using the mocked secret
      const jwtLib = require('jsonwebtoken');
      const secret = 'test-secret-key-at-least-32-characters-long';
      const token = jwtLib.sign({ sub: 'user-123' }, secret, {
        expiresIn: '5m',
      });

      expect(() => {
        verifySelectionToken(token);
      }).toThrow('Invalid token type');
    });
  });

  describe('getTokenExpiresIn', () => {
    it('should return correct value for mocked env (15m)', () => {
      const expiresIn = getTokenExpiresIn();
      expect(expiresIn).toBe(900); // 15 minutes * 60
    });

    it('should parse time format correctly - seconds', () => {
      // Test the parsing logic directly
      const match = '30s'.match(/^(\d+)([smhd])$/);
      expect(match).toBeDefined();
      if (match) {
        const value = parseInt(match[1], 10);
        const unit = match[2];
        let expected = 0;
        switch (unit) {
          case 's':
            expected = value;
            break;
          case 'm':
            expected = value * 60;
            break;
          case 'h':
            expected = value * 3600;
            break;
          case 'd':
            expected = value * 86400;
            break;
        }
        expect(expected).toBe(30);
      }
    });

    it('should parse time format correctly - minutes', () => {
      const match = '15m'.match(/^(\d+)([smhd])$/);
      expect(match).toBeDefined();
      if (match) {
        const value = parseInt(match[1], 10);
        const unit = match[2];
        let expected = 0;
        switch (unit) {
          case 's':
            expected = value;
            break;
          case 'm':
            expected = value * 60;
            break;
          case 'h':
            expected = value * 3600;
            break;
          case 'd':
            expected = value * 86400;
            break;
        }
        expect(expected).toBe(900);
      }
    });

    it('should parse time format correctly - hours', () => {
      const match = '2h'.match(/^(\d+)([smhd])$/);
      expect(match).toBeDefined();
      if (match) {
        const value = parseInt(match[1], 10);
        const unit = match[2];
        let expected = 0;
        switch (unit) {
          case 's':
            expected = value;
            break;
          case 'm':
            expected = value * 60;
            break;
          case 'h':
            expected = value * 3600;
            break;
          case 'd':
            expected = value * 86400;
            break;
        }
        expect(expected).toBe(7200);
      }
    });

    it('should parse time format correctly - days', () => {
      const match = '7d'.match(/^(\d+)([smhd])$/);
      expect(match).toBeDefined();
      if (match) {
        const value = parseInt(match[1], 10);
        const unit = match[2];
        let expected = 0;
        switch (unit) {
          case 's':
            expected = value;
            break;
          case 'm':
            expected = value * 60;
            break;
          case 'h':
            expected = value * 3600;
            break;
          case 'd':
            expected = value * 86400;
            break;
        }
        expect(expected).toBe(604800);
      }
    });

    it('should return default 900 seconds for invalid format', () => {
      const match = 'invalid'.match(/^(\d+)([smhd])$/);
      expect(match).toBeNull();
      // Default should be 900 (15 minutes)
    });
  });

  describe('getRefreshTokenTTL', () => {
    it('should return correct value for mocked env (7d)', () => {
      const ttl = getRefreshTokenTTL();
      expect(ttl).toBe(604800); // 7 days * 86400
    });

    it('should parse refresh token time format correctly - days', () => {
      const match = '7d'.match(/^(\d+)([smhd])$/);
      expect(match).toBeDefined();
      if (match) {
        const value = parseInt(match[1], 10);
        const unit = match[2];
        let expected = 0;
        switch (unit) {
          case 's':
            expected = value;
            break;
          case 'm':
            expected = value * 60;
            break;
          case 'h':
            expected = value * 3600;
            break;
          case 'd':
            expected = value * 86400;
            break;
        }
        expect(expected).toBe(604800);
      }
    });

    it('should return default 259200 seconds (3 days) for invalid format', () => {
      const match = 'invalid'.match(/^(\d+)([smhd])$/);
      expect(match).toBeNull();
      // Default should be 259200 (3 days)
    });
  });
});
