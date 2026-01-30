import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { postsRouter } from './posts.js';

// Mock dependencies
vi.mock('@lia360/database', () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    lead: {
      findFirst: vi.fn(),
    },
    postTag: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
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

vi.mock('../middleware/validate.js', () => ({
  validate: (_schema: any, _type: any) => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../middleware/rate-limit.js', () => ({
  importRateLimit: (_req: any, _res: any, next: any) => next(),
}));

const { prisma } = await import('@lia360/database');

// Mock socket.io
const mockIo = {
  to: vi.fn().mockReturnThis(),
  emit: vi.fn(),
};

// Create test app
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as any).app = { get: vi.fn().mockReturnValue(mockIo) };
  next();
});
app.use('/api/v1/posts', postsRouter);

// Error handler to catch errors (must be after routes)
app.use((err: any, _req: any, res: any, _next: any) => {
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    error: {
      title: err.message,
      type: err.type,
      detail: err.message,
      status,
    },
  });
});

describe('Posts API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /posts', () => {
    it('should return paginated list of posts', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          platform: 'linkedin',
          postUrl: 'https://linkedin.com/posts/1',
          content: 'Test post 1',
          authorUsername: 'user1',
          authorFullName: 'User One',
          lead: null,
          tags: [],
          createdAt: new Date(),
          importedAt: new Date(),
        },
        {
          id: 'post-2',
          platform: 'instagram',
          postUrl: 'https://instagram.com/posts/2',
          content: 'Test post 2',
          authorUsername: 'user2',
          authorFullName: 'User Two',
          lead: null,
          tags: [],
          createdAt: new Date(),
          importedAt: new Date(),
        },
      ];

      vi.mocked(prisma.post.findMany).mockResolvedValueOnce(mockPosts);
      vi.mocked(prisma.post.count).mockResolvedValueOnce(2);

      const response = await request(app)
        .get('/api/v1/posts?page=1&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(2);
      expect(response.body.pagination.totalPages).toBe(1);
    });

    it('should filter posts by platform', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          platform: 'linkedin',
          postUrl: 'https://linkedin.com/posts/1',
          content: 'Test post',
          authorUsername: 'user1',
          lead: null,
          tags: [],
          createdAt: new Date(),
          importedAt: new Date(),
        },
      ];

      vi.mocked(prisma.post.findMany).mockResolvedValueOnce(mockPosts);
      vi.mocked(prisma.post.count).mockResolvedValueOnce(1);

      const response = await request(app)
        .get('/api/v1/posts?platform=linkedin')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            platform: 'linkedin',
          }),
        })
      );
    });

    it('should filter posts by author username', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          platform: 'linkedin',
          postUrl: 'https://linkedin.com/posts/1',
          content: 'Test post',
          authorUsername: 'johndoe',
          lead: null,
          tags: [],
          createdAt: new Date(),
          importedAt: new Date(),
        },
      ];

      vi.mocked(prisma.post.findMany).mockResolvedValueOnce(mockPosts);
      vi.mocked(prisma.post.count).mockResolvedValueOnce(1);

      const response = await request(app)
        .get('/api/v1/posts?authorUsername=johndoe')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            authorUsername: { contains: 'johndoe', mode: 'insensitive' },
          }),
        })
      );
    });

    it('should filter posts by lead association', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          platform: 'linkedin',
          postUrl: 'https://linkedin.com/posts/1',
          content: 'Test post',
          leadId: 'lead-123',
          lead: {
            id: 'lead-123',
            fullName: 'John Doe',
            username: 'johndoe',
            avatarUrl: 'https://example.com/avatar.jpg',
          },
          tags: [],
          createdAt: new Date(),
          importedAt: new Date(),
        },
      ];

      vi.mocked(prisma.post.findMany).mockResolvedValueOnce(mockPosts);
      vi.mocked(prisma.post.count).mockResolvedValueOnce(1);

      const response = await request(app)
        .get('/api/v1/posts?hasLead=true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            leadId: { not: null },
          }),
        })
      );
    });

    it('should search posts by content and author', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          platform: 'linkedin',
          postUrl: 'https://linkedin.com/posts/1',
          content: 'AI and machine learning',
          authorUsername: 'techexpert',
          authorFullName: 'Tech Expert',
          lead: null,
          tags: [],
          createdAt: new Date(),
          importedAt: new Date(),
        },
      ];

      vi.mocked(prisma.post.findMany).mockResolvedValueOnce(mockPosts);
      vi.mocked(prisma.post.count).mockResolvedValueOnce(1);

      const response = await request(app)
        .get('/api/v1/posts?search=AI')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                content: { contains: 'AI', mode: 'insensitive' },
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('GET /posts/:id', () => {
    it('should return a single post', async () => {
      const mockPost = {
        id: 'post-123',
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        content: 'Test post content',
        authorUsername: 'johndoe',
        authorFullName: 'John Doe',
        lead: {
          id: 'lead-123',
          fullName: 'John Doe',
          username: 'johndoe',
          avatarUrl: 'https://example.com/avatar.jpg',
          profileUrl: 'https://linkedin.com/in/johndoe',
        },
        tags: [],
        createdAt: new Date(),
        importedAt: new Date(),
      };

      vi.mocked(prisma.post.findFirst).mockResolvedValueOnce(mockPost);

      const response = await request(app)
        .get('/api/v1/posts/post-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('post-123');
      expect(response.body.data.content).toBe('Test post content');
      expect(prisma.post.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'post-123', workspaceId: 'workspace-123' },
        })
      );
    });

    it('should return 404 when post not found', async () => {
      vi.mocked(prisma.post.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/v1/posts/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /posts', () => {
    it('should create a new post', async () => {
      const mockPost = {
        id: 'post-123',
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        content: 'New post content',
        authorUsername: 'johndoe',
        authorFullName: 'John Doe',
        lead: null,
        tags: [],
        createdAt: new Date(),
        importedAt: new Date(),
      };

      vi.mocked(prisma.post.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.post.create).mockResolvedValueOnce(mockPost);

      const response = await request(app)
        .post('/api/v1/posts')
        .send({
          platform: 'linkedin',
          postUrl: 'https://linkedin.com/posts/123',
          content: 'New post content',
          authorUsername: 'johndoe',
          authorFullName: 'John Doe',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('post-123');
      expect(prisma.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            platform: 'linkedin',
            content: 'New post content',
          }),
        })
      );
      expect(mockIo.to).toHaveBeenCalledWith('workspace:workspace-123');
      expect(mockIo.emit).toHaveBeenCalledWith('post:created', expect.any(Object));
    });

    it('should update existing post when duplicate URL', async () => {
      const existingPost = {
        id: 'post-123',
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/123',
        content: 'Old content',
        lead: null,
        tags: [],
      };

      const updatedPost = {
        ...existingPost,
        content: 'Updated content',
      };

      vi.mocked(prisma.post.findFirst).mockResolvedValueOnce(existingPost);
      vi.mocked(prisma.post.update).mockResolvedValueOnce(updatedPost);

      const response = await request(app)
        .post('/api/v1/posts')
        .send({
          platform: 'linkedin',
          postUrl: 'https://linkedin.com/posts/123',
          content: 'Updated content',
          authorUsername: 'johndoe',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe('Updated content');
      expect(response.body.message).toBe('Post atualizado');
      expect(prisma.post.update).toHaveBeenCalled();
    });
  });

  describe('POST /posts/import', () => {
    it('should import multiple posts', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          platform: 'linkedin',
          postUrl: 'https://linkedin.com/posts/1',
          content: 'Post 1',
          authorUsername: 'user1',
          lead: null,
          tags: [],
        },
        {
          id: 'post-2',
          platform: 'linkedin',
          postUrl: 'https://linkedin.com/posts/2',
          content: 'Post 2',
          authorUsername: 'user2',
          lead: null,
          tags: [],
        },
      ];

      vi.mocked(prisma.post.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.post.create).mockResolvedValueOnce(mockPosts[0] as any);
      vi.mocked(prisma.post.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.post.create).mockResolvedValueOnce(mockPosts[1] as any);

      const response = await request(app)
        .post('/api/v1/posts/import')
        .send({
          platform: 'linkedin',
          posts: [
            {
              postUrl: 'https://linkedin.com/posts/1',
              content: 'Post 1',
              authorUsername: 'user1',
            },
            {
              postUrl: 'https://linkedin.com/posts/2',
              content: 'Post 2',
              authorUsername: 'user2',
            },
          ],
        })
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalPosts).toBe(2);
      expect(response.body.data.imported).toBe(2);
      expect(response.body.data.updated).toBe(0);
      expect(response.body.data.errors).toBe(0);
    });

    it('should update existing posts during import', async () => {
      const existingPost = {
        id: 'post-1',
        platform: 'linkedin',
        postUrl: 'https://linkedin.com/posts/1',
        content: 'Old content',
      };

      vi.mocked(prisma.post.findFirst).mockResolvedValueOnce(existingPost as any);
      vi.mocked(prisma.post.update).mockResolvedValueOnce(existingPost as any);

      const response = await request(app)
        .post('/api/v1/posts/import')
        .send({
          platform: 'linkedin',
          posts: [
            {
              postUrl: 'https://linkedin.com/posts/1',
              content: 'Updated content',
              authorUsername: 'user1',
            },
          ],
        })
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data.updated).toBe(1);
      expect(response.body.data.imported).toBe(0);
    });

    it('should handle errors during import', async () => {
      vi.mocked(prisma.post.findFirst).mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .post('/api/v1/posts/import')
        .send({
          platform: 'linkedin',
          posts: [
            {
              postUrl: 'https://linkedin.com/posts/1',
              content: 'Post 1',
              authorUsername: 'user1',
            },
          ],
        })
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data.errors).toBe(1);
    });
  });

  describe('PATCH /posts/:id', () => {
    it('should update a post', async () => {
      const existingPost = {
        id: 'post-123',
        platform: 'linkedin',
        content: 'Old content',
        lead: null,
        tags: [],
      };

      const updatedPost = {
        ...existingPost,
        content: 'New content',
        lead: null,
        tags: [],
      };

      vi.mocked(prisma.post.findFirst).mockResolvedValueOnce(existingPost as any);
      vi.mocked(prisma.post.update).mockResolvedValueOnce(updatedPost as any);
      vi.mocked(prisma.post.findUnique).mockResolvedValueOnce(updatedPost as any);

      const response = await request(app)
        .patch('/api/v1/posts/post-123')
        .send({
          content: 'New content',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe('New content');
      expect(prisma.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'post-123' },
          data: expect.objectContaining({ content: 'New content' }),
        })
      );
      expect(mockIo.emit).toHaveBeenCalledWith('post:updated', expect.any(Object));
    });

    it('should update post tags', async () => {
      const existingPost = {
        id: 'post-123',
        content: 'Test content',
        lead: null,
        tags: [],
      };

      const updatedPost = {
        ...existingPost,
        tags: [
          { tag: { id: 'tag-1', name: 'Important', color: '#ff0000' } },
        ],
      };

      vi.mocked(prisma.post.findFirst).mockResolvedValueOnce(existingPost as any);
      vi.mocked(prisma.post.update).mockResolvedValueOnce(existingPost as any);
      vi.mocked(prisma.postTag.deleteMany).mockResolvedValueOnce({});
      vi.mocked(prisma.postTag.createMany).mockResolvedValueOnce({});
      vi.mocked(prisma.post.findUnique).mockResolvedValueOnce(updatedPost as any);

      const response = await request(app)
        .patch('/api/v1/posts/post-123')
        .send({
          tags: ['tag-1'],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.postTag.deleteMany).toHaveBeenCalledWith({ where: { postId: 'post-123' } });
      expect(prisma.postTag.createMany).toHaveBeenCalled();
    });

    it('should return 404 when post not found', async () => {
      vi.mocked(prisma.post.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .patch('/api/v1/posts/nonexistent')
        .send({
          content: 'New content',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /posts/:id', () => {
    it('should delete a post', async () => {
      const mockPost = {
        id: 'post-123',
        platform: 'linkedin',
        content: 'Test content',
      };

      vi.mocked(prisma.post.findFirst).mockResolvedValueOnce(mockPost as any);
      vi.mocked(prisma.post.delete).mockResolvedValueOnce(mockPost as any);

      const response = await request(app)
        .delete('/api/v1/posts/post-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Post removido com sucesso');
      expect(prisma.post.delete).toHaveBeenCalledWith({
        where: { id: 'post-123' },
      });
      expect(mockIo.emit).toHaveBeenCalledWith('post:deleted', { id: 'post-123' });
    });

    it('should return 404 when post not found', async () => {
      vi.mocked(prisma.post.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .delete('/api/v1/posts/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /posts/:id/link-lead', () => {
    it('should link post to lead', async () => {
      const mockPost = {
        id: 'post-123',
        platform: 'linkedin',
        content: 'Test content',
        leadId: null,
        lead: null,
        tags: [],
      };

      const mockLead = {
        id: 'lead-123',
        fullName: 'John Doe',
        username: 'johndoe',
        avatarUrl: 'https://example.com/avatar.jpg',
      };

      const updatedPost = {
        ...mockPost,
        leadId: 'lead-123',
        lead: mockLead,
      };

      vi.mocked(prisma.post.findFirst).mockResolvedValueOnce(mockPost as any);
      vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(mockLead as any);
      vi.mocked(prisma.post.update).mockResolvedValueOnce(updatedPost as any);

      const response = await request(app)
        .post('/api/v1/posts/post-123/link-lead')
        .send({
          leadId: 'lead-123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.leadId).toBe('lead-123');
      expect(prisma.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'post-123' },
          data: { leadId: 'lead-123' },
        })
      );
      expect(mockIo.emit).toHaveBeenCalledWith('post:updated', expect.any(Object));
    });

    it('should return 404 when post not found', async () => {
      vi.mocked(prisma.post.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/v1/posts/post-123/link-lead')
        .send({
          leadId: 'lead-123',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 when lead not found', async () => {
      const mockPost = {
        id: 'post-123',
        platform: 'linkedin',
        leadId: null,
      };

      vi.mocked(prisma.post.findFirst).mockResolvedValueOnce(mockPost as any);
      vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/v1/posts/post-123/link-lead')
        .send({
          leadId: 'nonexistent-lead',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /posts/:id/link-lead', () => {
    it('should unlink post from lead', async () => {
      const mockPost = {
        id: 'post-123',
        platform: 'linkedin',
        content: 'Test content',
        leadId: 'lead-123',
        lead: {
          id: 'lead-123',
          fullName: 'John Doe',
          username: 'johndoe',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
        tags: [],
      };

      const updatedPost = {
        ...mockPost,
        leadId: null,
        lead: null,
      };

      vi.mocked(prisma.post.findFirst).mockResolvedValueOnce(mockPost as any);
      vi.mocked(prisma.post.update).mockResolvedValueOnce(updatedPost as any);

      const response = await request(app)
        .delete('/api/v1/posts/post-123/link-lead')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.leadId).toBeNull();
      expect(prisma.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'post-123' },
          data: { leadId: null },
        })
      );
      expect(mockIo.emit).toHaveBeenCalledWith('post:updated', expect.any(Object));
    });

    it('should return 404 when post not found', async () => {
      vi.mocked(prisma.post.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .delete('/api/v1/posts/nonexistent/link-lead')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});
