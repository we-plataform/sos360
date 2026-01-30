import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { automationsRouter } from './automations.js';

// Mock dependencies
vi.mock('@lia360/database', () => ({
  prisma: {
    pipelineStage: {
      findFirst: vi.fn(),
    },
    automation: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    lead: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    automationLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    agent: {
      findFirst: vi.fn(),
    },
  },
}));
vi.mock('../lib/openai.js', () => ({
  generateMessage: vi.fn(),
}));
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

import { prisma } from '@lia360/database';
import { generateMessage } from '../lib/openai.js';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/v1/automations', automationsRouter);

// Error handler to catch errors (must be after routes)
app.use((err: any, _req: any, res: any, _next: any) => {
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message,
    type: err.type,
  });
});

describe('Automations API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /automations', () => {
    it('should create automation', async () => {
      const mockStage = {
        id: 'stage-123',
        name: 'New Leads',
        pipelineId: 'pipeline-123',
      };

      const mockAutomation = {
        id: 'automation-123',
        name: 'Test Automation',
        pipelineStageId: 'stage-123',
        workspaceId: 'workspace-123',
        enabled: true,
        actions: [
          {
            type: 'connection_request',
            config: { template: 'Hello!' },
          },
        ],
        triggerType: 'manual',
        triggerConfig: {},
        createdById: 'user-123',
      };

      (prisma.pipelineStage.findFirst as any).mockResolvedValueOnce(mockStage as any);
      (prisma.automation.findFirst as any).mockResolvedValueOnce(null as any);
      (prisma.automation.create as any).mockResolvedValueOnce(mockAutomation as any);

      const response = await request(app)
        .post('/api/v1/automations')
        .send({
          pipelineStageId: 'stage-123',
          name: 'Test Automation',
          actions: [
            {
              type: 'connection_request',
              config: { template: 'Hello!' },
            },
          ],
          enabled: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Automation');
      expect(prisma.automation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Test Automation',
            workspaceId: 'workspace-123',
          }),
        })
      );
    });

    it('should update existing automation', async () => {
      const mockStage = {
        id: 'stage-123',
        name: 'New Leads',
        pipelineId: 'pipeline-123',
      };

      const mockExistingAutomation = {
        id: 'automation-123',
        name: 'Old Automation',
        pipelineStageId: 'stage-123',
        workspaceId: 'workspace-123',
      };

      const mockUpdatedAutomation = {
        id: 'automation-123',
        name: 'Updated Automation',
        pipelineStageId: 'stage-123',
        workspaceId: 'workspace-123',
        enabled: true,
        actions: [
          {
            type: 'send_message',
            config: { template: 'Hi there!' },
          },
        ],
        triggerType: 'manual',
        triggerConfig: {},
      };

      (prisma.pipelineStage.findFirst as any).mockResolvedValueOnce(mockStage as any);
      (prisma.automation.findFirst as any).mockResolvedValueOnce(mockExistingAutomation as any);
      (prisma.automation.update as any).mockResolvedValueOnce(mockUpdatedAutomation as any);

      const response = await request(app)
        .post('/api/v1/automations')
        .send({
          pipelineStageId: 'stage-123',
          name: 'Updated Automation',
          actions: [
            {
              type: 'send_message',
              config: { template: 'Hi there!' },
            },
          ],
          enabled: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Automation');
      expect(prisma.automation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'automation-123' },
          data: expect.objectContaining({
            name: 'Updated Automation',
          }),
        })
      );
    });

    it('should return 404 when stage not found', async () => {
      (prisma.pipelineStage.findFirst as any).mockResolvedValueOnce(null as any);

      const response = await request(app)
        .post('/api/v1/automations')
        .send({
          pipelineStageId: 'nonexistent-stage',
          name: 'Test Automation',
          actions: [],
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /automations/:id/trigger', () => {
    it('should trigger automation and queue job', async () => {
      const mockAutomation = {
        id: 'automation-123',
        name: 'Test Automation',
        pipelineStageId: 'stage-123',
        enabled: true,
        actions: [
          {
            type: 'connection_request',
            config: { template: 'Hello!' },
          },
        ],
        pipelineStage: {
          id: 'stage-123',
          name: 'New Leads',
        },
      };

      const mockLeads = [
        {
          id: 'lead-1',
          profileUrl: 'https://linkedin.com/in/user1',
          fullName: 'John Doe',
          username: 'johndoe',
          platform: 'linkedin',
          avatarUrl: 'https://example.com/avatar.jpg',
          bio: 'Test bio',
        },
      ];

      const mockJob = {
        id: 'job-123',
        automationId: 'automation-123',
        status: 'pending',
        result: {},
      };

      (prisma.automation.findFirst as any).mockResolvedValueOnce(mockAutomation as any);
      (prisma.lead.findMany as any).mockResolvedValueOnce(mockLeads as any);
      (prisma.automationLog.create as any).mockResolvedValueOnce(mockJob as any);

      const response = await request(app)
        .post('/api/v1/automations/automation-123/trigger')
        .send({ maxLeads: 10, interval: '60-90' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('1 leads');
      expect(response.body.data.jobId).toBe('job-123');
    });

    it('should return 404 when automation not found', async () => {
      (prisma.automation.findFirst as any).mockResolvedValueOnce(null as any);

      const response = await request(app)
        .post('/api/v1/automations/nonexistent/trigger')
        .send({ maxLeads: 10 })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return error when no valid leads', async () => {
      const mockAutomation = {
        id: 'automation-123',
        name: 'Test Automation',
        pipelineStageId: 'stage-123',
        enabled: true,
        actions: [],
        pipelineStage: {
          id: 'stage-123',
          name: 'New Leads',
        },
      };

      (prisma.automation.findFirst as any).mockResolvedValueOnce(mockAutomation as any);
      (prisma.lead.findMany as any).mockResolvedValueOnce([]);

      const response = await request(app)
        .post('/api/v1/automations/automation-123/trigger')
        .send({ maxLeads: 10 })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.error.detail).toContain('No leads with valid profile URLs');
    });
  });

  describe('GET /automations/jobs', () => {
    it('should return pending jobs', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          status: 'pending',
          startedAt: new Date(),
          automation: {
            id: 'automation-123',
            name: 'Test Automation',
          },
        },
        {
          id: 'job-2',
          status: 'pending',
          startedAt: new Date(),
          automation: {
            id: 'automation-456',
            name: 'Another Automation',
          },
        },
      ];

      (prisma.automationLog.findMany as any).mockResolvedValueOnce(mockJobs as any);

      const response = await request(app)
        .get('/api/v1/automations/jobs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].id).toBe('job-1');
    });

    it('should return empty array when no pending jobs', async () => {
      (prisma.automationLog.findMany as any).mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/v1/automations/jobs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('PATCH /automations/jobs/:id', () => {
    it('should update job status to success', async () => {
      const mockJob = {
        id: 'job-123',
        status: 'success',
        result: { processed: 5 },
        completedAt: new Date(),
      };

      (prisma.automationLog.update as any).mockResolvedValueOnce(mockJob as any);

      const response = await request(app)
        .patch('/api/v1/automations/jobs/job-123')
        .send({ status: 'COMPLETED', result: { processed: 5 } })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('success');
      expect(prisma.automationLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job-123' },
          data: expect.objectContaining({
            status: 'success',
          }),
        })
      );
    });

    it('should normalize status values', async () => {
      const mockJob = {
        id: 'job-123',
        status: 'failed',
        result: { error: 'Failed' },
        completedAt: new Date(),
      };

      (prisma.automationLog.update as any).mockResolvedValueOnce(mockJob as any);

      await request(app)
        .patch('/api/v1/automations/jobs/job-123')
        .send({ status: 'FAILED' })
        .expect(200);

      expect(prisma.automationLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'failed',
          }),
        })
      );
    });
  });

  describe('POST /automations/generate-message', () => {
    it('should generate AI message for lead', async () => {
      const mockAgent = {
        id: 'agent-123',
        systemPrompt: 'You are a helpful assistant',
        temperature: 0.7,
        maxTokens: 1000,
        model: 'gpt-4o-mini',
        type: 'SDR',
        enabled: true,
      };

      const mockLead = {
        id: 'lead-123',
        username: 'johndoe',
        fullName: 'John Doe',
        profileUrl: 'https://linkedin.com/in/johndoe',
        avatarUrl: 'https://example.com/avatar.jpg',
        bio: 'Software Engineer',
        platform: 'linkedin',
        location: 'San Francisco',
        followersCount: 1000,
        followingCount: 500,
        headline: 'Senior Developer',
        company: 'Tech Corp',
        industry: 'Technology',
        connectionCount: 500,
      };

      const mockGeneratedMessage = {
        message: 'Hi John, I noticed your work at Tech Corp...',
        tone: 'professional',
      };

      (prisma.agent.findFirst as any).mockResolvedValueOnce(mockAgent as any);
      (prisma.lead.findFirst as any).mockResolvedValueOnce(mockLead as any);
      (generateMessage as any).mockResolvedValueOnce(mockGeneratedMessage);

      const response = await request(app)
        .post('/api/v1/automations/generate-message')
        .send({
          agentId: 'agent-123',
          leadId: 'lead-123',
          messageType: 'first_message',
          context: 'Sales outreach',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('John');
      expect(generateMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: 'You are a helpful assistant',
        }),
        expect.objectContaining({
          fullName: 'John Doe',
        }),
        'first_message',
        'Sales outreach'
      );
    });

    it('should return 404 when agent not found', async () => {
      (prisma.agent.findFirst as any).mockResolvedValueOnce(null as any);

      const response = await request(app)
        .post('/api/v1/automations/generate-message')
        .send({
          agentId: 'nonexistent-agent',
          leadId: 'lead-123',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.title).toBe('Agent not found');
    });

    it('should return 404 when lead not found', async () => {
      const mockAgent = {
        id: 'agent-123',
        systemPrompt: 'You are a helpful assistant',
        temperature: 0.7,
        maxTokens: 1000,
        model: 'gpt-4o-mini',
        type: 'SDR',
        enabled: true,
      };

      (prisma.agent.findFirst as any).mockResolvedValueOnce(mockAgent as any);
      (prisma.lead.findFirst as any).mockResolvedValueOnce(null as any);

      const response = await request(app)
        .post('/api/v1/automations/generate-message')
        .send({
          agentId: 'agent-123',
          leadId: 'nonexistent-lead',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.title).toBe('Lead not found');
    });
  });
});
