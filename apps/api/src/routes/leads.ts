import { Router } from 'express';
import { prisma } from '@lia360/database';
import {
  createLeadSchema,
  updateLeadSchema,
  importLeadsSchema,
  importPostSchema,
  leadFiltersSchema,
  PAGINATION_DEFAULTS,
  calculateOffset,
  calculateTotalPages,
  parseSort,
} from '@lia360/shared';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { importRateLimit, analyzeRateLimit, analyzeBatchRateLimit, analyzeDeepRateLimit, enrichRateLimit } from '../middleware/rate-limit.js';
import { NotFoundError } from '../lib/errors.js';
import { z } from 'zod';
import type { Server } from 'socket.io';
import { calculateLeadScore } from '../services/scoring.js';

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
          address: true,
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
    const { tags, address, pipelineStageId, ...leadData } = req.body;

    // DEBUG: Log lead creation payload
    console.log('[DEBUG-API] Creating lead payload:', { pipelineStageId, leadData });


    let profileUrl = leadData.profileUrl;

    if (!profileUrl) {
      if (leadData.platform && leadData.username) {
        profileUrl = `${leadData.platform}:${leadData.username}`;
      } else if (leadData.email) {
        profileUrl = `email:${leadData.email}`;
      } else if (leadData.phone) {
        profileUrl = `phone:${leadData.phone}`;
      } else {
        // Fallback for manual leads without contacts (though schema requires email/phone usually)
        profileUrl = `manual:${Date.now()}`;
      }
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
    const profileData = leadData.platform ? {
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
    } : null;

    if (existingLead) {
      // Update existing lead and upsert social profile
      lead = await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          ...leadData, // Update lead fields (e.g. status, score if changed)
          ...(pipelineStageId && { pipelineStageId }), // Explicitly update pipeline stage
          ...(profileData && {
            socialProfiles: {
              upsert: {
                where: {
                  workspaceId_platform_profileUrl: {
                    workspaceId,
                    platform: leadData.platform!,
                    profileUrl: profileUrl
                  }
                },
                create: profileData,
                update: profileData
              }
            }
          }),
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
          ...(pipelineStageId && { pipelineStageId }), // Explicitly set pipeline stage
          ...(profileData && {
            socialProfiles: {
              create: profileData
            }
          }),
          ...(tags?.length && {
            tags: {
              create: tags.map((tagId: string) => ({ tagId })),
            },
          }),
          ...(address && Object.values(address).some(v => v !== null) && {
            address: {
              create: address
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
          socialProfiles: true,
          address: true,
        },
      });

      // DEBUG: Log created lead
      console.log('[DEBUG-API] Lead created:', { id: lead.id, pipelineStageId: lead.pipelineStageId });

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
  analyzeRateLimit,
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

// POST /leads/analyze-batch - Analyze multiple leads with AI in one call
leadsRouter.post(
  '/analyze-batch',
  authorize('owner', 'admin', 'manager', 'agent'),
  analyzeBatchRateLimit,
  async (req, res, next) => {
    try {
      const { profiles, criteria } = req.body;

      if (!profiles || !Array.isArray(profiles) || profiles.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Profiles array is required'
        });
      }

      if (profiles.length > 50) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 50 profiles per batch'
        });
      }

      if (!criteria) {
        return res.status(400).json({
          success: false,
          error: 'Qualification criteria is required'
        });
      }

      const { analyzeLeadBatch } = await import('../lib/openai.js');
      const results = await analyzeLeadBatch(profiles, criteria);

      res.json({
        success: true,
        data: {
          results,
          analyzed: results.length,
          qualified: results.filter(r => r.qualified).length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /leads/analyze-deep - Deep behavioral analysis with Multimodal AI
leadsRouter.post(
  '/analyze-deep',
  authorize('owner', 'admin', 'manager', 'agent'),
  analyzeDeepRateLimit,
  async (req, res, next) => {
    try {
      const { leadId, profile, posts } = req.body;

      if (!profile || !posts) {
        return res.status(400).json({
          success: false,
          error: 'Profile and Posts data are required'
        });
      }

      const { analyzeLeadDeep } = await import('../lib/openai.js');
      const result = await analyzeLeadDeep(profile, posts);

      // If we have a leadId, save the result
      if (leadId) {
        await prisma.leadBehavior.upsert({
          where: { leadId },
          create: {
            leadId,
            maritalStatus: result.maritalStatus,
            hasChildren: result.hasChildren,
            deviceType: result.deviceType,
            interests: result.interests,
            personalityType: result.personalityType,
            buyingIntent: result.buyingIntent,
            confidenceScore: result.confidenceScore,
            rawAnalysis: result as any,
          },
          update: {
            maritalStatus: result.maritalStatus,
            hasChildren: result.hasChildren,
            deviceType: result.deviceType,
            interests: result.interests,
            personalityType: result.personalityType,
            buyingIntent: result.buyingIntent,
            confidenceScore: result.confidenceScore,
            rawAnalysis: result as any,
            updatedAt: new Date(),
          }
        });

        // Optionally update the lead score if high confidence
        if (result.confidenceScore > 80 && result.buyingIntent === 'High') {
          await prisma.lead.update({
            where: { id: leadId },
            data: { score: { increment: 10 } }
          });
        }
      }

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
      const { platform, sourceUrl, leads, tags, pipelineStageId } = req.body;

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
      const leadResults: { id: string; profileUrl: string }[] = [];


      for (const leadData of leads) {
        // DEBUG: Log received lead data with focus on avatarUrl
        console.log('[DEBUG] Processing lead - avatarUrl received:', leadData.avatarUrl ? `YES (${leadData.avatarUrl.substring(0, 50)}...)` : 'NO');
        console.log('[DEBUG] Full lead data:', JSON.stringify(leadData, null, 2));
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
            customFields: {
              ...(typeof leadData.customFields === 'object' ? leadData.customFields : {}),
              ...(leadData.posts ? { recentPosts: leadData.posts } : {})
            },
            lastInteractionAt: leadData.lastInteractionAt || undefined,

            // LinkedIn-specific fields
            headline: leadData.headline || null,
            company: leadData.company || null,
            industry: leadData.industry || null,
            connectionCount: leadData.connectionCount || null,

            // New expanded fields
            gender: leadData.gender || null,
            priority: leadData.priority || null,
            jobTitle: leadData.jobTitle || null,
            companySize: leadData.companySize || null,
          };

          // Process address if provided
          const addressData = leadData.address;

          // Ensure profileUrl exists
          const profileUrl = cleanedLeadData.profileUrl || `${platform}:${cleanedLeadData.username || 'unknown'}`;
          console.log('[DEBUG] Cleaned lead data:', JSON.stringify({ ...cleanedLeadData, profileUrl }, null, 2));

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

          let savedLead;
          // Select fields to ensure avatarUrl is returned
          const selectFields = {
            id: true,
            username: true,
            fullName: true,
            profileUrl: true,
            avatarUrl: true,
            platform: true,
          };

          if (existingLead) {
            savedLead = await prisma.lead.update({
              where: { id: existingLead.id },
              data: {
                ...cleanedLeadData,
                profileUrl,
                ...(pipelineStageId && { pipelineStageId }),
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
              },
              select: selectFields,
            });
          } else {
            savedLead = await prisma.lead.create({
              data: {
                ...cleanedLeadData,
                platform,
                workspaceId,
                sourceUrl: sourceUrl || null,
                profileUrl,
                ...(pipelineStageId && { pipelineStageId }),
                socialProfiles: {
                  create: profileData
                },
                ...(tags?.length && {
                  tags: {
                    create: tags.map((tagId: string) => ({ tagId })),
                  },
                }),
                ...(addressData && Object.values(addressData).some(v => v !== null) && {
                  address: {
                    create: addressData
                  },
                }),
              },
              select: selectFields,
            });
          }
          imported++;
          // DEBUG: Verify avatarUrl was saved
          console.log('[DEBUG] Lead saved - avatarUrl in DB:', savedLead.avatarUrl ? `YES (${savedLead.avatarUrl.substring(0, 50)}...)` : 'NO');
          leadResults.push({ id: savedLead.id, profileUrl: savedLead.profileUrl });
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
          leadResults // Return the list of imported IDs
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /leads/import-post - Import Instagram post data
// This creates a LeadPost entry for an existing lead (the post author)
leadsRouter.post(
  '/import-post',
  authorize('owner', 'admin', 'manager', 'agent'),
  validate(importPostSchema),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const { platform, postData, tags, pipelineStageId } = req.body;

      // Find the author's lead by Instagram username
      const authorUsername = postData.authorUsername;
      const profileUrl = `https://instagram.com/${authorUsername}`;

      const existingLead = await prisma.lead.findFirst({
        where: {
          workspaceId,
          OR: [
            { socialProfiles: { some: { platform, profileUrl } } },
            { platform, profileUrl },
          ]
        },
        include: {
          socialProfiles: true,
          leadPosts: true,
        }
      });

      if (!existingLead) {
        return res.status(404).json({
          success: false,
          error: `Lead not found for Instagram user @${authorUsername}. Please import the author's profile first.`,
        });
      }

      // Check if this post already exists for this lead
      const existingPost = await prisma.leadPost.findFirst({
        where: {
          leadId: existingLead.id,
          postUrl: postData.postUrl,
        }
      });

      if (existingPost) {
        // Update existing post
        await prisma.leadPost.update({
          where: { id: existingPost.id },
          data: {
            content: postData.caption || null,
            date: new Date().toISOString().split('T')[0], // Today's date
            likes: postData.likesCount,
            comments: postData.commentsCount,
            imageUrls: postData.imageUrls || [],
            postUrl: postData.postUrl,
            postType: 'post',
          }
        });
      } else {
        // Create new LeadPost
        await prisma.leadPost.create({
          data: {
            leadId: existingLead.id,
            content: postData.caption || null,
            date: new Date().toISOString().split('T')[0], // Today's date
            likes: postData.likesCount,
            comments: postData.commentsCount,
            imageUrls: postData.imageUrls || [],
            linkedUrl: postData.postUrl,
            postUrl: postData.postUrl,
            postType: 'post',
          }
        });
      }

      // Add tags if provided
      if (tags?.length) {
        for (const tagId of tags) {
          await prisma.leadTag.upsert({
            where: { leadId_tagId: { leadId: existingLead.id, tagId } },
            create: { leadId: existingLead.id, tagId },
            update: {},
          });
        }
      }

      // Update pipeline stage if provided
      if (pipelineStageId) {
        await prisma.lead.update({
          where: { id: existingLead.id },
          data: { pipelineStageId },
        });
      }

      // Fetch updated lead
      const updatedLead = await prisma.lead.findUnique({
        where: { id: existingLead.id },
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
          leadPosts: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      // Emit socket event
      const io = req.app.get('io') as Server;
      io.to(`workspace:${workspaceId}`).emit('lead:updated', {
        ...updatedLead,
        tags: updatedLead?.tags?.map((lt: { tag: { id: string; name: string; color: string } }) => lt.tag) || [],
      });

      // Create activity
      await prisma.activity.create({
        data: {
          type: 'lead_updated',
          leadId: existingLead.id,
          userId: req.user!.id,
          description: `Post data imported from Instagram`,
          metadata: { postUrl: postData.postUrl, platform: 'instagram' },
        },
      });

      res.json({
        success: true,
        data: {
          leadId: existingLead.id,
          message: 'Post data imported successfully',
          postUrl: postData.postUrl,
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
        behavior: true,
        address: true,
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            user: {
              select: { id: true, fullName: true },
            },
          },
        },
        // LinkedIn enrichment data
        experiences: {
          orderBy: { startDate: 'desc' },
        },
        educations: {
          orderBy: { startDate: 'desc' },
        },
        certifications: true,
        skills: {
          orderBy: { endorsementsCount: 'desc' },
        },
        languages: true,
        recommendations: true,
        volunteers: true,
        publications: true,
        patents: true,
        projects: true,
        courses: true,
        honors: true,
        organizations: true,
        featured: true,
        contactInfo: true,
        leadPosts: {
          orderBy: { createdAt: 'desc' },
          take: 10,
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
    const { address, ...updates } = req.body;

    // DEBUG: Log the incoming update request
    console.log('[DEBUG] PATCH /leads/:id - Received:', { id, workspaceId, updates, address });

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

    // Build update data with address upsert if provided
    const updateData: Record<string, unknown> = { ...updates };

    if (address && Object.values(address).some(v => v !== null)) {
      updateData.address = {
        upsert: {
          create: address,
          update: address,
        },
      };
    }

    let lead = await prisma.lead.update({
      where: { id },
      data: updateData,
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
        address: true,
      },
    });

    // Trigger automatic scoring if enabled
    try {
      const scoringConfig = await prisma.scoringConfig.findUnique({
        where: { workspaceId },
      });

      if (scoringConfig?.autoScoreOnUpdate) {
        await calculateLeadScore(id, workspaceId);

        // Fetch updated lead with new score
        lead = await prisma.lead.findUnique({
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
            socialProfiles: true,
            address: true,
          },
        }) as typeof lead;
      }
    } catch (error) {
      // Log error but don't fail the update
      console.error('Failed to calculate lead score:', error);
    }

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

// PATCH /leads/:id/enrich - Enrich lead with LinkedIn data
leadsRouter.patch('/:id/enrich', authorize('owner', 'admin', 'manager', 'agent'), enrichRateLimit, async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspaceId;
    const { enrichment } = req.body;

    console.log('[DEBUG] PATCH /leads/:id/enrich - Received:', { id, workspaceId, enrichment: Object.keys(enrichment || {}) });

    // Check lead exists
    const existingLead = await prisma.lead.findFirst({
      where: { id, workspaceId },
    });

    if (!existingLead) {
      throw new NotFoundError('Lead');
    }

    // Agent can only enrich assigned leads
    if (req.user!.workspaceRole === 'agent' && existingLead.assignedToId !== req.user!.id) {
      throw new NotFoundError('Lead');
    }

    if (!enrichment) {
      return res.status(400).json({ success: false, error: 'Enrichment data is required' });
    }

    let enrichedSections = 0;

    // Process each enrichment type with upsert
    const {
      experiences, educations, certifications, skills, languages,
      recommendations, volunteers, publications, patents, projects,
      courses, honors, organizations, featured, contactInfo, posts,
      companySize, jobTitle, address
    } = enrichment;

    // Process company size mapping from LinkedIn text (e.g., "1,001-5,000 employees")
    const mapCompanySize = (sizeText: string | undefined | null): string | null => {
      if (!sizeText) return null;
      const text = sizeText.toLowerCase().replace(/,/g, '');
      if (text.includes('10001') || text.includes('10000+') || text.includes('10001+')) return 'SIZE_10001_PLUS';
      if (text.includes('5001') || text.includes('5000')) return 'SIZE_5001_10000';
      if (text.includes('1001') || text.includes('1000')) return 'SIZE_1001_5000';
      if (text.includes('501') || text.includes('500')) return 'SIZE_501_1000';
      if (text.includes('201') || text.includes('200')) return 'SIZE_201_500';
      if (text.includes('51') || text.includes('50')) return 'SIZE_51_200';
      if (text.includes('11')) return 'SIZE_11_50';
      if (text.includes('1-10') || text.includes('1 - 10') || text.match(/^[1-9]$/)) return 'SIZE_1_10';
      return null;
    };

    // Parse location string to address components (e.g., "São Paulo, São Paulo, Brasil")
    const parseLocationToAddress = (locationStr: string | undefined | null): { city?: string; state?: string; country?: string } | null => {
      if (!locationStr) return null;
      const parts = locationStr.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        return { city: parts[0], state: parts[1], country: parts[2] };
      } else if (parts.length === 2) {
        return { city: parts[0], country: parts[1] };
      } else if (parts.length === 1) {
        return { city: parts[0] };
      }
      return null;
    };

    // Experiences
    if (experiences?.length) {
      for (const exp of experiences) {
        await prisma.leadExperience.upsert({
          where: {
            leadId_companyName_roleTitle_startDate: {
              leadId: id,
              companyName: exp.companyName,
              roleTitle: exp.roleTitle,
              startDate: exp.startDate || ''
            }
          },
          create: { leadId: id, ...exp },
          update: exp
        });
      }
      enrichedSections++;
    }

    // Educations
    if (educations?.length) {
      for (const edu of educations) {
        await prisma.leadEducation.upsert({
          where: {
            leadId_school_degree_startDate: {
              leadId: id,
              school: edu.school,
              degree: edu.degree || '',
              startDate: edu.startDate || ''
            }
          },
          create: { leadId: id, ...edu },
          update: edu
        });
      }
      enrichedSections++;
    }

    // Certifications
    if (certifications?.length) {
      for (const cert of certifications) {
        await prisma.leadCertification.upsert({
          where: {
            leadId_name_issuer: {
              leadId: id,
              name: cert.name,
              issuer: cert.issuer || ''
            }
          },
          create: { leadId: id, ...cert },
          update: cert
        });
      }
      enrichedSections++;
    }

    // Skills
    if (skills?.length) {
      for (const skill of skills) {
        await prisma.leadSkill.upsert({
          where: {
            leadId_name: {
              leadId: id,
              name: skill.name
            }
          },
          create: { leadId: id, ...skill },
          update: skill
        });
      }
      enrichedSections++;
    }

    // Languages
    if (languages?.length) {
      for (const lang of languages) {
        await prisma.leadLanguage.upsert({
          where: {
            leadId_name: {
              leadId: id,
              name: lang.name
            }
          },
          create: { leadId: id, ...lang },
          update: lang
        });
      }
      enrichedSections++;
    }

    // Recommendations
    if (recommendations?.length) {
      for (const rec of recommendations) {
        await prisma.leadRecommendation.upsert({
          where: {
            leadId_authorName_date: {
              leadId: id,
              authorName: rec.authorName,
              date: rec.date || ''
            }
          },
          create: { leadId: id, ...rec },
          update: rec
        });
      }
      enrichedSections++;
    }

    // Volunteers
    if (volunteers?.length) {
      for (const vol of volunteers) {
        await prisma.leadVolunteer.upsert({
          where: {
            leadId_organization_role: {
              leadId: id,
              organization: vol.organization,
              role: vol.role || ''
            }
          },
          create: { leadId: id, ...vol },
          update: vol
        });
      }
      enrichedSections++;
    }

    // Publications
    if (publications?.length) {
      for (const pub of publications) {
        await prisma.leadPublication.upsert({
          where: {
            leadId_title_publisher: {
              leadId: id,
              title: pub.title,
              publisher: pub.publisher || ''
            }
          },
          create: { leadId: id, ...pub },
          update: pub
        });
      }
      enrichedSections++;
    }

    // Patents
    if (patents?.length) {
      for (const pat of patents) {
        await prisma.leadPatent.upsert({
          where: {
            leadId_title_patentNumber: {
              leadId: id,
              title: pat.title,
              patentNumber: pat.patentNumber || ''
            }
          },
          create: { leadId: id, ...pat },
          update: pat
        });
      }
      enrichedSections++;
    }

    // Projects
    if (projects?.length) {
      for (const proj of projects) {
        await prisma.leadProject.upsert({
          where: {
            leadId_title: {
              leadId: id,
              title: proj.title
            }
          },
          create: { leadId: id, ...proj },
          update: proj
        });
      }
      enrichedSections++;
    }

    // Courses
    if (courses?.length) {
      for (const course of courses) {
        await prisma.leadCourse.upsert({
          where: {
            leadId_name: {
              leadId: id,
              name: course.name
            }
          },
          create: { leadId: id, ...course },
          update: course
        });
      }
      enrichedSections++;
    }

    // Honors
    if (honors?.length) {
      for (const honor of honors) {
        await prisma.leadHonor.upsert({
          where: {
            leadId_title_issuer: {
              leadId: id,
              title: honor.title,
              issuer: honor.issuer || ''
            }
          },
          create: { leadId: id, ...honor },
          update: honor
        });
      }
      enrichedSections++;
    }

    // Organizations
    if (organizations?.length) {
      for (const org of organizations) {
        await prisma.leadOrganization.upsert({
          where: {
            leadId_name_position: {
              leadId: id,
              name: org.name,
              position: org.position || ''
            }
          },
          create: { leadId: id, ...org },
          update: org
        });
      }
      enrichedSections++;
    }

    // Featured - no unique constraint, just create
    if (featured?.length) {
      // Delete existing and recreate (simpler than complex upsert logic)
      await prisma.leadFeatured.deleteMany({ where: { leadId: id } });
      await prisma.leadFeatured.createMany({
        data: featured.map((f: any) => ({ leadId: id, ...f }))
      });
      enrichedSections++;
    }

    // Contact Info - 1:1 relation
    if (contactInfo && Object.values(contactInfo).some(v => v !== null)) {
      await prisma.leadContactInfo.upsert({
        where: { leadId: id },
        create: { leadId: id, ...contactInfo },
        update: contactInfo
      });
      enrichedSections++;
    }

    // Posts - no unique constraint, append new posts
    if (posts?.length) {
      // For posts, we'll just add new ones (avoid duplicates by postUrl if available)
      for (const post of posts) {
        if (post.postUrl) {
          const existing = await prisma.leadPost.findFirst({
            where: { leadId: id, postUrl: post.postUrl }
          });
          if (!existing) {
            await prisma.leadPost.create({ data: { leadId: id, ...post } });
          }
        } else {
          // No postUrl, just create
          await prisma.leadPost.create({ data: { leadId: id, ...post } });
        }
      }
      enrichedSections++;
    }

    // Update lead enrichment metadata
    const enrichmentStatus = enrichedSections >= 4 ? 'complete' : enrichedSections > 0 ? 'partial' : 'none';

    // Prepare lead update data
    const leadUpdateData: Record<string, unknown> = {
      enrichedAt: new Date(),
      enrichmentStatus
    };

    // Extract jobTitle from first experience if not provided directly
    const extractedJobTitle = jobTitle || (experiences?.length > 0 ? experiences[0].roleTitle : null);
    if (extractedJobTitle) {
      leadUpdateData.jobTitle = extractedJobTitle;
      enrichedSections++;
    }

    // Process companySize
    const mappedCompanySize = mapCompanySize(companySize);
    if (mappedCompanySize) {
      leadUpdateData.companySize = mappedCompanySize;
      enrichedSections++;
    }

    // Update lead
    await prisma.lead.update({
      where: { id },
      data: leadUpdateData
    });

    // Trigger automatic scoring if enabled
    try {
      const scoringConfig = await prisma.scoringConfig.findUnique({
        where: { workspaceId },
      });

      if (scoringConfig?.autoScoreOnUpdate) {
        await calculateLeadScore(id, workspaceId);
      }
    } catch (error) {
      // Log error but don't fail the enrichment
      console.error('Failed to calculate lead score after enrichment:', error);
    }

    // Process address - either from explicit address object or parsed from location
    const addressData = address || parseLocationToAddress(existingLead.location);
    if (addressData && Object.values(addressData).some(v => v !== null && v !== undefined)) {
      await prisma.leadAddress.upsert({
        where: { leadId: id },
        create: { leadId: id, ...addressData },
        update: addressData
      });
      enrichedSections++;
    }

    // Create activity
    await prisma.activity.create({
      data: {
        type: 'lead_updated',
        leadId: id,
        userId: req.user!.id,
        description: `Profile enriched with ${enrichedSections} sections`,
        metadata: { enrichedSections, enrichmentStatus }
      }
    });

    console.log(`[DEBUG] Enrichment complete: ${enrichedSections} sections for lead ${id}`);

    res.json({
      success: true,
      data: {
        enrichedSections,
        enrichmentStatus
      }
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
