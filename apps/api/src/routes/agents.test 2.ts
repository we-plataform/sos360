import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { agentsRouter } from './agents.js';

// Mock Prisma client
vi.mock('@lia360/database', () => ({
  prisma: {
    agent: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock authentication middleware
vi.mock('../middleware/auth.js', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { workspaceId: 'test-workspace-id', role: 'admin' };
    next();
  },
  authorize: (...roles: string[]) => (req: any, res: any, next: any) => next(),
}));

// Mock validation middleware
vi.mock('../middleware/validate.js', () => ({
  validate: (schema: any) => (req: any, res: any, next: any) => next(),
}));

// Mock NotFoundError
vi.mock('../lib/errors.js', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(public resourceName: string) {
      super(`${resourceName} not found`);
      this.name = 'NotFoundError';
    }
  },
}));

import { prisma } from '@lia360/database';

describe('Agent Routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/v1/agents', agentsRouter);
  });

  describe('GET /agents', () => {
    it('should list all agents in workspace', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          name: 'Social Seller Agent',
          type: 'SOCIAL_SELLER',
          systemPrompt: 'You are a social seller',
          temperature: 0.7,
          maxTokens: 500,
          model: 'gpt-4o-mini',
          enabled: true,
          workspaceId: 'test-workspace-id',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.agent.findMany).mockResolvedValueOnce(mockAgents);

      const response = await request(app)
        .get('/api/v1/agents')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAgents);
      expect(prisma.agent.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'test-workspace-id' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter agents by type', async () => {
      vi.mocked(prisma.agent.findMany).mockResolvedValueOnce([]);

      await request(app)
        .get('/api/v1/agents?type=SOCIAL_SELLER')
        .expect(200);

      expect(prisma.agent.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'test-workspace-id', type: 'SOCIAL_SELLER' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter agents by enabled status', async () => {
      vi.mocked(prisma.agent.findMany).mockResolvedValueOnce([]);

      await request(app)
        .get('/api/v1/agents?enabled=true')
        .expect(200);

      expect(prisma.agent.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'test-workspace-id', enabled: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter agents by enabled=false', async () => {
      vi.mocked(prisma.agent.findMany).mockResolvedValueOnce([]);

      await request(app)
        .get('/api/v1/agents?enabled=false')
        .expect(200);

      expect(prisma.agent.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'test-workspace-id', enabled: false },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should combine type and enabled filters', async () => {
      vi.mocked(prisma.agent.findMany).mockResolvedValueOnce([]);

      await request(app)
        .get('/api/v1/agents?type=SDR&enabled=true')
        .expect(200);

      expect(prisma.agent.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'test-workspace-id', type: 'SDR', enabled: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('POST /agents', () => {
    it('should create new agent with valid data', async () => {
      const newAgent = {
        id: 'agent-2',
        name: 'Test SDR Agent',
        type: 'SDR',
        systemPrompt: 'You are an SDR',
        temperature: 0.8,
        maxTokens: 600,
        model: 'gpt-4o-mini',
        enabled: true,
        workspaceId: 'test-workspace-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.agent.create).mockResolvedValueOnce(newAgent);

      const response = await request(app)
        .post('/api/v1/agents')
        .send({
          name: 'Test SDR Agent',
          type: 'SDR',
          systemPrompt: 'You are an SDR',
          temperature: 0.8,
          maxTokens: 600,
          model: 'gpt-4o-mini',
          enabled: true,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(newAgent);
      expect(prisma.agent.create).toHaveBeenCalledWith({
        data: {
          name: 'Test SDR Agent',
          type: 'SDR',
          systemPrompt: 'You are an SDR',
          temperature: 0.8,
          maxTokens: 600,
          model: 'gpt-4o-mini',
          enabled: true,
          workspaceId: 'test-workspace-id',
        },
      });
    });

    it('should apply default values for optional fields', async () => {
      const newAgent = {
        id: 'agent-3',
        name: 'Test Closer Agent',
        type: 'CLOSER',
        systemPrompt: 'You are a closer',
        temperature: 0.7,
        maxTokens: 500,
        model: 'gpt-4o-mini',
        enabled: true,
        workspaceId: 'test-workspace-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.agent.create).mockResolvedValueOnce(newAgent);

      const response = await request(app)
        .post('/api/v1/agents')
        .send({
          name: 'Test Closer Agent',
          type: 'CLOSER',
          systemPrompt: 'You are a closer',
        })
        .expect(201);

      expect(response.body.data.temperature).toBe(0.7);
      expect(response.body.data.maxTokens).toBe(500);
      expect(response.body.data.model).toBe('gpt-4o-mini');
      expect(response.body.data.enabled).toBe(true);
      expect(prisma.agent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          temperature: 0.7,
          maxTokens: 500,
          model: 'gpt-4o-mini',
          enabled: true,
        }),
      });
    });
  });

  describe('GET /agents/:id', () => {
    it('should return agent by id', async () => {
      const mockAgent = {
        id: 'agent-1',
        name: 'Social Seller Agent',
        type: 'SOCIAL_SELLER',
        systemPrompt: 'You are a social seller',
        temperature: 0.7,
        maxTokens: 500,
        model: 'gpt-4o-mini',
        enabled: true,
        workspaceId: 'test-workspace-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce(mockAgent);

      const response = await request(app)
        .get('/api/v1/agents/agent-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAgent);
      expect(prisma.agent.findFirst).toHaveBeenCalledWith({
        where: { id: 'agent-1', workspaceId: 'test-workspace-id' },
      });
    });

    it('should return 404 for non-existent agent', async () => {
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/v1/agents/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should block cross-workspace access via findFirst returning null', async () => {
      // Agent exists but belongs to different workspace - findFirst returns null
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce(null);

      await request(app)
        .get('/api/v1/agents/agent-from-other-workspace')
        .expect(404);

      expect(prisma.agent.findFirst).toHaveBeenCalledWith({
        where: { id: 'agent-from-other-workspace', workspaceId: 'test-workspace-id' },
      });
    });
  });

  describe('PATCH /agents/:id', () => {
    it('should update agent with valid data', async () => {
      const existingAgent = {
        id: 'agent-1',
        name: 'Old Name',
        type: 'SOCIAL_SELLER',
        systemPrompt: 'Old prompt',
        temperature: 0.7,
        maxTokens: 500,
        model: 'gpt-4o-mini',
        enabled: true,
        workspaceId: 'test-workspace-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedAgent = {
        ...existingAgent,
        name: 'Updated Name',
        systemPrompt: 'Updated prompt',
      };

      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce(existingAgent);
      vi.mocked(prisma.agent.update).mockResolvedValueOnce(updatedAgent);

      const response = await request(app)
        .patch('/api/v1/agents/agent-1')
        .send({
          name: 'Updated Name',
          systemPrompt: 'Updated prompt',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
      expect(prisma.agent.findFirst).toHaveBeenCalledWith({
        where: { id: 'agent-1', workspaceId: 'test-workspace-id' },
      });
      expect(prisma.agent.update).toHaveBeenCalledWith({
        where: { id: 'agent-1' },
        data: { name: 'Updated Name', systemPrompt: 'Updated prompt' },
      });
    });

    it('should return 404 for non-existent agent', async () => {
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .patch('/api/v1/agents/non-existent')
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(prisma.agent.update).not.toHaveBeenCalled();
    });

    it('should block cross-workspace updates via findFirst returning null', async () => {
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce(null);

      await request(app)
        .patch('/api/v1/agents/agent-from-other-workspace')
        .send({ name: 'Hacked Name' })
        .expect(404);

      expect(prisma.agent.findFirst).toHaveBeenCalledWith({
        where: { id: 'agent-from-other-workspace', workspaceId: 'test-workspace-id' },
      });
      expect(prisma.agent.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /agents/:id', () => {
    it('should delete agent', async () => {
      const existingAgent = {
        id: 'agent-1',
        name: 'To Delete',
        type: 'SOCIAL_SELLER',
        systemPrompt: 'Prompt',
        temperature: 0.7,
        maxTokens: 500,
        model: 'gpt-4o-mini',
        enabled: true,
        workspaceId: 'test-workspace-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce(existingAgent);
      vi.mocked(prisma.agent.delete).mockResolvedValueOnce(existingAgent);

      const response = await request(app)
        .delete('/api/v1/agents/agent-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Agent removido com sucesso');
      expect(prisma.agent.findFirst).toHaveBeenCalledWith({
        where: { id: 'agent-1', workspaceId: 'test-workspace-id' },
      });
      expect(prisma.agent.delete).toHaveBeenCalledWith({
        where: { id: 'agent-1' },
      });
    });

    it('should return 404 for non-existent agent', async () => {
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .delete('/api/v1/agents/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(prisma.agent.delete).not.toHaveBeenCalled();
    });

    it('should block cross-workspace deletions via findFirst returning null', async () => {
      vi.mocked(prisma.agent.findFirst).mockResolvedValueOnce(null);

      await request(app)
        .delete('/api/v1/agents/agent-from-other-workspace')
        .expect(404);

      expect(prisma.agent.findFirst).toHaveBeenCalledWith({
        where: { id: 'agent-from-other-workspace', workspaceId: 'test-workspace-id' },
      });
      expect(prisma.agent.delete).not.toHaveBeenCalled();
    });
  });
});
