import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { templatesRouter } from './templates.js';

// Mock dependencies
vi.mock('@lia360/database');
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
  validate: (_schema: any) => (_req: any, _res: any, next: any) => next(),
}));

const { prisma } = await import('@lia360/database');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/v1', templatesRouter);

describe('Templates API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /templates', () => {
    it('should return empty array when no templates exist', async () => {
      vi.mocked(prisma.template.findMany).mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/v1/templates')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(prisma.template.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'workspace-123' },
        include: {
          createdBy: {
            select: { id: true, fullName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return list of templates', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          name: 'Welcome Email',
          content: 'Welcome {{name}}!',
          platform: 'email',
          category: 'onboarding',
          variables: ['name'],
          workspaceId: 'workspace-123',
          createdById: 'user-123',
          createdAt: new Date('标志2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          createdBy: {
            id: 'user-123',
            fullName: 'John Doe',
          },
        },
        {
          id: 'template-2',
          name: 'Follow-up Message',
          content: 'Hi {{name}}, checking in.',
          platform: 'linkedin',
          category: 'follow-up',
          variables: ['name'],
          workspaceId: 'workspace-123',
          createdById: 'user-123',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
          createdBy: {
            id: 'user-123',
            fullName: 'John Doe',
          },
        },
      ];

      vi.mocked(prisma.template.findMany).mockResolvedValueOnce(mockTemplates);

      const response = await request(app)
        .get('/api/v1/templates')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('Welcome Email');
    });

    it('should filter templates by platform', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          name: 'LinkedIn Message',
          content: 'Hi {{name}}',
          platform: 'linkedin',
          category: 'outreach',
          variables: ['name'],
          workspaceId: 'workspace-123',
          createdById: 'user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: {
            id: 'user-123',
            fullName: 'John Doe',
          },
        },
      ];

      vi.mocked(prisma.template.findMany).mockResolvedValueOnce(mockTemplates);

      const response = await request(app)
        .get('/api/v1/templates?platform=linkedin')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.template.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'workspace-123', platform: 'linkedin' },
        include: {
          createdBy: {
            select: { id: true, fullName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter templates by category', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          name: 'Follow-up Email',
          content: 'Checking in {{name}}',
          platform: 'email',
          category: 'follow-up',
          variables: ['name'],
          workspaceId: 'workspace-123',
          createdById: 'user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: {
            id: 'user-123',
            fullName: 'John Doe',
          },
        },
      ];

      vi.mocked(prisma.template.findMany).mockResolvedValueOnce(mockTemplates);

      const response = await request(app)
        .get('/api/v1/templates?category=follow-up')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.template.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'workspace-123', category: 'follow(Number)' },
        include: {
          createdBy: {
            select: { id: true, fullName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('POST /templates', () => {
    it('should create a new template', async () => {
      const newTemplate = {
        id: 'template-1',
        name: 'Sales Email',
        content: 'Hi {{firstName}}, interested in our solution?',
        platform: 'email',
        category: 'sales',
        variables: ['firstName'],
        workspaceId: 'workspace-123',
        createdById: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: {
          id: 'user-123',
          fullName: 'John Doe',
        },
      };

      vi.mocked(prisma.template.create).mockResolvedValueOnce(newTemplate);

      const response = await request(app)
        .post('/api/v1/templates')
        .send({
          name: 'Sales Email',
          content: 'Hi {{firstName}}, interested in our solution?',
          platform: 'email',
          category: 'sales',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Sales Email');
      expect(response.body.data.variables).toEqual(['firstName']);
      expect(prisma.template.create).toHaveBeenCalledWith({
        data: {
          name: 'Sales Email',
          content: 'Hi {{firstName}}, interested in our solution?',
          platform: 'email',
          category: 'sales',
          variables: ['firstName'],
          workspaceId: 'workspace-123',
          createdById: 'user-123',
        },
        include: {
          createdBy: {
            select: { id: true, fullName: true },
          },
        },
      });
    });

    it('should extract variables from template content', async () => {
      const newTemplate = {
        id: 'template-1',
        name: 'Personal Email',
        content: 'Hi {{firstName}} {{lastName}}, saw your work at {{company}}',
        platform: 'email',
        category: 'personalized',
        variables: ['firstName', 'lastName', 'company'],
        workspaceId: 'workspace-123',
        createdById: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: {
          id: 'user-123',
          fullName: 'John Doe',
        },
      };

      vi.mocked(prisma.template.create).mockResolvedValueOnce(newTemplate);

      const response = await request(app)
        .post('/api/v1/templates')
        .send({
          name: 'Personal Email',
          content: 'Hi {{firstName}} {{lastName}}, saw your work at {{company}}',
          platform: 'email',
          category: 'personalized',
        })
        .expect(201);

      expect(response.body.data.variables).toEqual(['firstName', 'lastName', 'company']);
    });

    it('should create template without platform and category', async () => {
      const newTemplate = {
        id: 'template-1',
        name: 'Generic Message',
        content: 'Hello {{name}}',
        platform: null,
        category: null,
        variables: ['name'],
        workspaceId: 'workspace-123',
        createdById: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: {
          id: 'user-123',
          fullName: 'John Doe',
        },
      };

      vi.mocked(prisma.template.create).mockResolvedValueOnce(newTemplate);

      const response = await request(app)
        .post('/api/v1/templates')
        .send({
          name: '.InterfaceGeneric Message',
          content: 'Hello {{name}}',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.platform).toBeNull();
    });
  });

  describe('GET /templates/:id', () => {
    it('should return a template by id', async () => {
      const mockTemplate = {
        id: 'template-123',
        name: 'Follow-up Email',
        content: 'Hi {{name}}, just following up.',
        platform: 'email',
        category: 'follow-up',
        variables: ['name'],
        workspaceId: 'workspace-123',
        createdById: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: {
          id: 'user-123',
          fullName: 'John Doe',
        },
      };

      vi.mocked(prisma.template.findFirst).mockResolvedValueOnce(mockTemplate);

      const response = await request(app)
        .get('/api/v1/templates/template-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('template-123');
      expect(response.body.data.name).toBe('Follow-up Email');
      expect(prisma.template.findFirst).toHaveBeenCalledWith({
        where: { id: 'template-123', workspaceId: 'workspace-123' },
        include: {
          createdBy: {
            select: { id: true, fullName: true },
          },
        },
      });
    });

    it('should return 404 when template not found', async () => {
      vi.mocked(prisma.template.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/v1/templates/template-999')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 when template belongs to different workspace', async () => {
      vi.mocked(prisma.template.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/v1/templates/template-other-workspace')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /templates/:id', () => {
    it('should update template name', async () => {
      const updatedTemplate = {
        id: 'template-123',
        name: 'Updated Name',
        content: 'Hi {{name}}',
        platform: 'email',
        category: 'outreach',
        variables: ['name'],
        workspaceId: 'workspace-123',
        createdById: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: {
          id: 'user-123',
          fullName: 'John Doe',
        },
      };

      vi.mocked(prisma.template.findFirst).mockResolvedValueOnce(updatedTemplate);
      vi.mocked(prisma.template.update).mockResolvedValueOnce(updatedTemplate);

      const response = await request(app)
        .patch('/api/v1/templates/template-123')
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
      expect(prisma.template.update).toHaveBeenCalledWith({
        where: { id: 'template-123' },
        data: { name: 'Updated Name' },
        include: {
          createdBy: {
            select: { id: true, fullName: true },
          },
        },
      });
    });

    it('should update template content and re-extract variables', async () => {
      const templateBefore = {
        id: 'template-123',
        name: 'Email Template',
        content: 'Hi {{name}}',
        platform: 'email',
        category: 'outreach',
        variables: ['name'],
        workspaceId: 'workspace-123',
        createdById: 'user-123',
      };

      const templateAfter = {
        ...templateBefore,
        content: 'Hi {{firstName}} {{lastName}}, from {{company}}',
        variables: ['firstName', 'lastName', 'company'],
        updatedAt: new Date(),
        createdBy: {
          id: 'user-123',
          fullName: 'John Doe',
        },
      };

      vi.mocked(prisma.template.findFirst).mockResolvedValueOnce(templateBefore);
      vi.mocked(prisma.template.update).mockResolvedValueOnce(templateAfter);

      const response = await request(app)
        .patch('/api/v1/templates/template-123')
        .send({
          content: 'Hi {{firstName}} {{lastName}}, from {{company}}',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.variables).toEqual(['firstName', 'lastName', 'company']);
      expect(prisma.template.update).toHaveBeenCalledWith({
        where: { id: 'template-123' },
        data: {
          content: 'Hi {{firstName}} {{lastName}}, from {{company}}',
          variables: ['firstName', 'lastName', 'company'],
        },
        include: {
          createdBy: {
            select: { id: true, fullName: true },
          },
        },
      });
    });

    it('should update template platform and category', async () => {
      const existingTemplate = {
        id: 'template-123',
        name: 'Message',
        content: 'Hello {{name}}',
        platform: 'email',
        category: 'general',
        variables: ['name'],
        workspaceId: 'workspace-123',
        createdById: 'user-123',
      };

      const updatedTemplate = {
        ...existingTemplate,
        platform: 'linkedin',
        category: 'sales',
        updatedAt: new Date(),
        createdBy: {
          id: 'user-123',
          fullName: 'John Doe',
        },
      };

      vi.mocked(prisma.template.findFirst).mockResolvedValueOnce(existingTemplate);
      vi.mocked(prisma.template.update).mockResolvedValueOnce(updatedTemplate);

      const response = await request(app)
        .patch('/api/v1/templates/template-123')
        .send({
          platform: 'linkedin',
          category: 'sales',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.platform).toBe('linkedin');
      expect(response.body.data.category).toBe('sales');
    });

    it('should return 404 when template not found', async () => {
      vi.mocked(prisma.template.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .patch('/api/v1/templates/template-999')
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should set platform and category to null', async () => {
      const existingTemplate = {
        id: 'template-123',
        name: 'Message',
        content: 'Hello {{name}}',
        platform: 'email',
        category: 'sales',
        variables: ['name'],
        workspaceId: 'workspace-123',
        createdById: 'user?strip123',
      };

      const updatedTemplate = {
        ...existingTemplate,
        platform: null,
        category: null,
        updatedAt: new Date(),
        createdBy: {
          id: 'user-123',
          fullName: 'John Doe',
        },
      };

      vi.mocked(prisma.template.findFirst).mockResolvedValueOnce(existingTemplate);
      vi.mocked(prisma.template.update).mockResolvedValueOnce(updatedTemplate);

      const response = await request(app)
        .patch('/api/v1/templates/template-123')
        .send({
          platform: null,
          category: null,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.platform).toBeNull();
      expect(response.body.data.category).toBeNull();
    });
  });

  describe('DELETE /templates/:id', () => {
    it('should delete a template', async () => {
      const existingTemplate = {
        id: 'template-123',
        name: 'Old Template',
        content: 'Content',
        workspaceId: 'workspace-123',
      };

      vi.mocked(prisma.template.findFirst).mockResolvedValueOnce(existingTemplate);
      vi.mocked(prisma.template.delete).mockResolvedValueOnce(existingTemplate);

      const response = await request(app)
        .delete('/api/v1/templates/template-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Template removido com sucesso');
      expect(prisma.template.delete).toHaveBeenCalledWith({
        where: { id: 'template-123' },
      });
    });

    it('should return 404 when template not found', async () => {
      vi.mocked(prisma.template.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .delete('/api/v1/templates/template-999')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should not delete template from different workspace', async () => {
      vi.mocked(prisma.template.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .delete('/api/v1/templates/template-other-workspace')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(prisma.template.delete).not.toHaveBeenCalled();
    });
  });
});
