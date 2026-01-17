import { Router } from 'express';
import { prisma } from '@sos360/database';
import { inviteUserSchema, updateUserSchema } from '@sos360/shared';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../lib/errors.js';

export const usersRouter = Router();

usersRouter.use(authenticate);

// GET /users - List workspace users
usersRouter.get('/', async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;

    const users = await prisma.user.findMany({
      where: { workspaceId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        avatarUrl: true,
        lastLoginAt: true,
        createdAt: true,
        _count: {
          select: {
            assignedLeads: true,
            assignedConversations: {
              where: { status: 'active' },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const formattedUsers = users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      stats: {
        leadsAssigned: user._count.assignedLeads,
        conversationsActive: user._count.assignedConversations,
      },
      lastLogin: user.lastLoginAt,
      createdAt: user.createdAt,
    }));

    res.json({
      success: true,
      data: formattedUsers,
    });
  } catch (error) {
    next(error);
  }
});

// POST /users/invite - Invite user to workspace
usersRouter.post(
  '/invite',
  authorize('owner', 'admin'),
  validate(inviteUserSchema),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const { email, role = 'agent' } = req.body;

      // Check if user already exists in workspace
      const existingUser = await prisma.user.findFirst({
        where: { workspaceId, email },
      });

      if (existingUser) {
        throw new ConflictError('Usuário já faz parte deste workspace');
      }

      // Check for existing invitation
      const existingInvitation = await prisma.invitation.findFirst({
        where: { workspaceId, email, status: 'pending' },
      });

      if (existingInvitation) {
        throw new ConflictError('Já existe um convite pendente para este email');
      }

      // Create invitation
      const invitation = await prisma.invitation.create({
        data: {
          email,
          role,
          workspaceId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
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

// GET /users/:id - Get user details
usersRouter.get('/:id', authorize('owner', 'admin', 'manager'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspaceId;

    const user = await prisma.user.findFirst({
      where: { id, workspaceId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        avatarUrl: true,
        settings: true,
        lastLoginAt: true,
        createdAt: true,
        _count: {
          select: {
            assignedLeads: true,
            assignedConversations: true,
            sentMessages: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('Usuário');
    }

    res.json({
      success: true,
      data: {
        ...user,
        stats: {
          leadsAssigned: user._count.assignedLeads,
          conversationsTotal: user._count.assignedConversations,
          messagesSent: user._count.sentMessages,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /users/:id - Update user
usersRouter.patch(
  '/:id',
  authorize('owner', 'admin'),
  validate(updateUserSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workspaceId = req.user!.workspaceId;
      const updates = req.body;

      const user = await prisma.user.findFirst({
        where: { id, workspaceId },
      });

      if (!user) {
        throw new NotFoundError('Usuário');
      }

      // Prevent changing owner role
      if (user.role === 'owner' && updates.role && updates.role !== 'owner') {
        throw new ForbiddenError('Não é possível alterar o role do proprietário');
      }

      // Admin cannot change another admin or owner
      if (req.user!.role === 'admin' && (user.role === 'owner' || user.role === 'admin')) {
        throw new ForbiddenError('Você não tem permissão para alterar este usuário');
      }

      const updated = await prisma.user.update({
        where: { id },
        data: updates,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          avatarUrl: true,
        },
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /users/:id - Remove user from workspace
usersRouter.delete('/:id', authorize('owner', 'admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspaceId;

    const user = await prisma.user.findFirst({
      where: { id, workspaceId },
    });

    if (!user) {
      throw new NotFoundError('Usuário');
    }

    // Cannot remove owner
    if (user.role === 'owner') {
      throw new ForbiddenError('Não é possível remover o proprietário do workspace');
    }

    // Cannot remove yourself
    if (user.id === req.user!.id) {
      throw new ForbiddenError('Você não pode remover a si mesmo');
    }

    // Admin cannot remove another admin
    if (req.user!.role === 'admin' && user.role === 'admin') {
      throw new ForbiddenError('Admins não podem remover outros admins');
    }

    await prisma.user.delete({ where: { id } });

    res.json({
      success: true,
      data: { message: 'Usuário removido com sucesso' },
    });
  } catch (error) {
    next(error);
  }
});
