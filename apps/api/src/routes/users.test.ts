import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { usersRouter } from './users.js';

// Mock dependencies
vi.mock('../middleware/auth.js', () => ({
  authenticate: (_req: any, _res: any, next: any) => {
    _req.user = {
      id: 'user-123',
      companyId: 'company-123',
      workspaceId: 'workspace-123',
      workspaceRole: 'admin',
      companyRole: 'admin',
    };
    next();
  },
  authorize: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../middleware/validate.js', () => ({
  validate: (_schema: any) => (_req: any, _res: any, next: any) => next(),
}));

// Import prisma to mock its methods
const { prisma } = await import('@lia360/database');

// Import errors for proper error handling
const { NotFoundError, ForbiddenError } = await import('../lib/errors.js');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/v1/users', usersRouter);

// Error handler to catch errors (must be after routes)
app.use((err: any, _req: any, res: any, _next: any) => {
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message,
  });
});

describe('Users API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /users', () => {
    it('should list all workspace users', async () => {
      const mockMembers = [
        {
          user: {
            id: 'user-1',
            email: 'user1@example.com',
            fullName: 'User One',
            avatarUrl: 'https://example.com/avatar1.jpg',
            lastLoginAt: new Date('2024-01-15'),
            createdAt: new Date('2024-01-01'),
            _count: {
              assignedLeads: 5,
              assignedConversations: 2,
            },
          },
          role: 'owner',
          createdAt: new Date('2024-01-01'),
        },
        {
          user: {
            id: 'user-2',
            email: 'user2@example.com',
            fullName: 'User Two',
            avatarUrl: null,
            lastLoginAt: new Date('2024-01-16'),
            createdAt: new Date('2024-01-02'),
            _count: {
              assignedLeads: 3,
              assignedConversations: 1,
            },
          },
          role: 'admin',
          createdAt: new Date('2024-01-02'),
        },
      ];

      vi.mocked(prisma.workspaceMember.findMany).mockResolvedValueOnce(mockMembers as any);

      const response = await request(app)
        .get('/api/v1/users')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].email).toBe('user1@example.com');
      expect(response.body.data[0].role).toBe('owner');
      expect(response.body.data[0].stats.leadsAssigned).toBe(5);
      expect(response.body.data[1].email).toBe('user2@example.com');
      expect(prisma.workspaceMember.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'workspace-123' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              avatarUrl: true,
              lastLoginAt: true,
              createdAt: true,
              _count: {
                select: {
                  assignedLeads: {
                    where: { workspaceId: 'workspace-123' },
                  },
                  assignedConversations: {
                    where: {
                      status: 'active',
                      lead: { workspaceId: 'workspace-123' },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return empty array when no users in workspace', async () => {
      vi.mocked(prisma.workspaceMember.findMany).mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/v1/users')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /users/me', () => {
    it('should return current user profile', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'currentuser@example.com',
        fullName: 'Current User',
        avatarUrl: 'https://example.com/avatar.jpg',
        settings: { notifications: true },
        createdAt: new Date('2024-01-01'),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any);

      const response = await request(app)
        .get('/api/v1/users/me')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('user-123');
      expect(response.body.data.email).toBe('currentuser@example.com');
      expect(response.body.data.workspaceRole).toBe('admin');
      expect(response.body.data.companyRole).toBe('admin');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: {
          id: true,
          email: true,
          fullName: true,
          avatarUrl: true,
          settings: true,
          createdAt: true,
        },
      });
    });

    it('should return 404 when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/v1/users/me')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('não encontrado');
    });
  });

  describe('GET /users/:id', () => {
    it('should return user details when found', async () => {
      const mockMember = {
        user: {
          id: 'user-456',
          email: 'otheruser@example.com',
          fullName: 'Other User',
          avatarUrl: 'https://example.com/avatar2.jpg',
          settings: { notifications: false },
          lastLoginAt: new Date('2024-01-15'),
          createdAt: new Date('2024-01-05'),
          _count: {
            assignedLeads: 8,
            assignedConversations: 4,
            sentMessages: 15,
          },
        },
        role: 'manager',
        createdAt: new Date('2024-01-05'),
      };

      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce(mockMember as any);

      const response = await request(app)
        .get('/api/v1/users/user-456')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('user-456');
      expect(response.body.data.email).toBe('otheruser@example.com');
      expect(response.body.data.role).toBe('manager');
      expect(response.body.data.stats.leadsAssigned).toBe(8);
      expect(response.body.data.stats.messagesSent).toBe(15);
      expect(prisma.workspaceMember.findUnique).toHaveBeenCalledWith({
        where: {
          userId_workspaceId: { userId: 'user-456', workspaceId: 'workspace-123' },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              avatarUrl: true,
              settings: true,
              lastLoginAt: true,
              createdAt: true,
              _count: {
                select: {
                  assignedLeads: {
                    where: { workspaceId: 'workspace-123' },
                  },
                  assignedConversations: {
                    where: { lead: { workspaceId: 'workspace-123' } },
                  },
                  sentMessages: true,
                },
              },
            },
          },
        },
      });
    });

    it('should return 404 when user not found in workspace', async () => {
      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/v1/users/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('não encontrado');
    });
  });

  describe('PATCH /users/:id', () => {
    it('should update user role successfully', async () => {
      const mockExistingMember = {
        role: 'agent',
      };

      const mockUpdatedMember = {
        user: {
          id: 'user-789',
          email: 'upgraded@example.com',
          fullName: 'Upgraded User',
          avatarUrl: null,
        },
        role: 'manager',
      };

      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce(mockExistingMember as any);
      vi.mocked(prisma.workspaceMember.update).mockResolvedValueOnce(mockUpdatedMember as any);

      const response = await request(app)
        .patch('/api/v1/users/user-789')
        .send({ role: 'manager' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('user-789');
      expect(response.body.data.role).toBe('manager');
      expect(prisma.workspaceMember.update).toHaveBeenCalledWith({
        where: {
          userId_workspaceId: { userId: 'user-789', workspaceId: 'workspace-123' },
        },
        data: { role: 'manager' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      });
    });

    it('should return 404 when user not found', async () => {
      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce(null);

      const response = await request(app)
        .patch('/api/v1/users/nonexistent')
        .send({ role: 'manager' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should prevent changing own role', async () => {
      const mockExistingMember = {
        role: 'manager',
      };

      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce(mockExistingMember as any);

      const response = await request(app)
        .patch('/api/v1/users/user-123')
        .send({ role: 'agent' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('não pode alterar seu próprio papel');
    });

    it('should prevent non-owner from assigning owner role', async () => {
      const mockExistingMember = {
        role: 'manager',
      };

      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce(mockExistingMember as any);

      const response = await request(app)
        .patch('/api/v1/users/user-789')
        .send({ role: 'owner' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Apenas o dono');
    });

    it('should prevent admin from changing another admin', async () => {
      const mockExistingMember = {
        role: 'admin',
      };

      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce(mockExistingMember as any);

      const response = await request(app)
        .patch('/api/v1/users/user-789')
        .send({ role: 'manager' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('não tem permissão');
    });
  });

  describe('DELETE /users/:id', () => {
    it('should remove user from workspace successfully', async () => {
      const mockMember = {
        role: 'agent',
      };

      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce(mockMember as any);
      vi.mocked(prisma.workspaceMember.delete).mockResolvedValueOnce({} as any);

      const response = await request(app)
        .delete('/api/v1/users/user-789')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('removido do workspace');
      expect(prisma.workspaceMember.delete).toHaveBeenCalledWith({
        where: {
          userId_workspaceId: { userId: 'user-789', workspaceId: 'workspace-123' },
        },
      });
    });

    it('should return 404 when user not found', async () => {
      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce(null);

      const response = await request(app)
        .delete('/api/v1/users/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should prevent removing yourself', async () => {
      const mockMember = {
        role: 'admin',
      };

      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce(mockMember as any);

      const response = await request(app)
        .delete('/api/v1/users/user-123')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('não pode remover a si mesmo');
    });

    it('should prevent removing owner', async () => {
      const mockMember = {
        role: 'owner',
      };

      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce(mockMember as any);

      const response = await request(app)
        .delete('/api/v1/users/user-owner')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.toLowerCase()).toContain('remover o dono');
    });

    it('should prevent admin from removing another admin', async () => {
      const mockMember = {
        role: 'admin',
      };

      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce(mockMember as any);

      const response = await request(app)
        .delete('/api/v1/users/user-admin')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('não podem remover outros admins');
    });
  });
});
