import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock env BEFORE importing auth router
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

// Mock dependencies
vi.mock('@lia360/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    workspace: {
      create: vi.fn(),
    },
    companyMember: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    workspaceMember: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

vi.mock('../lib/redis.js', () => ({
  storage: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../middleware/rate-limit.js', () => ({
  authRateLimit: (_req: any, _res: any, next: any) => next(),
}));

// Mock logger
vi.mock('../lib/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks are set up
const { authRouter } = await import('./auth.js');
const { prisma } = await import('@lia360/database');
const bcrypt = await import('bcrypt');
const { storage } = await import('../lib/redis.js');
const { errorHandler } = await import('../middleware/error-handler.js');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRouter);
app.use(errorHandler);

describe('Auth API Routes - POST /auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful registration', () => {
    it('should register a new user with company and workspace', async () => {
      const mockCompany = {
        id: 'company-123',
        name: 'Test Company',
        slug: 'test-company',
        plan: 'free',
      };

      const mockWorkspace = {
        id: 'workspace-123',
        name: 'Principal',
        companyId: 'company-123',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
      };

      // Mock no existing user
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      // Mock no existing company with same slug
      vi.mocked(prisma.company.findUnique).mockResolvedValueOnce(null);

      // Mock transaction
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => {
        return callback({
          company: {
            create: vi.fn().mockResolvedValueOnce(mockCompany),
          },
          workspace: {
            create: vi.fn().mockResolvedValueOnce(mockWorkspace),
          },
          user: {
            create: vi.fn().mockResolvedValueOnce(mockUser),
          },
          companyMember: {
            create: vi.fn().mockResolvedValueOnce({}),
          },
          workspaceMember: {
            create: vi.fn().mockResolvedValueOnce({}),
          },
        } as any);
      });

      // Mock password hashing
      vi.mocked(bcrypt.default.hash).mockResolvedValueOnce('hashed-password');

      // Mock storage.set
      vi.mocked(storage.set).mockResolvedValueOnce('OK');

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          fullName: 'Test User',
          companyName: 'Test Company',
          workspaceName: 'Principal',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.user.fullName).toBe('Test User');
      expect(response.body.data.context).toBeDefined();
      expect(response.body.data.context.company).toBeDefined();
      expect(response.body.data.context.company.name).toBe('Test Company');
      expect(response.body.data.context.company.role).toBe('owner');
      expect(response.body.data.context.workspace).toBeDefined();
      expect(response.body.data.context.workspace.name).toBe('Principal');
      expect(response.body.data.context.workspace.role).toBe('owner');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.expiresIn).toBeDefined();

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(bcrypt.default.hash).toHaveBeenCalledWith('Password123', 12);
      expect(storage.set).toHaveBeenCalled();
    });

    it('should use default workspace name when not provided', async () => {
      const mockCompany = {
        id: 'company-123',
        name: 'Test Company',
        slug: 'test-company',
        plan: 'free',
      };

      const mockWorkspace = {
        id: 'workspace-123',
        name: 'Principal',
        companyId: 'company-123',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.company.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => {
        return callback({
          company: {
            create: vi.fn().mockResolvedValueOnce(mockCompany),
          },
          workspace: {
            create: vi.fn().mockResolvedValueOnce(mockWorkspace),
          },
          user: {
            create: vi.fn().mockResolvedValueOnce(mockUser),
          },
          companyMember: {
            create: vi.fn().mockResolvedValueOnce({}),
          },
          workspaceMember: {
            create: vi.fn().mockResolvedValueOnce({}),
          },
        } as any);
      });

      vi.mocked(bcrypt.default.hash).mockResolvedValueOnce('hashed-password');
      vi.mocked(storage.set).mockResolvedValueOnce('OK');

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          fullName: 'Test User',
          companyName: 'Test Company',
        })
        .expect(201);

      expect(response.body.data.context.workspace.name).toBe('Principal');
    });

    it('should handle company name with special characters and create slug', async () => {
      const mockCompany = {
        id: 'company-123',
        name: 'São Paulo Café!',
        slug: 'sao-paulo-cafe',
        plan: 'free',
      };

      const mockWorkspace = {
        id: 'workspace-123',
        name: 'Principal',
        companyId: 'company-123',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.company.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => {
        return callback({
          company: {
            create: vi.fn().mockResolvedValueOnce(mockCompany),
          },
          workspace: {
            create: vi.fn().mockResolvedValueOnce(mockWorkspace),
          },
          user: {
            create: vi.fn().mockResolvedValueOnce(mockUser),
          },
          companyMember: {
            create: vi.fn().mockResolvedValueOnce({}),
          },
          workspaceMember: {
            create: vi.fn().mockResolvedValueOnce({}),
          },
        } as any);
      });

      vi.mocked(bcrypt.default.hash).mockResolvedValueOnce('hashed-password');
      vi.mocked(storage.set).mockResolvedValueOnce('OK');

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          fullName: 'Test User',
          companyName: 'São Paulo Café!',
        })
        .expect(201);

      expect(response.body.data.context.company.slug).toBe('sao-paulo-cafe');
    });

    it('should append number to slug when company name already exists', async () => {
      const mockCompany = {
        id: 'company-123',
        name: 'Test Company',
        slug: 'test-company-2',
        plan: 'free',
      };

      const mockWorkspace = {
        id: 'workspace-123',
        name: 'Principal',
        companyId: 'company-123',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      // First call finds existing company, second call finds no match for slug-2
      vi.mocked(prisma.company.findUnique)
        .mockResolvedValueOnce({ id: 'existing-company' } as any)
        .mockResolvedValueOnce(null);

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => {
        return callback({
          company: {
            create: vi.fn().mockResolvedValueOnce(mockCompany),
          },
          workspace: {
            create: vi.fn().mockResolvedValueOnce(mockWorkspace),
          },
          user: {
            create: vi.fn().mockResolvedValueOnce(mockUser),
          },
          companyMember: {
            create: vi.fn().mockResolvedValueOnce({}),
          },
          workspaceMember: {
            create: vi.fn().mockResolvedValueOnce({}),
          },
        } as any);
      });

      vi.mocked(bcrypt.default.hash).mockResolvedValueOnce('hashed-password');
      vi.mocked(storage.set).mockResolvedValueOnce('OK');

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          fullName: 'Test User',
          companyName: 'Test Company',
        })
        .expect(201);

      expect(response.body.data.context.company.slug).toBe('test-company-2');
      expect(prisma.company.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('conflict errors', () => {
    it('should return 409 when email already exists', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'existing-user',
        email: 'test@example.com',
      } as any);

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          fullName: 'Test User',
          companyName: 'Test Company',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.type).toBe('conflict');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  describe('error handling', () => {
    it('should handle database errors during transaction', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.company.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prisma.$transaction).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          fullName: 'Test User',
          companyName: 'Test Company',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should handle bcrypt hashing errors', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.company.findUnique).mockResolvedValueOnce(null);

      vi.mocked(bcrypt.default.hash).mockRejectedValueOnce(
        new Error('Hashing failed')
      );

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          fullName: 'Test User',
          companyName: 'Test Company',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });
});

