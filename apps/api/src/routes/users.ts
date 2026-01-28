import { Router } from "express";
import { prisma } from "@lia360/database";
import { updateWorkspaceMemberSchema } from "@lia360/shared";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { NotFoundError, ForbiddenError } from "../lib/errors.js";
import type { WorkspaceRole } from "@lia360/shared";

export const usersRouter = Router();

usersRouter.use(authenticate);

/**
 * GET /users - List workspace users (members of current workspace)
 */
usersRouter.get("/", async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            avatarUrl: true,
            lastLoginAt: true,
            createdAt: true,
            _count: {
              select: {
                assignedLeads: {
                  where: { workspaceId },
                },
                assignedConversations: {
                  where: {
                    status: "active",
                    lead: { workspaceId },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const formattedUsers = members.map((member) => ({
      id: member.user.id,
      email: member.user.email,
      fullName: member.user.fullName,
      role: member.role as WorkspaceRole,
      avatarUrl: member.user.avatarUrl,
      stats: {
        leadsAssigned: member.user._count.assignedLeads,
        conversationsActive: member.user._count.assignedConversations,
      },
      lastLogin: member.user.lastLoginAt,
      joinedAt: member.createdAt,
      createdAt: member.user.createdAt,
    }));

    res.json({
      success: true,
      data: formattedUsers,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /users/me - Get current user profile
 */
usersRouter.get("/me", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        settings: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError("Usuário");
    }

    res.json({
      success: true,
      data: {
        ...user,
        workspaceRole: req.user!.workspaceRole,
        companyRole: req.user!.companyRole,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /users/:id - Get user details
 */
usersRouter.get(
  "/:id",
  authorize("owner", "admin", "manager"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workspaceId = req.user!.workspaceId;

      // Check if user is a member of this workspace
      const member = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId: id, workspaceId },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              avatarUrl: true,
              settings: true,
              lastLoginAt: true,
              createdAt: true,
              _count: {
                select: {
                  assignedLeads: {
                    where: { workspaceId },
                  },
                  assignedConversations: {
                    where: { lead: { workspaceId } },
                  },
                  sentMessages: true,
                },
              },
            },
          },
        },
      });

      if (!member) {
        throw new NotFoundError("Usuário");
      }

      res.json({
        success: true,
        data: {
          id: member.user.id,
          email: member.user.email,
          fullName: member.user.fullName,
          role: member.role,
          avatarUrl: member.user.avatarUrl,
          settings: member.user.settings,
          lastLoginAt: member.user.lastLoginAt,
          joinedAt: member.createdAt,
          createdAt: member.user.createdAt,
          stats: {
            leadsAssigned: member.user._count.assignedLeads,
            conversationsTotal: member.user._count.assignedConversations,
            messagesSent: member.user._count.sentMessages,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PATCH /users/:id - Update user's workspace role
 */
usersRouter.patch(
  "/:id",
  authorize("owner", "admin"),
  validate(updateWorkspaceMemberSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workspaceId = req.user!.workspaceId;
      const { role } = req.body;

      // Check if user is a member of this workspace
      const member = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId: id, workspaceId },
        },
      });

      if (!member) {
        throw new NotFoundError("Usuário");
      }

      // Prevent changing owner role (only another owner can do this)
      if (member.role === "owner" && req.user!.workspaceRole !== "owner") {
        throw new ForbiddenError("Apenas o dono pode alterar outro dono");
      }

      // Admin cannot change another admin or owner
      if (
        req.user!.workspaceRole === "admin" &&
        (member.role === "owner" || member.role === "admin")
      ) {
        throw new ForbiddenError(
          "Você não tem permissão para alterar este usuário",
        );
      }

      // Cannot change your own role
      if (id === req.user!.id) {
        throw new ForbiddenError("Você não pode alterar seu próprio papel");
      }

      // Only owner can assign owner role
      if (role === "owner" && req.user!.workspaceRole !== "owner") {
        throw new ForbiddenError(
          "Apenas o dono pode promover outro usuário a dono",
        );
      }

      const updated = await prisma.workspaceMember.update({
        where: {
          userId_workspaceId: { userId: id, workspaceId },
        },
        data: { role },
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
      });

      res.json({
        success: true,
        data: {
          id: updated.user.id,
          email: updated.user.email,
          fullName: updated.user.fullName,
          role: updated.role,
          avatarUrl: updated.user.avatarUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /users/:id - Remove user from workspace
 */
usersRouter.delete(
  "/:id",
  authorize("owner", "admin"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workspaceId = req.user!.workspaceId;

      // Check if user is a member of this workspace
      const member = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId: id, workspaceId },
        },
      });

      if (!member) {
        throw new NotFoundError("Usuário");
      }

      // Cannot remove owner
      if (member.role === "owner") {
        throw new ForbiddenError("Não é possível remover o dono do workspace");
      }

      // Cannot remove yourself
      if (id === req.user!.id) {
        throw new ForbiddenError("Você não pode remover a si mesmo");
      }

      // Admin cannot remove another admin
      if (req.user!.workspaceRole === "admin" && member.role === "admin") {
        throw new ForbiddenError("Admins não podem remover outros admins");
      }

      await prisma.workspaceMember.delete({
        where: {
          userId_workspaceId: { userId: id, workspaceId },
        },
      });

      res.json({
        success: true,
        data: { message: "Usuário removido do workspace com sucesso" },
      });
    } catch (error) {
      next(error);
    }
  },
);
