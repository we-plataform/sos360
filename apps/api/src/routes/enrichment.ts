import { Router } from 'express';
import { prisma } from '@lia360/database';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../lib/errors.js';
import {
    enrichmentRequestSchema,
    batchEnrichmentRequestSchema,
} from '@lia360/shared';
import {
    getEnrichmentUsageStats,
} from '../services/enrichment.js';
import {
    addEnrichmentJob,
    getEnrichmentJobStatus,
    getQueueStats,
} from '../workers/index.js';

export const enrichmentRouter = Router();

enrichmentRouter.use(authenticate);

// POST /api/v1/enrichment/lead/:id - Trigger enrichment for a single lead
enrichmentRouter.post(
    '/lead/:id',
    validate(enrichmentRequestSchema),
    async (req, res, next) => {
        try {
            const workspaceId = req.user!.workspaceId;
            const leadId = req.params.id;
            const { force } = req.body;

            // Verify lead exists and belongs to workspace
            const lead = await prisma.lead.findFirst({
                where: { id: leadId, workspaceId },
            });

            if (!lead) {
                throw new NotFoundError('Lead');
            }

            // Check if already enriched (unless force is true)
            if (!force && lead.enrichedAt && lead.enrichmentStatus === 'complete') {
                return res.json({
                    success: true,
                    data: {
                        leadId,
                        message: 'Lead already enriched',
                        enrichedAt: lead.enrichedAt,
                        enrichmentStatus: lead.enrichmentStatus,
                        alreadyEnriched: true,
                    },
                });
            }

            // Add enrichment job to queue
            const job = await addEnrichmentJob({
                leadId,
                workspaceId,
                force,
            });

            res.json({
                success: true,
                data: {
                    leadId,
                    jobId: job.id!,
                    message: 'Enrichment job queued successfully',
                    queuedAt: new Date().toISOString(),
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

// GET /api/v1/enrichment/status/:jobId - Get enrichment job status
enrichmentRouter.get('/status/:jobId', async (req, res, next) => {
    try {
        const workspaceId = req.user!.workspaceId;
        const jobId = req.params.jobId;

        // Get job status from queue
        const jobStatus = await getEnrichmentJobStatus(jobId);

        if (!jobStatus) {
            return res.status(404).json({
                success: false,
                error: 'Job not found',
            });
        }

        // Verify job belongs to workspace (check job data)
        if (jobStatus.data?.workspaceId !== workspaceId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied to this job',
            });
        }

        // Fetch current lead enrichment status from database
        let leadEnrichmentData: { id: string; enrichmentStatus: string; enrichedAt: Date | null } | null = null;
        if (jobStatus.data?.leadId) {
            const lead = await prisma.lead.findUnique({
                where: { id: jobStatus.data.leadId },
                select: {
                    id: true,
                    enrichmentStatus: true,
                    enrichedAt: true,
                },
            });
            if (lead) {
                leadEnrichmentData = lead;
            }
        }

        res.json({
            success: true,
            data: {
                jobId: jobStatus.id,
                state: jobStatus.state,
                leadId: jobStatus.data?.leadId,
                result: jobStatus.result,
                error: jobStatus.failedReason,
                processedAt: jobStatus.processedOn ? new Date(jobStatus.processedOn).toISOString() : null,
                completedAt: jobStatus.finishedOn ? new Date(jobStatus.finishedOn).toISOString() : null,
                leadEnrichment: leadEnrichmentData,
            },
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/v1/enrichment/batch - Batch enrich multiple leads
enrichmentRouter.post(
    '/batch',
    authorize('owner', 'admin', 'manager'),
    validate(batchEnrichmentRequestSchema),
    async (req, res, next) => {
        try {
            const workspaceId = req.user!.workspaceId;
            const { leadIds, force } = req.body;

            // Verify all leads exist and belong to workspace
            const leads = await prisma.lead.findMany({
                where: { id: { in: leadIds }, workspaceId },
                select: { id: true, enrichedAt: true, enrichmentStatus: true },
            });

            const foundLeadIds = leads.map(l => l.id);
            const notFoundLeadIds = leadIds.filter(id => !foundLeadIds.includes(id));

            // Filter out already enriched leads (unless force is true)
            const leadsToEnrich = force
                ? foundLeadIds
                : leads.filter(l => !l.enrichedAt || l.enrichmentStatus !== 'complete').map(l => l.id);

            // Queue enrichment jobs
            const jobs: Array<{ leadId: string; jobId?: string; status: string; error?: string }> = [];
            const skippedLeads: Array<{ leadId: string; reason: string; enrichedAt: Date }> = [];

            for (const leadId of leadsToEnrich) {
                try {
                    const job = await addEnrichmentJob({ leadId, workspaceId, force });
                    jobs.push({ leadId, jobId: job.id!, status: 'queued' });
                } catch (error) {
                    jobs.push({
                        leadId,
                        status: 'failed',
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }

            // Track skipped leads (already enriched)
            if (!force) {
                for (const lead of leads) {
                    if (lead.enrichedAt && lead.enrichmentStatus === 'complete' && !leadsToEnrich.includes(lead.id)) {
                        skippedLeads.push({
                            leadId: lead.id,
                            reason: 'already enriched',
                            enrichedAt: lead.enrichedAt,
                        });
                    }
                }
            }

            res.json({
                success: true,
                data: {
                    queued: jobs.filter(j => j.status === 'queued').length,
                    skipped: skippedLeads.length,
                    notFound: notFoundLeadIds.length,
                    jobs: jobs.length > 0 ? jobs : undefined,
                    skippedLeads: skippedLeads.length > 0 ? skippedLeads : undefined,
                    notFoundLeads: notFoundLeadIds.length > 0 ? notFoundLeadIds : undefined,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

// GET /api/v1/enrichment/usage - Get enrichment usage statistics for workspace
enrichmentRouter.get('/usage', async (req, res, next) => {
    try {
        const workspaceId = req.user!.workspaceId;

        const usageStats = await getEnrichmentUsageStats(workspaceId);

        // Get queue statistics
        let queueStats: Record<string, number> | null = null;
        try {
            queueStats = await getQueueStats();
        } catch (error) {
            // Queue might not be initialized, continue without it
        }

        res.json({
            success: true,
            data: {
                credits: {
                    available: usageStats.creditsAvailable,
                    used: usageStats.creditsUsed,
                    total: usageStats.creditsAvailable + usageStats.creditsUsed,
                },
                enrichment: {
                    total: usageStats.totalEnrichments,
                    successful: usageStats.successfulEnrichments,
                    failed: usageStats.failedEnrichments,
                    successRate: usageStats.totalEnrichments > 0
                        ? Math.round((usageStats.successfulEnrichments / usageStats.totalEnrichments) * 100)
                        : 0,
                },
                queue: queueStats,
                recentActivity: usageStats.recentUsages.map(u => ({
                    leadId: u.leadId,
                    provider: u.provider,
                    status: u.status,
                    creditsCost: u.creditsCost,
                    completedAt: u.completedAt,
                    errorMessage: u.errorMessage,
                })),
            },
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/v1/enrichment/config - Get enrichment configuration for workspace
enrichmentRouter.get('/config', async (req, res, next) => {
    try {
        const workspaceId = req.user!.workspaceId;

        // Get enrichment credit info
        const credit = await prisma.enrichmentCredit.findUnique({
            where: { workspaceId },
        });

        // Get available providers
        const { getAvailableProviders } = await import('../lib/enrichment-apis.js');
        const availableProviders = getAvailableProviders();

        res.json({
            success: true,
            data: {
                credits: credit ? {
                    available: credit.creditsAvailable,
                    used: credit.creditsUsed,
                } : null,
                providers: availableProviders,
                hasEnrichmentAvailable: availableProviders.length > 0,
            },
        });
    } catch (error) {
        next(error);
    }
});
