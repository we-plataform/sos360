import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, authorize, authorizeCompany } from './auth.js';
import { prisma } from '@lia360/database';
import { verifyAccessToken } from '../lib/jwt.js';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';
import type { JwtPayload } from '@lia360/shared';

// Mock Prisma
vi.mock('@lia360/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    companyMember: {
      findUnique: vi.fn(),
    },
    workspaceMember: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock JWT
vi.mock('../lib/jwt.js', () => ({
  verifyAccessToken: vi.fn(),
}));

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequest = {
      headers: {},
    };
    mockResponse = {};
    mockNext = vi.fn();
  });

  describe('authenticate', () => {
    const validPayload: JwtPayload = {
      sub: 'user-123',
      companyId: 'company-123',
      workspaceId: 'workspace-123',
    };

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      fullName: 'Test User',
    };

    const mockCompanyMember = {
      id: 'cm-123',
      userId: 'user-123',
      companyId: 'company-123',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockWorkspaceMember = {
      id: 'wm-123',
      userId: 'user-123',
      workspaceId: 'workspace-123',
      role: 'manager',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should authenticate successfully with valid token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      vi.mocked(verifyAccessToken).mockReturnValue(validPayload);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(prisma.companyMember.findUnique).mockResolvedValue(mockCompanyMember);
      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValue(mockWorkspaceMember);

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        companyId: 'company-123',
        companyRole: 'admin',
        workspaceId: 'workspace-123',
        workspaceRole: 'manager',
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should fail when no authorization header is present', async () => {
      mockRequest.headers = {};

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Token não fornecido' })
      );
      expect(mockRequest.user).toBeUndefined();
    });

    it('should fail when authorization header does not start with Bearer', async () => {
      mockRequest.headers = {
        authorization: 'Basic invalid-format',
      };

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Token não fornecido' })
      );
      expect(mockRequest.user).toBeUndefined();
    });

    it('should fail when token verification fails', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      vi.mocked(verifyAccessToken).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Token inválido ou expirado' })
      );
      expect(mockRequest.user).toBeUndefined();
    });

    it('should fail when user does not exist', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      vi.mocked(verifyAccessToken).mockReturnValue(validPayload);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Usuário não encontrado' })
      );
      expect(mockRequest.user).toBeUndefined();
    });

    it('should fail when user is not a company member', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      vi.mocked(verifyAccessToken).mockReturnValue(validPayload);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(prisma.companyMember.findUnique).mockResolvedValue(null);

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Usuário não pertence a esta empresa' })
      );
      expect(mockRequest.user).toBeUndefined();
    });

    it('should fail when user is not a workspace member', async () => {
      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      vi.mocked(verifyAccessToken).mockReturnValue(validPayload);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(prisma.companyMember.findUnique).mockResolvedValue(mockCompanyMember);
      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValue(null);

      await authenticate(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Usuário não tem acesso a este workspace' })
      );
      expect(mockRequest.user).toBeUndefined();
    });
  });

  describe('authorize', () => {
    it('should allow access when user has exact required role', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        companyId: 'company-123',
        companyRole: 'admin',
        workspaceId: 'workspace-123',
        workspaceRole: 'manager',
      };

      const middleware = authorize('manager');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow access when user has higher role than required', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        companyId: 'company-123',
        companyRole: 'admin',
        workspaceId: 'workspace-123',
        workspaceRole: 'owner',
      };

      const middleware = authorize('manager');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow access when user role matches any of multiple allowed roles', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        companyId: 'company-123',
        companyRole: 'admin',
        workspaceId: 'workspace-123',
        workspaceRole: 'admin',
      };

      const middleware = authorize('admin', 'manager');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny access when user has insufficient role', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        companyId: 'company-123',
        companyRole: 'admin',
        workspaceId: 'workspace-123',
        workspaceRole: 'viewer',
      };

      const middleware = authorize('manager');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Você não tem permissão para acessar este recurso',
        })
      );
    });

    it('should deny access when user is not authenticated', () => {
      mockRequest.user = undefined;

      const middleware = authorize('manager');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should correctly handle role hierarchy - owner can access admin endpoints', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        companyId: 'company-123',
        companyRole: 'admin',
        workspaceId: 'workspace-123',
        workspaceRole: 'owner',
      };

      const middleware = authorize('admin');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should correctly handle role hierarchy - agent cannot access manager endpoints', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        companyId: 'company-123',
        companyRole: 'admin',
        workspaceId: 'workspace-123',
        workspaceRole: 'agent',
      };

      const middleware = authorize('manager');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });
  });

  describe('authorizeCompany', () => {
    it('should allow access when user has exact required company role', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        companyId: 'company-123',
        companyRole: 'admin',
        workspaceId: 'workspace-123',
        workspaceRole: 'manager',
      };

      const middleware = authorizeCompany('admin');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow access when user has higher company role than required', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        companyId: 'company-123',
        companyRole: 'owner',
        workspaceId: 'workspace-123',
        workspaceRole: 'manager',
      };

      const middleware = authorizeCompany('admin');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow access when user role matches any of multiple allowed company roles', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        companyId: 'company-123',
        companyRole: 'admin',
        workspaceId: 'workspace-123',
        workspaceRole: 'manager',
      };

      const middleware = authorizeCompany('owner', 'admin');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny access when user has insufficient company role', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        companyId: 'company-123',
        companyRole: 'member',
        workspaceId: 'workspace-123',
        workspaceRole: 'manager',
      };

      const middleware = authorizeCompany('admin');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Você não tem permissão para gerenciar esta empresa',
        })
      );
    });

    it('should deny access when user is not authenticated', () => {
      mockRequest.user = undefined;

      const middleware = authorizeCompany('admin');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should correctly handle role hierarchy - owner can access admin company endpoints', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        companyId: 'company-123',
        companyRole: 'owner',
        workspaceId: 'workspace-123',
        workspaceRole: 'manager',
      };

      const middleware = authorizeCompany('admin');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should correctly handle role hierarchy - member cannot access admin company endpoints', () => {
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        companyId: 'company-123',
        companyRole: 'member',
        workspaceId: 'workspace-123',
        workspaceRole: 'owner',
      };

      const middleware = authorizeCompany('admin');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });
  });
});
