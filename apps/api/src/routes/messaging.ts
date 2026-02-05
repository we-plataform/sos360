import { Router } from 'express';
import { prisma } from '@lia360/database';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../lib/errors.js';
import { z } from 'zod';

export const messagingRouter = Router();

// All routes require authentication
messagingRouter.use(authenticate);

// Schemas
const messageStatusSchema = z.enum([
  'queued',
  'pending',
  'sending',
  'sent',
  'failed',
  'blocked',
  'cancelled'
]);

const messageTypeSchema = z.enum([
  'connection_request',
  'direct_message',
  'inmail',
  'message'
]);

const platformSchema = z.enum([
  'linkedin',
  'instagram'
]);

const prioritySchema = z.enum([
  'low',
  'normal',
  'high',
  'urgent'
]);

const queueFiltersSchema = z.object({
  status: messageStatusSchema.optional(),
  platform: platformSchema.optional(),
  leadId: z.string().optional(),
  agentId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

const createMessageSchema = z.object({
  leadId: z.string().min(1),
  platform: platformSchema,
  messageType: messageTypeSchema,
  content: z.string().min(1).max(5000),
  scheduledAt: z.string().datetime().optional(),
  priority: prioritySchema.default('normal'),
  metadata: z.record(z.any()).optional(),
});

const bulkMessageSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(50),
  platform: platformSchema,
  messageType: messageTypeSchema,
  content: z.string().min(1).max(5000),
  scheduledAt: z.string().datetime().optional(),
  priority: prioritySchema.default('normal'),
});

