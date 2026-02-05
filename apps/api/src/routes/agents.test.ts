import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { agentsRouter } from './agents.js';

// Mock dependencies
vi.mock('@lia360/database', () => ({
  prisma: {
    agent: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
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

// Create test app
const app = express();
app.use(express.json());
app.use('/api/v1/agents', agentsRouter);

// Error handler to catch errors (must be after routes)
app.use((err: any, _req: any, res: any, _next: any) => {
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message,
    type: err.type,
  });
});

describe('Agents API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /agents', () => {
    it('should return list of agents', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          name: 'Sales Agent',
          type: 'SDR',
          systemPrompt: 'You are a helpful sales agent',
          temperature: 0.7,
          maxTokens: 500,
          model: 'gpt-4o-mini',
          enabled: true,
          workspaceId: 'workspace-123',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'agent-2',
          name: 'Closer Agent',
          type: 'CLOSER',
          systemPrompt: 'You are a closer agent',
          temperature: 0.8,
          maxTokens: 1000,
          model: 'gpt-4o',
          enabled: true,
          workspaceId: 'workspace-123',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ];

      (prisma.agent.findMany as any).mockResolvedValueOnce(mockAgents);

      const response = await request(app)
        .get('/api/v1/agents')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('Sales Agent');
      expect(response.body.data[1].name).toBe('Closer Agent');
      expect(prisma.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: 'workspace-123' },
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should filter agents by type', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          name: 'Sales Agent',
          type: 'SDR',
          systemPrompt: 'You are a helpful sales agent',
          temperature: 0.7,
          maxTokens: 500,
          model: 'gpt-4o-mini',
          enabled: true,
          workspaceId: 'workspace-123',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.agent.findMany as any).mockResolvedValueOnce(mockAgents);

      const response = await request(app)
        .get('/api/v1/agents?type=SDR')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(prisma.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: 'workspace-123', type: 'SDR' },
        })
      );
    });

    it('should filter agents by enabled status', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          name: 'Sales Agent',
          type: 'SDR',
          systemPrompt: 'You are a helpful sales agent',
          temperature: 0.7,
          maxTokens: 500,
          model: 'gpt-4o-mini',
          enabled: true,
          workspaceId: 'workspace-123',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.agent.findMany as any).mockResolvedValueOnce(mockAgents);

      const response = await request(app)
        .get('/api/v1/agents?enabled=true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: 'workspace-123', enabled: true },
        })
      );
    });

    it('should filter by both type and enabled', async () => {
      (prisma.agent.findMany as any).mockResolvedValueOnce([]);

      await request(app)
        .get('/api/v1/agents?type=CLOSER&enabled=false')
        .expect(200);

      expect(prisma.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: 'workspace-123', type: 'CLOSER', enabled: false },
        })
      );
    });

    it('should return empty array when no agents found', async () => {
      (prisma.agent.findMany as any).mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/v1/agents')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('POST /agents', () => {
    it('should create a new agent', async () => {
      const mockAgent = {
        id: 'agent-123',
        name: 'Test Agent',
        type: 'SDR',
        systemPrompt: 'You are a helpful assistant',
        temperature: 0.7,
        maxTokens: 500,
        model: 'gpt-4o-mini',
        enabled: true,
        workspaceId: 'workspace-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.agent.create as any).mockResolvedValueOnce(mockAgent);

      const response = await request(app)
        .post('/api/v1/agents')
        .send({
          name: 'Test Agent',
          type: 'SDR',
          systemPrompt: 'You are a helpful assistant',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Agent');
      expect(response.body.data.type).toBe('SDR');
      expect(response.body.data.temperature).toBe(0.7);
      expect(response.body.data.maxTokens).toBe(500);
      expect(response.body.data.model).toBe('gpt-4o-mini');
      expect(response.body.data.enabled).toBe(true);
      expect(prisma.agent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Test Agent',
            type: 'SDR',
            systemPrompt: 'You are a helpful assistant',
            workspaceId: 'workspace-123',
          }),
        })
      );
    });

    it('should create agent with custom parameters', async () => {
      const mockAgent = {
        id: 'agent-123',
        name: 'Custom Agent',
        type: 'CLOSER',
        systemPrompt: 'You are a closer',
        temperature: 0.9,
        maxTokens: 2000,
        model: 'gpt-4o',
        enabled: false,
        workspaceId: 'workspace-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.agent.create as any).mockResolvedValueOnce(mockAgent);

      const response = await request(app)
        .post('/api/v1/agents')
        .send({
          name: 'Custom Agent',
          type: 'CLOSER',
          systemPrompt: 'You are a closer',
          temperature: 0.9,
          maxTokens: 2000,
          model: 'gpt-4o',
          enabled: false,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.temperature).toBe(0.9);
      expect(response.body.data.maxTokens).toBe(2000);
      expect(response.body.data.model).toBe('gpt-4o');
      expect(response.body.data.enabled).toBe(false);
      expect(prisma.agent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            temperature: 0.9,
            maxTokens: 2000,
            model: 'gpt-4o',
            enabled: false,
          }),
        })
      );
    });

    it('should create SOCIAL_SELLER agent', async () => {
      const mockAgent = {
        id: 'agent-123',
        name: 'Social Seller',
        type: 'SOCIAL_SELLER',
        systemPrompt: 'You are a social seller',
        temperature: 0.7,
        maxTokens: 500,
        model: 'gpt-4o-mini',
        enabled: true,
        workspaceId: 'workspace-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.agent.create as any).mockResolvedValueOnce(mockAgent);

      const response = await request(app)
        .post('/api/v1/agents')
        .send({
          name: 'Social Seller',
          type: 'SOCIAL_SELLER',
          systemPrompt: 'You are a social seller',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('SOCIAL_SELLER');
    });
  });

  describe('GET /agents/:id', () => {
    it('should return agent when found', async () => {
      const mockAgent = {
        id: 'agent-123',
        name: 'Test Agent',
        type: 'SDR',
        systemPrompt: 'You are a helpful assistant',
        temperature: 0.7,
        maxTokens: 500,
        model: 'gpt-4o-mini',
        enabled: true,
        workspaceId: 'workspace-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.agent.findFirst as any).mockResolvedValueOnce(mockAgent);

      const response = await request(app)
        .get('/api/v1/agents/agent-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('agent-123');
      expect(response.body.data.name).toBe('Test Agent');
      expect(response.body.data.type).toBe('SDR');
      expect(prisma.agent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'agent-123', workspaceId: 'workspace-123' },
        })
      );
    });

    it('should return 404 when agent not found', async () => {
      (prisma.agent.findFirst as any).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/v1/agents/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should return 404 when agent belongs to different workspace', async () => {
      (prisma.agent.findFirst as any).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/v1/agents/agent-123')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /agents/:id', () => {
    it('should update agent name', async () => {
      const existingAgent = {
        id: 'agent-123',
        name: 'Old Name',
        type: 'SDR',
        systemPrompt: 'You are a helpful assistant',
        temperature: 0.7,
        maxTokens: 500,
        model: 'gpt-4o-mini',
        enabled: true,
        workspaceId: 'workspace-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedAgent = {
        ...existingAgent,
        name: 'New Name',
      };

      (prisma.agent.findFirst as any).mockResolvedValueOnce(existingAgent);
      (prisma.agent.update as any).mockResolvedValueOnce(updatedAgent);

      const response = await request(app)
        .patch('/api/v1/agents/agent-123')
        .send({ name: 'New Name' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Name');
      expect(prisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'agent-123' },
          data: { name: 'New Name' },
        })
      );
    });

    it('should update multiple fields', async () => {
      const existingAgent = {
        id: 'agent-123',
        name: 'Test Agent',
        type: 'SDR',
        systemPrompt: 'Old prompt',
        temperature: 0.7,
        maxTokens: 500,
        model: 'gpt-4o-mini',
        enabled: true,
        workspaceId: 'workspace-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedAgent = {
        ...existingAgent,
        systemPrompt: 'New prompt',
        temperature: 0.9,
        enabled: false,
      };

      (prisma.agent.findFirst as any).mockResolvedValueOnce(existingAgent);
      (prisma.agent.update as any).mockResolvedValueOnce(updatedAgent);

      const response = await request(app)
        .patch('/api/v1/agents/agent-123')
        .send({
          systemPrompt: 'New prompt',
          temperature: 0.9,
          enabled: false,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.systemPrompt).toBe('New prompt');
      expect(response.body.data.temperature).toBe(0.9);
      expect(response.body.data.enabled).toBe(false);
      expect(prisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            systemPrompt: 'New prompt',
            temperature: 0.9,
            enabled: false,
          }),
        })
      );
    });

    it('should update agent type', async () => {
      const existingAgent = {
        id: 'agent-123',
        name: 'Test Agent',
        type: 'SDR',
        systemPrompt: 'You are a helpful assistant',
        temperature: 0.7,
        maxTokens: 500,
        model: 'gpt-4o-mini',
        enabled: true,
        workspaceId: 'workspace-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedAgent = {
        ...existingAgent,
        type: 'CLOSER',
      };

      (prisma.agent.findFirst as any).mockResolvedValueOnce(existingAgent);
      (prisma.agent.update as any).mockResolvedValueOnce(updatedAgent);

      const response = await request(app)
        .patch('/api/v1/agents/agent-123')
        .send({ type: 'CLOSER' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('CLOSER');
    });

    it('should return 404 when agent not found', async () => {
      (prisma.agent.findFirst as any).mockResolvedValueOnce(null);

      const response = await request(app)
        .patch('/api/v1/agents/nonexistent')
        .send({ name: 'New Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 when agent belongs to different workspace', async () => {
      (prisma.agent.findFirst as any).mockResolvedValueOnce(null);

      const response = await request(app)
        .patch('/api/v1/agents/agent-123')
        .send({ name: 'New Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /agents/:id', () => {
    it('should delete agent', async () => {
      const existingAgent = {
        id: 'agent-123',
        name: 'Test Agent',
        type: 'SDR',
        systemPrompt: 'You are a helpful assistant',
        temperature: 0.7,
        maxTokens: 500,
        model: 'gpt-4o-mini',
        enabled: true,
        workspaceId: 'workspace-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.agent.findFirst as any).mockResolvedValueOnce(existingAgent);
      (prisma.agent.delete as any).mockResolvedValueOnce(existingAgent);

      const response = await request(app)
        .delete('/api/v1/agents/agent-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Agent removido com sucesso');
      expect(prisma.agent.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'agent-123' },
        })
      );
    });

    it('should return 404 when agent not found', async () => {
      (prisma.agent.findFirst as any).mockResolvedValueOnce(null);

      const response = await request(app)
        .delete('/api/v1/agents/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 when agent belongs to different workspace', async () => {
      (prisma.agent.findFirst as any).mockResolvedValueOnce(null);

      const response = await request(app)
        .delete('/api/v1/agents/agent-123')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});
