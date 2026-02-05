/**
 * Integration tests for Leads API routes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { leadsRouter } from './leads.js';

// Mock shared package to avoid import issues
vi.mock('@lia360/shared', () => ({
  createLeadSchema: { parse: vi.fn() },
  updateLeadSchema: { parse: vi.fn() },
  importLeadsSchema: { parse: vi.fn() },
  importPostSchema: { parse: vi.fn() },
  leadFiltersSchema: { parse: vi.fn() },
  PAGINATION_DEFAULTS: { page: 1, limit: 10 },
  calculateOffset: vi.fn(() => 0),
  calculateTotalPages: vi.fn(() => 1),
  parseSort: vi.fn(() => ({ field: 'createdAt', direction: 'desc' })),
}));

vi.mock('../lib/openai.js');
vi.mock('../services/scoring.js');
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

vi.mock('../middleware/rate-limit.js', () => ({
  importRateLimit: (_req: any, _res: any, next: any) => next(),
  analyzeRateLimit: (_req: any, _res: any, next: any) => next(),
  analyzeBatchRateLimit: (_req: any, _res: any, next: any) => next(),
  analyzeDeepRateLimit: (_req: any, _res: any, next: any) => next(),
  enrichRateLimit: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../middleware/validate.js', () => ({
  validate: (_schema: any, _type: string) => (_req: any, _res: any, next: any) => next(),
}));

// Import prisma to mock its methods (mocked in setup.ts)
const { prisma } = await import('@lia360/database');

// Create test app
const app = express();
app.use(express.json());

// Mock socket.io BEFORE mounting routes
app.set('io', {
  to: vi.fn().mockReturnThis(),
  emit: vi.fn(),
});

// Mount routes
app.use('/api/v1/leads', leadsRouter);

// Error handler to catch errors (must be after routes)
app.use((err: any, _req: any, res: any, _next: any) => {
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message,
  });
});

describe('Leads API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /leads', () => {
    it('should return paginated list of leads', async () => {
      const mockLeads = [
        {
          id: 'lead-1',
          fullName: 'John Doe',
          username: 'johndoe',
          email: 'john@example.com',
          platform: 'linkedin',
          status: 'new',
          score: 75,
          assignedTo: null,
          tags: [],
          socialProfiles: [],
          address: null,
        },
        {
          id: 'lead-2',
          fullName: 'Jane Smith',
          username: 'janesmith',
          email: 'jane@example.com',
          platform: 'instagram',
          status: 'contacted',
          score: 85,
          assignedTo: null,
          tags: [],
          socialProfiles: [],
          address: null,
        },
      ];

      vi.mocked(prisma.lead.findMany).mockResolvedValueOnce(mockLeads);
      vi.mocked(prisma.lead.count).mockResolvedValueOnce(2);

      const response = await request(app)
        .get('/api/v1/leads?page=1&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(2);
      expect(response.body.pagination.totalPages).toBe(1);
    });

    it('should filter leads by platform', async () => {
      const mockLeads = [
        {
          id: 'lead-1',
          fullName: 'John Doe',
          platform: 'linkedin',
          status: 'new',
          score: 75,
          assignedTo: null,
          tags: [],
          socialProfiles: [],
          address: null,
        },
      ];

      vi.mocked(prisma.lead.findMany).mockResolvedValueOnce(mockLeads);
      vi.mocked(prisma.lead.count).mockResolvedValueOnce(1);

      const response = await request(app)
        .get('/api/v1/leads?platform=linkedin')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(prisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            platform: 'linkedin',
          }),
        })
      );
    });

    it('should filter leads by score range', async () => {
      vi.mocked(prisma.lead.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.lead.count).mockResolvedValueOnce(0);

      await request(app)
        .get('/api/v1/leads?scoreMin=50&scoreMax=100')
        .expect(200);

      expect(prisma.lead.findMany).toHaveBeenCalled();
      const callArgs = vi.mocked(prisma.lead.findMany).mock.calls[0][0];
      // Query params come as strings from Express, validation should convert to numbers
      expect(callArgs.where.score).toBeDefined();
    });

    it('should search leads by name, username, or email', async () => {
      vi.mocked(prisma.lead.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.lead.count).mockResolvedValueOnce(0);

      await request(app)
        .get('/api/v1/leads?search=john')
        .expect(200);

      expect(prisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { fullName: { contains: 'john', mode: 'insensitive' } },
              { username: { contains: 'john', mode: 'insensitive' } },
              { email: { contains: 'john', mode: 'insensitive' } },
            ],
          }),
        })
      );
    });

    it.skip('should return only assigned leads for agent role', async () => {
      // Skipped: vi.doMock doesn't work after module is loaded
      // This would require a separate test file with different middleware setup
    });
  });

  describe('POST /leads', () => {
    it('should create a new lead', async () => {
      const mockLead = {
        id: 'lead-123',
        fullName: 'John Doe',
        username: 'johndoe',
        email: 'john@example.com',
        platform: 'linkedin',
        status: 'new',
        score: 75,
        assignedTo: null,
        tags: [],
        socialProfiles: [],
        address: null,
      };

      vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.lead.create).mockResolvedValueOnce(mockLead);
      vi.mocked(prisma.activity.create).mockResolvedValueOnce({});

      const response = await request(app)
        .post('/api/v1/leads')
        .send({
          fullName: 'John Doe',
          username: 'johndoe',
          email: 'john@example.com',
          platform: 'linkedin',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fullName).toBe('John Doe');
      expect(prisma.lead.create).toHaveBeenCalled();
      expect(prisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'lead_created',
          }),
        })
      );
    });

    it('should update existing lead if found by email', async () => {
      const existingLead = {
        id: 'lead-existing',
        fullName: 'John Doe',
        email: 'john@example.com',
      };

      const updatedLead = {
        ...existingLead,
        username: 'johndoe',
        assignedTo: null,
        tags: [],
        socialProfiles: [],
        address: null,
      };

      vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(existingLead);
      vi.mocked(prisma.lead.update).mockResolvedValueOnce(updatedLead);
      vi.mocked(prisma.activity.create).mockResolvedValueOnce({});

      const response = await request(app)
        .post('/api/v1/leads')
        .send({
          fullName: 'John Doe',
          username: 'johndoe',
          email: 'john@example.com',
          platform: 'linkedin',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.lead.update).toHaveBeenCalled();
      expect(prisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'lead_updated',
            metadata: expect.objectContaining({
              merged: true,
            }),
          }),
        })
      );
    });

    it('should create lead with tags and address', async () => {
      const mockLead = {
        id: 'lead-123',
        fullName: 'John Doe',
        email: 'john@example.com',
        tags: [
          { tag: { id: 'tag-1', name: 'VIP', color: '#ff0000' } },
        ],
        address: { city: 'São Paulo', country: 'Brazil' },
        socialProfiles: [],
        assignedTo: null,
      };

      vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.lead.create).mockResolvedValueOnce(mockLead);
      vi.mocked(prisma.activity.create).mockResolvedValueOnce({});

      const response = await request(app)
        .post('/api/v1/leads')
        .send({
          fullName: 'John Doe',
          email: 'john@example.com',
          tags: ['tag-1'],
          address: {
            city: 'São Paulo',
            country: 'Brazil',
          },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(prisma.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tags: {
              create: [{ tagId: 'tag-1' }],
            },
            address: {
              create: {
                city: 'São Paulo',
                country: 'Brazil',
              },
            },
          }),
        })
      );
    });
  });

  describe('POST /leads/import', () => {
    it('should import leads in bulk', async () => {
      const mockLeads = [
        { id: 'lead-1', username: 'user1', profileUrl: 'linkedin:user1' },
        { id: 'lead-2', username: 'user2', profileUrl: 'linkedin:user2' },
      ];

      const mockImportJob = {
        id: 'job-123',
        status: 'processing',
      };

      vi.mocked(prisma.importJob.create).mockResolvedValueOnce(mockImportJob);
      vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      vi.mocked(prisma.lead.create).mockResolvedValueOnce(mockLeads[0]).mockResolvedValueOnce(mockLeads[1]);
      vi.mocked(prisma.importJob.update).mockResolvedValueOnce({
        ...mockImportJob,
        status: 'completed',
      });

      const response = await request(app)
        .post('/api/v1/leads/import')
        .send({
          platform: 'linkedin',
          sourceUrl: 'https://linkedin.com/search',
          leads: [
            { username: 'user1', fullName: 'User One' },
            { username: 'user2', fullName: 'User Two' },
          ],
        })
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBe('job-123');
      expect(response.body.data.status).toBe('completed');
      expect(response.body.data.result.imported).toBe(2);
      expect(prisma.importJob.create).toHaveBeenCalled();
      expect(prisma.importJob.update).toHaveBeenCalled();
    });

    it('should handle duplicates during import', async () => {
      const mockImportJob = { id: 'job-123', status: 'processing' };

      vi.mocked(prisma.importJob.create).mockResolvedValueOnce(mockImportJob);
      vi.mocked(prisma.lead.findFirst)
        .mockResolvedValueOnce({ id: 'existing-lead' })
        .mockResolvedValueOnce({ id: 'existing-lead' });
      vi.mocked(prisma.lead.update).mockResolvedValueOnce({ id: 'existing-lead' });
      vi.mocked(prisma.importJob.update).mockResolvedValueOnce({
        ...mockImportJob,
        status: 'completed',
      });

      const response = await request(app)
        .post('/api/v1/leads/import')
        .send({
          platform: 'linkedin',
          leads: [
            { username: 'user1', fullName: 'User One' },
            { username: 'user2', fullName: 'User Two' },
          ],
        })
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data.result.imported).toBe(2);
    });

    it('should track errors during import', async () => {
      const mockImportJob = { id: 'job-123', status: 'processing' };

      vi.mocked(prisma.importJob.create).mockResolvedValueOnce(mockImportJob);
      vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.lead.create).mockRejectedValueOnce(new Error('DB Error'));
      vi.mocked(prisma.importJob.update).mockResolvedValueOnce({
        ...mockImportJob,
        status: 'completed',
      });

      const response = await request(app)
        .post('/api/v1/leads/import')
        .send({
          platform: 'linkedin',
          leads: [{ username: 'user1', fullName: 'User One' }],
        })
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data.result.errors).toBe(1);
    });
  });

  describe('GET /leads/:id', () => {
    it('should return single lead with full details', async () => {
      const mockLead = {
        id: 'lead-123',
        fullName: 'John Doe',
        email: 'john@example.com',
        platform: 'linkedin',
        status: 'new',
        score: 75,
        assignedTo: null,
        tags: [
          { tag: { id: 'tag-1', name: 'VIP', color: '#ff0000' } },
        ],
        socialProfiles: [],
        behavior: null,
        address: null,
        activities: [],
        experiences: [],
        educations: [],
        certifications: [],
        skills: [],
        languages: [],
        recommendations: [],
        volunteers: [],
        publications: [],
        patents: [],
        projects: [],
        courses: [],
        honors: [],
        organizations: [],
        featured: [],
        contactInfo: null,
        leadPosts: [],
      };

      vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(mockLead);

      const response = await request(app)
        .get('/api/v1/leads/lead-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('lead-123');
      expect(response.body.data.fullName).toBe('John Doe');
      expect(response.body.data.tags).toHaveLength(1);
      expect(response.body.data.tags[0].name).toBe('VIP');
      expect(prisma.lead.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead-123', workspaceId: 'workspace-123' },
        })
      );
    });

    it('should return 404 for non-existent lead', async () => {
      vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/v1/leads/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /leads/:id', () => {
    it('should update lead', async () => {
      const existingLead = {
        id: 'lead-123',
        fullName: 'John Doe',
        status: 'new',
        score: 75,
        assignedToId: null,
      };

      const updatedLead = {
        ...existingLead,
        status: 'contacted',
        score: 80,
        assignedTo: null,
        tags: [],
        socialProfiles: [],
        address: null,
      };

      vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(existingLead);
      vi.mocked(prisma.lead.update).mockResolvedValueOnce(updatedLead);
      vi.mocked(prisma.scoringConfig.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.activity.create).mockResolvedValueOnce({});

      const response = await request(app)
        .patch('/api/v1/leads/lead-123')
        .send({
          status: 'contacted',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('contacted');
      expect(prisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead-123' },
          data: expect.objectContaining({
            status: 'contacted',
          }),
        })
      );
      expect(prisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'status_changed',
            metadata: { from: 'new', to: 'contacted' },
          }),
        })
      );
    });

    it('should update lead with address', async () => {
      const existingLead = {
        id: 'lead-123',
        fullName: 'John Doe',
      };

      const updatedLead = {
        id: 'lead-123',
        fullName: 'John Doe',
        address: {
          city: 'São Paulo',
          country: 'Brazil',
        },
        assignedTo: null,
        tags: [],
        socialProfiles: [],
      };

      vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(existingLead);
      vi.mocked(prisma.lead.update).mockResolvedValueOnce(updatedLead);
      vi.mocked(prisma.scoringConfig.findUnique).mockResolvedValueOnce(null);

      const response = await request(app)
        .patch('/api/v1/leads/lead-123')
        .send({
          address: {
            city: 'São Paulo',
            country: 'Brazil',
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            address: {
              upsert: {
                create: { city: 'São Paulo', country: 'Brazil' },
                update: { city: 'São Paulo', country: 'Brazil' },
              },
            },
          }),
        })
      );
    });

    it('should return 404 for non-existent lead', async () => {
      vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .patch('/api/v1/leads/non-existent')
        .send({ status: 'contacted' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it.skip('should prevent agent from updating unassigned leads', async () => {
      // Skipped: vi.doMock doesn't work after module is loaded
      // This would require a separate test file with different middleware setup
    });
  });

  describe('DELETE /leads/:id', () => {
    it('should delete lead', async () => {
      const mockLead = {
        id: 'lead-123',
        fullName: 'John Doe',
      };

      vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(mockLead);
      vi.mocked(prisma.lead.delete).mockResolvedValueOnce(mockLead);

      const response = await request(app)
        .delete('/api/v1/leads/lead-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.lead.delete).toHaveBeenCalledWith({
        where: { id: 'lead-123' },
      });
    });

    it('should return 404 for non-existent lead', async () => {
      vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .delete('/api/v1/leads/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /leads/:id/tags', () => {
    it('should add tags to lead', async () => {
      const mockLead = {
        id: 'lead-123',
        fullName: 'John Doe',
        tags: [
          { tag: { id: 'tag-1', name: 'VIP', color: '#ff0000' } },
          { tag: { id: 'tag-2', name: 'Hot', color: '#00ff00' } },
        ],
      };

      vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({ id: 'lead-123' });
      vi.mocked(prisma.leadTag.createMany).mockResolvedValueOnce({ count: 2 });
      vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(mockLead);

      const response = await request(app)
        .post('/api/v1/leads/lead-123/tags')
        .send({
          tagIds: ['tag-1', 'tag-2'],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tags).toHaveLength(2);
      expect(prisma.leadTag.createMany).toHaveBeenCalledWith({
        data: [
          { leadId: 'lead-123', tagId: 'tag-1' },
          { leadId: 'lead-123', tagId: 'tag-2' },
        ],
        skipDuplicates: true,
      });
    });

    it('should return 404 for non-existent lead', async () => {
      vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/v1/leads/non-existent/tags')
        .send({ tagIds: ['tag-1'] })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /leads/:id/tags/:tagId', () => {
    it('should remove tag from lead', async () => {
      const mockLead = {
        id: 'lead-123',
        fullName: 'John Doe',
      };

      vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(mockLead);
      vi.mocked(prisma.leadTag.delete).mockResolvedValueOnce({});
      vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({
        ...mockLead,
        assignedTo: null,
        tags: [],
        socialProfiles: [],
      });

      const response = await request(app)
        .delete('/api/v1/leads/lead-123/tags/tag-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.leadTag.delete).toHaveBeenCalledWith({
        where: { leadId_tagId: { leadId: 'lead-123', tagId: 'tag-1' } },
      });
    });

    it('should return 404 for non-existent lead', async () => {
      vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .delete('/api/v1/leads/non-existent/tags/tag-1')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /leads/:id/assign', () => {
    it('should assign lead to user', async () => {
      const existingLead = {
        id: 'lead-123',
        fullName: 'John Doe',
        assignedToId: null,
      };

      const updatedLead = {
        id: 'lead-123',
        fullName: 'John Doe',
        assignedToId: 'user-456',
        assignedTo: {
          id: 'user-456',
          fullName: 'Jane Smith',
          avatarUrl: null,
        },
      };

      vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(existingLead);
      vi.mocked(prisma.lead.update).mockResolvedValueOnce(updatedLead);
      vi.mocked(prisma.activity.create).mockResolvedValueOnce({});

      const response = await request(app)
        .post('/api/v1/leads/lead-123/assign')
        .send({
          userId: 'user-456',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assignedToId).toBe('user-456');
      expect(prisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead-123' },
          data: { assignedToId: 'user-456' },
        })
      );
      expect(prisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'assigned',
            metadata: { assignedTo: 'user-456' },
          }),
        })
      );
    });

    it('should return 404 for non-existent lead', async () => {
      vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/v1/leads/non-existent/assign')
        .send({ userId: 'user-456' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});
