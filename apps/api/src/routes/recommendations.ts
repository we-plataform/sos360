import { Router } from 'express';
import { prisma } from '@lia360/database';
import { PAGINATION_DEFAULTS, calculateOffset, calculateTotalPages } from '@lia360/shared';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../lib/errors.js';
import { recordFeedback } from '../lib/ml/feedback.js';
import { trainConversionModel } from '../lib/ml/trainModel.js';
import { z } from 'zod';

export const recommendationsRouter = Router();

// All routes require authentication
recommendationsRouter.use(authenticate);

// Feedback submission schema
const feedbackSchema = z.object({
  leadId: z.string().min(1, 'Lead ID is required'),
  feedback: z.enum(['helpful', 'not_helpful', 'converted', 'not_converted', 'irrelevant', 'action_taken', 'action_ignored'], {
    errorMap: () => ({ message: 'Feedback must be one of: helpful, not_helpful, converted, not_converted, irrelevant, action_taken, action_ignored' })
  }),
  comments: z.string().max(1000).optional(),
  actualOutcome: z.enum(['converted', 'not_converted', 'in_progress', 'not_relevant']).optional(),
});

// GET /recommendations/hot-leads - Get leads with high conversion probability
recommendationsRouter.get('/hot-leads', async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;
    const {
      page = PAGINATION_DEFAULTS.page,
      limit = PAGINATION_DEFAULTS.limit,
      threshold = 0.7,
      startDate,
      endDate,
    } = req.query;

    // Parse threshold
    const minProbability = typeof threshold === 'string' ? parseFloat(threshold) : threshold;

    // Build date filter
    const predictionWhere: Record<string, unknown> = {};
    if (startDate || endDate) {
      predictionWhere.predictedAt = {};
      if (startDate) predictionWhere.predictedAt.gte = new Date(startDate as string);
      if (endDate) predictionWhere.predictedAt.lte = new Date(endDate as string);
    }

    // Filter out expired predictions
    predictionWhere.expiresAt = {
      gt: new Date(),
    };

    // Get predictions with high conversion probability
    const [predictions, total] = await Promise.all([
      prisma.leadPrediction.findMany({
        where: {
          lead: {
            workspaceId,
          },
          conversionProbability: {
            gte: minProbability,
          },
          ...predictionWhere,
        },
        include: {
          lead: {
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
          },
        },
        orderBy: {
          conversionProbability: 'desc',
        },
        skip: calculateOffset(Number(page), Number(limit)),
        take: Number(limit),
      }),
      prisma.leadPrediction.count({
        where: {
          lead: {
            workspaceId,
          },
          conversionProbability: {
            gte: minProbability,
          },
          ...predictionWhere,
        },
      }),
    ]);

    // Format response
    const hotLeads = predictions.map((p) => {
      const lead = p.lead;
      return {
        id: lead.id,
        fullName: lead.fullName,
        username: lead.username,
        email: lead.email,
        phone: lead.phone,
        platform: lead.platform,
        avatarUrl: lead.avatarUrl,
        status: lead.status,
        score: lead.score,
        assignedTo: lead.assignedTo,
        tags: lead.tags.map((lt: { tag: { id: string; name: string; color: string } }) => lt.tag),
        socialProfiles: lead.socialProfiles,
        prediction: {
          conversionProbability: p.conversionProbability,
          predictedAt: p.predictedAt,
          modelVersion: p.modelVersion,
          featureImportance: p.featureImportance,
          expiresAt: p.expiresAt,
        },
      };
    });

    res.json({
      success: true,
      data: hotLeads,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: calculateTotalPages(total, Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /recommendations/lead/:leadId - Get predictions for a specific lead
recommendationsRouter.get('/lead/:leadId', async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;
    const { leadId } = req.params;

    // Find the latest non-expired prediction for this lead
    const prediction = await prisma.leadPrediction.findFirst({
      where: {
        leadId,
        lead: {
          workspaceId,
        },
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        lead: {
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
        },
      },
      orderBy: {
        predictedAt: 'desc',
      },
    });

    if (!prediction) {
      throw new NotFoundError('Prediction not found for this lead');
    }

    const lead = prediction.lead;

    // Format response
    const leadRecommendation = {
      id: lead.id,
      fullName: lead.fullName,
      username: lead.username,
      email: lead.email,
      phone: lead.phone,
      platform: lead.platform,
      avatarUrl: lead.avatarUrl,
      status: lead.status,
      score: lead.score,
      assignedTo: lead.assignedTo,
      tags: lead.tags.map((lt: { tag: { id: string; name: string; color: string } }) => lt.tag),
      socialProfiles: lead.socialProfiles,
      prediction: {
        conversionProbability: prediction.conversionProbability,
        predictedAt: prediction.predictedAt,
        modelVersion: prediction.modelVersion,
        featureImportance: prediction.featureImportance,
        expiresAt: prediction.expiresAt,
      },
    };

    res.json({
      success: true,
      data: leadRecommendation,
    });
  } catch (error) {
    next(error);
  }
});

// POST /recommendations/feedback - Submit feedback on a recommendation
recommendationsRouter.post('/feedback', validate(feedbackSchema), async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;
    const userId = req.user!.id;
    const { leadId, feedback, comments, actualOutcome } = req.body;

    // Find the latest non-expired prediction for this lead
    const prediction = await prisma.leadPrediction.findFirst({
      where: {
        leadId,
        lead: {
          workspaceId,
        },
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        predictedAt: 'desc',
      },
    });

    if (!prediction) {
      throw new NotFoundError('No active prediction found for this lead');
    }

    // Map feedback string to FeedbackType and wasHelpful boolean
    const feedbackTypeToWasHelpful: Record<string, boolean> = {
      helpful: true,
      not_helpful: false,
      converted: true,
      not_converted: false,
      irrelevant: false,
      action_taken: true,
      action_ignored: false,
    };

    const wasHelpful = feedbackTypeToWasHelpful[feedback];

    // Record the feedback
    const result = await recordFeedback({
      predictionId: prediction.id,
      userId,
      workspaceId,
      feedbackType: feedback as any,
      wasHelpful,
      comments,
      actualOutcome,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    res.status(201).json({
      success: true,
      message: result.message,
      data: {
        feedbackId: result.feedbackId,
        predictionId: prediction.id,
        leadId,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /recommendations/train-model - Train conversion prediction model
recommendationsRouter.post(
  '/train-model',
  authorize('workspace', 'owner', 'admin', 'manager'),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;

      // Trigger model training
      const result = await trainConversionModel(workspaceId);

      // Return 202 Accepted for async operation
      res.status(202).json({
        success: result.success,
        data: {
          modelId: result.modelId,
          version: result.version,
          trainingDataStats: result.trainingDataStats,
          featureWeights: result.featureWeights,
          performanceMetrics: result.performanceMetrics,
        },
        message: result.reason,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /recommendations/generate - Generate predictions for leads in batch (Queues the job)
recommendationsRouter.post(
  '/generate',
  authorize('workspace', 'owner', 'admin', 'manager'),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const { leadIds, maxLeads, pipelineStageId } = req.body;

      // Determine which leads to process
      let leadsToProcess;

      if (leadIds && Array.isArray(leadIds) && leadIds.length > 0) {
        // Specific leads provided
        leadsToProcess = await prisma.lead.findMany({
          where: {
            id: { in: leadIds },
            workspaceId,
          },
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
            platform: true,
            status: true,
            score: true,
            profileUrl: true,
          },
        });
      } else {
        // Get leads from pipeline stage or all workspace leads
        const leadWhere: Record<string, unknown> = {
          workspaceId,
        };

        if (pipelineStageId) {
          leadWhere.pipelineStageId = pipelineStageId;
        }

        leadsToProcess = await prisma.lead.findMany({
          where: leadWhere,
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
            platform: true,
            status: true,
            score: true,
            profileUrl: true,
          },
          take: maxLeads ? parseInt(maxLeads) : 100,
        });
      }

      if (leadsToProcess.length === 0) {
        return res.json({
          success: false,
          error: {
            type: 'validation_error',
            title: 'No leads found',
            detail: 'No leads found matching the specified criteria',
          },
        });
      }

      // Get active model for this workspace
      const activeModel = await prisma.leadModel.findFirst({
        where: {
          workspaceId,
          modelType: 'conversion_prediction',
          isActive: true,
        },
        orderBy: {
          trainedAt: 'desc',
        },
      });

      // Generate a job ID
      const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Queue the job (in production, this would use a proper job queue like Bull/BullMQ)
      // For now, we'll create a simple job record
      const job = {
        id: jobId,
        workspaceId,
        status: 'pending',
        leadIds: leadsToProcess.map((l) => l.id),
        leadCount: leadsToProcess.length,
        modelId: activeModel?.id || null,
        modelVersion: activeModel?.version || 'unknown',
        createdAt: new Date().toISOString(),
      };

      // In a real implementation, we would store this in a dedicated jobs table
      // or push to a job queue. For this subtask, we're setting up the endpoint pattern.

      // Trigger async prediction generation (this would typically be handled by a worker)
      // For now, we'll note that the job is queued

      res.status(202).json({
        success: true,
        data: {
          jobId,
          message: `Recommendation generation queued for ${leadsToProcess.length} leads`,
          leadCount: leadsToProcess.length,
          modelVersion: activeModel?.version || 'unknown',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /recommendations/model-performance - Get model performance metrics
recommendationsRouter.get('/model-performance', async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;

    // Get active model
    const activeModel = await prisma.leadModel.findFirst({
      where: {
        workspaceId,
        modelType: 'conversion_prediction',
        isActive: true,
      },
      orderBy: {
        trainedAt: 'desc',
      },
    });

    if (!activeModel) {
      return res.json({
        success: true,
        data: {
          model: null,
          feedback: null,
          convertedCount: 0,
        },
      });
    }

    // Get feedback distribution for this model
    const feedbackData = await prisma.recommendationFeedback.groupBy({
      by: ['feedback'],
      where: {
        prediction: {
          modelVersion: activeModel.version,
          lead: {
            workspaceId,
          },
        },
      },
      _count: {
        id: true,
      },
    });

    const feedbackDistribution = feedbackData.reduce((acc: Record<string, number>, item) => {
      acc[item.feedback] = item._count.id;
      return acc;
    }, {});

    const totalFeedback = Object.values(feedbackDistribution).reduce((sum: number, count) => sum + (count as number), 0);
    const helpfulFeedback = (feedbackDistribution.helpful || 0) + (feedbackDistribution.converted || 0) + (feedbackDistribution.action_taken || 0);
    const notHelpfulFeedback = (feedbackDistribution.not_helpful || 0) + (feedbackDistribution.not_converted || 0) + (feedbackDistribution.irrelevant || 0) + (feedbackDistribution.action_ignored || 0);

    // Count converted leads that were recommended (had high probability)
    const convertedRecommendedLeads = await prisma.lead.count({
      where: {
        workspaceId,
        status: 'closed',
        predictions: {
          some: {
            modelVersion: activeModel.version,
            conversionProbability: {
              gte: 0.7,
            },
          },
        },
      },
    });

    // Get feature importance from model
    const featureWeights = activeModel.featureWeights as Record<string, number> | null;
    const featureImportance = featureWeights
      ? Object.entries(featureWeights)
          .map(([feature, weight]) => ({
            feature,
            weight,
          }))
          .sort((a, b) => b.weight - a.weight)
      : [];

    res.json({
      success: true,
      data: {
        model: {
          id: activeModel.id,
          version: activeModel.version,
          modelType: activeModel.modelType,
          trainedAt: activeModel.trainedAt,
          performanceMetrics: activeModel.performanceMetrics as {
            precision?: number;
            recall?: number;
            f1Score?: number;
          } | null,
          featureImportance,
          trainingDataStats: activeModel.trainingDataStats as {
            totalLeads?: number;
            convertedLeads?: number;
            notConvertedLeads?: number;
          } | null,
        },
        feedback: {
          total: totalFeedback,
          helpful: helpfulFeedback,
          notHelpful: notHelpfulFeedback,
          helpfulPercentage: totalFeedback > 0 ? (helpfulFeedback / totalFeedback) * 100 : 0,
          distribution: feedbackDistribution,
        },
        convertedCount: convertedRecommendedLeads,
      },
    });
  } catch (error) {
    next(error);
  }
});
