import { Router } from "express";
import { prisma } from "@lia360/database";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  addWorkspaceMemberSchema,
  updateWorkspaceMemberSchema,
} from "@lia360/shared";
import { validate } from "../middleware/validate.js";
import {
  authenticate,
  authorize,
  authorizeCompany,
} from "../middleware/auth.js";
import { NotFoundError, ForbiddenError, ConflictError } from "../lib/errors.js";
import type { WorkspaceRole } from "@lia360/shared";

export const workspacesRouter = Router();

// All routes require authentication
workspacesRouter.use(authenticate);

/**
 * GET /workspaces
 * List all workspaces the user has access to in current company
 */
workspacesRouter.get("/", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const companyId = req.user!.companyId;

    const workspaceMemberships = await prisma.workspaceMember.findMany({
      where: {
        userId,
        workspace: {
          companyId,
        },
      },
      include: {
        workspace: {
          include: {
            _count: {
              select: {
                leads: true,
                members: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const workspaces = workspaceMemberships.map((wm) => ({
      id: wm.workspace.id,
      name: wm.workspace.name,
      myRole: wm.role as WorkspaceRole,
      leadsCount: wm.workspace._count.leads,
      membersCount: wm.workspace._count.members,
      createdAt: wm.workspace.createdAt,
    }));

    res.json({
      success: true,
      data: workspaces,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /workspaces
 * Create a new workspace in the current company
 */
workspacesRouter.post(
  "/",
  authorizeCompany("owner", "admin"),
  validate(createWorkspaceSchema),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const companyId = req.user!.companyId;
      const { name } = req.body;

      // Check for duplicate name in company
      const existing = await prisma.workspace.findFirst({
        where: {
          companyId,
          name,
        },
      });

      if (existing) {
        throw new ConflictError(
          "Já existe um workspace com este nome nesta empresa",
        );
      }

      // Create workspace and add creator as owner
      const workspace = await prisma.$transaction(async (tx) => {
        const ws = await tx.workspace.create({
          data: {
            name,
            companyId,
          },
        });

        await tx.workspaceMember.create({
          data: {
            userId,
            workspaceId: ws.id,
            role: "owner",
          },
        });

        return ws;
      });

      res.status(201).json({
        success: true,
        data: {
          id: workspace.id,
          name: workspace.name,
          myRole: "owner",
          createdAt: workspace.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /workspaces/:id
 * Get workspace details
 */
workspacesRouter.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: id },
      },
    });

    if (!membership) {
      throw new NotFoundError("Workspace não encontrado");
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            leads: true,
            members: true,
            templates: true,
            automations: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundError("Workspace não encontrado");
    }

    res.json({
      success: true,
      data: {
        id: workspace.id,
        name: workspace.name,
        settings: workspace.settings,
        myRole: membership.role,
        stats: {
          leads: workspace._count.leads,
          members: workspace._count.members,
          templates: workspace._count.templates,
          automations: workspace._count.automations,
        },
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /workspaces/:id
 * Update workspace details
 */
workspacesRouter.patch(
  "/:id",
  authorize("owner", "admin"),
  validate(updateWorkspaceSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, settings } = req.body;

      // Verify user has access to this specific workspace
      if (req.user!.workspaceId !== id) {
        // Check if user is company admin/owner and has access to this workspace
        const membership = await prisma.workspaceMember.findUnique({
          where: {
            userId_workspaceId: { userId: req.user!.id, workspaceId: id },
          },
        });

        if (!membership || !["owner", "admin"].includes(membership.role)) {
          throw new ForbiddenError("Você não pode atualizar este workspace");
        }
      }

      const workspace = await prisma.workspace.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(settings && { settings }),
        },
      });

      res.json({
        success: true,
        data: {
          id: workspace.id,
          name: workspace.name,
          settings: workspace.settings,
          updatedAt: workspace.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /workspaces/:id
 * Delete a workspace
 */
workspacesRouter.delete("/:id", authorize("owner"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;

    // Verify this workspace belongs to user's current company
    const workspace = await prisma.workspace.findUnique({
      where: { id },
    });

    if (!workspace || workspace.companyId !== companyId) {
      throw new NotFoundError("Workspace não encontrado");
    }

    // Check if this is the last workspace
    const workspaceCount = await prisma.workspace.count({
      where: { companyId },
    });

    if (workspaceCount === 1) {
      throw new ForbiddenError(
        "Não é possível deletar o último workspace da empresa",
      );
    }

    // Verify user is workspace owner
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId: req.user!.id, workspaceId: id },
      },
    });

    if (!membership || membership.role !== "owner") {
      // Allow company owner to delete any workspace
      if (req.user!.companyRole !== "owner") {
        throw new ForbiddenError("Apenas o dono do workspace pode deletá-lo");
      }
    }

    await prisma.workspace.delete({
      where: { id },
    });

    res.json({
      success: true,
      data: { message: "Workspace deletado com sucesso" },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /workspaces/:id/members
 * List workspace members
 */
workspacesRouter.get("/:id/members", async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: id },
      },
    });

    if (!membership) {
      throw new NotFoundError("Workspace não encontrado");
    }

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: id },
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
        createdAt: "asc",
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
 * POST /workspaces/:id/members
 * Add a company member to the workspace
 */
workspacesRouter.post(
  "/:id/members",
  authorize("owner", "admin"),
  validate(addWorkspaceMemberSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { userId: targetUserId, role } = req.body;
      const companyId = req.user!.companyId;

      // Verify this workspace belongs to user's current company
      const workspace = await prisma.workspace.findUnique({
        where: { id },
      });

      if (!workspace || workspace.companyId !== companyId) {
        throw new NotFoundError("Workspace não encontrado");
      }

      // Verify target user is a company member
      const companyMember = await prisma.companyMember.findUnique({
        where: {
          userId_companyId: { userId: targetUserId, companyId },
        },
      });

      if (!companyMember) {
        throw new ForbiddenError("Usuário não é membro desta empresa");
      }

      // Check if already a member
      const existingMember = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId: targetUserId, workspaceId: id },
        },
      });

      if (existingMember) {
        throw new ConflictError("Usuário já é membro deste workspace");
      }

      // Add member
      const member = await prisma.workspaceMember.create({
        data: {
          userId: targetUserId,
          workspaceId: id,
          role,
        },
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

      res.status(201).json({
        success: true,
        data: {
          userId: member.user.id,
          email: member.user.email,
          fullName: member.user.fullName,
          avatarUrl: member.user.avatarUrl,
          role: member.role,
          createdAt: member.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PATCH /workspaces/:id/members/:userId
 * Update member role
 */
workspacesRouter.patch(
  "/:id/members/:userId",
  authorize("owner", "admin"),
  validate(updateWorkspaceMemberSchema),
  async (req, res, next) => {
    try {
      const { id, userId: targetUserId } = req.params;
      const { role } = req.body;

      // Verify user has access to this workspace
      const myMembership = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId: req.user!.id, workspaceId: id },
        },
      });

      if (!myMembership || !["owner", "admin"].includes(myMembership.role)) {
        throw new ForbiddenError(
          "Você não pode atualizar membros deste workspace",
        );
      }

      // Cannot change your own role
      if (targetUserId === req.user!.id) {
        throw new ForbiddenError("Você não pode alterar seu próprio papel");
      }

      // Only owner can assign owner role
      if (role === "owner" && myMembership.role !== "owner") {
        throw new ForbiddenError(
          "Apenas o dono pode promover outro usuário a dono",
        );
      }

      const member = await prisma.workspaceMember.update({
        where: {
          userId_workspaceId: { userId: targetUserId, workspaceId: id },
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
  },
);

/**
 * DELETE /workspaces/:id/members/:userId
 * Remove a member from the workspace
 */
workspacesRouter.delete(
  "/:id/members/:userId",
  authorize("owner", "admin"),
  async (req, res, next) => {
    try {
      const { id, userId: targetUserId } = req.params;

      // Verify user has access to this workspace
      const myMembership = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId: req.user!.id, workspaceId: id },
        },
      });

      if (!myMembership || !["owner", "admin"].includes(myMembership.role)) {
        throw new ForbiddenError(
          "Você não pode remover membros deste workspace",
        );
      }

      // Cannot remove yourself
      if (targetUserId === req.user!.id) {
        throw new ForbiddenError("Você não pode se remover do workspace");
      }

      // Check if target is owner
      const targetMember = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId: targetUserId, workspaceId: id },
        },
      });

      if (!targetMember) {
        throw new NotFoundError("Membro não encontrado");
      }

      if (targetMember.role === "owner" && myMembership.role !== "owner") {
        throw new ForbiddenError("Apenas o dono pode remover outros donos");
      }

      await prisma.workspaceMember.delete({
        where: {
          userId_workspaceId: { userId: targetUserId, workspaceId: id },
        },
      });

      res.json({
        success: true,
        data: { message: "Membro removido do workspace com sucesso" },
      });
    } catch (error) {
      next(error);
    }
  },
);
