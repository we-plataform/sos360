import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { tagsRouter } from './tags.js';

// Mock dependencies
vi.mock('../middleware/validate.js', () => ({
  validate: (schema: any) => (_req: any, _res: any, next: any) => next(),
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

const { prisma } = await import('@lia360/database');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/v1/tags', tagsRouter);

// Error handler to catch errors (must be after routes)
app.use((err: any, _req: any, res: any, _next: any) => {
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message,
  });
});

describe('Tags API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /tags', () => {
    it('should return empty array when no tags exist', async () => {
      vi.mocked(prisma.tag.findMany).mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/v1/tags')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should return list of tags', async () => {
      const mockTags = [
        {
          id: 'tag-1',
          name: 'VIP',
          color: '#FF0000',
          createdAt: new Date('2024-01-01'),
          _count: { leads: 5 },
        },
        {
          id: 'tag-2',
          name: 'Hot Lead',
          color: '#00FF00',
          createdAt: new Date('2024-01-02'),
          _count: { leads: 3 },
        },
      ];

      vi.mocked(prisma.tag.findMany).mockResolvedValueOnce(mockTags as any);

      const response = await request(app)
        .get('/api/v1/tags')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('VIP');
      expect(response.body.data[0].leadsCount).toBe(5);
    });
  });

  describe('POST /tags', () => {
    it('should create a new tag', async () => {
      const mockTag = {
        id: 'tag-3',
        name: 'New Tag',
        color: '#6366F1',
        createdAt: new Date('2024-01-03'),
        _count: { leads: 0 },
      };

      vi.mocked(prisma.tag.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.tag.create).mockResolvedValueOnce(mockTag as any);

      const response = await request(app)
        .post('/api/v1/tags')
        .send({ name: 'New Tag' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Tag');
      expect(response.body.data.color).toBe('#6366F1');
      expect(response.body.data.leadsCount).toBe(0);
    });

    it('should create tag with custom color', async () => {
      const mockTag = {
        id: 'tag-4',
        name: 'Custom Color Tag',
        color: '#FF00FF',
        createdAt: new Date('2024-01-04'),
        _count: { leads: 0 },
      };

      vi.mocked(prisma.tag.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.tag.create).mockResolvedValueOnce(mockTag as any);

      const response = await request(app)
        .post('/api/v1/tags')
        .send({ name: 'Custom Color Tag', color: '#FF00FF' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.color).toBe('#FF00FF');
    });

    it('should return 409 when tag name already exists', async () => {
      const existingTag = {
        id: 'tag-1',
        name: 'VIP',
        color: '#FF0000',
      };

      vi.mocked(prisma.tag.findFirst).mockResolvedValueOnce(existingTag as any);

      const response = await request(app)
        .post('/api/v1/tags')
        .send({ name: 'VIP' })
        .expect(409);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /tags/:id', () => {
    it('should update tag', async () => {
      const existingTag = {
        id: 'tag-1',
        name: 'VIP',
        color: '#FF0000',
      };

      const updatedTag = {
        id: 'tag-1',
        name: 'Very Important',
        color: '#0000FF',
        createdAt: new Date('2024-01-01'),
        _count: { leads: 5 },
      };

      vi.mocked(prisma.tag.findFirst).mockResolvedValueOnce(existingTag as any);
      vi.mocked(prisma.tag.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.tag.update).mockResolvedValueOnce(updatedTag as any);

      const response = await request(app)
        .patch('/api/v1/tags/tag-1')
        .send({ name: 'Very Important', color: '#0000FF' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Very Important');
      expect(response.body.data.color).toBe('#0000FF');
    });

    it('should return 404 when tag not found', async () => {
      vi.mocked(prisma.tag.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .patch('/api/v1/tags/nonexistent')
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 409 when new name already exists', async () => {
      const existingTag = {
        id: 'tag-1',
        name: 'VIP',
        color: '#FF0000',
      };

      const duplicateTag = {
        id: 'tag-2',
        name: 'Hot Lead',
        color: '#00FF00',
      };

      vi.mocked(prisma.tag.findFirst).mockResolvedValueOnce(existingTag as any);
      vi.mocked(prisma.tag.findFirst).mockResolvedValueOnce(duplicateTag as any);

      const response = await request(app)
        .patch('/api/v1/tags/tag-1')
        .send({ name: 'Hot Lead' })
        .expect(409);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /tags/:id', () => {
    it('should delete tag', async () => {
      const existingTag = {
        id: 'tag-1',
        name: 'VIP',
        color: '#FF0000',
      };

      vi.mocked(prisma.tag.findFirst).mockResolvedValueOnce(existingTag as any);
      vi.mocked(prisma.tag.delete).mockResolvedValueOnce(existingTag as any);

      const response = await request(app)
        .delete('/api/v1/tags/tag-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBeDefined();
    });

    it('should return 404 when tag not found', async () => {
      vi.mocked(prisma.tag.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .delete('/api/v1/tags/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});
