import { Router } from 'express';
import {
  createScoringModelSchema,
  rescoreLeadSchema,
  batchRescoreSchema,
} from '@lia360/shared';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../lib/errors.js';
import { scoringService } from '../services/scoring.js';

export const scoringRouter = Router();

// All routes require authentication
scoringRouter.use(authenticate);

// ============================================
// SCORING MODEL MANAGEMENT
// ============================================

// GET /pipelines/:pipelineId/scoring-model - Get scoring model
scoringRouter.get(
  '/pipelines/:pipelineId/scoring-model',
  async (req, res, next) => {
    try {
      const { pipelineId } = req.params;
      const model = await scoringService.getScoringModel(pipelineId);

      if (!model) {
        throw new NotFoundError('Scoring model not found');
      }

      res.json({
        success: true,
        data: model,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /pipelines/:pipelineId/scoring-model - Create/update scoring model
scoringRouter.post(
  '/pipelines/:pipelineId/scoring-model',
  authorize('admin', 'owner'),
  validate(createScoringModelSchema, 'body'),
  async (req, res, next) => {
    try {
      const { pipelineId } = req.params;
      const model = await scoringService.upsertScoringModel(pipelineId, req.body);

      res.json({
        success: true,
        data: model,
        message: 'Scoring model saved successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /pipelines/:pipelineId/scoring-model - Delete scoring model
scoringRouter.delete(
  '/pipelines/:pipelineId/scoring-model',
  authorize('admin', 'owner'),
  async (req, res, next) => {
    try {
      const { pipelineId } = req.params;
      const { prisma } = await import('@lia360/database');

      const model = await prisma.scoringModel.findUnique({
        where: { pipelineId },
      });

      if (!model) {
        throw new NotFoundError('Scoring model not found');
      }

      await prisma.scoringModel.delete({
        where: { pipelineId },
      });

      res.json({
        success: true,
        message: 'Scoring model deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// LEAD SCORING OPERATIONS
// ============================================

// POST /leads/:id/rescore - Manually trigger re-scoring
scoringRouter.post(
  '/leads/:id/rescore',
  authorize('agent', 'manager', 'admin', 'owner'),
  validate(rescoreLeadSchema, 'body'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { force } = req.body;

      // Optional: Check if recently scored (unless force=true)
      if (!force) {
        const { prisma } = await import('@lia360/database');
        const recentScore = await prisma.scoreHistory.findFirst({
          where: {
            leadId: id,
            triggeredBy: 'manual',
          },
          orderBy: { createdAt: 'desc' },
        });

        if (recentScore) {
          const hoursSinceScore = Math.floor(
            (Date.now() - recentScore.createdAt.getTime()) / (1000 * 60 * 60)
          );
          if (hoursSinceScore < 1) {
            return res.json({
              success: true,
              message: 'Lead was scored recently. Use force=true to rescore.',
              data: {
                recentlyScored: true,
                hoursSinceScore,
              },
            });
          }
        }
      }

      const result = await scoringService.scoreLead(id, 'manual');

      if (!result) {
        throw new NotFoundError('Lead not found or no scoring model configured');
      }

      res.json({
        success: true,
        data: result,
        message: 'Lead scored successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /leads/batch-rescore - Batch re-score leads
scoringRouter.post(
  '/leads/batch-rescore',
  authorize('admin', 'owner'),
  validate(batchRescoreSchema, 'body'),
  async (req, res, next) => {
    try {
      const { pipelineId, leadIds } = req.body;
      let leadsToScore: string[] = [];

      if (leadIds && leadIds.length > 0) {
        leadsToScore = leadIds;
      } else if (pipelineId) {
        // Get all leads for this pipeline
        const { prisma } = await import('@lia360/database');
        const leads = await prisma.lead.findMany({
          where: {
            pipelineStage: {
              pipelineId,
            },
          },
          select: { id: true },
        });
        leadsToScore = leads.map((l) => l.id);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Either leadIds or pipelineId must be provided',
        });
      }

      const results = await scoringService.batchScoreLeads(
        leadsToScore,
        'batch_job'
      );

      res.json({
        success: true,
        data: results,
        message: `Batch scoring completed: ${results.succeeded}/${results.processed} succeeded`,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /leads/:id/score-breakdown - Get detailed score breakdown
scoringRouter.get('/leads/:id/score-breakdown', async (req, res, next) => {
  try {
    const { id } = req.params;
    const breakdown = await scoringService.getScoreBreakdown(id);

    if (!breakdown) {
      throw new NotFoundError('Lead not found or no scoring model configured');
    }

    // Get score history
    const history = await scoringService.getScoreHistory(id, 10);

    res.json({
      success: true,
      data: {
        ...breakdown,
        history,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /leads/:id/score-history - Get score history
scoringRouter.get('/leads/:id/score-history', async (req, res, next) => {
  try {
    const { id } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    const history = await scoringService.getScoreHistory(id, limit);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
});
