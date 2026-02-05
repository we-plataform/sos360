import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { workspacesRouter } from './workspaces.js';

// Mock dependencies
vi.mock('../middleware/auth.js', () => ({
  authenticate: (_req: any, _res: any, next: any) => {
    _req.user = {
      id: 'user-123',
      companyId: 'company-123',
      workspaceId: 'workspace-123',
      workspaceRole: 'owner',
      companyRole: 'owner',
    };
    next();
  },
  authorize: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  authorizeCompany: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../middleware/validate.js', () => ({
  validate: (_schema: any) => (_req: any, _res: any, next: any) => next(),
}));

// Import prisma to mock its methods (mocked in setup.ts)
const { prisma } = await import('@lia360/database');

// Import errors for proper error handling
const { NotFoundError } = await import('../lib/errors.js');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/v1/workspaces', workspacesRouter);

// Error handler to catch errors (must be after routes)
app.use((err: any, _req: any, res: any, _next: any) => {
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message,
  });
});

describe('Workspaces API Routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /workspaces', () => {
    it('should list all workspaces user has access to', async () => {
      const mockWorkspaceMemberships = [
        {
          workspace: {
            id: 'workspace-1',
            name: 'Marketing',
            createdAt: new Date('2024-01-01'),
            _count: { leads: 10, members: 5 },
          },
          role: 'owner',
        },
        {
          workspace: {
            id: 'workspace-2',
            name: 'Sales',
            createdAt: new Date('2024-01-02'),
            _count: { leads: 20, members: 3 },
          },
          role: 'admin',
        },
      ];

      vi.mocked(prisma.workspaceMember.findMany).mockResolvedValueOnce(
        mockWorkspaceMemberships as any
      );

      const response = await request(app)
        .get('/api/v1/workspaces')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('Marketing');
      expect(response.body.data[0].myRole).toBe('owner');
      expect(response.body.data[1].name).toBe('Sales');
      expect(prisma.workspaceMember.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          workspace: {
            companyId: 'company-123',
          },
        },
        include: {
          workspace: {
            include: {
              _count: {
                select: {
                  leads: true,
                  members: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    });

    it('should return empty array when user has no workspaces', async () => {
      vi.mocked(prisma.workspaceMember.findMany).mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/v1/workspaces')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('POST /workspaces', () => {
    it('should create a new workspace', async () => {
      const mockWorkspace = {
        id: 'workspace-new',
        name: 'New Workspace',
        createdAt: new Date('2024-01-01'),
      };

      vi.mocked(prisma.workspace.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.$transaction).mockImplementationOnce((callback) => {
        return callback({
          workspace: {
            create: vi.fn().mockResolvedValueOnce(mockWorkspace),
          },
          workspaceMember: {
            create: vi.fn().mockResolvedValueOnce({}),
          },
        } as any);
      });

      const response = await request(app)
        .post('/api/v1/workspaces')
        .send({ name: 'New Workspace' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Workspace');
      expect(response.body.data.myRole).toBe('owner');
      expect(prisma.workspace.findFirst).toHaveBeenCalledWith({
        where: {
          companyId: 'company-123',
          name: 'New Workspace',
        },
      });
    });

    it('should return 409 when workspace name already exists', async () => {
      const mockExisting = {
        id: 'workspace-existing',
        name: 'Existing Workspace',
        companyId: 'company-123',
      };

      vi.mocked(prisma.workspace.findFirst).mockResolvedValueOnce(mockExisting as any);

      const response = await request(app)
        .post('/api/v1/workspaces')
        .send({ name: 'Existing Workspace' })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.toLowerCase()).toContain('já existe');
    });
  });

  describe('GET /workspaces/:id', () => {
    it('should return workspace details', async () => {
      const mockMembership = {
        role: 'admin',
      };

      const mockWorkspace = {
        id: 'workspace-123',
        name: 'Test Workspace',
        settings: { theme: 'light' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        _count: {
          leads: 15,
          members: 5,
          templates: 3,
          automations: 2,
        },
      };

      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce(
        mockMembership as any
      );
      vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce(
        mockWorkspace as any
      );

      const response = await request(app)
        .get('/api/v1/workspaces/workspace-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Workspace');
      expect(response.body.data.myRole).toBe('admin');
      expect(response.body.data.stats.leads).toBe(15);
      expect(response.body.data.stats.members).toBe(5);
    });

    it('should return 404 when workspace not found', async () => {
      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/v1/workspaces/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /workspaces/:id', () => {
    it('should update workspace name', async () => {
      const mockUpdatedWorkspace = {
        id: 'workspace-123',
        name: 'Updated Name',
        settings: { theme: 'dark' },
        updatedAt: new Date('2024-01-03'),
      };

      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce({
        role: 'admin',
      } as any);
      vi.mocked(prisma.workspace.update).mockResolvedValueOnce(
        mockUpdatedWorkspace as any
      );

      const response = await request(app)
        .patch('/api/v1/workspaces/workspace-123')
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: 'workspace-123' },
        data: { name: 'Updated Name' },
      });
    });

    it('should update workspace settings', async () => {
      const mockUpdatedWorkspace = {
        id: 'workspace-123',
        name: 'Test Workspace',
        settings: { theme: 'light', notifications: true },
        updatedAt: new Date('2024-01-03'),
      };

      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce({
        role: 'admin',
      } as any);
      vi.mocked(prisma.workspace.update).mockResolvedValueOnce(
        mockUpdatedWorkspace as any
      );

      const response = await request(app)
        .patch('/api/v1/workspaces/workspace-123')
        .send({ settings: { theme: 'light', notifications: true } })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.settings.theme).toBe('light');
    });
  });

  describe('DELETE /workspaces/:id', () => {
    it('should delete a workspace', async () => {
      const mockWorkspace = {
        id: 'workspace-123',
        name: 'To Delete',
        companyId: 'company-123',
      };

      vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce(
        mockWorkspace as any
      );
      vi.mocked(prisma.workspace.count).mockResolvedValueOnce(2);
      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce({
        role: 'owner',
      } as any);
      vi.mocked(prisma.workspace.delete).mockResolvedValueOnce(
        mockWorkspace as any
      );

      const response = await request(app)
        .delete('/api/v1/workspaces/workspace-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.workspace.delete).toHaveBeenCalledWith({
        where: { id: 'workspace-123' },
      });
    });

    it('should return 403 when trying to delete last workspace', async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce({
        id: 'workspace-123',
        companyId: 'company-123',
      } as any);
      vi.mocked(prisma.workspace.count).mockResolvedValueOnce(1);

      const response = await request(app)
        .delete('/api/v1/workspaces/workspace-123')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('último workspace');
    });
  });

  describe('GET /workspaces/:id/members', () => {
    it('should list workspace members', async () => {
      const mockMembership = { role: 'admin' };

      const mockMembers = [
        {
          user: {
            id: 'user-1',
            email: 'user1@example.com',
            fullName: 'User One',
            avatarUrl: 'https://example.com/avatar1.jpg',
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
          },
          role: 'admin',
          createdAt: new Date('2024-01-02'),
        },
      ];

      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce(
        mockMembership as any
      );
      vi.mocked(prisma.workspaceMember.findMany).mockResolvedValueOnce(
        mockMembers as any
      );

      const response = await request(app)
        .get('/api/v1/workspaces/workspace-123/members')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].email).toBe('user1@example.com');
      expect(response.body.data[0].role).toBe('owner');
      expect(response.body.data[1].fullName).toBe('User Two');
    });

    it('should return 404 when workspace not found', async () => {
      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/v1/workspaces/nonexistent/members')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /workspaces/:id/members', () => {
    it('should add a member to workspace', async () => {
      const mockWorkspace = {
        id: 'workspace-123',
        companyId: 'company-123',
      };

      const mockCompanyMember = {
        userId: 'new-user-id',
        companyId: 'company-123',
      };

      const mockNewMember = {
        user: {
          id: 'new-user-id',
          email: 'newuser@example.com',
          fullName: 'New User',
          avatarUrl: null,
        },
        role: 'member',
        createdAt: new Date('2024-01-03'),
      };

      vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce(mockWorkspace as any);
      vi.mocked(prisma.companyMember.findUnique).mockResolvedValueOnce(mockCompanyMember as any);
      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.workspaceMember.create).mockResolvedValueOnce(mockNewMember as any);

      const response = await request(app)
        .post('/api/v1/workspaces/workspace-123/members')
        .send({ userId: 'new-user-id', role: 'member' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('newuser@example.com');
      expect(response.body.data.role).toBe('member');
      expect(prisma.workspaceMember.create).toHaveBeenCalledWith({
        data: {
          userId: 'new-user-id',
          workspaceId: 'workspace-123',
          role: 'member',
        },
        include: expect.any(Object),
      });
    });

    it('should return 409 when user is already a member', async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce({
        id: 'workspace-123',
        companyId: 'company-123',
      } as any);
      vi.mocked(prisma.companyMember.findUnique).mockResolvedValueOnce({
        userId: 'existing-user',
        companyId: 'company-123',
      } as any);
      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce({
        userId: 'existing-user',
        workspaceId: 'workspace-123',
      } as any);

      const response = await request(app)
        .post('/api/v1/workspaces/workspace-123/members')
        .send({ userId: 'existing-user', role: 'member' })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.toLowerCase()).toContain('já é membro');
    });

    it('should return 403 when user is not a company member', async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce({
        id: 'workspace-123',
        companyId: 'company-123',
      } as any);
      vi.mocked(prisma.companyMember.findUnique).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/v1/workspaces/workspace-123/members')
        .send({ userId: 'non-member', role: 'member' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('não é membro desta empresa');
    });
  });

  describe('PATCH /workspaces/:id/members/:userId', () => {
    it('should update member role', async () => {
      const mockMyMembership = { role: 'owner' };
      const mockUpdatedMember = {
        user: {
          id: 'target-user',
          email: 'target@example.com',
          fullName: 'Target User',
        },
        role: 'admin',
      };

      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce(
        mockMyMembership as any
      );
      vi.mocked(prisma.workspaceMember.update).mockResolvedValueOnce(
        mockUpdatedMember as any
      );

      const response = await request(app)
        .patch('/api/v1/workspaces/workspace-123/members/target-user')
        .send({ role: 'admin' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('admin');
      expect(prisma.workspaceMember.update).toHaveBeenCalledWith({
        where: {
          userId_workspaceId: {
            userId: 'target-user',
            workspaceId: 'workspace-123',
          },
        },
        data: { role: 'admin' },
        include: expect.any(Object),
      });
    });

    it('should return 403 when trying to change own role', async () => {
      // This test verifies the route logic, but our mocked authorize middleware bypasses the check
      // The route itself checks: if (targetUserId === req.user!.id)
      // So this test will pass the authorize middleware but fail the route's own check
      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce({
        role: 'owner',
      } as any);

      const response = await request(app)
        .patch('/api/v1/workspaces/workspace-123/members/user-123')
        .send({ role: 'member' });

      // The route should return 403 when trying to change own role
      expect(response.body.success).toBe(false);
      expect(response.body.error.toLowerCase()).toContain('próprio papel');
    });

    it('should return 403 when non-owner tries to assign owner role', async () => {
      // Similar to above, the route checks: if (role === 'owner' && myMembership.role !== 'owner')
      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce({
        role: 'admin',
      } as any);

      const response = await request(app)
        .patch('/api/v1/workspaces/workspace-123/members/target-user')
        .send({ role: 'owner' });

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Apenas o dono');
    });
  });

  describe('DELETE /workspaces/:id/members/:userId', () => {
    it('should remove a member from workspace', async () => {
      const mockMyMembership = { role: 'owner' };
      const mockTargetMember = {
        userId: 'target-user',
        workspaceId: 'workspace-123',
        role: 'admin',
      };

      vi.mocked(prisma.workspaceMember.findUnique)
        .mockResolvedValueOnce(mockMyMembership as any)
        .mockResolvedValueOnce(mockTargetMember as any);
      vi.mocked(prisma.workspaceMember.delete).mockResolvedValueOnce(
        mockTargetMember as any
      );

      const response = await request(app)
        .delete('/api/v1/workspaces/workspace-123/members/target-user')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.workspaceMember.delete).toHaveBeenCalledWith({
        where: {
          userId_workspaceId: {
            userId: 'target-user',
            workspaceId: 'workspace-123',
          },
        },
      });
    });

    it('should return 403 when trying to remove yourself', async () => {
      vi.mocked(prisma.workspaceMember.findUnique).mockResolvedValueOnce({
        role: 'owner',
      } as any);

      const response = await request(app)
        .delete('/api/v1/workspaces/workspace-123/members/user-123');

      expect(response.body.success).toBe(false);
      expect(response.body.error.toLowerCase()).toContain('não pode se remover');
    });

    it('should return 403 when non-owner tries to remove owner', async () => {
      const mockMyMembership = { role: 'admin' };
      const mockTargetMember = {
        userId: 'target-user',
        workspaceId: 'workspace-123',
        role: 'owner',
      };

      vi.mocked(prisma.workspaceMember.findUnique)
        .mockResolvedValueOnce(mockMyMembership as any)
        .mockResolvedValueOnce(mockTargetMember as any);

      const response = await request(app)
        .delete('/api/v1/workspaces/workspace-123/members/target-user');

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Apenas o dono');
    });

    it('should return 404 when member not found', async () => {
      vi.mocked(prisma.workspaceMember.findUnique)
        .mockResolvedValueOnce({ role: 'owner' } as any)
        .mockResolvedValueOnce(null);

      const response = await request(app)
        .delete('/api/v1/workspaces/workspace-123/members/nonexistent');

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Membro não encontrado');
    });
  });
});
