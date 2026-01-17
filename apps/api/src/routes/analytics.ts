import { Router } from 'express';
import { prisma } from '@sos360/database';
import { authenticate } from '../middleware/auth.js';

export const analyticsRouter = Router();

analyticsRouter.use(authenticate);

// GET /analytics/overview - Dashboard metrics
analyticsRouter.get('/overview', async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;
    const { startDate, endDate, platform } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const baseWhere: Record<string, unknown> = {
      workspaceId,
      createdAt: { gte: start, lte: end },
    };

    if (platform) {
      baseWhere.platform = platform;
    }

    // Get lead stats
    const [totalLeads, newLeads, leadsLastPeriod] = await Promise.all([
      prisma.lead.count({ where: { workspaceId } }),
      prisma.lead.count({ where: baseWhere }),
      prisma.lead.count({
        where: {
          workspaceId,
          createdAt: {
            gte: new Date(start.getTime() - (end.getTime() - start.getTime())),
            lt: start,
          },
        },
      }),
    ]);

    const growth = leadsLastPeriod > 0 ? (newLeads - leadsLastPeriod) / leadsLastPeriod : 0;

    // Get conversation stats
    const [totalConversations, conversationsWithResponses] = await Promise.all([
      prisma.conversation.count({
        where: { lead: { workspaceId } },
      }),
      prisma.conversation.count({
        where: {
          lead: { workspaceId },
          messages: { some: { senderType: 'lead' } },
        },
      }),
    ]);

    const responseRate = totalConversations > 0 ? conversationsWithResponses / totalConversations : 0;

    // Get leads by platform
    const leadsByPlatform = await prisma.lead.groupBy({
      by: ['platform'],
      where: { workspaceId },
      _count: { id: true },
    });

    const platformCounts = leadsByPlatform.reduce(
      (acc, item) => {
        acc[item.platform] = item._count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    // Get leads by status
    const leadsByStatus = await prisma.lead.groupBy({
      by: ['status'],
      where: { workspaceId },
      _count: { id: true },
    });

    const statusCounts = leadsByStatus.reduce(
      (acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    res.json({
      success: true,
      data: {
        period: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
        },
        leads: {
          total: totalLeads,
          new: newLeads,
          growth,
        },
        conversations: {
          total: totalConversations,
          started: newLeads,
          responseRate,
        },
        byPlatform: platformCounts,
        byStatus: statusCounts,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /analytics/funnel - Conversion funnel
analyticsRouter.get('/funnel', async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;

    const statusOrder = ['new', 'contacted', 'responded', 'qualified', 'scheduled', 'closed'];

    const leadsByStatus = await prisma.lead.groupBy({
      by: ['status'],
      where: { workspaceId },
      _count: { id: true },
    });

    const totalLeads = leadsByStatus.reduce((sum, item) => sum + item._count.id, 0);

    const stages = statusOrder.map((status) => {
      const found = leadsByStatus.find((item) => item.status === status);
      const count = found?._count.id || 0;
      return {
        name: status.charAt(0).toUpperCase() + status.slice(1),
        count,
        rate: totalLeads > 0 ? count / totalLeads : 0,
      };
    });

    // Calculate conversion rates between stages
    const conversionRates: Record<string, number> = {};
    for (let i = 0; i < stages.length - 1; i++) {
      const from = stages[i];
      const to = stages[i + 1];
      const key = `${statusOrder[i]}To${statusOrder[i + 1].charAt(0).toUpperCase() + statusOrder[i + 1].slice(1)}`;
      conversionRates[key] = from.count > 0 ? to.count / from.count : 0;
    }

    res.json({
      success: true,
      data: {
        stages,
        conversionRates,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /analytics/timeline - Activity over time
analyticsRouter.get('/timeline', async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;
    const { interval = 'day', metric = 'leads' } = req.query;

    const days = interval === 'week' ? 12 : interval === 'month' ? 12 : 30;
    const points: Array<{ date: string; value: number }> = [];

    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      let start: Date;
      let end: Date;
      let dateLabel: string;

      if (interval === 'month') {
        start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        dateLabel = start.toISOString().slice(0, 7);
      } else if (interval === 'week') {
        const dayOfWeek = now.getDay();
        start = new Date(now.getTime() - (i * 7 + dayOfWeek) * 24 * 60 * 60 * 1000);
        end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
        end.setHours(23, 59, 59, 999);
        dateLabel = start.toISOString().split('T')[0];
      } else {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        end = new Date(start);
        end.setHours(23, 59, 59, 999);
        dateLabel = start.toISOString().split('T')[0];
      }

      let count = 0;

      if (metric === 'leads') {
        count = await prisma.lead.count({
          where: {
            workspaceId,
            createdAt: { gte: start, lte: end },
          },
        });
      } else if (metric === 'conversations') {
        count = await prisma.conversation.count({
          where: {
            lead: { workspaceId },
            createdAt: { gte: start, lte: end },
          },
        });
      } else if (metric === 'messages') {
        count = await prisma.message.count({
          where: {
            conversation: { lead: { workspaceId } },
            sentAt: { gte: start, lte: end },
          },
        });
      }

      points.push({ date: dateLabel, value: count });
    }

    res.json({
      success: true,
      data: {
        interval,
        metric,
        points,
      },
    });
  } catch (error) {
    next(error);
  }
});