describe('Auth API Routes - POST /auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful login with auto-selection', () => {
    it('should login and auto-select when user has single company and workspace', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        passwordHash: 'hashed-password',
        avatarUrl: null,
      };

      const mockCompany = {
        id: 'company-123',
        name: 'Test Company',
        slug: 'test-company',
        plan: 'free',
      };

      const mockWorkspace = {
        id: 'workspace-123',
        name: 'Principal',
        members: [{ role: 'owner' }],
      };

      const mockCompanyMembership = {
        userId: 'user-123',
        companyId: 'company-123',
        role: 'owner',
        company: {
          ...mockCompany,
          workspaces: [mockWorkspace],
        },
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser);
      vi.mocked(bcrypt.default.compare).mockResolvedValueOnce(true);
      vi.mocked(prisma.user.update).mockResolvedValueOnce(mockUser);
      vi.mocked(prisma.companyMember.findMany).mockResolvedValueOnce([mockCompanyMembership] as any);
      vi.mocked(storage.set).mockResolvedValueOnce('OK');

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.user.fullName).toBe('Test User');
      expect(response.body.data.context).toBeDefined();
      expect(response.body.data.context.company.name).toBe('Test Company');
      expect(response.body.data.context.company.role).toBe('owner');
      expect(response.body.data.context.workspace.name).toBe('Principal');
      expect(response.body.data.context.workspace.role).toBe('owner');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.expiresIn).toBeDefined();
      expect(response.body.data.selectionRequired).toBeUndefined();

      expect(bcrypt.default.compare).toHaveBeenCalledWith('Password123', 'hashed-password');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { lastLoginAt: expect.any(Date) },
      });
      expect(storage.set).toHaveBeenCalled();
    });
  });

  describe('successful login requiring selection', () => {
    it('should return companies list when user has multiple workspaces', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        passwordHash: 'hashed-password',
        avatarUrl: null,
      };

      const mockCompanyMemberships = [
        {
          userId: 'user-123',
          companyId: 'company-123',
          role: 'owner',
          company: {
            id: 'company-123',
            name: 'Test Company',
            slug: 'test-company',
            plan: 'free',
            workspaces: [
              {
                id: 'workspace-123',
                name: 'Principal',
                members: [{ role: 'owner' }],
              },
              {
                id: 'workspace-456',
                name: 'Sales',
                members: [{ role: 'admin' }],
              },
            ],
          },
        },
      ];

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser);
      vi.mocked(bcrypt.default.compare).mockResolvedValueOnce(true);
      vi.mocked(prisma.user.update).mockResolvedValueOnce(mockUser);
      vi.mocked(prisma.companyMember.findMany).mockResolvedValueOnce(mockCompanyMemberships as any);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.companies).toBeDefined();
      expect(response.body.data.companies).toHaveLength(1);
      expect(response.body.data.companies[0].workspaces).toHaveLength(2);
      expect(response.body.data.selectionRequired).toBe(true);
      expect(response.body.data.selectionToken).toBeDefined();
      expect(response.body.data.accessToken).toBeUndefined();
      expect(response.body.data.refreshToken).toBeUndefined();
    });

    it('should return companies list when user has multiple companies', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        passwordHash: 'hashed-password',
        avatarUrl: null,
      };

      const mockCompanyMemberships = [
        {
          userId: 'user-123',
          companyId: 'company-123',
          role: 'owner',
          company: {
            id: 'company-123',
            name: 'Test Company',
            slug: 'test-company',
            plan: 'free',
            workspaces: [
              {
                id: 'workspace-123',
                name: 'Principal',
                members: [{ role: 'owner' }],
              },
            ],
          },
        },
        {
          userId: 'user-123',
          companyId: 'company-456',
          role: 'admin',
          company: {
            id: 'company-456',
            name: 'Another Company',
            slug: 'another-company',
            plan: 'pro',
            workspaces: [
              {
                id: 'workspace-456',
                name: 'Main',
                members: [{ role: 'admin' }],
              },
            ],
          },
        },
      ];

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser);
      vi.mocked(bcrypt.default.compare).mockResolvedValueOnce(true);
      vi.mocked(prisma.user.update).mockResolvedValueOnce(mockUser);
      vi.mocked(prisma.companyMember.findMany).mockResolvedValueOnce(mockCompanyMemberships as any);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.companies).toHaveLength(2);
      expect(response.body.data.companies[0].name).toBe('Test Company');
      expect(response.body.data.companies[0].myRole).toBe('owner');
      expect(response.body.data.companies[1].name).toBe('Another Company');
      expect(response.body.data.companies[1].myRole).toBe('admin');
      expect(response.body.data.selectionRequired).toBe(true);
      expect(response.body.data.selectionToken).toBeDefined();
    });

    it('should filter out workspaces where user is not a member', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        passwordHash: 'hashed-password',
        avatarUrl: null,
      };

      const mockCompanyMemberships = [
        {
          userId: 'user-123',
          companyId: 'company-123',
          role: 'owner',
          company: {
            id: 'company-123',
            name: 'Test Company',
            slug: 'test-company',
            plan: 'free',
            workspaces: [
              {
                id: 'workspace-123',
                name: 'Principal',
                members: [{ role: 'owner' }],
              },
              {
                id: 'workspace-456',
                name: 'Sales',
                members: [], // User is not a member
              },
            ],
          },
        },
      ];

      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockUser);

      vi.mocked(bcrypt.default.compare).mockResolvedValueOnce(true);
      vi.mocked(prisma.user.update).mockResolvedValueOnce(mockUser);
      vi.mocked(prisma.companyMember.findMany).mockResolvedValueOnce(mockCompanyMemberships as any);
      vi.mocked(storage.set).mockResolvedValueOnce('OK');

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        })
        .expect(200);

      // After filtering out the workspace with no members, only 1 workspace remains
      // So auto-selection should occur
      expect(response.body.success).toBe(true);
      expect(response.body.data.context).toBeDefined();
      expect(response.body.data.context.workspace.name).toBe('Principal');
      expect(response.body.data.selectionRequired).toBeUndefined();
    });
  });

  describe('authentication failures', () => {
    it('should return 401 when email does not exist', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.type).toBe('unauthorized');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should return 401 when password is incorrect', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser);
      vi.mocked(bcrypt.default.compare).mockResolvedValueOnce(false);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.type).toBe('unauthorized');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should handle bcrypt comparison errors', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser);
      vi.mocked(bcrypt.default.compare).mockRejectedValueOnce(new Error('Comparison failed'));

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.type).toBe('unauthorized');
    });
  });

  describe('error handling', () => {
    it('should handle database errors during user lookup', async () => {
      vi.mocked(prisma.user.findUnique).mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should handle database errors during last login update', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser);
      vi.mocked(bcrypt.default.compare).mockResolvedValueOnce(true);
      vi.mocked(prisma.user.update).mockRejectedValueOnce(new Error('Update failed'));

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should handle database errors during company membership lookup', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser);
      vi.mocked(bcrypt.default.compare).mockResolvedValueOnce(true);
      vi.mocked(prisma.user.update).mockResolvedValueOnce(mockUser);
      vi.mocked(prisma.companyMember.findMany).mockRejectedValueOnce(new Error('Query failed'));

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should handle storage errors during refresh token storage', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        passwordHash: 'hashed-password',
        avatarUrl: null,
      };

      const mockCompanyMembership = {
        userId: 'user-123',
        companyId: 'company-123',
        role: 'owner',
        company: {
          id: 'company-123',
          name: 'Test Company',
          slug: 'test-company',
          plan: 'free',
          workspaces: [
            {
              id: 'workspace-123',
              name: 'Principal',
              members: [{ role: 'owner' }],
            },
          ],
        },
      };

      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockUser);

      vi.mocked(bcrypt.default.compare).mockResolvedValueOnce(true);
      vi.mocked(prisma.user.update).mockResolvedValueOnce(mockUser);
      vi.mocked(prisma.companyMember.findMany).mockResolvedValueOnce([mockCompanyMembership] as any);
      vi.mocked(storage.set).mockRejectedValueOnce(new Error('Redis connection failed'));

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        })
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });
});
