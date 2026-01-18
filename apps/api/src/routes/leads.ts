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
import type { Server } from 'socket.io';

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
    if (req.user!.workspaceRole === 'agent') {
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
          socialProfiles: true,
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
      tags: lead.tags.map((lt: { tag: { id: string; name: string; color: string } }) => lt.tag),
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

    const profileUrl = leadData.profileUrl || (leadData.username ? `${leadData.platform}:${leadData.username}` : null);
    if (!profileUrl) {
      // Should be caught by schema validation usually, but strictly required for our logic
      return res.status(400).json({ success: false, error: 'Cannot determine profile URL' });
    }

    // 1. Try to find existing lead by Social Profile OR Email OR Phone
    const existingLead = await prisma.lead.findFirst({
      where: {
        workspaceId,
        OR: [
          {
            socialProfiles: {
              some: {
                platform: leadData.platform,
                profileUrl: profileUrl
              }
            }
          },
          // Legacy check
          {
            platform: leadData.platform,
            profileUrl: profileUrl
          },
          ...(leadData.email ? [{ email: leadData.email }] : []),
          ...(leadData.phone ? [{ phone: leadData.phone }] : [])
        ]
      }
    });

    let lead;
    const profileData = {
      platform: leadData.platform,
      username: leadData.username,
      profileUrl: profileUrl,
      avatarUrl: leadData.avatarUrl,
      bio: leadData.bio,
      followersCount: leadData.followersCount,
      followingCount: leadData.followingCount,
      postsCount: leadData.postsCount,
      verified: leadData.verified || false,
      workspaceId // Add workspaceId to profile
    };

    if (existingLead) {
      // Update existing lead and upsert social profile
      lead = await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          ...leadData, // Update lead fields (e.g. status, score if changed)
          socialProfiles: {
            upsert: {
              where: {
                workspaceId_platform_profileUrl: {
                  workspaceId,
                  platform: leadData.platform,
                  profileUrl: profileUrl
                }
              },
              create: profileData,
              update: profileData
            }
          },
          ...(tags?.length && {
            tags: {
              create: tags.map((tagId: string) => ({ tagId })), // This might add duplicate tags if not careful, but schema handles unique constraint on lead_tags
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
          socialProfiles: true
        },
      });
    } else {
      // Create new lead
      lead = await prisma.lead.create({
        data: {
          ...leadData,
          workspaceId,
          profileUrl, // Legacy field
          socialProfiles: {
            create: profileData
          },
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
          socialProfiles: true
        },
      });
    }

    // Emit socket event
    const io = req.app.get('io') as Server;
    io.to(`workspace:${workspaceId}`).emit(existingLead ? 'lead:updated' : 'lead:created', {
      ...lead,
      tags: lead.tags.map((lt: { tag: { id: string; name: string; color: string } }) => lt.tag),
    });

    // Create activity
    await prisma.activity.create({
      data: {
        type: existingLead ? 'lead_updated' : 'lead_created',
        leadId: lead.id,
        userId: req.user!.id,
        metadata: {
          merged: !!existingLead,
          platform: leadData.platform
        }
      },
    });

    res.status(existingLead ? 200 : 201).json({
      success: true,
      data: {
        ...lead,
        tags: lead.tags.map((lt: { tag: { id: string; name: string; color: string } }) => lt.tag),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /leads/analyze - Analyze lead with AI
leadsRouter.post(
  '/analyze',
  authorize('owner', 'admin', 'manager', 'agent'),
  async (req, res, next) => {
    try {
      const { profile, criteria } = req.body;

      if (!profile || !profile.username) {
        return res.status(400).json({
          success: false,
          error: 'Profile data with username is required'
        });
      }

      if (!criteria) {
        return res.status(400).json({
          success: false,
          error: 'Qualification criteria is required'
        });
      }

      const { analyzeLead } = await import('../lib/openai.js');
      const result = await analyzeLead(profile, criteria);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

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
            score: leadData.score || undefined, // Support score from analysis
            notes: leadData.analysisReason ? `Qualificação AI: ${leadData.analysisReason}` : undefined,
          };

          // Ensure profileUrl exists
          const profileUrl = cleanedLeadData.profileUrl || `${platform}:${cleanedLeadData.username || 'unknown'}`;

          // 1. Try to find existing lead
          const existingLead = await prisma.lead.findFirst({
            where: {
              workspaceId,
              OR: [
                { socialProfiles: { some: { platform, profileUrl } } },
                { platform, profileUrl },
                ...(cleanedLeadData.email ? [{ email: cleanedLeadData.email }] : []),
                ...(cleanedLeadData.phone ? [{ phone: cleanedLeadData.phone }] : [])
              ]
            }
          });

          const profileData = {
            platform,
            username: cleanedLeadData.username,
            profileUrl,
            avatarUrl: cleanedLeadData.avatarUrl,
            bio: cleanedLeadData.bio,
            followersCount: cleanedLeadData.followersCount,
            followingCount: cleanedLeadData.followingCount,
            postsCount: cleanedLeadData.postsCount,
            verified: cleanedLeadData.verified,
            workspaceId
          };

          if (existingLead) {
            await prisma.lead.update({
              where: { id: existingLead.id },
              data: {
                ...cleanedLeadData,
                profileUrl, // Update legacy profile URL to latest? Or keep original? Let's update.
                updatedAt: new Date(),
                socialProfiles: {
                  upsert: {
                    where: {
                      workspaceId_platform_profileUrl: {
                        workspaceId,
                        platform,
                        profileUrl
                      }
                    },
                    create: profileData,
                    update: profileData
                  }
                }
              }
            });
          } else {
            await prisma.lead.create({
              data: {
                ...cleanedLeadData,
                platform,
                workspaceId,
                sourceUrl: sourceUrl || null,
                profileUrl,
                socialProfiles: {
                  create: profileData
                },
                ...(tags?.length && {
                  tags: {
                    create: tags.map((tagId: string) => ({ tagId })),
                  },
                }),
              }
            });
          }
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
        socialProfiles: true,
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
        tags: lead.tags.map((lt: { tag: { id: string; name: string; color: string } }) => lt.tag),
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
    if (req.user!.workspaceRole === 'agent' && existingLead.assignedToId !== req.user!.id) {
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
        socialProfiles: true,
      },
    });

    // Emit socket event
    const io = req.app.get('io') as Server;
    io.to(`workspace:${workspaceId}`).emit('lead:updated', {
      ...lead,
      tags: lead.tags.map((lt: { tag: { id: string; name: string; color: string } }) => lt.tag),
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
        tags: lead.tags.map((lt: { tag: { id: string; name: string; color: string } }) => lt.tag),
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

    // Emit socket event
    const io = req.app.get('io') as Server;
    io.to(`workspace:${workspaceId}`).emit('lead:deleted', { id });

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

    // Emit socket event
    const io = req.app.get('io') as Server;
    io.to(`workspace:${workspaceId}`).emit('lead:updated', {
      ...updatedLead!,
      tags: updatedLead!.tags.map((lt: { tag: { id: string; name: string; color: string } }) => lt.tag),
    });

    res.json({
      success: true,
      data: {
        id: updatedLead!.id,
        tags: updatedLead!.tags.map((lt: { tag: { id: string; name: string; color: string } }) => lt.tag),
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

    // Get updated lead to emit
    const updatedLead = await prisma.lead.findUnique({
      where: { id },
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

    if (updatedLead) {
      // Emit socket event
      const io = req.app.get('io') as Server;
      io.to(`workspace:${workspaceId}`).emit('lead:updated', {
        ...updatedLead,
        tags: updatedLead.tags.map((lt: { tag: { id: string; name: string; color: string } }) => lt.tag),
      });
    }

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

    // Emit socket event
    const io = req.app.get('io') as Server;
    io.to(`workspace:${workspaceId}`).emit('lead:updated', updatedLead);

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
