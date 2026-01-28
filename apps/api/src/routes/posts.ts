import { Router } from 'express';
import { prisma } from '@lia360/database';
import {
  createPostSchema,
  updatePostSchema,
  importPostsSchema,
  linkPostToLeadSchema,
  postFiltersSchema,
  PAGINATION_DEFAULTS,
  calculateOffset,
  calculateTotalPages,
} from '@lia360/shared';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { importRateLimit } from '../middleware/rate-limit.js';
import { NotFoundError } from '../lib/errors.js';
import type { z } from 'zod';
import type { Server } from 'socket.io';

export const postsRouter = Router();

// All routes require authentication
postsRouter.use(authenticate);

// GET /posts - List posts with filters and pagination
postsRouter.get('/', validate(postFiltersSchema, 'query'), async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;
    const {
      page = PAGINATION_DEFAULTS.page,
      limit = PAGINATION_DEFAULTS.limit,
      platform,
      authorUsername,
      leadId,
      hasLead,
      search,
      sort = 'importedAt',
      order = 'desc',
    } = req.query as z.infer<typeof postFiltersSchema>;

    // Build where clause
    const where: Record<string, unknown> = { workspaceId };

    if (platform) where.platform = platform;
    if (authorUsername) where.authorUsername = { contains: authorUsername, mode: 'insensitive' };
    if (leadId) where.leadId = leadId;
    if (hasLead !== undefined) {
      where.leadId = hasLead ? { not: null } : null;
    }
    if (search) {
      where.OR = [
        { content: { contains: search, mode: 'insensitive' } },
        { authorUsername: { contains: search, mode: 'insensitive' } },
        { authorFullName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          lead: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          tags: {
            include: {
              tag: { select: { id: true, name: true, color: true } },
            },
          },
        },
        orderBy: { [sort]: order },
        skip: calculateOffset(page, limit),
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    // Format response
    const formattedPosts = posts.map((post) => ({
      ...post,
      tags: post.tags.map((pt: { tag: { id: string; name: string; color: string } }) => pt.tag),
    }));

    res.json({
      success: true,
      data: formattedPosts,
      pagination: {
        page,
        limit,
        total,
        totalPages: calculateTotalPages(total, limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /posts/:id - Get single post
postsRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspaceId;

    const post = await prisma.post.findFirst({
      where: { id, workspaceId },
      include: {
        lead: {
          select: { id: true, fullName: true, username: true, avatarUrl: true, profileUrl: true },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    if (!post) {
      throw new NotFoundError('Post');
    }

    res.json({
      success: true,
      data: {
        ...post,
        tags: post.tags.map((pt: { tag: { id: string; name: string; color: string } }) => pt.tag),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /posts - Create/import a single post
postsRouter.post(
  '/',
  authorize('owner', 'admin', 'manager', 'agent'),
  validate(createPostSchema),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const data = req.body;

      // Check if post already exists (by unique constraint)
      const existingPost = await prisma.post.findFirst({
        where: {
          workspaceId,
          platform: data.platform,
          postUrl: data.postUrl,
        },
      });

      if (existingPost) {
        // Update existing post
        const updatedPost = await prisma.post.update({
          where: { id: existingPost.id },
          data: {
            content: data.content,
            imageUrls: data.imageUrls || [],
            videoUrls: data.videoUrls || [],
            linkedUrl: data.linkedUrl,
            postType: data.postType,
            likesCount: data.likesCount,
            commentsCount: data.commentsCount,
            sharesCount: data.sharesCount,
            viewsCount: data.viewsCount,
            authorFullName: data.authorFullName,
            authorAvatarUrl: data.authorAvatarUrl,
            authorProfileUrl: data.authorProfileUrl,
            postDate: data.postDate ? new Date(data.postDate) : null,
          },
          include: {
            lead: {
              select: { id: true, fullName: true, username: true, avatarUrl: true },
            },
            tags: {
              include: {
                tag: { select: { id: true, name: true, color: true } },
              },
            },
          },
        });

        return res.json({
          success: true,
          data: {
            ...updatedPost,
            tags: updatedPost.tags.map((pt: { tag: { id: string; name: string; color: string } }) => pt.tag),
          },
          message: 'Post atualizado',
        });
      }

      // Create new post
      const post = await prisma.post.create({
        data: {
          workspaceId,
          platform: data.platform,
          postUrl: data.postUrl,
          content: data.content,
          imageUrls: data.imageUrls || [],
          videoUrls: data.videoUrls || [],
          linkedUrl: data.linkedUrl,
          postType: data.postType,
          likesCount: data.likesCount,
          commentsCount: data.commentsCount,
          sharesCount: data.sharesCount,
          viewsCount: data.viewsCount,
          authorUsername: data.authorUsername,
          authorFullName: data.authorFullName,
          authorAvatarUrl: data.authorAvatarUrl,
          authorProfileUrl: data.authorProfileUrl,
          postDate: data.postDate ? new Date(data.postDate) : null,
        },
        include: {
          lead: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          tags: {
            include: {
              tag: { select: { id: true, name: true, color: true } },
            },
          },
        },
      });

      // Emit socket event
      const io = req.app.get('io') as Server;
      io.to(`workspace:${workspaceId}`).emit('post:created', {
        ...post,
        tags: post.tags.map((pt: { tag: { id: string; name: string; color: string } }) => pt.tag),
      });

      res.status(201).json({
        success: true,
        data: {
          ...post,
          tags: post.tags.map((pt: { tag: { id: string; name: string; color: string } }) => pt.tag),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /posts/import - Import posts in bulk
postsRouter.post(
  '/import',
  authorize('owner', 'admin', 'manager', 'agent'),
  importRateLimit,
  validate(importPostsSchema),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const { platform, posts, tags } = req.body;

      let imported = 0;
      let updated = 0;
      let errors = 0;
      const results: { id: string; postUrl: string; status: 'created' | 'updated' }[] = [];

      for (const postData of posts) {
        try {
          // Check if post already exists
          const existingPost = await prisma.post.findFirst({
            where: {
              workspaceId,
              platform,
              postUrl: postData.postUrl,
            },
          });

          if (existingPost) {
            // Update existing post
            await prisma.post.update({
              where: { id: existingPost.id },
              data: {
                content: postData.content,
                imageUrls: postData.imageUrls || [],
                videoUrls: postData.videoUrls || [],
                linkedUrl: postData.linkedUrl,
                postType: postData.postType,
                likesCount: postData.likesCount,
                commentsCount: postData.commentsCount,
                sharesCount: postData.sharesCount,
                viewsCount: postData.viewsCount,
                authorFullName: postData.authorFullName,
                authorAvatarUrl: postData.authorAvatarUrl,
                authorProfileUrl: postData.authorProfileUrl,
                postDate: postData.postDate ? new Date(postData.postDate) : null,
              },
            });
            updated++;
            results.push({ id: existingPost.id, postUrl: postData.postUrl, status: 'updated' });
          } else {
            // Create new post
            const newPost = await prisma.post.create({
              data: {
                workspaceId,
                platform,
                postUrl: postData.postUrl,
                content: postData.content,
                imageUrls: postData.imageUrls || [],
                videoUrls: postData.videoUrls || [],
                linkedUrl: postData.linkedUrl,
                postType: postData.postType,
                likesCount: postData.likesCount,
                commentsCount: postData.commentsCount,
                sharesCount: postData.sharesCount,
                viewsCount: postData.viewsCount,
                authorUsername: postData.authorUsername,
                authorFullName: postData.authorFullName,
                authorAvatarUrl: postData.authorAvatarUrl,
                authorProfileUrl: postData.authorProfileUrl,
                postDate: postData.postDate ? new Date(postData.postDate) : null,
                ...(tags?.length && {
                  tags: {
                    create: tags.map((tagId: string) => ({ tagId })),
                  },
                }),
              },
            });
            imported++;
            results.push({ id: newPost.id, postUrl: postData.postUrl, status: 'created' });
          }
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error importing post:', err);
          }
          errors++;
        }
      }

      res.status(202).json({
        success: true,
        data: {
          totalPosts: posts.length,
          imported,
          updated,
          errors,
          results,
          message: `Importação concluída: ${imported} posts importados, ${updated} atualizados`,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /posts/:id - Update post
postsRouter.patch(
  '/:id',
  authorize('owner', 'admin', 'manager', 'agent'),
  validate(updatePostSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workspaceId = req.user!.workspaceId;
      const { tags, ...updates } = req.body;

      const existingPost = await prisma.post.findFirst({
        where: { id, workspaceId },
      });

      if (!existingPost) {
        throw new NotFoundError('Post');
      }

      // Update post
      await prisma.post.update({
        where: { id },
        data: {
          ...updates,
          ...(updates.postDate && { postDate: new Date(updates.postDate) }),
        },
      });

      // Update tags if provided
      if (tags !== undefined) {
        // Remove existing tags
        await prisma.postTag.deleteMany({ where: { postId: id } });

        // Add new tags
        if (tags.length > 0) {
          await prisma.postTag.createMany({
            data: tags.map((tagId: string) => ({ postId: id, tagId })),
            skipDuplicates: true,
          });
        }
      }

      // Fetch updated post with tags
      const updatedPost = await prisma.post.findUnique({
        where: { id },
        include: {
          lead: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          tags: {
            include: {
              tag: { select: { id: true, name: true, color: true } },
            },
          },
        },
      });

      // Emit socket event
      const io = req.app.get('io') as Server;
      io.to(`workspace:${workspaceId}`).emit('post:updated', {
        ...updatedPost!,
        tags: updatedPost!.tags.map((pt: { tag: { id: string; name: string; color: string } }) => pt.tag),
      });

      res.json({
        success: true,
        data: {
          ...updatedPost!,
          tags: updatedPost!.tags.map((pt: { tag: { id: string; name: string; color: string } }) => pt.tag),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /posts/:id - Delete post
postsRouter.delete(
  '/:id',
  authorize('owner', 'admin', 'manager'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workspaceId = req.user!.workspaceId;

      const post = await prisma.post.findFirst({
        where: { id, workspaceId },
      });

      if (!post) {
        throw new NotFoundError('Post');
      }

      await prisma.post.delete({ where: { id } });

      // Emit socket event
      const io = req.app.get('io') as Server;
      io.to(`workspace:${workspaceId}`).emit('post:deleted', { id });

      res.json({
        success: true,
        data: { message: 'Post removido com sucesso' },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /posts/:id/link-lead - Link post to an existing lead
postsRouter.post(
  '/:id/link-lead',
  authorize('owner', 'admin', 'manager', 'agent'),
  validate(linkPostToLeadSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { leadId } = req.body;
      const workspaceId = req.user!.workspaceId;

      // Check if post exists
      const post = await prisma.post.findFirst({
        where: { id, workspaceId },
      });

      if (!post) {
        throw new NotFoundError('Post');
      }

      // Check if lead exists
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, workspaceId },
      });

      if (!lead) {
        throw new NotFoundError('Lead');
      }

      // Link post to lead
      const updatedPost = await prisma.post.update({
        where: { id },
        data: { leadId },
        include: {
          lead: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          tags: {
            include: {
              tag: { select: { id: true, name: true, color: true } },
            },
          },
        },
      });

      // Emit socket event
      const io = req.app.get('io') as Server;
      io.to(`workspace:${workspaceId}`).emit('post:updated', {
        ...updatedPost,
        tags: updatedPost.tags.map((pt: { tag: { id: string; name: string; color: string } }) => pt.tag),
      });

      res.json({
        success: true,
        data: {
          ...updatedPost,
          tags: updatedPost.tags.map((pt: { tag: { id: string; name: string; color: string } }) => pt.tag),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /posts/:id/link-lead - Unlink post from lead
postsRouter.delete(
  '/:id/link-lead',
  authorize('owner', 'admin', 'manager', 'agent'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workspaceId = req.user!.workspaceId;

      const post = await prisma.post.findFirst({
        where: { id, workspaceId },
      });

      if (!post) {
        throw new NotFoundError('Post');
      }

      // Unlink post from lead
      const updatedPost = await prisma.post.update({
        where: { id },
        data: { leadId: null },
        include: {
          lead: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          tags: {
            include: {
              tag: { select: { id: true, name: true, color: true } },
            },
          },
        },
      });

      // Emit socket event
      const io = req.app.get('io') as Server;
      io.to(`workspace:${workspaceId}`).emit('post:updated', {
        ...updatedPost,
        tags: updatedPost.tags.map((pt: { tag: { id: string; name: string; color: string } }) => pt.tag),
      });

      res.json({
        success: true,
        data: {
          ...updatedPost,
          tags: updatedPost.tags.map((pt: { tag: { id: string; name: string; color: string } }) => pt.tag),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);
