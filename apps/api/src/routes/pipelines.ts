import { Router } from 'express';
import { prisma } from '@lia360/database';
import { authenticate, authorize } from '../middleware/auth.js';
import { NotFoundError } from '../lib/errors.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import type { Server } from 'socket.io';

export const pipelinesRouter = Router();

// Schemas
const createPipelineSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    stages: z.array(z.object({
        name: z.string().min(1).max(50),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    })).optional(),
});

const updatePipelineSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
});

const createStageSchema = z.object({
    name: z.string().min(1).max(50),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const reorderStagesSchema = z.object({
    stages: z.array(z.object({
        id: z.string(),
        order: z.number().int().min(0),
    })),
});

// All routes require authentication
pipelinesRouter.use(authenticate);

// GET /pipelines - List all pipelines for workspace
pipelinesRouter.get('/', async (req, res, next) => {
    try {
        const workspaceId = req.user!.workspaceId;

        const pipelines = await prisma.pipeline.findMany({
            where: { workspaceId },
            include: {
                stages: {
                    orderBy: { order: 'asc' },
                    include: {
                        _count: {
                            select: { leads: true },
                        },
                        automations: {
                            where: { enabled: true },
                        },
                    },
                },
            },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        });

        res.json({
            success: true,
            data: pipelines.map((p) => ({
                ...p,
                stages: p.stages.map((s) => ({
                    ...s,
                    leadCount: s._count.leads,
                    _count: undefined,
                })),
            })),
        });
    } catch (error) {
        next(error);
    }
});

// GET /pipelines/:id - Get single pipeline with leads
pipelinesRouter.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const workspaceId = req.user!.workspaceId;
        const { scoreMin, scoreMax, sortBy } = req.query;

        // Build where clause for score filtering
        const leadWhere: Record<string, unknown> = {};
        if (scoreMin !== undefined || scoreMax !== undefined) {
            leadWhere.score = {
                ...(scoreMin !== undefined && { gte: Number(scoreMin) }),
                ...(scoreMax !== undefined && { lte: Number(scoreMax) }),
            };
        }

        // Determine sort order
        let leadOrderBy: Record<string, 'asc' | 'desc'> = { position: 'asc' };
        if (sortBy === 'score') {
            leadOrderBy = { score: 'desc' };
        } else if (sortBy === 'score_asc') {
            leadOrderBy = { score: 'asc' };
        }

        const pipeline = await prisma.pipeline.findFirst({
            where: { id, workspaceId },
            include: {
                stages: {
                    orderBy: { order: 'asc' },
                    include: {
                        automations: true,
                        leads: {
                            where: Object.keys(leadWhere).length > 0 ? leadWhere : undefined,
                            orderBy: leadOrderBy,
                            select: {
                                id: true,
                                fullName: true,
                                username: true,
                                avatarUrl: true,
                                position: true,
                                email: true,
                                phone: true,
                                followersCount: true,
                                connectionCount: true,
                                status: true,
                                score: true,
                                verified: true,
                                platform: true,
                                assignedTo: {
                                    select: { id: true, fullName: true, avatarUrl: true },
                                },
                                socialProfiles: {
                                    select: { platform: true, profileUrl: true, followersCount: true },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!pipeline) {
            throw new NotFoundError('Pipeline');
        }

        res.json({
            success: true,
            data: pipeline,
        });
    } catch (error) {
        next(error);
    }
});

// POST /pipelines - Create new pipeline
pipelinesRouter.post(
    '/',
    authorize('owner', 'admin', 'manager'),
    validate(createPipelineSchema),
    async (req, res, next) => {
        try {
            const workspaceId = req.user!.workspaceId;
            const { name, description, stages } = req.body;

            // Check if first pipeline (make it default)
            const existingCount = await prisma.pipeline.count({ where: { workspaceId } });

            const pipeline = await prisma.pipeline.create({
                data: {
                    name,
                    description,
                    workspaceId,
                    isDefault: existingCount === 0,
                    stages: stages?.length
                        ? {
                            create: stages.map((s: { name: string; color?: string }, idx: number) => ({
                                name: s.name,
                                color: s.color || '#6366F1',
                                order: idx,
                            })),
                        }
                        : {
                            create: [
                                { name: '01 - Leads Qualificados', color: '#F59E0B', order: 0 },
                                { name: '02 - Conexão Enviada', color: '#6366F1', order: 1 },
                                { name: '03 - Conexão Aceita', color: '#8B5CF6', order: 2 },
                                { name: '04 - Mensagem Inicial Enviada', color: '#3B82F6', order: 3 },
                                { name: '05 - Mensagem Inicial Follow-up', color: '#EC4899', order: 4 },
                                { name: '06 - Resposta Recebida', color: '#10B981', order: 5 },
                            ],
                        },
                },
                include: {
                    stages: {
                        orderBy: { order: 'asc' },
                    },
                },
            });

            res.status(201).json({
                success: true,
                data: pipeline,
            });
        } catch (error) {
            next(error);
        }
    }
);

// PATCH /pipelines/:id - Update pipeline
pipelinesRouter.patch(
    '/:id',
    authorize('owner', 'admin', 'manager'),
    validate(updatePipelineSchema),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const workspaceId = req.user!.workspaceId;

            const existing = await prisma.pipeline.findFirst({
                where: { id, workspaceId },
            });

            if (!existing) {
                throw new NotFoundError('Pipeline');
            }

            const pipeline = await prisma.pipeline.update({
                where: { id },
                data: req.body,
                include: {
                    stages: {
                        orderBy: { order: 'asc' },
                    },
                },
            });

            res.json({
                success: true,
                data: pipeline,
            });
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /pipelines/:id - Delete pipeline
pipelinesRouter.delete(
    '/:id',
    authorize('owner', 'admin'),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const workspaceId = req.user!.workspaceId;

            const pipeline = await prisma.pipeline.findFirst({
                where: { id, workspaceId },
            });

            if (!pipeline) {
                throw new NotFoundError('Pipeline');
            }

            if (pipeline.isDefault) {
                return res.status(400).json({
                    success: false,
                    error: 'Não é possível deletar o pipeline padrão',
                });
            }

            await prisma.pipeline.delete({ where: { id } });

            res.json({
                success: true,
                data: { message: 'Pipeline removido com sucesso' },
            });
        } catch (error) {
            next(error);
        }
    }
);

// POST /pipelines/:id/stages - Add stage to pipeline
pipelinesRouter.post(
    '/:id/stages',
    authorize('owner', 'admin', 'manager'),
    validate(createStageSchema),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const workspaceId = req.user!.workspaceId;
            const { name, color } = req.body;

            const pipeline = await prisma.pipeline.findFirst({
                where: { id, workspaceId },
                include: { stages: { orderBy: { order: 'desc' }, take: 1 } },
            });

            if (!pipeline) {
                throw new NotFoundError('Pipeline');
            }

            const maxOrder = pipeline.stages[0]?.order ?? -1;

            const stage = await prisma.pipelineStage.create({
                data: {
                    name,
                    color: color || '#6366F1',
                    order: maxOrder + 1,
                    pipelineId: id,
                },
            });

            res.status(201).json({
                success: true,
                data: stage,
            });
        } catch (error) {
            next(error);
        }
    }
);

// PATCH /pipelines/:id/stages/reorder - Reorder stages
pipelinesRouter.patch(
    '/:id/stages/reorder',
    authorize('owner', 'admin', 'manager'),
    validate(reorderStagesSchema),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const workspaceId = req.user!.workspaceId;
            const { stages } = req.body;

            const pipeline = await prisma.pipeline.findFirst({
                where: { id, workspaceId },
            });

            if (!pipeline) {
                throw new NotFoundError('Pipeline');
            }

            // Update all stages orders in a transaction
            await prisma.$transaction(
                stages.map((s: { id: string; order: number }) =>
                    prisma.pipelineStage.update({
                        where: { id: s.id },
                        data: { order: s.order },
                    })
                )
            );

            const updatedPipeline = await prisma.pipeline.findUnique({
                where: { id },
                include: {
                    stages: {
                        orderBy: { order: 'asc' },
                    },
                },
            });

            res.json({
                success: true,
                data: updatedPipeline,
            });
        } catch (error) {
            next(error);
        }
    }
);

// PATCH /pipelines/:id/stages/:stageId - Update stage
pipelinesRouter.patch(
    '/:id/stages/:stageId',
    authorize('owner', 'admin', 'manager'),
    async (req, res, next) => {
        try {
            const { id, stageId } = req.params;
            const workspaceId = req.user!.workspaceId;
            const { name, color } = req.body;

            const pipeline = await prisma.pipeline.findFirst({
                where: { id, workspaceId },
            });

            if (!pipeline) {
                throw new NotFoundError('Pipeline');
            }

            const stage = await prisma.pipelineStage.update({
                where: { id: stageId },
                data: { name, color },
            });

            res.json({
                success: true,
                data: stage,
            });
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /pipelines/:id/stages/:stageId - Delete stage
pipelinesRouter.delete(
    '/:id/stages/:stageId',
    authorize('owner', 'admin', 'manager'),
    async (req, res, next) => {
        try {
            const { id, stageId } = req.params;
            const workspaceId = req.user!.workspaceId;

            const pipeline = await prisma.pipeline.findFirst({
                where: { id, workspaceId },
                include: { stages: true },
            });

            if (!pipeline) {
                throw new NotFoundError('Pipeline');
            }

            if (pipeline.stages.length <= 1) {
                return res.status(400).json({
                    success: false,
                    error: 'Pipeline deve ter pelo menos um estágio',
                });
            }

            // Move leads to first stage before deleting
            const firstStage = pipeline.stages.find((s) => s.id !== stageId);
            if (firstStage) {
                await prisma.lead.updateMany({
                    where: { pipelineStageId: stageId },
                    data: { pipelineStageId: firstStage.id },
                });
            }

            await prisma.pipelineStage.delete({ where: { id: stageId } });

            res.json({
                success: true,
                data: { message: 'Estágio removido com sucesso' },
            });
        } catch (error) {
            next(error);
        }
    }
);

// POST /pipelines/:id/leads/move - Move lead to stage with position
pipelinesRouter.post(
    '/:id/leads/move',
    authorize('owner', 'admin', 'manager', 'agent'),
    async (req, res, next) => {
        try {
            const { id: pipelineId } = req.params;
            const workspaceId = req.user!.workspaceId;
            const { leadId, stageId, position } = req.body;

            // Validate pipeline belongs to workspace
            const pipeline = await prisma.pipeline.findFirst({
                where: { id: pipelineId, workspaceId },
            });

            if (!pipeline) {
                throw new NotFoundError('Pipeline');
            }

            // Validate lead belongs to workspace
            const lead = await prisma.lead.findFirst({
                where: { id: leadId, workspaceId },
            });

            if (!lead) {
                throw new NotFoundError('Lead');
            }

            // Update lead position and stage
            const updatedLead = await prisma.lead.update({
                where: { id: leadId },
                data: {
                    pipelineStageId: stageId,
                    position: position ?? 0,
                },
                include: {
                    assignedTo: {
                        select: { id: true, fullName: true, avatarUrl: true },
                    },
                    socialProfiles: {
                        select: { platform: true },
                        take: 1,
                    },
                    pipelineStage: true,
                },
            });

            // Emit socket event for realtime update
            const io = req.app.get('io') as Server;
            io.to(`workspace:${workspaceId}`).emit('lead:moved', {
                leadId,
                stageId,
                position,
                pipelineId,
            });

            res.json({
                success: true,
                data: updatedLead,
            });
        } catch (error) {
            next(error);
        }
    }
);

// POST /pipelines/:id/migrate - Migrate leads from status enum to pipeline stages
pipelinesRouter.post(
    '/:id/migrate',
    authorize('owner', 'admin'),
    async (req, res, next) => {
        try {
            const { id: pipelineId } = req.params;
            const workspaceId = req.user!.workspaceId;

            // Validate pipeline belongs to workspace
            const pipeline = await prisma.pipeline.findFirst({
                where: { id: pipelineId, workspaceId },
                include: { stages: { orderBy: { order: 'asc' } } },
            });

            if (!pipeline) {
                throw new NotFoundError('Pipeline');
            }

            // Status to stage name mapping
            const statusToStageName: Record<string, string> = {
                new: 'Novo',
                contacted: 'Contatado',
                responded: 'Respondeu',
                qualified: 'Qualificado',
                scheduled: 'Agendado',
                closed: 'Fechado',
                lost: 'Perdido',
            };

            // Get leads without pipelineStageId
            const leadsToMigrate = await prisma.lead.findMany({
                where: {
                    workspaceId,
                    pipelineStageId: null,
                },
            });

            let migratedCount = 0;
            const results: { status: string; count: number; stageId: string | null }[] = [];

            // Group by status and migrate
            for (const [status, stageName] of Object.entries(statusToStageName)) {
                const leadsWithStatus = leadsToMigrate.filter((l) => l.status === status);
                if (leadsWithStatus.length === 0) continue;

                // Find matching stage or use first stage
                const matchingStage = pipeline.stages.find(
                    (s) => s.name.toLowerCase() === stageName.toLowerCase()
                ) || pipeline.stages[0];

                if (!matchingStage) continue;

                // Update leads in batch
                const leadIds = leadsWithStatus.map((l) => l.id);
                await prisma.lead.updateMany({
                    where: { id: { in: leadIds } },
                    data: {
                        pipelineStageId: matchingStage.id,
                        position: 1000 * migratedCount, // Simple sequential positioning
                    },
                });

                migratedCount += leadsWithStatus.length;
                results.push({
                    status,
                    count: leadsWithStatus.length,
                    stageId: matchingStage.id,
                });
            }

            res.json({
                success: true,
                data: {
                    message: `${migratedCount} leads migrados para o pipeline`,
                    totalMigrated: migratedCount,
                    details: results,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

