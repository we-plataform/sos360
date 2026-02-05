import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { audiencesRouter } from './audiences.js';

// Mock dependencies
vi.mock('../middleware/auth.js', () => ({
  authenticate: (_req: any, _res: any, next: any) => {
    _req.user = {
      id: 'user-123',
      workspaceId: 'workspace-123',
      workspaceRole: 'admin',
    };
    next();
  },
  authorize: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../middleware/validate.js', () => ({
  validate: (_schema: any) => (_req: any, _res: any, next: any) => next(),
}));

const { prisma } = await import('@lia360/database');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/v1/audiences', audiencesRouter);

// Error handler to catch errors (must be after routes)
app.use((err: any, _req: any, res: any, _next: any) => {
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message,
  });
});

describe('Audiences API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /audiences', () => {
    it('should return empty array when no audiences exist', async () => {
      vi.mocked(prisma.audience.findMany).mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/v1/audiences')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(prisma.audience.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'workspace-123' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return list of audiences', async () => {
      const mockAudiences = [
        {
          id: 'audience-1',
          name: 'CEOs',
          workspaceId: 'workspace-123',
          gender: [],
          countries: ['US'],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'audience-2',
          name: 'CTOs',
          workspaceId: 'workspace-123',
          gender: ['male'],
          countries: [],
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ];

      vi.mocked(prisma.audience.findMany).mockResolvedValueOnce(mockAudiences);

      const response = await request(app)
        .get('/api/v1/audiences')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('CEOs');
    });
  });

  describe('GET /audiences/:id', () => {
    it('should return 404 when audience not found', async () => {
      vi.mocked(prisma.audience.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/v1/audiences/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return audience when found', async () => {
      const mockAudience = {
        id: 'audience-1',
        name: 'CEOs',
        workspaceId: 'workspace-123',
        gender: [],
        countries: ['US'],
        excludePrivate: true,
        excludeNoMessage: false,
        excludeNoPhoto: false,
        excludeCompanyPages: false,
        verifiedFilter: 'any' as const,
        friendsMin: null,
        friendsMax: null,
        mutualFriendsMin: null,
        mutualFriendsMax: null,
        followersMin: null,
        followersMax: null,
        postsMin: null,
        postsMax: null,
        jobTitleInclude: ['CEO'],
        jobTitleExclude: [],
        profileInfoInclude: [],
        profileInfoExclude: [],
        postContentInclude: [],
        postContentExclude: [],
        ignoreGenderIfUnknown: true,
        ignoreCountryIfUnknown: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      vi.mocked(prisma.audience.findFirst).mockResolvedValueOnce(mockAudience);

      const response = await request(app)
        .get('/api/v1/audiences/audience-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('audience-1');
      expect(response.body.data.name).toBe('CEOs');
      expect(prisma.audience.findFirst).toHaveBeenCalledWith({
        where: { id: 'audience-1', workspaceId: 'workspace-123' },
      });
    });
  });

  describe('POST /audiences', () => {
    it('should create a new audience', async () => {
      const newAudience = {
        id: 'audience-1',
        name: 'CEOs',
        workspaceId: 'workspace-123',
        gender: [],
        countries: ['US'],
        excludePrivate: true,
        excludeNoMessage: false,
        excludeNoPhoto: false,
        excludeCompanyPages: false,
        verifiedFilter: 'any' as const,
        friendsMin: null,
        friendsMax: null,
        mutualFriendsMin: null,
        mutualFriendsMax: null,
        followersMin: null,
        followersMax: null,
        postsMin: null,
        postsMax: null,
        jobTitleInclude: ['CEO'],
        jobTitleExclude: [],
        profileInfoInclude: [],
        profileInfoExclude: [],
        postContentInclude: [],
        postContentExclude: [],
        ignoreGenderIfUnknown: true,
        ignoreCountryIfUnknown: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      vi.mocked(prisma.audience.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.audience.create).mockResolvedValueOnce(newAudience);

      const response = await request(app)
        .post('/api/v1/audiences')
        .send({
          name: 'CEOs',
          countries: ['US'],
          excludePrivate: true,
          jobTitleInclude: ['CEO'],
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('CEOs');
      expect(prisma.audience.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'CEOs',
          workspaceId: 'workspace-123',
        }),
      });
    });

    it('should return 409 when audience name already exists', async () => {
      const existingAudience = {
        id: 'audience-1',
        name: 'CEOs',
        workspaceId: 'workspace-123',
      };

      vi.mocked(prisma.audience.findFirst).mockResolvedValueOnce(existingAudience);

      const response = await request(app)
        .post('/api/v1/audiences')
        .send({
          name: 'CEOs',
          countries: ['US'],
        })
        .expect(409);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /audiences/:id', () => {
    it('should update an audience', async () => {
      const existingAudience = {
        id: 'audience-1',
        name: 'CEOs',
        workspaceId: 'workspace-123',
        gender: [],
        countries: ['US'],
        excludePrivate: true,
        excludeNoMessage: false,
        excludeNoPhoto: false,
        excludeCompanyPages: false,
        verifiedFilter: 'any' as const,
        friendsMin: null,
        friendsMax: null,
        mutualFriendsMin: null,
        mutualFriendsMax: null,
        followersMin: null,
        followersMax: null,
        postsMin: null,
        postsMax: null,
        jobTitleInclude: ['CEO'],
        jobTitleExclude: [],
        profileInfoInclude: [],
        profileInfoExclude: [],
        postContentInclude: [],
        postContentExclude: [],
        ignoreGenderIfUnknown: true,
        ignoreCountryIfUnknown: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const updatedAudience = {
        ...existingAudience,
        name: 'Senior CEOs',
        excludePrivate: false,
      };

      vi.mocked(prisma.audience.findFirst).mockResolvedValueOnce(existingAudience);
      vi.mocked(prisma.audience.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.audience.update).mockResolvedValueOnce(updatedAudience);

      const response = await request(app)
        .patch('/api/v1/audiences/audience-1')
        .send({
          name: 'Senior CEOs',
          excludePrivate: false,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Senior CEOs');
      expect(prisma.audience.update).toHaveBeenCalledWith({
        where: { id: 'audience-1' },
        data: { name: 'Senior CEOs', excludePrivate: false },
      });
    });

    it('should return 404 when audience to update not found', async () => {
      vi.mocked(prisma.audience.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .patch('/api/v1/audiences/nonexistent')
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 409 when updating to duplicate name', async () => {
      const existingAudience = {
        id: 'audience-1',
        name: 'CEOs',
        workspaceId: 'workspace-123',
      };

      const duplicateAudience = {
        id: 'audience-2',
        name: 'CTOs',
        workspaceId: 'workspace-123',
      };

      vi.mocked(prisma.audience.findFirst).mockResolvedValueOnce(existingAudience);
      vi.mocked(prisma.audience.findFirst).mockResolvedValueOnce(duplicateAudience);

      const response = await request(app)
        .patch('/api/v1/audiences/audience-1')
        .send({ name: 'CTOs' })
        .expect(409);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /audiences/:id', () => {
    it('should delete an audience', async () => {
      const existingAudience = {
        id: 'audience-1',
        name: 'CEOs',
        workspaceId: 'workspace-123',
      };

      vi.mocked(prisma.audience.findFirst).mockResolvedValueOnce(existingAudience);
      vi.mocked(prisma.audience.delete).mockResolvedValueOnce(existingAudience);

      const response = await request(app)
        .delete('/api/v1/audiences/audience-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Audiência removida com sucesso');
      expect(prisma.audience.delete).toHaveBeenCalledWith({
        where: { id: 'audience-1' },
      });
    });

    it('should return 404 when audience to delete not found', async () => {
      vi.mocked(prisma.audience.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .delete('/api/v1/audiences/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});
