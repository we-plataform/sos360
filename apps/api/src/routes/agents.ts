import { Router } from "express";
import { prisma } from "@lia360/database";
import { upsertAgentSchema, updateAgentSchema } from "@lia360/shared";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { NotFoundError } from "../lib/errors.js";

export const agentsRouter = Router();

agentsRouter.use(authenticate);

// GET /agents - List agents
agentsRouter.get("/", async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;
    const { type, enabled } = req.query;

    const where: Record<string, unknown> = { workspaceId };
    if (type) where.type = type;
    if (enabled !== undefined) where.enabled = enabled === "true";

    const agents = await prisma.agent.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: agents,
    });
  } catch (error) {
    next(error);
  }
});

// POST /agents - Create agent
agentsRouter.post(
  "/",
  authorize("owner", "admin", "manager"),
  validate(upsertAgentSchema),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const {
        name,
        type,
        systemPrompt,
        temperature,
        maxTokens,
        model,
        enabled,
      } = req.body;

      const agent = await prisma.agent.create({
        data: {
          name,
          type,
          systemPrompt,
          temperature: temperature ?? 0.7,
          maxTokens: maxTokens ?? 500,
          model: model ?? "gpt-4o-mini",
          enabled: enabled ?? true,
          workspaceId,
        },
      });

      res.status(201).json({
        success: true,
        data: agent,
      });
    } catch (error) {
      next(error);
    }
  },
);

// GET /agents/:id - Get agent
agentsRouter.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspaceId;

    const agent = await prisma.agent.findFirst({
      where: { id, workspaceId },
    });

    if (!agent) {
      throw new NotFoundError("Agent");
    }

    res.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /agents/:id - Update agent
agentsRouter.patch(
  "/:id",
  authorize("owner", "admin", "manager"),
  validate(updateAgentSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workspaceId = req.user!.workspaceId;
      const updates = req.body;

      const agent = await prisma.agent.findFirst({
        where: { id, workspaceId },
      });

      if (!agent) {
        throw new NotFoundError("Agent");
      }

      const updated = await prisma.agent.update({
        where: { id },
        data: updates,
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /agents/:id - Delete agent
agentsRouter.delete(
  "/:id",
  authorize("owner", "admin", "manager"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workspaceId = req.user!.workspaceId;

      const agent = await prisma.agent.findFirst({
        where: { id, workspaceId },
      });

      if (!agent) {
        throw new NotFoundError("Agent");
      }

      await prisma.agent.delete({ where: { id } });

      res.json({
        success: true,
        data: { message: "Agent removido com sucesso" },
      });
    } catch (error) {
      next(error);
    }
  },
);
