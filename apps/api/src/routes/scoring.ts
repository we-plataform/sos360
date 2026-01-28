import { Router } from 'express';
import { prisma } from '@lia360/database';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../lib/errors.js';
import {
    createScoringConfigSchema,
    updateScoringConfigSchema,
    calculateLeadScoreSchema,
    batchCalculateScoresSchema,
} from '@lia360/shared';
import {
    calculateLeadScore,
    batchCalculateLeadScores,
    getScoringConfig,
    updateScoringConfig,
} from '../services/scoring.js';

export const scoringRouter = Router();

scoringRouter.use(authenticate);

// GET /scoring/config - Get scoring configuration
scoringRouter.get('/config', async (req, res, next) => {
    try {
        const workspaceId = req.user!.workspaceId;

        const config = await getScoringConfig(workspaceId);

        res.json({
            success: true,
            data: config,
        });
    } catch (error) {
        next(error);
    }
});

// POST /scoring/config - Create or update scoring configuration
scoringRouter.post(
    '/config',
    authorize('owner', 'admin', 'manager'),
    validate(createScoringConfigSchema),
    async (req, res, next) => {
        try {
            const workspaceId = req.user!.workspaceId;
            const data = req.body;

            // Check if config already exists
            const existingConfig = await prisma.scoringConfig.findUnique({
                where: { workspaceId },
            });

            let config;
            if (existingConfig) {
                // Update existing config
                config = await updateScoringConfig(workspaceId, data);
            } else {
                // Create new config
                config = await prisma.scoringConfig.create({
                    data: {
                        ...data,
                        workspaceId,
                    },
                });
            }

            // Rescore all leads in workspace after config create/update
            // Get all lead IDs in workspace
            const allLeads = await prisma.lead.findMany({
                where: { workspaceId },
                select: { id: true },
            });

            if (allLeads.length > 0) {
                const leadIds = allLeads.map(l => l.id);
                // Batch rescore all leads (fire and forget - don't wait for completion)
                batchCalculateLeadScores(leadIds, workspaceId).catch(error => {
                    if (process.env.NODE_ENV === 'development') {
                        console.error('[SCORING] Error rescoring leads after config update:', error);
                    }
                });
            }

            res.status(existingConfig ? 200 : 201).json({
                success: true,
                data: config,
            });
        } catch (error) {
            next(error);
        }
    }
);

// PATCH /scoring/config - Update scoring configuration
scoringRouter.patch(
    '/config',
    authorize('owner', 'admin', 'manager'),
    validate(updateScoringConfigSchema),
    async (req, res, next) => {
        try {
            const workspaceId = req.user!.workspaceId;
            const updates = req.body;

            const config = await updateScoringConfig(workspaceId, updates);

            // Rescore all leads in workspace after config update
            // Get all lead IDs in workspace
            const allLeads = await prisma.lead.findMany({
                where: { workspaceId },
                select: { id: true },
            });

            if (allLeads.length > 0) {
                const leadIds = allLeads.map(l => l.id);
                // Batch rescore all leads (fire and forget - don't wait for completion)
                batchCalculateLeadScores(leadIds, workspaceId).catch(error => {
                    if (process.env.NODE_ENV === 'development') {
                        console.error('[SCORING] Error rescoring leads after config update:', error);
                    }
                });
            }

            res.json({
                success: true,
                data: config,
            });
        } catch (error) {
            next(error);
        }
    }
);

// POST /scoring/calculate - Calculate score for a single lead
scoringRouter.post(
    '/calculate',
    validate(calculateLeadScoreSchema),
    async (req, res, next) => {
        try {
            const workspaceId = req.user!.workspaceId;
            const { leadId } = req.body;

            // Verify lead exists and belongs to workspace
            const lead = await prisma.lead.findFirst({
                where: { id: leadId, workspaceId },
            });

            if (!lead) {
                throw new NotFoundError('Lead');
            }

            const breakdown = await calculateLeadScore(leadId, workspaceId);

            res.json({
                success: true,
                data: {
                    leadId,
                    score: breakdown.finalScore,
                    breakdown,
                    scoredAt: new Date().toISOString(),
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

// POST /scoring/calculate/batch - Calculate scores for multiple leads
scoringRouter.post(
    '/calculate/batch',
    validate(batchCalculateScoresSchema),
    async (req, res, next) => {
        try {
            const workspaceId = req.user!.workspaceId;
            const { leadIds } = req.body;

            // Verify all leads exist and belong to workspace
            const leads = await prisma.lead.findMany({
                where: { id: { in: leadIds }, workspaceId },
                select: { id: true },
            });

            const foundLeadIds = leads.map(l => l.id);
            const notFoundLeadIds = leadIds.filter(id => !foundLeadIds.includes(id));

            // Calculate scores for found leads
            const results = await batchCalculateLeadScores(foundLeadIds, workspaceId);

            // Format response
            const successResults = results
                .filter(r => !r.error)
                .map(r => ({
                    leadId: r.leadId,
                    score: r.breakdown.finalScore,
                    breakdown: r.breakdown,
                    scoredAt: new Date().toISOString(),
                }));

            const errors = [
                ...results
                    .filter(r => r.error)
                    .map(r => ({ leadId: r.leadId, error: r.error! })),
                ...notFoundLeadIds.map(id => ({ leadId: id, error: 'Lead não encontrado' })),
            ];

            res.json({
                success: true,
                data: {
                    results: successResults,
                    totalProcessed: successResults.length,
                    totalFailed: errors.length,
                    errors: errors.length > 0 ? errors : undefined,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);
