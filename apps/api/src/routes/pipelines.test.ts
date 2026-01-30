import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { pipelinesRouter } from './pipelines.js';

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
app.use('/api/v1/pipelines', pipelinesRouter);

// Error handler to catch errors (must be after routes)
app.use((err: any, _req: any, res: any, _next: any) => {
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message,
  });
});

describe('Pipelines API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /pipelines', () => {
    it('should return list of pipelines for workspace', async () => {
      const mockPipelines = [
        {
          id: 'pipeline-1',
          name: 'Sales Pipeline',
          description: 'Main sales pipeline',
          isDefault: true,
          createdAt: new Date('2024-01-01'),
          stages: [
            {
              id: 'stage-1',
              name: 'New Leads',
              color: '#6366F1',
              order: 0,
              _count: { leads: 5 },
              automations: [],
            },
            {
              id: 'stage-2',
              name: 'Contacted',
              color: '#10B981',
              order: 1,
              _count: { leads: 3 },
              automations: [{ id: 'auto-1', enabled: true }],
            },
          ],
        },
      ];

      vi.mocked(prisma.pipeline.findMany).mockResolvedValueOnce(mockPipelines as any);

      const response = await request(app)
        .get('/api/v1/pipelines')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Sales Pipeline');
      expect(response.body.data[0].stages).toHaveLength(2);
      expect(response.body.data[0].stages[0].leadCount).toBe(5);
      expect(prisma.pipeline.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'workspace-123' },
        include: {
          stages: {
            orderBy: { order: 'asc' },
            include: {
              _count: {
                select: { leads: true },
              },
              automations: {
                where: { enabled: true },
              },
            },
          },
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
    });

    it('should return empty array when no pipelines exist', async () => {
      vi.mocked(prisma.pipeline.findMany).mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/v1/pipelines')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('GET /pipelines/:id', () => {
    it('should return single pipeline with leads', async () => {
      const mockPipeline = {
        id: 'pipeline-1',
        name: 'Sales Pipeline',
        description: 'Main sales pipeline',
        stages: [
          {
            id: 'stage-1',
            name: 'New Leads',
            order: 0,
            automations: [],
            leads: [
              {
                id: 'lead-1',
                fullName: 'John Doe',
                username: 'johndoe',
                avatarUrl: 'https://example.com/avatar.jpg',
                email: 'john@example.com',
                phone: '+1234567890',
                followersCount: 1000,
                connectionCount: 500,
                status: 'new',
                score: 75,
                verified: true,
                platform: 'linkedin',
                position: 0,
                assignedTo: null,
                socialProfiles: [
                  { platform: 'linkedin', profileUrl: 'https://linkedin.com/in/johndoe', followersCount: 1000 },
                ],
              },
            ],
          },
        ],
      };

      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(mockPipeline as any);

      const response = await request(app)
        .get('/api/v1/pipelines/pipeline-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('pipeline-1');
      expect(response.body.data.stages).toHaveLength(1);
      expect(response.body.data.stages[0].leads).toHaveLength(1);
      expect(prisma.pipeline.findFirst).toHaveBeenCalledWith({
        where: { id: 'pipeline-1', workspaceId: 'workspace-123' },
        include: {
          stages: {
            orderBy: { order: 'asc' },
            include: {
              automations: true,
              leads: {
                where: undefined,
                orderBy: { position: 'asc' },
                select: expect.any(Object),
              },
            },
          },
        },
      });
    });

    it('should filter leads by score range', async () => {
      const mockPipeline = {
        id: 'pipeline-1',
        name: 'Sales Pipeline',
        stages: [{ id: 'stage-1', name: 'New', order: 0, automations: [], leads: [] }],
      };

      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(mockPipeline as any);

      await request(app)
        .get('/api/v1/pipelines/pipeline-1?scoreMin=50&scoreMax=80')
        .expect(200);

      const whereClause = vi.mocked(prisma.pipeline.findFirst).mock.calls[0][0].include.stages.include.leads.where;
      expect(whereClause).toEqual({
        score: { gte: 50, lte: 80 },
      });
    });

    it('should return 404 when pipeline not found', async () => {
      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/v1/pipelines/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /pipelines', () => {
    it('should create new pipeline with custom stages', async () => {
      const mockPipeline = {
        id: 'pipeline-new',
        name: 'New Pipeline',
        description: 'A new pipeline',
        isDefault: false,
        stages: [
          { id: 'stage-1', name: 'Stage 1', color: '#6366F1', order: 0 },
          { id: 'stage-2', name: 'Stage 2', color: '#10B981', order: 1 },
        ],
      };

      vi.mocked(prisma.pipeline.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.pipeline.create).mockResolvedValueOnce(mockPipeline as any);

      const response = await request(app)
        .post('/api/v1/pipelines')
        .send({
          name: 'New Pipeline',
          description: 'A new pipeline',
          stages: [
            { name: 'Stage 1', color: '#6366F1' },
            { name: 'Stage 2', color: '#10B981' },
          ],
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Pipeline');
      expect(prisma.pipeline.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'New Pipeline',
          description: 'A new pipeline',
          workspaceId: 'workspace-123',
          isDefault: false,
        }),
        include: {
          stages: {
            orderBy: { order: 'asc' },
          },
        },
      });
    });

    it('should create default pipeline when first pipeline', async () => {
      const mockPipeline = {
        id: 'pipeline-default',
        name: 'Default Pipeline',
        isDefault: true,
        stages: [
          { id: 'stage-1', name: '01 - Leads Qualificados', color: '#F59E0B', order: 0 },
        ],
      };

      vi.mocked(prisma.pipeline.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.pipeline.create).mockResolvedValueOnce(mockPipeline as any);

      const response = await request(app)
        .post('/api/v1/pipelines')
        .send({ name: 'Default Pipeline' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isDefault).toBe(true);
      expect(prisma.pipeline.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isDefault: true,
        }),
        include: expect.any(Object),
      });
    });

    it('should create pipeline with default stages when none provided', async () => {
      const mockPipeline = {
        id: 'pipeline-default',
        name: 'New Pipeline',
        isDefault: false,
        stages: [
          { id: 'stage-1', name: '01 - Leads Qualificados', color: '#F59E0B', order: 0 },
        ],
      };

      vi.mocked(prisma.pipeline.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.pipeline.create).mockResolvedValueOnce(mockPipeline as any);

      await request(app)
        .post('/api/v1/pipelines')
        .send({ name: 'New Pipeline' })
        .expect(201);

      const createCall = vi.mocked(prisma.pipeline.create).mock.calls[0];
      expect(createCall[0].data.stages).toBeDefined();
    });
  });

  describe('PATCH /pipelines/:id', () => {
    it('should update pipeline', async () => {
      const mockExisting = {
        id: 'pipeline-1',
        name: 'Old Name',
        workspaceId: 'workspace-123',
      };

      const mockUpdated = {
        id: 'pipeline-1',
        name: 'Updated Name',
        description: 'Updated description',
        stages: [],
      };

      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(mockExisting as any);
      vi.mocked(prisma.pipeline.update).mockResolvedValueOnce(mockUpdated as any);

      const response = await request(app)
        .patch('/api/v1/pipelines/pipeline-1')
        .send({
          name: 'Updated Name',
          description: 'Updated description',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
      expect(prisma.pipeline.update).toHaveBeenCalledWith({
        where: { id: 'pipeline-1' },
        data: {
          name: 'Updated Name',
          description: 'Updated description',
        },
        include: {
          stages: {
            orderBy: { order: 'asc' },
          },
        },
      });
    });

    it('should return 404 when pipeline not found', async () => {
      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .patch('/api/v1/pipelines/nonexistent')
        .send({ name: 'New Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /pipelines/:id', () => {
    it('should delete pipeline', async () => {
      const mockPipeline = {
        id: 'pipeline-1',
        name: 'Pipeline to Delete',
        isDefault: false,
      };

      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(mockPipeline as any);
      vi.mocked(prisma.pipeline.delete).mockResolvedValueOnce(mockPipeline as any);

      const response = await request(app)
        .delete('/api/v1/pipelines/pipeline-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.pipeline.delete).toHaveBeenCalledWith({
        where: { id: 'pipeline-1' },
      });
    });

    it('should not delete default pipeline', async () => {
      const mockPipeline = {
        id: 'pipeline-1',
        name: 'Default Pipeline',
        isDefault: true,
      };

      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(mockPipeline as any);

      const response = await request(app)
        .delete('/api/v1/pipelines/pipeline-1')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/não é possível deletar/i);
    });

    it('should return 404 when pipeline not found', async () => {
      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .delete('/api/v1/pipelines/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /pipelines/:id/stages', () => {
    it('should add stage to pipeline', async () => {
      const mockPipeline = {
        id: 'pipeline-1',
        stages: [{ id: 'stage-1', name: 'Existing', order: 0 }],
      };

      const mockNewStage = {
        id: 'stage-new',
        name: 'New Stage',
        color: '#6366F1',
        order: 1,
      };

      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(mockPipeline as any);
      vi.mocked(prisma.pipelineStage.create).mockResolvedValueOnce(mockNewStage as any);

      const response = await request(app)
        .post('/api/v1/pipelines/pipeline-1/stages')
        .send({
          name: 'New Stage',
          color: '#6366F1',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Stage');
      expect(prisma.pipelineStage.create).toHaveBeenCalledWith({
        data: {
          name: 'New Stage',
          color: '#6366F1',
          order: 1,
          pipelineId: 'pipeline-1',
        },
      });
    });

    it('should use default color when not provided', async () => {
      const mockPipeline = {
        id: 'pipeline-1',
        stages: [],
      };

      const mockNewStage = {
        id: 'stage-new',
        name: 'New Stage',
        color: '#6366F1',
        order: 0,
      };

      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(mockPipeline as any);
      vi.mocked(prisma.pipelineStage.create).mockResolvedValueOnce(mockNewStage as any);

      await request(app)
        .post('/api/v1/pipelines/pipeline-1/stages')
        .send({ name: 'New Stage' })
        .expect(201);

      expect(prisma.pipelineStage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          color: '#6366F1',
        }),
      });
    });

    it('should return 404 when pipeline not found', async () => {
      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/v1/pipelines/nonexistent/stages')
        .send({ name: 'New Stage' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /pipelines/:id/stages/reorder', () => {
    it('should reorder stages', async () => {
      const mockPipeline = {
        id: 'pipeline-1',
        stages: [
          { id: 'stage-1', name: 'Stage 1', order: 0 },
          { id: 'stage-2', name: 'Stage 2', order: 1 },
        ],
      };

      const mockUpdatedPipeline = {
        id: 'pipeline-1',
        stages: [
          { id: 'stage-2', name: 'Stage 2', order: 0 },
          { id: 'stage-1', name: 'Stage 1', order: 1 },
        ],
      };

      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(mockPipeline as any);
      vi.mocked(prisma.$transaction).mockResolvedValueOnce(undefined as any);
      vi.mocked(prisma.pipeline.findUnique).mockResolvedValueOnce(mockUpdatedPipeline as any);

      const response = await request(app)
        .patch('/api/v1/pipelines/pipeline-1/stages/reorder')
        .send({
          stages: [
            { id: 'stage-2', order: 0 },
            { id: 'stage-1', order: 1 },
          ],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.pipelineStage.update).toHaveBeenCalledTimes(2);
    });

    it('should return 404 when pipeline not found', async () => {
      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .patch('/api/v1/pipelines/nonexistent/stages/reorder')
        .send({ stages: [] })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /pipelines/:id/stages/:stageId', () => {
    it('should update stage', async () => {
      const mockPipeline = {
        id: 'pipeline-1',
        name: 'Pipeline',
      };

      const mockUpdatedStage = {
        id: 'stage-1',
        name: 'Updated Stage',
        color: '#10B981',
      };

      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(mockPipeline as any);
      vi.mocked(prisma.pipelineStage.update).mockResolvedValueOnce(mockUpdatedStage as any);

      const response = await request(app)
        .patch('/api/v1/pipelines/pipeline-1/stages/stage-1')
        .send({
          name: 'Updated Stage',
          color: '#10B981',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Stage');
      expect(prisma.pipelineStage.update).toHaveBeenCalledWith({
        where: { id: 'stage-1' },
        data: {
          name: 'Updated Stage',
          color: '#10B981',
        },
      });
    });

    it('should return 404 when pipeline not found', async () => {
      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .patch('/api/v1/pipelines/nonexistent/stages/stage-1')
        .send({ name: 'New Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /pipelines/:id/stages/:stageId', () => {
    it('should delete stage', async () => {
      const mockPipeline = {
        id: 'pipeline-1',
        stages: [
          { id: 'stage-1', name: 'Stage 1' },
          { id: 'stage-2', name: 'Stage 2' },
        ],
      };

      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(mockPipeline as any);
      vi.mocked(prisma.lead.updateMany).mockResolvedValueOnce({ count: 5 } as any);
      vi.mocked(prisma.pipelineStage.delete).mockResolvedValueOnce({ id: 'stage-2' } as any);

      const response = await request(app)
        .delete('/api/v1/pipelines/pipeline-1/stages/stage-2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.pipelineStage.delete).toHaveBeenCalledWith({
        where: { id: 'stage-2' },
      });
    });

    it('should not delete last stage', async () => {
      const mockPipeline = {
        id: 'pipeline-1',
        stages: [{ id: 'stage-1', name: 'Only Stage' }],
      };

      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(mockPipeline as any);

      const response = await request(app)
        .delete('/api/v1/pipelines/pipeline-1/stages/stage-1')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/pelo menos um estágio/i);
    });

    it('should return 404 when pipeline not found', async () => {
      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .delete('/api/v1/pipelines/nonexistent/stages/stage-1')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /pipelines/:id/leads/move', () => {
    it('should move lead to stage', async () => {
      const mockPipeline = { id: 'pipeline-1' };
      const mockLead = {
        id: 'lead-1',
        fullName: 'John Doe',
        pipelineStageId: 'stage-new',
        position: 5,
      };

      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(mockPipeline as any);
      vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(mockLead as any);
      vi.mocked(prisma.lead.update).mockResolvedValueOnce(mockLead as any);

      const mockIo = {
        to: vi.fn().mockReturnThis(),
        emit: vi.fn(),
      };

      const appWithIo = express();
      appWithIo.use(express.json());
      appWithIo.set('io', mockIo);
      appWithIo.use('/api/v1/pipelines', pipelinesRouter);

      const response = await request(appWithIo)
        .post('/api/v1/pipelines/pipeline-1/leads/move')
        .send({
          leadId: 'lead-1',
          stageId: 'stage-new',
          position: 5,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: {
          pipelineStageId: 'stage-new',
          position: 5,
        },
        include: expect.any(Object),
      });
      expect(mockIo.to).toHaveBeenCalledWith('workspace:workspace-123');
      expect(mockIo.emit).toHaveBeenCalledWith('lead:moved', expect.objectContaining({
        leadId: 'lead-1',
        stageId: 'stage-new',
        position: 5,
      }));
    });

    it('should return 404 when pipeline not found', async () => {
      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/v1/pipelines/nonexistent/leads/move')
        .send({
          leadId: 'lead-1',
          stageId: 'stage-1',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 when lead not found', async () => {
      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce({ id: 'pipeline-1' } as any);
      vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/v1/pipelines/pipeline-1/leads/move')
        .send({
          leadId: 'lead-1',
          stageId: 'stage-1',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /pipelines/:id/migrate', () => {
    it('should migrate leads from status to stages', async () => {
      const mockPipeline = {
        id: 'pipeline-1',
        stages: [
          { id: 'stage-1', name: 'Novo' },
          { id: 'stage-2', name: 'Contatado' },
        ],
      };

      const mockLeads = [
        { id: 'lead-1', status: 'new' },
        { id: 'lead-2', status: 'contacted' },
      ];

      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(mockPipeline as any);
      vi.mocked(prisma.lead.findMany).mockResolvedValueOnce(mockLeads as any);
      vi.mocked(prisma.lead.updateMany).mockResolvedValueOnce({ count: 2 } as any);

      const response = await request(app)
        .post('/api/v1/pipelines/pipeline-1/migrate')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalMigrated).toBe(2);
      expect(prisma.lead.updateMany).toHaveBeenCalled();
    });

    it('should return 404 when pipeline not found', async () => {
      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/v1/pipelines/nonexistent/migrate')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should handle no leads to migrate', async () => {
      const mockPipeline = {
        id: 'pipeline-1',
        stages: [{ id: 'stage-1', name: 'Novo' }],
      };

      vi.mocked(prisma.pipeline.findFirst).mockResolvedValueOnce(mockPipeline as any);
      vi.mocked(prisma.lead.findMany).mockResolvedValueOnce([]);

      const response = await request(app)
        .post('/api/v1/pipelines/pipeline-1/migrate')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalMigrated).toBe(0);
    });
  });
});