// GET /messaging/queue - Get message queue statistics
messagingRouter.get('/queue', async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;

    // Get message statistics
    const [
      totalQueued,
      totalPending,
      totalSent,
      totalFailed,
      totalBlocked,
      recentMessages,
    ] = await Promise.all([
      prisma.messageQueue.count({
        where: {
          lead: { workspaceId },
          status: 'queued',
        },
      }),
      prisma.messageQueue.count({
        where: {
          lead: { workspaceId },
          status: 'pending',
        },
      }),
      prisma.messageQueue.count({
        where: {
          lead: { workspaceId },
          status: 'sent',
        },
      }),
      prisma.messageQueue.count({
        where: {
          lead: { workspaceId },
          status: 'failed',
        },
      }),
      prisma.messageQueue.count({
        where: {
          lead: { workspaceId },
          status: 'blocked',
        },
      }),
      prisma.messageQueue.findMany({
        where: {
          lead: { workspaceId },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          lead: {
            select: {
              id: true,
              fullName: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      }),
    ]);

    // Get platform breakdown
    const platformStats = await prisma.messageQueue.groupBy({
      by: ['platform', 'status'],
      where: {
        lead: { workspaceId },
      },
      _count: true,
    });

    // Format platform stats
    const byPlatform: Record<string, Record<string, number>> = {};
    for (const stat of platformStats) {
      if (!byPlatform[stat.platform]) {
        byPlatform[stat.platform] = {};
      }
      byPlatform[stat.platform][stat.status] = stat._count;
    }

    res.json({
      success: true,
      data: {
        summary: {
          queued: totalQueued,
          pending: totalPending,
          sent: totalSent,
          failed: totalFailed,
          blocked: totalBlocked,
          total: totalQueued + totalPending + totalSent + totalFailed + totalBlocked,
        },
        byPlatform,
        recent: recentMessages,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /messaging/messages - List messages with filters
messagingRouter.get('/messages', validate(queueFiltersSchema, 'query'), async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;
    const { status, platform, leadId, agentId, limit, offset } = req.query as z.infer<typeof queueFiltersSchema>;

    // Build where clause
    const where: Record<string, unknown> = {
      lead: { workspaceId },
    };

    if (status) where.status = status;
    if (platform) where.platform = platform;
    if (leadId) where.leadId = leadId;
    if (agentId) where.agentId = agentId;

    // Agent can only see their assigned messages
    if (req.user!.workspaceRole === 'agent') {
      where.agentId = req.user!.id;
    }

    const [messages, total] = await Promise.all([
      prisma.messageQueue.findMany({
        where,
        include: {
          lead: {
            select: {
              id: true,
              fullName: true,
              username: true,
              avatarUrl: true,
              profileUrl: true,
            },
          },
          agent: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.messageQueue.count({ where }),
    ]);

    res.json({
      success: true,
      data: messages,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /messaging/messages/:id - Get single message
messagingRouter.get('/messages/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspaceId;

    const message = await prisma.messageQueue.findFirst({
      where: {
        id,
        lead: { workspaceId },
      },
      include: {
        lead: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
            avatarUrl: true,
            profileUrl: true,
            platform: true,
          },
        },
        agent: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundError('Message');
    }

    // Agent can only see their assigned messages
    if (req.user!.workspaceRole === 'agent' && message.agentId !== req.user!.id) {
      throw new NotFoundError('Message');
    }

    res.json({
      success: true,
      data: message,
    });
  } catch (error) {
    next(error);
  }
});

// POST /messaging/messages - Queue a new message
messagingRouter.post(
  '/messages',
  authorize('owner', 'admin', 'manager', 'agent'),
  validate(createMessageSchema),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const { leadId, platform, messageType, content, scheduledAt, priority, metadata } = req.body;

      // Verify lead exists and belongs to workspace
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, workspaceId },
      });

      if (!lead) {
        throw new NotFoundError('Lead');
      }

      // Agent can only message assigned leads
      if (req.user!.workspaceRole === 'agent' && lead.assignedToId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          error: 'You can only message leads assigned to you',
        });
      }

      // Check if lead has a profile URL for the platform
      if (!lead.profileUrl && platform === 'linkedin') {
        return res.status(400).json({
          success: false,
          error: 'Lead must have a LinkedIn profile URL to send messages',
        });
      }

      // Create message queue entry
      const message = await prisma.messageQueue.create({
        data: {
          leadId,
          platform,
          messageType,
          content,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
          priority,
          agentId: req.user!.id,
          status: scheduledAt && new Date(scheduledAt) > new Date() ? 'queued' : 'pending',
          metadata: metadata || {},
          attempts: 0,
        },
        include: {
          lead: {
            select: {
              id: true,
              fullName: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      });

      // Create activity
      await prisma.activity.create({
        data: {
          type: 'message_queued',
          leadId,
          userId: req.user!.id,
          metadata: {
            messageId: message.id,
            platform,
            messageType,
            scheduledAt: message.scheduledAt,
          },
        },
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

// POST /messaging/messages/bulk - Bulk queue messages
messagingRouter.post(
  '/messages/bulk',
  authorize('owner', 'admin', 'manager'),
  validate(bulkMessageSchema),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const { leadIds, platform, messageType, content, scheduledAt, priority } = req.body;

      // Verify all leads exist and belong to workspace
      const leads = await prisma.lead.findMany({
        where: {
          id: { in: leadIds },
          workspaceId,
        },
      });

      if (leads.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No valid leads found',
        });
      }

      const foundLeadIds = leads.map((l) => l.id);
      const notFoundLeadIds = leadIds.filter((id: string) => !foundLeadIds.includes(id));

      // Queue messages
      const messages = await prisma.messageQueue.createMany({
        data: leads.map((lead) => ({
          leadId: lead.id,
          platform,
          messageType,
          content,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
          priority,
          agentId: req.user!.id,
          status: scheduledAt && new Date(scheduledAt) > new Date() ? 'queued' : 'pending',
          metadata: {},
          attempts: 0,
        })),
      });

      // Create activities for each lead
      await prisma.activity.createMany({
        data: leads.map((lead) => ({
          type: 'message_queued',
          leadId: lead.id,
          userId: req.user!.id,
          metadata: {
            platform,
            messageType,
            scheduledAt: scheduledAt,
            bulk: true,
          },
        })),
      });

      res.status(201).json({
        success: true,
        data: {
          queued: messages.count,
          notFound: notFoundLeadIds.length,
          notFoundLeads: notFoundLeadIds.length > 0 ? notFoundLeadIds : undefined,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /messaging/messages/:id/cancel - Cancel a queued message
messagingRouter.patch('/messages/:id/cancel', authorize('owner', 'admin', 'manager', 'agent'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspaceId;

    const message = await prisma.messageQueue.findFirst({
      where: {
        id,
        lead: { workspaceId },
      },
    });

    if (!message) {
      throw new NotFoundError('Message');
    }

    // Agent can only cancel their own messages
    if (req.user!.workspaceRole === 'agent' && message.agentId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: 'You can only cancel your own messages',
      });
    }

    // Can only cancel queued or pending messages
    if (!['queued', 'pending'].includes(message.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel message with status '${message.status}'`,
      });
    }

    const updatedMessage = await prisma.messageQueue.update({
      where: { id },
      data: {
        status: 'cancelled',
        metadata: {
          ...message.metadata,
          cancelledAt: new Date().toISOString(),
          cancelledBy: req.user!.id,
        },
      },
    });

    // Create activity
    await prisma.activity.create({
      data: {
        type: 'message_cancelled',
        leadId: message.leadId,
        userId: req.user!.id,
        metadata: {
          messageId: message.id,
        },
      },
    });

    res.json({
      success: true,
      data: updatedMessage,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /messaging/messages/:id/retry - Retry a failed message
messagingRouter.patch('/messages/:id/retry', authorize('owner', 'admin', 'manager', 'agent'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspaceId;

    const message = await prisma.messageQueue.findFirst({
      where: {
        id,
        lead: { workspaceId },
      },
    });

    if (!message) {
      throw new NotFoundError('Message');
    }

    // Agent can only retry their own messages
    if (req.user!.workspaceRole === 'agent' && message.agentId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: 'You can only retry your own messages',
      });
    }

    // Can only retry failed or blocked messages
    if (!['failed', 'blocked'].includes(message.status)) {
      return res.status(400).json({
        success: false,
        error: `Can only retry messages with status 'failed' or 'blocked'`,
      });
    }

    const updatedMessage = await prisma.messageQueue.update({
      where: { id },
      data: {
        status: 'pending',
        attempts: 0,
        lastError: null,
        metadata: {
          ...message.metadata,
          retriedAt: new Date().toISOString(),
          retriedBy: req.user!.id,
        },
      },
    });

    // Create activity
    await prisma.activity.create({
      data: {
        type: 'message_retried',
        leadId: message.leadId,
        userId: req.user!.id,
        metadata: {
          messageId: message.id,
        },
      },
    });

    res.json({
      success: true,
      data: updatedMessage,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /messaging/messages/:id - Delete a message (only queued/pending)
messagingRouter.delete('/messages/:id', authorize('owner', 'admin', 'manager'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspaceId;

    const message = await prisma.messageQueue.findFirst({
      where: {
        id,
        lead: { workspaceId },
      },
    });

    if (!message) {
      throw new NotFoundError('Message');
    }

    // Can only delete queued or pending messages
    if (!['queued', 'pending', 'cancelled', 'failed'].includes(message.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete message with status '${message.status}'`,
      });
    }

    await prisma.messageQueue.delete({
      where: { id },
    });

    // Create activity
    await prisma.activity.create({
      data: {
        type: 'message_deleted',
        leadId: message.leadId,
        userId: req.user!.id,
        metadata: {
          messageId: id,
          platform: message.platform,
          messageType: message.messageType,
        },
      },
    });

    res.json({
      success: true,
      data: {
        message: 'Message deleted successfully',
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /messaging/stats - Get messaging statistics
messagingRouter.get('/stats', async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;
    const { platform, days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (parseInt(days as string) || 30));

    const where: Record<string, unknown> = {
      lead: { workspaceId },
      createdAt: { gte: startDate },
    };

    if (platform) {
      where.platform = platform as string;
    }

    // Get various statistics
    const [
      totalMessages,
      sentMessages,
      failedMessages,
      byStatus,
      byPlatform,
      byType,
      recentFailures,
    ] = await Promise.all([
      prisma.messageQueue.count({ where }),
      prisma.messageQueue.count({
        where: { ...where, status: 'sent' },
      }),
      prisma.messageQueue.count({
        where: { ...where, status: 'failed' },
      }),
      prisma.messageQueue.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      prisma.messageQueue.groupBy({
        by: ['platform'],
        where,
        _count: true,
      }),
      prisma.messageQueue.groupBy({
        by: ['messageType'],
        where,
        _count: true,
      }),
      prisma.messageQueue.findMany({
        where: { ...where, status: 'failed' },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        include: {
          lead: {
            select: {
              id: true,
              fullName: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      }),
    ]);

    // Calculate success rate
    const successRate = totalMessages > 0 ? Math.round((sentMessages / totalMessages) * 100) : 0;

    res.json({
      success: true,
      data: {
        period: {
          days: parseInt(days as string) || 30,
          startDate,
        },
        overview: {
          total: totalMessages,
          sent: sentMessages,
          failed: failedMessages,
          successRate,
        },
        breakdown: {
          byStatus: byStatus.reduce((acc, item) => {
            acc[item.status] = item._count;
            return acc;
          }, {} as Record<string, number>),
          byPlatform: byPlatform.reduce((acc, item) => {
            acc[item.platform] = item._count;
            return acc;
          }, {} as Record<string, number>),
          byType: byType.reduce((acc, item) => {
            acc[item.messageType] = item._count;
            return acc;
          }, {} as Record<string, number>),
        },
        recentFailures,
      },
    });
  } catch (error) {
    next(error);
  }
});
