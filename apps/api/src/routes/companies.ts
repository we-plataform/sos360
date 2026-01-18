import { Router } from 'express';
import { prisma } from '@sos360/database';
import {
    createCompanySchema,
    updateCompanySchema,
    inviteToCompanySchema,
} from '@sos360/shared';
import { validate } from '../middleware/validate.js';
import { authenticate, authorizeCompany } from '../middleware/auth.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../lib/errors.js';
import type { CompanyRole, WorkspaceRole } from '@sos360/shared';

export const companiesRouter = Router();

// All routes require authentication
companiesRouter.use(authenticate);

/**
 * GET /companies
 * List all companies the user has access to
 */
companiesRouter.get('/', async (req, res, next) => {
    try {
        const userId = req.user!.id;

        const companyMemberships = await prisma.companyMember.findMany({
            where: { userId },
            include: {
                company: {
                    include: {
                        _count: {
                            select: {
                                workspaces: true,
                                members: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: 'asc',
            },
        });

        const companies = companyMemberships.map((cm) => ({
            id: cm.company.id,
            name: cm.company.name,
            slug: cm.company.slug,
            plan: cm.company.plan,
            myRole: cm.role as CompanyRole,
            workspacesCount: cm.company._count.workspaces,
            membersCount: cm.company._count.members,
            createdAt: cm.company.createdAt,
        }));

        res.json({
            success: true,
            data: companies,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /companies
 * Create a new company
 */
companiesRouter.post('/', validate(createCompanySchema), async (req, res, next) => {
    try {
        const userId = req.user!.id;
        const { name, workspaceName } = req.body;

        // Generate slug from company name
        const baseSlug = name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        // Check if slug exists and append number if needed
        let slug = baseSlug;
        let counter = 1;
        while (await prisma.company.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }

        // Create company, workspace, and memberships
        const result = await prisma.$transaction(async (tx) => {
            const company = await tx.company.create({
                data: {
                    name,
                    slug,
                },
            });

            const workspace = await tx.workspace.create({
                data: {
                    name: workspaceName || 'Principal',
                    companyId: company.id,
                },
            });

            await tx.companyMember.create({
                data: {
                    userId,
                    companyId: company.id,
                    role: 'owner',
                },
            });

            await tx.workspaceMember.create({
                data: {
                    userId,
                    workspaceId: workspace.id,
                    role: 'owner',
                },
            });

            return { company, workspace };
        });

        res.status(201).json({
            success: true,
            data: {
                id: result.company.id,
                name: result.company.name,
                slug: result.company.slug,
                plan: result.company.plan,
                myRole: 'owner',
                workspace: {
                    id: result.workspace.id,
                    name: result.workspace.name,
                },
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /companies/:id
 * Get company details
 */
companiesRouter.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        // Verify membership
        const membership = await prisma.companyMember.findUnique({
            where: {
                userId_companyId: { userId, companyId: id },
            },
        });

        if (!membership) {
            throw new NotFoundError('Empresa não encontrada');
        }

        const company = await prisma.company.findUnique({
            where: { id },
            include: {
                workspaces: {
                    include: {
                        members: {
                            where: { userId },
                        },
                        _count: {
                            select: { leads: true },
                        },
                    },
                },
                _count: {
                    select: { members: true },
                },
            },
        });

        if (!company) {
            throw new NotFoundError('Empresa não encontrada');
        }

        res.json({
            success: true,
            data: {
                id: company.id,
                name: company.name,
                slug: company.slug,
                plan: company.plan,
                settings: company.settings,
                billingInfo: membership.role === 'owner' ? company.billingInfo : undefined,
                myRole: membership.role,
                membersCount: company._count.members,
                workspaces: company.workspaces.map((w) => ({
                    id: w.id,
                    name: w.name,
                    myRole: w.members.length > 0 ? (w.members[0].role as WorkspaceRole) : null,
                    leadsCount: w._count.leads,
                })),
                createdAt: company.createdAt,
                updatedAt: company.updatedAt,
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /companies/:id
 * Update company details
 */
companiesRouter.patch(
    '/:id',
    authorizeCompany('owner', 'admin'),
    validate(updateCompanySchema),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const { name, settings } = req.body;

            // Verify user has access to this specific company
            if (req.user!.companyId !== id) {
                throw new ForbiddenError('Você não pode atualizar esta empresa');
            }

            const company = await prisma.company.update({
                where: { id },
                data: {
                    ...(name && { name }),
                    ...(settings && { settings }),
                },
            });

            res.json({
                success: true,
                data: {
                    id: company.id,
                    name: company.name,
                    slug: company.slug,
                    plan: company.plan,
                    settings: company.settings,
                    updatedAt: company.updatedAt,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * DELETE /companies/:id
 * Delete a company (owner only)
 */
companiesRouter.delete('/:id', authorizeCompany('owner'), async (req, res, next) => {
    try {
        const { id } = req.params;

        // Verify user is owner of this specific company
        if (req.user!.companyId !== id) {
            throw new ForbiddenError('Você não pode deletar esta empresa');
        }

        await prisma.company.delete({
            where: { id },
        });

        res.json({
            success: true,
            data: { message: 'Empresa deletada com sucesso' },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /companies/:id/members
 * List company members
 */
companiesRouter.get('/:id/members', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        // Verify membership
        const membership = await prisma.companyMember.findUnique({
            where: {
                userId_companyId: { userId, companyId: id },
            },
        });

        if (!membership) {
            throw new NotFoundError('Empresa não encontrada');
        }

        const members = await prisma.companyMember.findMany({
            where: { companyId: id },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        fullName: true,
                        avatarUrl: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'asc',
            },
        });

        res.json({
            success: true,
            data: members.map((m) => ({
                userId: m.user.id,
                email: m.user.email,
                fullName: m.user.fullName,
                avatarUrl: m.user.avatarUrl,
                role: m.role,
                createdAt: m.createdAt,
            })),
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /companies/:id/members
 * Invite a user to the company
 */
companiesRouter.post(
    '/:id/members',
    authorizeCompany('owner', 'admin'),
    validate(inviteToCompanySchema),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const { email, role, workspaceAccess } = req.body;

            // Verify user has access to this specific company
            if (req.user!.companyId !== id) {
                throw new ForbiddenError('Você não pode convidar para esta empresa');
            }

            // Check if invitation already exists
            const existingInvitation = await prisma.companyInvitation.findUnique({
                where: {
                    companyId_email: { companyId: id, email },
                },
            });

            if (existingInvitation && existingInvitation.status === 'pending') {
                throw new ConflictError('Convite já existe para este email');
            }

            // Check if user already is a member
            const existingUser = await prisma.user.findUnique({
                where: { email },
            });

            if (existingUser) {
                const existingMember = await prisma.companyMember.findUnique({
                    where: {
                        userId_companyId: { userId: existingUser.id, companyId: id },
                    },
                });

                if (existingMember) {
                    throw new ConflictError('Usuário já é membro desta empresa');
                }
            }

            // Create invitation
            const invitation = await prisma.companyInvitation.upsert({
                where: {
                    companyId_email: { companyId: id, email },
                },
                create: {
                    email,
                    role: role || 'member',
                    companyId: id,
                    workspaceAccess: workspaceAccess || [],
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                },
                update: {
                    role: role || 'member',
                    status: 'pending',
                    workspaceAccess: workspaceAccess || [],
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                },
            });

            // TODO: Send invitation email

            res.status(201).json({
                success: true,
                data: {
                    id: invitation.id,
                    email: invitation.email,
                    role: invitation.role,
                    status: invitation.status,
                    expiresAt: invitation.expiresAt,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * DELETE /companies/:id/members/:userId
 * Remove a member from the company
 */
companiesRouter.delete(
    '/:id/members/:userId',
    authorizeCompany('owner', 'admin'),
    async (req, res, next) => {
        try {
            const { id, userId: targetUserId } = req.params;

            // Verify user has access to this specific company
            if (req.user!.companyId !== id) {
                throw new ForbiddenError('Você não pode remover membros desta empresa');
            }

            // Cannot remove yourself
            if (targetUserId === req.user!.id) {
                throw new ForbiddenError('Você não pode se remover da empresa');
            }

            // Check if target is owner
            const targetMember = await prisma.companyMember.findUnique({
                where: {
                    userId_companyId: { userId: targetUserId, companyId: id },
                },
            });

            if (!targetMember) {
                throw new NotFoundError('Membro não encontrado');
            }

            if (targetMember.role === 'owner' && req.user!.companyRole !== 'owner') {
                throw new ForbiddenError('Apenas o dono pode remover outros donos');
            }

            // Remove from company and all workspaces
            await prisma.$transaction([
                prisma.workspaceMember.deleteMany({
                    where: {
                        userId: targetUserId,
                        workspace: {
                            companyId: id,
                        },
                    },
                }),
                prisma.companyMember.delete({
                    where: {
                        userId_companyId: { userId: targetUserId, companyId: id },
                    },
                }),
            ]);

            res.json({
                success: true,
                data: { message: 'Membro removido com sucesso' },
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * PATCH /companies/:id/members/:userId
 * Update member role
 */
companiesRouter.patch(
    '/:id/members/:userId',
    authorizeCompany('owner'),
    async (req, res, next) => {
        try {
            const { id, userId: targetUserId } = req.params;
            const { role } = req.body;

            // Verify user has access to this specific company
            if (req.user!.companyId !== id) {
                throw new ForbiddenError('Você não pode atualizar membros desta empresa');
            }

            // Cannot change your own role
            if (targetUserId === req.user!.id) {
                throw new ForbiddenError('Você não pode alterar seu próprio papel');
            }

            const member = await prisma.companyMember.update({
                where: {
                    userId_companyId: { userId: targetUserId, companyId: id },
                },
                data: { role },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            fullName: true,
                        },
                    },
                },
            });

            res.json({
                success: true,
                data: {
                    userId: member.user.id,
                    email: member.user.email,
                    fullName: member.user.fullName,
                    role: member.role,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);
