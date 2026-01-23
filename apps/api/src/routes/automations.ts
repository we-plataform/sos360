import { Router } from 'express';
import { prisma } from '@lia360/database';
import { authenticate, authorize } from '../middleware/auth.js';
import { NotFoundError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';

export const automationsRouter = Router();

// Schemas
import { upsertAutomationSchema } from '@lia360/shared';

// All routes require authentication
automationsRouter.use(authenticate);

// POST /automations - Create or Update Automation for a Stage
automationsRouter.post(
    '/',
    authorize('owner', 'admin', 'manager'),
    validate(upsertAutomationSchema),
    async (req, res, next) => {
        try {
            const workspaceId = req.user!.workspaceId;
            const { pipelineStageId, name, actions, enabled } = req.body;

            // Verify stage belongs to workspace
            const stage = await prisma.pipelineStage.findFirst({
                where: {
                    id: pipelineStageId,
                    pipeline: { workspaceId },
                },
            });

            if (!stage) {
                throw new NotFoundError('Pipeline Stage');
            }

            // Check if automation already exists for this stage
            const existingAutomation = await prisma.automation.findFirst({
                where: {
                    workspaceId,
                    pipelineStageId,
                },
            });

            let automation;
            if (existingAutomation) {
                automation = await prisma.automation.update({
                    where: { id: existingAutomation.id },
                    data: {
                        name,
                        actions,
                        enabled,
                        triggerType: 'manual', // Enforce manual for now as per MVP
                        triggerConfig: {},
                    },
                });
            } else {
                automation = await prisma.automation.create({
                    data: {
                        name,
                        workspaceId,
                        pipelineStageId,
                        createdById: req.user!.id,
                        actions,
                        enabled,
                        triggerType: 'manual',
                        triggerConfig: {},
                    },
                });
            }

            res.json({
                success: true,
                data: automation,
            });
        } catch (error) {
            next(error);
        }
    }
);

// POST /automations/:id/trigger - Run automation manually (Queues the job)
automationsRouter.post(
    '/:id/trigger',
    authorize('owner', 'admin', 'manager', 'agent'),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const workspaceId = req.user!.workspaceId;

            const automation = await prisma.automation.findFirst({
                where: { id, workspaceId, enabled: true },
                include: { pipelineStage: true },
            });

            if (!automation || !automation.pipelineStageId) {
                throw new NotFoundError('Automation');
            }

            // 1. Get leads in stage - ONLY those with profileUrl
            const { maxLeads, interval } = req.body;

            const leads = await prisma.lead.findMany({
                where: {
                    workspaceId,
                    pipelineStageId: automation.pipelineStageId,
                    profileUrl: { not: null }, // Only leads with valid profile URLs
                },
                select: {
                    id: true,
                    profileUrl: true,
                    fullName: true,
                    username: true,
                    platform: true,
                    avatarUrl: true,
                    bio: true,
                },
                take: maxLeads ? parseInt(maxLeads) : undefined,
            });

            // Filter out any leads with empty/invalid profileUrl (extra safety)
            const validLeads = leads.filter(l => l.profileUrl && l.profileUrl.trim() !== '');

            if (validLeads.length === 0) {
                return res.json({
                    success: false,
                    error: {
                        type: 'validation_error',
                        title: 'No valid leads',
                        detail: 'No leads with valid profile URLs found in this stage'
                    }
                });
            }

            // Create Automation Log entry as a "Job"
            const job = await prisma.automationLog.create({
                data: {
                    automationId: automation.id,
                    status: 'pending',
                    triggerType: 'MANUAL',
                    result: {
                        leadsToProcess: validLeads.map(l => ({
                            ...l,
                            platform: l.platform || 'linkedin',
                            // Ensure profileUrl is a valid LinkedIn URL
                            profileUrl: l.profileUrl!.startsWith('http')
                                ? l.profileUrl
                                : `https://www.linkedin.com/in/${l.profileUrl}`
                        })),
                        actions: automation.actions,
                        config: {
                            interval: interval || '60-90'
                        }
                    },
                    startedAt: new Date(), // Job queued time
                }
            });

            res.json({
                success: true,
                data: {
                    message: `Automation queued for ${validLeads.length} leads`,
                    jobId: job.id,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

// GET /automations/jobs - Poll for pending jobs (Called by Extension)
automationsRouter.get(
    '/jobs',
    authorize('owner', 'admin', 'manager', 'agent'),
    async (req, res, next) => {
        try {
            const { workspaceId } = req.user!;

            // Find pending logs for automations in this workspace
            const jobs = await prisma.automationLog.findMany({
                where: {
                    status: 'pending',
                    automation: {
                        workspaceId: workspaceId
                    }
                },
                include: {
                    automation: true
                },
                orderBy: { startedAt: 'asc' },
                take: 5 // Process a few at a time
            });

            res.json({
                success: true,
                data: jobs
            });
        } catch (error) {
            next(error);
        }
    }
);

// PATCH /automations/jobs/:id - Update job status
automationsRouter.patch(
    '/jobs/:id',
    authorize('owner', 'admin', 'manager', 'agent'),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const { status, result } = req.body;

            // Map incoming status to valid enum values if necessary
            // Extension might send "COMPLETED", "FAILED" etc.
            let dbStatus = status;
            if (status === 'COMPLETED' || status === 'completed') dbStatus = 'success';
            if (status === 'FAILED' || status === 'failed') dbStatus = 'failed';
            if (status === 'RUNNING' || status === 'running') dbStatus = 'running';

            const job = await prisma.automationLog.update({
                where: { id },
                data: {
                    status: dbStatus,
                    result: result ? result : undefined, // Merge or replace result
                    completedAt: (dbStatus === 'success' || dbStatus === 'failed') ? new Date() : undefined
                }
            });

            res.json({
                success: true,
                data: job
            });
        } catch (error) {
            next(error);
        }
    }
);

