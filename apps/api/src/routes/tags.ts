import { Router } from "express";
import { prisma } from "@lia360/database";
import { createTagSchema, updateTagSchema } from "@lia360/shared";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { NotFoundError, ConflictError } from "../lib/errors.js";

export const tagsRouter = Router();

tagsRouter.use(authenticate);

// GET /tags - List tags
tagsRouter.get("/", async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;

    const tags = await prisma.tag.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: { leads: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const formattedTags = tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      leadsCount: tag._count.leads,
      createdAt: tag.createdAt,
    }));

    res.json({
      success: true,
      data: formattedTags,
    });
  } catch (error) {
    next(error);
  }
});

// POST /tags - Create tag
tagsRouter.post(
  "/",
  authorize("owner", "admin", "manager"),
  validate(createTagSchema),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const { name, color } = req.body;

      // Check if tag name already exists
      const existingTag = await prisma.tag.findFirst({
        where: { workspaceId, name },
      });

      if (existingTag) {
        throw new ConflictError("Já existe uma tag com esse nome");
      }

      const tag = await prisma.tag.create({
        data: {
          name,
          color: color || "#6366F1",
          workspaceId,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          ...tag,
          leadsCount: 0,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /tags/:id - Update tag
tagsRouter.patch(
  "/:id",
  authorize("owner", "admin", "manager"),
  validate(updateTagSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workspaceId = req.user!.workspaceId;
      const updates = req.body;

      const tag = await prisma.tag.findFirst({
        where: { id, workspaceId },
      });

      if (!tag) {
        throw new NotFoundError("Tag");
      }

      // Check for duplicate name
      if (updates.name && updates.name !== tag.name) {
        const existingTag = await prisma.tag.findFirst({
          where: { workspaceId, name: updates.name },
        });

        if (existingTag) {
          throw new ConflictError("Já existe uma tag com esse nome");
        }
      }

      const updatedTag = await prisma.tag.update({
        where: { id },
        data: updates,
        include: {
          _count: {
            select: { leads: true },
          },
        },
      });

      res.json({
        success: true,
        data: {
          id: updatedTag.id,
          name: updatedTag.name,
          color: updatedTag.color,
          leadsCount: updatedTag._count.leads,
          createdAt: updatedTag.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /tags/:id - Delete tag
tagsRouter.delete(
  "/:id",
  authorize("owner", "admin", "manager"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workspaceId = req.user!.workspaceId;

      const tag = await prisma.tag.findFirst({
        where: { id, workspaceId },
      });

      if (!tag) {
        throw new NotFoundError("Tag");
      }

      await prisma.tag.delete({ where: { id } });

      res.json({
        success: true,
        data: { message: "Tag removida com sucesso" },
      });
    } catch (error) {
      next(error);
    }
  },
);
