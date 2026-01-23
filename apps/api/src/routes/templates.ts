import { Router } from 'express';
import { prisma } from '@lia360/database';
import { createTemplateSchema, updateTemplateSchema, extractTemplateVariables } from '@lia360/shared';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../lib/errors.js';

export const templatesRouter = Router();

templatesRouter.use(authenticate);

// GET /templates - List templates
templatesRouter.get('/', async (req, res, next) => {
  try {
    const workspaceId = req.user!.workspaceId;
    const { platform, category } = req.query;

    const where: Record<string, unknown> = { workspaceId };
    if (platform) where.platform = platform;
    if (category) where.category = category;

    const templates = await prisma.template.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, fullName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    next(error);
  }
});

// POST /templates - Create template
templatesRouter.post(
  '/',
  authorize('owner', 'admin', 'manager'),
  validate(createTemplateSchema),
  async (req, res, next) => {
    try {
      const workspaceId = req.user!.workspaceId;
      const userId = req.user!.id;
      const { name, content, platform, category } = req.body;

      // Extract variables from content
      const variables = extractTemplateVariables(content);

      const template = await prisma.template.create({
        data: {
          name,
          content,
          platform,
          category,
          variables,
          workspaceId,
          createdById: userId,
        },
        include: {
          createdBy: {
            select: { id: true, fullName: true },
          },
        },
      });

      res.status(201).json({
        success: true,
        data: template,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /templates/:id - Get template
templatesRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspaceId;

    const template = await prisma.template.findFirst({
      where: { id, workspaceId },
      include: {
        createdBy: {
          select: { id: true, fullName: true },
        },
      },
    });

    if (!template) {
      throw new NotFoundError('Template');
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /templates/:id - Update template
templatesRouter.patch(
  '/:id',
  authorize('owner', 'admin', 'manager'),
  validate(updateTemplateSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workspaceId = req.user!.workspaceId;
      const updates = req.body;

      const template = await prisma.template.findFirst({
        where: { id, workspaceId },
      });

      if (!template) {
        throw new NotFoundError('Template');
      }

      // Re-extract variables if content changed
      if (updates.content) {
        updates.variables = extractTemplateVariables(updates.content);
      }

      const updated = await prisma.template.update({
        where: { id },
        data: updates,
        include: {
          createdBy: {
            select: { id: true, fullName: true },
          },
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

// DELETE /templates/:id - Delete template
templatesRouter.delete('/:id', authorize('owner', 'admin', 'manager'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const workspaceId = req.user!.workspaceId;

    const template = await prisma.template.findFirst({
      where: { id, workspaceId },
    });

    if (!template) {
      throw new NotFoundError('Template');
    }

    await prisma.template.delete({ where: { id } });

    res.json({
      success: true,
      data: { message: 'Template removido com sucesso' },
    });
  } catch (error) {
    next(error);
  }
});
