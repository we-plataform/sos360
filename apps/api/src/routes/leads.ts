import { Router } from 'express';
import { prisma } from '@sos360/database';
import {
  createLeadSchema,
  updateLeadSchema,
  importLeadsSchema,
  leadFiltersSchema,
  PAGINATION_DEFAULTS,
  calculateOffset,
  calculateTotalPages,
  parseSort,
} from '@sos360/shared';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { importRateLimit } from '../middleware/rate-limit.js';
import { NotFoundError } from '../lib/errors.js';
import { z } from 'zod';

export const leadsRouter = Router();

// All routes require authentication
leadsRouter.use(authenticate);

// GET /leads - List leads
leadsRouter.get('/', validate(leadFiltersSchema, 'query'), async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;
    const {
      page = PAGINATION_DEFAULTS.page,
      limit = PAGINATION_DEFAULTS.limit,
      platform,
      status,
      tags,
      assignedTo,
      search,
      sort,
      scoreMin,
      scoreMax,
    } = req.query as z.infer<typeof leadFiltersSchema>;

    const { field: sortField, direction: sortDirection } = parseSort(sort);

    // Build where clause
    const where: Record<string, unknown> = { workspaceId };

    if (platform) where.platform = platform;
    if (status) where.status = status;
    if (assignedTo) where.assignedToId = assignedTo;
    if (scoreMin !== undefined || scoreMax !== undefined) {
      where.score = {
        ...(scoreMin !== undefined && { gte: scoreMin }),
        ...(scoreMax !== undefined && { lte: scoreMax }),
      };
    }
    if (tags) {
      const tagIds = tags.split(',');
      where.tags = { some: { tagId: { in: tagIds } } };
    }
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Agent can only see assigned leads
    if (req.user!.role === 'agent') {
      where.assignedToId = req.user!.id;
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          assignedTo: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
          tags: {
            include: {
              tag: { select: { id: true, name: true, color: true } },
            },
          },
        },
        orderBy: { [sortField]: sortDirection },
        skip: calculateOffset(page, limit),
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    // Format response
    const formattedLeads = leads.map((lead) => ({
      ...lead,
      tags: lead.tags.map((lt) => lt.tag),
    }));

    res.json({
      success: true,
      data: formattedLeads,
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

// POST /leads - Create lead
leadsRouter.post('/', authorize('owner', 'admin', 'manager', 'agent'), validate(createLeadSchema), async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;
    const { tags, ...leadData } = req.body;

    const lead = await prisma.lead.create({
      data: {
        ...leadData,
        workspaceId,
        ...(tags?.length && {
          tags: {
            create: tags.map((tagId: string) => ({ tagId })),
          },
        }),
      },
      include: {
        assignedTo: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    // Create activity
    await prisma.activity.create({
      data: {
        type: 'lead_created',
        leadId: lead.id,
        userId: req.user!.id,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        ...lead,
        tags: lead.tags.map((lt) => lt.tag),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /leads/import - Import leads in bulk
leadsRouter.post(
  '/import',
  authorize('owner', 'admin', 'manager', 'agent'),
  importRateLimit,
  validate(importLeadsSchema),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const { platform, sourceUrl, leads, tags } = req.body;

      // Create import job
      const importJob = await prisma.importJob.create({
        data: {
          workspaceId,
          platform,
          sourceUrl,
          totalLeads: leads.length,
          status: 'processing',
        },
      });

      // Process leads
      let imported = 0;
      let duplicates = 0;
      let errors = 0;

      for (const leadData of leads) {
        try {
          // Clean and validate lead data
          const cleanedLeadData = {
            username: leadData.username || null,
            fullName: leadData.fullName || null,
            profileUrl: leadData.profileUrl || (leadData.username ? `${platform}:${leadData.username}` : null),
            avatarUrl: leadData.avatarUrl || null,
            bio: leadData.bio || null,
            email: leadData.email || null,
            phone: leadData.phone || null,
            website: leadData.website || null,
            location: leadData.location || null,
            followersCount: leadData.followersCount || null,
            followingCount: leadData.followingCount || null,
            postsCount: leadData.postsCount || null,
            verified: leadData.verified || false,
          };

          // Ensure profileUrl exists for unique constraint
          const profileUrl = cleanedLeadData.profileUrl || `${platform}:${cleanedLeadData.username || 'unknown'}`;

          await prisma.lead.upsert({
            where: {
              workspaceId_platform_profileUrl: {
                workspaceId,
                platform,
                profileUrl,
              },
            },
            create: {
              ...cleanedLeadData,
              platform,
              workspaceId,
              sourceUrl: sourceUrl || null,
              profileUrl,
              ...(tags?.length && {
                tags: {
                  create: tags.map((tagId: string) => ({ tagId })),
                },
              }),
            },
            update: {
              ...cleanedLeadData,
              profileUrl,
              updatedAt: new Date(),
            },
          });
          imported++;
        } catch (err: unknown) {
          console.error('Error importing lead:', err, leadData);
          if ((err as { code?: string }).code === 'P2002') {
            duplicates++;
          } else {
            errors++;
            console.error('Import error details:', err);
          }
        }
      }

      // Update import job
      await prisma.importJob.update({
        where: { id: importJob.id },
        data: {
          status: 'completed',
          progress: 100,
          result: { total: leads.length, imported, duplicates, errors },
          completedAt: new Date(),
        },
      });

      res.status(202).json({
        success: true,
        data: {
          jobId: importJob.id,
          status: 'completed',
          totalLeads: leads.length,
          result: { imported, duplicates, errors },
          message: `Importação concluída: ${imported} leads importados`,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /leads/:id - Get single lead
leadsRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspaceId;

    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
      include: {
        assignedTo: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            user: {
              select: { id: true, fullName: true },
            },
          },
        },
      },
    });

    if (!lead) {
      throw new NotFoundError('Lead');
    }

    res.json({
      success: true,
      data: {
        ...lead,
        tags: lead.tags.map((lt) => lt.tag),
      },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /leads/:id - Update lead
leadsRouter.patch('/:id', authorize('owner', 'admin', 'manager', 'agent'), validate(updateLeadSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspaceId;
    const updates = req.body;

    // Check lead exists
    const existingLead = await prisma.lead.findFirst({
      where: { id, workspaceId },
    });

    if (!existingLead) {
      throw new NotFoundError('Lead');
    }

    // Agent can only update assigned leads
    if (req.user!.role === 'agent' && existingLead.assignedToId !== req.user!.id) {
      throw new NotFoundError('Lead');
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: updates,
      include: {
        assignedTo: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    // Create activity for status change
    if (updates.status && updates.status !== existingLead.status) {
      await prisma.activity.create({
        data: {
          type: 'status_changed',
          leadId: lead.id,
          userId: req.user!.id,
          metadata: { from: existingLead.status, to: updates.status },
        },
      });
    }

    res.json({
      success: true,
      data: {
        ...lead,
        tags: lead.tags.map((lt) => lt.tag),
      },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /leads/:id - Delete lead
leadsRouter.delete('/:id', authorize('owner', 'admin', 'manager'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspaceId;

    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
    });

    if (!lead) {
      throw new NotFoundError('Lead');
    }

    await prisma.lead.delete({ where: { id } });

    res.json({
      success: true,
      data: { message: 'Lead removido com sucesso' },
    });
  } catch (error) {
    next(error);
  }
});

// POST /leads/:id/tags - Add tags
leadsRouter.post('/:id/tags', authorize('owner', 'admin', 'manager', 'agent'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tagIds } = req.body;
    const workspaceId = req.user!.workspaceId;

    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
    });

    if (!lead) {
      throw new NotFoundError('Lead');
    }

    // Add tags
    await prisma.leadTag.createMany({
      data: tagIds.map((tagId: string) => ({ leadId: id, tagId })),
      skipDuplicates: true,
    });

    const updatedLead = await prisma.lead.findUnique({
      where: { id },
      include: {
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    res.json({
      success: true,
      data: {
        id: updatedLead!.id,
        tags: updatedLead!.tags.map((lt) => lt.tag),
      },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /leads/:id/tags/:tagId - Remove tag
leadsRouter.delete('/:id/tags/:tagId', authorize('owner', 'admin', 'manager', 'agent'), async (req, res, next) => {
  try {
    const { id, tagId } = req.params;
    const workspaceId = req.user!.workspaceId;

    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
    });

    if (!lead) {
      throw new NotFoundError('Lead');
    }

    await prisma.leadTag.delete({
      where: { leadId_tagId: { leadId: id, tagId } },
    });

    res.json({
      success: true,
      data: { message: 'Tag removida com sucesso' },
    });
  } catch (error) {
    next(error);
  }
});

// POST /leads/:id/assign - Assign lead to user
leadsRouter.post('/:id/assign', authorize('owner', 'admin', 'manager'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const workspaceId = req.user!.workspaceId;

    const lead = await prisma.lead.findFirst({
      where: { id, workspaceId },
    });

    if (!lead) {
      throw new NotFoundError('Lead');
    }

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: { assignedToId: userId },
      include: {
        assignedTo: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    // Create activity
    await prisma.activity.create({
      data: {
        type: 'assigned',
        leadId: id,
        userId: req.user!.id,
        metadata: { assignedTo: userId },
      },
    });

    res.json({
      success: true,
      data: updatedLead,
    });
  } catch (error) {
    next(error);
  }
});
