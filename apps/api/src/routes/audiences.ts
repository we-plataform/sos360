import { Router } from 'express';
import { prisma } from '@sos360/database';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError, ConflictError } from '../lib/errors.js';
import { z } from 'zod';

export const audiencesRouter = Router();

// Validation schemas
const createAudienceSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório').max(100),
    // Detalhes do Perfil
    gender: z.array(z.enum(['male', 'female'])).default([]),
    ignoreGenderIfUnknown: z.boolean().default(true),
    countries: z.array(z.string()).default([]),
    ignoreCountryIfUnknown: z.boolean().default(true),
    excludePrivate: z.boolean().default(false),
    excludeNoMessage: z.boolean().default(false),
    excludeNoPhoto: z.boolean().default(false),
    excludeCompanyPages: z.boolean().default(false),
    verifiedFilter: z.enum(['any', 'verified_only', 'unverified_only']).default('any'),
    // Atividade Social
    friendsMin: z.number().int().min(0).nullable().optional(),
    friendsMax: z.number().int().min(0).nullable().optional(),
    mutualFriendsMin: z.number().int().min(0).nullable().optional(),
    mutualFriendsMax: z.number().int().min(0).nullable().optional(),
    followersMin: z.number().int().min(0).nullable().optional(),
    followersMax: z.number().int().min(0).nullable().optional(),
    postsMin: z.number().int().min(0).nullable().optional(),
    postsMax: z.number().int().min(0).nullable().optional(),
    // Keywords
    jobTitleInclude: z.array(z.string()).default([]),
    jobTitleExclude: z.array(z.string()).default([]),
    profileInfoInclude: z.array(z.string()).default([]),
    profileInfoExclude: z.array(z.string()).default([]),
    postContentInclude: z.array(z.string()).default([]),
    postContentExclude: z.array(z.string()).default([]),
});

const updateAudienceSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    gender: z.array(z.enum(['male', 'female'])).optional(),
    ignoreGenderIfUnknown: z.boolean().optional(),
    countries: z.array(z.string()).optional(),
    ignoreCountryIfUnknown: z.boolean().optional(),
    excludePrivate: z.boolean().optional(),
    excludeNoMessage: z.boolean().optional(),
    excludeNoPhoto: z.boolean().optional(),
    excludeCompanyPages: z.boolean().optional(),
    verifiedFilter: z.enum(['any', 'verified_only', 'unverified_only']).optional(),
    friendsMin: z.number().int().min(0).nullable().optional(),
    friendsMax: z.number().int().min(0).nullable().optional(),
    mutualFriendsMin: z.number().int().min(0).nullable().optional(),
    mutualFriendsMax: z.number().int().min(0).nullable().optional(),
    followersMin: z.number().int().min(0).nullable().optional(),
    followersMax: z.number().int().min(0).nullable().optional(),
    postsMin: z.number().int().min(0).nullable().optional(),
    postsMax: z.number().int().min(0).nullable().optional(),
    jobTitleInclude: z.array(z.string()).optional(),
    jobTitleExclude: z.array(z.string()).optional(),
    profileInfoInclude: z.array(z.string()).optional(),
    profileInfoExclude: z.array(z.string()).optional(),
    postContentInclude: z.array(z.string()).optional(),
    postContentExclude: z.array(z.string()).optional(),
});

audiencesRouter.use(authenticate);

// GET /audiences - List audiences
audiencesRouter.get('/', async (req, res, next) => {
    try {
        const workspaceId = req.user!.workspaceId;

        const audiences = await prisma.audience.findMany({
            where: { workspaceId },
            orderBy: { createdAt: 'desc' },
        });

        res.json({
            success: true,
            data: audiences,
        });
    } catch (error) {
        next(error);
    }
});

// GET /audiences/:id - Get audience
audiencesRouter.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const workspaceId = req.user!.workspaceId;

        const audience = await prisma.audience.findFirst({
            where: { id, workspaceId },
        });

        if (!audience) {
            throw new NotFoundError('Audiência');
        }

        res.json({
            success: true,
            data: audience,
        });
    } catch (error) {
        next(error);
    }
});

// POST /audiences - Create audience
audiencesRouter.post(
    '/',
    authorize('owner', 'admin', 'manager'),
    validate(createAudienceSchema),
    async (req, res, next) => {
        try {
            const workspaceId = req.user!.workspaceId;
            const data = req.body;

            // Check if audience name already exists
            const existingAudience = await prisma.audience.findFirst({
                where: { workspaceId, name: data.name },
            });

            if (existingAudience) {
                throw new ConflictError('Já existe uma audiência com esse nome');
            }

            const audience = await prisma.audience.create({
                data: {
                    ...data,
                    workspaceId,
                },
            });

            res.status(201).json({
                success: true,
                data: audience,
            });
        } catch (error) {
            next(error);
        }
    }
);

// PATCH /audiences/:id - Update audience
audiencesRouter.patch(
    '/:id',
    authorize('owner', 'admin', 'manager'),
    validate(updateAudienceSchema),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const workspaceId = req.user!.workspaceId;
            const updates = req.body;

            const audience = await prisma.audience.findFirst({
                where: { id, workspaceId },
            });

            if (!audience) {
                throw new NotFoundError('Audiência');
            }

            // Check for duplicate name
            if (updates.name && updates.name !== audience.name) {
                const existingAudience = await prisma.audience.findFirst({
                    where: { workspaceId, name: updates.name },
                });

                if (existingAudience) {
                    throw new ConflictError('Já existe uma audiência com esse nome');
                }
            }

            const updatedAudience = await prisma.audience.update({
                where: { id },
                data: updates,
            });

            res.json({
                success: true,
                data: updatedAudience,
            });
        } catch (error) {
            next(error);
        }
    }
);

// DELETE /audiences/:id - Delete audience
audiencesRouter.delete(
    '/:id',
    authorize('owner', 'admin', 'manager'),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const workspaceId = req.user!.workspaceId;

            const audience = await prisma.audience.findFirst({
                where: { id, workspaceId },
            });

            if (!audience) {
                throw new NotFoundError('Audiência');
            }

            await prisma.audience.delete({ where: { id } });

            res.json({
                success: true,
                data: { message: 'Audiência removida com sucesso' },
            });
        } catch (error) {
            next(error);
        }
    }
);
