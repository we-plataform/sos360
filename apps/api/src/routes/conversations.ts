import { Router } from 'express';
import { prisma } from '@lia360/database';
import {
  sendMessageSchema,
  conversationFiltersSchema,
  PAGINATION_DEFAULTS,
  calculateOffset,
  calculateTotalPages,
} from '@lia360/shared';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../lib/errors.js';
import type { Server } from 'socket.io';
import { z } from 'zod';

export const conversationsRouter = Router();

conversationsRouter.use(authenticate);

// GET /conversations - List conversations
conversationsRouter.get('/', validate(conversationFiltersSchema, 'query'), async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;
    const {
      page = PAGINATION_DEFAULTS.page,
      limit = PAGINATION_DEFAULTS.limit,
      status,
      unread,
      platform,
      assignedTo,
    } = req.query as z.infer<typeof conversationFiltersSchema>;

    const where: Record<string, unknown> = {
      lead: { workspaceId },
    };

    if (status) where.status = status;
    if (unread) where.unreadCount = { gt: 0 };
    if (platform) where.platform = platform;
    if (assignedTo) where.assignedToId = assignedTo;

    // Agent can only see assigned conversations
    if (req.user!.workspaceRole === 'agent') {
      where.assignedToId = req.user!.id;
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          lead: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
              platform: true,
              profileUrl: true,
            },
          },
          assignedTo: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
          messages: {
            orderBy: { sentAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip: calculateOffset(page, limit),
        take: limit,
      }),
      prisma.conversation.count({ where }),
    ]);

    const formattedConversations = conversations.map((conv) => ({
      id: conv.id,
      platform: conv.platform,
      status: conv.status,
      unreadCount: conv.unreadCount,
      lastMessageAt: conv.lastMessageAt,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      lead: conv.lead,
      assignedTo: conv.assignedTo,
      lastMessage: conv.messages[0] || null,
    }));

    res.json({
      success: true,
      data: formattedConversations,
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

// GET /conversations/:id - Get conversation with messages
conversationsRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspaceId;
    const messagesLimit = parseInt(req.query.messagesLimit as string) || 50;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        lead: { workspaceId },
      },
      include: {
        lead: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
            platform: true,
            profileUrl: true,
          },
        },
        assignedTo: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
        messages: {
          orderBy: { sentAt: 'desc' },
          take: messagesLimit,
        },
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversa');
    }

    // Agent can only see assigned conversations
    if (req.user!.workspaceRole === 'agent' && conversation.assignedToId !== req.user!.id) {
      throw new NotFoundError('Conversa');
    }

    res.json({
      success: true,
      data: {
        ...conversation,
        messages: conversation.messages.reverse(),
        hasMoreMessages: conversation.messages.length === messagesLimit,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /conversations/:id/messages - Send message
conversationsRouter.post(
  '/:id/messages',
  authorize('owner', 'admin', 'manager', 'agent'),
  validate(sendMessageSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { content, messageType = 'text' } = req.body;
      const workspaceId = req.user!.workspaceId;
      const userId = req.user!.id;

      const conversation = await prisma.conversation.findFirst({
        where: {
          id,
          lead: { workspaceId },
        },
      });

      if (!conversation) {
        throw new NotFoundError('Conversa');
      }

      // Create message
      const message = await prisma.message.create({
        data: {
          conversationId: id,
          content,
          messageType,
          senderType: 'agent',
          senderId: userId,
          status: 'pending',
        },
      });

      // Update conversation
      await prisma.conversation.update({
        where: { id },
        data: { lastMessageAt: new Date() },
      });

      // Create activity
      await prisma.activity.create({
        data: {
          type: 'message_sent',
          leadId: conversation.leadId,
          userId,
        },
      });

      // Emit socket event
      const io = req.app.get('io') as Server;
      io.to(`workspace:${workspaceId}`).emit('message:created', {
        conversationId: id,
        message,
      });

      res.status(201).json({
        success: true,
        data: message,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /conversations/:id/read - Mark as read
conversationsRouter.post('/:id/read', async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspaceId;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        lead: { workspaceId },
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversa');
    }

    await prisma.conversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });

    // Mark all messages as read
    await prisma.message.updateMany({
      where: {
        conversationId: id,
        senderType: 'lead',
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    res.json({
      success: true,
      data: { id, unreadCount: 0 },
    });
  } catch (error) {
    next(error);
  }
});

// POST /conversations/:id/assign - Assign conversation
conversationsRouter.post('/:id/assign', authorize('owner', 'admin', 'manager'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const workspaceId = req.user!.workspaceId;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        lead: { workspaceId },
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversa');
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: { assignedToId: userId },
      include: {
        assignedTo: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

// POST /conversations/:id/archive - Archive conversation
conversationsRouter.post('/:id/archive', authorize('owner', 'admin', 'manager'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspaceId;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        lead: { workspaceId },
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversa');
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: { status: 'archived' },
    });

    res.json({
      success: true,
      data: { id: updated.id, status: updated.status },
    });
  } catch (error) {
    next(error);
  }
});
